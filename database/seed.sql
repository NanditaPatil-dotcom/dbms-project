INSERT INTO departments (department_name, department_code) VALUES
('Computer Science & Engineering','CSE'), ('Business Administration','BBA'), ('Student Affairs','SA')
ON CONFLICT (department_code) DO NOTHING;
INSERT INTO categories (category_name, description) VALUES
('Academics','Attendance, registration, examinations and academic policies'),
('Certificates','Official student letters and document requests'),
('Internships','Approval, forms and placement-related guidance'),
('Campus Life','Hostel, clubs, facilities and student services'),
('Fees & Finance','Payments, scholarships and refund guidance')
ON CONFLICT (category_name) DO NOTHING;
INSERT INTO users (name,email,role,department_id)
SELECT 'Dr. Priya Menon','priya.menon@campusquery.demo','Admin',department_id FROM departments WHERE department_code='SA'
ON CONFLICT (email) DO NOTHING;
INSERT INTO users (name,email,role,department_id)
SELECT 'Arjun Rao','arjun.rao@campusquery.demo','Student',department_id FROM departments WHERE department_code='CSE'
ON CONFLICT (email) DO NOTHING;
INSERT INTO users (name,email,role,department_id)
SELECT 'Meera Shah','meera.shah@campusquery.demo','Student',department_id FROM departments WHERE department_code='BBA'
ON CONFLICT (email) DO NOTHING;

INSERT INTO faqs (question,answer,category_id,department_id,created_by,priority,view_count)
SELECT x.question,x.answer,c.category_id,d.department_id,u.user_id,x.priority,x.views
FROM (VALUES
('What is the minimum attendance requirement to write the semester exam?','Students must maintain at least 75% attendance in each registered course to be eligible for the semester examination. Requests for condonation, when applicable, should be submitted to the department office before the published deadline.', 'Academics','SA',3,248),
('How do I apply for a bonafide certificate?','Submit the bonafide certificate request from the student services desk with your university ID. Standard requests are processed within three working days; download the signed certificate from the student portal when notified.', 'Certificates','SA',2,186),
('When can I register for electives?','Elective registration opens during the course registration window announced by the academic office. Check the current semester calendar and complete your selection before the add/drop deadline.', 'Academics','CSE',3,172),
('What documents are needed for internship approval?','Upload the offer letter, company profile, internship period, faculty mentor confirmation and the signed internship undertaking. The department office reviews the request before approval is recorded.', 'Internships','CSE',2,154),
('What is the procedure for applying for a re-exam?','Complete the re-examination form in the examinations section of the portal, select the eligible course and pay the displayed fee before the deadline listed in the exam circular.', 'Academics','SA',4,139),
('Where can I find information about hostel rules?','The latest hostel handbook is available from Student Affairs under Campus Life resources. It covers quiet hours, visitors, leave requests, safety, maintenance and grievance reporting.', 'Campus Life','SA',3,121),
('How can attendance shortage be condoned?','Students below the attendance threshold may submit a condonation request with supporting documents to the department office. Approval is discretionary and must be received before hall-ticket processing.', 'Academics','CSE',4,96),
('How do I request a fee refund?','Raise a fee refund request with the finance office using the portal form and attach the transaction receipt. Refund eligibility and processing time depend on the applicable academic calendar policy.', 'Fees & Finance','BBA',3,88)
) AS x(question,answer,category_name,department_code,priority,views)
JOIN categories c ON c.category_name=x.category_name
JOIN departments d ON d.department_code=x.department_code
LEFT JOIN users u ON u.role='Admin'
WHERE NOT EXISTS (SELECT 1 FROM faqs f WHERE f.question=x.question);

INSERT INTO faq_embeddings (faq_id,embedding)
SELECT faq_id, ('[' ||
  (0.1 + (faq_id % 5) * 0.03)::text || ',' ||
  (0.2 + (faq_id % 4) * 0.02)::text || ',' ||
  (0.3 + (faq_id % 3) * 0.04)::text || ',' ||
  (0.1 + (faq_id % 7) * 0.01)::text || ',' ||
  '0.25,0.12,0.18,0.08]')::vector
FROM faqs f WHERE NOT EXISTS (SELECT 1 FROM faq_embeddings e WHERE e.faq_id=f.faq_id);

INSERT INTO documents (title,description,document_type,department_id,status)
SELECT 'Academic Regulations 2026','Demo reference document for attendance, exams and registration.','Policy',department_id,'published'
FROM departments WHERE department_code='SA'
AND NOT EXISTS (SELECT 1 FROM documents WHERE title='Academic Regulations 2026');
INSERT INTO documents (title,description,document_type,department_id,status)
SELECT 'Student Services Handbook','Demo reference for certificates and student support workflows.','Handbook',department_id,'published'
FROM departments WHERE department_code='SA'
AND NOT EXISTS (SELECT 1 FROM documents WHERE title='Student Services Handbook');
INSERT INTO search_history (user_id,query_text,result_count,created_at)
SELECT u.user_id, x.query_text, x.result_count, now() - x.offset_days * interval '1 day'
FROM (VALUES ('attendance requirements',3,0),('internship approval documents',2,1),('bonafide certificate',1,2),('elective registration',2,3),('hostel rules',1,4)) x(query_text,result_count,offset_days)
CROSS JOIN (SELECT user_id FROM users WHERE email='arjun.rao@campusquery.demo') u
WHERE NOT EXISTS (SELECT 1 FROM search_history);
INSERT INTO faq_feedback (faq_id,user_id,rating,comment)
SELECT f.faq_id,u.user_id,5,'Clear and useful.' FROM faqs f CROSS JOIN users u
WHERE f.question LIKE 'What is the minimum attendance%' AND u.email='arjun.rao@campusquery.demo'
AND NOT EXISTS (SELECT 1 FROM faq_feedback ff WHERE ff.faq_id=f.faq_id AND ff.user_id=u.user_id);
INSERT INTO bookmarks (user_id,faq_id)
SELECT u.user_id,f.faq_id FROM users u CROSS JOIN faqs f
WHERE u.email='arjun.rao@campusquery.demo' AND f.question LIKE 'What is the minimum attendance%'
AND NOT EXISTS (SELECT 1 FROM bookmarks b WHERE b.user_id=u.user_id AND b.faq_id=f.faq_id);