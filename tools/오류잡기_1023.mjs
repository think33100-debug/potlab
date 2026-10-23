/* 오류 잡기 한 바퀴 — ① jsonb 통째 노출 자리 · ② 회원 응답의 개인정보 꼴
 * (2026-10-23 세중님 1번)
 *
 *   node tools/오류잡기_1023.mjs --자기점검     재는 자만 (DB 안 두드림)
 *   node tools/오류잡기_1023.mjs --노출         ① 창구·뷰·표 (psql · 읽기만)
 *   node tools/오류잡기_1023.mjs --개인정보      ② 회원으로 로그인해 응답을 뒤짐
 *   node tools/오류잡기_1023.mjs               둘 다
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 2026-10-23 에 제가 워크넷 `rcptMthd` 를 `detail.접수방법` 에 담기 시작했고,
 * 거기 **기관 담당자 메일·전화**가 들어왔습니다. `job_one` 은 `detail` 을
 * **회원에게 통째로** 내려줍니다 — 담는 쪽을 고쳐 막았지만, 통째로 내려주는
 * 자리가 **다른 칸·다른 창구에도** 있으면 다음에 또 같은 일이 납니다.
 *
 * 그래서 「무엇이 통째로 나가나」를 **세어 두고**, 허용 목록 꼴을 제안합니다.
 *
 * ★ **아무것도 바꾸지 않습니다.** 읽기만 하고 목록만 냅니다.
 *   창구 고치기는 승인 자리입니다 (CLAUDE.md 0-0).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

/* ── 재는 자 ──────────────────────────────────────────────
   「개인정보 꼴」은 **글자 꼴**로만 봅니다 — 이름을 아는 길이 없으니까요.
   그래서 전화·메일은 **확정**, 담당자 이름은 **의심**으로 따로 셉니다. */
export const 메일꼴 = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]{2,}/g;
/* 전화 — 0 으로 시작하는 지역·휴대 번호만. 사업자번호(123-45-67890)·날짜(2026-10-23)·
   공고번호(K180012610190008)에 걸리지 않게 **앞이 0** 이고 뒤 네 자리로 끝납니다 */
