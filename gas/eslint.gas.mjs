/* gas/wage.js 만 보는 아주 작은 검사 규칙 (2026-09-26).
 *
 *   node ../web/node_modules/eslint/bin/eslint.js -c eslint.gas.mjs wage.js
 *   (push.ps1 이 대신 불러줍니다)
 *
 * ── 왜 생겼나 ────────────────────────────────────────────────
 * 2026-09-26 에 `collectWorknet` 이 실행 중에 죽었습니다 —
 *   TypeError: Assignment to constant variable.  (wage.gs:2776)
 * 09-25 오후에 네 갈래 문지기(`sortRows_`)를 넣으면서
 *   holdEvents_(rowsToAdd);            (반환값을 안 씀)
 *   → rowsToAdd = sortRows_(rowsToAdd);  (반환값을 되받음)
 * 로 바꿨는데 위쪽 `const rowsToAdd = []` 를 `let` 으로 안 바꿨습니다.
 * **수집기 여섯 곳이 전부 같은 상태였습니다** (알리오·워크넷·클린아이·
 * 나라일터·보류함·지역알림).
 *
 * `node --check` 는 이걸 **못 잡습니다.** 문법이 아니라 실행 때 나는 오류라
 * 그 줄이 실제로 돌아야 터집니다. 그래서 「공고가 0건인 날」 에는 멀쩡해 보입니다.
 * 워크넷은 17건이 들어온 날에야 죽었습니다.
 *
 * ── 왜 규칙이 이것뿐인가 ─────────────────────────────────────
 * 스타일 규칙을 켜면 21,000줄짜리 파일에 경고가 수천 개 납니다. 그러면
 * 아무도 안 봅니다. **실행을 멈추는 것만** 켭니다.
 */
export default [
  {
    files: ['wage.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',      // Apps Script 는 모듈이 아닙니다
      globals: {
        /* Apps Script 가 주는 것들 — 「없는 이름」 으로 잡히지 않게 */
        SpreadsheetApp: 'readonly', PropertiesService: 'readonly', CacheService: 'readonly',
        UrlFetchApp: 'readonly', Utilities: 'readonly', Logger: 'readonly', DriveApp: 'readonly',
        MailApp: 'readonly', GmailApp: 'readonly', HtmlService: 'readonly', ScriptApp: 'readonly',
        ContentService: 'readonly', Drive: 'readonly', Session: 'readonly', LockService: 'readonly',
        XmlService: 'readonly', UserProperties: 'readonly', Browser: 'readonly',
        console: 'readonly', JSON: 'readonly', Math: 'readonly', Date: 'readonly',
      },
    },
    /* 「돌다가 죽는 것」 만. 스타일은 안 봅니다 */
    rules: {
      'no-const-assign': 'error',      // ← 2026-09-26 에 수집기 여섯을 멈춘 것
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
      /* 같은 이름을 두 번 선언 — 세션 1 에서 FSHEET 로 스크립트 전체가 멈춘 적이 있습니다 */
      'no-redeclare': 'error',
    },
  },
];
