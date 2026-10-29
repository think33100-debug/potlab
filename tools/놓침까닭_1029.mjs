/* ⓑ 놓친 둘의 **까닭만** 찾습니다 — 고치지 않습니다 (2026-10-29 세중님 20:33)
 *
 *   node tools/놓침까닭_1029.mjs            둘 다
 *   node tools/놓침까닭_1029.mjs --4140     종로구보건소만
 *   node tools/놓침까닭_1029.mjs --4118     삼성서울병원만
 *   node tools/놓침까닭_1029.mjs --자기점검
 *
 * 세중님이 주신 갈래 넷 가운데 하나로 답합니다 —
 *   ㉠ 도는 곳 아님 · ㉡ 도는데 목록 못 읽음 · ㉢ 읽었는데 판정·보류함·버림 · ㉣ 모름
 *
 * ── 지키는 선 ────────────────────────────────────────────────
 *   · **읽기 전용** — psql 에 쓰는 글자가 섞이면 스스로 멈춥니다. collect_put 안 부릅니다
 *   · 수집기 파일(`collect-*.mjs`·`hosp/`·`sort-rule.mjs`)은 **고치지 않습니다** (10/30 동결 앞)
 *     여기서는 그 파일들을 **불러서 그대로 되풀이**만 합니다 (규칙은 한 자리 · 지침 6절)
 *   · 주소는 **저장소에 있는 것만** 씁니다 — 짐작하지 않습니다 (지침 10-3)
 *       삼성서울  tools/hosp/hosp-sites.json · tools/hosp/cfgs/samsung_seoul.json
 *       나라일터  tools/collect-nara.mjs 의 PblJobService (인사혁신처)
 *   · 땡큐오티 쪽은 **두드리지 않습니다** — 저쪽 상세는 안 엽니다 (18:18 블록)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { 사이트줄 } from './hosp/sites.mjs';
import { 글받기 } from './certs/index.mjs';
import { sortJob } from './sort-rule.mjs';
import { matchJob, notOurs, mixedTitle } from './gas-rules.mjs';
import { 공공부르기 } from './공공데이터부르기.mjs';

const argv = process.argv.slice(2);
const 뿌리 = path.join(import.meta.dirname, '..');
const 며칠 = Number(argv.includes('--며칠') ? argv[argv.indexOf('--며칠') + 1] : 70) || 70;

/* ── 공고ID — `collect-hosp.mjs` 와 **같은 규칙**이어야 DB 에서 찾힙니다 ──
 *  그 파일에서 밖으로 내보내지 않아 같은 글을 여기 둡니다 (베낀 것임을 적어 둡니다 ·
 *  tools/collect-hosp.mjs:189~195). 고치면 둘이 어긋나니 여기서 규칙을 바꾸지 않습니다 */
export function 해시(s) {
  let h = 0; const t = String(s || '');
  for (let i = 0; i < t.length; i++) { h = ((h << 5) - h) + t.charCodeAt(i); h |= 0; }
  return h;
}
export const 공고ID = (기관, url, 제목) => 'HS' + Math.abs(해시(기관 + '|' + url + '|' + 제목));

/** 찾을 말이 제목·기관에 있나 */
export const 걸리나 = (글, 말들) => 말들.some((w) => String(글 || '').includes(w));
/** 나라일터 응답에서 <item> 을 그대로 떼어 냅니다 (원문을 찍기 위해 통째로 둡니다) */
export function 아이템원문(xml) {
  return [...String(xml || '').matchAll(/<item>[\s\S]*?<\/item>/g)].map((m) => m[0]);
}
export const 칸 = (조각, 이름) => {
  const m = String(조각 || '').match(new RegExp('<' + 이름 + '>([\\s\\S]*?)</' + 이름 + '>'));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
};
/** 원문에서 글자 자리를 찾아 앞뒤를 떼어 찍습니다 (세중님 「원문 600~1200자」) */
export function 원문창(원문, 찾을글, 앞 = 300, 뒤 = 900) {
  const t = String(원문 || '');
  const i = t.indexOf(찾을글);
  if (i < 0) return { 자리: -1, 창: '' };
  const a = Math.max(0, i - 앞);
  return { 자리: i, 창: t.slice(a, i + 뒤) };
}

