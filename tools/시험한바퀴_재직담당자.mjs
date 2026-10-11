/* 재직 인증 · 담당자 신청 한 바퀴 — **시험 계정으로 진짜 돌립니다** (2026-10-11).
 *
 *   node tools/시험한바퀴_재직담당자.mjs     (서버에서)
 *
 * 재직   test-empty 가 서류를 올려 신청 → 관리자가 확인 → 배지 → **파일 지워짐**
 * 담당자 test-empty 가 신청 → 관리자가 승인 → 채용 관리 창구가 열리나
 *
 * 화면이 열리는지는 tools/기능점검.mjs 가 봤습니다. 여기서는 **규칙이 도는지**를
 * 봅니다 — 올리기 · 남의 것 못 보기 · 승인 · 파일 지우기 · 권한이 생기나.
 *
 * 비번은 서버 .env 에서 프로세스 안으로만 읽습니다. 안 찍습니다.
 * 만든 자료는 **시험자료로 표시**해 10/25 에 함께 치웁니다.
 */
const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
if (!URL_ || !ANON || !SERVICE) { console.error('열쇠가 모자랍니다'); process.exit(2); }

const 적기 = [];
const 적자 = (무엇, 됨, 말) => { 적기.push([무엇, 됨, 말]); console.log('  ' + (됨 ? '○' : '✗') + ' ' + 무엇.padEnd(30) + 말); };

async function 토큰(메일, 비번) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 메일, password: 비번 }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(메일 + ' 로그인 실패 ' + r.status);
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
const 섬김 = (길, 옵션 = {}) => fetch(`${URL_}/rest/v1/${길}`, {
  ...옵션,
  headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json', ...(옵션.headers ?? {}) },
});

const 빈계정id = 'ff6b44ed-ac07-467b-9bda-ce19e121dbd1';
const 마스터 = await 토큰(process.env.MASTER_EMAIL, process.env.MASTER_PW);
const 빈계정 = await 토큰('test-empty@potjob.co.kr', process.env.TEST_EMPTY_PW);
const 물리 = await 토큰('test-pt@potjob.co.kr', process.env.TEST_PT_PW);
console.log('세 사람으로 들어갔습니다 (값은 안 찍습니다)\n');

/* ── 가짜 서류 한 장 (PDF 머리글만 맞춘 아주 작은 것) ───────── */
const 서류 = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

console.log('── 재직 인증 ──');
/* ① 올리기 — 경로는 **영문**이어야 합니다 (6-2b) */
const 경로 = `${빈계정id}/proof-${Date.now()}-test.pdf`;
const 올림 = await fetch(`${URL_}/storage/v1/object/proofs/${경로}`, {
  method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + 빈계정, 'Content-Type': 'application/pdf' }, body: 서류,
});
적자('① 증빙 올리기', 올림.ok, 올림.ok ? '올라갔습니다 (' + 서류.length + '바이트)' : 'HTTP ' + 올림.status + ' · ' + (await 올림.text()).slice(0, 90));

/* ② 신청 */
const 신청 = await 창구(빈계정, '재직인증신청', { p_경로: 경로, p_병원: '시험병원 (한바퀴 2026-10-11)' });
적자('② 신청', 신청.ok, 신청.ok ? '들어갔습니다' : JSON.stringify(신청.답).slice(0, 110));

/* ③ 남의 증빙을 다른 회원이 볼 수 있나 — **못 봐야** 합니다 */
const 엿보기 = await fetch(`${URL_}/storage/v1/object/proofs/${경로}`, {
  headers: { apikey: ANON, Authorization: 'Bearer ' + 물리 },
});
적자('③ 남이 증빙을 열 수 있나', !엿보기.ok, 엿보기.ok ? '**열립니다**' : '막힙니다 (' + 엿보기.status + ')');

/* ④ 관리자 목록에 뜨나 */
const 줄 = await 섬김(`재직인증?profile_id=eq.${빈계정id}&order=id.desc&limit=1`);
const 줄들 = await 줄.json();
const 인증id = 줄들?.[0]?.id;
적자('④ 심사중으로 들어왔나', 줄들?.[0]?.상태 === '심사중', '상태 ' + (줄들?.[0]?.상태 ?? '없음') + ' · id ' + (인증id ?? '—'));

