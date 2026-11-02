-- CampusQuery demo data (MySQL). Run after schema.sql:
--   mysql -u root -p CampusQuery < database/mysql/seed.sql
-- All content is sample data and is not any institution's real policy.
USE CampusQuery;

INSERT INTO DEPARTMENT (department_name, department_code, contact_email) VALUES
('Computer Science & Engineering', 'CSE', 'cse@campusquery.demo'),
('Business Administration',       'BBA', 'bba@campusquery.demo'),
('Student Affairs',               'SA',  'studentaffairs@campusquery.demo');

INSERT INTO CATEGORY (category_name, description) VALUES
('Academics',      'Attendance, registration, examinations and academic policies'),
('Certificates',   'Official student letters and document requests'),
('Internships',    'Approval, forms and placement-related guidance'),
('Campus Life',    'Hostel, clubs, facilities and student services'),
('Fees & Finance', 'Payments, scholarships and refund guidance');

-- password_hash values are placeholders: the demo session does not use passwords.
INSERT INTO USER (name, email, password_hash, role, department_id)
SELECT 'Dr. Priya Menon', 'priya.menon@campusquery.demo', '$2b$10$demo.placeholder.hash.not.a.real.password', 'ADMIN', department_id
FROM DEPARTMENT WHERE department_code = 'SA';
INSERT INTO USER (name, email, password_hash, role, department_id)
SELECT 'Arjun Rao', 'arjun.rao@campusquery.demo', '$2b$10$demo.placeholder.hash.not.a.real.password', 'STUDENT', department_id
FROM DEPARTMENT WHERE department_code = 'CSE';
INSERT INTO USER (name, email, password_hash, role, department_id)
SELECT 'Meera Shah', 'meera.shah@campusquery.demo', '$2b$10$demo.placeholder.hash.not.a.real.password', 'STUDENT', department_id
FROM DEPARTMENT WHERE department_code = 'BBA';

INSERT INTO FAQ (question, answer, category_id, department_id, created_by, status, priority, view_count)
SELECT x.question, x.answer, c.category_id, d.department_id, u.user_id, 'PUBLISHED', x.priority, x.views
FROM (
  SELECT 'What is the minimum attendance requirement to write the semester exam?' AS question,
         'Students must maintain at least 75% attendance in each registered course to be eligible for the semester examination. Requests for condonation, when applicable, should be submitted to the department office before the published deadline.' AS answer,
         'Academics' AS category_name, 'SA' AS department_code, 'MEDIUM' AS priority, 248 AS views
  UNION ALL SELECT 'How do I apply for a bonafide certificate?',
         'Submit the bonafide certificate request from the student services desk with your university ID. Standard requests are processed within three working days; download the signed certificate from the student portal when notified.',
         'Certificates', 'SA', 'LOW', 186
  UNION ALL SELECT 'When can I register for electives?',
         'Elective registration opens during the course registration window announced by the academic office. Check the current semester calendar and complete your selection before the add/drop deadline.',
         'Academics', 'CSE', 'MEDIUM', 172
  UNION ALL SELECT 'What documents are needed for internship approval?',
         'Upload the offer letter, company profile, internship period, faculty mentor confirmation and the signed internship undertaking. The department office reviews the request before approval is recorded.',
         'Internships', 'CSE', 'LOW', 154
  UNION ALL SELECT 'What is the procedure for applying for a re-exam?',
         'Complete the re-examination form in the examinations section of the portal, select the eligible course and pay the displayed fee before the deadline listed in the exam circular.',
         'Academics', 'SA', 'HIGH', 139
  UNION ALL SELECT 'Where can I find information about hostel rules?',
         'The latest hostel handbook is available from Student Affairs under Campus Life resources. It covers quiet hours, visitors, leave requests, safety, maintenance and grievance reporting.',
         'Campus Life', 'SA', 'MEDIUM', 121
  UNION ALL SELECT 'How can attendance shortage be condoned?',
         'Students below the attendance threshold may submit a condonation request with supporting documents to the department office. Approval is discretionary and must be received before hall-ticket processing.',
         'Academics', 'CSE', 'HIGH', 96
  UNION ALL SELECT 'How do I request a fee refund?',
         'Raise a fee refund request with the finance office using the portal form and attach the transaction receipt. Refund eligibility and processing time depend on the applicable academic calendar policy.',
         'Fees & Finance', 'BBA', 'MEDIUM', 88
) AS x
JOIN CATEGORY c   ON c.category_name   = x.category_name
JOIN DEPARTMENT d ON d.department_code = x.department_code
JOIN USER u       ON u.role = 'ADMIN';

-- Relational metadata for the knowledge documents whose content lives in MongoDB.
-- file_reference = "<mongo collection>/<document_id>"  (see database/mongodb/init.js)
INSERT INTO DOCUMENT (title, description, document_type, department_id, uploaded_by, file_reference, status)
SELECT x.title, x.description, x.document_type, d.department_id, u.user_id, x.file_reference, 'ACTIVE'
FROM (
  SELECT 'Academic Regulations 2026' AS title, 'Attendance, exams and registration rules.' AS description, 'Regulation' AS document_type, 'SA' AS department_code, 'knowledge_documents/DOC001' AS file_reference
  UNION ALL SELECT 'Hostel Guidelines', 'Entry timings and visitor policy for hostel residents.', 'Guidelines', 'SA', 'knowledge_documents/DOC002'
  UNION ALL SELECT 'Internship Guidelines', 'Documents required for internship approval.', 'Guidelines', 'CSE', 'knowledge_documents/DOC003'
  UNION ALL SELECT 'Student Services Handbook', 'Certificates and student support workflows.', 'Handbook', 'SA', 'knowledge_documents/DOC004'
  UNION ALL SELECT 'Fee Refund Policy', 'Eligibility and process for fee refunds.', 'Policy', 'BBA', 'knowledge_documents/DOC005'
) AS x
JOIN DEPARTMENT d ON d.department_code = x.department_code
JOIN USER u ON u.role = 'ADMIN';

INSERT INTO SEARCH_HISTORY (user_id, query_text, result_count, created_at)
SELECT u.user_id, x.query_text, x.result_count, NOW() - INTERVAL x.offset_days DAY
FROM (
  SELECT 'attendance requirements' AS query_text, 3 AS result_count, 0 AS offset_days
  UNION ALL SELECT 'internship approval documents', 2, 1
  UNION ALL SELECT 'bonafide certificate', 1, 2
  UNION ALL SELECT 'elective registration', 2, 3
  UNION ALL SELECT 'hostel rules', 1, 4
) AS x
JOIN USER u ON u.email = 'arjun.rao@campusquery.demo';

INSERT INTO FAQ_FEEDBACK (faq_id, user_id, rating, comment)
SELECT f.faq_id, u.user_id, 5, 'Clear and useful.'
FROM FAQ f JOIN USER u ON u.email = 'arjun.rao@campusquery.demo'
WHERE f.question LIKE 'What is the minimum attendance%';

INSERT INTO BOOKMARK (user_id, faq_id)
SELECT u.user_id, f.faq_id
FROM USER u JOIN FAQ f ON f.question LIKE 'What is the minimum attendance%'
WHERE u.email = 'arjun.rao@campusquery.demo';

-- Multi-row INSERT ... SELECT can leave gaps in AUTO_INCREMENT; start the next ids cleanly.
ALTER TABLE FAQ AUTO_INCREMENT = 9;
ALTER TABLE DOCUMENT AUTO_INCREMENT = 6;
