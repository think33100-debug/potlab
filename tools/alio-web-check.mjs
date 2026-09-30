/* 알리오 웹의 「전형단계별 채용정보」 를 읽습니다 (2026-09-29).
 *
 *   node tools/alio-web-check.mjs 296899 303793     한두 건을 눈으로 보기
 *
 * 부르는 쪽 — tools/alio-compete-web.mjs · tools/alio-web-cmp.mjs
 *
 * ── 왜 웹을 읽나 ──────────────────────────────────────────
 * API `/detail` 의 `steps` 가 **뒤쪽 단계를 비워 보냅니다.**
 *   sn 296899 근로복지공단  API 6단계 전부 null
 *                          웹 1차 20명/135명 · 최종 4명/19명 · 경쟁률 33.75
 * 같은 표인데 웹에만 값이 있습니다.
 *
 * robots.txt — job.alio.go.kr 은 비어 있고 www.alio.go.kr 은 Allow: / 입니다.
 */
import { 공공부르기 } from './공공데이터부르기.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128';

/** 웹 화면의 tab-2 → { 묶음: [{ 이름, 단계:[{구분,선발,응시,확정일}], 경쟁률 }] } · 던지지 않습니다 */
export async function 웹읽기(sn) {
  let h;
  try {
    const r = await fetch('https://job.alio.go.kr/recruitview.do?idx=' + sn, { headers: { 'User-Agent': UA } });
    if (!r.ok) return { 왜: 'HTTP ' + r.status };
    h = await r.text();
  } catch (e) { return { 왜: String((e && (e.cause?.code || e.message)) || e).slice(0, 80) }; }

  /* ── 공고 머리 정보 ──
     <th>근무지</th> <td>인천,대구</td>  ·  <th>고용형태</th> <td>정규직</td>
     <h4>전형절차/방법</h4> <p>○ 전형방법: 서류전형(1차) → 면접전형 및 …</p>
     전형절차는 API 의 scrnprcdrMthdExpln 과 같은 글입니다. 여기서 같이 읽으면
     API 를 따로 두드릴 까닭이 없습니다. */
  /* HTML 기호를 풀어 둡니다 — 안 풀면 묶음 이름에 `&#039;` 가 그대로 남습니다 */
  const 기호풀기 = (s) => String(s || '')
    .replace(/&nbsp;/g, ' ').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;|&#0?34;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, '&');        // & 는 맨 나중에 — 안 그러면 &amp;lt; 가 꼬입니다
  const 글자 = (s) => 기호풀기(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
  const 칸읽기 = (이름) => {
    const m = h.match(new RegExp('<th>\\s*' + 이름 + '\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>'));
    return m ? 글자(m[1]) : null;
  };
  const 절차 = (h.match(/<h4>\s*전형절차\s*\/\s*방법\s*<\/h4>\s*<p[^>]*>([\s\S]*?)<\/p>/) || [])[1];
  const 머리 = {
    근무지: 칸읽기('근무지'), 고용형태: 칸읽기('고용형태'),
    근무분야: 칸읽기('근무분야'), 전형절차: 절차 ? 글자(절차).slice(0, 1500) : null,
  };

  const i = h.indexOf('id="tab-2"');
  if (i < 0) return { 머리, 왜: '화면에 tab-2 가 없습니다' };
  const j = h.indexOf('id="tab-3"');
  const seg = h.slice(i, j > i ? j : undefined);

  const 묶음 = [];
  /* 묶음 제목은 <th class="interviewName">, 그 뒤 <tr> 들이 단계입니다 */
  for (const c of seg.split(/class="interviewName"/).slice(1)) {
    const 이름 = (c.match(/^[^<]*<span><\/span>([^<]*)/) || c.match(/>([^<]+)<\/th>/) || [])[1];
    const 끝 = c.indexOf('</table>');
    const 표 = 끝 >= 0 ? c.slice(0, 끝) : c;
    const 줄 = [];
    for (const tr of 표.split('<tr>').slice(1)) {
      const 칸 = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
        .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
      /* 「구분 · 선발인원 · 응시인원 · 결과 확정일」 네 칸짜리 줄만 */
      if (칸.length === 4 && /^(\d+차|최종)/.test(칸[0])) {
        const 수 = (v) => (/\d/.test(v) ? Number(v.replace(/[^\d]/g, '')) : null);
        줄.push({ 구분: 칸[0], 선발: 수(칸[1]), 응시: 수(칸[2]), 확정일: 칸[3] || null });
      }
    }
    const 률 = (c.match(/최종\s*경쟁률\s*([\d.]+)\s*대\s*1/) || [])[1];
    묶음.push({ 이름: 기호풀기(이름 || '').trim(), 단계: 줄, 경쟁률: 률 != null ? Number(률) : null });
  }
  return { 묶음, 머리 };
}

/** API 의 steps (견주기용) */
export async function api읽기(sn) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const 여기 = path.dirname(fileURLToPath(import.meta.url));
  const KEY = (fs.readFileSync(path.join(여기, '..', 'gas', 'wage.js'), 'utf8')
    .match(/const JOB3_API = \{[\s\S]*?KEY:\s*'([^']+)'/) || [])[1];
  try {
    const r = await 공공부르기('https://apis.data.go.kr/1051000/recruitment/detail?serviceKey=' + KEY
      + '&resultType=json&sn=' + sn);
    if (r.code !== 200) return { 왜: r.왜 || ('HTTP ' + r.code), steps: [] };
    const j = JSON.parse(r.글);
    const m = Array.isArray(j.result) ? j.result[0] : j.result;
    return { steps: m?.steps || [], 제목: m?.recrutPbancTtl, 기관: m?.instNm, 마감: m?.pbancEndYmd };
  } catch (e) { return { 왜: String(e && e.message).slice(0, 80), steps: [] }; }
}

/* 직접 돌리면 인자로 준 공고를 찍어 봅니다 */
if (process.argv[1] && process.argv[1].endsWith('alio-web-check.mjs')) {
  for (const sn of process.argv.slice(2).filter((x) => /^\d+$/.test(x))) {
    const a = await api읽기(sn);
    const w = await 웹읽기(sn);
    console.log('\n══ sn ' + sn + ' · ' + (a.기관 || '?') + ' · ' + String(a.제목 || '').slice(0, 40)
      + ' · 마감 ' + (a.마감 || '?'));
    console.log('   API  steps ' + a.steps.length + '개 · 인원이 있는 것 '
      + a.steps.filter((s) => s.aplyNope != null).length + '개');
    a.steps.forEach((s) => console.log('     ' + JSON.stringify(s)));
    console.log('   웹   묶음 ' + (w.묶음 || []).length + '개' + (w.왜 ? ' · ' + w.왜 : ''));
    (w.묶음 || []).forEach((g) => console.log('     ' + g.이름 + ' → '
      + g.단계.map((x) => x.구분 + ' 선발' + x.선발 + '/응시' + x.응시 + '(' + x.확정일 + ')').join(' · ')
      + '  경쟁률 ' + g.경쟁률));
    await new Promise((y) => setTimeout(y, 700));
  }
}
