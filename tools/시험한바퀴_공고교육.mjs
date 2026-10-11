/* 담당자 한 바퀴 마저 — 공고·교육 올리기와 첨부 (2026-10-11).
 *
 *   node tools/시험한바퀴_공고교육.mjs      (서버에서)
 *
 * test-empty 를 시험병원(TEST:마스터시험병원) 담당자로 세우고
 *   ① 공고 쓰기 → ② 첨부(pdf·그림) → ③ **회원은 받고 비회원은 못 받나**
 *   ④ 교육 과정·회차 하나 → ⑤ 교육 첨부
 * 전부 **시험자료**로 표시합니다 (10/25 에 함께 치웁니다).
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

const 기관 = 'TEST:마스터시험병원';
const 빈계정id = 'ff6b44ed-ac07-467b-9bda-ce19e121dbd1';
const 마스터 = await 토큰(process.env.MASTER_EMAIL, process.env.MASTER_PW);
const 빈계정 = await 토큰('test-empty@potjob.co.kr', process.env.TEST_EMPTY_PW);
const 물리 = await 토큰('test-pt@potjob.co.kr', process.env.TEST_PT_PW);
console.log('세 사람으로 들어갔습니다\n');

/* ⓪ 기관번호가 붙은 줄(25)을 승인으로 — 62 는 기관번호가 없어서 공고를 못 씁니다.
   (profile_id, 기관번호) 가 유일이라 62 에 같은 기관을 넣을 수는 없습니다 */
const 승인 = await 창구(마스터, 'admin_담당자정하기', { p_자격id: 25, p_상태: '승인', p_까닭: null });
적자('⓪ 시험병원 담당자 승인', 승인.ok, 승인.ok ? '자격 25 → 승인' : JSON.stringify(승인.답).slice(0, 110));

console.log('\n── 공고 ──');
/* ① 공고 쓰기 */
const 오늘 = new Date().toISOString().slice(0, 10);
const 뒤 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
const 쓰기 = await 창구(빈계정, '담당자공고쓰기', {
  p_기관번호: 기관, p_제목: '시험 공고 — 물리치료사 (2026-10-11 한바퀴)',
  p_직군: '물리치료사', p_고용형태: '정규직', p_근무지: '대구 북구',
  p_인원: 1, p_접수부터: 오늘, p_접수까지: 뒤, p_마감시각: null,
  p_주소: 'https://potjob-web.vercel.app', p_상세: { 지원자격: '물리치료사 면허' },
});
const 공고 = 쓰기.답?.공고 ?? 쓰기.답?.id ?? (typeof 쓰기.답 === 'string' ? 쓰기.답 : null);
적자('① 담당자가 공고 쓰기', 쓰기.ok && !!공고, 쓰기.ok ? '공고 ' + 공고 : JSON.stringify(쓰기.답).slice(0, 120));

