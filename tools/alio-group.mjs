/* 묶음 잇기 + 단계 이름 붙이기 (2026-09-29 · 세중님 결정).
 *
 *   node tools/alio-group.mjs --dry    짜 보기만 (안 담음)
 *   node tools/alio-group.mjs          담기
 *
 * ── 묶음 ──────────────────────────────────────────────────
 * **같은 기관 + 같은 직군 + 같은 지역** 이면 연도가 달라도 한 묶음입니다.
 * 회차순(마감일 순)으로 늘어놓고 그 묶음의 평균 경쟁률을 냅니다.
 *
 * 이름이 해마다 다릅니다 —
 *   「공무직(물리치료사)」 「기간제(물리치료사)」 「물리치료사(공무직)」
 * 같은 자리인지 다른 자리인지 이름만으로는 모릅니다.
 * **짐작해서 붙이지 않습니다.** 그런 묶음은 「짝 확인 필요」로 표시합니다.
 *
 * ── 단계 이름 ─────────────────────────────────────────────
 * 공고의 전형절차 설명에서 먼저 읽습니다.
 *   「서류전형(1차) → 면접전형 및 직업성격검사(2차)」 → 1차 서류 · 2차 면접
 * 못 읽으면 기본값 (세중님 결정) —
 *   1차 = 서류 · 2차 = 면접 · 3차 = 최종
 *   단계가 「1차·최종」 둘뿐이면 → 1차 서류 → 최종
 * 기본값을 쓴 것은 화면에 **「일반적인 전형 순서 기준」** 이라고 밝힙니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'AL2';

function env() {
  const out = {};
  for (const f of ['.env.local', '.env', 'web/.env.local'].map((x) => path.join(여기, '..', x))) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/); if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return out;
}
const cfg = env();
async function rpc(fn, body) {
  const k = cfg.SUPABASE_ANON_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 250));
  return t ? JSON.parse(t) : null;
}

/* ── 지역 사전 ──
 * 광역 17곳과, 공공기관 병원이 실제로 있는 시·군입니다.
 * **짐작해서 늘리지 마세요.** 이름 안에 이 말이 있을 때만 지역으로 봅니다. */
export const 광역 = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
export const 시군 = ['순천', '창원', '안산', '태백', '동해', '정선', '구미', '포항', '진주',
  '천안', '청주', '전주', '원주', '춘천', '강릉', '목포', '여수', '군산', '익산', '제천',
  '김해', '양산', '거제', '통영', '경주', '안동', '영천', '상주', '문경', '공주', '논산',
  '서산', '당진', '아산', '홍성', '수원', '성남', '고양', '용인', '부천', '화성', '평택',
  '시흥', '파주', '의정부', '남양주', '광명', '분당', '일산', '세종'];
const 지역말 = [...광역, ...시군];

const 붙 = (s) => String(s || '').replace(/\s+/g, '');

/** 묶음 이름·근무지에서 지역을 가립니다. 못 가리면 null (지어내지 않습니다) */
export function 지역가리기(이름, 근무지) {
  const t = 붙(이름);
  /* ① 이름 안에 지역말 — 긴 것부터 (「경기」보다 「경기광주」 같은 게 있으면 긴 쪽) */
  const 찾음 = [...지역말].sort((a, b) => b.length - a.length).find((w) => t.includes(w));
  if (찾음) return 찾음;
  /* ② 공고 근무지가 한 곳뿐이면 그것 */
  const 곳 = String(근무지 || '').split(/[,·/]/).map((x) => x.trim()).filter(Boolean);
  if (곳.length === 1) return 곳[0];
  /* ③ 여러 곳이면 어느 묶음이 어디인지 이름에 없으면 모릅니다 */
  return null;
}

