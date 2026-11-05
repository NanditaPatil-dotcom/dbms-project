import { Router, type IRouter, type Request } from "express";
import type { RowDataPacket } from "mysql2";
import { mysqlPool } from "@workspace/db";
import {
  createFaqEnrichment,
  getFaqDocuments,
  knowledgeStats,
  safeMongo,
  searchFaqBoosts,
  searchKnowledge,
  type KnowledgeDocument,
} from "../lib/knowledge";

/**
 * Hybrid data layer
 *  - MySQL   : users, FAQs, categories, departments, feedback, bookmarks, history, document metadata
 *  - MongoDB : document content, tags, rules, chunks and FAQ enrichment (keywords/tags)
 */
const router: IRouter = Router();

type FaqRow = RowDataPacket & {
  faq_id: number; question: string; answer: string; category_id: number; category_name: string;
  department_name: string; updated_at: Date; view_count: number; status: string;
  source?: string | null; relevance?: number;
};

const mapFaq = (row: FaqRow) => ({
  id: row.faq_id,
  question: row.question,
  answer: row.answer,
  category: row.category_name,
  department: row.department_name,
  updatedAt: new Date(row.updated_at).toISOString().slice(0, 10),
  relevance: Math.round(Number(row.relevance ?? 0.82) * 100) / 100,
  views: Number(row.view_count),
  status: row.status.toLowerCase(),
  source: row.source ?? "CampusQuery knowledge base",
});

const faqSelect = `SELECT f.faq_id, f.question, f.answer, f.category_id, c.category_name, d.department_name,
  f.updated_at, f.view_count, f.status
  FROM FAQ f JOIN CATEGORY c ON c.category_id = f.category_id
  JOIN DEPARTMENT d ON d.department_id = f.department_id`;

const sqlErrno = (error: unknown) => (error as { errno?: number } | null)?.errno;
const ER_DUP_ENTRY = 1062;
const ER_SIGNAL_EXCEPTION = 1644;
const searchStopWords = new Set(["a", "an", "and", "are", "do", "for", "how", "i", "in", "is", "it", "of", "on", "the", "to", "what", "when", "where", "which"]);

const searchWords = (value: string) =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z0-9]+/g) ?? [];

const editDistance = (left: string, right: string) => {
  const distances = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i++) distances[i][0] = i;
  for (let j = 0; j <= right.length; j++) distances[0][j] = j;
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      const substitution = distances[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1);
      distances[i][j] = Math.min(distances[i - 1][j] + 1, distances[i][j - 1] + 1, substitution);
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        distances[i][j] = Math.min(distances[i][j], distances[i - 2][j - 2] + 1);
      }
    }
  }
  return distances[left.length][right.length];
};

const fuzzyFaqScore = (query: string, content: string) => {
  const terms = searchWords(query).filter((word) => word.length >= 3 && !searchStopWords.has(word));
  const words = searchWords(content);
  if (!terms.length || !words.length) return 0;

  const scores = terms.map((term) => {
    const maxDistance = term.length < 5 ? 0 : term.length < 10 ? 1 : 2;
    let bestScore = 0;
    for (const word of words) {
      if (word.startsWith(term)) bestScore = Math.max(bestScore, 0.96);
      const distance = editDistance(term, word);
      if (distance <= maxDistance) bestScore = Math.max(bestScore, 1 - distance / Math.max(term.length, word.length));
    }
    return bestScore;
  });

  return scores.every((score) => score > 0) ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
};

const sortFaqs = (items: FaqRow[], sort: string) => items.sort((a, b) =>
  sort === "viewed" ? Number(b.view_count) - Number(a.view_count)
  : sort === "updated" ? new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  : Number(b.relevance) - Number(a.relevance));

const demoUser = (req: Request) => {
  const role = req.header("x-demo-role") === "Admin" ? "Admin" : "Student";
  return role === "Admin"
    ? { id: 1, name: "Dr. Priya Menon", email: "priya.menon@campusquery.demo", role, initials: "PM", department: "Student Affairs" }
    : { id: 2, name: "Arjun Rao", email: "arjun.rao@campusquery.demo", role, initials: "AR", department: "Computer Science & Engineering" };
};

const priorityLabel = (value: number) => (value <= 2 ? "LOW" : value === 3 ? "MEDIUM" : "HIGH");

router.get("/auth/session", (req, res) => res.json({ user: demoUser(req) }));

