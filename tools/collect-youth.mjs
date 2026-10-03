/* ═══════════════════════════════════════════════════════════════
 *  청년정책 수집기 — 온통청년 (한국고용정보원)
 *  2026-10-04
 * ═══════════════════════════════════════════════════════════════
 *   node tools/collect-youth.mjs           받아서 담습니다
 *   node tools/collect-youth.mjs --dry     받아서 세기만
 *   node tools/collect-youth.mjs --시험    자가검사 (그물 안 씀)
 *
 *  ── 창구 (2026-10-04 에 직접 맞춰 본 것) ─────────────────────
 *    https://www.youthcenter.go.kr/go/ythip/getPlcy
 *      apiKeyNm=<열쇠>   ← 쿼리 인자입니다. 머리글로 넣으면 400
 *      pageNum · pageSize (200 까지 받습니다)
 *      rtnType=json (없으면 json 이 기본)
 *
 *    ★ 명세 쪽(/cmnFooter/openapiIntro/oaiDoc/86)의 「요청 예시」에는
 *      2025년 개편 **전** 주소가 아직 남아 있습니다 —
 *      `/opi/youthPlcyList.do` · `openApiVlak=`. 그걸 따라가면 400 입니다.
 *      쪽을 믿지 말고 창구에 물어 맞췄습니다.
 *
 *  ⚷ 담당자 실명을 **안 담습니다**
 *    응답 60칸에 `sprvsnInstPicNm`(소관기관 담당자) · `operInstPicNm`
 *    (운영기관 담당자) 가 옵니다. DB 에 칸 자체가 없고, 여기서도 안 넘깁니다.
 *
 *  ── 열쇠 ─────────────────────────────────────────────────────
 *    YOUTH_KEY              온통청년 인증키
 *    COLLECT_KEY_YTH        청년담기() 가 보는 열쇠 (없으면 서버 열쇠로 읽음)
 *    SUPABASE_URL · SUPABASE_SERVICE_KEY
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const 읽기 = (p) => {
  try {
    return Object.fromEntries(fs.readFileSync(p, 'utf8').split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)$/))
      .filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
  } catch { return {}; }
};
const cfg = {
  ...읽기(path.join(ROOT, '.env.local')), ...읽기(path.join(ROOT, 'web', '.env.local')),
  ...읽기(path.join(ROOT, '.env.server')), ...읽기(path.join(ROOT, '.env')), ...process.env,
};

const dry = process.argv.includes('--dry');
const 시험 = process.argv.includes('--시험');
const 시작한때 = Date.now();

/* ── 가리는 규칙들 ─────────────────────────────────────────── */

/* 대분류를 화면 탭 다섯으로 줄입니다.
   원문이 「일자리,일자리」처럼 겹쳐 오는 것이 있어 쉼표 앞만 봅니다.
   가운뎃점이 `･`(U+FF65) 라 눈으로는 안 보입니다 — 글자로 찾지 말고
   앞글자로 가립니다 */
export function 갈래보기(대분류) {
  const t = String(대분류 || '').split(',')[0].trim();
  if (!t) return '모름';
  if (t.startsWith('일자리')) return '일자리';
  if (t.startsWith('교육')) return '교육';
  if (t.startsWith('주거')) return '주거';
  if (t.startsWith('금융')) return '금융복지';
  if (t.startsWith('참여')) return '참여';
  /* 자료에 **옛 이름과 새 이름이 섞여** 있습니다 (2026-10-04에 3,150건으로 확인).
     「복지문화」 356건 · 「참여권리」 204건 · 「교육」 151건이 옛 이름입니다.
     참여권리·교육은 앞글자가 같아 저절로 걸리는데 복지문화만 안 걸려
     356건이 「모름」으로 떨어졌습니다. 이 줄이 그걸 받습니다 */
  if (t.startsWith('복지')) return '금융복지';
  return '모름';
}

/* 시·도 가리기.

   ★ `zipCd` 는 **쓰면 안 됩니다.** 중앙부처 정책이 전부 11110(서울 종로)
     으로 옵니다. 그대로 쓰면 전국 정책이 죄다 「서울」이 됩니다
     (2026-10-04 에 표본 400건으로 확인). 이름으로 가립니다. */
