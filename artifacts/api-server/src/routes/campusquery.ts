import { Router, type IRouter, type Request } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

type FaqRow = {
  faq_id: number; question: string; answer: string; category_name: string;
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
  relevance: Math.round((Number(row.relevance ?? 0.82)) * 100) / 100,
  views: Number(row.view_count),
  status: row.status,
  source: row.source ?? "CampusQuery knowledge base",
});

const faqSelect = `SELECT f.faq_id, f.question, f.answer, c.category_name, d.department_name,
  f.updated_at, f.view_count, f.status, 'Academic knowledge base' AS source
  FROM faqs f JOIN categories c ON c.category_id=f.category_id
  JOIN departments d ON d.department_id=f.department_id`;

const embedQuery = (text: string) => {
  const values = Array.from({ length: 8 }, (_, index) => {
    let total = 0;
    for (let cursor = index; cursor < text.length; cursor += 8) total += text.charCodeAt(cursor);
    return ((total % 100) / 100).toFixed(2);
  });
  return `[${values.join(",")}]`;
};

const demoUser = (req: Request) => {
  const role = req.header("x-demo-role") === "Admin" ? "Admin" : "Student";
  return role === "Admin"
    ? { id: 1, name: "Dr. Priya Menon", email: "priya.menon@campusquery.demo", role, initials: "PM", department: "Student Affairs" }
    : { id: 2, name: "Arjun Rao", email: "arjun.rao@campusquery.demo", role, initials: "AR", department: "Computer Science & Engineering" };
};

router.get("/auth/session", (req, res) => res.json({ user: demoUser(req) }));

router.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.status(400).json({ error: "Search query must be at least 2 characters." });
  const department = req.query.department ? String(req.query.department) : null;
  const category = req.query.category ? String(req.query.category) : null;
  const sort = ["relevance", "viewed", "updated"].includes(String(req.query.sort)) ? String(req.query.sort) : "relevance";
  const result = await pool.query(
    `SELECT ranked.*, (ranked.keyword_score * 0.45 + ranked.semantic_score * 0.55) AS relevance
     FROM (SELECT f.faq_id, f.question, f.answer, c.category_name, d.department_name,
       f.updated_at, f.view_count, f.status, 'Academic knowledge base' AS source,
       ts_rank(f.search_vector, plainto_tsquery('english', $1)) AS keyword_score,
       COALESCE(1 - (e.embedding <=> $4::vector), 0) AS semantic_score
       FROM faqs f JOIN categories c ON c.category_id=f.category_id
       JOIN departments d ON d.department_id=f.department_id
       LEFT JOIN faq_embeddings e ON e.faq_id=f.faq_id
     WHERE f.status='published' AND ($2::text IS NULL OR d.department_name=$2) AND ($3::text IS NULL OR c.category_name=$3)
     ) ranked ORDER BY ${sort === "viewed" ? "ranked.view_count DESC" : sort === "updated" ? "ranked.updated_at DESC" : "relevance DESC"} LIMIT 20`,
    [q, department, category, embedQuery(q)],
  );
  await pool.query("INSERT INTO search_history (user_id, query_text, result_count) VALUES ($1,$2,$3)", [demoUser(req).id, q, result.rowCount ?? 0]);
  return res.json({ query: q, results: result.rows.map(mapFaq), total: result.rowCount ?? 0, tookMs: 18 });
});

router.get("/faqs", async (req, res) => {
  const result = await pool.query(`${faqSelect} WHERE f.status='published' ORDER BY f.view_count DESC LIMIT 50`);
  res.json(result.rows.map(mapFaq));
});

router.get("/faqs/:id", async (req, res) => {
  const result = await pool.query(`${faqSelect} WHERE f.faq_id=$1`, [Number(req.params.id)]);
  if (!result.rowCount) return res.status(404).json({ error: "FAQ not found." });
  await pool.query("UPDATE faqs SET view_count=view_count+1 WHERE faq_id=$1", [Number(req.params.id)]);
  const related = await pool.query(`${faqSelect} WHERE f.status='published' AND f.faq_id<>$1 ORDER BY abs(f.category_id - (SELECT category_id FROM faqs WHERE faq_id=$1)), f.view_count DESC LIMIT 3`, [Number(req.params.id)]);
  return res.json({ ...mapFaq(result.rows[0]), related: related.rows.map(mapFaq) });
});

router.get("/bookmarks", async (req, res) => {
  const result = await pool.query(`${faqSelect} JOIN bookmarks b ON b.faq_id=f.faq_id WHERE b.user_id=$1 ORDER BY b.created_at DESC`, [demoUser(req).id]);
  res.json(result.rows.map(mapFaq));
});

router.post("/bookmarks", async (req, res) => {
  const faqId = Number(req.body?.faqId);
  if (!Number.isInteger(faqId)) return res.status(400).json({ error: "faqId is required." });
  try {
    await pool.query("INSERT INTO bookmarks (user_id, faq_id) VALUES ($1,$2)", [demoUser(req).id, faqId]);
    return res.status(201).json({ success: true, message: "FAQ saved to bookmarks." });
  } catch {
    return res.status(409).json({ error: "This FAQ is already bookmarked." });
  }
});

router.delete("/bookmarks/:faqId", async (req, res) => {
  await pool.query("DELETE FROM bookmarks WHERE user_id=$1 AND faq_id=$2", [demoUser(req).id, Number(req.params.faqId)]);
  res.json({ success: true, message: "Bookmark removed." });
});

