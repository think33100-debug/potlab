/* ═══════════════════════════════════════════════════════════════
 *  VMS 봉사활동 수집기 — 한국사회복지협의회 (B460014)
 *  2026-10-02. **크론은 꺼 둔 채입니다** (토요일 마무리 뒤 승인받고 켭니다).
 * ═══════════════════════════════════════════════════════════════
 *
 *  쓰는 법
 *    node tools/collect-vms.mjs --dry      받아만 보고 안 담습니다
 *    node tools/collect-vms.mjs --한줄     한 줄만 찍습니다 (대조용)
 *    node tools/collect-vms.mjs            담습니다
 *
 *  ── 조사해서 알아낸 것 (봉사활동_구조안.md) ───────────────────
 *
 *  ① 기능이 **둘뿐**입니다
 *       getVollcolectionList  모집
 *       getCenterList         봉사활동처
 *     getVollcolectionItem · getCenterItem 은 「해당 오픈API 서비스가 없거나
 *     폐기됨」(코드 12)입니다. 상세 조회가 없습니다.
 *
 *  ② `areaCode` 가 **필수**입니다. 빼면 resultCode 01 「지역코드를
 *     입력해주세요」. 그래서 전국은 시·도마다 한 번씩 **16번**입니다.
 *
 *  ★ 명세(활용가이드 v1.3)와 실제 응답이 다릅니다 — **실제 응답 기준으로 가립니다**
 *
 *    세중님이 명세를 주셔서 2026-10-03 에 맞춰 봤습니다. 명세 코드표에는
 *      004 = 보건·의료 · 005 = 교통·환경·식품지킴이 · 003 = 문화·예술
 *      광주 = 0105 · 전남 = 0113
 *    이라고 적혀 있습니다. **옛 앱은 이 표를 제대로 따른 것입니다.**
 *    틀린 것은 옛 앱이 아니라, 그 뒤 서버 응답이 명세와 어긋나게 바뀐 것입니다.
 *
 *    그래서 이 수집기는 코드표를 믿지 않고 **응답이 말해 주는 것**만 씁니다 —
 *      분야 → `centTypeName`   (centType 코드로 거르지 않습니다)
 *      지역 → `areaName`       (코드에 붙은 이름표를 믿지 않습니다)
 *    명세가 바뀌든 안 바뀌든 응답을 그대로 담으면 어긋나지 않습니다.
 *
 *  ③ 지역코드 16개입니다. 명세의 17개와 다릅니다 —
 *       0105(광주) · 0113(전남) 은 지금 **빈 코드**입니다 (0건)
 *       0118 이 areaName「전남광주」 — 둘을 묶어서 줍니다
 *     옛 앱은 명세대로 0105·0113 을 불러서 광주·전남이 늘 0건이었습니다.
 *
 *  ④ `numOfRows` 에 상한이 없습니다. 2,000을 달라 하면 있는 만큼 옵니다 →
 *     **쪽 넘기기가 필요 없습니다.**
 *
 *  ⑤ 모집 응답에 **분야 칸이 없습니다.** `centType` 인자도 모집 쪽에서는
 *     무시됩니다(붙여도 건수가 같습니다). 그래서 centCode 로 봉사처를 이어
 *     `centTypeName` 을 가져옵니다. 전국 1,012건 중 **932건(92%)** 이 이어집니다.
 *     못 이은 것은 전부 한 곳 — 대한적십자사 인천광역시혈액원(헌혈의집).
 *
 *  ⑥ 시·군·구 칸이 없습니다. 봉사처 `addr` 에서 뽑습니다. 그 값은
 *     **기관이 있는 곳**이고 봉사하는 곳이 아닙니다 (place 는 자유 글).
 *
 *  ⑦ 하루 한도 10,000 (x-ratelimit-limit 머리글에서 읽음). 한 바퀴 32번.
 *
 *  ⑧ ⚷ 봉사처 응답에 **시설장(centMaster)·담당자(centWorker) 실명**이 옵니다.
 *     이 수집기는 그 두 칸을 **아예 안 읽습니다.** DB 에도 칸이 없습니다.
 *     옛 앱(gas/wage.js 12578줄)은 centWorker 를 회원 화면까지 보냈습니다.
 *
 *  ⑨ VMS 는 글자를 **두 번** 감쌉니다 — `&amp;#39;` → `&#39;` → `'`.
 *     한 번만 풀면 화면에 `&#39;` 가 글자로 남습니다. 세 번 풉니다.
 *
 *  열쇠 (.env / .env.server)
 *    ALIO_DETAIL_KEY   공공데이터포털 인증키 (계정 하나에 열쇠 하나입니다)
 *    COLLECT_KEY_VMS   봉사담기() 가 보는 열쇠
 *    SUPABASE_URL · SUPABASE_SERVICE_KEY
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(여기, '..');
const 읽기 = (f) => {
  const o = {};
  if (!fs.existsSync(f)) return o;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
  }
  return o;
};
const cfg = {
  ...읽기(path.join(ROOT, '.env.local')),
  ...읽기(path.join(ROOT, 'web', '.env.local')),
  ...읽기(path.join(ROOT, '.env.server')),
  ...읽기(path.join(ROOT, '.env')),
  ...process.env,
};
cfg.SUPABASE_URL = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 한줄 = argv.includes('--한줄');
const 며칠 = argv.includes('--일') ? Number(argv[argv.indexOf('--일') + 1]) || 180 : 180;

const t0 = Date.now();
const 말 = (s) => { if (!한줄) console.log(s); };

/* 쓸어서 확인한 진짜 지역코드. 0105·0113 은 빈 코드라 없습니다 */
const 지역 = [
  ['0101', '서울'], ['0102', '부산'], ['0103', '대구'], ['0104', '인천'],
  ['0106', '대전'], ['0107', '울산'], ['0117', '세종'], ['0108', '경기'],
  ['0109', '강원'], ['0110', '충북'], ['0111', '충남'], ['0112', '전북'],
  ['0118', '전남광주'], ['0114', '경북'], ['0115', '경남'], ['0116', '제주'],
];