/* ── 자기점검 ───────────────────────────────────────────────── */
if (argv.includes('--자기점검')) {
  const 봄 = [];
  const 보기 = (무엇, 참인가) => { 봄.push((참인가 ? '○ ' : '✗ ') + 무엇); if (!참인가) process.exitCode = 1; };
  보기('해시 — 같은 값이 두 번 나옵니다', 해시('가|나|다') === 해시('가|나|다'));
  보기('해시 — 글이 다르면 값이 다릅니다', 해시('가') !== 해시('나'));
  보기('공고ID — HS 로 시작합니다', /^HS\d+$/.test(공고ID('삼성서울병원', '/a?b=1', '제목')));
  보기('걸리나 — 든 말을 찾습니다', 걸리나('종로구보건소 작업치료사', ['작업치료']));
  보기('걸리나 — 없는 말은 안 찾습니다', !걸리나('서울대병원 간호사', ['작업치료', '종로']));
  const x = '<items><item><title>가</title><idx>7</idx></item><item><title>나</title></item></items>';
  보기('아이템원문 — 두 줄', 아이템원문(x).length === 2);
  보기('칸 — 제목을 뽑습니다', 칸(아이템원문(x)[0], 'title') === '가');
  보기('칸 — 없는 칸은 빈 글', 칸(아이템원문(x)[1], 'idx') === '');
  보기('칸 — CDATA 를 벗깁니다', 칸('<a><![CDATA[값]]></a>', 'a') === '값');
  const w = 원문창('0123456789ABCDEFGHIJ', '89', 3, 5);
  보기('원문창 — 자리를 찾습니다', w.자리 === 8);
  보기('원문창 — 앞 3 + 뒤 5 자', w.창 === '5678' + '9ABC');
  보기('원문창 — 못 찾으면 -1', 원문창('가나다', '없는글').자리 === -1);
  console.log(봄.join('\n') + '\n자기점검 ' + 봄.length + '가지');
  process.exit();
}

