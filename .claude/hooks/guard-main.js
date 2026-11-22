// PreToolUse guard: blocks file edits and history-changing git commands while
// the checkout is on `main`. Work must happen on a feature branch cut from main.
const { execSync } = require('node:child_process')
const fs = require('node:fs')

const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}')
const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd }).toString().trim()

if (branch !== 'main') process.exit(0)

const tool = input.tool_name || ''
const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])
const GIT_WRITE = /\bgit\s+(commit|merge|cherry-pick|revert|rebase|am)\b/

if (EDIT_TOOLS.has(tool)) {
  console.error(
    'Đang ở main: không sửa file trên main. Tạo nhánh từ main trước (git checkout -b <nhánh> main).',
  )
  process.exit(2)
}
if (tool === 'Bash' && GIT_WRITE.test(String(input.tool_input?.command || ''))) {
  console.error(
    'Đang ở main: không chạy lệnh ghi lịch sử (commit/merge/cherry-pick/revert/rebase) trên main.',
  )
  process.exit(2)
}
process.exit(0)
