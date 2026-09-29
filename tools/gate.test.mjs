/* 맛보기 규칙 시험 — node tools/gate.test.mjs
 *
 * 2026-09-29 에 관리자 계정으로 공고를 보면 「3분 설문 마치고 전부 보기」가
 * 떴습니다. `gateOf` 가 관리자를 안 보고 `profiles.survey_at` 만 봤기 때문입니다.
 * 그 자리를 지키는 시험입니다.
 *
 * web/app/gate.tsx 는 'use client' 라 여기서 못 가져옵니다.
 * 그래서 그 함수의 **알맹이를 파일에서 뽑아** 돌립니다 —
 * 베껴 쓰면 두 벌이 갈라집니다. (이 프로젝트에서 이미 겪은 일)
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 글 = fs.readFileSync(path.join(여기, '..', 'web', 'app', 'gate.tsx'), 'utf8');

const m = 글.match(/export function gateOf\(([\s\S]*?)\n\}/);
assert.ok(m, 'gate.tsx 에서 gateOf 를 못 찾았습니다 — 이름이 바뀌었나요');
/* 타입 표기를 걷어내고 그대로 돌립니다 */
const 몸 = ('function gateOf(' + m[1] + '\n}')
  .replace(/: Who|: 설문상태|: boolean/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const gateOf = new Function(몸 + '; return gateOf;')();

/* ── 관리자 ── */
const 관 = gateOf('회원', '안마침', true);
assert.strictEqual(관.full, true, '관리자는 설문을 안 마쳤어도 전부 봅니다');
assert.strictEqual(관.모름, false, '관리자에게 빈 자리를 보이면 안 됩니다');

/* ── 설문을 마친 회원 ── */
assert.strictEqual(gateOf('회원', '마침', false).full, true);

/* ── 가입하다 만 회원 → 맛보기 + 설문 권하기 ── */
const 반 = gateOf('회원', '안마침', false);
assert.strictEqual(반.full, false);
assert.strictEqual(반.회원, true);
assert.strictEqual(반.href, '/welcome');

/* ── 비회원 → 맛보기 + 가입 권하기 ── */
const 손 = gateOf('손님', '안마침', false);
assert.strictEqual(손.full, false);
assert.strictEqual(손.회원, false);
assert.strictEqual(손.href, '/login');

/* ── 아직 확인 중 → 자르지도 권하지도 않습니다 ── */
assert.strictEqual(gateOf('모름', '모름', false).모름, true);
/* 다만 관리자인 것을 이미 알면 기다리지 않고 다 보여 줍니다 */
assert.strictEqual(gateOf('모름', '모름', true).모름, false);

console.log('○ 맛보기 규칙 다 맞습니다 (관리자는 언제나 전부 봅니다)');
