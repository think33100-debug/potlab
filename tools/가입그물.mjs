/* 「가상의 새 회원이 닉네임까지 저장되나」를 날마다 시험합니다 (2026-10-11).
 *
 *   node tools/가입그물.mjs
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 2026-09-30 에 회원번호 시퀀스를 더하면서 회원 쪽 권한을 안 줬습니다.
 * 그날부터 **새 가입이 한 건도 안 됐는데 11일 동안 아무도 몰랐습니다** —
 * 그 사이 아무도 가입을 안 했기 때문입니다
 * (「permission denied for sequence 회원번호_seq」).
 *
 * 그래서 **가상의 새 회원**을 하나 만들어 가입 끝까지 가 보고 **되감습니다.**
 * 아무도 안 가입해도 그물이 날마다 대신 가입해 봅니다.
 *
 * ── 되감기 ───────────────────────────────────────────────────
 * 끝나면 그 계정을 **admin API 로 지웁니다** (profiles 는 cascade).
 * 지우는 것은 API 라 승인 창이 안 뜹니다. 실패해도 다음 번에 다시 지웁니다 —
 * 이름이 signup-check- 로 시작하는 것은 전부 치웁니다.
 */
const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
if (!URL_ || !ANON || !SERVICE) { console.error('SUPABASE_URL · ANON · SERVICE 가 없습니다'); process.exit(2); }

const 관리 = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' };
const 적기 = [];
const 적자 = (무엇, 됨, 말) => { 적기.push([무엇, 됨, 말]); console.log('  ' + (됨 ? '○' : '✗') + ' ' + 무엇.padEnd(26) + 말); };

/* ── 지난번 찌꺼기 먼저 치웁니다 ───────────────────────────── */
async function 묵은것치우기() {
  const r = await fetch(`${URL_}/auth/v1/admin/users?page=1&per_page=200`, { headers: 관리 });
  if (!r.ok) return 0;
  const { users } = await r.json();
  const 치울것 = (users ?? []).filter((u) => String(u.email ?? '').startsWith('signup-check-'));
  for (const u of 치울것) {
    await fetch(`${URL_}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: 관리 });
  }
  return 치울것.length;
}
const 묵은 = await 묵은것치우기();
if (묵은) console.log('지난번 찌꺼기 ' + 묵은 + '개를 먼저 치웠습니다\n');

const 표 = Date.now();
const 메일 = `signup-check-${표}@potjob.invalid`;
const 비번 = 'Zz' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + '!9A';
const 닉 = '그물' + String(표).slice(-6);
let 누구 = null;

try {
  /* ① 가상의 새 회원 (훅은 admin API 를 안 막습니다 — 일부러 그렇습니다) */
  const r1 = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: 'POST', headers: 관리,
    body: JSON.stringify({ email: 메일, password: 비번, email_confirm: true }),
  });
  const j1 = await r1.json();
  누구 = j1?.id ?? null;
  적자('① 가상 회원 만들기', !!누구, 누구 ? '만들었습니다' : 'HTTP ' + r1.status + ' · ' + JSON.stringify(j1).slice(0, 110));
  if (!누구) throw new Error('멈춥니다');

  /* ② 그 사람으로 로그인 */
  const r2 = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 메일, password: 비번 }),
  });
  const j2 = await r2.json();
  const 토큰 = j2?.access_token;
  적자('② 로그인', !!토큰, 토큰 ? '됐습니다' : 'HTTP ' + r2.status);
  if (!토큰) throw new Error('멈춥니다');

  /* ③ **닉네임까지 저장** — 화면이 부르는 그 창구를 그대로 */
  const r3 = await fetch(`${URL_}/rest/v1/rpc/${encodeURIComponent('가입하기')}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: 'Bearer ' + 토큰, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_닉네임: 닉, p_직군: '물리치료사', p_역할: '학생', p_사진: null, p_약관판: 'v1' }),
  });
  const t3 = await r3.text();
  적자('③ 닉네임 저장', r3.ok, r3.ok ? '저장됐습니다' : 'HTTP ' + r3.status + ' · ' + t3.replace(/\s+/g, ' ').slice(0, 140));

  /* 통계에 안 섞이게 — 몇 초뿐이지만 「쓰는 중 N명」에 끼지 않게 합니다 */
  await fetch(`${URL_}/rest/v1/profiles?id=eq.${누구}`, {
    method: 'PATCH', headers: { ...관리, Prefer: 'return=minimal' },
    body: JSON.stringify({ excluded: true }),
  });

  /* ④ 정말 줄이 생겼나 (회원번호까지) */
  const r4 = await fetch(`${URL_}/rest/v1/profiles?select=${encodeURIComponent('회원번호')},nickname&id=eq.${누구}`, { headers: 관리 });
  const j4 = await r4.json();
  적자('④ 회원번호가 붙었나', !!j4?.[0]?.['회원번호'], j4?.[0] ? '회원번호 ' + j4[0]['회원번호'] : '줄이 없습니다');
} catch (e) {
  적자('멈춤', false, String(e.message).slice(0, 120));
} finally {
  /* ⑤ 되감기 */
  if (누구) {
    const d = await fetch(`${URL_}/auth/v1/admin/users/${누구}`, { method: 'DELETE', headers: 관리 });
    적자('⑤ 되감기 (계정 지우기)', d.ok, d.ok ? '지웠습니다' : 'HTTP ' + d.status);
  }
}

/* ★ 2026-10-22 — **치운 뒤에 세어 봅니다** (지침 8-17).
   이 파일 머리말에 「profiles 는 cascade」 라고 적어 뒀지만 **그 외래키가
   없었습니다.** 그래서 10-11 부터 profiles 가 하루 한 줄씩 쌓여 37줄 가운데
   28줄이 고아였습니다. 10-22 에 FK(on delete cascade)를 걸었으니 이제 auth 를
   지우면 profiles 도 따라 지워집니다 — **그것을 여기서 확인합니다.**
   다시 쌓이면 이 줄이 빨간 줄로 알려 줍니다. */
try {
  const r = await fetch(URL_ + '/rest/v1/profiles?select=id&limit=2000', { headers: 관리 });
  const 줄 = r.ok ? await r.json() : [];
  const u = await fetch(URL_ + '/auth/v1/admin/users?page=1&per_page=1000', { headers: 관리 });
  const 사람 = u.ok ? new Set((((await u.json()) || {}).users || []).map((x) => x.id)) : null;
  if (사람 && 줄.length) {
    const 고아 = 줄.filter((x) => !사람.has(x.id)).length;
    적자('⑥ profiles 고아줄', 고아 === 0,
      고아 === 0 ? '0줄 (cascade 가 돕니다)'
        : 고아 + '줄 남았습니다 — FK 가 빠졌나 보십시오 (지침 8-17)');
  }
} catch (e) {
  적자('⑥ profiles 고아줄', false, '못 셌습니다 — ' + String(e.message).slice(0, 80));
}

const 탈 = 적기.filter(([, b]) => !b).length;
console.log('\n' + (탈 ? '✗ 가입 길이 막혀 있습니다 — ' + 탈 + '곳' : '○ 새 회원이 닉네임까지 저장됩니다'));
process.exit(탈 ? 1 : 0);