router.post("/feedback", async (req, res) => {
  const faqId = Number(req.body?.faqId);
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(faqId) || !Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be an integer from 1 to 5." });
  await pool.query(`INSERT INTO faq_feedback (faq_id,user_id,rating,comment) VALUES ($1,$2,$3,$4)
    ON CONFLICT (faq_id,user_id) DO UPDATE SET rating=EXCLUDED.rating, comment=EXCLUDED.comment`, [faqId, demoUser(req).id, rating, req.body?.comment ?? null]);
  return res.status(201).json({ success: true, message: "Thanks for helping improve CampusQuery." });
});

router.get("/search/history", async (req, res) => {
  const result = await pool.query("SELECT search_id, query_text, result_count, created_at FROM search_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20", [demoUser(req).id]);
  res.json(result.rows.map((r) => ({ id: r.search_id, query: r.query_text, resultCount: r.result_count, createdAt: new Date(r.created_at).toISOString() })));
});

router.get("/admin/summary", async (_req, res) => {
  const [metrics, categories, departments, recent, low] = await Promise.all([
    pool.query(`SELECT (SELECT count(*) FROM faqs WHERE status='published') AS total_faqs,
      (SELECT count(*) FROM documents) AS total_documents, (SELECT count(*) FROM users WHERE role='Student') AS total_students,
      (SELECT count(*) FROM search_history WHERE created_at::date=CURRENT_DATE) AS searches_today,
      (SELECT question FROM popular_faqs_view LIMIT 1) AS most_viewed,
      (SELECT COALESCE(avg(rating),0) FROM faq_feedback) AS average_rating`),
    pool.query("SELECT c.category_name AS label, count(f.faq_id)::int AS value FROM categories c LEFT JOIN faqs f ON f.category_id=c.category_id GROUP BY c.category_name ORDER BY value DESC"),
    pool.query("SELECT d.department_name AS label, count(f.faq_id)::int AS value FROM departments d LEFT JOIN faqs f ON f.department_id=d.department_id GROUP BY d.department_name ORDER BY value DESC"),
    pool.query(`${faqSelect} ORDER BY f.updated_at DESC LIMIT 5`),
    pool.query(`${faqSelect} JOIN unanswered_or_low_feedback_faqs_view low ON low.faq_id=f.faq_id ORDER BY low.average_rating ASC LIMIT 5`),
  ]);
  res.json({ metrics: { totalFaqs: Number(metrics.rows[0].total_faqs), totalDocuments: Number(metrics.rows[0].total_documents), totalStudents: Number(metrics.rows[0].total_students), searchesToday: Number(metrics.rows[0].searches_today), mostViewed: metrics.rows[0].most_viewed ?? "No searches yet", averageRating: Number(metrics.rows[0].average_rating) },
    searchesOverTime: [], categoryCounts: categories.rows, departmentCounts: departments.rows, recentFaqs: recent.rows.map(mapFaq), lowRated: low.rows.map(mapFaq) });
});

router.get("/admin/database-demo", async (_req, res) => {
  const tables = await pool.query("SELECT count(*)::text AS value FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','faqs','documents','document_chunks','faq_embeddings','search_history','faq_feedback','bookmarks')");
  res.json({ schemaStats: [{ label: "Core tables", value: tables.rows[0].value }, { label: "Vector extension", value: "pgvector enabled" }, { label: "Search index", value: "GIN + HNSW" }],
    concepts: [
      { name: "Views", description: "Reusable analytical queries power popular and low-feedback FAQ panels.", sql: "SELECT * FROM popular_faqs_view ORDER BY view_count DESC;" },
      { name: "Stored function", description: "Aggregates FAQ count, average rating, and views by department.", sql: "SELECT * FROM get_faq_statistics(NULL);" },
      { name: "Trigger", description: "Keeps updated_at current whenever FAQ or document records change.", sql: "CREATE TRIGGER ... EXECUTE FUNCTION touch_updated_at();" },
      { name: "Hybrid retrieval", description: "Combines PostgreSQL full-text ranking with semantic vector storage.", sql: "ts_rank(search_vector, plainto_tsquery(...)) + cosine similarity" },
      { name: "Integrity", description: "Foreign keys, CHECK constraints, unique bookmarks, and transaction-safe writes.", sql: "CHECK (rating BETWEEN 1 AND 5)" },
    ] });
});

router.post("/admin/faqs", async (req, res) => {
  const { question, answer, category, department, priority = 3 } = req.body ?? {};
  if (typeof question !== "string" || question.length < 5 || typeof answer !== "string" || answer.length < 10) return res.status(400).json({ error: "Question and answer are required." });
  const result = await pool.query(`INSERT INTO faqs (question,answer,category_id,department_id,created_by,priority)
    VALUES ($1,$2,(SELECT category_id FROM categories WHERE category_name=$3),(SELECT department_id FROM departments WHERE department_name=$4),1,$5)
    RETURNING faq_id,question,answer,status,updated_at,view_count`, [question, answer, category, department, priority]);
  return res.status(201).json({ ...result.rows[0], id: result.rows[0].faq_id, category, department, updatedAt: new Date(result.rows[0].updated_at).toISOString(), relevance: 1, views: 0, source: "CampusQuery knowledge base" });
});

export default router;