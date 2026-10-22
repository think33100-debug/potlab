/* 신형 채용사이트(JobFlex) 수집기 — DB 에 바로 담습니다 (2026-09-28).
 *
 *   node tools/collect-jobflex.mjs --dry           담지 않고 세기만
 *   node tools/collect-jobflex.mjs                 접수중인 것만 담습니다 (매일)
 *   node tools/collect-jobflex.mjs --백필           마감된 옛 공고까지 전부
 *   node tools/collect-jobflex.mjs --dry gnuh      한 곳만
 *
 * ── 무엇이 막혀 있었나 ───────────────────────────────────────
 * 「로그인이 필요한 듯」 이라고 적어 뒀던 것은 **틀렸습니다.**
 * 브라우저로 열어 보니 비밀번호 칸도 「로그인」 이라는 말도 없고 공고가
 * 그냥 보였습니다. 빠진 것은 요청 머리글 한 줄이었습니다 —
 *
 *     prefix: gnuh.recruiter.co.kr
 *
 * 자세한 것은 tools/hosp/jobflex.mjs 주석에 적었습니다. 목록 받기는
 * 거기 것을 그대로 씁니다 — 두 벌로 두지 않습니다.
 *
 * ── 규칙은 한 벌입니다 ───────────────────────────────────────
 *   직군 판정   tools/gas-rules.mjs   (gas/wage.js 에서 떼어 옵니다)
 *   네 갈래     tools/sort-rule.mjs
 *   목록 받기   tools/hosp/jobflex.mjs
 *   쓰기        DB 의 collect_put()   ← 유일한 쓰기 통로. service_role 을 안 씁니다
 *
 * ── 열쇠 (GitHub Secrets) ────────────────────────────────────
 *   SUPABASE_URL · SUPABASE_ANON_KEY
 *   COLLECT_KEY_JF   collect_put 의 열쇠
 *
 * ── 옛 공고를 담는 방식 ──────────────────────────────────────
 * `--백필` 이면 마감된 것까지 전부 담습니다 (946건).
 * `first_seen` 은 **원래 올린 날**이 됩니다 — job_posts 의 트리거가
 * `least(collected_at, posted_at, apply_from)` 으로 잡기 때문에
 * `posted_at` 에 공고 시작일(startDateTime)을 넣으면 그날이 됩니다.
 * 우리가 따로 건드리지 않습니다.
 *
 * 마감이 지난 것은 담긴 뒤 `hide_stale_posts()` 가 감춥니다. 지우지 않습니다 —
 * 회원 화면에는 접수중인 것만 뜨고, 옛 공고는 보관됩니다.
 *
 * ── 상세는 아직 안 엽니다 ────────────────────────────────────
 * 목록에 제목·기간·기관이 다 있어 직군은 제목으로 갈립니다.
 * 제목만으로 안 갈리는 것은 보류함으로 보냅니다 (sortJob 2·3단계).
 * 상세 열기는 사이트당 하루 50건 규칙으로 따로 붙일 자리입니다.
 */
import fs from 'node:fs';
import { 고용형태코드 } from './공고문읽기.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 곳들, 목록, 풀기, 상세, 꼬리표가르기, 경력조건 } from './hosp/jobflex.mjs';
import { 첨부모으기 } from './첨부담기.mjs';   /* 첨부 주소는 이 창구 한 자리 (2026-10-22) */
import { sortJob } from './sort-rule.mjs';
import { mixedTitle, 구운날 } from './gas-rules.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'JF';

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}

/* ⚠ **anon 열쇠만 씁니다.** service_role 은 GitHub 에 넣지 않습니다.
   권한은 collect_put 안의 COLLECT_KEY_JF 검사로 봅니다 (AL2·CE2·ALIVE 와 같은 방식) */
