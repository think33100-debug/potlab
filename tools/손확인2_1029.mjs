/* 손확인 ② — 세중님 10/29 15:13 답을 담습니다 (읽기만이 기본)
 *
 *   node tools/손확인2_1029.mjs             점검만 — 열어서 200 · 기관 표 지금 값 · HS3 땅인가
 *   node tools/손확인2_1029.mjs --진짜       담습니다 (② 표시 · 홈페이지 · 새 기관)
 *   node tools/손확인2_1029.mjs --자기점검
 *
 * ── 세중님 답의 세 갈래 ─────────────────────────────────────
 *   ① 채용 **전용** 게시판 (3곳 + 새 기관 1곳)
 *      → `기관.채용페이지` 로 담습니다. 그 길은 **이 도구가 아니라**
 *        `docs/손확인_주소_오늘_1029.md` + `tools/손확인_주소.mjs --읽기 --진짜` 입니다
 *        (손확인 문서가 한 자리 · 지침 6절). 여기서는 **열어서 확인만** 합니다.
 *        새 기관(화명일신기독병원)만 표에 줄이 없어 여기서 넣습니다
 *   ② 공지사항에 **섞인** 곳 (10곳)
 *      → **채용페이지는 비웁니다.** 공지 목록 주소를 누르면 회원이 채용과 상관없는
 *        글을 먼저 봅니다. 그래서 `불변근거.공지목록` 에 적고 `불변근거.공지섞임` 으로
 *        표시만 합니다. 회원 「지원하러 가기」는 ② 기관 홈페이지로 갑니다
 *      → 긁기는 `tools/긁기/공지섞임.mjs` 가 **제목에 채용·모집 든 글만** 담습니다
 *   ③ 외부 채용 사이트 (1곳)
 *      → 채용페이지로만. 긁기는 **보류**(세중님) — 곳 목록에 넣지 않습니다
 *
 * ★ 주소는 세중님이 적어 주신 글자 그대로입니다 (지침 10-6 · 손으로 옮기지 않았습니다).
 * ★ 되돌림은 `~/되돌림/` 에 남깁니다 (지침 8-19).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { 받기, 도는곳셈 } from './긁기/공통.mjs';
/* 목록이 읽히나 보는 자는 **한 자리**입니다 (지침 6절) — 진단 도구에서 빌립니다.
   그 파일은 들여와도 안 돌게 울타리를 쳐 두었습니다 (지침 6-3) */
import { 쪽살피기, 판정 } from './긁기/목록진단_1029.mjs';
import { 꼴정하기, 표준읽기, 그누읽기 } from './긁기/읽기들.mjs';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 오늘 = '2026-10-29';
const 적은사람 = '세중 손확인(② 1029)';

/** 세중님 10/29 15:13 답 — **한 자리**입니다 (긁기 곳 목록도 이 글자를 씁니다) */
export const 묶음 = [
  /* ① 채용 전용 게시판 */
  { 갈래: '①', 표: 13, 이름: '서광병원',
    채용: 'http://sghospital.kr/wp_recruit/index.html?code=recruit&mode=list',
    홈: 'http://sghospital.kr/', 말: '홈이 바뀌었습니다 — 옛 suhgwang2010.com' },
  { 갈래: '①', 표: 16, 이름: '씨엠병원',
    채용: 'https://www.cmhospital.co.kr/cmhospital/sub_05_11.php' },
  { 갈래: '①', 표: 29, 이름: '재단법인일신기독교선교회 일신기독병원',
    채용: 'https://www.ilsin.or.kr/community/bbs.asp?code=srecru' },
  { 갈래: '①새', 표: 0, 이름: '화명일신기독병원',
    채용: 'https://www.hmilsin.or.kr/community/bbs.asp?code=incrt',
    말: '표에 없던 곳 — 심평원 번호를 찾아 기관 표에 넣습니다' },
  /* ② 공지사항 섞임 */
  { 갈래: '②', 표: 8, 이름: '드림종합병원',
    공지: 'http://dreamh.co.kr/front/board/list.php?code=notice', 말: '지난 채용 글 있음' },
  { 갈래: '②', 표: 10, 이름: '비에스종합병원',
    공지: 'http://bs.ibsh.kr/bbs/board.php?bo_table=sosig', 말: '공고 있었음' },
  { 갈래: '②', 표: 17, 이름: '온누리병원',
    공지: 'https://www.onnurihosp.com/notice' },
  { 갈래: '②', 표: 42, 이름: '의료법인 인덕의료재단 복주회복병원',
    공지: 'https://bokjurh.co.kr/sub/07_community/community_01', 말: '지금 공고 있음' },
  { 갈래: '②', 표: 11, 이름: '빛가람종합병원',
    공지: 'http://bitgaramhospital.co.kr/wp_board/index.html?code=press&mode=list',
    말: '지금 공고 없음' },
  { 갈래: '②', 표: 22, 이름: '의료법인 원광의료재단 원광종합병원',
    공지: 'http://wkgh.co.kr/', 말: '공지만 · 공고 없음' },
  { 갈래: '②', 표: 27, 이름: '의료법인환명의료재단 조은금강병원',
    공지: 'https://ggmc.or.kr/html/?pCode=24', 말: '공고 없음' },
  { 갈래: '②', 표: 33, 이름: '현대유비스병원',
    공지: 'https://www.uvishospital.co.kr/news?tab=notice', 말: '공고 없음' },
  { 갈래: '②', 표: 34, 이름: '화성유일병원',
    공지: 'http://hsyuil.kr/about/notice.php?cate=hospital', 말: '공고 없음' },
  { 갈래: '②', 표: 7, 이름: '나사렛종합병원', 홈: 'http://www.nazareth.co.kr/',
    말: '병원소식에 섞임 · 게시판 검색 안 됨 — 목록 주소가 없습니다' },
  /* ③ 외부 채용 사이트 */
  { 갈래: '③', 표: 35, 이름: '강북삼성병원',
    채용: 'https://kbsmcrecruit.ninehire.site/4qxkvknx', 말: '외부 ATS · 긁기 보류(세중님)' },
];