const 시도표 = [
  ['서울특별시', '서울'], ['부산광역시', '부산'], ['대구광역시', '대구'],
  ['인천광역시', '인천'], ['광주광역시', '광주'], ['대전광역시', '대전'],
  ['울산광역시', '울산'], ['세종특별자치시', '세종'], ['경기도', '경기'],
  ['강원특별자치도', '강원'], ['강원도', '강원'],
  ['충청북도', '충북'], ['충청남도', '충남'],
  ['전북특별자치도', '전북'], ['전라북도', '전북'],
  /* 2026년에 전남과 광주가 합쳐진 이름입니다. 쪼개 짐작하지 않고 그대로 둡니다 */
  ['전남광주통합특별시', '전남광주'],
  ['전라남도', '전남'], ['경상북도', '경북'], ['경상남도', '경남'],
  ['제주특별자치도', '제주'],
];
const 중앙꼴 = /(부|처|청|위원회|정부산하기관및위원회)$/;

export function 시도보기(상위기관, 소관기관) {
  const h = String(상위기관 || '').trim();
  const s = String(소관기관 || '').trim();
  for (const [긴, 짧] of 시도표) if (h.startsWith(긴) || s.startsWith(긴)) return 짧;
  /* 부처·청·위원회는 **전국** 입니다 — 짐작이 아니라 사실입니다 */
  if (중앙꼴.test(h) || 중앙꼴.test(s.split(' ')[0])) return '전국';
  return '모름';          // 모르면 모른다고 둡니다
}

/* 「20270102 ~ 20270228」 → ['2027-01-02','2027-02-28'] */
export function 기간보기(aplyYmd) {
  const s = String(aplyYmd || '');
  const 날 = [...s.matchAll(/(\d{4})(\d{2})(\d{2})/g)]
    .map((m) => m[1] + '-' + m[2] + '-' + m[3]).filter(날짜만);
  return [날[0] || '', 날[1] || ''];
}
/* 되돌려 맞춰 봅니다 — 0000-00-00 · 2026-02-30 을 걸러냅니다 */
export function 날짜만(v) {
  const s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : '';
}
export function 하루(v) {
  const m = String(v || '').match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? 날짜만(m[1] + '-' + m[2] + '-' + m[3]) : '';
}

/* 상시인가 — 기간 구분이 0057001(정해진 기간) 이 아니면 상시로 봅니다.
   0057002 · 0057003 둘 다 aplyYmd 가 비어 옵니다 (표본으로 확인) */
export const 상시인가 = (aplyPrdSeCd, aplyYmd) =>
  String(aplyPrdSeCd || '') !== '0057001' && !기간보기(aplyYmd)[0];

const 숫자 = (v) => { const n = parseInt(String(v ?? '').trim(), 10); return Number.isFinite(n) ? n : null; };
const 글 = (v, n) => String(v ?? '').trim().slice(0, n || 2000);

/** 응답 한 줄 → DB 한 줄. 담당자 이름 두 칸은 **안 옮깁니다** */
export function 한줄(x) {
  const [시작, 끝] = 기간보기(x.aplyYmd);
  return {
    번호: String(x.plcyNo || ''),
    정책명: 글(x.plcyNm, 300),
    갈래: 갈래보기(x.lclsfNm),
    대분류: 글(x.lclsfNm, 100),
    중분류: 글(x.mclsfNm, 100),
    키워드: 글(x.plcyKywdNm, 300),
    설명: 글(x.plcyExplnCn, 1000),
    지원내용: 글(x.plcySprtCn, 1500),
    소관기관: 글(x.sprvsnInstCdNm, 200),
    운영기관: 글(x.operInstCdNm, 200),
    시도: 시도보기(x.rgtrHghrkInstCdNm, x.sprvsnInstCdNm),
    상시: 상시인가(x.aplyPrdSeCd, x.aplyYmd),
    신청시작: 시작, 신청끝: 끝,
    사업시작: 하루(x.bizPrdBgngYmd), 사업끝: 하루(x.bizPrdEndYmd),
    신청방법: 글(x.plcyAplyMthdCn, 800),
    추가자격: 글(x.addAplyQlfcCndCn, 800),
    나이최소: 숫자(x.sprtTrgtMinAge),
    나이최대: 숫자(x.sprtTrgtMaxAge),
    나이제한없음: String(x.sprtTrgtAgeLmtYn || '') === 'Y',
    신청주소: 글(x.aplyUrlAddr, 500),
    참고주소: 글(x.refUrlAddr1 || x.refUrlAddr2, 500),
    조회수: 숫자(x.inqCnt),
    /* ⚷ sprvsnInstPicNm · operInstPicNm 은 **일부러 안 옮깁니다** */
  };
}

