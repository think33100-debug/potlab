/* 세중님이 채운 **손확인 ① 매핑 문서를 읽어** 기관 번호를 확정합니다
 * (2026-10-24 세중님 M3)
 *
 *   node tools/손확인_매핑_읽기.mjs            읽어서 할 일만 (기본 · 마른)
 *   node tools/손확인_매핑_읽기.mjs --진짜      적용합니다
 *   node tools/손확인_매핑_읽기.mjs --자기점검   읽는 규칙만
 *
 * ── 읽는 문서 ───────────────────────────────────────────────
 * `docs/손확인_매핑_1024.md` 의 표. 칸 일곱 —
 *   기관(이름+`<code>번호</code>`) | 공고 | 회원 화면 | 의심 까닭 | 견본 공고 | **맞음/아님** | **바꿀 번호**
 *
 * ── 하는 일 ─────────────────────────────────────────────────
 *   맞음        `기관.확인한때`·`확인한사람` 을 찍습니다 → **의심에서 빠집니다**
 *               (기관표채우기() 도 그 줄을 안 덮습니다)
 *   아님        그 기관번호가 붙은 공고를 **기관 없음**으로 (기관번호 null ·
 *               연결상태 `사람` · 연결근거 `손확인(아님)`) — 규칙이 다시 안 덮습니다
 *   바꿀 번호    그 공고들을 **그 번호로** (연결상태 `사람` · 연결근거 `손확인(번호)`)
 *
 * ★ 빈 칸은 **아무것도 하지 않습니다.** 짐작으로 채우지 않습니다 (지침 10-3).
 * ★ `칸기록` 에 칸 `기관번호` 로 남깁니다 (트리거는 그 칸을 안 봅니다 — 손으로 넣습니다).
 * ★ 되돌림 글을 `~/되돌림/` 에 남깁니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');

/** 표 한 줄을 읽습니다 — 채운 것만 돌려줍니다 */
export function 줄읽기(줄) {
  if (!/^\|/.test(줄.trim())) return null;
  const 칸 = 줄.split('|').slice(1, -1).map((s) => s.trim());
  if (칸.length < 7) return null;
  const 번호 = (칸[0].match(/<code>([^<]+)<\/code>/) || [])[1];
  if (!번호) return null;
  const 판정 = 칸[5].replace(/\s+/g, '');
  const 바꿀번호 = 칸[6].replace(/`|<code>|<\/code>/g, '').trim();
  if (!판정 && !바꿀번호) return null;
  const 뜻 = /^맞음|맞다|○|O$/i.test(판정) ? '맞음'
    : /^아님|아니|틀림|X|✗$/i.test(판정) ? '아님' : null;
  if (!뜻 && !바꿀번호) return null;
  return { 기관번호: 번호, 판정: 뜻, 바꿀번호: 바꿀번호 || null,
    이름: 칸[0].replace(/<br>[\s\S]*$/, '').trim() };
}

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 머리 = '| 제주의료원 <br><code>NAME:제주의료원</code> | 6 | 1 | 심평원에 2곳 | CE80390 |';
  보('빈 칸은 안 읽는다', 줄읽기(머리 + '  |  |') === null);
  보('맞음을 읽는다', 줄읽기(머리 + ' 맞음 |  |')?.판정 === '맞음');
  보('아님을 읽는다', 줄읽기(머리 + ' 아님 |  |')?.판정 === '아님');
  보('○ 도 맞음', 줄읽기(머리 + ' ○ |  |')?.판정 === '맞음');
  보('바꿀 번호를 읽는다',
    줄읽기(머리 + '  | HIRA:11111111 |')?.바꿀번호 === 'HIRA:11111111');
  보('기관번호를 집는다', 줄읽기(머리 + ' 맞음 |  |')?.기관번호 === 'NAME:제주의료원');
  /* ★ 2026-10-27 세중님 3번 — 짧은 표의 두 꼴도 읽습니다 */
  const 짧은 = '| 「동화의원」 <br><code>POST:WNK1311</code> | 제목 | 경남 창원 | 후보 | WNK1311 [WN] |';
  보('POST: 줄을 읽는다', 줄읽기(짧은 + '  | HIRA:zzz |')?.기관번호 === 'POST:WNK1311');
  보('POST: 줄의 바꿀 번호를 읽는다', 줄읽기(짧은 + '  | HIRA:zzz |')?.바꿀번호 === 'HIRA:zzz');
  보('POST: 줄도 아님을 읽는다', 줄읽기(짧은 + ' 아님 |  |')?.판정 === '아님');
  보('표가 아닌 줄은 null', 줄읽기('그냥 글') === null);
  보('머리글 줄은 null', 줄읽기('|---|---:|---:|---|---|---|---|') === null);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

/* ★ 2026-10-27 세중님 3번 — 짧은 표(docs/손확인_오늘_1027.md)도 **함께** 읽습니다 */
const 문서들 = ['손확인_매핑_1024.md', '손확인_오늘_1027.md']
  .map((n) => path.join(여기, '..', 'docs', n)).filter((p) => fs.existsSync(p));
if (!문서들.length) { console.error('✗ 손확인 문서가 없습니다'); process.exit(1); }
for (const p of 문서들) console.log('  읽은 문서 — ' + path.basename(p));
const 할것 = 문서들.flatMap((p) => fs.readFileSync(p, 'utf8').split(/\r?\n/).map(줄읽기).filter(Boolean));
console.log('손확인 문서에서 **채워진 줄 ' + 할것.length + '개**를 읽었습니다');
if (!할것.length) { console.log('아직 채운 줄이 없습니다 — 세중님이 채우면 다시 돌립니다'); process.exit(0); }
for (const x of 할것) {
  console.log('  ● ' + x.이름.padEnd(20) + x.기관번호.padEnd(24)
    + (x.판정 || '-') + (x.바꿀번호 ? ' → ' + x.바꿀번호 : ''));
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
function psql(sql, 꼴 = ['-X', '-A', '-q', '-F', '\t']) {
  const 임시 = path.join(os.tmpdir(), '손확인매핑_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 따옴 = (s) => String(s == null ? '' : s).replace(/'/g, "''");
/* ★ 그 줄이 가리키는 **공고를 고르는 조건** 한 자리 (2026-10-27 세중님 3번)
   `NAME:`·`HIRA:` 는 그 기관번호가 붙은 공고 · `POST:` 는 **그 공고 한 건**입니다
   (안 붙은 공고는 기관번호가 없어서 번호로 가리킬 수가 없습니다) */
const 공고조건 = (키) => (String(키).startsWith('POST:')
  ? `p.id = '${따옴(String(키).slice(5))}'`
  : `p."기관번호" = '${따옴(키)}'`);
const 공고조건2 = (키) => 공고조건(키).replace(/^p[.]/, '');

console.log('\n── 붙어 있는 공고 ──');
for (const x of 할것) {
  console.log('  ' + x.기관번호 + ' — ' + psql(`select count(*) || '건 (회원 화면 '
      || count(*) filter (where exists (select 1 from job_posts_pub v where v.id = p.id)) || '건)'
    from job_posts p where ${공고조건(x.기관번호)};`, ['-X', '-A', '-t', '-q']).trim());
}

if (!진짜) { console.log('\n[마른] 아무것도 안 바꿨습니다 — --진짜 로 적용합니다'); process.exit(0); }

const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date();
const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림 = path.join(되돌림터, '손확인매핑_되돌리기_' + 때 + '.sql');
const 되돌림줄 = ['/* 되돌리기 — 손확인 매핑 적용 전 값 */'];
for (const x of 할것) {
  const 전 = psql(`select p.id, coalesce(p."기관번호",''), coalesce(p."연결상태",''), coalesce(p."연결근거",'')
    from job_posts p where ${공고조건(x.기관번호)};`, ['-X', '-A', '-t', '-q']);
  for (const l of 전.split('\n').filter(Boolean)) {
    const [id, 번호, 상태, 근거] = l.split('\t');
    되돌림줄.push(`update job_posts set "기관번호" = ${번호 ? "'" + 따옴(번호) + "'" : 'null'}, `
      + `"연결상태" = ${상태 ? "'" + 따옴(상태) + "'" : 'null'}, `
      + `"연결근거" = ${근거 ? "'" + 따옴(근거) + "'" : 'null'} where id = '${따옴(id)}';`);
  }
  if (!x.기관번호.startsWith('POST:')) {
    되돌림줄.push(`update 기관 set "확인한때" = null, "확인한사람" = null where 기관번호 = '${따옴(x.기관번호)}';`);
  }
}
fs.writeFileSync(되돌림, 되돌림줄.join('\n') + '\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림 + ' (' + (되돌림줄.length - 1) + '줄)');

let 한것 = 0;
for (const x of 할것) {
  if (x.바꿀번호) {
    psql(`insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
          select p.id, '기관번호', p."기관번호", '${따옴(x.바꿀번호)}',
                 '세중 손확인(매핑 1024)', '손확인 문서에 바꿀 번호를 적으셨습니다'
            from job_posts p where ${공고조건(x.기관번호)};
          update job_posts set "기관번호" = '${따옴(x.바꿀번호)}', "연결상태" = '사람',
                 "연결근거" = '손확인(번호)'
           where ${공고조건2(x.기관번호)};`);
    한것++;
  } else if (x.판정 === '아님') {
    psql(`insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
          select p.id, '기관번호', p."기관번호", '(기관 없음)',
                 '세중 손확인(매핑 1024)', '손확인에서 「아님」'
            from job_posts p where ${공고조건(x.기관번호)};
          update job_posts set "기관번호" = null, "연결상태" = '사람',
                 "연결근거" = '손확인(아님)'
           where ${공고조건2(x.기관번호)};`);
    한것++;
  } else if (x.판정 === '맞음') {
    if (x.기관번호.startsWith('POST:')) {
      console.error('  ⚠ ' + x.기관번호 + ' — 「맞음」은 쓸 자리가 없습니다 (안 붙은 공고입니다). 번호를 적어 주십시오');
      continue;
    }
    psql(`update 기관 set "확인한때" = now(), "확인한사람" = '세중 손확인(매핑 1024)'
           where 기관번호 = '${따옴(x.기관번호)}';`);
    한것++;
  }
}
console.log('○ ' + 한것 + '줄을 적용했습니다');
console.log('\n── 적용 뒤 ──\n' + psql(`
  select coalesce(p."연결상태",'(안 붙음)') as 연결상태, count(*) as 공고,
         count(*) filter (where exists (select 1 from job_posts_pub v where v.id = p.id)) as 회원화면
    from job_posts p group by 1 order by 2 desc;`));
