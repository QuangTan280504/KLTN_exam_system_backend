-- Exam System Database Schema

-- Users (Quản trị viên, Tổ trưởng bộ môn, Giáo viên)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  "fullName" VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(255) UNIQUE,
  role VARCHAR(50) DEFAULT 'ADMIN',
  "isFirstLogin" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Question Pools
CREATE TABLE IF NOT EXISTS question_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  cognitive_level INT NOT NULL CHECK (cognitive_level BETWEEN 1 AND 3),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pool_subject ON question_pools(subject_id);
CREATE INDEX IF NOT EXISTS idx_pool_cognitive ON question_pools(cognitive_level);

-- Questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES question_pools(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  options JSONB,
  correct_answer JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_pool ON questions(pool_id);
CREATE INDEX IF NOT EXISTS idx_question_type ON questions(type);

-- Add images column to questions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';

-- Exam Matrices
CREATE TABLE IF NOT EXISTS exam_matrices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  structure JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matrix_subject ON exam_matrices(subject_id);

-- Exam Sessions
CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  matrix_id UUID REFERENCES exam_matrices(id) ON DELETE RESTRICT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  duration_minutes INT NOT NULL,
  status VARCHAR(20) DEFAULT 'DRAFT',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_matrix ON exam_sessions(matrix_id);
CREATE INDEX IF NOT EXISTS idx_session_times ON exam_sessions(start_time, end_time);

-- Thêm cột mới cho exam_sessions (cơ chế mới)
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS class_name VARCHAR(100);
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS show_score BOOLEAN DEFAULT false;
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Thêm cột cho exam_matrices (Phần III - Trả lời ngắn)
ALTER TABLE exam_matrices ADD COLUMN IF NOT EXISTS total_short_answer_count INT DEFAULT 0;

-- Students
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  date_of_birth DATE,
  class_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_code ON students(student_code);

-- Student Exams
CREATE TABLE IF NOT EXISTS student_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  access_code VARCHAR(20), -- [CƠ CHẾ CŨ] không còn UNIQUE NOT NULL
  exam_snapshot JSONB,
  student_answers JSONB,
  score DECIMAL(5,2),
  mcq_correct_count INT DEFAULT 0,
  group_correct_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'ASSIGNED',
  started_at TIMESTAMP,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studentexam_session ON student_exams(session_id);
CREATE INDEX IF NOT EXISTS idx_studentexam_student ON student_exams(student_id);
-- [CƠ CHẾ CŨ] idx_studentexam_access không còn cần
CREATE INDEX IF NOT EXISTS idx_studentexam_status ON student_exams(status);

-- Classes (Lớp học - quản lý bởi Tổ trưởng bộ môn)
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  grade VARCHAR(50),
  description TEXT,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_created_by ON classes(created_by_id);

-- Lecturer-Classes (Bảng liên kết nhiều-nhiều giáo viên - lớp học)
CREATE TABLE IF NOT EXISTS lecturer_classes (
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  lecturer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, lecturer_id)
);

CREATE INDEX IF NOT EXISTS idx_lc_class ON lecturer_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_lc_lecturer ON lecturer_classes(lecturer_id);
