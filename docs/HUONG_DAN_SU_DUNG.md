# 📘 Hướng dẫn sử dụng – Work Management

Tài liệu này hướng dẫn cách sử dụng các chức năng chính của hệ thống **Work Management** (Next.js + Supabase).

## 1) Đăng nhập / Đăng ký

### 1.1 Truy cập
- Mở ứng dụng và vào trang **`/login`** (hoặc bấm nút “Đi tới trang đăng nhập” trên trang chủ).

### 1.2 Đăng nhập
- Nhập **Email** và **Password** → bấm **Đăng nhập**.
- Đăng nhập xong hệ thống sẽ chuyển về trang **`/`**.

### 1.3 Đăng ký
- Bấm **Chưa có tài khoản? Đăng ký**
- Nhập email/password (và họ tên nếu muốn) → bấm **Đăng ký**.

### 1.4 Tài khoản demo (seed)
Nếu bạn đã chạy seed demo (local) thì có các tài khoản:
- `admin@test.com` — `truong_phong`
- `pho_phong@test.com` — `pho_phong`
- `doi_truong@test.com` — `doi_truong`
- `doi_pho@test.com` — `doi_pho`
- `can_bo@test.com` — `can_bo`

Password mặc định (tất cả tài khoản): **`Test@123456`** (hoặc giá trị `SEED_PASSWORD`).

## 2) Điều hướng (Menu)

### 2.1 Desktop
- Bên trái có **Sidebar Menu**: **Thông báo**, **Dashboard**, **Team**, **Workspace**.
- (Tuỳ màn hình) Bên phải có sidebar **Users** (danh sách user).

### 2.2 Mobile
- Menu nằm ở **Header** (một số nút sẽ hiện ở header khi màn hình nhỏ).

## 3) Thông báo

### 3.1 Xem thông báo
- Bấm **Thông báo** để mở dropdown.
- Dropdown hiển thị danh sách thông báo gần nhất và badge số lượng chưa đọc.

### 3.2 Đóng dropdown
- Click ra ngoài dropdown sẽ **tự đóng**.
- Nhấn phím **Esc** sẽ **tự đóng**.

### 3.3 Đánh dấu đã đọc
- Trong dropdown bấm **Đánh dấu đã đọc** để mark all read.

## 4) Trang chủ – Danh sách công việc (`/`)

### 4.1 Tạo công việc nhanh
- Ở card “Tạo công việc” nhập:
  - **Tiêu đề**
  - **Ưu tiên** (low/medium/high/urgent)
  - **Due date** (tuỳ chọn)
- Bấm **Tạo công việc**.

> Lưu ý: công việc tạo ở trang chủ không gắn workspace/team (mặc định là task “chung” theo quyền truy cập).

### 4.2 Tìm kiếm (Search)
- Dùng ô **Search** để tìm theo tiêu đề/mô tả.
- Search có debounce (tự lọc sau khoảng ngắn khi bạn dừng gõ).
- Ô Search được đặt **sticky**, cuộn trang vẫn giữ vị trí.

### 4.3 Lọc theo trạng thái
- Dùng dropdown **Tất cả / Pending / Đang làm / Xem / Hoàn thành / Cancelled**.

### 4.4 Thao tác trên 1 task
Trong mỗi thẻ task:
- **Đổi trạng thái**: bấm nhanh các nút (Đang làm / Xem / Hoàn thành / Cancel)
- **Xoá task**: bấm **Xóa**
- **File đính kèm**:
  - Bấm “File đính kèm” để mở danh sách
  - Bấm “Upload” để tải file lên (nếu backend/storage được cấu hình)
- **Bình luận**:
  - Bấm “Bình luận” để mở thread
  - Nhập nội dung và bấm “Gửi bình luận”

## 5) Trang danh sách task nâng cao (`/tasks`)

Trang này dùng để xem task theo bộ lọc nâng cao (thường được điều hướng từ Dashboard).