router.get("/search", async (req, res) => {
  const startedAt = Date.now();
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.status(400).json({ error: "Search query must be at least 2 characters." });
  const department = req.query.department ? String(req.query.department) : null;
  const category = req.query.category ? String(req.query.category) : null;
  const sort = ["relevance", "viewed", "updated"].includes(String(req.query.sort)) ? String(req.query.sort) : "relevance";

  // MongoDB: tag/keyword boosts for FAQs plus matching knowledge documents.
  const [boosts, knowledgeDocuments] = await Promise.all([
    safeMongo("FAQ enrichment search", () => searchFaqBoosts(q), new Map<number, number>()),
    safeMongo("knowledge search", () => searchKnowledge(q), [] as KnowledgeDocument[]),
  ]);

  // MySQL: FULLTEXT keyword match, OR a FAQ that MongoDB tagged as relevant, within the structured filters.
  const boostedIds = [...boosts.keys()];
  const [rows] = await mysqlPool.query<FaqRow[]>(
    `SELECT f.faq_id, f.question, f.answer, c.category_name, d.department_name, f.updated_at, f.view_count, f.status,
       MATCH(f.question, f.answer) AGAINST (? IN NATURAL LANGUAGE MODE) AS keyword_score
     FROM FAQ f JOIN CATEGORY c ON c.category_id = f.category_id
     JOIN DEPARTMENT d ON d.department_id = f.department_id
     WHERE f.status = 'PUBLISHED'
       AND (? IS NULL OR d.department_name = ?) AND (? IS NULL OR c.category_name = ?)
       AND (MATCH(f.question, f.answer) AGAINST (? IN NATURAL LANGUAGE MODE) OR f.faq_id IN (?)
         OR LOWER(f.question) LIKE ? OR LOWER(f.answer) LIKE ?)`,
    [q, department, department, category, category, q, boostedIds.length ? boostedIds : [0], `%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`],
  );

  let ranked: FaqRow[];
  if (rows.length) {
    const maxKeyword = Math.max(...rows.map((row) => Number(row.keyword_score ?? 0)), 0.0001);
    ranked = rows.map((row) => {
      const keyword = Number(row.keyword_score ?? 0) / maxKeyword;
      const boost = boosts.get(row.faq_id) ?? 0;
      const relevance = Math.min(1, keyword * 0.7 + boost * 0.3);
      return { ...row, relevance: relevance || 0.75 } as FaqRow;
    });
  } else {
    // If full-text and substring matching find nothing, try a small typo-tolerant scan.
    const [candidates] = await mysqlPool.query<FaqRow[]>(
      `SELECT f.faq_id, f.question, f.answer, c.category_name, d.department_name, f.updated_at, f.view_count, f.status, 0 AS keyword_score
       FROM FAQ f JOIN CATEGORY c ON c.category_id = f.category_id
       JOIN DEPARTMENT d ON d.department_id = f.department_id
       WHERE f.status = 'PUBLISHED' AND (? IS NULL OR d.department_name = ?) AND (? IS NULL OR c.category_name = ?)
       ORDER BY f.view_count DESC LIMIT 500`,
      [department, department, category, category],
    );
    ranked = candidates
      .map((row) => ({ ...row, relevance: fuzzyFaqScore(q, `${row.question} ${row.answer}`) } as FaqRow))
      .filter((row) => Number(row.relevance) > 0);
  }
  ranked = sortFaqs(ranked, sort).slice(0, 20);

  await mysqlPool.query("INSERT INTO SEARCH_HISTORY (user_id, query_text, result_count) VALUES (?, ?, ?)", [demoUser(req).id, q, ranked.length]);
  return res.json({ query: q, results: ranked.map(mapFaq), total: ranked.length, tookMs: Date.now() - startedAt, knowledgeDocuments });
});

router.get("/faqs", async (req, res) => {
  const department = req.query.department ? String(req.query.department) : null;
  const category = req.query.category ? String(req.query.category) : null;
  const [rows] = await mysqlPool.query<FaqRow[]>(
    `${faqSelect} WHERE f.status = 'PUBLISHED' AND (? IS NULL OR d.department_name = ?) AND (? IS NULL OR c.category_name = ?)
     ORDER BY f.view_count DESC LIMIT 50`,
    [department, department, category, category],
  );
  res.json(rows.map(mapFaq));
});

router.get("/faqs/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await mysqlPool.query<FaqRow[]>(`${faqSelect} WHERE f.faq_id = ?`, [id]);
  if (!rows.length) return res.status(404).json({ error: "FAQ not found." });
  // Keep updated_at stable: a page view must not look like a content edit.
  await mysqlPool.query("UPDATE FAQ SET view_count = view_count + 1, updated_at = updated_at WHERE faq_id = ?", [id]);
  const [related] = await mysqlPool.query<FaqRow[]>(
    `${faqSelect} WHERE f.status = 'PUBLISHED' AND f.faq_id <> ?
     ORDER BY (f.category_id = ?) DESC, f.view_count DESC LIMIT 3`,
    [id, rows[0].category_id],
  );
  const knowledgeDocuments = await safeMongo("FAQ documents", () => getFaqDocuments(id), [] as KnowledgeDocument[]);
  const primary = knowledgeDocuments[0];
  const faq = mapFaq({ ...rows[0], source: primary ? `${primary.title} (${primary.source})` : null } as FaqRow);
  return res.json({ ...faq, related: related.map(mapFaq), knowledgeDocuments });
});