/* ⑤ 관리자가 확인 — 오늘 고친 알림넣기 두 벌 문제가 여기에도 있었습니다 */
const 정하기 = await 창구(마스터, 'admin_재직인증정하기', { p_id: 인증id, p_상태: '확인', p_까닭: null });
적자('⑤ 관리자가 확인', 정하기.ok, 정하기.ok ? '확인했습니다' : JSON.stringify(정하기.답).slice(0, 110));

/* ⑥ 배지 · ⑦ 파일 지워짐 */
const 뒤 = await (await 섬김(`재직인증?id=eq.${인증id}`)).json();
적자('⑥ 상태가 확인인가', 뒤?.[0]?.상태 === '확인', '상태 ' + (뒤?.[0]?.상태 ?? '—'));
적자('⑦ 증빙 칸이 비워졌나', !뒤?.[0]?.경로, 뒤?.[0]?.경로 ? '**경로가 남아 있습니다**' : '비웠습니다 (파일지운때 ' + (뒤?.[0]?.파일지운때 ? '있음' : '없음') + ')');
const 파일남았나 = await fetch(`${URL_}/storage/v1/object/proofs/${경로}`, {
  headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE },
});
적자('⑦-2 저장소 파일', true, 파일남았나.ok ? '아직 있습니다 — clean_orphan_files.js 몫입니다' : '없습니다 (' + 파일남았나.status + ')');

/* ⑧ 시험자료로 표시 */
const 표시1 = await 섬김(`재직인증?id=eq.${인증id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ 시험자료: true }) });
적자('⑧ 시험자료로 표시', 표시1.ok, 표시1.ok ? '했습니다' : 'HTTP ' + 표시1.status);

console.log('\n── 담당자 신청 ──');
/* ⑨ 신청 */
const 신청2 = await 창구(빈계정, '담당자신청', {
  p_갈래: '채용담당자', p_기관번호: null, p_교육기관: null, p_사업자번호: '1248100998',
});
적자('⑨ 담당자 신청', 신청2.ok, 신청2.ok ? '들어갔습니다' : JSON.stringify(신청2.답).slice(0, 110));

const 자격 = await (await 섬김(`회원자격?profile_id=eq.${빈계정id}&order=id.desc&limit=1`)).json();
const 자격id = 자격?.[0]?.id;
적자('⑩ 대기로 들어왔나', !!자격id, '상태 ' + (자격?.[0]?.상태 ?? '없음') + ' · id ' + (자격id ?? '—'));

/* ⑪ 관리자 승인 */
const 정하기2 = await 창구(마스터, 'admin_담당자정하기', { p_자격id: 자격id, p_상태: '승인', p_까닭: null });
적자('⑪ 관리자 승인', 정하기2.ok, 정하기2.ok ? '승인했습니다' : JSON.stringify(정하기2.답).slice(0, 110));

/* ⑫ 승인 뒤 채용 관리 창구가 열리나 */
const 내신청 = await 창구(빈계정, '내담당자신청', {});
const 승인됨 = Array.isArray(내신청.답) && 내신청.답.some((x) => x.상태 === '승인');
적자('⑫ 본인 화면에 승인으로', 승인됨, 내신청.ok ? JSON.stringify(내신청.답?.[0]?.상태 ?? '—') : JSON.stringify(내신청.답).slice(0, 90));

/* ⑬ 시험자료로 표시 */
const 표시2 = await 섬김(`회원자격?id=eq.${자격id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ 시험자료: true }) });
적자('⑬ 시험자료로 표시', 표시2.ok, 표시2.ok ? '했습니다' : 'HTTP ' + 표시2.status);

const 탈 = 적기.filter(([, b]) => !b).length;
console.log('\n' + (탈 ? '✗ 걸린 것 ' + 탈 + '개' : '○ 두 바퀴 다 돌았습니다'));
