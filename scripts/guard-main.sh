#!/bin/sh
# Chặn commit trực tiếp lên main (lớp git, dùng bởi lefthook pre-commit).
branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" = "main" ]; then
  echo "Không commit trực tiếp lên main. Tạo nhánh từ main trước."
  exit 1
fi
exit 0
