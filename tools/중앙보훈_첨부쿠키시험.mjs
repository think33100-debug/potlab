/* 중앙보훈 첨부를 **쿠키를 들고** 받으면 되는지 두 걸음으로 확인합니다
 *   (2026-10-19 세중님 5번 · 고치기 전에 근거 — 지침 1·2절)
 *
 *   node tools/중앙보훈_첨부쿠키시험.mjs
 *
 * ① 상세 쪽을 열어 `set-cookie` 와 `fn_fileDownload('<fileKey>','<sysId>')` 를 집습니다
 * ② 같은 쿠키로 `/common/nttFileDownload.do?fileKey=…&bbsSysId=…` 를 받습니다
 * ③ 쿠키 **없이** 한 번 더 받아 견줍니다 (0바이트가 맞는지)
 *
 * 2026-10-14 에 playwright 로 확인한 것을 **맨손 fetch 두 걸음으로** 다시 재는
 * 것입니다 — 서버에 playwright 를 안 깔기로 했으니(2026-10-18 세중님 5번)
 * 수집기가 쓸 수 있는 길인지 봐야 합니다.
 */
const 목록 = 'https://www.bohun.or.kr/seoul/na/ntt/selectNttList.do?mi=32253&bbsId=1158';
const 상세꼴 = (n) => 'https://www.bohun.or.kr/seoul/na/ntt/selectNttInfo.do?mi=32253&nttSn=' + n;
const 머리 = { 'User-Agent': 'Mozilla/5.0 (compatible; potjob/1.0)', 'Accept-Language': 'ko' };

/* set-cookie 를 쿠키 머리로 — 이름=값 만 모읍니다 */
const 쿠키모으기 = (res, 전 = '') => {
  const 들 = (res.headers.getSetCookie?.() || []).map((s) => s.split(';')[0]);
  const 표 = new Map(전 ? 전.split('; ').map((s) => [s.split('=')[0], s]) : []);
  for (const c of 들) 표.set(c.split('=')[0], c);
  return [...표.values()].join('; ');
};

console.log('① 목록을 엽니다 — ' + 목록);
const r1 = await fetch(목록, { headers: 머리, signal: AbortSignal.timeout(25000) });
let 쿠키 = 쿠키모으기(r1);
const 목록글 = await r1.text();
console.log('   HTTP ' + r1.status + ' · ' + 목록글.length + '자 · 쿠키 '
  + (쿠키 ? 쿠키.replace(/=[^;]*/g, '=‹가림›') : '**없음**'));

/* 목록에서 data-id(nttSn) 를 집습니다 */
const 번호들 = [...목록글.matchAll(/data-id="(\d+)"/g)].map((m) => m[1]);
console.log('   공고 번호 ' + 번호들.length + '개 — 앞 5개 ' + 번호들.slice(0, 5).join(' '));
if (!번호들.length) { console.error('✗ 목록에서 번호를 못 집었습니다 — 멈춥니다'); process.exit(1); }

/* 첨부가 있는 상세를 찾습니다 (앞 6건까지만 — 두 번 실패하면 멈춥니다) */
let 찾음 = null; let 실패 = 0;
for (const n of 번호들.slice(0, 6)) {
  const r = await fetch(상세꼴(n), { headers: { ...머리, cookie: 쿠키 }, signal: AbortSignal.timeout(25000) });
  쿠키 = 쿠키모으기(r, 쿠키);
  const 글 = await r.text();
  const 제목 = (글.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const m = 글.match(/fn_fileDownload\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
  console.log('\n② 상세 ' + n + ' — HTTP ' + r.status + ' · ' + 글.length + '자 · '
    + 제목.replace(/\s+/g, ' ').slice(0, 40));
  if (!m) { 실패++; console.log('   첨부 함수 호출이 없습니다'); if (실패 >= 2 && !찾음) continue; continue; }
  console.log('   ★ fn_fileDownload(\'' + m[1] + '\', \'' + m[2] + '\')');
  찾음 = { n, fileKey: m[1], sysId: m[2] };
  break;
}
if (!찾음) { console.error('\n✗ 앞 6건에 첨부가 없습니다 — 멈춥니다 (지침: 두 번 실패하면 멈춤)'); process.exit(1); }

const 파일 = 'https://www.bohun.or.kr/common/nttFileDownload.do?fileKey='
  + encodeURIComponent(찾음.fileKey) + '&bbsSysId=' + encodeURIComponent(찾음.sysId);

/* 앞 글자를 봅니다 — PDF 는 %PDF-, hwpx 는 PK, HTML 이면 받은 게 아닙니다 (지침 5절) */
const 앞글자 = (buf) => {
  const b = Buffer.from(buf);
  const s = b.subarray(0, 5).toString('latin1');
  return s.startsWith('%PDF-') ? 'PDF' : s.startsWith('PK\u0003\u0004') ? 'zip/hwpx'
    : b.subarray(0, 8).toString('latin1') === '\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1' ? '옛 hwp/ole'
    : /^\s*<(!doctype|html)/i.test(b.subarray(0, 40).toString('utf8')) ? '**HTML (받은 게 아닙니다)**'
    : '모름 「' + s.replace(/[^\x20-\x7e]/g, '.') + '」';
};

for (const [이름, 머리들] of [['쿠키를 들고', { ...머리, cookie: 쿠키, referer: 상세꼴(찾음.n) }],
  ['쿠키 없이', 머리]]) {
  try {
    const r = await fetch(파일, { headers: 머리들, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    const b = await r.arrayBuffer();
    console.log('\n③ ' + 이름 + ' — HTTP ' + r.status + ' · **' + b.byteLength + '바이트** · ' + 앞글자(b));
    const cd = r.headers.get('content-disposition');
    if (cd) console.log('   content-disposition: ' + cd.slice(0, 120));
  } catch (e) {
    console.log('\n③ ' + 이름 + ' — ✗ ' + String(e.message).slice(0, 60));
  }
}
