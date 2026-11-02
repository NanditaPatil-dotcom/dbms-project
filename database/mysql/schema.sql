-- ============================================================================
-- CampusQuery  |  MySQL schema (structured / transactional data)
-- MongoDB holds the flexible knowledge content: see database/mongodb/init.js
-- Run with:  mysql -u root -p < database/mysql/schema.sql
-- ============================================================================
DROP DATABASE IF EXISTS CampusQuery;
CREATE DATABASE CampusQuery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE CampusQuery;

CREATE TABLE DEPARTMENT (
  department_id   INT AUTO_INCREMENT,
  department_name VARCHAR(100) NOT NULL,
  department_code VARCHAR(20)  NOT NULL,
  PRIMARY KEY (department_id),
  UNIQUE (department_name),
  UNIQUE (department_code)
);

CREATE TABLE USER (
  user_id       INT AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL,
  department_id INT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE (email),
  CONSTRAINT chk_user_role CHECK (role IN ('STUDENT', 'ADMIN')),
  CONSTRAINT fk_user_department FOREIGN KEY (department_id)
    REFERENCES DEPARTMENT(department_id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE CATEGORY (
  category_id   INT AUTO_INCREMENT,
  category_name VARCHAR(100) NOT NULL,
  description   VARCHAR(500),
  PRIMARY KEY (category_id),
  UNIQUE (category_name)
);

CREATE TABLE FAQ (
  faq_id        INT AUTO_INCREMENT,
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  category_id   INT NOT NULL,
  department_id INT NOT NULL,
  created_by    INT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  priority      VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  view_count    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (faq_id),
  CONSTRAINT fk_faq_category   FOREIGN KEY (category_id)   REFERENCES CATEGORY(category_id)     ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_faq_department FOREIGN KEY (department_id) REFERENCES DEPARTMENT(department_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_faq_creator    FOREIGN KEY (created_by)    REFERENCES USER(user_id)             ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_faq_status    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT chk_faq_priority  CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  CONSTRAINT chk_view_count    CHECK (view_count >= 0)
);

-- DOCUMENT keeps only the relational metadata. The document body, tags, rules
-- and chunks live in MongoDB; file_reference points at the Mongo document_id.
CREATE TABLE DOCUMENT (
  document_id    INT AUTO_INCREMENT,
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  document_type  VARCHAR(50)  NOT NULL,
  department_id  INT NOT NULL,
  uploaded_by    INT NOT NULL,
  file_reference VARCHAR(500),
  status         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id),
  CONSTRAINT fk_document_department FOREIGN KEY (department_id) REFERENCES DEPARTMENT(department_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_document_uploader   FOREIGN KEY (uploaded_by)   REFERENCES USER(user_id)             ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_document_status    CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

CREATE TABLE FAQ_FEEDBACK (
  feedback_id INT AUTO_INCREMENT,
  faq_id      INT NOT NULL,
  user_id     INT NOT NULL,
  rating      INT NOT NULL,
  comment     TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (feedback_id),
  CONSTRAINT uq_feedback_user_faq UNIQUE (faq_id, user_id),
  CONSTRAINT fk_feedback_faq  FOREIGN KEY (faq_id)  REFERENCES FAQ(faq_id)   ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5)
);

CREATE TABLE BOOKMARK (
  bookmark_id INT AUTO_INCREMENT,
  user_id     INT NOT NULL,
  faq_id      INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (bookmark_id),
  CONSTRAINT fk_bookmark_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_bookmark_faq  FOREIGN KEY (faq_id)  REFERENCES FAQ(faq_id)   ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT uq_user_faq_bookmark UNIQUE (user_id, faq_id)
);

CREATE TABLE SEARCH_HISTORY (
  search_id    INT AUTO_INCREMENT,
  user_id      INT NOT NULL,
  query_text   TEXT NOT NULL,
  result_count INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (search_id),
  CONSTRAINT fk_search_user FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_result_count CHECK (result_count >= 0)
);

ALTER TABLE DEPARTMENT ADD COLUMN contact_email VARCHAR(150);
ALTER TABLE DEPARTMENT MODIFY COLUMN contact_email VARCHAR(200);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_faq_department  ON FAQ(department_id);
CREATE INDEX idx_faq_category    ON FAQ(category_id);
CREATE INDEX idx_faq_status      ON FAQ(status);
CREATE INDEX idx_faq_priority    ON FAQ(priority);
CREATE INDEX idx_faq_created_by  ON FAQ(created_by);
CREATE INDEX idx_document_department ON DOCUMENT(department_id);
CREATE INDEX idx_feedback_faq    ON FAQ_FEEDBACK(faq_id);
CREATE INDEX idx_feedback_user   ON FAQ_FEEDBACK(user_id);
CREATE INDEX idx_search_user     ON SEARCH_HISTORY(user_id);
CREATE INDEX idx_search_date     ON SEARCH_HISTORY(created_at);
-- Keyword half of hybrid retrieval (the MongoDB text indexes are the other half)
CREATE FULLTEXT INDEX ft_faq_question_answer ON FAQ(question, answer);

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
CREATE VIEW popular_faqs_view AS
SELECT f.faq_id, f.question, f.view_count, c.category_name, d.department_name
FROM FAQ f
JOIN CATEGORY c   ON f.category_id   = c.category_id
JOIN DEPARTMENT d ON f.department_id = d.department_id
WHERE f.status = 'PUBLISHED';

CREATE VIEW department_faq_statistics AS
SELECT d.department_id, d.department_name,
       COUNT(f.faq_id) AS total_faqs,
       AVG(f.view_count) AS average_views
FROM DEPARTMENT d
LEFT JOIN FAQ f ON d.department_id = f.department_id
GROUP BY d.department_id, d.department_name;

CREATE VIEW low_feedback_faqs_view AS
SELECT f.faq_id, f.question, COALESCE(AVG(ff.rating), 0) AS average_rating
FROM FAQ f
LEFT JOIN FAQ_FEEDBACK ff ON ff.faq_id = f.faq_id
WHERE f.status = 'PUBLISHED'
GROUP BY f.faq_id, f.question
HAVING COUNT(ff.feedback_id) = 0 OR AVG(ff.rating) < 3;

-- ---------------------------------------------------------------------------
-- Stored function, procedure and trigger
-- ---------------------------------------------------------------------------
DELIMITER $$

CREATE FUNCTION fn_faq_average_rating(p_faq_id INT)
RETURNS DECIMAL(3,2)
READS SQL DATA
BEGIN
  DECLARE v_avg DECIMAL(3,2);
  SELECT COALESCE(AVG(rating), 0) INTO v_avg FROM FAQ_FEEDBACK WHERE faq_id = p_faq_id;
  RETURN v_avg;
END$$

-- Atomic FAQ publishing: resolves names to ids and inserts inside one transaction.
CREATE PROCEDURE sp_publish_faq(
  IN p_question TEXT, IN p_answer TEXT,
  IN p_category_name VARCHAR(100), IN p_department_name VARCHAR(100),
  IN p_created_by INT, IN p_priority VARCHAR(20),
  OUT p_faq_id INT)
BEGIN
  DECLARE v_category INT;
  DECLARE v_department INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
  SELECT category_id   INTO v_category   FROM CATEGORY   WHERE category_name   = p_category_name;
  SELECT department_id INTO v_department FROM DEPARTMENT WHERE department_name = p_department_name;
  IF v_category IS NULL OR v_department IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unknown category or department';
  END IF;
  INSERT INTO FAQ (question, answer, category_id, department_id, created_by, status, priority)
  VALUES (p_question, p_answer, v_category, v_department, p_created_by, 'PUBLISHED', p_priority);
  SET p_faq_id = LAST_INSERT_ID();
  COMMIT;
END$$

CREATE PROCEDURE sp_department_statistics(IN p_department_id INT)
BEGIN
  SELECT COUNT(DISTINCT f.faq_id)        AS faq_count,
         COALESCE(AVG(ff.rating), 0)     AS average_rating,
         COALESCE(SUM(f.view_count), 0)  AS total_views
  FROM FAQ f
  LEFT JOIN FAQ_FEEDBACK ff ON ff.faq_id = f.faq_id
  WHERE p_department_id IS NULL OR f.department_id = p_department_id;
END$$

-- Only published FAQs can be bookmarked.
CREATE TRIGGER trg_bookmark_only_published
BEFORE INSERT ON BOOKMARK
FOR EACH ROW
BEGIN
  DECLARE v_status VARCHAR(20);
  SELECT status INTO v_status FROM FAQ WHERE faq_id = NEW.faq_id;
  IF v_status IS NULL OR v_status <> 'PUBLISHED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only published FAQs can be bookmarked';
  END IF;
END$$

DELIMITER ;

SHOW TABLES;
