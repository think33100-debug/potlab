/* 공동 채용관에서 **거르기로 버리는 줄**이 있나 전수로 훑습니다
 * (2026-10-14 · 읽기만 · DB 를 안 건드립니다).
 *
 *   node tools/채용관_버리는것.mjs            마이다스 채용관 전부
 *   node tools/채용관_버리는것.mjs --쉼 1500   곳 사이 쉬는 시간(ms)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 2026-10-14 에 세브란스 신촌·강남이 「공고 0건」 이었습니다. 새 사이트가
 * 없어서가 아니라 **이미 받던 목록을 cls: '용인' 으로 걸러 버리고** 있었기
 * 때문입니다. 용인세브란스 cfg 의 note 에 그 사실이 적혀 있었는데도
 * 신촌·강남 cfg 를 안 만든 것입니다.
 *
 * 같은 일이 다른 곳에도 있는지 **기다리지 않고 셉니다** (세중님 지시).
 *
 * ── 어떻게 ───────────────────────────────────────────────────
 * 한 호스트를 쓰는 cfg 를 모아서,
 *   ① 거르는 칸을 **다 떼고** 목록을 한 번 받습니다 (요청은 호스트당 한 번)
 *   ② 그 호스트의 cfg 들이 **각자 걸러 가는 줄**을 표시합니다
 *   ③ **아무 cfg 도 안 집어 가는 줄**을 cls 별로 묶어 보여줍니다
 * ③ 이 비어 있어야 「버리는 것이 없다」 입니다.
 *
 * 거르기 규칙은 `tools/hosp/sites.mjs` 가 쓰는 것과 **같은 뜻**으로 봅니다 —
 *   clsTitle  제목 **또는** recruitClassName 에 걸리면 집어 감
 *   cls       recruitClassName 에 걸리면 집어 감
 *   only/not  제목에 그 말이 있나/없나
 * (지침 6절 — 규칙을 두 벌로 만들지 않으려고 sites.mjs 의 뜻을 그대로 옮깁니다.
 *  sites.mjs 가 바뀌면 여기도 함께 고쳐야 합니다. 이 도구는 **조사용**입니다)
 *
 * ── 마이다스 아닌 곳 ─────────────────────────────────────────
 * `html` 갈래는 곳마다 주소가 달라 「한 목록을 나눠 쓰는」 문제가 없습니다.
 * 그래도 `only`·`not`·`skip` 이 걸린 html cfg 는 **목록만** 적어 둡니다 —
 * 사람이 눈으로 볼 자리입니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 사이트줄 } from './hosp/sites.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 쉼ms = Number(argv.includes('--쉼') ? argv[argv.indexOf('--쉼') + 1] : 1500) || 1500;
const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

/* 수집기와 같은 목록을 씁니다 — 구운 것 + cfgs 에만 있는 곳 */
function 사이트들() {
  const S = JSON.parse(fs.readFileSync(path.join(여기, 'hosp', 'hosp-sites.json'), 'utf8')).사이트;
  const 이름 = new Set(S.map((x) => x.name));
  const 터 = path.join(여기, 'hosp', 'cfgs');
  for (const f of fs.readdirSync(터).filter((x) => x.endsWith('.json')).sort()) {
    const c = JSON.parse(fs.readFileSync(path.join(터, f), 'utf8'));
    if (!c || !c.name || 이름.has(c.name)) continue;
    if (!c.type) c.type = 'html';
    이름.add(c.name); S.push(c);
  }
  return S;
}

/* sites.mjs 의 거르기 뜻을 그대로 */
function 집어가나(cfg, 줄) {
  const 제목 = String(줄.title || '');
  const cls = String(줄.cls || '');
  if (cfg.clsTitle && !new RegExp(cfg.clsTitle).test(cls + ' ' + 제목)) return false;
  if (cfg.cls && !new RegExp(cfg.cls).test(cls)) return false;
  if (cfg.only && !new RegExp(cfg.only).test(제목)) return false;
  if (cfg.not && new RegExp(cfg.not).test(제목)) return false;
  return true;
}

const 전부 = 사이트들();
const 마이다스 = 전부.filter((x) => x.type === 'appsite' || x.type === 'listjson');

const 호스트별 = {};
for (const s of 마이다스) (호스트별[s.host] ||= []).push(s);

console.log('마이다스 채용관 ' + 마이다스.length + '곳 · 호스트 ' + Object.keys(호스트별).length + '개');
console.log('');

const 버리는곳 = [];
for (const [host, 것들] of Object.entries(호스트별)) {
  const 터 = { ...것들[0] };
  delete 터.cls; delete 터.clsTitle; delete 터.only; delete 터.not;
  const g = await 사이트줄(터);
  await 잠깐(쉼ms);
  if (g.err) { console.log('✗ ' + host + ' — 못 받았습니다: ' + g.err); continue; }

  const 안집힌것 = g.rows.filter((r) => !것들.some((c) => 집어가나(c, r)));
  const 표시 = host.replace(/^https?:\/\//, '').padEnd(32);
  if (!안집힌것.length) {
    console.log('○ ' + 표시 + '접수중 ' + String(g.rows.length).padStart(3) + '건 · cfg '
      + 것들.length + '곳 — 버리는 줄 없습니다');
    continue;
  }
  const cls별 = {};
  for (const r of 안집힌것) (cls별[r.cls || '(빈칸)'] ||= []).push(r);
  console.log('★ ' + 표시 + '접수중 ' + String(g.rows.length).padStart(3) + '건 · cfg '
    + 것들.length + '곳 — **안 집히는 줄 ' + 안집힌것.length + '건**');
  console.log('     cfg — ' + 것들.map((c) => c.name + (c.cls ? ' [cls ' + c.cls + ']' : '')
    + (c.clsTitle ? ' [clsTitle ' + c.clsTitle + ']' : '')
    + (c.only ? ' [only ' + c.only + ']' : '')
    + (c.not ? ' [not ' + c.not + ']' : '')).join(' / '));
  for (const [k, v] of Object.entries(cls별).sort((a, b) => b[1].length - a[1].length)) {
    console.log('     cls 「' + k + '」 ' + v.length + '건 — ' + String(v[0].title).replace(/\s+/g, ' ').slice(0, 52));
  }
  버리는곳.push({ host, 안집힌: 안집힌것.length, cls: Object.keys(cls별) });
}

console.log('');
console.log('━━ html 갈래에 거르기 칸이 걸린 곳 (사람이 볼 자리) ━━');
const html거르기 = 전부.filter((x) => x.type === 'html' && (x.only || x.not || x.clsTitle || x.cls));
if (!html거르기.length) console.log('  없습니다');
for (const c of html거르기) {
  console.log('  ' + c.name.slice(0, 34).padEnd(36)
    + ['cls', 'clsTitle', 'only', 'not'].filter((k) => c[k]).map((k) => k + ': ' + c[k]).join(' · '));
}

console.log('');
if (!버리는곳.length) {
  console.log('○ 마이다스 채용관에서 **버리는 줄이 없습니다.**');
} else {
  console.log('★ 버리는 줄이 있는 호스트 ' + 버리는곳.length + '개 — 위 cls 를 보고'
    + ' 우리 대상 병원이면 cfg 를 더하십시오');
  process.exitCode = 1;
}
