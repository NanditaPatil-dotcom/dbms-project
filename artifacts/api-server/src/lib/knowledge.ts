import { mongoCollection, getMongoDb } from "@workspace/db";
import { logger } from "./logger";

/**
 * MongoDB-backed knowledge layer. MySQL stays the source of truth for FAQs;
 * MongoDB contributes document content, tags/keywords and passage chunks.
 */

export type KnowledgeDocument = {
  documentId: string;
  title: string;
  department: string;
  documentType: string;
  source: string;
  snippet: string;
  tags: string[];
  score: number;
};

type DocRecord = {
  document_id: string;
  title: string;
  department: string;
  document_type: string;
  source: string;
  content: string;
  tags?: string[];
  score?: number;
};
type ChunkRecord = { document_id: string; chunk_text: string; score?: number };
type EnrichmentRecord = { faq_id: number; tags: string[]; keywords: string[]; related_document_ids?: string[]; score?: number };

const DOC_PROJECTION = { _id: 0, document_id: 1, title: 1, department: 1, document_type: 1, source: 1, content: 1, tags: 1 } as const;
const STOP_WORDS = new Set(["what", "when", "where", "which", "does", "have", "with", "from", "that", "this", "your", "there", "about", "into", "need", "how", "can", "the", "and", "for", "are", "who", "why", "i", "do", "is", "to", "a", "of", "my", "me"]);

/** Remove characters that change $text semantics (phrases, negation). */
export const sanitizeSearch = (text: string) => text.replace(/["\\]/g, " ").replace(/(^|\s)-+/g, "$1").trim();

const toSnippet = (text: string) => (text.length > 220 ? `${text.slice(0, 217).trimEnd()}…` : text);

const toKnowledgeDocument = (doc: DocRecord, snippet: string, score: number): KnowledgeDocument => ({
  documentId: doc.document_id,
  title: doc.title,
  department: doc.department,
  documentType: doc.document_type,
  source: doc.source,
  snippet,
  tags: doc.tags ?? [],
  score: Math.round(score * 100) / 100,
});

/** Full-text search over knowledge_documents and document_chunks; best chunk becomes the snippet. */
export async function searchKnowledge(query: string, limit = 5): Promise<KnowledgeDocument[]> {
  const search = sanitizeSearch(query);
  if (!search) return [];
  const [docs, chunks] = await Promise.all([mongoCollection<DocRecord>("knowledge_documents"), mongoCollection<ChunkRecord>("document_chunks")]);

  const [docHits, chunkHits] = await Promise.all([
    docs
      .find({ $text: { $search: search } }, { projection: { ...DOC_PROJECTION, score: { $meta: "textScore" } } })
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .toArray(),
    chunks
      .find({ $text: { $search: search } }, { projection: { _id: 0, document_id: 1, chunk_text: 1, score: { $meta: "textScore" } } })
      .sort({ score: { $meta: "textScore" } })
      .limit(limit * 2)
      .toArray(),
  ]);

  const bestChunk = new Map<string, ChunkRecord>();
  for (const chunk of chunkHits) if (!bestChunk.has(chunk.document_id)) bestChunk.set(chunk.document_id, chunk);

  const byId = new Map<string, DocRecord>(docHits.map((doc) => [doc.document_id, doc]));
  const missing = [...bestChunk.keys()].filter((id) => !byId.has(id));
  if (missing.length) {
    const extra = await docs.find({ document_id: { $in: missing } }, { projection: DOC_PROJECTION }).toArray();
    for (const doc of extra) byId.set(doc.document_id, doc);
  }

  const maxScore = Math.max(...docHits.map((d) => d.score ?? 0), ...chunkHits.map((c) => c.score ?? 0), 0.0001);
  return [...byId.values()]
    .map((doc) => {
      const chunk = bestChunk.get(doc.document_id);
      const score = Math.max(doc.score ?? 0, (chunk?.score ?? 0) * 0.8) / maxScore;
      return toKnowledgeDocument(doc, toSnippet(chunk?.chunk_text ?? doc.content), score);
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** faq_id -> 0..1 boost, from tag/keyword text matches in faq_enrichment. */
export async function searchFaqBoosts(query: string): Promise<Map<number, number>> {
  const search = sanitizeSearch(query);
  const boosts = new Map<number, number>();
  if (!search) return boosts;
  const collection = await mongoCollection<EnrichmentRecord>("faq_enrichment");
  const hits = await collection
    .find({ $text: { $search: search } }, { projection: { _id: 0, faq_id: 1, score: { $meta: "textScore" } } })
    .sort({ score: { $meta: "textScore" } })
    .limit(20)
    .toArray();
  const max = Math.max(...hits.map((hit) => hit.score ?? 0), 0.0001);
  for (const hit of hits) boosts.set(Number(hit.faq_id), (hit.score ?? 0) / max);
  return boosts;
}

/** Documents linked to a FAQ through faq_enrichment.related_document_ids. */
export async function getFaqDocuments(faqId: number): Promise<KnowledgeDocument[]> {
  const enrichment = await (await mongoCollection<EnrichmentRecord>("faq_enrichment")).findOne({ faq_id: faqId }, { projection: { _id: 0, related_document_ids: 1 } });
  const ids = enrichment?.related_document_ids ?? [];
  if (!ids.length) return [];
  const docs = await (await mongoCollection<DocRecord>("knowledge_documents")).find({ document_id: { $in: ids } }, { projection: DOC_PROJECTION }).toArray();
  const chunks = await (await mongoCollection<ChunkRecord>("document_chunks"))
    .find({ document_id: { $in: ids }, chunk_index: 0 }, { projection: { _id: 0, document_id: 1, chunk_text: 1 } })
    .toArray();
  const firstChunk = new Map(chunks.map((chunk) => [chunk.document_id, chunk.chunk_text]));
  return docs.map((doc) => toKnowledgeDocument(doc, toSnippet(firstChunk.get(doc.document_id) ?? doc.content), 1));
}

/** Create flexible tags/keywords for a newly published FAQ. */
export async function createFaqEnrichment(faqId: number, question: string, category: string, department: string) {
  const words = [...new Set(question.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? [])].filter((word) => !STOP_WORDS.has(word));
  const collection = await mongoCollection<EnrichmentRecord>("faq_enrichment");
  await collection.updateOne(
    { faq_id: faqId },
    { $set: { faq_id: faqId, tags: [category.toLowerCase(), department.toLowerCase()], keywords: words, related_document_ids: [] } },
    { upsert: true },
  );
}

/** Live counts used by the admin database demo. */
export async function knowledgeStats() {
  const db = await getMongoDb();
  const [documents, chunks, enrichment] = await Promise.all([
    db.collection("knowledge_documents").countDocuments(),
    db.collection("document_chunks").countDocuments(),
    db.collection("faq_enrichment").countDocuments(),
  ]);
  return { documents, chunks, enrichment };
}

/** Run a MongoDB step without letting an outage break MySQL-backed features. */
export async function safeMongo<T>(label: string, work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch (error) {
    logger.warn({ err: error }, `MongoDB unavailable during ${label}; continuing with MySQL results only`);
    return fallback;
  }
}
