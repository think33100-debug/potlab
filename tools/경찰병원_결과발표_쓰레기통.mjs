/* 경찰병원 「최종합격자 발표」 공고를 쓰레기통으로 (2026-10-19 세중님 1번 승인)
 *
 *   node tools/경찰병원_결과발표_쓰레기통.mjs          무엇을 할지만
 *   node tools/경찰병원_결과발표_쓰레기통.mjs --진짜   보냅니다
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * CLAUDE.md 15절 — 「결과 발표 공고는 회원에게 보여주지 않습니다」.
 * 그런데 이 공고가 **보류함에 있었습니다.**
 *
 *   DB 제목   「2026년 제6회 경찰병원 공무직[무기계약직 및 기간제...」  ← 잘림
 *   원문 제목 「2026년 제6회 경찰병원 공무직[무기계약직 및 기간제근로자]채용
 *              **최종합격자 발표 공고**」                      (2026-10-19 확인)
 *
 * 게시판 목록이 제목을 자르고 「...」 을 붙여서, 제목 거르기(「합격자|발표|결과」)가
 * **잘린 뒤의 글자를 못 봤습니다.** 뿌리는 docs/제목잘림_1019.md 에 적었습니다.
 */
import fs from 'node:fs';

const 진짜 = process.argv.includes('--진짜');
const ID = 'HS1401157550';
const 왜 = '결과 발표 — 원문 제목이 「2026년 제6회 경찰병원 공무직[무기계약직 및 '
  + '기간제근로자]채용 최종합격자 발표 공고」 입니다 (2026-10-19 원문 확인). '
  + '목록이 제목을 잘라 거르기가 못 봤습니다';

const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_KEY;
const SEC = cfg.COLLECT_KEY_HS3;
if (!U || !K || !SEC) { console.error('✗ 열쇠가 없습니다 (서버에서)'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };

const 전 = await fetch(U + '/rest/v1/job_posts?id=eq.' + ID
  + '&select=id,org_name,title,hidden,hold,hidden_why', { headers: H });
const j = (await 전.json())[0];
if (!j) { console.error('✗ 그 공고가 없습니다'); process.exit(1); }
console.log('지금 — ' + j.org_name + ' | ' + j.title);
console.log('  hidden ' + j.hidden + ' · hold ' + j.hold + ' · 까닭 ' + (j.hidden_why || '(없음)'));
console.log('\n보낼 곳 — 쓰레기통 (hidden=true · hold=false)');
console.log('까닭 — ' + 왜);

if (!진짜) { console.log('\n[마른] 아무것도 안 바꿉니다 — 보내려면 --진짜'); process.exit(0); }

const r = await fetch(U + '/rest/v1/rpc/rejudge_hold_apply', {
  method: 'POST', headers: H,
  body: JSON.stringify({ p_secret: SEC, p_show: [], p_hide: [ID], p_why: 왜 }),
});
const t = await r.text();
if (!r.ok) { console.error('\n✗ rejudge_hold_apply ' + r.status + ' · ' + t.slice(0, 250)); process.exit(1); }
console.log('\n창구 답 — ' + t.slice(0, 220));
