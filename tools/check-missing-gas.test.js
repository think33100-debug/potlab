/* tools/check.js 의 「갈래 규칙 대조」 회귀 시험 (2026-11-03)
 *
 *   node tools/check-missing-gas.test.js
 *
 * gas/wage.js 는 저장소에 안 올라갑니다. 없을 때 sort-rule-to-gas.mjs --검사 가
 * ENOENT 로 죽고, check.js 가 그것을 「규칙이 다릅니다」로 적고 있었습니다.
 *
 * check.js 를 node vm 으로 그대로 돌리되 fs · child_process · process 를 **가짜로**
 * 넣습니다. gas/ 경로는 실제로 열지도 만들지도 않습니다 (지침 0절).
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CHECK = path.join(__dirname, 'check.js');
const src = fs.readFileSync(CHECK, 'utf8');
const 갈래말 = 'gas 의 갈래 규칙이 tools/sort-rule.mjs 와 다릅니다';

const isWage = (p) => /[\\/]gas[\\/]wage\.js$/.test(String(p));

function run(scenario) {
  const logs = [];
  const calls = [];
  const gasTouches = [];
  let exitCode = null;
  const EXIT = {};

  const fakeFs = {
    readFileSync(p) {
      const s = String(p);
      if (isWage(s)) {
        gasTouches.push('read');
        if (!scenario.wageExists) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; }
        return 'const API = {\n  a: 1,\n};\nfunction a() {}\n';
      }
      if (/[\\/]gas[\\/]/.test(s)) throw new Error('시험이 gas 의 다른 파일을 열려 했습니다: ' + s);
      if (s.endsWith('app.js')) return "var METHODS = ['a'];\nvar APP_JS_VER = 'x';\n";
      if (s.endsWith('.html')) return '<script src="app.js?v=1"></script>';
      throw new Error('예상 밖 파일 읽기: ' + s);
    },
    existsSync(p) {
      if (isWage(p)) { gasTouches.push('exists'); return !!scenario.wageExists; }
      throw new Error('예상 밖 existsSync: ' + p);
    },
  };
  const fakeCp = {
    execFileSync(exe, args) {
      const script = path.basename(String(args[0]));
      calls.push(script);
      if (script === 'sort-rule-to-gas.mjs') return scenario.sortRule();
      return '';
    },
  };
  const fakeProcess = {
    execPath: process.execPath,
    argv: [process.execPath, CHECK],
    exit(c) { exitCode = c; throw EXIT; },
  };
  const fakeRequire = (m) => {
    if (m === 'fs') return fakeFs;
    if (m === 'child_process') return fakeCp;
    if (m === 'path') return path;
    throw new Error('예상 밖 require: ' + m);
  };
  const fakeConsole = { log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) };

  const wrapped = vm.runInNewContext(
    '(function (require, __dirname, process, console) {' + src + '\n})',
    {}, { filename: CHECK });
  try {
    wrapped(fakeRequire, __dirname, fakeProcess, fakeConsole);
  } catch (e) {
    if (e !== EXIT) throw e;
  }
  return { logs, calls, exitCode, gasTouches, text: logs.join('\n') };
}

/* sort-rule-to-gas.mjs 가 gas/wage.js 없이 돌 때 실제로 내는 꼴 (fs.readFileSync ENOENT) */
const enoentThrow = () => {
  const e = new Error('Command failed');
  e.status = 1;
  e.stdout = '';
  e.stderr = "node:fs:624\n  return binding.open(\n                 ^\n\nError: ENOENT: no such file or directory, open '…/gas/wage.js'\n";
  throw e;
};

const tests = [
  ['gas/wage.js 가 없으면 갈래 대조를 건너뛰고 문제를 더하지 않습니다', () => {
    const r = run({ wageExists: false, sortRule: enoentThrow });
    assert.ok(!r.text.includes(갈래말), '갈래 문제가 적혔습니다:\n' + r.text);
    assert.strictEqual(r.exitCode, null, '종료코드 ' + r.exitCode + ' 로 끝났습니다:\n' + r.text);
    assert.ok(!r.calls.includes('sort-rule-to-gas.mjs'), 'sort-rule-to-gas.mjs 를 불렀습니다');
    assert.ok(/gas\/wage\.js 가 없어 갈래 규칙 대조는 건너뜁니다/.test(r.text), '건너뜀 알림이 없습니다:\n' + r.text);
    assert.ok(r.text.includes('어긋난 곳 없습니다'), r.text);
  }],
  ['gas/wage.js 가 있고 같으면 통과합니다', () => {
    const r = run({ wageExists: true, sortRule: () => '○ gas 의 갈래 규칙이 sort-rule 과 같습니다 (10자)\n' });
    assert.ok(r.calls.includes('sort-rule-to-gas.mjs'), '하위검사를 안 불렀습니다');
    assert.ok(r.text.includes('· ○ gas 의 갈래 규칙이 sort-rule 과 같습니다 (10자)'), r.text);
    assert.strictEqual(r.exitCode, null, r.text);
  }],
  ['gas/wage.js 가 있고 다르면 여전히 실패합니다', () => {
    const r = run({ wageExists: true, sortRule: () => {
      const e = new Error('Command failed'); e.status = 1; e.stdout = '';
      e.stderr = '✗ gas 의 갈래 규칙이 sort-rule 과 다릅니다 (5자 ↔ 10자)\n   node tools/sort-rule-to-gas.mjs 를 돌려 다시 구우세요\n';
      throw e;
    } });
    assert.ok(r.calls.includes('sort-rule-to-gas.mjs'), '하위검사를 안 불렀습니다');
    assert.strictEqual(r.exitCode, 1, r.text);
    assert.ok(r.text.includes('✗ ' + 갈래말), r.text);
    assert.ok(r.text.includes('(gas 의 갈래 규칙이 sort-rule 과 다릅니다 (5자 ↔ 10자))'), r.text);
  }],
];

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('○ ' + name); }
  catch (e) { fail++; console.log('✗ ' + name + '\n  ' + String(e.message).split('\n').join('\n  ')); }
}
console.log(fail ? '\n실패 ' + fail + ' / ' + tests.length : '\n모두 통과 ' + tests.length);
process.exit(fail ? 1 : 0);
