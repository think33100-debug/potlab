/* 손확인 ② — **주소 없는 1층 기관**의 채용 게시판 주소를 세중님이 채웁니다
 * (2026-10-24 세중님 H1)
 *
 *   node tools/손확인_주소.mjs --만들기          docs/손확인_주소_1024.md 를 만듭니다 (100곳)
 *   node tools/손확인_주소.mjs --만들기 --몇개 60
 *   node tools/손확인_주소.mjs --읽기            채운 것을 봅니다 (마른)
 *   node tools/손확인_주소.mjs --읽기 --진짜      기관 표 채용페이지에 넣습니다
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * **사각지대 456곳은 주소를 모르는 곳**입니다 (2026-10-24 확인 — 기관 표·심평원
 * `hosp_url`·병원사이트표 어디에도 없습니다). 열어 볼 거리가 없으니 긁기 계획에
 * 넣을 수 없고, **주소부터** 있어야 합니다. 주소는 **짐작하지 않습니다** (지침 3절) —
 * 세중님이 한 번 보고 적어 주시면 그것을 근거로 담습니다.
 *
 * ── 우선순위 (세중님 H1) ────────────────────────────────────
 *   상급종합 → 대학병원 → 종합병원 → 공공보건의료 → 보건기관(보건소 묶음)
 *   같은 갈래 안에서는 **이름 차례**로 (고르는 데 제 취향이 들어가지 않게)
 *
 * ── 채운 뒤 ─────────────────────────────────────────────────
 *   `기관.채용페이지` 에 넣고 `불변근거.채용페이지 = '세중 손확인 <날짜>'` 를 적습니다.
 *   그 뒤 그 기관은 **긁기 후보**가 됩니다 (주소가 생겼으니까요).
 * ★ 읽을 때 **주소 꼴만** 받습니다 (http/https·도메인) — 아니면 건너뛰고 적어 둡니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { 표만들기 } from './긁기/목록주소필요.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 만들기 = argv.includes('--만들기');
const 읽기 = argv.includes('--읽기');
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 100) || 100;
const 문서자리 = path.join(여기, '..', 'docs', '손확인_주소_1024.md');

/** 주소 꼴인가 — `홈페이지손질` 과 같은 자를 씁니다 (지침 6절) */
export const 주소꼴인가 = (v) => {
  const t = String(v || '').trim();
  if (!t || t.includes('@')) return false;
  const 집 = t.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '');
  return /\.[A-Za-z]{2,}$/.test(집);
};

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('주소를 받는다', 주소꼴인가('https://www.a-hosp.or.kr/recruit'));
  보('www 도 받는다', 주소꼴인가('www.b.or.kr'));
  보('메일은 안 받는다', !주소꼴인가('a@b.or.kr'));
  보('빈 값은 안 받는다', !주소꼴인가('') && !주소꼴인가(null));
  보('「없음」 같은 말은 안 받는다', !주소꼴인가('없음'));
  보('전화번호는 안 받는다', !주소꼴인가('054-123-4567'));
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}
if (!만들기 && !읽기) {
  console.error('쓰는 법 — --만들기 | --읽기 [--진짜] [--몇개 100] [--자기점검]');
  process.exit(2);
}