/** 이름에서 직군말을 뺀 나머지 — 고용형태·부서입니다. 이게 해마다 다르면 짝이 애매합니다 */
export function 자리이름내기(이름) {
  return String(이름 || '')
    .replace(/물리치료사|작업치료사|물리치료|작업치료/g, '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[-–]\s*상근.*$/, ' ')
    .replace(/\d+\s*명/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── 전형절차 글에서 단계 이름 읽기 ──
 * 「서류전형(1차) → 면접전형 및 직업성격검사(2차)」
 * 「서류접수->면접진행->신체검사」
 * 앞에서부터 나오는 차례대로 씁니다. */
const 단계말 = [
  { 말: /서류/, 이름: '서류' },
  { 말: /필기|시험|논술/, 이름: '필기' },
  { 말: /인적성|직업성격|인성검사/, 이름: '인적성' },
  { 말: /실기|실무능력/, 이름: '실기' },
  { 말: /면접|구술/, 이름: '면접' },
  { 말: /신체검사|건강검진|채용검진/, 이름: '신체검사' },
];
/** 글에 나오는 차례대로 단계말을 줍니다 */
function 차례대로(글) {
  const 본것 = [];
  for (let i = 0; i < 글.length; i++) {
    for (const s of 단계말) {
      const m = 글.slice(i, i + 8).match(s.말);
      if (m && m.index === 0) {
        if (!본것.includes(s.이름)) 본것.push(s.이름);
        i += m[0].length - 1;
        break;
      }
    }
  }
  return 본것;
}

/** 글에 「서류전형(1차)」 「2차: 면접」 처럼 **몇 차인지 적혀 있으면** 그게 가장 정확합니다 */
function 차수로(글) {
  const 표 = new Map();
  /* 「…전형(1차)」 꼴 — 단계말 바로 뒤 8글자 안에 (N차) */
  for (const s of 단계말) {
    const re = new RegExp(s.말.source + '[^()]{0,8}\\((\\d)\\s*차\\)', 'g');
    let m; while ((m = re.exec(글))) if (!표.has(+m[1])) 표.set(+m[1], s.이름);
  }
  /* 「1차 서류전형」 「2차: 면접」 꼴 — (N차) 뒤 12글자 안에 단계말 */
  const re2 = /(\d)\s*차\s*[::\-–]?\s*([^\n]{0,14})/g;
  let m2; while ((m2 = re2.exec(글))) {
    const 뒤 = m2[2];
    for (const s of 단계말) if (s.말.test(뒤) && !표.has(+m2[1])) { 표.set(+m2[1], s.이름); break; }
  }
  if (!표.size) return [];
  const 끝 = Math.max(...표.keys());
  /* 빠진 차수가 있으면 믿지 않습니다 — 지어내지 않습니다 */
  for (let i = 1; i <= 끝; i++) if (!표.has(i)) return [];
  return Array.from({ length: 끝 }, (_, i) => 표.get(i + 1));
}

export function 절차읽기(글) {
  if (!글) return [];
  const 차 = 차수로(글);
  return 차.length ? 차 : 차례대로(글);
}

/** 단계 이름표 — 읽은 절차에 맞추고, 안 맞으면 기본값 */
export function 단계이름표(단계이름들, 절차) {
  const n = 단계이름들.length;
  const 읽음 = 절차읽기(절차);
  /* 읽은 차례가 단계 수와 맞을 때만 씁니다. 안 맞으면 억지로 늘리거나 줄이지 않습니다 */
  if (읽음.length === n) return { 이름: 읽음, 출처: '공고설명' };
  /* 마지막 단계는 「최종」 이라 절차 하나가 덜 나올 수 있습니다 — 그때는 앞쪽만 맞춰 씁니다 */
  if (읽음.length === n - 1) return { 이름: [...읽음, '최종'], 출처: '공고설명' };
  /* 기본값 (세중님 결정) — 1차 서류 · 2차 면접 · 3차 최종 */
  if (n <= 1) return { 이름: ['최종'], 출처: '기본값' };
  if (n === 2) return { 이름: ['서류', '최종'], 출처: '기본값' };
  if (n === 3) return { 이름: ['서류', '면접', '최종'], 출처: '기본값' };
  const 이름 = ['서류', '면접'];
  while (이름.length < n - 1) 이름.push(이름.length + 1 + '차');
  이름.push('최종');
  return { 이름, 출처: '기본값' };
}

/* ── 본체 ── */
const dry = process.argv.includes('--dry');
if (!cfg.COLLECT_KEY_AL2) { console.error('COLLECT_KEY_AL2 가 없습니다'); process.exit(1); }

const 재료 = await rpc('alio_group_src', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE });
console.log('묶음 ' + 재료.length + '개를 짭니다' + (dry ? ' (--dry)' : ''));

/* ① 묶음마다 직군·지역·자리이름 */
for (const g of 재료) {
  g.직군키 = (g.our_job && !g.mixed) ? g.our_job : '직군 구분 없음';
  g.지역 = 지역가리기(g.group_name, g.근무지);
  g.자리 = 자리이름내기(g.group_name);
  /* 우리 직군은 「기관 | 직군 | 지역」 으로 잇습니다 (세중님 결정).
     직군을 못 가린 묶음(여럿 합쳐진 것)은 자리이름까지 넣어 따로 둡니다 —
     안 그러면 한 기관의 온갖 자리가 한 덩어리가 되어 평균이 뜻을 잃습니다. */
  g.묶음키 = g.직군키 === '직군 구분 없음'
    ? [g.inst_nm, g.직군키, g.지역 || '지역 모름', g.자리 || g.group_name].join(' | ')
    : [g.inst_nm, g.직군키, g.지역 || '지역 모름'].join(' | ');
}

/* ② 한 묶음 안에서 자리이름이 갈리면 「짝 확인 필요」 —
      같은 자리인지 이름만으로는 모릅니다. 붙여 놓고 평균을 내면 없는 숫자가 생깁니다 */
const 묶음별 = new Map();
for (const g of 재료) {
  if (!묶음별.has(g.묶음키)) 묶음별.set(g.묶음키, []);
  묶음별.get(g.묶음키).push(g);
}
let 애매 = 0;
for (const [, gs] of 묶음별) {
  const 자리들 = new Set(gs.map((x) => 붙(x.자리)).filter(Boolean));
  /* 지역을 못 가린 묶음인데, 같은 기관·직군에 지역이 붙은 묶음이 따로 있으면 그것도 애매 */
  const 지역모름 = gs[0].지역 == null;
  const 형제지역있음 = 지역모름 && 재료.some((x) =>
    x.inst_nm === gs[0].inst_nm && x.직군키 === gs[0].직군키 && x.지역 != null);
  const 애매한가 = 자리들.size > 1 || 형제지역있음;
  for (const g of gs) g.짝확인필요 = 애매한가;
  if (애매한가) 애매++;
}

/* ③ 단계 이름 */
const 담을것 = [];
const 출처셈 = { 공고설명: 0, 기본값: 0 };
for (const g of 재료) {
  const 표 = 단계이름표(g.step_names || [], g.전형절차);
  출처셈[표.출처]++;
  (g.step_names || []).forEach((_, i) => {
    담을것.push({
      sn: g.sn, group_no: g.group_no, step_no: i,
      직군키: g.직군키, 지역: g.지역, 자리이름: g.자리, 묶음키: g.묶음키,
      짝확인필요: !!g.짝확인필요,
      step_kind: 표.이름[i] ?? null, step_kind_src: 표.출처,
    });
  });
}

console.log('  다른 묶음 ' + 묶음별.size + '개 · 짝 확인 필요 ' + 애매 + '개');
console.log('  단계 이름 — 공고 설명에서 읽음 ' + 출처셈.공고설명
  + ' · 기본값 ' + 출처셈.기본값);
console.log('  지역을 가린 묶음 ' + 재료.filter((g) => g.지역).length + ' / ' + 재료.length);

if (dry) {
  console.log('\n── 묶음 회차가 많은 것 12개 ──');
  [...묶음별.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12)
    .forEach(([k, gs]) => console.log('  ' + String(gs.length).padStart(3) + '회  ' + k
      + (gs[0].짝확인필요 ? '   ← 짝 확인 필요' : '')
      + '\n        자리: ' + [...new Set(gs.map((x) => x.자리))].slice(0, 4).join(' / ')));
  process.exit(0);
}

let 고침 = 0;
for (let i = 0; i < 담을것.length; i += 400) {
  const r = await rpc('alio_group_put', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE,
    p_rows: 담을것.slice(i, i + 400) });
  고침 += r['고침'] || 0;
}
console.log('\n── 줄 ' + 고침 + '개를 고쳤습니다');
