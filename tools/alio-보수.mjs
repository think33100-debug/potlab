/* ═══════════════════════════════════════════════════════════════
 *  알리오 경영공시 「직원 평균보수」에서 신입사원 초임 · 정규직 1인당 평균 보수를 읽습니다 (2026-11-12)
 *  세중님 「국립대는 알리오 공시 기준으로 신입사원 연봉기준으로 넣고 · 치료사 초임이랑 신입 초임이랑 비슷해(현직자 경험)」
 * ═══════════════════════════════════════════════════════════════
 *
 *  어디서 — alio.go.kr 공개 화면 (로그인 없음 · robots.txt 「Allow: /」 · 2026-11-12 확인)
 *    ① /item/itemReportTerm.do?apbaId=<알리오코드>&reportFormRootNo=2060   공시 항목 「직원 평균보수」 첫 화면
 *       → 그 안의 `.doc_con').load("/upload/disclosure/…/doc.html")` 가 최신 공시 본문입니다
 *    ② 그 doc.html — 표가 글로 들어 있습니다 (2026-11-12 C0200 원문으로 확인)
 *       「1. 직원 평균보수 / 정규직(일반정규직) / 구분 2021년 결산 … 2025년 결산 2026년 예산 / … / 1인당 평균 보수액 76,295 …」
 *       「2. 신입사원 초임 (단위: 천원, 명) / 구분 2021년 결산 … / … / 합계 42,625 … 47,926」
 *    초임 기준(공시 원문) — 「대졸, 사무직, 군미필자, 무경력자 대졸 최하위 직급」
 *
 *  고르는 값 — **가장 최근 「결산」 해** (예산은 안 씁니다). 단위 천원 → 원으로 바꿔 담습니다.
 *
 *  쓰는 법
 *    node tools/alio-보수.mjs --코드 C0083,C0444      그 코드만 (열쇠 필요 없음)
 *    node tools/alio-보수.mjs --원문 --코드 C0083     본문 앞 1,200자와 잘라 낸 줄을 찍습니다 (지침 2절)
 *    결과 → 표 + tmp/alio-보수_<날짜>.json  (DB 에는 담지 않습니다)
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const 값 = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const 원문보기 = argv.includes('--원문');
const 코드들 = (값('--코드') || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!코드들.length) { console.error('--코드 C0083,C0444 처럼 알리오 코드를 주세요'); process.exit(2); }

const 이름표 = { 'User-Agent': 'RAPO-collector (rapojob.co.kr)' };
const 받기 = async (u) => { const r = await fetch(u, { headers: 이름표 }); return { status: r.status, text: await r.text() }; };
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));
const 글로 = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const 수 = (s) => (s == null || s === '-' ? null : Number(String(s).replace(/,/g, '')));

/* 머리줄(「2021년 결산 … 2026년 예산」)에서 가장 최근 결산 칸 차례를 찾습니다 */
function 최근결산(머리) {
  const 칸 = [...머리.matchAll(/(\d{4})년\s*(결산|예산)/g)].map((m) => ({ 해: Number(m[1]), 갈래: m[2] }));
  let i = -1; 칸.forEach((c, k) => { if (c.갈래 === '결산') i = k; });
  return { 칸수: 칸.length, i, 해: i >= 0 ? 칸[i].해 : null };
}
/* 「표이름 … 구분 <머리> … <줄이름> n n n …」 에서 줄 값을 꺼냅니다 */
function 표값(글, 시작말, 줄이름) {
  const a = 글.indexOf(시작말);
  if (a < 0) return null;
  const 조각 = 글.slice(a, a + 4000);
  const 머리 = 조각.match(/구분((?:\s*\d{4}년\s*(?:결산|예산))+)/);
  if (!머리) return null;
  const { 칸수, i, 해 } = 최근결산(머리[1]);
  if (i < 0) return null;
  const 줄 = 조각.match(new RegExp(줄이름.replace(/[()]/g, '\\$&') + '((?:\\s+(?:[\\d,]+(?:\\.\\d+)?|-)){' + 칸수 + '})'));
  if (!줄) return null;
  const 값들 = 줄[1].trim().split(/\s+/);
  return { 해, 값: 수(값들[i]), 줄: 줄[0] };
}

const 결과 = [];
for (const 코드 of 코드들) {
  const 첫 = await 받기(`https://alio.go.kr/item/itemReportTerm.do?apbaId=${코드}&reportFormRootNo=2060`);
  const 본문길 = 첫.text.match(/\.doc_con'\)\.load\("([^"]+\/doc\.html)"/)?.[1];
  if (!본문길) { 결과.push({ 코드, 오류: `본문 주소 못 찾음 (HTTP ${첫.status})` }); console.log(`✗ ${코드} 본문 주소 못 찾음`); continue; }
  await 쉼(500);
  const 본 = await 받기('https://alio.go.kr' + 본문길);
  const 글 = 글로(본.text);
  const 기관 = 글.match(/직원 평균보수 \(\d{4}년 \d\/4분기\) (\S+(?: \S+)?) 1\. 직원 평균보수/)?.[1] ?? null;
  const 공시때 = 글.match(/직원 평균보수 \((\d{4}년 \d\/4분기)\)/)?.[1] ?? null;
  const 평균 = 표값(글, '정규직(일반정규직) (단위', '1인당 평균 보수액');
  const 초임 = 표값(글, '신입사원 초임 (단위', '합계');
  if (원문보기) {
    console.log(`\n── ${코드} 본문 (HTTP ${본.status} · 앞 1,200자) ──\n${글.slice(0, 1200)}`);
    console.log(`── 평균 줄: ${평균?.줄 ?? '(없음)'}\n── 초임 줄: ${초임?.줄 ?? '(없음)'}`);
  }
  const r = { 코드, 기관, 공시때, 본문: 'https://alio.go.kr' + 본문길,
    초임해: 초임?.해 ?? null, 초임: 초임?.값 != null ? 초임.값 * 1000 : null,
    평균해: 평균?.해 ?? null, 평균보수: 평균?.값 != null ? 평균.값 * 1000 : null };
  결과.push(r);
  const 만 = (v) => (v == null ? '없음' : `${Math.round(v / 1e4).toLocaleString('ko-KR')}만`);
  console.log(`${r.초임 || r.평균보수 ? '○' : '△'} ${코드} ${기관 ?? '?'} — 신입 초임 ${만(r.초임)}(${r.초임해 ?? '-'}) · 정규직 평균 ${만(r.평균보수)}(${r.평균해 ?? '-'}) · ${공시때 ?? ''}`);
  await 쉼(800);
}

const 남길곳 = path.join(ROOT, 'tmp', `alio-보수_${new Date().toISOString().slice(0, 10)}.json`);
fs.mkdirSync(path.dirname(남길곳), { recursive: true });
fs.writeFileSync(남길곳, JSON.stringify({ 만든때: new Date().toISOString(), 결과 }, null, 1));
console.log(`\n${결과.length}곳 → ${path.relative(ROOT, 남길곳)}`);