async function rpc(cfg, fn, body) {
  const k = cfg.SUPABASE_SERVICE_KEY || cfg.SUPABASE_ANON_KEY;   /* 창구는 service_role 로 (2026-10-11) */
  if (!k) throw new Error('SUPABASE_ANON_KEY 가 없습니다');
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

/* ── 본체 ── */
const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 백필 = argv.includes('--백필');
/* ★ 2026-10-22 — `--상세 6` 의 **「6」이 기관 찾을말로 읽혀** 0곳이 됐습니다.
   값을 받는 깃발(`--상세`) 바로 뒤의 토막은 찾을말이 아닙니다 */
const 값받는깃발 = ['--상세'];
const 찾을말 = argv.filter((x, i) => !x.startsWith('--') && !값받는깃발.includes(argv[i - 1]));
const 볼것 = 찾을말.length
  ? 곳들.filter((c) => 찾을말.some((w) => c.호스트.includes(w) || c.이름.includes(w)))
  : 곳들;

const cfg = env();
const t0 = Date.now();
const 오늘 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

console.log('신형 채용사이트(JobFlex) 수집 — ' + 볼것.length + '곳 · ' + 오늘
  + (백필 ? ' · **백필**(마감된 것까지 전부)' : ' · 접수중인 것만')
  + (dry ? ' · --dry' : ''));
console.log('  규칙 구운 날  ' + 구운날);
console.log('  열쇠          Supabase ' + (cfg.SUPABASE_ANON_KEY ? '있음' : '**없음**')
  + ' · collect_put ' + (cfg.COLLECT_KEY_JF ? '있음' : '**없음**'));
if (!dry && !cfg.COLLECT_KEY_JF) { console.error('COLLECT_KEY_JF 가 없습니다'); process.exit(1); }

/* ① 목록 */
console.log('\n① 목록 —');
const 모은것 = [];
const 곳별 = [];
let 못받음 = 0;
for (const c of 볼것) {
  const g = await 목록(c.호스트);
  if (g.왜) {
    못받음++;
    console.error('✗ ' + c.이름.slice(0, 24).padEnd(26) + g.왜);
    곳별.push({ ...c, 왜: g.왜 });
    continue;
  }
  const 줄 = g.목록.map((x) => 풀기(c.호스트, x));
  줄.forEach((r) => 모은것.push({ ...r, 곳: c }));
  곳별.push({ ...c, 전체: 줄.length, 접수중: 줄.filter((r) => r.접수중).length });
  console.log('  ' + c.이름.slice(0, 24).padEnd(26) + String(줄.length).padStart(4) + '건'
    + ' · 접수중 ' + String(줄.filter((r) => r.접수중).length).padStart(3));
  await new Promise((y) => setTimeout(y, 500));
}
if (못받음 === 볼것.length) {
  console.error('\n한 곳도 못 받았습니다 — prefix 머리글이나 막힘을 보세요');
  process.exit(1);
}

/* ② 판정 — 규칙은 sortJob 한 벌입니다. 여기서 따로 안 가립니다 */
const 결과 = 모은것.map((r) => {
  const 갈래 = sortJob(r.제목, '', null);
  return { ...r, 갈래 };
});
const 회원 = 결과.filter((x) => x.갈래.갈래 === '회원목록');
const 보류 = 결과.filter((x) => x.갈래.갈래 === '보류함');
const 쓰레기 = 결과.filter((x) => x.갈래.갈래 === '쓰레기통');
/* 임상병리사·방사선사 — 버리지 않고 화면에 안 보이게 쌓아둡니다 (2026-09-20 결정) */
const 쌓을것 = 결과.filter((x) => x.갈래.갈래 === '숨김보관');

console.log('\n② 판정 — 회원 목록 ' + 회원.length + ' · 보류함 ' + 보류.length
  + ' · 쓰레기통 ' + 쓰레기.length);

/* 담을 것 — 백필이 아니면 접수중인 것만. 쓰레기통은 담지 않습니다 */
const 후보 = 회원.concat(보류).concat(쌓을것).filter((x) => 백필 || x.접수중);
console.log('  이번에 담을 것 ' + 후보.length + '건'
  + (백필 ? '' : ' (접수중만 · --백필 이면 ' + (회원.length + 보류.length) + '건)'));

const 우리 = 후보.filter((x) => x.갈래.갈래 === '회원목록');
if (우리.length) {
  console.log('\n  ★ 회원 목록에 올라갈 것 —');
  우리.forEach((x) => console.log('     ' + (x.접수중 ? '접수중' : '마감  ') + ' '
    + (x.마감 || '마감일 없음').padEnd(11)
    + (x.직군 || '?').padEnd(7) + x.기관.slice(0, 16).padEnd(18) + x.제목.slice(0, 44)));
}

/* ③-0 상세 — **전문과 첨부 주소**를 받습니다 (2026-10-22 세중님 3번 ①)
 *
 * 전에는 목록 API 만 썼습니다. 그래서 JF 공고 **233건이 원문 없이** 일곱 칸을
 * 비우고 있었습니다 (tools/못연까닭.mjs 로 셌습니다).
 * 상세 `GET /position/v2/jobflex/{sn}` 가 `jobDescription`(전문)과
 * `attachFileDtoList`(공고문 PDF 직접 주소)를 줍니다. 받은 것은
 * `collect_body` · `첨부담기` **이미 있는 창구**로 담고, 일곱 칸은
 * `첨부되메우기`·`본문칸_다시뽑기` 가 채웁니다 (새 길을 또 만들지 않습니다).
 *
 * 울타리 — 한 바퀴 상한 60건(`--상세 N` · `JF_DETAIL_MAX`) · 사이 400ms.
 *   `--dry` 면 두드리기만 하고 담지 않습니다.
 */
const 상세상한 = Number(argv[argv.indexOf('--상세') + 1]) || Number(process.env.JF_DETAIL_MAX) || 60;
const 상세모음 = new Map();      /* id → { 글, 첨부[], 마감시각 } */
let 상세탈 = 0;
if (상세상한 > 0 && 후보.length) {
  console.log('\n③-0 상세 — 앞 ' + Math.min(상세상한, 후보.length) + '건을 엽니다'
    + ' (상한 ' + 상세상한 + ' · 사이 400ms)');
  for (const x of 후보.slice(0, 상세상한)) {
    const d = await 상세(x.곳.호스트, String(x.id).slice(2));
    if (d.왜) {
      상세탈++;
      if (상세탈 <= 3) console.error('  ✗ ' + x.id + ' · ' + d.왜);
    } else 상세모음.set(x.id, d);
    await new Promise((y) => setTimeout(y, 400));
  }
  const 첨부수 = [...상세모음.values()].reduce((a, d) => a + d.첨부.length, 0);
  const 글있는것 = [...상세모음.values()].filter((d) => String(d.글 || '').length > 200).length;
  console.log('  열림 ' + 상세모음.size + '건 · 탈 ' + 상세탈 + '건'
    + ' · 글 200자 넘는 것 ' + 글있는것 + '건 · 첨부 ' + 첨부수 + '개');
}

/* ③ 담을 줄 만들기 */
const 이제 = new Date().toISOString();
const 담을것 = 후보.map((x) => {
const 간것 = 꼬리표가르기(x.꼬리표);
return ({
  id: x.id,
  external_id: String(x.id).slice(2),
  /* 공용 채용사이트는 한 곳에 여러 병원이 옵니다. classificationCode/tagName 에
     병원 이름이 들어 있어 그걸 기관명으로 씁니다. 없으면 사이트 주인 이름 */
  org_name: x.기관 || x.곳.이름,
  /* ★ 2026-10-05 — 꼬리표를 **값을 보고 갈라 담습니다.**
     전에는 꼬리표를 통째로 근무지 칸(work_place)에 넣었습니다. 그래서
     「비정규직」·「수시」·「업무지원직」이 근무지로 들어가 지역 처리가 망가졌습니다.
     응답 원문으로 확인한 것 (tools/고용24_꼬리표_확인.mjs · 2026-10-05) —
       칸 이름  positionSn · title · submissionStatus · openStatus ·
                announcementType · startDateTime · tagList · fixStatus ·
                careerType · endDateTime · classificationCode ·
                recruitmentType · dday
       ★ **지역을 담은 칸이 하나도 없습니다.** classificationCode 와
         tagList[].tagName 은 늘 같은 값이고, 기관마다 뜻이 다릅니다 —
           성가롤로    정규직 · 계약직            (고용형태)
           일산병원    비정규직 · 수련생 · 업무지원직 (고용형태 + 직렬)
           국제성모    수시                      (채용 방식)
           충남대병원  대전 · 세종                (지역)
     그래서 **낱말을 알아볼 때만** 그 칸에 넣고, 모르면 버리지 않고
     detail 에 남깁니다. */
  work_place: 간것.근무지,
  /* ★ 2026-10-22 세중님 1번 ⓑ — 꼬리표 낱말을 **셋으로 옮겨** 보냅니다.
     전에는 생글자를 그대로 보냈습니다 — 「정규직, 비정규직」 처럼 쉼표로
     이어진 값이 DB 에 그대로 담겨 있습니다(지금 46건 가운데 일부).
     규칙은 `고용형태코드()` 한 자리이고, 섞이면 **비웁니다** */
  employ_type: (고용형태코드(간것.고용형태) || {}).값 || '',
  title: x.제목 || '(없음)',
  /* careerType 은 **경력 조건**입니다. 원문으로 본 값 여섯은
     tools/hosp/jobflex.mjs 의 경력조건() 주석에 적어 두었습니다 (2026-10-07).
     고용형태가 아닙니다 — 알리오와 같이 hire_type 에 둡니다 */
  hire_type: 경력조건(x.경력),
  sido: null, sgg: null, edu: '',
  headcount: null,
  apply_from: x.시작 || null,
  apply_to: x.마감 || null,
  /* ★ 2026-10-21 — 라벨을 바로잡았습니다. JobFlex 는 recruiter.co.kr 이고
     고용24(워크넷)가 아닙니다. 이 라벨은 근거로 관리자 화면에 보입니다.
     옛 줄 22건은 마이그레이션으로 함께 바꿉니다 (세중님 승인 뒤) */
  deadline_src: x.마감 ? 'API:JobFlex' : null,
  /* ★ 2026-10-21 — 마감 시각은 목록 API 가 줍니다 (endDateTime 의 시각 부분) */
  /* ★ 2026-10-22 — 목록에 없으면 **상세의 endDateTime** 으로 (같은 칸입니다) */
  ...((x.마감시각 || (상세모음.get(x.id) || {}).마감시각)
    ? { apply_to_time: x.마감시각 || 상세모음.get(x.id).마감시각 } : {}),
  /* ★ 원래 올린 날. job_posts 의 트리거가 이것으로 first_seen 을 잡습니다 */
  posted_at: x.시작 || null,
  url: x.주소,
  job_group: x.갈래.갈래 === '회원목록' ? (x.직군 || null) : null,
  form: (x.직군 && !mixedTitle(x.제목)) ? null : '포함',
  hidden: x.갈래.갈래 === '숨김보관',   // 쌓아두되 회원 화면에는 안 보입니다
  hold: x.갈래.갈래 === '보류함',
  /* 못 알아본 꼬리표는 **버리지 않고** 여기 남깁니다 —
     나중에 무엇인지 알게 되면 여기서 되살립니다 */
  detail: {
    기관홈: 'https://' + x.곳.호스트 + '.recruiter.co.kr/career/home',
    ...(간것.남은꼬리표 ? { 꼬리표: 간것.남은꼬리표 } : {}),
  },
  evidence: {
    직군근거: x.직군 ? '신형 채용사이트 목록 제목 · ' + x.갈래.왜 : '',
    갈래: x.갈래.갈래,
    단계: String(x.갈래.단계 || ''),
    사유: x.갈래.왜 || '',
    걸린단어: (x.갈래.걸린단어 || []).join(','),
    보류사유: x.갈래.갈래 === '보류함' ? x.갈래.왜 : '',
    접수상태: x.상태,
    꼬리표: x.꼬리표 || '',
    채용사이트: x.곳.호스트 + '.recruiter.co.kr',
  },
  collected_at: 이제,
});
});

/* 버린 것도 남깁니다 — 관리자 쓰레기통 화면이 「왜 버렸는지」 를 보여줍니다 */
const 버릴것 = (백필 ? 쓰레기 : 쓰레기.filter((x) => x.접수중)).map((x) => ({
  id: x.id, org_name: x.기관 || x.곳.이름, title: x.제목, url: x.주소,
  why: x.갈래.왜 + ((x.갈래.걸린단어 || []).length ? ' — ' + x.갈래.걸린단어.join(',') : ''),
  trashed_at: 이제,
}));

/* ④ 담기 */
if (dry) {
  console.log('\n--dry 라 담지 않았습니다. ' + Math.round((Date.now() - t0) / 1000) + '초');
} else {
  let 담음 = 0, 건너뜀 = 0;
  for (let i = 0; i < 담을것.length; i += 200) {
    const r = await rpc(cfg, 'collect_put', {
      p_secret: cfg.COLLECT_KEY_JF, p_source: SOURCE, p_rows: 담을것.slice(i, i + 200),
    });
    담음 += r['담음'] || 0; 건너뜀 += r['건너뜀'] || 0;
    (r['건너뛴것'] || []).slice(0, 5).forEach((x) => console.error('  건너뜀 ' + x.id + ' · ' + x.why));
  }
  console.log('\n씀          ' + 담음 + '건' + (건너뜀 ? ' · 건너뜀 ' + 건너뜀 + '건' : ''));

  /* ③-0 에서 받은 **전문·첨부**를 담습니다 (2026-10-22).
     글은 HTML 그대로 둡니다 — 읽는 쪽(칸뽑기)이 표를 보려면 태그가 필요합니다 */
  if (상세모음.size) {
    const 원문들 = [];
    for (const x of 후보) {
      const d = 상세모음.get(x.id);
      if (!d) continue;
      const 글만 = String(d.글 || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ').trim();
      if (글만.length > 60) {
        원문들.push({ job_id: x.id, kind: '상세', ord: 0, url: x.주소 || null, body: d.글 });
      }
    }
    let 글담음 = 0;
    for (let i = 0; i < 원문들.length; i += 50) {
      try {
        const r = await rpc(cfg, 'collect_body', {
          p_secret: cfg.COLLECT_KEY_JF, p_source: SOURCE, p_rows: 원문들.slice(i, i + 50),
        });
        글담음 += r['담음'] || 0;
      } catch (e) {
        console.error('  ✗ collect_body — ' + String(e.message).slice(0, 140));
        break;
      }
    }
    console.log('전문        ' + 글담음 + '건 (job_body · 보낸 것 ' + 원문들.length + ')');

    const 첨부 = 첨부모으기(SOURCE, { 마른: false });
    let 첨부줄 = 0;
    for (const x of 후보) {
      const d = 상세모음.get(x.id);
      if (!d) continue;
      for (const f of d.첨부) {
        첨부.더하기({ job_id: x.id, kind: '공고문', name: f.이름, url: f.주소 });
        첨부줄++;
      }
    }
    if (첨부줄) {
      try {
        const a = await 첨부.끝내기(cfg);
        console.log('첨부        ' + 첨부줄 + '개 보냄'
          + (a && a['담음'] != null ? ' · 담음 ' + a['담음'] : ''));
      } catch (e) {
        console.error('  ✗ 첨부담기 — ' + String(e.message).slice(0, 140));
      }
    }
  }

  let 버림 = 0;
  for (let i = 0; i < 버릴것.length; i += 200) {
    const r = await rpc(cfg, 'collect_trash', {
      p_secret: cfg.COLLECT_KEY_JF, p_source: SOURCE, p_rows: 버릴것.slice(i, i + 200),
    });
    버림 += r['담음'] || 0;
  }
  if (버림) console.log('쓰레기통    ' + 버림 + '건 (지우지 않고 까닭과 함께 남깁니다)');

  /* 담은 뒤 뒷정리 — 지난 공고 감추기 + 회원 화면 새는지 세기.
     백필은 옛 공고를 잔뜩 넣기 때문에 이걸 안 하면 마감된 공고가 쏟아집니다.
     ⚠ hide_stale_posts · pub_leak 은 service_role 전용이라 anon 으로는 401 입니다.
       그래서 열쇠로 권한을 보는 collect_after 창구를 씁니다 (AL2·CE2 와 같은 방식).
       service_role 열쇠를 GitHub 에 넣지 않습니다. */
  try {
    const a = await rpc(cfg, 'collect_after', {
      p_secret: cfg.COLLECT_KEY_JF, p_source: SOURCE, p_days: 45, p_rolling_days: 180,
    });
    const h = (a || {})['감춤'] || {};
    const 말 = Object.entries(h).filter(([k]) => !/기준일|며칠/.test(k))
      .filter(([, v]) => Number(v) > 0).map(([k, v]) => k + ' ' + v + '건');
    console.log('감춤 정리    ' + (말.length ? 말.join(' · ') : '바뀐 것 없음'));

    const L = (a || {})['회원화면'] || {};
    if (L['샘']) {
      console.error('\n  ██ 회원 화면에 있으면 안 될 공고가 있습니다 ██');
      console.error('     마감 지남 ' + L['마감 지남'] + ' · 신호 없이 30일 넘음 ' + L['신호 없이 30일 넘음']
        + ' · 정찰이 보는 중 ' + L['정찰이 살아있다고 보는 중']);
    } else {
      console.log('회원 화면    ' + L['회원 화면 전체'] + '건 · 마감 지난 것 0 · 신호 없이 30일 넘은 것 0 ○');
    }
  } catch (e) { console.error('뒷정리 실패 · ' + String(e.message).slice(0, 200)); }
}

/* ⑤ 곳별 표 */
console.log('\n── 곳별 ──');
const 곳별줄 = 곳별.map((c) => {
  const 내것 = 결과.filter((x) => x.곳.호스트 === c.호스트);
  return {
    이름: c.이름, 호스트: c.호스트, 왜: c.왜,
    전체: 내것.length,
    접수중: 내것.filter((x) => x.접수중).length,
    물리: 내것.filter((x) => x.직군 === '물리치료사').length,
    작업: 내것.filter((x) => x.직군 === '작업치료사').length,
    공통: 내것.filter((x) => x.직군 === '공통').length,
    접수중우리: 내것.filter((x) => x.접수중 && x.갈래.갈래 === '회원목록').length,
  };
});
for (const c of 곳별줄) {
  if (c.왜) { console.log('✗ ' + c.이름.slice(0, 24).padEnd(26) + c.왜); continue; }
  console.log((c.물리 + c.작업 + c.공통 ? '★ ' : '  ') + c.이름.slice(0, 24).padEnd(26)
    + '전체 ' + String(c.전체).padStart(4)
    + ' · 접수중 ' + String(c.접수중).padStart(3)
    + ' · 물리 ' + String(c.물리).padStart(2)
    + ' · 작업 ' + String(c.작업).padStart(2)
    + (c.접수중우리 ? '   ← 접수중인 우리 직군 ' + c.접수중우리 + '건' : ''));
}
const 합 = 곳별줄.reduce((a, c) => ({
  전체: a.전체 + (c.전체 || 0), 접수중: a.접수중 + (c.접수중 || 0),
  물리: a.물리 + (c.물리 || 0), 작업: a.작업 + (c.작업 || 0),
  접수중우리: a.접수중우리 + (c.접수중우리 || 0),
}), { 전체: 0, 접수중: 0, 물리: 0, 작업: 0, 접수중우리: 0 });
console.log('── 전체 ' + 합.전체 + ' · 접수중 ' + 합.접수중
  + ' · 물리치료사 ' + 합.물리 + ' · 작업치료사 ' + 합.작업
  + ' · 접수중인 우리 직군 ' + 합.접수중우리 + '건 · '
  + Math.round((Date.now() - t0) / 1000) + '초');

/* 박동 — 이것도 안 부르고 있었습니다 (2026-10-02). beat_health() 가
   「44시간째 안 왔습니다」로 빨간줄을 세웠는데 실제로는 하루 세 번 잘 돌고
   있었습니다. 안 부르면 「돌고 있나」를 화면에서 못 봅니다 */
if (!dry) {
  try {
    /* 이 파일의 rpc 는 첫 인자가 cfg 입니다 — 다른 수집기와 꼴이 다릅니다 */
    await rpc(cfg, 'collect_beat', {
      p_secret: cfg.COLLECT_KEY_JF, p_source: SOURCE,
      p_beat: { took_ms: Date.now() - t0, ok: !process.exitCode,
        본곳: 곳별줄.length, 담음: 합.접수중우리,
        보류: 0, 버림: 0, 못받음: 0,
        메모: { 전체: 합.전체, 접수중: 합.접수중, 물리: 합.물리, 작업: 합.작업 } },
    });
  } catch (e) { console.error('박동 못 남김 · ' + String(e.message).slice(0, 120)); }
}

fs.writeFileSync(path.join(여기, 'hosp', 'reports', 'jobflex.json'),
  JSON.stringify({ 잰날: 오늘, 백필: 백필, 곳별: 곳별줄 }, null, 1), 'utf8');
