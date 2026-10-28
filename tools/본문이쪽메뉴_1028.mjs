/* 본문이 **쪽 메뉴**인 공고 — 가려내 보류함으로 (2026-10-28 세중님 2번)
 *
 *   node tools/본문이쪽메뉴_1028.mjs --자기점검   판정 자 견본
 *   node tools/본문이쪽메뉴_1028.mjs             회원 화면 전수 (읽기만)
 *   node tools/본문이쪽메뉴_1028.mjs --진짜       그 공고들을 보류함으로
 *
 * ── 왜 ──────────────────────────────────────────────────────
 * 삼성창원병원(HS2028439844)·경기도의료원 수원병원(HS102260084) 의 본문이
 * **공고 내용이 아니라 쪽 메뉴**였습니다 —
 *   「삼성창원병원 인재채용-채용공고 콘텐츠 바로가기 회원가입 로그인 병원소개 …
 *    MY PAGE 지원현황 합격조회 증명서 신청 인재DB …」
 * 긁기가 본문 자리를 못 찾으면 **쪽 전체 글**을 담습니다. 그러면 칸이 비고,
 * 회원은 「공고문 확인」만 봅니다. **상세를 못 읽은 것과 같은 자리**입니다.
 *
 * ── 판정 자 (여기 한 자리) ───────────────────────────────────
 *   ㉠ **메뉴 낱말**이 몇 가지나 나오나 — 로그인·회원가입·바로가기·오시는 길 …
 *   ㉡ **공고 낱말**이 몇 가지나 나오나 — 접수·자격·모집·제출·채용인원 …
 *   → 메뉴 낱말이 **다섯 가지 이상**이고 공고 낱말이 **둘 이하**면 「쪽 메뉴」입니다
 *   ★ 글자 수로는 안 가립니다 — 메뉴가 700자든 3,000자든 메뉴입니다
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/* ── 판정 자 ── */
export const 메뉴낱말 = ['로그인', '회원가입', '바로가기', '오시는 길', '오시는길',
  'MY PAGE', '마이페이지', '사이트맵', '개인정보처리방침', '이용약관', '패밀리사이트',
  '창닫기', '전체메뉴', '주메뉴', '본문바로가기', 'COPYRIGHT', '저작권', '관련사이트',
  '진료예약', '외래진료안내', '장례식장', '건강검진', '고객의소리', '조직도', '병원연혁'];
export const 공고낱말 = ['접수기간', '접수방법', '응시자격', '지원자격', '모집분야',
  '모집인원', '채용인원', '제출서류', '전형방법', '근무조건', '급여', '임용', '서류전형',
  '면접전형', '근무지', '고용형태', '자격요건', '우대사항', '채용절차'];

export function 쪽메뉴인가(글) {
  const t = String(글 || '');
  const 메뉴 = 메뉴낱말.filter((w) => t.includes(w)).length;
  const 공고 = 공고낱말.filter((w) => t.includes(w)).length;
  return { 됨: 메뉴 >= 5 && 공고 <= 2, 메뉴, 공고 };
}

