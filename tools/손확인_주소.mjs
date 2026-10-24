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
  const 줄들 = psql(`
    select g."갈래", coalesce(g."종류",''), g."기관", coalesce(g."시도",''), coalesce(g."시군구",''),
           coalesce(o."기관번호",''), coalesce(o.ykiho,''),
           coalesce((select h.ykiho from hira_org h where h.name_key = hira_name_key(g."기관") limit 1), ''),
           /* 이미 주소를 아는 곳은 적어 둡니다 — 세중님이 그 줄을 비워 두시게 */
           coalesce(o."채용페이지", ''), coalesce(o."불변근거"->>'채용페이지', '')
      from "일층병원_구멍"() g
      left join 기관 o on o.이름키 = hira_name_key(g."기관")
     where g."상태" = '사각지대'
     /* ★ 2026-10-24 세중님 4번 — **종합병원 먼저**입니다 (가장 많고 공고도 큽니다),
        그다음 상급종합·대학병원, 그다음 공공보건의료 */
     order by case g."갈래"
                when '종합병원' then 1 when '상급종합' then 2 when '대학병원' then 3
                when '공공보건의료' then 4 when '보건기관' then 5 else 6 end,
              g."기관"
     limit ${몇개};`).split('\n').filter(Boolean).map((l) => l.split('\t'));

  const 줄 = ['# 손확인 ② — **주소 없는 1층 기관**의 채용 게시판 (2026-10-24)', '',
    '`사각지대 456곳` 가운데 **우선순위 ' + 줄들.length + '곳**입니다 (상급종합 → 대학병원 →',
    '종합병원 → 공공보건의료 → 보건기관). 이 곳들은 **우리가 주소를 모릅니다** —',
    '기관 표·심평원 `hosp_url`·병원사이트표에 하나도 없습니다. 주소는 **짐작하지 않습니다**.', '',
    '```',
    '채우는 법   「채용 게시판 주소」 칸에 **열어서 공고 목록이 보이는 주소**를 적어 주십시오',
    '           없으면 「없음」, 공고를 안 올리는 곳이면 「안 올림」 이라고 적어 주셔도 됩니다',
    '읽는 길     node tools/손확인_주소.mjs --읽기 --진짜',
    '           → 기관 표 `채용페이지` 에 담고 근거를 「세중 손확인 <날짜>」 로 남깁니다',
    '           → 그 뒤 그 기관은 **긁기 후보**가 됩니다',
    '```', '',
    '| # | 갈래 | 종류 | 기관 | 지역 | 요양기관기호 | 채용 게시판 주소 |',
    '|---:|---|---|---|---|---|---|'];
  let 이미 = 0;
  줄들.forEach((r, i) => {
    const [갈래, 종류, 기관, 시도, 시군구, , ykiho1, ykiho2, 채용페이지, 근거] = r;
    const 기호 = ykiho1 || ykiho2;
    /* ★ 2026-10-24 세중님 4번 — **이미 찾은 주소는 적어 둡니다** (세중님 일 줄이기).
       긁기·사이트표에서 온 것이면 그 자리에 「(이미 있음)」 으로 적고 빈 칸을 안 둡니다 */
    const 칸 = 채용페이지
      ? ' ~~' + String(채용페이지).slice(0, 44) + '~~ (이미 있음 · ' + (근거 || '사이트표') + ') '
      : '  ';
    if (채용페이지) 이미++;
    줄.push('| ' + (i + 1) + ' | ' + 갈래 + ' | ' + 종류 + ' | ' + String(기관).replace(/\|/g, '/')
      + ' | ' + 시도 + ' ' + 시군구 + ' | ' + (기호 ? '`' + 기호 + '`' : '(없음)')
      + ' |' + 칸 + '|');
  });
  if (이미) {
    줄.splice(5, 0, '★ ' + 이미 + '곳은 **이미 주소가 있습니다** — 그 줄은 비워 두셔도 됩니다.', '');
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
const 채운것 = [];
for (const l of fs.readFileSync(문서자리, 'utf8').split(/\r?\n/)) {
  if (!/^\|\s*\d+\s*\|/.test(l)) continue;
  const 칸 = l.split('|').slice(1, -1).map((s) => s.trim());
  if (칸.length < 7) continue;
  const 주소 = 칸[6].replace(/`/g, '').trim();
  if (!주소) continue;
  채운것.push({ 갈래: 칸[1], 종류: 칸[2], 기관: 칸[3], 지역: 칸[4],
    기호: 칸[5].replace(/`|\(없음\)/g, '').trim(), 주소 });
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
  const 전 = psql(`select coalesce("채용페이지",''), 기관번호 from 기관
     where 이름키 = hira_name_key('${따옴(x.기관)}') limit 1;`);
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
