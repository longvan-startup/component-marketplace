# AGENTS.md — Quy tắc cho AI Agent (OpenCode, Codex, T3 Code)

Người đọc đầu tiên của file này là **agent**, không phải con người.
Toàn bộ chuẩn kỹ thuật nằm tập trung ở 2 chỗ duy nhất — **không lặp lại nội dung ở đây:**

- [`docs/ENGINEERING.md`](docs/ENGINEERING.md) — coding standards, ownership, Definition of Done, quality gates
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — branch strategy, Conventional Commits, PR review process

## Bắt buộc trước khi sửa bất kỳ dòng code nào

1. Đọc `docs/ENGINEERING.md` và `CONTRIBUTING.md` trước tiên.
2. Xác định **phạm vi task** và **giới hạn thay đổi** của mình; phạm vi không rõ thì hỏi, không đoán.
3. Chỉ sửa đúng module được giao. Không refactor, không đổi style, không sửa file "nhân tiện" ở module khác.

## Trong khi làm việc

- Không tự merge PR, không deploy, không push vào `main` trực tiếp.
- **Không bao giờ** đưa secrets, token, API key vào logs, commit, PR body. `.env` local chỉ để chạy thử, không commit.
- Khi phát hiện vấn đề nằm ngoài phạm vi (bug, thiếu config, CI sai): **báo lại, không tự sửa** nếu thuộc domain của người khác — xem ownership map trong `docs/ENGINEERING.md`.

## Báo cáo hoàn thành

- Chạy đủ **quality gates** (xem `docs/ENGINEERING.md`) trước khi tuyên bố "xong".
- Kết quả mỗi gate chỉ được báo theo một trong ba nhãn: **PASS** / **FAIL** / **UNVERIFIED**. "UNVERIFIED" phải có lý do (ví dụ: thiếu tool trên máy).
- Có FAIL hoặc UNVERIFIED còn tồn đọng thì phải nêu trong báo cáo cuối, kèm nguyên nhân và gợi ý xử lý — không được im lặng về trạng thái chưa chắc chắn.
