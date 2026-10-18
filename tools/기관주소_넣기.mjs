/* 확인한 기관 주소를 「기관주소」 표에 적습니다 (2026-10-19 세중님 3번)
 *
 *   node tools/기관주소_넣기.mjs          무엇을 적을지만 (기본)
 *   node tools/기관주소_넣기.mjs --진짜   적습니다
 *
 * ★ **근거는 실제로 받은 것만 적습니다** — HTTP 코드·바이트·제목.
 *   짐작으로 쓴 줄은 하나도 없습니다 (지침 3절).
 *   받아 본 기록은 docs/주소_열어본근거_1018.md · docs/데이터주소_찾은것_1019.md
 */
import fs from 'node:fs';

const 진짜 = process.argv.includes('--진짜');

const 줄 = [
  { 이름: '의료법인갑을의료재단 갑을장유병원',
    주소: 'https://www.kbhospital.com/',
    근거: 'HTTP 200 · 1,829바이트 · 제목 「갑을장유병원」 (2026-10-18 이 컴퓨터에서 받음). hira_org 값 「www.kbhospital.com/」 은 스킴이 빠져 new URL() 이 터집니다',
    메모: '스킴만 붙이면 됩니다' },

  { 이름: '포항성모병원',
    주소: 'https://www.pohangsmh.co.kr/',
    근거: 'HTTP 200 · 73,041바이트 · 제목 「포항성모병원」 (2026-10-18). hira_org 값 「www.pohangsmh.co.kr/」 은 스킴이 빠졌습니다',
    메모: '스킴만 붙이면 됩니다' },

  { 이름: '세종여주병원',
    주소: 'http://세종여주병원.com',
    근거: 'HTTP 200 · 986바이트 · 제목 「세종여주병원」 (2026-10-18). https 는 CERT_HAS_EXPIRED — 인증서가 만료됐습니다. 한글 도메인은 fetch 가 퓨니코드로 잘 바꿉니다',
    메모: 'https 가 아니라 http 입니다' },

  { 이름: '화성유일병원',
    주소: 'http://www.hsyuil.kr/',
    근거: 'HTTP 200 · 39,128바이트 · 제목 「화성유일병원」 (2026-10-18). https 는 ERR_TLS_CERT_ALTNAME_INVALID — 인증서 이름이 안 맞습니다',
    메모: 'https 가 아니라 http 입니다' },

  { 이름: '학교법인 울산공업학원 울산대학교병원',
    주소: 'https://www.uuh.ulsan.kr/',
    근거: 'HTTP 200 · 16,118바이트 · 제목 「울산대학교병원」 · /intro/ 로 보냅니다 (2026-10-19 브라우저로 확인). hira_org 값 「http://www.uuh.ulsan.kr/main/main.asp」 는 **에러 페이지**입니다 — 「접속하는 페이지가 없는 경우」. http 로는 소켓이 끊깁니다',
    메모: '채용은 딴 호스트입니다 — https://recruit.uuh.ulsan.kr:8443/uuhrecruit/ (Vaadin 이라 못 긁습니다 · 손확인)' },

  /* 아래 둘은 **주소를 비웁니다** — 열 수 없다고 확인한 것도 기록입니다.
     비워 두면 읽는 쪽이 심평원 값으로 돌아가므로, 「열 수 없다」를 남겨야
     다시 두드리지 않습니다 */
  { 이름: '서광병원', 주소: '',
    근거: 'http·https 둘 다 ENOTFOUND (느슨한 TLS 로도 같음 · 2026-10-18). **도메인이 사라졌습니다.** 새 주소를 짐작하지 않습니다',
    메모: '손으로 확인할 곳' },

  { 이름: '정읍한국병원', 주소: '',
    근거: 'https 는 ERR_SSL_DH_KEY_TOO_SMALL · http 는 302 로 그 https 로 보냅니다 (2026-10-18). 사이트 TLS 가 낡아 Node 가 거부합니다 — 브라우저로는 열립니다',
    메모: '손으로 확인할 곳' },
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
const K = cfg.SUPABASE_SERVICE_KEY;
const SEC = cfg.COLLECT_KEY_HS3;
if (!U || !K || !SEC) {
  console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY / COLLECT_KEY_HS3 가 있어야 합니다 (서버에서 돌리십시오)');
  process.exit(1);
}

console.log('「기관주소」 에 적을 ' + 줄.length + '곳\n');
for (const [i, x] of 줄.entries()) {
  console.log('  ' + (i + 1) + '. ' + x.이름);
  console.log('     주소 ' + (x.주소 || '(비움 — 열 수 없다고 확인)'));
  console.log('     근거 ' + x.근거.slice(0, 120));
}
console.log('\n열 수 있는 곳 ' + 줄.filter((x) => x.주소).length
  + ' · 열 수 없다고 확인한 곳 ' + 줄.filter((x) => !x.주소).length);

if (!진짜) { console.log('\n[마른] 아무것도 안 적습니다 — 적으려면 --진짜'); process.exit(0); }

const r = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('기관주소적기'), {
  method: 'POST',
  headers: { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_secret: SEC, p_rows: 줄.map((x) => ({ ...x, 누가: '조사 2026-10-18~19' })) }),
});
const t = await r.text();
if (!r.ok) { console.error('\n✗ 기관주소적기 ' + r.status + ' · ' + t.slice(0, 250)); process.exit(1); }
console.log('\n적었습니다 — ' + t.slice(0, 200));
