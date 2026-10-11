/* 1:1 대화 한 바퀴 — **시험 계정으로 진짜 돌려 봅니다** (2026-10-11).
 *
 *   node tools/시험한바퀴_대화.mjs        (서버에서 · .env 에 시험 비번이 있어야 합니다)
 *
 * 마스터 ↔ test-pt 로 신청 → 수락 → 글 → 사진 → 차단 → 신고 → 관리자 처리.
 *
 * ── 왜 창구로 도나 ──────────────────────────────────────────
 * 두 사람이 **동시에** 있어야 하는 바퀴입니다. 창(브라우저) 둘을 띄워
 * 번갈아 누르는 것보다, **두 사람의 진짜 토큰으로 창구를 부르는 쪽**이
 * 규칙을 더 정확히 밟습니다 — RLS 와 창구 검사는 다 그대로 돕니다.
 * 화면이 열리는지는 tools/기능점검.mjs 가 따로 봤습니다.
 *
 * 비번은 서버 .env 에서 **프로세스 안으로만** 읽습니다. 안 찍습니다.
 * 만든 자료는 **시험자료로 표시**해 10/25 에 함께 치웁니다.
 */
const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
if (!URL_ || !ANON || !SERVICE) { console.error('SUPABASE_URL · ANON · SERVICE 가 없습니다'); process.exit(2); }

const 적기 = [];
const 적자 = (무엇, 됨, 말) => { 적기.push([무엇, 됨, 말]); console.log('  ' + (됨 ? '○' : '✗') + ' ' + 무엇.padEnd(26) + 말); };

