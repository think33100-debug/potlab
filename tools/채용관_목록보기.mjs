/* 공동 채용관의 **거르기 전 목록**을 원문으로 찍습니다
 * (2026-10-14 · 읽기만 · DB 를 안 건드립니다).
 *
 *   node tools/채용관_목록보기.mjs <사이트이름>        우리 설정에 있는 곳 (cls 를 떼고 봅니다)
 *   node tools/채용관_목록보기.mjs --host https://xxx.recruiter.co.kr --sn 4468 [--설정 A]
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 「대상인데 안 긁는 1층 병원」을 세어 보니 상급종합 12곳이 사각지대였고,
 * 그중 **세브란스(신촌)·강남세브란스**가 있었습니다. 그런데 우리 설정의
 * 용인세브란스 note 가 이미 이렇게 적고 있었습니다 —
 *
 *   「신촌·강남·용인 공고가 한 목록에 섞이며 제목 접두어
 *     [일반-신촌] [일반-강남] [용인] 으로 구분됨 → [용인] 만 골라 써야 함」
 *
 * 즉 **받아 오고는 있는데 cls: '용인' 으로 걸러 버리고** 있었습니다.
 * 자매 병원이 한 채용관을 쓰는 곳이 많으니(전남대·부민병원·전북대…),
 * 새 사이트를 찾기 전에 **이미 받는 목록에 그 병원 줄이 있나**를 먼저 봅니다
 * (지침 4절 — 「내가 이 자료를 전부 쓰고 있나」).
 *
 * 받는 길은 수집기와 같은 `사이트줄()` 입니다 (지침 12절).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 사이트줄 } from './hosp/sites.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 집기 = (이름) => { const i = argv.indexOf(이름); return i < 0 ? null : argv[i + 1]; };

let 터;
if (집기('--cfg')) {
  /* 새로 만든 cfg 를 **거르는 칸까지 그대로** 시험합니다 —
     「넣기 전에 뽑힌 줄을 본다」 (지침 12절) */
  const p = 집기('--cfg');
  터 = JSON.parse(fs.readFileSync(path.isAbsolute(p) ? p : path.join(여기, 'hosp', 'cfgs', p), 'utf8'));
  if (!터.type) 터.type = 'html';
  console.log('cfg 그대로 시험 — ' + 터.name + ' (' + 터.type + ' · ' + (터.host || 터.url) + ')');
  console.log('  거르는 칸 — ' + (['cls', 'clsTitle', 'only', 'not'].filter((k) => 터[k])
    .map((k) => k + ': ' + 터[k]).join(' · ') || '(없음)'));
  console.log('');
} else if (집기('--host')) {
  터 = { name: '(직접 준 것)', type: 'appsite', host: 집기('--host'),
         sn: Number(집기('--sn')), settingType: 집기('--설정') || 'A' };
} else {
  const 이름 = argv.find((x) => !x.startsWith('--'));
  if (!이름) { console.error('사이트 이름이나 --host 를 주십시오'); process.exit(1); }
  const S = JSON.parse(fs.readFileSync(path.join(여기, 'hosp', 'hosp-sites.json'), 'utf8')).사이트;
  const f = S.find((x) => x.name === 이름) || S.find((x) => x.name.includes(이름));
  if (!f) { console.error('설정에 없는 이름입니다: ' + 이름); process.exit(1); }
  /* 거르는 칸을 뗍니다 — 그래야 자매 병원 줄이 보입니다 */
  터 = { ...f }; delete 터.cls; delete 터.clsTitle; delete 터.only; delete 터.not;
  console.log('설정에서 가져온 곳 — ' + f.name + ' (' + f.type + ' · ' + (f.host || f.url) + ')');
  console.log('  떼고 본 칸 — ' + ['cls', 'clsTitle', 'only', 'not'].filter((k) => f[k])
    .map((k) => k + ': ' + f[k]).join(' · ') + (['cls', 'clsTitle', 'only', 'not'].some((k) => f[k]) ? '' : '(없음)'));
  console.log('');
}

const g = await 사이트줄(터);
if (g.err) { console.error('못 받았습니다 — ' + g.err); process.exit(1); }

console.log('받은 줄 ' + g.rows.length + '건');
console.log('raw(진단글) — ' + String(g.raw || '').slice(0, 300));
console.log('칸 이름 — ' + Object.keys(g.rows[0] || {}).join(' · '));
console.log('');

const 묶음 = {};
for (const r of g.rows) {
  const 앞 = (String(r.title).match(/^\s*\[([^\]]+)\]/) || [, '(접두어 없음)'])[1];
  (묶음[앞] ||= []).push(r);
}
console.log('제목 접두어별 —');
for (const [k, v] of Object.entries(묶음).sort((a, b) => b[1].length - a[1].length)) {
  console.log('  ' + (k + '              ').slice(0, 16) + String(v.length).padStart(3) + '건'
    + '   cls 값: ' + [...new Set(v.map((x) => x.cls || '(빈칸)'))].join(' / '));
}
console.log('');
console.log('cls 값별 —');
const c = {};
for (const r of g.rows) c[r.cls || '(빈칸)'] = (c[r.cls || '(빈칸)'] ?? 0) + 1;
for (const [k, v] of Object.entries(c).sort((a, b) => b[1] - a[1])) console.log('  ' + (k + '          ').slice(0, 12) + v + '건');
console.log('');
console.log('── 줄 전부 (제목 · cls · 접수) ──');
for (const r of g.rows) {
  console.log('  ' + String(r.title).replace(/\s+/g, ' ').slice(0, 62).padEnd(64)
    + '| ' + String(r.cls || '').padEnd(10)
    + '| ' + (r.from || '-') + ' ~ ' + (r.to || '-'));
}
