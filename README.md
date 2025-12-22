# 🚀 Hệ thống Quản lý Công việc - Next.js + Supabase

Ứng dụng quản lý công việc với phân quyền chi tiết, được xây dựng với **Next.js (App Router)**, **Supabase**, **TypeScript** và **Tailwind CSS**.

## ✨ Tính năng chính

### 🔐 Phân quyền theo vai trò (Role-Based Access Control)

| Vai trò | Quyền hạn |
|---------|-----------|
| **Trưởng phòng** | Toàn quyền trong phòng: xem, tạo, sửa, xóa, giao việc cho tất cả |
| **Phó phòng** | Quản lý đội được giao: xem, tạo, sửa, giao việc, phê duyệt |
| **Đội trưởng** | Quản lý đội: xem, tạo, sửa, giao việc trong đội, phê duyệt |
| **Đội phó** | Hỗ trợ đội trưởng: xem đội, giao việc cho cán bộ, phê duyệt |
| **Cán bộ** | Xem công việc được giao, cập nhật trạng thái, bình luận |

### 📋 Quản lý công việc

- ✅ Tạo, chỉnh sửa, xóa công việc
- ✅ Phân công công việc cho cấp dưới
- ✅ Theo dõi tiến độ (pending, in_progress, review, completed)
- ✅ Đánh giá kết quả công việc (rating 1-5 sao)
- ✅ Quản lý deadline và ưu tiên (low, medium, high, urgent)
- ✅ Bình luận và trao đổi trong công việc
- ✅ Upload file đính kèm (schema sẵn, UI/logic có thể mở rộng)

### 🔒 Bảo mật

- ✅ Row Level Security (RLS) - lọc dữ liệu theo quyền ở DB
- ✅ Authentication với Supabase Auth (cookie-based)
- ✅ API Routes bảo mật
- ✅ Type-safe với TypeScript

## 🗂️ Cấu trúc Project

```
.
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── login/
│   │   └── page.tsx
│   └── api/
│       ├── auth/
│       │   └── route.ts
│       └── tasks/
│           ├── route.ts
│           └── [id]/
│               └── route.ts
├── components/
│   ├── Header.tsx
│   ├── TaskForm.tsx
│   └── TaskList.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   └── types.ts
├── database/
│   ├── schema.sql
│   └── triggers.sql
├── scripts/
│   └── api-test.js
└── env.example
```

## 🚀 Bắt đầu

### Prerequisites

- Node.js 18+
- Docker Desktop (nếu dùng Supabase Local)
- Tài khoản Supabase (nếu dùng Supabase Cloud)

### Cài đặt

```bash
npm install
copy env.example .env.local
```

Sau đó điền:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Cấu hình Supabase

#### Option A: Supabase Cloud (khuyến nghị nếu chỉ cần kết nối nhanh)

1. Tạo project mới trên Supabase
2. Vào **SQL Editor** và chạy lần lượt:
   - `database/schema.sql`
   - `database/triggers.sql`
3. Vào **Project Settings → API** và copy:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (cần cho upload file)
4. Dán vào `.env.local`, sau đó chạy `npm run dev`

#### Option B: Supabase Local (chạy DB ở máy local)

Repo đã cấu hình sẵn trong thư mục `supabase/` và **có thể chạy CLI bằng npx** (không cần cài global).

```bash
npm run supabase:start
npm run supabase:env
npm run supabase:reset
npm run dev
```

Hoặc chạy 1 lệnh:

```bash
npm run dev:local
```

> Lưu ý: lần đầu chạy local, nếu thiếu bảng/schema thì hãy chạy `npm run supabase:reset` để apply migrations trong `supabase/migrations/`.

### Chạy ứng dụng

```bash
npm run dev
```

Truy cập: `http://localhost:3000`

## 🔌 API Endpoints

### Authentication

```
POST   /api/auth              # Login, Signup, Logout
GET    /api/auth              # Get current user + profile
```

### Tasks

```
GET    /api/tasks             # List tasks (filter bằng query params)
POST   /api/tasks             # Create task
GET    /api/tasks/[id]        # Get task details
PATCH  /api/tasks/[id]        # Update task
DELETE /api/tasks/[id]        # Delete task (RLS/role)
```

### Query Parameters

```
GET /api/tasks?status=pending
GET /api/tasks?teamId=xxx
GET /api/tasks?assignedTo=xxx
```
