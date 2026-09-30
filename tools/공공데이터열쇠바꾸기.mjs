/* 공공데이터포털 인증키를 **쓰는 곳 전부** 한 번에 갈아끼웁니다 (2026-09-30).
 *
 *   node tools/공공데이터열쇠바꾸기.mjs            무엇이 바뀌는지 보여만 줍니다
 *   node tools/공공데이터열쇠바꾸기.mjs --바꾼다   진짜로 바꿉니다
 *
 * ── 왜 도구로 만드나 ─────────────────────────────────────────
 * 이 열쇠 하나가 **9곳**에서 쓰입니다. 손으로 고치면 반드시 하나를 빠뜨립니다.
 * 빠뜨린 한 곳은 조용히 403 을 받고, 그 수집기만 며칠 뒤에야 티가 납니다.
 *
 * ── 오늘 확인한 것 (2026-09-30, 응답 원문으로) ───────────────
 * · 이 API 들은 **Encoding 꼴(102자, %2B %2F %3D 가 섞인 것)** 만 받습니다.
 *   그대로 주소에 붙여야 합니다. encodeURIComponent 로 또 감싸면
 *   403 SERVICE_KEY_IS_NOT_REGISTERED_ERROR 「등록되지 않은 서비스키」 입니다.
 * · gas/wage.js 1464줄의 88자 열쇠는 **다른 열쇠**이고 죽어 있습니다
 *   (102자를 풀어도 88자와 안 맞습니다 — 지문이 다릅니다).
 *   그래서 이 도구는 그 자리도 새 열쇠로 덮습니다.
 *
 * ── 값은 한 글자도 안 찍습니다 ───────────────────────────────
 * 새 열쇠는 `.env.server` 의 `CLEANEYE_KEY=` 줄에서 읽습니다.
 * 화면에는 지문(sha256 앞 10자리)과 길이만 나옵니다.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const 진짜 = process.argv.includes('--바꾼다');
const 지문 = (v) => (v ? crypto.createHash('sha256').update(v).digest('hex').slice(0, 10) : '—');

/* ── ① 새 열쇠 읽기 ─────────────────────────────────────── */
const env읽기 = (f) => {
  const o = {};
  if (!fs.existsSync(f)) return o;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2]) o[m[1]] = m[2].replace(/^'|'$/g, '');
  }
  return o;
};
const 새열쇠 = env읽기('.env.server').CLEANEYE_KEY || '';

if (!새열쇠) {
  console.error('★ .env.server 에 CLEANEYE_KEY 가 없습니다. 먼저 새 열쇠를 거기 넣어주세요.');
  process.exit(1);
}
if (!/%2B|%2F|%3D/i.test(새열쇠)) {
  console.error('★ Encoding 꼴이 아닌 것 같습니다 (%2B %2F %3D 가 안 보입니다).');
  console.error('  포털에서 **Encoding** 쪽을 복사하셔야 합니다. Decoding 을 넣으면 403 입니다.');
  console.error('  길이 ' + 새열쇠.length + '자 · 지문 ' + 지문(새열쇠));
  process.exit(1);
}

/* ── ② 갈아끼울 옛 열쇠들 ───────────────────────────────── */
const gas = fs.existsSync('gas/wage.js') ? fs.readFileSync('gas/wage.js', 'utf8') : '';
const 꺼내 = (re) => (gas.match(re) || [])[1] || '';
const 옛것 = [...new Set([
  꺼내(/const JOB2_API = \{[\s\S]*?KEY:\s*'([^']+)'/),   // 102자 · 살아 있던 것
  꺼내(/const JOB_API = \{[\s\S]*?KEY:\s*'([^']+)'/),    // 88자 · 죽은 것
  env읽기('web/.env.local').HIRA_KEY_ENC,
].filter((v) => v && v !== 새열쇠))];

if (!옛것.length) {
  console.log('바꿀 것이 없습니다 — 이미 다 새 열쇠입니다.');
  process.exit(0);
}

/* ── ③ 손댈 파일 ────────────────────────────────────────── */
const 파일들 = ['gas/wage.js', '.env.server', 'web/.env.local', '.env.local'];

console.log('공공데이터포털 인증키 갈아끼우기' + (진짜 ? '' : '  ※ 보여만 줍니다 (--바꾼다 를 붙이면 진짜로)') + '\n');
console.log('새 열쇠   ' + 새열쇠.length + '자 · 지문 ' + 지문(새열쇠) + ' · Encoding 꼴 ○');
옛것.forEach((v, i) => console.log('옛 열쇠' + (i + 1) + '  ' + v.length + '자 · 지문 ' + 지문(v)));
console.log();

const 표 = [];
let 모두 = 0;
for (const f of 파일들) {
  if (!fs.existsSync(f)) { 표.push({ 파일: f, 바뀔곳: '—', 비고: '파일 없음' }); continue; }
  let s = fs.readFileSync(f, 'utf8');
  let n = 0;
  for (const 옛 of 옛것) {
    const 몇 = s.split(옛).length - 1;
    if (!몇) continue;
    n += 몇;
    s = s.split(옛).join(새열쇠);
  }
  표.push({ 파일: f, 바뀔곳: n, 비고: n ? '' : '이 열쇠를 안 씁니다' });
  모두 += n;
  if (n && 진짜) {
    fs.copyFileSync(f, f + '.바꾸기전');       /* .gitignore 에 *.바꾸기전 을 넣어뒀습니다 */
    fs.writeFileSync(f, s);
  }
}
console.table(표);
console.log('모두 ' + 모두 + '곳' + (진짜 ? ' 바꿨습니다. 되돌리려면 *.바꾸기전 파일을 쓰세요.' : ' 바뀝니다.'));

if (진짜) {
  console.log('\n이어서 하실 것 —');
  console.log('  1. node tools/공공데이터열쇠확인.mjs        세 API 가 다 ○ 인지');
  console.log('  2. GitHub Secrets 에 ALIO_LIST_KEY · ALIO_DETAIL_KEY · CLEANEYE_KEY 새 값으로');
  console.log('  3. cd gas && .\\push.ps1 -deploy "v334"      옛 수집기에 반영');
  console.log('  4. node tools/서버env.mjs --내보내기 | ssh …  서버에 반영');
} else {
  console.log('\n진짜로 바꾸려면 —  node tools/공공데이터열쇠바꾸기.mjs --바꾼다');
}
