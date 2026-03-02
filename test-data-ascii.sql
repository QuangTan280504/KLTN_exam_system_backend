-- Sample test data for exam system (UTF-8 encoded)

-- Insert a subject
INSERT INTO subjects (id, name, code) VALUES 
('11111111-1111-1111-1111-111111111111', 'Tin học', 'CS001');

-- Insert a question pool
INSERT INTO question_pools (id, subject_id, name, description) VALUES 
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Pool Câu hỏi trắc nghiệm', 'Pool mẫu cho câu hỏi trắc nghiệm');

-- Insert sample MCQ questions
INSERT INTO questions (id, pool_id, question_type, content, cognitive_level, data) VALUES 
('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'MCQ', 'HTML la viet tat cua?', 1,
'{"options": [{"id": "a1", "text": "Hyper Text Markup Language"}, {"id": "a2", "text": "High Tech Modern Language"}, {"id": "a3", "text": "Home Tool Markup Language"}, {"id": "a4", "text": "Hyperlinks and Text Markup Language"}], "correct_option_id": "a1"}'),
('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'MCQ', 'CSS duoc su dung de lam gi?', 1,
'{"options": [{"id": "b1", "text": "Dinh dang giao dien trang web"}, {"id": "b2", "text": "Tao co so du lieu"}, {"id": "b3", "text": "Xu ly logic ung dung"}, {"id": "b4", "text": "Luu tru du lieu"}], "correct_option_id": "b1"}');

-- Insert an exam matrix
INSERT INTO exam_matrices (id, subject_id, name, settings) VALUES 
('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Ma tran de thi Tin hoc THPT 2024',
'{"mcq_rules": [{"pool_id": "22222222-2222-2222-2222-222222222222", "count": 2, "cognitive_level": 1}], "group_rules": []}');

-- Insert an exam session
INSERT INTO exam_sessions (id, name, matrix_id, start_time, end_time, duration_minutes, status) VALUES 
('66666666-6666-6666-6666-666666666666', 'Ky thi Tin hoc THPT 2024', '55555555-5555-5555-5555-555555555555', 
NOW() - INTERVAL '1 hour', NOW() + INTERVAL '7 days', 45, 'ACTIVE');

-- Insert a test student
INSERT INTO students (id, student_code, full_name, date_of_birth, class_name) VALUES 
('77777777-7777-7777-7777-777777777777', 'SV001', 'Nguyen Van A', '2005-01-01', '12A1');

-- Insert a student exam with access code
INSERT INTO student_exams (id, session_id, student_id, access_code, status) VALUES 
('88888888-8888-8888-8888-888888888888', '66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777', 'TEST123', 'ASSIGNED');
