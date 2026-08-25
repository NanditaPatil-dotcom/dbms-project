CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS departments (
  department_id SERIAL PRIMARY KEY,
  department_name TEXT NOT NULL UNIQUE,
  department_code TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS categories (
  category_id SERIAL PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL CHECK (role IN ('Student','Admin')),
  department_id INTEGER REFERENCES departments(department_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS faqs (
  faq_id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(category_id),
  department_id INTEGER NOT NULL REFERENCES departments(department_id),
  created_by INTEGER REFERENCES users(user_id),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft','archived')),
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', question || ' ' || answer)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS faq_embeddings (
  embedding_id SERIAL PRIMARY KEY,
  faq_id INTEGER NOT NULL UNIQUE REFERENCES faqs(faq_id) ON DELETE CASCADE,
  embedding vector(8) NOT NULL,
  embedding_model TEXT NOT NULL DEFAULT 'campusquery-demo-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documents (
  document_id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  document_type TEXT NOT NULL DEFAULT 'Policy',
  department_id INTEGER REFERENCES departments(department_id),
  uploaded_by INTEGER REFERENCES users(user_id),
  file_reference TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS document_chunks (
  chunk_id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  embedding vector(8),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, chunk_index)
);
CREATE TABLE IF NOT EXISTS search_history (
  search_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  query_text TEXT NOT NULL CHECK (length(trim(query_text)) > 1),
  result_count INTEGER NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS faq_feedback (
  feedback_id SERIAL PRIMARY KEY,
  faq_id INTEGER NOT NULL REFERENCES faqs(faq_id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(faq_id, user_id)
);
CREATE TABLE IF NOT EXISTS bookmarks (
  bookmark_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  faq_id INTEGER NOT NULL REFERENCES faqs(faq_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, faq_id)
);

CREATE INDEX IF NOT EXISTS faqs_category_idx ON faqs(category_id);
CREATE INDEX IF NOT EXISTS faqs_department_idx ON faqs(department_id);
CREATE INDEX IF NOT EXISTS faqs_status_idx ON faqs(status);
CREATE INDEX IF NOT EXISTS faqs_updated_idx ON faqs(updated_at DESC);
CREATE INDEX IF NOT EXISTS faqs_search_idx ON faqs USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS history_user_idx ON search_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_faq_idx ON faq_feedback(faq_id);
CREATE INDEX IF NOT EXISTS faq_embedding_vector_idx ON faq_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS faqs_touch_updated_at ON faqs;
CREATE TRIGGER faqs_touch_updated_at BEFORE UPDATE ON faqs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS documents_touch_updated_at ON documents;
CREATE TRIGGER documents_touch_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE OR REPLACE FUNCTION get_faq_statistics(target_department_id INTEGER)
RETURNS TABLE(faq_count BIGINT, average_rating NUMERIC, total_views BIGINT)
LANGUAGE SQL AS $$
  SELECT count(DISTINCT f.faq_id), COALESCE(avg(ff.rating), 0), COALESCE(sum(f.view_count), 0)
  FROM faqs f LEFT JOIN faq_feedback ff ON ff.faq_id = f.faq_id
  WHERE target_department_id IS NULL OR f.department_id = target_department_id;
$$;

CREATE OR REPLACE VIEW popular_faqs_view AS
SELECT f.faq_id, f.question, f.view_count, d.department_name, c.category_name
FROM faqs f JOIN departments d ON d.department_id=f.department_id
JOIN categories c ON c.category_id=f.category_id
WHERE f.status='published' ORDER BY f.view_count DESC;
CREATE OR REPLACE VIEW unanswered_or_low_feedback_faqs_view AS
SELECT f.faq_id, f.question, COALESCE(avg(ff.rating), 0) AS average_rating
FROM faqs f LEFT JOIN faq_feedback ff ON ff.faq_id=f.faq_id
GROUP BY f.faq_id HAVING count(ff.feedback_id)=0 OR avg(ff.rating) < 3;
CREATE OR REPLACE VIEW department_faq_statistics_view AS
SELECT d.department_id, d.department_name, count(f.faq_id) AS faq_count,
       COALESCE(sum(f.view_count),0) AS total_views
FROM departments d LEFT JOIN faqs f ON f.department_id=d.department_id
GROUP BY d.department_id, d.department_name;