if (공고) {
  await 섬김(`job_posts?id=eq.${encodeURIComponent(공고)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ 시험자료: true }),
  });
  적자('①-2 시험자료로 표시', true, '했습니다');

  /* ② 첨부 — pdf 와 그림 각각. 경로는 **영문** (6-2b) */
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const 올린것 = [];
  for (const [이름, 몸, 형] of [['notice.pdf', pdf, 'application/pdf'], ['notice.png', png, 'image/png']]) {
    const 길 = `${공고}/${Date.now()}-${이름}`;
    const r = await fetch(`${URL_}/storage/v1/object/notices/${길}`, {
      method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + 빈계정, 'Content-Type': 형 }, body: 몸,
    });
    적자('② 첨부 올리기 ' + 이름, r.ok, r.ok ? '올라갔습니다' : 'HTTP ' + r.status + ' · ' + (await r.text()).replace(/\s+/g, ' ').slice(0, 90));
    if (r.ok) 올린것.push(길);
  }

  /* ③ 회원은 받고 비회원은 못 받나 */
  if (올린것.length) {
    const 길 = 올린것[0];
    const 회원 = await fetch(`${URL_}/storage/v1/object/notices/${길}`, { headers: { apikey: ANON, Authorization: 'Bearer ' + 물리 } });
    적자('③ 회원이 받기', 회원.ok, 회원.ok ? '받아집니다 (' + (await 회원.arrayBuffer()).byteLength + '바이트)' : 'HTTP ' + 회원.status);
    const 손님 = await fetch(`${URL_}/storage/v1/object/notices/${길}`, { headers: { apikey: ANON } });
    적자('③-2 비회원이 받기', !손님.ok, 손님.ok ? '**받아집니다**' : '막힙니다 (' + 손님.status + ')');
  }
}

console.log('\n── 교육 ──');
/* ③-3 교육은 **교육담당자기관** 자격이 따로 있어야 합니다.
   채용담당자 자격으로는 「그 기관의 승인된 담당자가 아닙니다」가 맞는 답입니다 —
   고장이 아니라 규칙이 도는 것입니다. 그래서 자격을 하나 더 받습니다 */
const 교육신청 = await 창구(빈계정, '담당자신청', {
  p_갈래: '교육담당자기관', p_기관번호: null, p_교육기관: '시험교육기관', p_사업자번호: '1248100998',
});
적자('③-3 교육담당자 신청', 교육신청.ok, 교육신청.ok ? '들어갔습니다' : JSON.stringify(교육신청.답).slice(0, 110));
const 교육자격 = await (await 섬김('회원자격?profile_id=eq.' + 빈계정id + '&갈래=eq.교육담당자기관&order=id.desc&limit=1')).json();
const 교육자격id = 교육자격?.[0]?.id;
if (교육자격id) {
  const 교육승인 = await 창구(마스터, 'admin_담당자정하기', { p_자격id: 교육자격id, p_상태: '승인', p_까닭: null });
  적자('③-4 교육담당자 승인', 교육승인.ok, 교육승인.ok ? '자격 ' + 교육자격id + ' → 승인' : JSON.stringify(교육승인.답).slice(0, 110));
  await 섬김('회원자격?id=eq.' + 교육자격id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ 시험자료: true }) });
}
/* ④ 교육 과정 하나 */
const 과정 = await 창구(빈계정, '교육과정만들기', {
  p_제목: '시험 교육 — 연하재활 (2026-10-11 한바퀴)', p_직군: '물리치료사',
  p_소개: '한 바퀴 시험용입니다', p_교육기관: '시험교육기관',
});
const 과정id = Number(과정.답?.과정id ?? 과정.답?.과정 ?? 과정.답?.id ?? 과정.답);
적자('④ 교육 과정 만들기', 과정.ok && Number.isFinite(과정id), Number.isFinite(과정id) ? '과정 ' + 과정id : '답 ' + JSON.stringify(과정.답).slice(0, 120));

if (Number.isFinite(과정id)) {
  await 섬김('교육과정?과정id=eq.' + 과정id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ 시험자료: true }) });
  const 회차 = await 창구(빈계정, '교육회차열기', {
    p_과정: 과정id, p_시작: 뒤, p_끝: 뒤, p_장소: '대구 (시험)', p_정원: 10,
    p_접수시작: 오늘, p_접수끝: 뒤, p_수강료: 0, p_은행: null, p_계좌번호: null,
    p_예금주: null, p_입금기한: null, p_입금자명규칙: null,
    p_환불규정: '시험용입니다. 실제 환불 규정이 아닙니다.', p_결제링크: null,
  });
  const 회차id = Number(회차.답?.회차id ?? 회차.답?.회차 ?? 회차.답?.id ?? 회차.답);
  적자('⑤ 교육 회차 열기', 회차.ok && Number.isFinite(회차id), 회차.ok ? '회차 ' + 회차id : JSON.stringify(회차.답).slice(0, 120));
  if (Number.isFinite(회차id)) {
    await 섬김('교육회차?회차id=eq.' + 회차id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ 시험자료: true }) });
    /* 교육 첨부 — notices 통의 「교육<회차>」 폴더 (components/notice-files.tsx) */
    const pdf2 = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
    const 길2 = 'edu' + 회차id + '/' + Date.now() + '-edu.pdf';
    const r2 = await fetch(URL_ + '/storage/v1/object/notices/' + 길2, {
      method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + 빈계정, 'Content-Type': 'application/pdf' }, body: pdf2,
    });
    적자('⑤-2 교육 첨부', r2.ok, r2.ok ? '올라갔습니다' : 'HTTP ' + r2.status + ' · ' + (await r2.text()).replace(/\s+/g, ' ').slice(0, 90));
  }
}

const 탈 = 적기.filter(([, b]) => !b).length;
console.log('\n' + (탈 ? '✗ 걸린 것 ' + 탈 + '개' : '○ 다 돌았습니다'));
