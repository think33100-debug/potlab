/* 릴스 크론 줄에 --카드자동 을 켜고 끕니다 (2026-11-26 세중님 「인스타 올려 라고 안 해도 올라가게 하라고 · 너가 봤을 때 확실한 공고는」)
 *
 *   node tools/reels/크론카드자동.mjs            지금 크론 줄을 보여 주기만 (아무것도 안 바꿈)
 *   node tools/reels/크론카드자동.mjs --켜기      `run.mjs --메일` 줄에 `--카드자동` 을 붙임
 *   node tools/reels/크론카드자동.mjs --끄기      `--카드자동` 을 뗌 (되돌리기)
 *
 * 「확실한 공고」 = 밤마다 원문 대조(job_posts.뽑은값.사진대조.통과 = true)를 통과한 공고 — run.mjs 의 --카드자동 이 그것만 올립니다.
 * 릴스·스토리는 그대로 메일로만 · 게시 금지·마감·원문 다시 보기는 올리기.mjs 가 올리기 직전에 다시 봅니다.
 *
 * 지키는 선 (지침 8-15 · 8-19)
 *   · 바꿀 줄이 **딱 하나**일 때만 바꿉니다. 0줄·2줄 이상이면 아무것도 안 바꾸고 줄을 찍습니다
 *   · 바꾸기 전 크론 전체를 ~/되돌림/crontab_<때>.txt 에 남깁니다 (되돌리기: crontab ~/되돌림/crontab_<때>.txt)
 *   · 줄 하나 안의 글자만 바꿉니다 — 다른 줄은 글자까지 그대로
 *   · 바꾼 뒤 crontab -l 을 다시 읽어 그 줄이 정말 바뀌었는지 봅니다 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 켜기 = process.argv.includes('--켜기');
const 끄기 = process.argv.includes('--끄기');
if (켜기 && 끄기) { console.error('--켜기 와 --끄기 는 함께 못 씁니다'); process.exit(2); }

function 크론읽기() {
  const r = spawnSync('crontab', ['-l'], { encoding: 'utf8' });
  if (r.status !== 0) { console.error('✗ crontab -l 실패 — ' + String(r.stderr || '').slice(0, 200)); process.exit(1); }
  return r.stdout;
}
export const 릴스줄인가 = (l) => !/^\s*#/.test(l) && /tools\/reels\/run\.mjs/.test(l) && /--메일/.test(l);
export const 붙이기 = (l) => (l.includes('--카드자동') ? l : l.replace('--메일', '--메일 --카드자동'));
export const 떼기 = (l) => l.replace(/\s--카드자동/g, '');

const 글 = 크론읽기();
const 줄들 = 글.split('\n');
const 찾은 = 줄들.map((l, i) => [i, l]).filter(([, l]) => 릴스줄인가(l));
console.log(`릴스 크론 줄 ${찾은.length}개`);
for (const [, l] of 찾은) console.log('  ' + l);
if (!켜기 && !끄기) { console.log('\n(보기만 — 바꾸려면 --켜기 또는 --끄기)'); process.exit(0); }
if (찾은.length !== 1) { console.error(`✗ 안 바꿉니다 — 바꿀 줄이 딱 하나여야 합니다 (지금 ${찾은.length}개)`); process.exit(1); }

const [i, 전] = 찾은[0];
const 후 = 켜기 ? 붙이기(전) : 떼기(전);
if (후 === 전) { console.log(`\n바꿀 것 없음 — 이미 ${켜기 ? '켜져' : '꺼져'} 있습니다`); process.exit(0); }

const 터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(터, { recursive: true });
const 때 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '_');
const 되돌림 = path.join(터, `crontab_${때}.txt`);
fs.writeFileSync(되돌림, 글);

줄들[i] = 후;
const w = spawnSync('crontab', ['-'], { input: 줄들.join('\n'), encoding: 'utf8' });
if (w.status !== 0) { console.error('✗ crontab 쓰기 실패 — 바뀐 것 없음 · ' + String(w.stderr || '').slice(0, 200)); process.exit(1); }

const 다시 = 크론읽기().split('\n');
const 같은줄수 = 다시.length === 줄들.length;
const 맞음 = 다시[i] === 후 && 같은줄수 && 다시.every((l, k) => k === i || l === 줄들[k]);
console.log(`\n전  ${전}\n후  ${후}`);
console.log(`되돌림  ${되돌림}  (되돌리기: crontab ${되돌림})`);
console.log(맞음 ? `○ ${켜기 ? '켰습니다' : '껐습니다'} — 다시 읽어 그 줄만 바뀐 것을 확인` : '✗ 다시 읽은 크론이 기대와 다릅니다 — 되돌림 파일로 되돌리세요');
process.exit(맞음 ? 0 : 1);