/* ═══ 자가검사 ═══ */
if (시험) {
  let 참 = 0, 거짓 = 0;
  const 봐 = (이름, 된것, 바란것) => {
    const ok = JSON.stringify(된것) === JSON.stringify(바란것);
    console.log((ok ? '  ○ ' : '  ★ ') + 이름 + (ok ? '' : '  된것 ' + JSON.stringify(된것) + ' / 바란것 ' + JSON.stringify(바란것)));
    ok ? 참++ : 거짓++;
  };
  console.log('갈래');
  봐('일자리', 갈래보기('일자리'), '일자리');
  봐('겹쳐 온 것', 갈래보기('일자리,일자리'), '일자리');
  봐('교육(가운뎃점 U+FF65)', 갈래보기('교육･직업훈련'), '교육');
  봐('금융', 갈래보기('금융･복지･문화'), '금융복지');
  봐('참여', 갈래보기('참여･기반'), '참여');
  봐('주거', 갈래보기('주거'), '주거');
  봐('빈값', 갈래보기(''), '모름');
  /* 옛 이름 — 자료에 새 이름과 섞여 옵니다 */
  봐('복지문화(옛 이름)', 갈래보기('복지문화'), '금융복지');
  봐('참여권리(옛 이름)', 갈래보기('참여권리'), '참여');
  봐('교육(옛 이름)', 갈래보기('교육'), '교육');

  console.log('\n시·도 — zipCd 안 쓰고 이름으로');
  봐('세종', 시도보기('세종특별자치시', '세종특별자치시'), '세종');
  봐('충북', 시도보기('충청북도', '충청북도 AI과학인재국'), '충북');
  봐('중앙부처는 전국', 시도보기('국토교통부', '국토교통부'), '전국');
  봐('위원회도 전국', 시도보기('', '금융위원회'), '전국');
  봐('2026년 통합 이름', 시도보기('전남광주통합특별시', '전남광주통합특별시'), '전남광주');
  봐('모르면 모름', 시도보기('', '(재)한국국제문화교류진흥원'), '모름');
  /* ★ 중앙부처 zipCd 가 11110 이라도 서울로 보내면 안 됩니다 */
  봐('문화체육관광부는 서울 아님', 시도보기('문화체육관광부', '문화체육관광부'), '전국');

  console.log('\n신청기간');
  봐('기간 둘', 기간보기('20270102 ~ 20270228'), ['2027-01-02', '2027-02-28']);
  봐('빈 것', 기간보기(''), ['', '']);
  봐('0057001 은 상시 아님', 상시인가('0057001', '20270102 ~ 20270228'), false);
  봐('0057002 는 상시', 상시인가('0057002', ''), true);
  봐('0057003 도 상시', 상시인가('0057003', ''), true);
  봐('없는 날짜는 버림', 하루('20260230'), '');
  봐('멀쩡한 날', 하루('20271231'), '2027-12-31');

  console.log('\n한 줄 옮기기 — 담당자 이름이 안 넘어가는지');
  const r = 한줄({ plcyNo: '1', plcyNm: 'ㄱ', lclsfNm: '일자리',
    sprvsnInstCdNm: '국토교통부', rgtrHghrkInstCdNm: '국토교통부',
    sprvsnInstPicNm: '홍길동', operInstPicNm: '김철수',
    aplyPrdSeCd: '0057002', aplyYmd: '', sprtTrgtAgeLmtYn: 'Y' });
  봐('담당자 칸이 아예 없는지', Object.keys(r).some((k) => /Pic|담당/.test(k)), false);
  봐('값으로도 안 들어갔는지', JSON.stringify(r).includes('홍길동') || JSON.stringify(r).includes('김철수'), false);
  봐('시도', r.시도, '전국');
  봐('상시', r.상시, true);
  봐('나이제한없음', r.나이제한없음, true);

  console.log('\n' + (거짓 ? '★ ' + 거짓 + '개 틀렸습니다' : '○ ' + 참 + '개 다 맞았습니다'));
  process.exit(거짓 ? 1 : 0);
}