### 5.1 Các bộ lọc (query string)
Các tham số phổ biến:
- `status`: `pending|in_progress|review|completed|cancelled`
- `scope`:
  - `assigned`: task **được giao cho tôi**
  - `created`: task **tôi tạo**
  - `all`: tất cả task trong phạm vi truy cập
- `overdue=1`: lọc task quá hạn
- `dueSoonDays=7`: lọc task đến hạn trong N ngày tới
- `has=comments` hoặc `has=attachments`
- `q=...`: tìm kiếm

### 5.2 Search
Ô search trên `/tasks` sẽ đồng bộ với `q` trên URL (khi bạn vào từ Dashboard).

## 6) Dashboard cá nhân (`/dashboard`)

Dashboard hiển thị:
- Tổng task trong phạm vi bạn thấy
- Task được giao cho bạn / bạn tạo
- Deadline: **Quá hạn**, **7 ngày tới**
- Thống kê theo trạng thái
- Tổng **bình luận** và **file đính kèm**

Bạn có thể bấm vào từng ô/thẻ để đi tới `/tasks` kèm bộ lọc tương ứng.

## 7) Team (`/team`)

### 7.1 Xem thông tin team hiện tại
Trong “Nhóm”:
- Hiển thị **tên nhóm**
- Hiển thị **mã tham gia (join_code)** để mời người khác

### 7.2 Tạo team mới
- Nhập tên → bấm **Tạo**

### 7.3 Join team bằng mã
- Nhập **join_code** → bấm **Join**

### 7.4 Công việc nhóm đang thực hiện
Nếu bạn đã thuộc team:
- Hệ thống hiển thị danh sách task của team theo trạng thái **in_progress**.

## 8) Workspace (`/workspace`)

Workspace dùng cho cộng tác “nhóm mở rộng” (nhiều người, phân vai trong workspace).

### 8.1 Tạo workspace
- Nhập tên workspace → bấm **Tạo**

### 8.2 Chọn workspace đang làm
- Dùng dropdown chọn workspace (khi có nhiều workspace).

### 8.3 Task trong workspace
- Chọn filter theo trạng thái
- Tạo task mới ngay trong workspace (task sẽ có `workspace_id`)
- Danh sách task của workspace hiển thị ở dưới

### 8.4 Quản lý thành viên workspace
- Nhập **email** của user
- Chọn **role** (truong_phong/pho_phong/doi_truong/doi_pho/can_bo)
- Bấm **Thêm thành viên**

Lưu ý quan trọng:
- User cần **đăng nhập ít nhất 1 lần** để có record trong bảng `profiles` (khi đó mới add theo email được).
- Quyền thêm/sửa/xoá thành viên phụ thuộc role trong workspace (theo RLS).

## 9) Sidebar Users (Desktop)
- Sidebar “Users” dùng để xem danh sách user (bảng `profiles`).
- Có ô tìm theo tên/email.

## 10) Quyền truy cập dữ liệu (tóm tắt)

Hệ thống dùng **Supabase RLS**. Thực tế quyền “nhìn thấy task” phụ thuộc policy trong database, thường dựa trên:
- Task bạn **tạo** (`created_by`)
- Task **giao cho bạn** (`assigned_to`)
- Task cùng **team** (nếu có `team_id`)
- Task thuộc **workspace** (nếu có `workspace_id` và bạn là member)

## 11) Lỗi thường gặp

### 11.1 Missing Supabase env
Nếu gặp lỗi:
`Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)`

- **Local**: tạo `.env.local` từ `env.example` và điền đủ biến.
- **Vercel**: thêm biến môi trường trong **Project Settings → Environment Variables** rồi redeploy.

### 11.2 Không add được user vào Workspace theo email
Nguyên nhân thường gặp: user **chưa từng đăng nhập** nên chưa có `profiles`.

### 11.3 Upload file không hoạt động
Cần:
- `SUPABASE_SERVICE_ROLE_KEY` (tuỳ flow)
- Supabase Storage bucket/policy phù hợp (tuỳ cấu hình dự án của bạn)