/** 세중님이 「미확인으로 남김」이라 하신 곳 — 아무것도 안 담습니다 (세중님 5번) */
export const 미확인 = ['광주희망병원', '우리들병원', '의료법인 센텀의료재단 센텀종합병원', '정읍한국병원'];

/** 그 줄이 ② 갈래(공지 목록 주소가 있는 곳)인가 */
export const 공지섞임인가 = (x) => x.갈래 === '②' && !!x.공지;

/** ★ 2026-10-29 세중님 1번 — 온누리병원 후보 번호. **그날 도구 출력에서 그대로 옮긴
 *  글자**입니다 (지침 10-6). 이 번호를 **바로 담지 않습니다** — 심평원 주소와
 *  onnurihosp.com 꼬리말 주소가 **같을 때만** 담습니다 */
export const 온누리후보번호 = 'HIRA:JDQ4MTYyMiM1MSMkMSMkMCMkODkkMzgxMzUxIzExIyQxIyQ3IyQ3OSQzNjE4MzIjNDEjJDEjJDgjJDgz';

/** 주소에서 **도로명 + 번지**만 집습니다 — 두 주소를 견주는 자리 한 곳 */
export function 길번지(주소) {
  const m = String(주소 || '').match(/([가-힣A-Za-z0-9]+(?:대로|로|길))\s*(\d+(?:-\d+)?)/);
  return m ? { 길: m[1], 번지: m[2], 글: m[1] + ' ' + m[2] } : null;
}
/** 쪽 글자에 그 도로명·번지가 있나 (빈칸을 눕혀 봅니다 — 표는 줄바꿈으로 흩어집니다) */
export function 주소같나(심평원주소, 쪽글) {
  const a = 길번지(심평원주소);
  if (!a) return { 됨: false, 왜: '심평원 주소에서 도로명·번지를 못 집었습니다' };
  const 눕힌것 = String(쪽글 || '').replace(/\s+/g, '');
  const 찾을것 = (a.길 + a.번지).replace(/\s+/g, '');
  return { 됨: 눕힌것.includes(찾을것), 견준것: a.글, 왜: 눕힌것.includes(찾을것)
    ? '쪽에 「' + a.글 + '」 가 있습니다' : '쪽에 「' + a.글 + '」 가 없습니다' };
}

