# 📚 Exam System — Backend

Hệ thống quản lý thi trực tuyến — Backend API được xây dựng trên **NestJS 11** với **TypeScript**, sử dụng **PostgreSQL 15** và **TypeORM**.

---

## 📋 Mục lục

- [Tổng quan](#tổng-quan)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Cài đặt & Chạy](#cài-đặt--chạy)
- [Biến môi trường](#biến-môi-trường)
- [API Endpoints](#api-endpoints)
- [Cơ sở dữ liệu](#cơ-sở-dữ-liệu)
- [Xác thực & Phân quyền](#xác-thực--phân-quyền)
- [Tính năng chính](#tính-năng-chính)

---

## Tổng quan

Backend cung cấp RESTful API cho hệ thống thi trực tuyến, hỗ trợ:

- Quản lý người dùng đa vai trò (Admin, Trưởng Bộ môn, Giảng viên, Sinh viên)
- Ngân hàng câu hỏi với câu hỏi trắc nghiệm (MCQ) và câu hỏi nhóm Đúng/Sai (GROUP)
- Ma trận đề thi với cấu trúc tự động lấy câu hỏi theo mức nhận thức
- Quản lý ca thi với vòng đời DRAFT → ACTIVE → FINISHED
- Tạo đề thi ngẫu nhiên (shuffle) riêng cho từng sinh viên
- Chấm điểm tự động và xuất báo cáo Excel
- Swagger API documentation tại `/api`

---

## Công nghệ sử dụng

| Công nghệ | Mô tả |
|---|---|
| **NestJS 11** | Framework Node.js cho server-side applications |
| **TypeScript** | Ngôn ngữ lập trình strongly-typed |
| **PostgreSQL 15** | Cơ sở dữ liệu quan hệ |
| **TypeORM** | ORM cho TypeScript/JavaScript |
| **Passport + JWT** | Xác thực JSON Web Token |
| **bcrypt** | Mã hóa mật khẩu |
| **class-validator** | Validation cho DTO |
| **ExcelJS** | Import/Export file Excel |
| **Swagger** | Tài liệu API tự động |
| **Docker** | Container hóa ứng dụng |
| **@nestjs/schedule** | Cron job tự động đóng ca thi |

---

## Cấu trúc dự án

```
src/
├── main.ts                    # Entry point — bootstrap NestJS app
├── app.module.ts              # Root module — kết nối DB, đăng ký modules
├── constants/                 # Hằng số (vai trò)
├── utils/                     # Hàm tiện ích
└── modules/
    ├── auth/                  # Xác thực & quản lý người dùng
    │   ├── guards/            # JwtAuthGuard, StudentJwtAuthGuard, RolesGuard
    │   ├── strategies/        # JWT strategies (admin + student)
    │   ├── decorators/        # @Roles(), @CurrentUser()
    │   ├── dto/               # LoginDto, ChangePasswordDto, CreateLecturerDto...
    │   └── entities/          # User entity
    ├── subject/               # Quản lý môn học (CRUD)
    ├── question-pool/         # Quản lý ngân hàng câu hỏi
    ├── question/              # Quản lý câu hỏi (MCQ, GROUP)
    ├── exam-matrix/           # Ma trận đề thi
    ├── exam-session/          # Ca thi (lifecycle, scheduler, snapshot)
    │   ├── services/          # ExamSnapshotService
    │   ├── enums/             # ExamSessionStatus, StudentExamStatus
    │   └── interfaces/        # Snapshot interfaces
    ├── student/               # Quản lý sinh viên
    ├── student-exam/          # Bài thi sinh viên (start, submit, result)
    ├── class/                 # Quản lý lớp học & thống kê HOD
    └── report/                # Báo cáo & xuất Excel
```

---

## Cài đặt & Chạy

### Yêu cầu

- **Node.js** >= 20
- **PostgreSQL** >= 15
- **npm** hoặc **yarn**

### Chạy với Docker (khuyến nghị)

```bash
# Clone và chạy
docker-compose up -d

# Backend:  http://localhost:3000
# Swagger:  http://localhost:3000/api
# PostgreSQL: localhost:5432
```

### Chạy thủ công

```bash
# 1. Cài đặt dependencies
npm install

# 2. Tạo database PostgreSQL
psql -U postgres -f init-db.sql

# 3. Cấu hình biến môi trường (tạo file .env)
cp .env.example .env

# 4. Chạy development server
npm run start:dev

# 5. Chạy production
npm run build
npm run start:prod
```

### Scripts

| Script | Mô tả |
|---|---|
| `npm run start:dev` | Chạy dev server với hot reload |
| `npm run start:debug` | Chạy với debug mode |
| `npm run build` | Build TypeScript sang JavaScript |
| `npm run start:prod` | Chạy production build |
| `npm run lint` | Kiểm tra linting |
| `npm run format` | Format code với Prettier |
| `npm test` | Chạy unit tests |
| `npm run test:cov` | Chạy tests với coverage |

---

## Biến môi trường

| Biến | Giá trị mặc định | Mô tả |
|---|---|---|
| `NODE_ENV` | — | `development` bật TypeORM synchronize |
| `PORT` | `3000` | Cổng HTTP server |
| `DB_HOST` | `localhost` | Host PostgreSQL |
| `DB_PORT` | `5432` | Cổng PostgreSQL |
| `DB_USER` | `exam_user` | Tên đăng nhập PostgreSQL |
| `DB_PASSWORD` | `exam_pass` | Mật khẩu PostgreSQL |
| `DB_NAME` | `exam_system` | Tên database |
| `JWT_SECRET` | `exam-system-secret-key...` | Khóa bí mật JWT |

---

## API Endpoints

### Xác thực — `/auth`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/auth/login` | Public | Đăng nhập (username/email/phone) |
| GET | `/auth/profile` | JWT | Xem thông tin cá nhân |
| POST | `/auth/change-password` | JWT | Đổi mật khẩu |
| POST | `/auth/force-change-password` | JWT | Đổi mật khẩu lần đầu |

### Quản lý Giảng viên — `/lecturers`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/lecturers` | Admin | Tạo giảng viên |
| GET | `/lecturers` | Admin | Danh sách giảng viên |
| GET | `/lecturers/:id` | Admin | Chi tiết giảng viên |
| PATCH | `/lecturers/:id` | Admin | Cập nhật giảng viên |
| DELETE | `/lecturers/:id` | Admin | Xóa giảng viên |
| POST | `/lecturers/:id/reset-password` | Admin | Reset mật khẩu |

### Trưởng Bộ môn — `/hod`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/hod/create` | Admin | Tạo tài khoản TBM |
| GET | `/hod/list` | Admin | Danh sách TBM |
| PATCH | `/hod/:id` | Admin | Cập nhật TBM |
| DELETE | `/hod/:id` | Admin | Xóa TBM |
| POST | `/hod/lecturers` | HOD | Tạo giảng viên (TBM quản lý) |
| GET | `/hod/lecturers` | HOD | Danh sách GV của TBM |
| GET | `/hod/statistics/dashboard` | HOD | Thống kê tổng quan |
| GET | `/hod/statistics/score-chart` | HOD | Biểu đồ điểm số |

### Môn học — `/subjects`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/subjects` | Admin/HOD/GV | Tạo môn học |
| GET | `/subjects` | Admin/HOD/GV | Danh sách môn học |
| PATCH | `/subjects/:id` | Admin/HOD/GV | Cập nhật môn học |
| DELETE | `/subjects/:id` | Admin/HOD/GV | Xóa môn học |

### Ngân hàng câu hỏi — `/question-pools`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/question-pools` | Admin/HOD/GV | Tạo ngân hàng câu hỏi |
| GET | `/question-pools` | Admin/HOD/GV | Danh sách (theo quyền truy cập) |
| GET | `/question-pools/:id/stats` | Admin/HOD/GV | Thống kê số câu hỏi |
| POST | `/question-pools/:id/import-questions` | Admin/HOD/GV | Import câu hỏi từ Excel |

### Câu hỏi — `/questions`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/questions` | Admin/HOD/GV | Tạo câu hỏi (MCQ/GROUP) |
| GET | `/questions` | Admin/HOD/GV | Danh sách (phân trang, lọc) |
| PATCH | `/questions/:id` | Admin/HOD/GV | Cập nhật câu hỏi |
| DELETE | `/questions/:id` | Admin/HOD/GV | Xóa câu hỏi |
| POST | `/questions/import` | Admin/HOD/GV | Import từ Excel |

### Ma trận đề thi — `/exam-matrices`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/exam-matrices` | Admin/HOD/GV | Tạo ma trận đề |
| GET | `/exam-matrices` | Admin/HOD/GV | Danh sách ma trận |
| PATCH | `/exam-matrices/:id` | Admin/HOD/GV | Cập nhật ma trận |
| DELETE | `/exam-matrices/:id` | Admin/HOD/GV | Xóa ma trận |

### Ca thi — `/exam-sessions`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/exam-sessions` | Admin/HOD/GV | Tạo ca thi |
| GET | `/exam-sessions` | Admin/HOD/GV | Danh sách ca thi |
| GET | `/exam-sessions/:id` | Admin/HOD/GV | Chi tiết ca thi |
| GET | `/exam-sessions/:id/students` | Admin/HOD/GV | Danh sách SV trong ca |
| POST | `/exam-sessions/:id/transfer-student` | Admin/HOD/GV | Chuyển SV vắng sang ca khác |
| PATCH | `/exam-sessions/:id` | Admin/HOD/GV | Cập nhật / kích hoạt ca thi |

### Bài thi sinh viên — `/student-exams`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/student-exams/:id/start` | Student | Bắt đầu làm bài |
| POST | `/student-exams/:id/submit` | Student | Nộp bài |
| GET | `/student-exams/:id/result` | Student | Xem kết quả |

### Sinh viên — `/students`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/students` | Admin/HOD/GV | Tạo sinh viên |
| POST | `/students/bulk` | Admin/HOD/GV | Tạo hàng loạt |
| GET | `/students` | Admin/HOD/GV | Danh sách sinh viên |
| POST | `/students/auth/login` | Public | Đăng nhập sinh viên |
| GET | `/students/auth/my-sessions` | Student JWT | Danh sách ca thi của SV |

### Báo cáo — `/reports`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/reports/dashboard-stats` | Admin/HOD/GV | Thống kê tổng quan |
| GET | `/reports/sessions/:id/score-sheet` | Admin/HOD/GV | Tải bảng điểm (Excel) |
| GET | `/reports/sessions/:id/audit-log` | Admin/HOD/GV | Tải nhật ký chi tiết (Excel) |
| GET | `/reports/student-exams/:id/detail` | Admin/HOD/GV | Chi tiết bài thi SV |
| GET | `/reports/student-exams/:id/download` | Admin/HOD/GV | Tải chi tiết bài thi (Excel) |

### Lớp học — `/classes`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/classes` | HOD | Tạo lớp |
| GET | `/classes` | HOD/Admin | Danh sách lớp |
| GET | `/classes/my-classes` | All | Lớp được phân công |
| POST | `/classes/:id/assign-lecturers` | HOD | Phân công GV |
| DELETE | `/classes/:id/lecturers/:lecturerId` | HOD | Gỡ GV khỏi lớp |

---

## Cơ sở dữ liệu

### Sơ đồ quan hệ

```
┌──────────┐     ┌───────────────┐     ┌────────────┐
│  users   │────>│question_pools │────>│  questions  │
│(Admin/   │     │(public/private│     │ (MCQ/GROUP) │
│HOD/GV)   │     └──────┬────────┘     └────────────┘
└──────────┘            │
                   ┌────┴─────┐
                   │ subjects │
                   └────┬─────┘
                        │
                ┌───────┴────────┐
                │ exam_matrices  │
                │(settings JSONB)│
                └───────┬────────┘
                        │
               ┌────────┴─────────┐      ┌──────────┐
               │  exam_sessions   │─────>│ students  │
               │(DRAFT → ACTIVE → │      └─────┬────┘
               │ FINISHED)        │            │
               └──────────────────┘      ┌─────┴──────┐
                                         │student_exams│
                                         │(snapshot,   │
                                         │ answers,    │
                                         │ score)      │
                                         └────────────┘

┌──────────┐     ┌──────────────────┐
│ classes  │<───>│ lecturer_classes  │
│(HOD tạo) │     │  (many-to-many)  │
└──────────┘     └──────────────────┘
```

### Bảng chính

| Bảng | Mô tả |
|---|---|
| `users` | Tài khoản Admin, Trưởng BM, Giảng viên — UUID primary key, bcrypt password |
| `subjects` | Môn học — tên, mã (unique), mô tả |
| `question_pools` | Ngân hàng câu hỏi theo môn, phân quyền public/private |
| `questions` | Câu hỏi MCQ hoặc GROUP, cognitive level 1-3, dữ liệu JSONB |
| `exam_matrices` | Ma trận đề thi — settings JSONB chứa rules lấy câu hỏi theo pool & level |
| `exam_sessions` | Ca thi với lifecycle DRAFT → ACTIVE → FINISHED |
| `students` | Tài khoản sinh viên — mã SV unique, class_name |
| `student_exams` | Bài thi: exam snapshot, câu trả lời, điểm, trạng thái |
| `classes` | Lớp học do Trưởng BM quản lý |
| `lecturer_classes` | Bảng join phân công GV — lớp (many-to-many) |

---

## Xác thực & Phân quyền

### Cơ chế JWT kép

Hệ thống sử dụng **2 JWT Strategy** riêng biệt:

1. **`jwt` Strategy** — Dành cho Admin / Trưởng BM / Giảng viên
   - Payload: `{ sub: userId, username, role }`
2. **`student-jwt` Strategy** — Dành cho Sinh viên
   - Payload: `{ sub: studentId, username, role: 'STUDENT', type: 'student' }`

### Vai trò (Roles)

| Vai trò | Mã | Quyền hạn |
|---|---|---|
| **Admin** | `ADMIN` | Toàn quyền: quản lý toàn bộ hệ thống |
| **Trưởng Bộ môn** | `HEAD_OF_DEPARTMENT` | Quản lý GV, lớp học, thống kê, ngân hàng câu hỏi, đề thi |
| **Giảng viên** | `LECTURER` | Tạo câu hỏi (private), xây dựng đề thi, quản lý ca thi |
| **Sinh viên** | `STUDENT` | Làm bài thi, xem kết quả |

### Guards bảo mật

- **`JwtAuthGuard`** — Xác thực JWT cho admin/GV/TBM
- **`StudentJwtAuthGuard`** — Xác thực JWT cho sinh viên
- **`RolesGuard`** — Kiểm tra vai trò với decorator `@Roles()`

### Tài khoản mặc định

| Tài khoản | Username | Password | Ghi chú |
|---|---|---|---|
| Admin | `admin` | `Admin@123` | Tự tạo khi khởi động lần đầu |
| Người dùng mới | — | `123456789` | Mật khẩu mặc định khi reset, bắt buộc đổi khi đăng nhập |

---

## Tính năng chính

### Hệ thống câu hỏi

- **Trắc nghiệm (MCQ):** 4 đáp án A-D, 1 đáp án đúng, 0.25 điểm/câu
- **Nhóm Đúng/Sai (GROUP):** 4 mệnh đề con, mỗi mệnh đề Đúng hoặc Sai, 0.25 điểm/mệnh đề đúng
- **3 mức nhận thức:** Biết — Hiểu — Vận dụng (dựa trên Bloom's Taxonomy)
- **Import từ Excel:** Hỗ trợ 2 sheet "MCQ" và "Group" để nhập hàng loạt câu hỏi
- **Phân quyền ngân hàng:** HOD/Admin tạo ngân hàng public (toàn bộ GV truy cập), GV tạo ngân hàng private

### Ma trận đề thi

- Cấu hình linh hoạt: chọn số câu hỏi từ từng ngân hàng theo mức nhận thức
- Tự động kiểm tra đủ câu hỏi trong ngân hàng khi tạo ma trận
- Tính tổng số câu MCQ, GROUP và điểm dự kiến

### Ca thi & Sinh đề ngẫu nhiên

- **Vòng đời ca thi:** DRAFT → ACTIVE (tự gán SV theo lớp) → FINISHED (tự đóng)
- **Đề thi riêng biệt:** Mỗi sinh viên nhận đề thi ngẫu nhiên khác nhau:
  - Lấy ngẫu nhiên câu hỏi từ ngân hàng theo rules ma trận (Fisher-Yates shuffle)
  - Xáo trộn thứ tự đáp án MCQ (A, B, C, D)
  - Xáo trộn thứ tự mệnh đề GROUP (a, b, c, d)
  - Snapshot lưu trong JSONB, đáp án đúng không gửi cho frontend
- **Scheduler tự động:** Cron job mỗi phút kiểm tra và đóng ca thi quá giờ, đánh dấu SV chưa nộp là **Vắng**
- **Buffer nộp trễ:** Cho phép nộp trễ 60 giây (dung sai độ trễ mạng)

### Chuyển ca thi

- Sinh viên **Vắng** có thể được chuyển sang ca thi tương đương
- Ca tương đương: cùng ma trận đề hoặc cùng môn + cùng khối lớp
- Bản ghi vắng cũ được giữ lại để tra cứu lịch sử

### Chấm điểm tự động

- MCQ: 0.25 điểm cho mỗi câu chọn đúng
- GROUP: 0.25 điểm cho mỗi mệnh đề chọn đúng
- Tính tổng điểm, số câu MCQ đúng, số câu GROUP đúng

### Báo cáo & Xuất Excel

- **Bảng điểm:** Danh sách sinh viên với điểm, số câu đúng MCQ/GROUP, ô chữ ký
- **Nhật ký chi tiết (Audit Log):** Từng SV, từng câu hỏi, đáp án đã chọn, kết quả đúng/sai
- **Chi tiết bài thi:** Breakdown từng câu hỏi cho 1 sinh viên cụ thể
- **Thống kê Dashboard:** Tổng số môn, câu hỏi, ca thi, sinh viên