export const 전화꼴 = /(?<![0-9])0(?:1[016-9]|2|[3-6][0-9]|70)[-.)\s]?[0-9]{3,4}[-.\s]?[0-9]{4}(?![0-9])/g;
/* 담당자 — 「담당자 홍길동」·「문의: 김철수 과장」 꼴. **의심**으로만 셉니다 */
export const 담당자꼴 = /(?:담당자|담당|문의처|문의)\s*[:：(]?\s*([가-힣]{2,4})\s*(?:과장|부장|팀장|대리|주임|실장|선생|씨|님)?/g;

export const 개인정보찾기 = (글) => {
  const t = String(글 || '');
  const 메 = [...t.matchAll(메일꼴)].map((m) => m[0]);
  const 전 = [...t.matchAll(전화꼴)].map((m) => m[0]);
  const 담 = [...t.matchAll(담당자꼴)].map((m) => m[0]);
  return { 메일: [...new Set(메)], 전화: [...new Set(전)], 담당자의심: [...new Set(담)] };
};

/* jsonb 를 통째로 내보내는 꼴 — `j.detail`·`"뽑은값"`·`evidence` 가 **골라내지 않고**
   그대로 값에 앉는 자리를 찾습니다. 창구 본문에서 줄 단위로 봅니다 */
/* 「통째」란 — jsonb 칸을 **열쇠를 안 골라** 값에 그대로 앉히는 것입니다.
   `j.detail->>'모집인원'` 은 골라 쓴 것이라 통째가 아닙니다 */
export const 통째꼴 = /(?:[a-z]\.(?:detail|"뽑은값"|evidence|payload)(?!\s*(?:->|#>))|to_jsonb\s*\(\s*[a-z]\.\*|row_to_json)/i;
export const jsonb칸꼴 = /(?:\bdetail\b|"뽑은값"|\bevidence\b|\bpayload\b)/;

if (process.argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);

  보('메일을 집는다', 개인정보찾기('기타(이메일 : entl9156@naver.com)').메일.length === 1);
  보('휴대전화를 집는다', 개인정보찾기('▣전화(010-1234-5678)').전화.length === 1);
  보('지역번호도 집는다', 개인정보찾기('문의 054-123-4567').전화.length === 1);
  보('붙여 쓴 휴대전화도 집는다', 개인정보찾기('01012345678 로 연락').전화.length === 1);
  보('★ 사업자번호는 전화가 아니다', 개인정보찾기('사업자 123-45-67890').전화.length === 0);
  보('★ 날짜는 전화가 아니다', 개인정보찾기('접수 2026-10-23 까지').전화.length === 0);
  보('★ 공고번호는 전화가 아니다', 개인정보찾기('K180012610190008').전화.length === 0);
  보('★ 금액은 전화가 아니다', 개인정보찾기('연봉 3,200만원 · 32000000').전화.length === 0);
  보('담당자 이름을 의심한다', 개인정보찾기('담당자: 홍길동 과장').담당자의심.length === 1);
  보('깨끗한 글은 아무것도 안 나온다', (() => {
    const r = 개인정보찾기('고용24,기타 · 방문,우편');
    return !r.메일.length && !r.전화.length && !r.담당자의심.length;
  })());

  보('detail 을 통째로 앉히는 줄을 집는다',
    통째꼴.test("    'detail', case when 회원인가 then coalesce(j.detail, '{}'::jsonb) else '{}'::jsonb end,"));
  보('뽑은값을 통째로 앉히는 줄을 집는다', 통째꼴.test(`    '뽑은값', j."뽑은값",`));
  보('to_jsonb(표.*) 도 집는다', 통째꼴.test('select to_jsonb(j.*) from job_posts j'));
  보('★ 칸을 골라 쓴 줄은 통째가 아니다',
    !통째꼴.test("    '모집인원', j.detail->>'모집인원',"));

  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

/* ── 열쇠 ─────────────────────────────────────────────── */
const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const 할것 = process.argv.slice(2).filter((x) => x.startsWith('--'));
const 할까 = (x) => !할것.length || 할것.includes(x);

/* ── ① 통째로 나가는 자리 (psql · 읽기만) ─────────────── */
if (할까('--노출')) {
  const DB = cfg.SUPABASE_DB_URL;
  if (!DB) { console.error('✗ SUPABASE_DB_URL 이 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
  const u = new URL(DB);
  const env = {
    ...process.env,
    PGHOST: u.hostname, PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
    PGSSLMODE: u.searchParams.get('sslmode') || 'require',
  };
  /* 본문에 줄바꿈이 들어 있으니 칸은 \x1f · 줄은 \x1e 로 갈라 받습니다 */
  const psql = (sql) => {
    const 임시 = path.join(os.tmpdir(), '오류잡기_' + process.pid + '.sql');
    fs.writeFileSync(임시, sql, 'utf8');
    const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-F', '\x1f', '-R', '\x1e',
      '-v', 'ON_ERROR_STOP=1', '-f', 임시], { encoding: 'utf8', maxBuffer: 1 << 28, env });
    fs.unlinkSync(임시);
    if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
    return (r.stdout || '').split('\x1e').filter((x) => x.trim()).map((x) => x.split('\x1f'));
  };

  console.log('\n══ ① jsonb 를 통째로 내보내는 자리 ══\n');

  const 창구 = psql(`
    select p.proname,
           pg_get_function_identity_arguments(p.oid),
           case when has_function_privilege('anon', p.oid, 'execute') then 'anon' else '' end,
           case when has_function_privilege('authenticated', p.oid, 'execute') then 'auth' else '' end,
           pg_get_functiondef(p.oid)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and (has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute'))
     order by p.proname;`);

  const 걸린창구 = [];
  for (const [이름, 인수, a, b, 본문] of 창구) {
    const 줄들 = String(본문 || '').split('\n');
    const 통째 = 줄들.map((l, i) => [i + 1, l]).filter(([, l]) => 통째꼴.test(l));
    if (통째.length) 걸린창구.push({ 이름, 인수, 누구: [a, b].filter(Boolean).join('+'), 통째 });
  }
  console.log('부를 수 있는 창구 ' + 창구.length + '개 가운데 **통째로 앉히는 것 '
    + 걸린창구.length + '개**\n');
  for (const c of 걸린창구) {
    console.log('  ● ' + c.이름 + '(' + c.인수 + ')  [' + c.누구 + ']');
    for (const [n, l] of c.통째) console.log('      :' + n + '  ' + l.trim().slice(0, 150));
  }

  const 뷰 = psql(`
    select c.relname, c.relkind,
           case when has_table_privilege('anon', c.oid, 'select') then 'anon' else '' end,
           case when has_table_privilege('authenticated', c.oid, 'select') then 'auth' else '' end,
           coalesce((select string_agg(a.attname || ':' || format_type(a.atttypid, null), ', ' order by a.attnum)
                       from pg_attribute a
                      where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
                        and format_type(a.atttypid, null) in ('jsonb', 'json')), ''),
           case when c.relkind = 'r' then c.relrowsecurity::text else '-' end,
           coalesce(array_to_string(c.reloptions, ' '), ''),
           case when c.relkind in ('v', 'm') then pg_get_viewdef(c.oid) else '' end
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
       and (has_table_privilege('anon', c.oid, 'select')
         or has_table_privilege('authenticated', c.oid, 'select'))
     order by c.relname;`);

  const 걸린뷰 = 뷰.filter((r) => (r[4] || '').trim());
  console.log('\n볼 수 있는 표·뷰 ' + 뷰.length + '개 가운데 **jsonb 칸을 가진 것 '
    + 걸린뷰.length + '개**\n');
  for (const [이름, 꼴, a, b, 칸, rls, 옵션, 본문] of 걸린뷰) {
    console.log('  ● ' + 이름 + ' (' + (꼴 === 'r' ? '표 · RLS ' + rls : 꼴 === 'v' ? '뷰' : '굳힌뷰')
      + ')  [' + [a, b].filter(Boolean).join('+') + ']');
    console.log('      ' + 칸);
    if (꼴 !== 'r') {
      /* ★ 뷰는 기본으로 **만든 사람 권한**으로 돕니다 — 밑 표의 RLS 를 건너뜁니다.
         그래서 ㉠ `security_invoker` 가 켜졌나 ㉡ 본문이 스스로 막나 둘을 봅니다 */
      const 막는것 = (String(본문 || '').match(/is_admin\(\)|마스터인가\(\)|auth\.uid\(\)|운영진인가\(\)/g) || []);
      console.log('      security_invoker ' + (/security_invoker\s*=\s*(on|true)/i.test(옵션 || '') ? '**켜짐**' : '꺼짐')
        + ' · 본문이 보는 것 ' + (막는것.length ? [...new Set(막는것)].join(' ') : '**(없음)**')
        + (옵션 ? ' · 옵션 ' + 옵션 : ''));
    }
  }
}

/* ── ② 회원 응답에 개인정보 꼴이 든 건수 ──────────────── */
if (할까('--개인정보')) {
  const U = cfg.SUPABASE_URL;
  const ANON = cfg.SUPABASE_ANON_KEY;
  const SERVICE = cfg.SUPABASE_SERVICE_KEY;
  const PW = cfg.TEST_PT_PW;
  if (!U || !ANON || !SERVICE) { console.error('✗ SUPABASE_URL·ANON·SERVICE 가 모자랍니다'); process.exit(1); }
  if (!PW) { console.error('✗ TEST_PT_PW 가 없습니다 — 회원으로 로그인해야 detail 이 보입니다'); process.exit(1); }

  console.log('\n══ ② 회원 응답에 개인정보 꼴이 든 건수 ══\n');

  const r0 = await fetch(U + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-pt@potjob.co.kr', password: PW }),
  });
  const j0 = await r0.json();
  if (!j0.access_token) { console.error('✗ test-pt 로그인 실패 ' + r0.status); process.exit(1); }
  const 회원 = { apikey: ANON, Authorization: 'Bearer ' + j0.access_token, 'Content-Type': 'application/json' };
  console.log('○ test-pt 로 로그인했습니다 (회원 눈)');

  /* 회원 화면 공고 — job_posts_pub 전수 (차례를 붙여 쪽을 넘깁니다 · 지침 8-20) */
  const 섬김머리 = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE };
  const 아이디 = [];
  for (let off = 0; ; off += 100) {
    const r = await fetch(U + '/rest/v1/job_posts_pub?select=id&order=id&limit=100&offset=' + off,
      { headers: 섬김머리 });
    if (!r.ok) { console.error('✗ job_posts_pub ' + r.status); process.exit(1); }
    const a = await r.json();
    아이디.push(...a.map((x) => x.id));
    if (a.length < 100) break;
  }
  console.log('○ 회원 화면 공고 ' + 아이디.length + '건\n');

  const 열쇠모음 = new Map();   /* jsonb 칸 → 안에 든 열쇠 이름들 */
  const 걸린것 = [];
  let 빈것 = 0;
  for (const id of 아이디) {
    const r = await fetch(U + '/rest/v1/rpc/job_one', {
      method: 'POST', headers: 회원, body: JSON.stringify({ p_id: String(id) }),
    });
    const t = await r.text();
    if (!r.ok) { console.log('  ✗ ' + id + ' job_one ' + r.status + ' ' + t.slice(0, 120)); continue; }
    let j = null; try { j = JSON.parse(t); } catch { /* 글 그대로 */ }
    if (!j || !Object.keys(j).length) { 빈것++; continue; }

    for (const 칸 of ['detail', '뽑은값', 'evidence', 'payload']) {
      const v = j[칸];
      if (v && typeof v === 'object') {
        if (!열쇠모음.has(칸)) 열쇠모음.set(칸, new Map());
        const m = 열쇠모음.get(칸);
        for (const k of Object.keys(v)) m.set(k, (m.get(k) || 0) + 1);
      }
    }
    const 찾음 = 개인정보찾기(t);
    if (찾음.메일.length || 찾음.전화.length) {
      /* 어느 칸에서 나왔나 — 칸마다 따로 재 봅니다 */
      const 자리 = [];
      for (const 칸 of Object.keys(j)) {
        const s = typeof j[칸] === 'object' ? JSON.stringify(j[칸]) : String(j[칸] ?? '');
        const f = 개인정보찾기(s);
        if (f.메일.length || f.전화.length) 자리.push(칸 + '(' + [...f.메일, ...f.전화].join(' ') + ')');
      }
      걸린것.push({ id, 기관: j.org_name || j['기관'] || '', 자리 });
    }
  }

  console.log('job_one 을 ' + 아이디.length + '번 불렀습니다 — 빈 응답 ' + 빈것 + '건');
  console.log('\n**메일·전화가 든 응답 ' + 걸린것.length + '건**');
  for (const x of 걸린것) {
    console.log('  ● ' + String(x.id).padEnd(18) + String(x.기관).slice(0, 16).padEnd(17)
      + x.자리.join(' · ').slice(0, 160));
  }

  console.log('\n── 회원에게 나가는 jsonb 칸의 열쇠 ──');
  for (const [칸, m] of 열쇠모음) {
    const 줄 = [...m.entries()].sort((a, b) => b[1] - a[1])
      .map(([k, n]) => k + '(' + n + ')').join(' · ');
    console.log('  ' + 칸 + ' — 열쇠 ' + m.size + '가지\n      ' + 줄);
  }

  /* 목록 창구도 같이 — 카드에 통째로 실려 나가는지 */
  const r2 = await fetch(U + '/rest/v1/rpc/job_list', {
    method: 'POST', headers: 회원, body: JSON.stringify({}),
  });
  const t2 = await r2.text();
  const f2 = 개인정보찾기(t2);
  console.log('\n── job_list (인수 없이 한 번) ──');
  console.log('  ' + r2.status + ' · ' + t2.length + '자 · 메일 ' + f2.메일.length
    + ' · 전화 ' + f2.전화.length + ' · 담당자의심 ' + f2.담당자의심.length);
  let 목록열쇠 = '(못 읽음)';
  try {
    const j2 = JSON.parse(t2);
    const 줄 = Array.isArray(j2) ? j2[0] : (j2 && j2.rows ? j2.rows[0] : j2);
    목록열쇠 = 줄 ? Object.keys(줄).join(' · ') : '(빈 응답)';
  } catch { /* 글 그대로 */ }
  console.log('  카드 열쇠 — ' + 목록열쇠);

  /* ── 회원 눈으로 **표·뷰를 바로** 긁어 봅니다 ──────────────
     ① 이 자리에 jsonb 칸이 있었습니다. 권한이 열려 있어도 **줄이 안 오면**
     막힌 것입니다 — 「열려 있다」와 「나온다」는 다릅니다 (지침 12절). */
  console.log('\n── 회원 눈으로 표·뷰를 바로 긁어 봅니다 ──');
  for (const 이름 of ['admin_jobs', 'job_meta', 'alio_compete', 'hosp_sites',
    'site_settings', 'student_specs', '공개글', '공개댓글']) {
    const r = await fetch(U + '/rest/v1/' + encodeURIComponent(이름) + '?select=*&limit=2',
      { headers: 회원 });
    const t = await r.text();
    let 줄수 = '-';
    try { const j = JSON.parse(t); if (Array.isArray(j)) 줄수 = String(j.length); } catch { /* 글 그대로 */ }
    const f = 개인정보찾기(t);
    console.log('  ' + 이름.padEnd(14) + r.status + ' · 줄 ' + String(줄수).padEnd(3)
      + ' · ' + t.length + '자'
      + (f.메일.length || f.전화.length ? '  ★ 메일 ' + f.메일.length + ' · 전화 ' + f.전화.length : '')
      + (r.ok ? '' : '  ' + t.replace(/\s+/g, ' ').slice(0, 90)));
  }
}