/* ── 우리 DB — **읽기만** ───────────────────────────────────── */
const cfg = {};
for (const f of ['.env', '.env.local']) {
  const p = path.join(뿌리, f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
/* ★ DB 열쇠가 없어도 **원문 보는 자리는 돕니다** — 집 컴퓨터에서 목록 원문·판정을
   먼저 보고, DB 는 서버에서 봅니다. 없는 것을 「0」으로 적지 않습니다 (지침 15절) */
const DB있나 = !!cfg.SUPABASE_DB_URL;
const u = DB있나 ? new URL(cfg.SUPABASE_DB_URL) : null;
const env = DB있나 ? { ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require' } : process.env;
function psql(sql) {
  if (!DB있나) return '   (DB 를 못 봤습니다 — SUPABASE_DB_URL 이 없습니다 · 서버에서 돌리십시오)';
  if (/\b(insert|update|delete|drop|alter|truncate|grant|revoke|create)\b/i.test(sql)) {
    console.error('✗ 이 도구는 **읽기 전용**입니다 — 쓰는 글이 섞였습니다'); process.exit(1);
  }
  const 임시 = path.join(os.tmpdir(), '놓침까닭_' + process.pid + '.sql');
  fs.writeFileSync(임시, '\\pset pager off\n' + sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', 임시], { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}

const 둘다 = !argv.includes('--4140') && !argv.includes('--4118');
const 줄 = (s) => console.log(s);
const 짧게 = (s, n = 1200) => String(s || '').replace(/\s+/g, ' ').slice(0, n);

/* ══════════════ ㉠ 4140 종로구보건소 ══════════════ */
if (둘다 || argv.includes('--4140')) {
  줄('\n══════════ ⓑ 4140 종로구보건소 「작업치료사 채용 재공고(3차)」 ══════════');

  줄('\n① 1층 분모에 있나 · 지금 상태 (일층병원_구멍() 한 자리)');
  줄(psql(`select "갈래", "종류", "기관", "시도", "시군구", "상태", coalesce("출처",'—') as 출처, "우리직군"
             from "일층병원_구멍"()
            where "기관" like '%종로%' or ("갈래"='보건기관' and "시군구"='종로구');`));
  줄('\n   org_targets 에 종로 든 줄');
  줄(psql(`select name, kind, "갈래", sido, sgg, "커버리지분모"
             from org_targets where name like '%종로%' order by name;`));

  줄('\n② 도는 곳인가 — 홈페이지 긁기(HS·HS3·HS4) 설정에 종로가 있나');
  줄(psql(`select name, "이름열쇠", kind, coalesce(nullif(url,''),'(주소 없음)') as url, "끔"
             from hosp_sites where name like '%종로%';`));
  const 구운것 = path.join(뿌리, 'tools', 'hosp', 'hosp-sites.json');
  const S = JSON.parse(fs.readFileSync(구운것, 'utf8'));
  const 종로설정 = (S.사이트 || []).filter((s) => String(s.name || '').includes('종로'));
  줄('   hosp-sites.json(' + (S.사이트 || []).length + '곳) 에 종로 — ' + (종로설정.length ? JSON.stringify(종로설정) : '**0곳**'));
  const cfg터 = path.join(뿌리, 'tools', 'hosp', 'cfgs');
  const cfg종로 = fs.readdirSync(cfg터).filter((f) => {
    try { return String(JSON.parse(fs.readFileSync(path.join(cfg터, f), 'utf8')).name || '').includes('종로'); } catch { return false; }
  });
  줄('   cfgs/*.json 에 종로 — ' + (cfg종로.length ? cfg종로.join(' · ') : '**0곳**'));
  줄('   저장소 기록 (수집기_경로지도.txt · 2026-09-25)');
  for (const l of fs.readFileSync(path.join(뿌리, '수집기_경로지도.txt'), 'utf8').split(/\r?\n/)) {
    if (l.includes('종로구보건소')) 줄('     ' + l);
  }

  줄('\n③ 경로 원문 — 나라일터(GJ2 · 인사혁신처 공공취업정보) 최근 ' + 며칠 + '일');
  if (!cfg.ALIO_DETAIL_KEY) 줄('   ✗ ALIO_DETAIL_KEY 가 없습니다 — 못 봤습니다 (서버에서 돌리십시오)');
  else {
    const BASE = 'https://apis.data.go.kr/1760000/PblJobService';
    const 날 = (더할) => { const d = new Date(Date.now() + 더할 * 86400000); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
    const 찾을말 = ['종로', '작업치료', '작업 치료'];
    let 읽은줄 = 0, 찾음 = [], 날들 = [];
    for (let 쪽 = 1; 쪽 <= 30; 쪽++) {
      const url = BASE + '/getList?serviceKey=' + cfg.ALIO_DETAIL_KEY
        + '&pageNo=' + 쪽 + '&numOfRows=100&Sort_order=2&Begin_de=' + 날(-며칠) + '&End_de=' + 날(1);
      const r = await 공공부르기(url, { headers: { accept: 'application/xml' } });
      if (r.code !== 200) { 줄('   ' + 쪽 + '쪽 HTTP ' + r.code + ' · ' + 짧게(r.글, 300)); break; }
      const 조각들 = 아이템원문(r.글);
      if (!조각들.length) break;
      읽은줄 += 조각들.length;
      for (const 조각 of 조각들) {
        const d = 칸(조각, 'regdate').replace(/[^0-9]/g, '');
        if (d.length === 8) 날들.push(d);
        if (걸리나(칸(조각, 'title') + ' ' + 칸(조각, 'insttname'), 찾을말)) 찾음.push(조각);
      }
      if (조각들.length < 100) break;
    }
    날들.sort();
    줄('   읽은 줄 ' + 읽은줄 + '건 · 올린날 ' + (날들[0] || '—') + ' ~ ' + (날들[날들.length - 1] || '—')
      + ' (**이 창 안에서만** 봤습니다)');
    줄('   「종로」 또는 「작업치료」 든 것 **' + 찾음.length + '건**');
    for (const 조각 of 찾음.slice(0, 8)) {
      줄('   ── 원문 그대로 ──\n' + 조각.replace(/\s+/g, ' ').slice(0, 1200));
    }
  }

  줄('\n④ 우리 DB — 열린·보류함·숨김·버림·판정기억 어디에 있나');
  줄(psql(`select source, id, left(org_name,22) as 기관, left(title,46) as 제목, job_group as 직군,
                  hidden as 숨김, hold as 보류, posted_at as 올린날, apply_to as 마감, first_seen::date as 처음본날
             from job_posts where org_name like '%종로%' or title like '%종로%'
            order by first_seen desc limit 20;`));
  줄(psql(`select 'job_trash' as 어디, source, left(org_name,22) as 기관, left(title,46) as 제목, why as 까닭, trashed_at::date as 버린날
             from job_trash where org_name like '%종로%' or title like '%종로%'
            order by trashed_at desc limit 20;`));
  줄(psql(`select 'wn_verdicts' as 어디, verdict as 판정, reason as 까닭, left(org_name,22) as 기관, left(title,46) as 제목, decided_at::date as 판정날
             from wn_verdicts where org_name like '%종로%' or title like '%종로%'
            order by decided_at desc limit 20;`));
  줄('   ★ 「작업치료」 가 든 최근 30일 공고를 출처별로 — 종로가 섞여 있나 보기');
  줄(psql(`select source, count(*) as 건수 from job_posts
            where title like '%작업치료%' and first_seen > now() - interval '30 days'
            group by 1 order by 2 desc;`));
}

/* ══════════════ ㉡ 4118 삼성서울병원 ══════════════ */
if (둘다 || argv.includes('--4118')) {
  줄('\n══════════ ⓑ 4118 삼성서울병원 「재활의학과 소아재활 임상연구원(작업치료)」 ══════════');

  const 구운것 = path.join(뿌리, 'tools', 'hosp', 'hosp-sites.json');
  const S = JSON.parse(fs.readFileSync(구운것, 'utf8'));
  const 곳 = (S.사이트 || []).find((s) => String(s.name || '').includes('삼성서울'));
  줄('\n① 도는 곳인가 — hosp-sites.json 줄 (HS3 가 쓰는 설정 그대로)');
  줄('   ' + (곳 ? JSON.stringify(곳) : '**없습니다**'));
  줄(psql(`select name, kind, coalesce(nullif(url,''),'(주소 없음)') as url, "끔", "끈까닭", "채용주소"
             from hosp_sites where name like '%삼성서울%';`));
  줄(psql(`select name, auto, fail_streak as 연속실패, left(last_fail,40) as 마지막탈,
                  off_on as 끈날, on_on as 켠날, tried_on as 두드린날
             from site_state where name like '%삼성서울%' limit 5;`));

  줄('\n② 경로 원문 — HS3 와 **같은 자**(사이트줄)로 목록을 읽습니다');
  if (!곳) 줄('   설정이 없어 못 읽었습니다');
  else {
    const r = await 사이트줄(곳);
    if (r.err) 줄('   ✗ 못 읽었습니다 — ' + r.err);
    else {
      줄('   목록 줄 ' + r.rows.length + '건 · ' + (r.raw || ''));
      const 눈여겨 = /연구|소아|재활|작업|치료/;
      r.rows.forEach((x, i) => {
        줄('   ' + String(i + 1).padStart(2) + (눈여겨.test(x.title) ? ' ★ ' : '   ')
          + String(x.title).slice(0, 62) + '  | 올린날 ' + (x.posted || '—')
          + ' | 접수 ' + (x.from || '—') + '~' + (x.to || '—'));
      });
      const 그것 = r.rows.find((x) => /연구/.test(x.title) && /작업|소아|재활/.test(x.title))
        || r.rows.find((x) => /연구/.test(x.title));
      줄('\n   ── 원문 (받은 HTML 에서 그 줄 자리 앞뒤) ──');
      const g = await 글받기(곳.url, { enc: 곳.enc });
      if (g.code !== 200) 줄('   ✗ 원문 HTTP ' + g.code);
      else if (!그것) 줄('   「연구」 든 줄이 목록에 **없습니다** — 목록 앞 1200자만 찍습니다\n' + 짧게(g.html, 1200));
      else {
        const w = 원문창(g.html, 그것.title.slice(0, 12), 400, 900);
        줄('   찾을 글자 「' + 그것.title.slice(0, 12) + '」 자리 ' + w.자리);
        줄(w.자리 < 0 ? 짧게(g.html, 1200) : w.창);
      }

      /* ★ HS3 는 **첫 쪽만** 읽습니다 (설정에 쪽 넘김 칸이 없습니다). 그 글이 첫 쪽에서
         이미 밀려났는지 보려고 **둘째·셋째 쪽**을 읽습니다 — `cPage` 는 쪽 원문의
         링크에 적혀 있던 칸입니다(짐작 아님 · 위 원문 `…&cPage=1`). 1.5초 띄웁니다 */
      const 뒷쪽글 = [];
      for (const p of [2, 3]) {
        await new Promise((f) => setTimeout(f, 1500));
        const 주소 = 곳.url + (곳.url.includes('?') ? '&' : '?') + 'cPage=' + p;
        const rp = await 사이트줄({ ...곳, url: 주소 });
        if (rp.err) { 줄('   ' + p + '쪽 ✗ ' + rp.err); continue; }
        줄('   ' + p + '쪽 — ' + rp.rows.length + '건');
        for (const x of rp.rows) {
          const 눈 = /연구|소아|재활|작업|치료/.test(x.title);
          줄('      ' + (눈 ? '★ ' : '  ') + String(x.title).slice(0, 56)
            + '  | 접수 ' + (x.from || '—') + '~' + (x.to || '—'));
          if (눈) 뒷쪽글.push(x);
        }
      }

      줄('\n③ 판정 되풀이 — HS3 가 제목으로 내리는 판정 그대로 (쓰지 않습니다)');
      const 볼것 = [...r.rows.filter((x) => /연구|소아|재활|작업|치료/.test(x.title)), ...뒷쪽글];
      for (const x of 볼것) {
        const 직군 = (matchJob(x.title) && !notOurs(x.title)) ? matchJob(x.title) : '';
        const v = sortJob(x.title, 직군, null);
        줄('   ' + String(x.title).slice(0, 52).padEnd(54)
          + ' matchJob=' + (matchJob(x.title) || '—')
          + ' · notOurs=' + (notOurs(x.title) ? 'O' : 'X')
          + ' · mixed=' + (mixedTitle(x.title) ? 'O' : 'X')
          + ' → ' + v.갈래 + '(' + v.왜 + (v.걸린단어 && v.걸린단어.length ? ' · 걸린말 ' + v.걸린단어.join(',') : '') + ')');
        줄('       공고ID ' + 공고ID(곳.name, x.url, x.title) + ' · 주소 ' + String(x.url || '').slice(0, 90));
      }

      /* ★ 그 글이 목록에 없을 때를 위해 — **제목만으로 판정이 어떻게 나는지**를
         시험해 둡니다 (읽기 전용 · 순수 함수). 땡큐오티 제목과 병원이 쓸 만한 꼴 둘 */
      줄('\n③-2 만약 그 글을 읽었다면 — 제목 꼴로 판정 시험 (글이 목록에 없을 때 대비)');
      for (const t of ['삼성서울병원 재활의학과 소아재활 임상연구원(작업치료) 채용',
                       '재활의학과 소아재활 임상연구원(작업치료) 채용',
                       '[재활의학과] 임상연구원(작업치료사) 모집',
                       '소아재활 연구원 채용']) {
        const 직군 = (matchJob(t) && !notOurs(t)) ? matchJob(t) : '';
        const v = sortJob(t, 직군, null);
        줄('   ' + t.padEnd(46) + ' matchJob=' + (matchJob(t) || '—')
          + ' · notOurs=' + (notOurs(t) ? 'O' : 'X') + ' → ' + v.갈래 + '(' + v.왜
          + (v.걸린단어 && v.걸린단어.length ? ' · 걸린말 ' + v.걸린단어.join(',') : '') + ')');
      }

      줄('\n④ 우리 DB — 그 공고ID 가 어디 있나');
      const ids = 볼것.map((x) => "'" + 공고ID(곳.name, x.url, x.title) + "'").join(',') || "''";
      줄(psql(`select id, left(title,46) as 제목, job_group as 직군, hidden as 숨김, hold as 보류,
                      posted_at as 올린날, apply_to as 마감, first_seen::date as 처음본날
                 from job_posts where id in (${ids});`));
      줄(psql(`select id, left(title,46) as 제목, why as 까닭, trashed_at::date as 버린날 from job_trash where id in (${ids});`));
      줄(psql(`select source, "번호", "판정", "판정때"::date as 판정날 from "수집판정" where "번호" in (${ids});`));
    }
  }

  줄('\n⑤ 삼성서울 공고 — 우리 DB 최근 60일 전부 (열린·보류·숨김)');
  줄(psql(`select source, id, left(title,50) as 제목, job_group as 직군, hidden as 숨김, hold as 보류,
                  posted_at as 올린날, apply_to as 마감, first_seen::date as 처음본날
             from job_posts where org_name like '%삼성서울%' and first_seen > now() - interval '60 days'
            order by first_seen desc;`));
  줄(psql(`select left(title,50) as 제목, why as 까닭, trashed_at::date as 버린날, source
             from job_trash where org_name like '%삼성서울%' and trashed_at > now() - interval '60 days'
            order by trashed_at desc;`));
  줄(psql(`select count(*) as 삼성서울_전체줄 from job_posts where org_name like '%삼성서울%';`));
}

줄('\n(까닭만 찾았습니다 — 아무것도 안 고쳤고 DB 에 한 줄도 안 썼습니다)');
