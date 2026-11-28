/* 릴스 크론 로그(log/reels.log)의 끝 줄을 찍습니다 — 원격 할일 log-tail (2026-11-26 · 자동 올리기가 왜 안 올렸는지 보려고)
   읽기만 합니다. 열쇠는 run.mjs 가 적을 때 이미 가립니다. 「카드자동·건너뜀·올렸습니다·✗」 줄만 골라 150줄까지 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const f = path.join(ROOT, 'log', 'reels.log');
if (!fs.existsSync(f)) { console.log('log/reels.log 가 없습니다'); process.exit(0); }
const 줄 = fs.readFileSync(f, 'utf8').split('\n').slice(-1500);
const 볼 = 줄.filter((l) => /카드자동|건너뜀|올렸습니다|✗|후보 \d|대상 \d|릴스 대상|Error|못 /.test(l) && !/MODULE_TYPELESS|Reparsing|eliminate|trace-warnings/.test(l));
console.log(`log/reels.log 끝 1500줄 가운데 고른 ${볼.length}줄 (끝 150줄)`);
for (const l of 볼.slice(-150)) console.log(l.slice(0, 260));
/* 댓글 → DM 로그 끝 (2026-11-28 · 「왜 이렇게 느려」 — 댓글 단 때와 보낸 때를 견주려고) */
const d = path.join(ROOT, 'log', '댓글링크.log');
if (fs.existsSync(d)) { console.log('\n── log/댓글링크.log 끝 60줄 ──'); for (const l of fs.readFileSync(d, 'utf8').split('\n').filter(Boolean).slice(-60)) console.log(l.slice(0, 300)); }