/* ═══ 받아오기 ═══ */
const KEY = cfg.YOUTH_KEY;
if (!KEY) { console.error('YOUTH_KEY 가 없습니다 (.env.server 를 보십시오)'); process.exit(1); }
const 쪽크기 = 200;          // 창구가 200 까지 받습니다 (2026-10-04 확인)

const 받기 = async (쪽) => {
  const u = 'https://www.youthcenter.go.kr/go/ythip/getPlcy'
    + '?apiKeyNm=' + encodeURIComponent(KEY)
    + '&pageNum=' + 쪽 + '&pageSize=' + 쪽크기 + '&rtnType=json';
  const r = await fetch(u, { headers: { 'User-Agent': 'POTJOB/1.0 (+https://potjob.co.kr)' } });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' · 앞 300자 — ' + t.slice(0, 300).replace(/\s+/g, ' '));
  const j = JSON.parse(t);
  if (Number(j.resultCode) !== 200) throw new Error('resultCode ' + j.resultCode + ' · ' + j.resultMessage);
  return j.result;
};

const 모두 = new Map();
let 전체 = 0;
for (let 쪽 = 1; 쪽 <= 100; 쪽++) {
  const res = await 받기(쪽);
  전체 = res.pagging?.totCount ?? 전체;
  const 줄 = res.youthPolicyList || [];
  for (const x of 줄) { const v = 한줄(x); if (v.번호) 모두.set(v.번호, v); }
  console.log('  ' + String(쪽).padStart(2) + '쪽  받은 줄 ' + String(줄.length).padStart(3)
    + '  여기까지 ' + 모두.size + ' / ' + 전체);
  if (줄.length < 쪽크기 || 모두.size >= 전체) break;
  await new Promise((s) => setTimeout(s, 350));
}

const 줄들 = [...모두.values()];
console.log('\n모두 ' + 줄들.length + '건 (창구가 말한 전체 ' + 전체 + ')');
const 세기 = (f) => 줄들.reduce((a, x) => ((a[x[f]] = (a[x[f]] || 0) + 1), a), {});
console.log('  갈래 — ' + Object.entries(세기('갈래')).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + n).join(' · '));
const 시 = Object.entries(세기('시도')).sort((a, b) => b[1] - a[1]);
console.log('  시도 — ' + 시.slice(0, 10).map(([k, n]) => k + ' ' + n).join(' · ') + (시.length > 10 ? ' …' : ''));
console.log('  상시 ' + 줄들.filter((x) => x.상시).length + '건 · 기간이 정해진 것 ' + 줄들.filter((x) => !x.상시).length + '건');
const 오늘 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
console.log('  신청 끝난 것 ' + 줄들.filter((x) => x.신청끝 && x.신청끝 < 오늘).length + '건 (회원 화면에서 숨깁니다)');

if (dry) { console.log('\n--dry 라 담지 않았습니다.'); process.exit(0); }

/* ── 담기 ── */
const URL_ = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
const SK = cfg.SUPABASE_SERVICE_KEY;
if (!URL_ || !SK) { console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
const 부르기 = async (fn, body) => {
  const r = await fetch(URL_ + '/rest/v1/rpc/' + encodeURIComponent(fn), {
    method: 'POST',
    headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
};

let 열쇠 = cfg.COLLECT_KEY_YTH;
if (!열쇠) {
  const r = await fetch(URL_ + '/rest/v1/collect_secret?source=eq.YTH&select=secret',
    { headers: { apikey: SK, Authorization: 'Bearer ' + SK } });
  열쇠 = ((await r.json())[0] || {}).secret;
  if (!열쇠) { console.error('YTH 열쇠가 collect_secret 에 없습니다'); process.exit(1); }
  console.log('\n열쇠를 .env 에서 못 찾아 collect_secret 에서 읽었습니다 (값은 안 찍습니다).');
}

let 담음 = 0;
for (let i = 0; i < 줄들.length; i += 200) {
  const r = await 부르기('청년담기', { p_secret: 열쇠, p_정책: 줄들.slice(i, i + 200) });
  담음 += (r && r.정책) || 0;
}
const 센것 = await 부르기('청년셈', { p_시도: null, p_지난것: false });
console.log('\n담았습니다 — 보낸 것 ' + 담음 + '건 · 지금 보이는 것 ' + 센것.전체 + '건');
console.log('  갈래별 ' + JSON.stringify(센것.갈래));
console.log('  걸린 시간 ' + Math.round((Date.now() - 시작한때) / 1000) + '초');
