/* 중복 공고 짝 고르기 — **셈만** 합니다 (2026-11-08). DB·메일·파일에 닿지 않습니다.
 *
 *   import { 짝찾기, 제목열쇠, 제목닮음, 기간겹침 } from './중복공고_짝.mjs';
 *
 * ── 무엇을 중복으로 보나 (세중님 11/8) ──────────────────────
 *   같은 기관 · 비슷한 제목 · 겹치는 기간 · **다른 출처**
 *   → 같은 출처 안의 중복은 수집기 열쇠(주소)가 막을 자리라 여기서 안 봅니다.
 *   → 관리자가 이미 「같은공고」로 묶은 짝은 뺍니다.
 *
 * ── 「같은 기관」 ────────────────────────────────────────────
 *   DB 의 생성 열 `이름열쇠`(= 견줄이름(org_name)) 를 그대로 씁니다 — 기준은 한 자리
 *   (지침 6절). 없으면 org_name 에서 빈칸·괄호·법인 글자를 떼어 견줍니다.
 *
 * ── 「비슷한 제목」 ──────────────────────────────────────────
 *   제목열쇠 — 소문자 · 괄호·기호·빈칸 떼기 · 「채용·모집·공고·안내·재공고」 같은
 *   꾸밈말 떼기. 그 뒤 ① 열쇠가 같거나 ② 한쪽이 다른 쪽을 품거나(짧은 쪽 4자 이상)
 *   ③ 두 글자 조각(2-gram) 겹침이 60% 이상이면 닮았다고 봅니다.
 *   ★ 자(기준)를 고치면 「전→후·까닭」을 적습니다 (RAPO CLAUDE.md 판단 4).
 *
 * ── 「겹치는 기간」 ──────────────────────────────────────────
 *   시작 = apply_from → posted_at → first_seen 차례로 있는 것. 끝 = apply_to (없으면 열림).
 *   두 구간이 하루라도 겹치면 참. 둘 다 날짜가 하나도 없으면 참으로 둡니다
 *   (둘 다 지금 보이는 공고이니).
 */

const 꾸밈말 = /채용공고|모집공고|채용안내|모집안내|재공고|공고|채용|모집|안내|알림|직원|신규|긴급/g;

/** 제목을 견줄 수 있는 열쇠로 — 빈 글이면 '' */
export function 제목열쇠(제목) {
  return String(제목 || '')
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)|（[^）]*）/g, ' ')      // 괄호 속은 뺍니다 — 「(경력무관)」 「[재공고]」
    .replace(/[^0-9a-z가-힣]+/g, '')                      // 기호·빈칸 떼기
    .replace(꾸밈말, '');
}

function 조각들(글) {
  const s = new Set();
  for (let i = 0; i + 1 < 글.length; i += 1) s.add(글.slice(i, i + 2));
  return s;
}

/** 두 제목이 닮았나 — 왜 닮았는지(글자)도 함께 돌려줍니다. 안 닮으면 null */
export function 제목닮음(a, b) {
  const ka = 제목열쇠(a), kb = 제목열쇠(b);
  if (!ka || !kb) return null;
  if (ka === kb) return '제목 같음';
  const [짧, 긺] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  if (짧.length >= 4 && 긺.includes(짧)) return '한쪽이 다른 쪽을 품음';
  const A = 조각들(ka), B = 조각들(kb);
  if (!A.size || !B.size) return null;
  let 겹침 = 0;
  for (const x of A) if (B.has(x)) 겹침 += 1;
  const 비율 = 겹침 / (A.size + B.size - 겹침);
  return 비율 >= 0.6 ? '글자 조각 ' + Math.round(비율 * 100) + '% 겹침' : null;
}

const 날 = (s) => (s ? String(s).slice(0, 10) : null);

/** 공고의 모집 구간 [시작, 끝] — 없는 쪽은 null(열림) */
export function 기간(줄) {
  return [날(줄.apply_from) || 날(줄.posted_at) || 날(줄.first_seen), 날(줄.apply_to)];
}

/** 두 공고의 기간이 겹치나 (날짜는 YYYY-MM-DD 글자라 글자 비교로 충분합니다) */
export function 기간겹침(a, b) {
  const [a1, a2] = 기간(a), [b1, b2] = 기간(b);
  if (!a1 && !a2 && !b1 && !b2) return true;
  const 시작안겹침 = (a1 && b2 && a1 > b2) || (b1 && a2 && b1 > a2);
  return !시작안겹침;
}

/** org_name 만 있을 때 쓰는 예비 열쇠 — DB 의 이름열쇠가 있으면 그것이 먼저입니다 */
export function 기관열쇠(줄) {
  if (줄['이름열쇠']) return 줄['이름열쇠'];
  return String(줄.org_name || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/의료법인|재단법인|사회복지법인|학교법인|주식회사|\(주\)|\(재\)|\(의\)/g, '')
    .replace(/[^0-9a-z가-힣]+/gi, '')
    .toLowerCase();
}

/** 같은 짝은 id 차례로 한 열쇠 — 쉬는 기록의 열쇠입니다 */
export const 짝열쇠 = (a, b) => [a.id, b.id].sort().join('|');

/**
 * 짝 찾기. 줄 — job_posts 줄들(id·source·org_name·이름열쇠·title·apply_from·apply_to·
 * posted_at·first_seen·url·같은공고). 돌려주는 것 — [{열쇠, 기관, 왜, 가, 나}] (기관·id 차례)
 */
export function 짝찾기(줄들) {
  const 묶음 = new Map();
  for (const 줄 of 줄들) {
    const k = 기관열쇠(줄);
    if (!k) continue;
    if (!묶음.has(k)) 묶음.set(k, []);
    묶음.get(k).push(줄);
  }
  const 짝들 = [];
  for (const 줄들 of 묶음.values()) {
    if (줄들.length < 2) continue;
    줄들.sort((x, y) => String(x.id).localeCompare(String(y.id)));
    for (let i = 0; i < 줄들.length; i += 1) {
      for (let j = i + 1; j < 줄들.length; j += 1) {
        const a = 줄들[i], b = 줄들[j];
        if (a.source === b.source) continue;                            // 다른 출처만
        if (a['같은공고'] === b.id || b['같은공고'] === a.id) continue;   // 이미 묶은 짝
        const 왜 = 제목닮음(a.title, b.title);
        if (!왜) continue;
        if (!기간겹침(a, b)) continue;
        짝들.push({ 열쇠: 짝열쇠(a, b), 기관: a.org_name || b.org_name, 왜, 가: a, 나: b });
      }
    }
  }
  짝들.sort((x, y) => (x.기관 + x.열쇠).localeCompare(y.기관 + y.열쇠));
  return 짝들;
}
