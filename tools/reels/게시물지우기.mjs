/* 우리가 올린 게시물 하나를 지웁니다 — 원격 delete-post <게시물ID> (2026-11-18 세중님 「무음 스토리를 소리 있는 판으로」)

   node tools/reels/게시물지우기.mjs <게시물ID>            마른 실행 — 지울 대상만 찍음
   node tools/reels/게시물지우기.mjs <게시물ID> --실행     지움

   ★ 울타리 — log/릴스_발행기록.jsonl 에 「성공」으로 적힌(= 우리가 올린) 게시물 ID 만 지웁니다. 남의 것·모르는 ID 는 거절 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, 게시물지우기 } from './ig.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 발행기록파일 = path.join(여기, '..', '..', 'log', '릴스_발행기록.jsonl');
const id = process.argv[2];
if (!/^[0-9]{6,30}$/.test(id || '')) { console.error('게시물ID(숫자)가 필요합니다'); process.exit(2); }
const 줄들 = fs.existsSync(발행기록파일) ? fs.readFileSync(발행기록파일, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
const 그것 = 줄들.find((x) => x.결과 === '성공' && String(x.게시물ID) === id);
if (!그것) { console.error(`✗ 거절 — ${id} 는 발행기록에 「성공」으로 없습니다 (우리가 올린 것만 지웁니다)`); process.exit(1); }
console.log(`대상 ${id} · ${그것.기관 || ''} · ${그것.길 || ''} · ${String(그것.때 || '').slice(0, 16)} · ${그것.게시물주소 || ''}`);
if (!process.argv.includes('--실행')) { console.log('마른 실행 — 지우지 않았습니다'); process.exit(0); }
const r = await 게시물지우기(env(), id);
fs.appendFileSync(발행기록파일, JSON.stringify({ 때: new Date().toISOString(), 결과: r.ok ? '지움' : '못 지움', 게시물ID: id, 응답: r.응답, 길: '손으로 지움(원격)' }) + '\n');
console.log(r.ok ? `● 지웠습니다 — ${id}` : `✗ 못 지웠습니다 — ${r.응답}`);
process.exit(r.ok ? 0 : 1);
