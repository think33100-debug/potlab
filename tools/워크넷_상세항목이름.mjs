/* 워크넷 **상세 응답의 항목 이름을 전부** 찍습니다 (지침 2·4절)
 *
 *   node tools/워크넷_상세항목이름.mjs [공고번호]
 *
 * 왜 — 「모집인원 항목이 있으면 쓰라」(2026-10-19 세중님 1번)는 지시에
 * 답하려면 **항목 이름 목록**이 있어야 합니다. 짐작하지 않습니다.
 */
import fs from 'node:fs';

const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const WK = cfg.WORK_KEY;
if (!WK) { console.error('✗ WORK_KEY 가 없습니다'); process.exit(1); }

const no = process.argv[2] || 'K180012610190008';
const u = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do'
  + '?authKey=' + encodeURIComponent(WK) + '&returnType=XML&callTp=D'
  + '&wantedAuthNo=' + encodeURIComponent(no) + '&infoSvc=VALIDATION';

const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
const t = await r.text();
console.log('공고번호 ' + no + ' · HTTP ' + r.status + ' · ' + t.length + '바이트\n');

/* 항목 이름 — 값이 있는 것과 빈 것을 갈라서 찍습니다 */
const 찬것 = []; const 빈것 = [];
/* ★ 안쪽 항목만 집습니다 — `([\s\S]*?)` 로 하면 `<wantedDtl>` 하나가
   문서를 통째로 먹고 끝나서 **0개**가 찍혔습니다 (2026-10-19 에 그랬습니다) */
for (const m of t.matchAll(/<([a-zA-Z][\w]*)>([^<]*)<\/\1>/g)) {
  const v = m[2].replace(/\s+/g, ' ').trim();
  if (v) 찬것.push([m[1], v]); else 빈것.push(m[1]);
}
console.log('── 값이 있는 항목 ' + 찬것.length + '개 ──');
for (const [k, v] of 찬것) console.log('  ' + k.padEnd(22) + v.slice(0, 70));
console.log('\n── 빈 항목 ' + 빈것.length + '개 ──\n  ' + 빈것.join(' · '));

/* ★ 모집인원으로 쓸 만한 이름이 있나 — 이름과 값을 함께 봅니다 */
const 인원말 = /(cnt|num|인원|person|recrut|recruit|empl.*no)/i;
const 후보 = [...찬것, ...빈것.map((k) => [k, '(빈 값)'])].filter(([k]) => 인원말.test(k));
console.log('\n── 모집인원 후보 ──');
console.log(후보.length ? 후보.map(([k, v]) => '  ' + k + ' = ' + v).join('\n') : '  없습니다');
