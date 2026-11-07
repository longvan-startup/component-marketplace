# Deployment Control Room

Control Room đọc trạng thái CI từ GitHub Actions và trạng thái deployment từ Vercel. Nút **Deploy Production** chỉ gọi workflow release đã được bảo vệ; nó không tự build, chạy Docker hoặc gọi `localhost` từ server.

Web và Backend / API dùng chung một release target vì chúng thuộc cùng một Vercel project. Admin hiển thị Planned / Not configured cho đến khi ứng dụng thật tồn tại trong repository.

## Local development links

Web và API có URL mặc định `http://localhost:3000` và `http://localhost:4000/health`. Mỗi trình duyệt có thể lưu URL riêng. Chỉ `localhost`, `127.0.0.0/8` và `[::1]` được chấp nhận. Dashboard chỉ mở URL trong tab mới; nó không gửi request đến máy local. Admin chưa có URL mặc định.

Các bản ghi `localStorage` từ phiên bản trước vẫn được hiển thị trong mục **Lịch sử cũ**. Chúng không được dùng làm CI status hay deployment history chính thức.

## Dashboard environment

Đăng nhập vẫn dùng GitHub OAuth và danh sách GitHub ID trong `DASHBOARD_GITHUB_IDS`. Đăng ký callback `<DASHBOARD_ORIGIN>/api/auth/callback/github` cho OAuth App.

| Biến | Mục đích |
| --- | --- |
| `DASHBOARD_ORIGIN`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | Xác thực dashboard. |
| `DASHBOARD_GITHUB_IDS` | Allowlist Long và Văn. |
| `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` | GitHub App server-side để đọc CI và dispatch release workflow. Giới hạn App vào repository này; quyền `Actions: read/write`, `Contents: read`. |
| `RELEASE_GITHUB_REPOSITORY` | Repository có CI và release workflows. |
| `VERCEL_API_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_IDS` | Chỉ đọc trạng thái project/deployment từ Vercel. Token không gửi xuống browser. |
| `RELEASE_VERCEL_PROJECT_ID` | Vercel project duy nhất chứa Web và API. Project ID này phải nằm trong `VERCEL_PROJECT_IDS`. |
| `PRODUCTION_WEB_URL`, `PRODUCTION_API_URL` | HTTPS URLs được hiển thị như production targets. |
| `RELEASE_PRODUCTION_ENABLED` | Giữ `false` cho tới khi checklist owner trong `docs/DEPLOYMENT.md` hoàn tất. |

## Local run and tests

Yêu cầu Node 22. Chạy `npm ci --workspaces=false` trong thư mục này, cấu hình `.env` từ `.env.example`, rồi chạy `node server.mjs`. Chạy focused tests bằng `node --test dashboard.test.mjs oauth.test.mjs release.test.mjs ui.test.mjs workflow.test.mjs`.

Release tests dùng GitHub/Vercel responses giả; không chạy production migration hoặc deployment thật.
