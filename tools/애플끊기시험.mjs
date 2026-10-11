/* 「탈퇴할 때 애플 끊기 결과가 정말 남나」를 시험합니다 (2026-10-11).
 *
 *   node tools/애플끊기시험.mjs
 *
 * ── 무엇을 보나 ──────────────────────────────────────────────
 * 애플이 **200 을 주는지**는 진짜 애플 토큰이 있어야 압니다 (세중님 손이
 * 필요합니다). 여기서는 그 앞까지 — **길이 서 있나**를 봅니다.
 *
 *   ① 가상의 회원을 만들고
 *   ② 애플연결 줄을 **가짜 토큰**으로 넣고
 *   ③ /api/apple-revoke 를 그 사람으로 부르고
 *   ④ erased_accounts.애플끊기 에 **결과가 적혔나**
 *
 * 가짜 토큰이라 애플은 400 을 줍니다. **그 400 이 적히면 길은 다 선 것**이고,
 * 진짜 토큰일 때 「200」이 적힙니다.
 *
 * 끝나면 그 계정을 지웁니다 (되감기).
 */
const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
const 화면 = (process.argv.includes('--주소')
  ? process.argv[process.argv.indexOf('--주소') + 1] : 'https://potjob-web.vercel.app').replace(/\/$/, '');
if (!URL_ || !ANON || !SERVICE) { console.error('열쇠가 모자랍니다'); process.exit(2); }

const 관리 = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' };
const 적기 = [];
const 적자 = (무엇, 됨, 말) => { 적기.push([무엇, 됨, 말]); console.log('  ' + (됨 ? '○' : '✗') + ' ' + 무엇.padEnd(30) + 말); };

const 표 = Date.now();
const 메일 = `apple-revoke-check-${표}@potjob.invalid`;
const 비번 = 'Zz' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + '!9A';
let 누구 = null;

try {
  const r1 = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: 'POST', headers: 관리,
    body: JSON.stringify({ email: 메일, password: 비번, email_confirm: true }),
  });
  누구 = (await r1.json())?.id ?? null;
  적자('① 가상 회원', !!누구, 누구 ? '만들었습니다' : 'HTTP ' + r1.status);
  if (!누구) throw new Error('멈춥니다');

  /* 가입까지 해 둡니다 — erased_accounts 가 profile 을 가리킵니다 */
  const r1b = await fetch(`${URL_}/rest/v1/profiles`, {
    method: 'POST', headers: { ...관리, Prefer: 'return=minimal' },
    body: JSON.stringify({ id: 누구, nickname: '끊기시험' + String(표).slice(-5),
      job_group: '물리치료사', role: '학생', excluded: true }),
  });
  적자('①-2 프로필', r1b.ok, r1b.ok ? '만들었습니다' : 'HTTP ' + r1b.status);

  const r2 = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 메일, password: 비번 }),
  });
  const 토큰 = (await r2.json())?.access_token;
  적자('② 로그인', !!토큰, 토큰 ? '됐습니다' : 'HTTP ' + r2.status);
  if (!토큰) throw new Error('멈춥니다');

  /* ③ 애플연결 줄을 가짜 토큰으로 */
  const r3 = await fetch(`${URL_}/rest/v1/${encodeURIComponent('애플연결')}`, {
    method: 'POST', headers: { ...관리, Prefer: 'return=minimal' },
    body: JSON.stringify({ profile_id: 누구, 토큰: 'fake-refresh-token-for-check' }),
  });
  적자('③ 가짜 애플연결 넣기', r3.ok, r3.ok ? '넣었습니다' : 'HTTP ' + r3.status);

  /* ④ 끊기 부르기 */
  const r4 = await fetch(`${화면}/api/apple-revoke`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + 토큰 },
  });
  const j4 = await r4.text();
  적자('④ /api/apple-revoke', true, 'HTTP ' + r4.status + ' · ' + j4.replace(/\s+/g, ' ').slice(0, 90));

  /* ⑤ 결과가 적혔나 */
  const r5 = await fetch(`${URL_}/rest/v1/erased_accounts?select=${encodeURIComponent('애플끊기')},${encodeURIComponent('애플끊은때')}&profile_id=eq.${누구}`, { headers: 관리 });
  const j5 = await r5.json();
  const 적힌것 = j5?.[0]?.['애플끊기'] ?? null;
  적자('⑤ 결과가 적혔나', !!적힌것, 적힌것 ? '「' + 적힌것 + '」' : '**안 적혔습니다**');
  if (적힌것 === '200') 적자('⑥ 애플이 200 을 줬나', true, '**끊겼습니다**');
  else 적자('⑥ 애플이 200 을 줬나', false, '가짜 토큰이라 아닙니다 — 길만 확인했습니다');
} catch (e) {
  적자('멈춤', false, String(e.message).slice(0, 120));
} finally {
  if (누구) {
    const d = await fetch(`${URL_}/auth/v1/admin/users/${누구}`, { method: 'DELETE', headers: 관리 });
    적자('⑦ 되감기', d.ok, d.ok ? '지웠습니다' : 'HTTP ' + d.status);
  }
}

const 길 = 적기.filter(([무엇]) => !무엇.startsWith('⑥')).every(([, b]) => b);
console.log('\n' + (길 ? '○ 길은 다 서 있습니다 — 진짜 애플 토큰이면 「200」이 적힙니다'
  : '✗ 길 어딘가가 끊겼습니다'));
