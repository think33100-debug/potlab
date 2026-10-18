/* `robots.txt` 가 **전면 금지**인 1층 기관을 「손으로 확인할 곳」 목록에 남깁니다
 *   (2026-10-18 세중님 8번 — 「긁지 않음. 「손으로 확인할 곳」 목록에 ·
 *    관리자 화면에서 볼 수 있게」)
 *
 *   node tools/robots금지_손확인에.mjs --마른    무엇을 남길지만 보여줍니다 (기본)
 *   node tools/robots금지_손확인에.mjs --진짜    남깁니다
 *
 * ── 왜 ───────────────────────────────────────────────
 * 2026-10-18 사각지대 훑기에서 **게시판 주소를 찾았는데도 못 쓰는 곳**이 나왔습니다 —
 * `robots.txt` 의 `User-agent: *` 쪽에 `Disallow: /` 가 있는 곳입니다.
 * 긁지 않습니다. 대신 **빠지지 않게** 목록에 남깁니다 —
 * CLAUDE.md 「안 되는 곳은 「손으로 확인할 곳」 목록에 넣고 마지막 확인일을 남긴다.
 * **빠지지 않는 것이 자동화보다 중요하다**」
 *
 * ── 1층만 넣습니다 ──────────────────────────────────
 * 훑기에서 robots 전면 금지가 6곳이었지만 **원광대학교전주한방병원은 종별이
 * 한방병원·설립이 학교법인(민간)** 이라 1층이 아닙니다 (docs/1층분모_섞인것_1018.md).
 * 그래서 **5곳**만 넣습니다 — 넣으면 안 되는 곳을 숙제로 세우지 않기 위해서입니다.
 *
 * 창구는 `hand_check_put` 입니다 (tools/막힌3곳.mjs 가 쓰는 것과 같은 자리 · 지침 6절).
 * 표를 직접 쓰지 않습니다. 관리자 화면 `/admin/hand` 에서 보입니다.
 */
import fs from 'node:fs';

const 진짜 = process.argv.includes('--진짜');

/* 2026-10-18 사각지대 훑기에서 **실제로 robots.txt 를 받아** 확인한 곳입니다.
   짐작이 아닙니다 — `User-agent: *` 쪽에 `Disallow: /` 가 있었습니다 */
const 곳들 = [
  { 이름: '목포한국병원', 갈래: '종합병원', 집: 'http://www.hank.co.kr',
    게시판: '/pages/job/CV_list.php' },
  { 이름: '의료법인한국의료재단 순천한국병원', 갈래: '종합병원', 집: 'http://www.hankook.or.kr',
    게시판: '/Module/Board/Board.asp?ModuleID=2' },
  { 이름: '의료법인명지의료재단명지병원', 갈래: '종합병원', 집: 'https://mjh.or.kr',
    게시판: '(JS 로 만드는 쪽 — 아직 못 찾음)' },
  { 이름: '의료법인 박애의료재단 박애병원', 갈래: '종합병원', 집: 'http://www.bagaehospital.com',
    게시판: '(JS 로 만드는 쪽 — 아직 못 찾음)' },
  { 이름: '의료법인삼백의료재단상주성모병원', 갈래: '종합병원', 집: 'http://www.ssmh.co.kr',
    게시판: '(JS 로 만드는 쪽 — 아직 못 찾음)' },

  /* 2026-10-18 세중님 9번 — 주소를 **실제로 열어 보고** 두 번 실패한 곳입니다
     (근거 docs/주소_열어본근거_1018.md · 이 컴퓨터와 서버 양쪽에서 안 열립니다) */
  { 이름: '서광병원', 갈래: '종합병원', 집: 'http://www.suhgwang2010.com',
    게시판: '(주소를 못 엶)',
    왜: '도메인이 사라졌습니다 — http·https 둘 다 ENOTFOUND. 새 주소를 짐작하지 않습니다' },
  { 이름: '정읍한국병원', 갈래: '종합병원', 집: 'https://www.jehk.kr',
    게시판: '(주소를 못 엶)',
    왜: '사이트 TLS 가 낡아 Node 가 거부합니다 (ERR_SSL_DH_KEY_TOO_SMALL · http 는 https 로 302). 브라우저로는 열립니다' },
];

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
const AK = cfg.SUPABASE_ANON_KEY;
const SEC = cfg.COLLECT_KEY_HS3;
if (!U || !AK || !SEC) {
  console.error('✗ SUPABASE_URL / SUPABASE_ANON_KEY / COLLECT_KEY_HS3 가 있어야 합니다');
  console.error('  (COLLECT_KEY_HS3 는 **서버 .env 에만** 있습니다 — 서버에서 돌리십시오)');
  process.exit(1);
}

const 줄 = 곳들.map((x) => ({
  이름: x.이름.slice(0, 20),
  결과: x.왜 ? '주소를 못 엶 — 사람이 봐야 합니다' : 'robots 전면 금지 — 긁지 않음',
  공고줄: 0,
  까닭: (x.왜 || 'robots.txt 의 User-agent: * 에 Disallow: /') + ' · 게시판 ' + x.게시판,
  어디서: cfg.POTJOB_WHERE || '(모름)',
}));

console.log('「손으로 확인할 곳」 에 남길 ' + 줄.length + '곳 (1층 종합병원만)\n');
for (const [i, x] of 곳들.entries()) {
  console.log('  ' + (i + 1) + '. ' + x.이름 + '  [' + x.갈래 + ']  '
    + (x.왜 ? '← 주소를 못 엶' : '← robots 전면 금지'));
  console.log('     집 ' + x.집);
  console.log('     게시판 ' + x.게시판);
  if (x.왜) console.log('     까닭 ' + x.왜);
}
console.log('\n★ 원광대학교전주한방병원은 **넣지 않습니다** — 종별 한방병원·설립 학교법인(민간)');
console.log('  이라 1층이 아닙니다. 넣으면 안 되는 곳을 숙제로 세우게 됩니다.');

if (!진짜) {
  console.log('\n[마른] 아무것도 안 남깁니다 — 남기려면 --진짜');
  process.exit(0);
}

const r = await fetch(U + '/rest/v1/rpc/hand_check_put', {
  method: 'POST',
  headers: { apikey: AK, Authorization: 'Bearer ' + AK, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_secret: SEC, p_source: 'HS3', p_rows: 줄 }),
});
const t = await r.text();
if (!r.ok) { console.error('\n✗ hand_check_put ' + r.status + ' · ' + t.slice(0, 220)); process.exit(1); }
console.log('\n남겼습니다 — ' + t.slice(0, 220));
console.log('관리자 화면 /admin/hand 에서 보입니다');
