/* tools/ 검사 규칙 — 「돌다가 죽는 것」만 (2026-09-28).
 *
 *   node tools/lint.mjs
 *
 * ── 왜 생겼나 ────────────────────────────────────────────────
 * 2026-09-26 에 `dropTrashed` 를 `hideTrashed` 로, `치움` 을 `감춤` 으로
 * 이름을 바꾸면서 **두 곳을 빼먹었습니다.**
 *   note: ['… 치움 ' + 치움 + '건']
 * `node --check` 는 통과했습니다. 문법이 아니라 실행 때 나는 오류라
 * 그 줄이 실제로 돌아야 터집니다. 그래서 다리가 **하루에 네 번** 죽었고,
 * 기록에는 `치움 is not defined` 만 남았습니다.
 *
 * gas 쪽에는 이미 같은 검사를 붙여 뒀는데(gas/eslint.gas.mjs) tools/ 는
 * 빠져 있었습니다. 같은 실수가 같은 날 두 군데서 났습니다.
 *
 * ── 왜 규칙이 이것뿐인가 ─────────────────────────────────────
 * 스타일 규칙을 켜면 경고가 수백 개 나고 아무도 안 봅니다.
 * **실행을 멈추는 것만** 켭니다.
 */
export default [
  {
    files: ['**/*.mjs', '**/*.js'],
    ignores: ['**/node_modules/**', 'hosp/reports/**', 'gas-rules.json'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly', process: 'readonly', fetch: 'readonly', Buffer: 'readonly',
        URL: 'readonly', URLSearchParams: 'readonly', TextDecoder: 'readonly',
        TextEncoder: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        require: 'readonly', module: 'writable', exports: 'writable',
        AbortSignal: 'readonly', AbortController: 'readonly', structuredClone: 'readonly',
        __dirname: 'readonly', __filename: 'readonly',
      },
    },
    rules: {
      /* ← 2026-09-28 에 다리를 네 번 죽인 것 */
      'no-undef': 'error',
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-func-assign': 'error',
      'no-import-assign': 'error',
      'no-obj-calls': 'error',
      'no-self-assign': 'error',
      'no-unsafe-negation': 'error',
      'no-unreachable': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-redeclare': 'error',
    },
  },
  {
    /* CommonJS 로 쓴 것들 */
    files: ['**/*.js'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    /* page.evaluate() 안은 **브라우저에서** 돕니다 — document 가 있는 게 맞습니다 */
    files: ['hosp/probe-browser.mjs'],
    languageOptions: { globals: { document: 'readonly', window: 'readonly' } },
  },
];
