// Port từ tan-tao-university/ttu-platform (commitlint.config.mjs).
// Chỉ kh_conv với CONTRIBUTING.md: Conventional Commits cho mọi commit/PR.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'chore',
        'docs',
        'refactor',
        'test',
        'perf',
        'style',
        'ci',
        'build',
        'revert',
      ],
    ],
    'subject-case': [0],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
}