router.get("/bookmarks", async (req, res) => {
  const [rows] = await mysqlPool.query<FaqRow[]>(`${faqSelect} JOIN BOOKMARK b ON b.faq_id = f.faq_id WHERE b.user_id = ? ORDER BY b.created_at DESC, b.bookmark_id DESC`, [demoUser(req).id]);
  res.json(rows.map(mapFaq));
});

router.post("/bookmarks", async (req, res) => {
  const faqId = Number(req.body?.faqId);
  if (!Number.isInteger(faqId)) return res.status(400).json({ error: "faqId is required." });
  try {
    await mysqlPool.query("INSERT INTO BOOKMARK (user_id, faq_id) VALUES (?, ?)", [demoUser(req).id, faqId]);
    return res.status(201).json({ success: true, message: "FAQ saved to bookmarks." });
  } catch (error) {
    if (sqlErrno(error) === ER_DUP_ENTRY) return res.status(409).json({ error: "This FAQ is already bookmarked." });
    if (sqlErrno(error) === ER_SIGNAL_EXCEPTION) return res.status(400).json({ error: "Only published FAQs can be bookmarked." });
    throw error;
  }
});

router.delete("/bookmarks/:faqId", async (req, res) => {
  await mysqlPool.query("DELETE FROM BOOKMARK WHERE user_id = ? AND faq_id = ?", [demoUser(req).id, Number(req.params.faqId)]);
  res.json({ success: true, message: "Bookmark removed." });
});

router.post("/feedback", async (req, res) => {
  const faqId = Number(req.body?.faqId);
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(faqId) || !Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be an integer from 1 to 5." });
  try {
    await mysqlPool.query(
      `INSERT INTO FAQ_FEEDBACK (faq_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)`,
      [faqId, demoUser(req).id, rating, req.body?.comment ?? null],
    );
  } catch (error) {
    if (sqlErrno(error) === 1452) return res.status(404).json({ error: "FAQ not found." }); // foreign key violation
    throw error;
  }
  return res.status(201).json({ success: true, message: "Thanks for helping improve CampusQuery." });
});

router.get("/search/history", async (req, res) => {
  const [rows] = await mysqlPool.query<RowDataPacket[]>("SELECT search_id, query_text, result_count, created_at FROM SEARCH_HISTORY WHERE user_id = ? ORDER BY created_at DESC, search_id DESC LIMIT 20", [demoUser(req).id]);
  res.json(rows.map((r) => ({ id: r.search_id, query: r.query_text, resultCount: r.result_count, createdAt: new Date(r.created_at).toISOString() })));
});

router.get("/admin/summary", async (_req, res) => {
  const [[metrics], [categories], [departments], [recent], [low]] = await Promise.all([
    mysqlPool.query<RowDataPacket[]>(`SELECT (SELECT COUNT(*) FROM FAQ WHERE status = 'PUBLISHED') AS total_faqs,
      (SELECT COUNT(*) FROM DOCUMENT) AS total_documents, (SELECT COUNT(*) FROM USER WHERE role = 'STUDENT') AS total_students,
      (SELECT COUNT(*) FROM SEARCH_HISTORY WHERE DATE(created_at) = UTC_DATE()) AS searches_today,
      (SELECT question FROM popular_faqs_view ORDER BY view_count DESC LIMIT 1) AS most_viewed,
      (SELECT COALESCE(AVG(rating), 0) FROM FAQ_FEEDBACK) AS average_rating`),
    mysqlPool.query<RowDataPacket[]>("SELECT c.category_name AS label, COUNT(f.faq_id) AS value FROM CATEGORY c LEFT JOIN FAQ f ON f.category_id = c.category_id GROUP BY c.category_name ORDER BY value DESC"),
    mysqlPool.query<RowDataPacket[]>("SELECT d.department_name AS label, COUNT(f.faq_id) AS value FROM DEPARTMENT d LEFT JOIN FAQ f ON f.department_id = d.department_id GROUP BY d.department_name ORDER BY value DESC"),
    mysqlPool.query<FaqRow[]>(`${faqSelect} ORDER BY f.updated_at DESC LIMIT 5`),
    mysqlPool.query<FaqRow[]>(`${faqSelect} JOIN low_feedback_faqs_view low ON low.faq_id = f.faq_id ORDER BY low.average_rating ASC LIMIT 5`),
  ]);
  const m = metrics[0];
  res.json({
    metrics: { totalFaqs: Number(m.total_faqs), totalDocuments: Number(m.total_documents), totalStudents: Number(m.total_students), searchesToday: Number(m.searches_today), mostViewed: m.most_viewed ?? "No searches yet", averageRating: Number(m.average_rating) },
    searchesOverTime: [],
    categoryCounts: categories.map((r) => ({ label: r.label, value: Number(r.value) })),
    departmentCounts: departments.map((r) => ({ label: r.label, value: Number(r.value) })),
    recentFaqs: recent.map(mapFaq),
    lowRated: low.map(mapFaq),
  });
});