if (process.argv.includes('--자기점검')) {
  const 잼 = []; const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 메뉴글 = '삼성창원병원 인재채용-채용공고 콘텐츠 바로가기 회원가입 로그인 병원소개 '
    + '병원소개 미션/비전/핵심가치 복리후생 선배와의 만남 찾아오시는 길 채용공고 '
    + 'MY PAGE MY PAGE 지원현황 합격조회 증명서 신청 인재DB 홈으로 로그인 회원가입';
  const 메뉴글2 = '경기도의료원 수원병원 병원소식 채용정보-상세화면 본문바로가기 주메뉴바로가기 '
    + '조직안내 진료안내 오시는 길 개인정보처리방침 COPYRIGHT 창닫기 패밀리사이트';
  const 참공고 = '2026년 제4차 직원 채용 공고 1. 모집분야 및 인원 작업치료사 1명 '
    + '2. 응시자격 작업치료사 면허 소지자 3. 접수기간 2026. 10. 1. ~ 10. 15. '
    + '4. 제출서류 이력서, 자기소개서 5. 전형방법 서류전형 후 면접전형 6. 근무조건 급여 내규에 따름';
  const 섞임 = 참공고 + ' 로그인 회원가입 바로가기 오시는 길 사이트맵 창닫기';
  보('★ 삼성창원병원 꼴 → 쪽 메뉴', 쪽메뉴인가(메뉴글).됨);
  보('★ 경기도의료원 꼴 → 쪽 메뉴', 쪽메뉴인가(메뉴글2).됨);
  보('참 공고문 → 쪽 메뉴 아님', !쪽메뉴인가(참공고).됨);
  보('참 공고문 + 메뉴 띠 → 쪽 메뉴 **아님** (공고 낱말이 셋 넘음)', !쪽메뉴인가(섞임).됨);
  보('빈 글 → 쪽 메뉴 아님 (메뉴 낱말이 0)', !쪽메뉴인가('').됨);
  보('짧은 참 공고 → 아님', !쪽메뉴인가('작업치료사 모집인원 1명 접수기간 10/1~10/15').됨);
  보('메뉴 넷만 → 아님 (다섯 이상이어야)',
    !쪽메뉴인가('로그인 회원가입 바로가기 사이트맵').됨);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const 뿌리 = path.join(import.meta.dirname, '..');
const 진짜 = process.argv.includes('--진짜');
const cfg = {};
for (const f of ['.env', '.env.local']) {
  const p = path.join(뿌리, f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!cfg.SUPABASE_DB_URL) { console.error('✗ SUPABASE_DB_URL 이 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const u = new URL(cfg.SUPABASE_DB_URL);
const env = { ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require' };
function psql(sql, 꼴 = ['-X', '-q']) {
  const 임시 = path.join(os.tmpdir(), '쪽메뉴_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1200)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q', '-F', '\t']);
const 머리 = '\\pset pager off\n';

/* 본문을 **한 공고 한 줄**로 받습니다 (줄바꿈·탭을 지웁니다 — 안 지우면 줄이 쪼개집니다) */
const 줄들 = 글만(`
  select p.id || E'\\t' || p.source || E'\\t' || left(p.org_name, 24) || E'\\t'
      || left(regexp_replace(coalesce((select string_agg(b.body, ' ' order by b.ord)
                                        from job_body b where b.job_id = p.id), ''),
                             '[\\r\\n\\t]+', ' ', 'g'), 9000)
    from job_posts p join job_posts_pub v on v.id = p.id
   order by p.id;`).split('\n').filter(Boolean);

const 걸린것 = [];
let 본문있는것 = 0;
for (const l of 줄들) {
  const [id, 출처, 기관, 본문] = l.split('\t');
  if (본문 && 본문.trim()) 본문있는것 += 1;
  const r = 쪽메뉴인가(본문 || '');
  if (r.됨) 걸린것.push({ id, 출처, 기관, ...r, 길이: (본문 || '').length });
}
console.log('══ 회원 화면 ' + 줄들.length + '건 — 본문이 있는 것 ' + 본문있는것 + '건 ══');
console.log('**본문이 쪽 메뉴인 공고 ' + 걸린것.length + '건**\n');
for (const x of 걸린것) {
  console.log('  ' + x.id.padEnd(16) + x.출처.padEnd(5) + x.기관.slice(0, 20).padEnd(22)
    + '메뉴 낱말 ' + String(x.메뉴).padStart(2) + '가지 · 공고 낱말 ' + x.공고
    + '가지 · 본문 ' + x.길이 + '자');
}
if (걸린것.length) {
  console.log('\n── 그 공고들의 칸 상태 ──');
  console.log(psql(머리 + `
    select p.id, p.apply_to as 마감, p.headcount as 인원,
           coalesce(p.work_place,'(없음)') as 근무지,
           coalesce(p.detail->>'연봉', p."뽑은값"->>'예상연봉', '(없음)') as 연봉,
           coalesce(p."뽑은값"->>'지원자격", p.detail->>'지원자격', '(없음)') as 지원자격
      from job_posts p where p.id in (${걸린것.map((x) => "'" + x.id + "'").join(',')})
     order by p.id;`).replace(/"지원자격"/g, "'지원자격'"));
}

if (!진짜) {
  console.log('\n[마른] 아무것도 안 바꿨습니다 — --진짜 로 보류함으로 보냅니다');
  process.exit(0);
}
if (!걸린것.length) { console.log('\n보낼 것이 없습니다'); process.exit(0); }

const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, '쪽메뉴_보류함_되돌리기_' + 때 + '.sql');
const 목록 = 걸린것.map((x) => "'" + x.id + "'").join(',');
const 전값 = 글만(`select p.id, p.hold::text, coalesce(p.edited_fields::text,'{}')
  from job_posts p where p.id in (${목록}) order by p.id;`);
fs.writeFileSync(되돌림, ['/* 되돌리기 — 2026-10-28 본문이 쪽 메뉴인 공고를 보류함으로 */',
  ...전값.split('\n').filter(Boolean).map((l) => {
    const [id, h, ef] = l.split('\t');
    return `update job_posts set hold = ${h}, edited_fields = '${ef}'::text[] where id = '${id}';`;
  })].join('\n') + '\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림 + ' (' + 걸린것.length + '건)');

/* ★ hold 만 켜면 수집기 한 바퀴에 풀립니다 — edited_fields 에 'hold' 를 함께 (지침 8-24) */
console.log(psql(머리 + `
select set_config('app.누가', '본문이 쪽 메뉴 2026-10-28 (상세 못 읽음)', true);
update job_posts p set hold = true,
       edited_fields = (select array_agg(distinct x)
                          from unnest(coalesce(p.edited_fields, '{}') || array['hold']) x)
 where p.id in (${목록}) and not p.hold and not p.hidden;`));
console.log('── 후 ──');
console.log(psql(머리 + `
  select count(*) as "보낸 것", count(*) filter (where p.hold) as 보류함,
         count(*) filter (where exists (select 1 from job_posts_pub v where v.id = p.id))
           as "아직 회원 화면(0 이어야)"
    from job_posts p where p.id in (${목록});`));
console.log('회원 화면 — ' + 글만('select count(*) from job_posts_pub;') + '건');
