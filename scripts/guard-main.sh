#!/bin/sh
# Chặn commit trên main. Lớp git, áp dụng cho mọi agent hoặc người commit qua git
# khi đã cài hook (bun run prepare). Đây là nguồn logic duy nhất cho lớp này.
branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" = "main" ]; then
  echo "Không commit trực tiếp lên main. Tạo nhánh từ main trước."
  exit 1
fi
exit 0