const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!cfg.SUPABASE_DB_URL) { console.error('✗ SUPABASE_DB_URL 이 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const u = new URL(cfg.SUPABASE_DB_URL);
const env = {
  ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require',
};
function psql(sql, 꼴 = ['-X', '-A', '-t', '-q', '-F', '\t']) {
  const 임시 = path.join(os.tmpdir(), '손확인주소_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 따옴 = (s) => String(s == null ? '' : s).replace(/'/g, "''");

if (만들기) {
  /* ★ 2026-10-24 밤 (세중님 5번) — **남는 것만** 냅니다.
     홈페이지를 얻은 곳(342곳)은 **우리가 채용 게시판을 찾습니다** — 세중님 일이 아닙니다.
     여기 남는 것은 ① 주소를 아예 모르는 곳 ② 「포털로 들어옴」이 아닌 곳입니다. */
  const 줄들 = psql(`
    with g as materialized (
      select "갈래", coalesce("종류",'') as 종류, "기관",
             coalesce("시도",'') as 시도, coalesce("시군구",'') as 시군구
        from "일층병원_구멍"() where "상태" = '사각지대'
    ), f as materialized (
      /* ★ 세중님 ㉫ — 기관 표는 **번호로** 잇습니다 (이름키로는 딴 병원 줄이 붙습니다) */
      select g.*, "기관번호_이름으로"(g."기관") as 번호 from g
    ), 포털 as materialized (
      /* 그 시군구 이름 + 「보건」 으로 최근 90일 공고가 들어오는 곳 (클린아이 꼴) */
      select distinct j.org_name from job_posts j
       where j.first_seen > (now() at time zone 'Asia/Seoul')::date - 90
         and j.org_name like '%보건%'
    )
    select f."갈래", f.종류, f."기관", f.시도, f.시군구,
           coalesce(o."홈페이지",''),
           /* 후보 주소 — 우리가 **아는데 확인은 못 한** 것 (열다 막혔거나 기관을 못 맞춤) */
           coalesce((select min(h.hosp_url) from hira_org h
                      where h.name_key = hira_name_key(f."기관")
                        and coalesce(h.hosp_url,'') <> ''
                     having count(distinct h.hosp_url) = 1), ''),
           coalesce((select min(btrim(p.homepage)) from public_hospitals p
                      where hira_name_key(p.name) = hira_name_key(f."기관")
                        and coalesce(btrim(p.homepage),'') <> ''
                     having count(distinct btrim(p.homepage)) = 1), ''),
           /* ★ 보건기관에만 씁니다. 전에는 민간 병원도 걸렸습니다 —
              「서울 구로구 보건소」 공고가 들어온다고 **구로성심병원**이 들어오는 것이
              아닙니다 (같은 시군구에 있다는 것뿐입니다) */
           case when f."갈래" = '보건기관' and f.시군구 <> '' and exists (
                  select 1 from 포털 t where t.org_name like '%' || f.시군구 || '%')
                then '포털' else '' end
      from f left join 기관 o on o."기관번호" = f.번호
     where coalesce(o."홈페이지",'') = ''
     /* 세중님 5번 — 종합병원·공공병원 맨 위, 보건소는 아래 */
     order by case f."갈래"
                when '종합병원' then 1 when '상급종합' then 2 when '대학병원' then 3
                when '공공보건의료' then 4 when '보건기관' then 5 else 6 end,
              f."기관"
     limit ${몇개};`).split('\n').filter(Boolean).map((l) => l.split('\t'));

  const 포털것 = 줄들.filter((r) => r[8] === '포털');
  const 물을것 = 줄들.filter((r) => r[8] !== '포털');
  const 셈2 = {};
  for (const r of 물을것) 셈2[r[0]] = (셈2[r[0]] || 0) + 1;

  const 줄 = ['# 손확인 ② — **주소를 모르는 1층 기관** (2026-10-24 밤 · 다시 만듦)', '',
    '오늘 밤에 **심평원 `hospUrl` 과 공공보건의료 현황표**에서 주소를 끌어와 열어 보고',
    '**342곳**의 홈페이지를 기관 표에 담았습니다. 그 곳들은 **제가 채용 게시판을 찾습니다** —',
    '여기 남은 것은 **주소를 아예 모르거나, 알지만 열어서 확인이 안 된 곳**입니다.', '',
    '```',
    '채우는 법   「채용 게시판 주소」 칸에 **열어서 공고 목록이 보이는 주소**를 적어 주십시오',
    '           「후보 주소」가 적혀 있으면 그것이 맞는지만 봐 주셔도 됩니다 (우리가 못 연 주소입니다)',
    '           없으면 「없음」, 공고를 안 올리는 곳이면 「안 올림」 이라고 적어 주셔도 됩니다',
    '읽는 길     node tools/손확인_주소.mjs --읽기 --진짜',
    '           → 기관 표 `채용페이지` 에 담고 근거를 「세중 손확인 <날짜>」 로 남깁니다',
    '차례       ' + Object.entries(셈2).map(([k, v]) => k + ' ' + v).join(' · '),
    '```', '',
    '| # | 갈래 | 기관 | 지역 | 후보 주소 (우리가 못 연 것) | 채용 게시판 주소 |',
    '|---:|---|---|---|---|---|'];
  물을것.forEach((r, i) => {
    const [갈래, , 기관, 시도, 시군구, , 심주소, 공공주소] = r;
    const 후보 = 심주소 || 공공주소;
    줄.push('| ' + (i + 1) + ' | ' + 갈래 + ' | ' + String(기관).replace(/\|/g, '/')
      + ' | ' + (시도 + ' ' + 시군구).trim()
      + ' | ' + (후보 ? String(후보).slice(0, 46) + (심주소 ? ' (심평원)' : ' (공공표)') : '**모릅니다**')
      + ' |  |');
  });
  if (포털것.length) {
    줄.push('', '## 포털로 들어옴 — **손확인 필요 없습니다** (' + 포털것.length + '곳)', '',
      '그 시군구 이름 + 「보건」 으로 최근 90일 공고가 **클린아이로 들어옵니다**.',
      '보건소 홈페이지를 긁을 자리가 아닙니다.',
      '★ 같은 이름 시군구(고성군 강원·경남 꼴)는 섞일 수 있습니다 — 2곳이 그 꼴입니다.', '',
      '```', ...포털것.map((r) => '  ' + r[2] + (r[4] ? ' (' + r[3] + ' ' + r[4] + ')' : '')), '```');
  }
  /* ★ 2026-10-24 세중님 4번 — ⑤목록 아님 22곳도 **같은 문서**에 붙입니다
     (주소는 아는데 그 주소가 목록이 아닌 곳 · tools/긁기/목록주소필요.mjs 한 자리) */
  줄.push(...표만들기());
  줄.push('', '★ 제가 채우지 않습니다 — **주소 짐작 금지** (지침 3절).',
    '★ 다 채우지 않아도 됩니다. 채운 줄만 읽습니다.');
  fs.writeFileSync(문서자리, 줄.join('\n') + '\n');
  console.log('○ docs/손확인_주소_1024.md 에 적었습니다 — ' + 줄들.length + '곳');
  const 셈 = {};
  for (const r of 줄들) 셈[r[0]] = (셈[r[0]] || 0) + 1;
  console.log('  갈래별 — ' + Object.entries(셈).map(([k, v]) => k + ' ' + v).join(' · '));
  process.exit(0);
}

/* ── 읽기 ── */
if (!fs.existsSync(문서자리)) { console.error('✗ 문서가 없습니다 — 먼저 --만들기'); process.exit(1); }
/* ★ 2026-10-24 밤 — 칸 **차례를 머리글에서** 읽습니다. 전에는 「기관은 넷째 칸」으로
   박아 두었는데, 표를 고치면(칸을 더하거나 빼면) 읽는 쪽이 **조용히 엉뚱한 칸**을
   집습니다. 이 문서에는 표가 둘(사각지대 · ⑤목록 아님)이고 칸 수가 다릅니다.
   그래서 「기관」이 든 칸과 **맨 끝 칸(적어 주시는 자리)**을 머리글로 찾습니다 */
const 채운것 = [];
let 기관칸 = -1; let 주소칸 = -1;
for (const l of fs.readFileSync(문서자리, 'utf8').split(/\r?\n/)) {
  if (/^\|\s*#\s*\|/.test(l)) {
    const 머리 = l.split('|').slice(1, -1).map((s) => s.trim());
    기관칸 = 머리.findIndex((h) => h === '기관');
    주소칸 = 머리.length - 1;
    continue;
  }
  if (!/^\|\s*\d+\s*\|/.test(l)) continue;
  if (기관칸 < 0 || 주소칸 < 0) continue;
  const 칸 = l.split('|').slice(1, -1).map((s) => s.trim());
  if (칸.length <= 주소칸) continue;
  const 주소 = 칸[주소칸].replace(/`/g, '').trim();
  if (!주소) continue;
  채운것.push({ 갈래: 칸[1], 기관: 칸[기관칸], 주소 });
}
console.log('채워진 줄 **' + 채운것.length + '개**');
const 쓸것 = 채운것.filter((x) => 주소꼴인가(x.주소));
const 말만 = 채운것.filter((x) => !주소꼴인가(x.주소));
console.log('  주소 꼴 ' + 쓸것.length + '개 · 말(「없음」·「안 올림」 등) ' + 말만.length + '개');
for (const x of 쓸것) console.log('  ○ ' + x.기관.slice(0, 22).padEnd(23) + x.주소.slice(0, 60));
for (const x of 말만) console.log('  · ' + x.기관.slice(0, 22).padEnd(23) + '「' + x.주소 + '」 — 담지 않습니다');
if (!쓸것.length) { console.log('\n담을 주소가 없습니다'); process.exit(0); }
if (!진짜) { console.log('\n[마른] 아무것도 안 담았습니다 — --진짜 로 담습니다'); process.exit(0); }

const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date();
const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 오늘 = String(d.getFullYear()) + '-' + 두(d.getMonth() + 1) + '-' + 두(d.getDate());
const 되돌림 = path.join(되돌림터, '손확인주소_되돌리기_' + 때 + '.sql');
const 되돌림줄 = ['/* 되돌리기 — 손확인 ② 주소를 담기 전 값 */'];
let 한것 = 0;
for (const x of 쓸것) {
  /* ★ 2026-10-24 세중님 ㉫ — 전에는 `이름키 = … limit 1` 로 **아무 줄 하나**를 집어
     세중님이 적어 주신 주소를 거기 썼습니다. 같은 이름 다른 병원이면 **딴 병원에
     적는 것**입니다. 이제 번호로 찾고, 번호가 안 풀리면 **건너뜁니다** */
  const 전 = psql(`select coalesce(o."채용페이지",''), o."기관번호" from 기관 o
     where o."기관번호" = "기관번호_이름으로"('${따옴(x.기관)}');`);
  const [옛주소, 번호] = (전 || '\t').split('\t');
  if (!번호) { console.log('  ✗ ' + x.기관 + ' — 기관 표에 그 이름이 없습니다 (건너뜁니다)'); continue; }
  되돌림줄.push(`update 기관 set "채용페이지" = ${옛주소 ? "'" + 따옴(옛주소) + "'" : 'null'} `
    + `where 기관번호 = '${따옴(번호)}';`);
  psql(`update 기관
          set "채용페이지" = '${따옴(x.주소)}',
              "불변근거" = "불변근거" || jsonb_build_object('채용페이지', '세중 손확인 ${오늘}'),
              "고친때" = now()
        where 기관번호 = '${따옴(번호)}';`);
  한것++;
}
fs.writeFileSync(되돌림, 되돌림줄.join('\n') + '\n', 'utf8');
console.log('\n○ ' + 한것 + '곳에 담았습니다 · 되돌림 ' + 되돌림);
console.log('\n── 기관 표 채용페이지 ──\n' + psql(`
  select count(*) || '곳 (손확인 근거 ' ||
         count(*) filter (where "불변근거"->>'채용페이지' like '세중 손확인%') || '곳)'
    from 기관 where "채용페이지" is not null;`));
