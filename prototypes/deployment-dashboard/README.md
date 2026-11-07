# Deployment Control Room

Dashboard Vercel độc lập với đăng nhập GitHub và danh sách người dùng được phép. Giao diện hiện ghi nhận lịch sử cho ba ứng dụng Web, Backend / API và Admin.

## Hành vi ghi nhận

- Nút **Ghi nhận lần triển khai** lưu một bản ghi gồm ứng dụng, commit SHA tùy chọn, kết quả kiểm tra và ghi chú tùy chọn.
- Bản ghi được lưu trong `localStorage` của trình duyệt hiện tại. Dữ liệu không đồng bộ giữa người dùng, trình duyệt hoặc thiết bị.
- `PASS`, `FAIL` và `Chưa chạy` là kết quả do người dùng nhập. Dashboard không chạy test và không xác nhận thay người dùng.
- Ghi nhận không gửi code, không tạo deployment và không gọi Vercel, GitHub Actions hoặc VPS. Hiện chưa cấu hình website hay máy chủ nhận thay đổi.

## Đăng nhập và cấu hình

Đăng nhập qua GitHub OAuth. `DASHBOARD_GITHUB_IDS` giới hạn GitHub user ID được truy cập; session được kiểm tra lại ở mỗi API request. Đăng ký callback `<DASHBOARD_ORIGIN>/api/auth/callback/github` cho GitHub OAuth App.

| Biến | Mục đích |
| --- | --- |
| `DASHBOARD_ORIGIN` | URL HTTPS cố định của dashboard. |
| `AUTH_SECRET` | Secret mã hóa session, tối thiểu 32 ký tự. |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | Thông tin OAuth App. |
| `DASHBOARD_GITHUB_IDS` | Danh sách GitHub user ID cho phép, ngăn cách bằng dấu phẩy. |
| `VERCEL_API_TOKEN` | Token Vercel dùng cho các API chỉ đọc hiện có; giao diện ghi nhận không gọi token này. |
| `VERCEL_TEAM_ID` | Team chứa project được phép đọc. |
| `VERCEL_PROJECT_IDS` | Danh sách tối đa 20 project ID được các API chỉ đọc chấp nhận. |

Token, OAuth secret và session secret chỉ lưu server-side, không commit hoặc đưa vào trình duyệt. API Vercel chỉ đọc vẫn giới hạn project theo danh sách cho phép; chúng không được dùng để triển khai. Thiếu cấu hình sẽ trả 503 cho API tương ứng; người chưa đăng nhập hoặc không có quyền nhận 401.

## Chạy local và kiểm tra

Dùng Node 22, `npm ci --workspaces=false`, cấu hình biến môi trường rồi chạy `node server.mjs`. Chạy test bằng `node --test dashboard.test.mjs oauth.test.mjs ui.test.mjs`. OAuth trong test dùng GitHub giả; cần kiểm tra đăng nhập trên Vercel sau khi cấu hình.

Nguồn: [Vercel API](https://vercel.com/docs/rest-api), [Auth.js](https://authjs.dev/reference/core).