async function 토큰(메일, 비번) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 메일, password: 비번 }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(메일 + ' 로그인 실패 HTTP ' + r.status + ' · ' + JSON.stringify(j).slice(0, 120));
  return j.access_token;
}
const 창구 = async (tok, 이름, 몸) => {
  const r = await fetch(`${URL_}/rest/v1/rpc/${encodeURIComponent(이름)}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify(몸 ?? {}),
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { /* 글 그대로 */ }
  return { ok: r.ok, code: r.status, 답: j ?? t };
};
const 섬김 = async (길, 옵션 = {}) => fetch(`${URL_}/rest/v1/${길}`, {
  ...옵션, headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json', ...(옵션.headers ?? {}) },
});

const 마스터 = await 토큰(process.env.MASTER_EMAIL, process.env.MASTER_PW);
const 물리 = await 토큰('test-pt@potjob.co.kr', process.env.TEST_PT_PW);
console.log('두 사람으로 들어갔습니다 (값은 안 찍습니다)\n');

const 물리id = 'b2b4c0e8-3f35-4356-95c1-f235182aaf11';
const 마스터id = '3a204fae-3180-42ee-a637-7ad62166e4c4';

/* ⓪ 지난번에 막아 뒀으면 먼저 풉니다 — 안 그러면 ① 에서 「지금은 말을
   걸 수 없어요」가 납니다. 차단이 **정말 듣는다**는 증거이기도 합니다 */
{
  const 푼것 = await 섬김('대화차단?막은사람=eq.' + 물리id + '&막힌사람=eq.' + 마스터id,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  적자('⓪ 지난 차단 풀기', true, 푼것.ok ? '풀었습니다' : '풀 것이 없었습니다 (' + 푼것.status + ')');
}

/* ① 신청 — 마스터가 시험물리에게 말을 겁니다 */
const 걸기 = await 창구(마스터, '대화걸기', { p_상대: 물리id });
const 방 = Number(걸기.답?.방 ?? 걸기.답?.id ?? 걸기.답);
적자('① 대화 걸기', 걸기.ok && Number.isFinite(방), 걸기.ok ? '방 ' + 방 : JSON.stringify(걸기.답).slice(0, 110));

/* ② 수락 — 받는 쪽이 받겠다고 합니다 */
const 수락 = await 창구(물리, '대화정하기', { p_방: 방, p_받나: true });
적자('② 받는 쪽이 수락', 수락.ok, 수락.ok ? '받았습니다' : JSON.stringify(수락.답).slice(0, 110));

/* ③ 글 */
const 글1 = await 창구(마스터, '대화보내기', { p_방: 방, p_글: '시험 쪽지입니다 (2026-10-11)', p_사진: null });
적자('③ 글 보내기', 글1.ok, 글1.ok ? '갔습니다' : JSON.stringify(글1.답).slice(0, 110));

/* ④ 사진 — chat-images 통에 작은 PNG 한 장 */
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64');
const 사진길 = `${마스터id}/${Date.now()}-test.png`;
const 올림 = await fetch(`${URL_}/storage/v1/object/chat-images/${사진길}`, {
  method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + 마스터, 'Content-Type': 'image/png' }, body: png,
});
const 올림글 = await 올림.text();
적자('④ 사진 올리기', 올림.ok, 올림.ok ? '올라갔습니다 (' + png.length + '바이트)' : 'HTTP ' + 올림.status + ' · ' + 올림글.replace(/\s+/g, ' ').slice(0, 100));
if (올림.ok) {
  const 글2 = await 창구(마스터, '대화보내기', { p_방: 방, p_글: null, p_사진: 사진길 });
  적자('④-2 사진 쪽지', 글2.ok, 글2.ok ? '갔습니다' : JSON.stringify(글2.답).slice(0, 110));
}

/* ⑤ 받는 쪽이 읽히나 */
const 읽기 = await 창구(물리, '대화읽기', { p_방: 방, p_몇줄: 20 });
const 줄수 = Array.isArray(읽기.답) ? 읽기.답.length : 0;
적자('⑤ 받는 쪽이 읽음', 읽기.ok && 줄수 > 0, 읽기.ok ? 줄수 + '줄 보입니다' : JSON.stringify(읽기.답).slice(0, 110));

/* ⑥ 신고 — 받는 쪽이 그 방을 신고합니다 */
const 신고 = await fetch(`${URL_}/rest/v1/reports`, {
  method: 'POST',
  headers: { apikey: ANON, Authorization: 'Bearer ' + 물리, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    /* ★ 2026-10-11 — reports_target_type_check 가 **post·comment 만** 받습니다.
     그래서 **대화는 신고할 길이 아예 없습니다** (아래 ⑥ 결과). 승인대기 ㉒ */
  body: JSON.stringify({ target_type: 'chat_room', target_id: 방, reporter_id: 물리id, reason: '시험 신고입니다 (2026-10-11)' }),
});
const 신고글 = await 신고.text();
적자('⑥ 신고', 신고.ok, 신고.ok ? '들어갔습니다' : 'HTTP ' + 신고.status + ' · ' + 신고글.replace(/\s+/g, ' ').slice(0, 100));

/* ⑦ 신고가 걸린 방은 밤정리가 안 지웁니다 — ② 승인의 핵심입니다 */
const 걸렸나 = await 섬김(`rpc/${encodeURIComponent('신고걸린방')}`, { method: 'POST', body: JSON.stringify({ p_room: 방 }) });
const 걸렸답 = (await 걸렸나.text()).trim();
적자('⑦ 신고걸린방() 이 참인가', 걸렸답 === 'true', '답 ' + 걸렸답);

/* ⑧ 차단 — 받는 쪽이 상대를 막습니다 */
const 차단 = await 창구(물리, '대화차단하기', { p_상대: 마스터id });
적자('⑧ 대화 차단', 차단.ok, 차단.ok ? '막았습니다' : JSON.stringify(차단.답).slice(0, 110));
const 막힌뒤 = await 창구(마스터, '대화보내기', { p_방: 방, p_글: '차단 뒤에도 가나', p_사진: null });
적자('⑧-2 차단 뒤 보내기', !막힌뒤.ok, 막힌뒤.ok ? '**그대로 갑니다**' : '막혔습니다 (' + 막힌뒤.code + ')');

/* ⑨ 관리자가 신고를 처리 */
const 목록 = await 창구(마스터, 'admin_신고목록', { p_처리전만: true, p_page: 0 }).catch(() => ({ ok: false }));
적자('⑨ 관리자 신고 목록', 목록.ok, 목록.ok ? (Array.isArray(목록.답) ? 목록.답.length + '건' : '열립니다') : JSON.stringify(목록.답).slice(0, 110));

/* ⑩ 만든 것을 **시험자료로** 표시 — 10/25 에 함께 치웁니다 */
const 표시 = await 섬김(`chat_rooms?id=eq.${방}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ 시험자료: true }) });
적자('⑩ 시험자료로 표시', 표시.ok, 표시.ok ? '방 ' + 방 + ' → 시험자료' : 'HTTP ' + 표시.status);

const 탈 = 적기.filter(([, b]) => !b).length;
console.log('\n' + (탈 ? '✗ 걸린 것 ' + 탈 + '개' : '○ 한 바퀴 다 돌았습니다'));