/** 기관 이름에서 **쪽에서 찾아볼 토막**들 — 긴 것부터 (법인말을 뗍니다) */
export function 이름토막(이름) {
  const 뺀것 = String(이름 || '').replace(/^(의료법인|재단법인|학교법인|사회복지법인|사단법인)\s*/, '')
    .replace(/^[가-힣]*의료재단\s*/, '').trim();
  const 짧은 = 뺀것.replace(/(종합병원|의료원|병원|의원)$/, '').trim();
  const 셋 = [이름, 뺀것, 짧은.length >= 3 ? 짧은 : ''];
  return [...new Set(셋.filter(Boolean))].sort((a, b) => b.length - a.length);
}

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('묶음 15줄', 묶음.length === 15);
  보('① 셋 + 새 기관 하나', 묶음.filter((x) => x.갈래.startsWith('①')).length === 4);
  보('② 열 곳', 묶음.filter((x) => x.갈래 === '②').length === 10);
  보('② 가운데 목록 주소가 있는 곳 아홉', 묶음.filter(공지섞임인가).length === 9);
  보('나사렛은 목록 주소가 없다', !공지섞임인가(묶음.find((x) => x.이름 === '나사렛종합병원')));
  보('③ 하나', 묶음.filter((x) => x.갈래 === '③').length === 1);
  보('미확인 넷은 묶음에 없다', 미확인.every((n) => !묶음.some((x) => x.이름 === n)));
  보('주소는 전부 http 로 시작', 묶음.every((x) => [x.채용, x.공지, x.홈].filter(Boolean)
    .every((u) => /^https?:\/\//.test(u))));
  보('도로명·번지를 집는다', 길번지('인천광역시 서구 완정로 123, 3층').글 === '완정로 123');
  보('대로도 집는다', 길번지('부산광역시 북구 금곡대로 264,').글 === '금곡대로 264');
  보('번지에 붙임표도 집는다', 길번지('서울시 강남구 테헤란로 12-3').번지 === '12-3');
  보('빈칸이 흩어져도 같다고 본다',
    주소같나('인천광역시 서구 완정로 123', '주소 : 인천광역시 서구\n완정로\t123 (검단)').됨);
  보('딴 주소는 다르다고 본다',
    !주소같나('인천광역시 서구 완정로 123', '인천광역시 서구 완정로 456').됨);
  보('법인말을 뗀 토막을 낸다',
    이름토막('의료법인 인덕의료재단 복주회복병원').includes('복주회복병원'));
  보('두 글자 토막은 안 쓴다', !이름토막('드림종합병원').includes('드림'));
  보('토막은 긴 것부터', 이름토막('의료법인환명의료재단 조은금강병원')[0].length
    >= 이름토막('의료법인환명의료재단 조은금강병원')[1].length);
  보('온누리 후보 번호는 HIRA 꼴', /^HIRA:[A-Za-z0-9]+$/.test(온누리후보번호));
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const 뿌리 = path.join(import.meta.dirname, '..');
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
function psql(sql, 꼴 = ['-X', '-A', '-t', '-q', '-F', '\t']) {
  const 임시 = path.join(os.tmpdir(), '손확인2_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 줄로 = (sql) => psql(sql).split('\n').filter(Boolean).map((l) => l.split('\t'));
const 따옴 = (s) => String(s == null ? '' : s).replace(/'/g, "''");

/* ── ㉠ 열어서 200 인가 (robots 를 먼저 봅니다 · 공통.mjs 한 자리) ── */
console.log('══ ㉠ 열어 본 것 — robots · HTTP 코드 (세중님 「열어서 200 확인」) ══');
const 열어본것 = new Map();
/** ② 의 공지 목록이 **읽히나** — 「공고 없음」이 아니라 「목록 못 읽음」을 적기 위해서입니다
 *  (2026-10-29 세중님). 못 읽은 것을 「공고가 없다」로 적으면 안 됩니다 (지침 15절) */
const 목록상태 = new Map();
for (const x of 묶음) {
  for (const [무엇, 주소] of [['채용', x.채용], ['공지', x.공지], ['홈', x.홈]]) {
    if (!주소) continue;
    const r = await 받기(주소);
    열어본것.set(주소, r);
    if (무엇 === '공지') {
      if (!r.됨) 목록상태.set(x.이름, '목록 못 읽음 — 못 열었습니다 (' + r.왜 + ')');
      else {
        const 줄수 = (꼴정하기(주소) === '그누보드' ? 그누읽기 : 표준읽기)(r.html, 주소).length;
        목록상태.set(x.이름, 줄수 >= 2 ? '목록 읽힘 — ' + 줄수 + '줄'
          : '목록 못 읽음 — ' + 판정(쪽살피기(r.html)));
      }
    }
    const 제목 = (r.html || '').match(/<title[^>]*>([\s\S]{0,80}?)<\/title>/i);
    console.log('  ' + (r.됨 ? '○' : '✗') + ' ' + x.갈래.padEnd(3)
      + x.이름.slice(0, 18).padEnd(19) + 무엇.padEnd(3)
      + String(r.코드 || '-').padEnd(4)
      + (r.됨 ? ((r.html || '').length + '바이트 · 제목 「'
          + (제목 ? 제목[1].replace(/\s+/g, ' ').trim().slice(0, 30) : '없음') + '」')
        : r.왜));
  }
}

/* ── ㉡ 기관 표의 지금 값 ── */
console.log('\n══ ㉡ 기관 표 지금 값 (이름 → 기관번호_이름으로) ══');
const 표값 = new Map();
for (const x of 묶음) {
  const [줄] = 줄로(`select coalesce("기관번호_이름으로"('${따옴(x.이름)}'), '') as 번호,
      (exists (select 1 from 기관 o
                where o."기관번호" = "기관번호_이름으로"('${따옴(x.이름)}')))::text as 줄있나,
      coalesce((select coalesce(o."홈페이지",'') from 기관 o
                 where o."기관번호" = "기관번호_이름으로"('${따옴(x.이름)}')), '') as 홈,
      coalesce((select coalesce(o."채용페이지",'') from 기관 o
                 where o."기관번호" = "기관번호_이름으로"('${따옴(x.이름)}')), '') as 채용,
      coalesce((select coalesce(to_char(o."확인한때",'MM-DD HH24:MI'),'') from 기관 o
                 where o."기관번호" = "기관번호_이름으로"('${따옴(x.이름)}')), '') as 확인;`) || [[]];
  const [번호, 줄있나, 홈, 채용, 확인] = 줄 || ['', 'false', '', '', ''];
  표값.set(x.이름, { 번호, 줄있나: 줄있나 === 't' || 줄있나 === 'true', 홈, 채용, 확인 });
  /* ★ 2026-10-29 — **「번호가 있다」와 「기관 표에 줄이 있다」는 다릅니다.**
     `기관번호_이름으로` 는 **심평원**(hira_org)에서 이름열쇠가 하나일 때 번호를 냅니다.
     기관 표는 **공고가 들어온 기관**만 줄이 있습니다 (기관표채우기 가 job_posts 에서 만듭니다) —
     사각지대 병원은 공고가 없어서 **줄이 없습니다.** 처음 돌릴 때 그 둘을 안 갈라서
     `update … where 기관번호 = …` 가 **0줄을 고치고도 조용히 성공**했습니다 (지침 8-23 와 같은 결) */
  console.log('  ' + x.갈래.padEnd(3) + x.이름.slice(0, 20).padEnd(21)
    + (번호 ? 번호.slice(0, 12) + '…' : '✗ 심평원에 이름이 하나가 아닙니다').padEnd(16)
    + ' 기관 표 ' + (표값.get(x.이름).줄있나 ? '줄 있음' : '**줄 없음**')
    + ' · 홈 ' + (홈 ? '있음' : '없음') + ' · 채용페이지 ' + (채용 ? '있음' : '없음')
    + ' · 확인한때 ' + (확인 || '없음'));
  /* ★ 이름이 안 풀리면 **비슷한 줄을 찍습니다** — 「표에 없습니다」로 끝내면 세중님이
     이름을 어떻게 적어야 하는지 알 수 없습니다 (지침 2절). 제가 고르지는 않습니다 */
  if (!번호) {
    const 토막 = x.이름.replace(/^(의료법인|재단법인|학교법인|사회복지법인)\s*/, '').slice(0, 3);
    for (const [n, 이름] of 줄로(`select o."기관번호", o."이름" from 기관 o
         where o."이름" like '%${따옴(토막)}%' order by o."이름" limit 6;`)) {
      console.log('        비슷한 줄 — ' + 이름 + '  ' + n);
    }
  }
}

/* ── ㉢ HS3 땅인가 (사이트표에 줄이 있나 · 세중님 2번) ── */
console.log('\n══ ㉢ HS3 땅인가 — hosp_sites 줄과 HS3 공고 (세중님 2번) ══');
const HS3땅 = new Map();
for (const x of 묶음.filter((y) => y.갈래.startsWith('①'))) {
  const v = 표값.get(x.이름) || {};
  const [줄] = 줄로(`select
      (select count(*) from hosp_sites s
        where (${v.번호 ? `s.ykiho = substr('${따옴(v.번호)}', 6)` : 'false'})
           or s."이름열쇠" = hira_name_key('${따옴(x.이름)}')) as 사이트줄,
      (select count(*) from job_posts j where j.source in ('HS3','HS')
        and (hira_name_key(j.org_name) = hira_name_key('${따옴(x.이름)}')
             ${v.번호 ? `or j."기관번호" = '${따옴(v.번호)}'` : ''})) as hs3공고,
      (select count(*) from job_posts j where j.source in ('HS3','HS')
        and j.first_seen > (now() at time zone 'Asia/Seoul')::date - 30
        and (hira_name_key(j.org_name) = hira_name_key('${따옴(x.이름)}')
             ${v.번호 ? `or j."기관번호" = '${따옴(v.번호)}'` : ''})) as hs3최근;`) || [[]];
  const [사이트줄, hs3공고, hs3최근] = 줄 || ['0', '0', '0'];
  HS3땅.set(x.이름, +사이트줄 > 0);
  console.log('  ' + x.이름.slice(0, 22).padEnd(23) + '사이트표 ' + 사이트줄 + '줄 · HS3 공고 '
    + hs3공고 + '건 (최근 30일 ' + hs3최근 + ') → '
    + (+사이트줄 > 0 ? '**HS3 땅입니다** — HS4 곳 목록에 넣지 않습니다 (㉩)'
      : 'HS3 땅이 아닙니다 → HS4 등록 자리'));
}

/* ── ㉣ 새 기관 화명일신기독병원 — 심평원 후보 (고르지 않고 적습니다 · 지침 10-3) ── */
console.log('\n══ ㉣ 새 기관 「화명일신기독병원」 — 심평원 후보 ══');
const 후보 = 줄로(`select h.ykiho, h.yadm_nm, coalesce(h.cl_cd_nm,''), coalesce(h.sido_nm,'')
      || ' ' || coalesce(h.sggu_nm,''), coalesce(h.addr,''), coalesce(h.tel,''),
      coalesce(h.hosp_url,'')
    from hira_org h where h.yadm_nm like '%화명%' order by h.yadm_nm;`);
console.log('  심평원 이름에 「화명」 — ' + 후보.length + '곳');
for (const [ykiho, 이름, 종별, 지역, 주소, 전화, 홈] of 후보) {
  console.log('    · ' + 이름 + ' · ' + 종별 + ' · ' + 지역 + ' · HIRA:' + ykiho);
  console.log('        주소 ' + (주소 || '(없음)') + ' · 전화 ' + (전화 || '(없음)')
    + ' · hosp_url ' + (홈 || '(없음)'));
}
const 일신후보 = 후보.filter(([, 이름]) => /화명.*일신|일신.*화명/.test(이름));
console.log('  「화명」+「일신」 둘 다 든 줄 — ' + 일신후보.length + '곳'
  + (일신후보.length === 1 ? ' → 하나뿐이라 그것으로 넣습니다'
    : ' → **하나가 아니라 안 넣습니다** (짐작하지 않습니다 · 지침 10-3)'));
console.log('  1층 대상인가 —');
console.log(psql(`\\pset pager off
  select "갈래", coalesce("종류",'') as 종류, "기관", coalesce("시도",'') || ' '
         || coalesce("시군구",'') as 지역, "상태"
    from "일층병원_구멍"() where "기관" like '%화명%';`, ['-X', '-q']) || '  (1층 목록에 없습니다)');

/* ── ㉤ 긁기가 도는 곳 셈 (전·후를 가릴 수 있게 꼴별로) ── */
const 셈 = 도는곳셈();
console.log('\n══ ㉤ 1층 「도는 곳」 — 꼴별 (세중님 4번) ══');
console.log('  지금 — 도는 곳 ' + 셈.도는것 + '/' + 셈.분모 + ' (설정 ' + 셈.전부
  + '곳 · HS3 가 긁어 건너뜀 ' + 셈.건너뜀 + ')');
for (const [k, v] of Object.entries(셈.꼴별)) console.log('      ' + k + ' ' + v);
const 새곳 = Number((셈.꼴별['손확인추가'] || '0/0').split('/')[0]);
console.log('  → 손확인 ② 로 더해진 곳 ' + 새곳 + '곳 (그 전은 ' + (셈.도는것 - 새곳)
  + '/' + 셈.분모 + ' 였습니다)');

/* ── ㉦ 온누리병원 — 심평원 주소 ↔ 홈페이지 꼬리말 주소 (세중님 10/29 15:50 1번) ──
   ★ **제가 고르지 않습니다.** 두 주소를 나란히 찍고, **도로명·번지가 같을 때만** 담습니다.
     다르면 「온누리병원」 이름의 심평원 후보를 **전부** 표로 내고 세중님이 고르십니다 */
console.log('\n══ ㉦ 온누리병원 — 두 주소를 나란히 ══');
let 온누리번호 = null;
{
  const [줄] = 줄로(`select coalesce(h.addr,''), h.yadm_nm, coalesce(h.cl_cd_nm,''),
        coalesce(h.sido_nm,'') || ' ' || coalesce(h.sggu_nm,''), coalesce(h.tel,'')
      from hira_org h where h.ykiho = substr('${따옴(온누리후보번호)}', 6);`) || [[]];
  const [심주소, 심이름, 심종별, 심지역, 심전화] = 줄 || ['', '', '', '', ''];
  const 공지 = (묶음.find((x) => x.이름 === '온누리병원') || {}).공지;
  const 집 = 공지 ? new URL(공지).origin + '/' : '';
  const r = 집 ? await 받기(집) : { 됨: false, 왜: '공지 주소가 없습니다' };
  /* 꼬리말은 쪽 **끝쪽**에 있습니다 — 글자만 눕혀 뒤 3000자를 봅니다 */
  const 끝글 = String(r.글 || '').slice(-3000);
  const 꼬리주소들 = [...String(r.글 || '').matchAll(
    /(?:인천|서울|경기|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[^|]{4,70}?(?:대로|로|길)\s*\d+(?:-\d+)?[^|]{0,25}/g)]
    .map((m) => m[0].replace(/\s+/g, ' ').trim());
  console.log('  번호        ' + 온누리후보번호);
  console.log('  심평원      ' + (심이름 || '(그 번호가 없습니다)') + ' · ' + 심종별 + ' · ' + 심지역
    + ' · 전화 ' + (심전화 || '(없음)'));
  console.log('  심평원 주소  ' + (심주소 || '(없음)'));
  console.log('  쪽          ' + 집 + '  → ' + (r.됨 ? 'HTTP ' + r.코드 + ' · ' + (r.html || '').length
    + '바이트' : '못 열었습니다 — ' + r.왜));
  console.log('  쪽 주소 꼴   ' + (꼬리주소들.length ? '' : '(못 찾았습니다)'));
  for (const s of [...new Set(꼬리주소들)].slice(0, 5)) console.log('      · ' + s);
  if (!꼬리주소들.length && r.됨) console.log('      (끝 300자) ' + 끝글.slice(-300));
  const 견줌 = r.됨 ? 주소같나(심주소, r.글) : { 됨: false, 왜: '쪽을 못 열었습니다' };
  console.log('  견준 것      ' + (견줌.견준것 ? '「' + 견줌.견준것 + '」' : '(못 집었습니다)')
    + ' → ' + (견줌.됨 ? '**같습니다 — 담습니다**' : '**다릅니다 — 안 담습니다**') + ' (' + 견줌.왜 + ')');
  if (견줌.됨) {
    온누리번호 = 온누리후보번호;
    const [있나] = 줄로(`select (exists (select 1 from 기관 where 기관번호 = '${따옴(온누리번호)}'))::text;`) || [['false']];
    const v = 표값.get('온누리병원') || {};
    표값.set('온누리병원', { ...v, 번호: 온누리번호,
      줄있나: (있나 || [])[0] === 't' || (있나 || [])[0] === 'true' });
  } else {
    const 후보 = 줄로(`select 'HIRA:' || h.ykiho, h.yadm_nm, coalesce(h.cl_cd_nm,''),
          coalesce(h.sido_nm,'') || ' ' || coalesce(h.sggu_nm,''), coalesce(h.addr,''),
          coalesce(h.tel,'')
        from hira_org h where h.yadm_nm like '%온누리%병원%' order by h.yadm_nm, h.ykiho;`);
    console.log('\n  ── 심평원 「온누리…병원」 후보 전부 — ' + 후보.length + '곳 (세중님이 고르실 자리) ──');
    console.log('  | 이름 | 종별 | 지역 | 주소 | 전화 | 번호 |');
    console.log('  |---|---|---|---|---|---|');
    for (const [번호, 이름, 종별, 지역, 주소, 전화] of 후보) {
      console.log('  | ' + 이름 + ' | ' + 종별 + ' | ' + 지역 + ' | ' + (주소 || '(없음)')
        + ' | ' + (전화 || '(없음)') + ' | ' + 번호 + ' |');
    }
  }
}

/* ── ㉥ 긁기 곳 목록 — **붙여 넣을 글자**로 찍습니다 (지침 10-6 · 손으로 옮기지 않게) ──
   ★ 긁기에 넣는 자는 셋입니다 — ① robots 가 되고 ② HTTP 200 이고 ③ HS3 땅이 아닌 곳.
     robots 금지·403 은 **우회하지 않습니다** (세중님 규칙) — 그 곳은 회원이 직접 누릅니다 */
if (argv.includes('--곳목록')) {
  const 넣을것 = [];
  const 뺀것 = [];
  for (const x of 묶음.filter((y) => y.갈래.startsWith('①') && y.채용)) {
    const v = 표값.get(x.이름) || {};
    const r = 열어본것.get(x.채용) || {};
    const 왜못 = !v.번호 ? '기관 표에 그 이름이 없습니다'
      : HS3땅.get(x.이름) ? 'HS3 땅입니다 (㉩)'
        : !r.됨 ? '못 열었습니다 — ' + (r.왜 || '?') + ' (우회하지 않습니다)' : '';
    if (왜못) { 뺀것.push([x.이름, 왜못]); continue; }
    넣을것.push({ 이름: x.이름, 종류: '', 지역: '', 주소: x.채용, 기관번호: v.번호,
      왜: '세중님 손확인 ② 2026-10-29 · HTTP ' + r.코드 + ' 로 열림 · HS3 땅 아님' });
  }
  console.log('\n══ ㉥ 붙여 넣을 글자 — tools/긁기/손확인추가_곳들.json ══');
  console.log(JSON.stringify({ 꼴: '손확인추가', 만든때: 오늘,
    어디서: '세중님 손확인 ② 답 2026-10-29 15:13 의 ① 갈래 가운데 robots 가 되고 200 이고 HS3 땅이 아닌 곳',
    곳: 넣을것.length, 기관번호붙음: 넣을것.filter((c) => c.기관번호).length, 곳들: 넣을것 }, null, 1));
  for (const [이름, 왜] of 뺀것) console.log('  ✗ 뺀 곳 — ' + 이름 + ' : ' + 왜);
  console.log('\n══ ㉥ 공지섞임_곳들.json 의 기관번호 ══');
  for (const x of 묶음.filter(공지섞임인가)) {
    const v = 표값.get(x.이름) || {};
    console.log('  "' + x.이름 + '" → ' + (v.번호 ? '"' + v.번호 + '"' : 'null (기관 표에 없습니다)'));
  }
}

if (!진짜) {
  console.log('\n[마른] 아무것도 안 담았습니다 — --진짜 로 담습니다');
  process.exit(0);
}

/* ── 담기 ── */
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date();
const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림 = path.join(되돌림터, '손확인2_되돌리기_' + 때 + '.sql');
const 되돌림줄 = ['/* 되돌리기 — 손확인 ② (세중님 10/29 15:13) 담기 전 값 */'];
let 한것 = 0;

/** 그 기관 줄의 지금 값을 받아 되돌림을 적어 둡니다
 *  ★ 한 줄에 **한 번만** 적습니다 — 두 번 적으면 되돌림 글을 차례로 돌렸을 때
 *    **두 번째(이미 바뀐) 값**으로 끝나 되돌림이 아무 일도 안 합니다 */
const 되돌림한것 = new Set();
function 되돌림적기(번호) {
  if (되돌림한것.has(번호)) return;
  되돌림한것.add(번호);
  const [줄] = 줄로(`select coalesce(o."홈페이지",''), coalesce(o."채용페이지",''),
        coalesce(to_char(o."확인한때",'YYYY-MM-DD HH24:MI:SSOF'),''),
        coalesce(o."확인한사람",''), o."불변근거"::text
      from 기관 o where o."기관번호" = '${따옴(번호)}';`) || [[]];
  const [홈, 채용, 확인때, 확인사람, 근거] = 줄 || ['', '', '', '', '{}'];
  되돌림줄.push(`update 기관 set "홈페이지" = ${홈 ? "'" + 따옴(홈) + "'" : 'null'}`
    + `, "채용페이지" = ${채용 ? "'" + 따옴(채용) + "'" : 'null'}`
    + `, "확인한때" = ${확인때 ? "'" + 따옴(확인때) + "'::timestamptz" : 'null'}`
    + `, "확인한사람" = ${확인사람 ? "'" + 따옴(확인사람) + "'" : 'null'}`
    + `, "불변근거" = '${따옴(근거 || '{}')}'::jsonb`
    + ` where 기관번호 = '${따옴(번호)}';`);
}

/* ★ 2026-10-29 세중님 — **바뀐 줄 수 = 기대 줄 수**를 꼭 봅니다. 0줄이면 멈춥니다
   (지침 8-26). `update` 가 0줄을 고치는 것은 psql 에게 오류가 아니라서,
   묻지 않으면 아무도 안 알려 줍니다 — 오늘 ② 아홉 곳이 그렇게 「성공」했습니다 */
function 멈춤(왜) {
  fs.writeFileSync(되돌림, 되돌림줄.join('\n') + '\n', 'utf8');
  console.error('\n✗ ' + 왜);
  console.error('   여기까지 담은 것은 되돌릴 수 있습니다 — ' + 되돌림);
  process.exit(1);
}
function 바꾸기(sql, 기대, 무엇) {
  const 센것 = psql(sql.replace(/;\s*$/, '') + ' returning 1;')
    .split('\n').filter((l) => l.trim() === '1').length;
  if (센것 !== 기대) 멈춤(무엇 + ' — 바뀐 줄 ' + 센것 + '개 · 기대 ' + 기대 + '개 (0줄이면 실패입니다)');
  return 센것;
}

/* ⓞ **기관 표에 줄부터 만듭니다** — 사각지대 병원은 공고가 없어서 줄이 없습니다.
   줄이 없으면 아래 `update` 가 0줄을 고치고도 조용히 성공합니다 (처음 돌릴 때 그래서
   아무것도 안 담겼습니다). 값은 **심평원 공식 값만** 넣습니다 (지침 10-3) —
   이름·종별·시도·시군구·주소·전화. 공공·대학·탭 판정은 `기관표채우기()` 몫이라
   **확인한때를 안 찍습니다** (찍으면 그 함수가 이 줄을 영영 안 고칩니다). */
function 줄만들기(x) {
  const v = 표값.get(x.이름) || {};
  if (!v.번호 || v.줄있나) return false;
  되돌림줄.push(`delete from 기관 where 기관번호 = '${따옴(v.번호)}';`
    + '   /* 이 줄은 2026-10-29 손확인 ② 로 새로 만든 것입니다 */');
  const 센줄 = psql(`insert into 기관 ("기관번호", "이름", "이름키", ykiho, "시도", "시군구",
         "종별", "종별이름", "주소", "전화", "불변근거")
      select 'HIRA:' || h.ykiho, h.yadm_nm, hira_name_key(h.yadm_nm), h.ykiho,
             h.sido_nm, h.sggu_nm, h.cl_cd, h.cl_cd_nm, nullif(h.addr,''), nullif(h.tel,''),
             jsonb_strip_nulls(jsonb_build_object(
               '기관', '세중 손확인 ${오늘} — 손확인 ② 로 줄을 만들었습니다 (공고가 없어 줄이 없었습니다)',
               '주소', case when coalesce(h.addr,'') <> '' then 'hira_org(ykiho)' end,
               '전화', case when coalesce(h.tel,'') <> '' then 'hira_org(ykiho)' end))
        from hira_org h where h.ykiho = substr('${따옴(v.번호)}', 6)
      on conflict ("기관번호") do nothing;
      select count(*) from 기관 where 기관번호 = '${따옴(v.번호)}';`).trim();
  const 됐나 = 센줄.split('\n').pop().trim() === '1';
  console.log('  ' + (됐나 ? '○' : '✗') + ' 줄 만들기 — ' + x.이름.slice(0, 20).padEnd(21)
    + (됐나 ? v.번호.slice(0, 14) + '…' : '안 만들어졌습니다 (심평원에 그 번호가 없습니다)'));
  if (됐나) { v.줄있나 = true; 한것++; }
  return 됐나;
}
console.log('── ⓞ 기관 표에 줄 만들기 (줄이 없으면 아무것도 담기지 않습니다) ──');
for (const x of 묶음) 줄만들기(x);

/* ② 공지 섞임 — 채용페이지는 **안 건드립니다** */
for (const x of 묶음.filter((y) => y.갈래 === '②')) {
  const v = 표값.get(x.이름) || {};
  if (!v.번호 || !v.줄있나) {
    console.log('  ✗ ' + x.이름 + ' — '
      + (v.번호 ? '기관 표에 줄이 없습니다 (ⓞ 에서 못 만들었습니다)'
        : '심평원에서 이름이 하나로 안 풀립니다') + ' (건너뜁니다)');
    continue;
  }
  /* ★ 우리 봇이 못 열어도 **담습니다** — 이 칸은 세중님이 **눈으로 보신 것**이고,
     403·robots 는 「그 쪽이 우리 봇을 막는다」는 뜻이지 「주소가 틀렸다」가 아닙니다.
     대신 **우리가 본 것을 그대로 근거에 적습니다** (지침 10-6). 긁기는 따로 막습니다 */
  const r = x.공지 ? 열어본것.get(x.공지) : null;
  되돌림적기(v.번호);
  const 봇본것 = r ? (r.됨 ? '우리 봇 HTTP ' + r.코드 : '우리 봇은 못 열었습니다 — ' + r.왜) : '';
  const 표시 = '세중 손확인 ' + 오늘
    + (x.공지 ? (봇본것 ? ' · ' + 봇본것 : '') : ' (목록 주소 못 찾음)');
  바꾸기(`update 기관
          set "불변근거" = "불변근거" || jsonb_strip_nulls(jsonb_build_object(
                '공지섞임', '${따옴(표시)}',
                '목록상태', ${목록상태.has(x.이름)
                  ? "'" + 따옴(목록상태.get(x.이름) + ' (' + 오늘 + ')') + "'" : 'null'},
                '공지목록', ${x.공지 ? "'" + 따옴(x.공지) + "'" : 'null'}
                ${x.홈 && !v.홈 ? `, '홈페이지', '세중 손확인 ${오늘}'` : ''}))
              ${x.홈 && !v.홈 ? `, "홈페이지" = '${따옴(x.홈)}'` : ''},
              "확인한때" = now(), "확인한사람" = '${따옴(적은사람)}', "고친때" = now()
        where 기관번호 = '${따옴(v.번호)}';`, 1, '② ' + x.이름);
  console.log('  ○ ② ' + x.이름.slice(0, 20).padEnd(21) + (x.공지 || '(목록 주소 없음)')
    + (x.홈 && !v.홈 ? ' · 홈페이지도 담았습니다' : ''));
  if (목록상태.has(x.이름)) console.log('        목록상태 — ' + 목록상태.get(x.이름));
  한것++;
}

/* ② 홈페이지 = **공지 주소의 scheme+host** (세중님 10/29 15:50 2번)
   ★ 담기 전에 **열어서 200 + 제목·본문에 병원 이름**이 있나 봅니다. 없거나 막히면
     담지 않고 목록으로 올립니다 — 집만 떼는 것도 **주소를 만드는 일**이라서,
     그 집이 그 병원 쪽인 것을 우리가 봐야 합니다 (지침 3절) */
console.log('── ② 홈페이지 — 공지 주소의 집만 (열어서 200 + 이름 확인) ──');
const 홈못담음 = [];
for (const x of 묶음.filter(공지섞임인가)) {
  const v = 표값.get(x.이름) || {};
  if (!v.번호 || !v.줄있나) { 홈못담음.push([x.이름, '', '기관 표에 줄이 없습니다']); continue; }
  if (v.홈) { console.log('  · ' + x.이름.slice(0, 20).padEnd(21) + '홈페이지가 이미 있습니다 — 그대로 둡니다'); continue; }
  const 집 = new URL(x.공지).origin + '/';
  const r = await 받기(집);
  if (!r.됨) { 홈못담음.push([x.이름, 집, '못 열었습니다 — ' + r.왜]); continue; }
  const 토막 = 이름토막(x.이름);
  const 제목 = ((r.html || '').match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i) || [])[1] || '';
  const 어디 = 토막.find((n) => 제목.includes(n)) ? '제목'
    : 토막.find((n) => String(r.글 || '').includes(n)) ? '본문' : '';
  const 맞은것 = 토막.find((n) => 제목.includes(n) || String(r.글 || '').includes(n));
  if (!맞은것) {
    홈못담음.push([x.이름, 집, 'HTTP ' + r.코드 + ' 인데 제목·본문에 병원 이름이 없습니다 (제목 「'
      + 제목.replace(/\s+/g, ' ').trim().slice(0, 40) + '」)']);
    continue;
  }
  되돌림적기(v.번호);
  바꾸기(`update 기관 set "홈페이지" = '${따옴(집)}',
            "불변근거" = "불변근거" || jsonb_build_object('홈페이지',
               '세중 손확인 ${오늘} · 공지 주소에서 집만'),
            "고친때" = now()
      where 기관번호 = '${따옴(v.번호)}';`, 1, '② 홈페이지 ' + x.이름);
  v.홈 = 집;
  console.log('  ○ ' + x.이름.slice(0, 20).padEnd(21) + 집.padEnd(34)
    + 'HTTP ' + r.코드 + ' · ' + 어디 + '에 「' + 맞은것 + '」');
  한것++;
}
for (const [이름, 집, 왜] of 홈못담음) {
  console.log('  ✗ ' + 이름.slice(0, 20).padEnd(21) + (집 || '-').padEnd(34) + 왜);
}

/* ① 서광 — 홈페이지가 바뀌었습니다 (채용페이지는 손확인_주소.mjs 가 담습니다) */
for (const x of 묶음.filter((y) => y.갈래 === '①' && y.홈)) {
  const v = 표값.get(x.이름) || {};
  if (!v.번호 || !v.줄있나) { console.log('  ✗ ' + x.이름 + ' — 기관 표에 줄이 없습니다'); continue; }
  const r = 열어본것.get(x.홈) || {};
  되돌림적기(v.번호);
  바꾸기(`update 기관 set "홈페이지" = '${따옴(x.홈)}',
              "불변근거" = "불변근거" || jsonb_build_object('홈페이지',
                 '세중 손확인 ${오늘} (옛 주소에서 바뀜 · ${따옴(r.됨 ? '우리 봇 HTTP ' + r.코드
                   : '우리 봇은 못 열었습니다 — ' + (r.왜 || '?'))})'),
              "고친때" = now()
        where 기관번호 = '${따옴(v.번호)}';`, 1, '① 홈페이지 ' + x.이름);
  console.log('  ○ ① ' + x.이름 + ' 홈페이지 — ' + (v.홈 || '(없음)') + ' → ' + x.홈);
  한것++;
}

/* ①새 — 화명일신기독병원을 기관 표에 넣습니다 (후보가 **하나일 때만**) */
const 새것 = 묶음.find((y) => y.갈래 === '①새');
if (새것) {
  /* ★ 이 이름은 `기관번호_이름으로` 로 안 풀립니다 — 심평원 공식 이름이
     「재단법인 일신기독교선교회 화명일신기독병원」 이라 이름열쇠가 다릅니다.
     그래서 **후보 ykiho 로** 줄이 있나 봅니다 (두 번 넣지 않게) */
  const 이미 = 일신후보.length === 1
    && 줄로(`select count(*) from 기관 where 기관번호 = 'HIRA:${따옴(일신후보[0][0])}';`)[0][0] !== '0';
  if (이미) {
    console.log('  · ' + 새것.이름 + ' — 이미 기관 표에 있습니다 (HIRA:'
      + 일신후보[0][0].slice(0, 8) + '… · 채용페이지는 그대로 둡니다)');
  } else if (일신후보.length !== 1) {
    console.log('  ✗ ' + 새것.이름 + ' — 심평원 후보가 ' + 일신후보.length
      + '곳입니다. **안 넣습니다** (짐작하지 않습니다 · 지침 10-3)');
  } else {
    const ykiho = 일신후보[0][0];
    되돌림줄.push(`delete from 기관 where 기관번호 = 'HIRA:${따옴(ykiho)}';`
      + '   /* 이 줄은 오늘 새로 넣은 것입니다 */');
    psql(`insert into 기관 ("기관번호", "이름", "이름키", ykiho, "시도", "시군구",
             "종별", "종별이름", "주소", "전화", "채용페이지", "불변근거")
          select 'HIRA:' || h.ykiho, h.yadm_nm, hira_name_key(h.yadm_nm), h.ykiho,
                 h.sido_nm, h.sggu_nm, h.cl_cd, h.cl_cd_nm,
                 nullif(h.addr,''), nullif(h.tel,''), '${따옴(새것.채용)}',
                 jsonb_strip_nulls(jsonb_build_object(
                   '채용페이지', '세중 손확인 ${오늘}',
                   '주소', case when coalesce(h.addr,'') <> '' then 'hira_org(ykiho)' end,
                   '전화', case when coalesce(h.tel,'') <> '' then 'hira_org(ykiho)' end))
            from hira_org h where h.ykiho = '${따옴(ykiho)}'
          on conflict ("기관번호") do nothing;`);
    /* ★ `확인한때` 를 **안 찍습니다** — 찍으면 `기관표채우기()` 가 이 줄을 영영
       안 고칩니다 (`where t.확인한때 is null`). 공공·대학·탭 판정은 그쪽 몫입니다.
       기관번호가 `HIRA:` 라서 울타리 ㉡(NAME: + 확인한때)에도 안 걸립니다 */
    console.log('  ○ ①새 ' + 새것.이름 + ' — 기관 표에 넣었습니다 (HIRA:' + ykiho.slice(0, 8)
      + '… · 채용페이지 함께 · 확인한때는 안 찍었습니다)');
    한것++;
  }
}

fs.writeFileSync(되돌림, 되돌림줄.join('\n') + '\n', 'utf8');
console.log('\n○ ' + 한것 + '줄을 담았습니다 · 되돌림 ' + 되돌림 + ' (' + 되돌림줄.length + '줄)');
console.log('\n── 담은 뒤 ──');
console.log(psql(`\\pset pager off
  select count(*) filter (where "불변근거" ? '공지섞임') as "공지섞임 표시",
         count(*) filter (where "불변근거" ? '공지목록') as "공지 목록 주소",
         count(*) filter (where coalesce("채용페이지",'') <> '') as "채용페이지",
         count(*) filter (where "불변근거"->>'채용페이지' like '세중 손확인%') as "그중 손확인"
    from 기관;`, ['-X', '-q']));