const BASE = 'https://apis.data.go.kr/B460014/vmsdataview';
const 날 = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

/* VMS 글자 다듬기 — 두 번 감싸 오므로 세 번 풉니다.
   태그를 걷어내는 함수를 쓰면 안 됩니다. <2026년 한가위 정담장터> 처럼
   꺾쇠로 시작하는 제목이 통째로 사라집니다 (옛 앱에서 실제로 그랬습니다) */
function 글자(v) {
  let s = String(v == null ? '' : v);
  for (let i = 0; i < 3; i++) {
    s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
  }
  return s.trim();
}
const 건들 = (t) => [...t.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
const 뽑기 = (x, t) => {
  const m = x.match(new RegExp('<' + t + '>([^<]*)</' + t + '>'));
  return m ? 글자(m[1]) : '';
};
const 전체수 = (t) => Number((t.match(/<totalCount>(\d+)</) || [])[1] || 0);

let 부른수 = 0;
let 한도 = null;
async function 받기(경로) {
  부른수++;
  const r = await fetch(BASE + 경로 + '&serviceKey=' + encodeURIComponent(cfg.ALIO_DETAIL_KEY));
  if (한도 === null) {
    한도 = { 한도: r.headers.get('x-ratelimit-limit'), 남음: r.headers.get('x-ratelimit-remaining') };
  }
  const t = await r.text();
  const 까닭 = (t.match(/<resultMsg>([^<]*)</) || t.match(/<returnAuthMsg>([^<]*)</) || [])[1] || '';
  if (!r.ok || /오류|없거나|입력해|등록되지/.test(까닭)) {
    throw new Error('HTTP ' + r.status + ' · ' + 까닭 + ' · 응답 원문 — ' + t.slice(0, 500));
  }
  return t;
}

/* 날짜가 성한 것만 넘깁니다. 봉사처 establishDate 에 이런 것들이 섞여 옵니다 —
 *     2014-04-__     반쪽 (DB 가 22007 로 거절)
 *     0000-00-00     없는 날 (22008 로 거절)
 * 거절되면 그 묶음 500개가 **통째로** 안 들어갑니다. 두 번 당하고 고쳤습니다.
 *
 * 꼴만 보면 모자랍니다 — `0000-00-00` 도 \d{4}-\d{2}-\d{2} 를 지납니다.
 * 그래서 날짜로 바꿔 **되돌려 견줍니다.** 2월 30일 같은 것도 이때 걸립니다.
 * 빈 칸으로 둡니다. 짐작해서 1일로 채우지 않습니다. */
function 날짜만(v) {
  const s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : '';
}

/* node tools/collect-vms.mjs --날짜시험  — 위 함수만 봅니다 (API 안 부릅니다) */
if (argv.includes('--날짜시험')) {
  const 봐야할것 = [
    ['2014-04-01', '2014-04-01'], ['2026-10-02', '2026-10-02'],
    ['2014-04-__', ''], ['0000-00-00', ''], ['2014-02-30', ''],
    ['2014-13-01', ''], ['', ''], [null, ''], ['2014-4-1', ''],
  ];
  let 틀림 = 0;
  for (const [넣은것, 나와야할것] of 봐야할것) {
    const 나온것 = 날짜만(넣은것);
    const ok = 나온것 === 나와야할것;
    if (!ok) 틀림++;
    console.log((ok ? '  ○ ' : '  ✗ ') + String(넣은것).padEnd(12)
      + '→ "' + 나온것 + '"' + (ok ? '' : '   나와야 할 것 "' + 나와야할것 + '"'));
  }
  console.log(틀림 ? '\n' + 틀림 + '개 틀렸습니다' : '\n날짜 걸러내기 ' + 봐야할것.length + '개 다 맞습니다');
  process.exit(틀림 ? 1 : 0);
}

/* 주소에서 시·군·구. 「경기 수원시 권선구 매실로 24」 → 수원시
   두 번째 토막이 시·군·구로 끝날 때만 씁니다. 짐작해서 붙이지 않습니다 */
function 시군구뽑기(주소) {
  const m = String(주소 || '').match(/^\S+\s+(\S+(?:시|군|구))(?:\s|$)/);
  return m ? m[1] : '';
}

const 복지보건 = new Set(['노인복지시설', '장애인복지시설', '아동복지시설', '청소년복지시설',
  '여성복지시설', '노숙인복지시설', '정신요양시설', '사회복지관', '보건의료', '사회복지분야 법인/단체']);

async function rpc(이름, body) {
  const k = cfg.SUPABASE_SERVICE_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(이름), {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const 글 = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' · 응답 원문 — ' + 글.slice(0, 500));
  return 글 ? JSON.parse(글) : null;
}

const 없는것 = ['ALIO_DETAIL_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'COLLECT_KEY_VMS']
  .filter((k) => !cfg[k]);
말('VMS 봉사활동 · ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  + ' · 오늘부터 ' + 며칠 + '일' + (dry ? ' · **--dry**' : ''));
for (const k of ['ALIO_DETAIL_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'COLLECT_KEY_VMS']) {
  말('  ' + k.padEnd(22) + (cfg[k] ? '있음' : '**없음**'));
}
if (없는것.length && !dry) { console.error('\n열쇠가 모자랍니다 — ' + 없는것.join(' · ')); process.exit(1); }
if (없는것.filter((k) => k !== 'COLLECT_KEY_VMS' && k !== 'SUPABASE_SERVICE_KEY').length) {
  console.error('\n열쇠가 모자랍니다 — ' + 없는것.join(' · ')); process.exit(1);
}

/* ── ① 봉사활동처 먼저. 모집의 분야·시군구가 여기서 옵니다 ── */
const 처목록 = [];
const 처맵 = new Map();
말('\n── 봉사활동처 ──');
for (const [cd, nm] of 지역) {
  const t = await 받기('/getCenterList?numOfRows=3000&pageNo=1&areaCode=' + cd);
  const it = 건들(t);
  for (const x of it) {
    const 코드 = 뽑기(x, 'centCode');
    if (!코드) continue;
    const 주소 = (뽑기(x, 'addr') + ' ' + 뽑기(x, 'addrDetail')).trim();
    const 줄 = {
      기관코드: 코드,
      이름: 뽑기(x, 'centName'),
      시도: 뽑기(x, 'areaName'),
      분야: 뽑기(x, 'centTypeName'),
      주소,
      시군구: 시군구뽑기(주소),
      전화: 뽑기(x, 'telNum'),
      우편번호: 뽑기(x, 'zipCode'),
      세운날: 날짜만(뽑기(x, 'establishDate')),
      /* ⚷ centMaster · centWorker 는 읽지 않습니다 */
    };
    if (!줄.이름) continue;
    처목록.push(줄);
    처맵.set(코드, 줄);
  }
  말('  ' + nm.padEnd(9) + String(it.length).padStart(5) + ' / 전체 ' + 전체수(t));
}
말('  ' + '합계'.padEnd(9) + String(처목록.length).padStart(5) + '곳');

/* ── ② 모집 ── */
const 모집 = [];
말('\n── 모집 ──');
for (const [cd, nm] of 지역) {
  const t = await 받기('/getVollcolectionList?numOfRows=3000&pageNo=1&strDate=' + 날(0)
    + '&endDate=' + 날(며칠) + '&areaCode=' + cd);
  const it = 건들(t);
  for (const x of it) {
    const 번호 = Number(뽑기(x, 'seq'));
    if (!번호) continue;
    const 코드 = 뽑기(x, 'centCode');
    const 처 = 처맵.get(코드);
    const 제목 = 뽑기(x, 'title');
    if (!제목) continue;
    모집.push({
      번호,
      제목,
      기관: 뽑기(x, 'centName'),
      모집한곳: 뽑기(x, 'reqName'),
      기관코드: 코드 || null,
      시도: 뽑기(x, 'areaName'),
      시군구: 처 ? 처.시군구 : '',
      장소: 뽑기(x, 'place'),
      분야: 처 ? 처.분야 : '',
      활동종류: 뽑기(x, 'actTypeName'),
      기간: 뽑기(x, 'termTypeName'),
      상태: 뽑기(x, 'statusName'),
      모집인원: Number(뽑기(x, 'reqCnt')) || 0,
      신청인원: Number(뽑기(x, 'partCnt')) || 0,
      청소년: 뽑기(x, 'teenager') === 'Y',
      올린날: 날짜만(뽑기(x, 'regDate')),
      /* 신청은 VMS 에서 합니다. 이 API 가 주소를 안 줘서 seq 로 만듭니다 —
         실제로 쓰이는 주소를 확인하고 넣은 것입니다 (옛 앱과 같은 꼴) */
      주소: 'https://www.vms.or.kr/partspace/recruitView.do?seq=' + 번호,
    });
  }
  말('  ' + nm.padEnd(9) + String(it.length).padStart(5) + ' / 전체 ' + 전체수(t));
}

const 갈래 = (v) => (!v.분야 ? '모름' : 복지보건.has(v.분야) ? '복지·보건' : '기타');
const 셈 = { '복지·보건': 0, 기타: 0, 모름: 0 };
for (const v of 모집) 셈[갈래(v)]++;
const 구있음 = 모집.filter((v) => v.시군구).length;

말('  ' + '합계'.padEnd(9) + String(모집.length).padStart(5) + '건');
말('\n복지·보건 ' + 셈['복지·보건'] + ' · 기타 ' + 셈.기타 + ' · 모름 ' + 셈.모름
  + '   시·군·구 아는 것 ' + 구있음 + '/' + 모집.length);
if (한도) 말('한도 ' + 한도.한도 + ' · 남음 ' + 한도.남음 + ' (이번에 ' + 부른수 + '번)');

if (!한줄) {
  console.log('\n── 보기 다섯 건 ──');
  for (const v of 모집.slice(0, 5)) {
    console.log('  ' + 갈래(v).padEnd(6) + (v.시도 + ' ' + (v.시군구 || '—')).padEnd(14)
      + v.제목.slice(0, 40));
  }
}

if (dry) {
  console.log('\n--dry 라 담지 않았습니다. ' + Math.round((Date.now() - t0) / 1000) + '초');
  process.exit(0);
}

/* ── ③ 담기 — 한 번에 몰아 넣으면 요청이 너무 큽니다. 500개씩 ── */
let 담은처 = 0;
let 담은모집 = 0;
for (let i = 0; i < 처목록.length; i += 500) {
  const r = await rpc('봉사담기', {
    p_secret: cfg.COLLECT_KEY_VMS, p_처: 처목록.slice(i, i + 500), p_모집: null,
  });
  담은처 += Number(r && r['처']) || 0;
}
for (let i = 0; i < 모집.length; i += 500) {
  const r = await rpc('봉사담기', {
    p_secret: cfg.COLLECT_KEY_VMS, p_처: null, p_모집: 모집.slice(i, i + 500),
  });
  담은모집 += Number(r && r['모집']) || 0;
}

if (한줄) {
  console.log('VMS 봉사 · 처 ' + 담은처 + ' · 모집 ' + 담은모집
    + ' · 복지보건 ' + 셈['복지·보건'] + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');
} else {
  console.log('\n담았습니다 — 봉사처 ' + 담은처 + '곳 · 모집 ' + 담은모집 + '건');
  console.log(Math.round((Date.now() - t0) / 1000) + '초');
}

/* ── 박동 — 안 남기면 /admin/beat 이 「안 돌았다」를 못 알아챕니다 ──
   다른 수집기(collect-hosp 등)와 같은 꼴입니다.

   ⚠ `collect_source` 에 VMS 줄이 있어야 들어갑니다.
      아직 없습니다 — sql/2026-10-04_수집경로_봉사교육.sql 를 올려야 합니다.
      그때까지는 조용히 실패하고 수집 자체는 그대로 끝납니다. */
try {
  await rpc('collect_beat', {
    p_secret: cfg.COLLECT_KEY_VMS,
    p_source: 'VMS',
    p_beat: {
      took_ms: Date.now() - t0,
      ok: true,
      본곳: 처목록.length,
      담음: 담은모집,
      메모: { 봉사처: 담은처, 복지보건: 셈['복지·보건'], 기타: 셈['기타'], 모름: 셈['모름'] },
    },
  });
} catch (e) {
  console.log('박동을 못 남겼습니다 — ' + String(e.message).slice(0, 160));
  console.log('(수집은 끝났습니다. collect_source 에 VMS 줄이 없으면 이렇게 됩니다)');
}