router.get("/admin/database-demo", async (_req, res) => {
  const [tables] = await mysqlPool.query<RowDataPacket[]>("SELECT COUNT(*) AS value FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'");
  const mongo = await safeMongo("database demo stats", knowledgeStats, null);
  res.json({
    schemaStats: [
      { label: "MySQL tables", value: String(tables[0].value) },
      { label: "MongoDB collections", value: mongo ? "3" : "Unavailable" },
      { label: "Knowledge documents", value: mongo ? String(mongo.documents) : "n/a" },
    ],
    concepts: [
      { name: "Views", description: "Reusable analytical queries power the popular and low-feedback FAQ panels (MySQL).", sql: "SELECT * FROM popular_faqs_view ORDER BY view_count DESC;" },
      { name: "Stored procedure + transaction", description: "Publishing a FAQ resolves names to ids and inserts atomically, rolling back on error (MySQL).", sql: "CALL sp_publish_faq(question, answer, category, department, admin_id, 'MEDIUM', @faq_id);" },
      { name: "Trigger", description: "Blocks bookmarks on FAQs that are not published (MySQL).", sql: "CREATE TRIGGER trg_bookmark_only_published BEFORE INSERT ON BOOKMARK ..." },
      { name: "Full-text index", description: "InnoDB FULLTEXT ranks FAQ questions and answers by keyword relevance (MySQL).", sql: "MATCH(question, answer) AGAINST ('attendance' IN NATURAL LANGUAGE MODE)" },
      { name: "Document model", description: "Knowledge documents keep their natural shape, with tags, rules, requirements or steps varying per document (MongoDB).", sql: "db.knowledge_documents.find({ tags: 'hostel' })" },
      { name: "Text index search", description: "Weighted text indexes search document titles, content and tags, and passage chunks for snippets (MongoDB).", sql: "db.knowledge_documents.find({ $text: { $search: 'attendance' } })" },
      { name: "Hybrid retrieval", description: "MySQL keyword ranking is blended with MongoDB tag boosts, then structured filters apply. Matching knowledge documents are returned alongside.", sql: "relevance = 0.7 * fulltext_score + 0.3 * mongo_tag_boost" },
      { name: "Cross-database integrity", description: "DOCUMENT.file_reference points at a Mongo document_id, and faq_enrichment.faq_id points at FAQ.faq_id; MySQL is the source of truth.", sql: "DOCUMENT.file_reference = 'knowledge_documents/DOC001'" },
    ],
  });
});

router.post("/admin/faqs", async (req, res) => {
  const { question, answer, category, department, priority = 3 } = req.body ?? {};
  if (typeof question !== "string" || question.length < 5 || typeof answer !== "string" || answer.length < 10) return res.status(400).json({ error: "Question and answer are required." });
  if (typeof category !== "string" || typeof department !== "string") return res.status(400).json({ error: "Category and department are required." });
  const priorityValue = Number(priority);
  if (!Number.isInteger(priorityValue) || priorityValue < 1 || priorityValue > 5) return res.status(400).json({ error: "Priority must be an integer from 1 to 5." });

  const connection = await mysqlPool.getConnection();
  let faqId: number;
  try {
    await connection.query("CALL sp_publish_faq(?, ?, ?, ?, ?, ?, @faq_id)", [question, answer, category, department, demoUser(req).id, priorityLabel(priorityValue)]);
    const [out] = await connection.query<RowDataPacket[]>("SELECT @faq_id AS id");
    faqId = Number(out[0].id);
  } catch (error) {
    if (sqlErrno(error) === ER_SIGNAL_EXCEPTION) return res.status(400).json({ error: "Unknown category or department." });
    throw error;
  } finally {
    connection.release();
  }

  // MySQL is the source of truth. Enrichment is rebuildable, so a MongoDB failure must not undo the FAQ.
  await safeMongo("FAQ enrichment write", () => createFaqEnrichment(faqId, question, category, department), undefined);
  const [rows] = await mysqlPool.query<FaqRow[]>(`${faqSelect} WHERE f.faq_id = ?`, [faqId]);
  return res.status(201).json({ ...mapFaq({ ...rows[0], relevance: 1 } as FaqRow), views: 0 });
});

export default router;
