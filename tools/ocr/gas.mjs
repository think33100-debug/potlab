/* OCR 을 해 주는 곳 — Apps Script 웹앱 (2026-09-26).
 *
 * ── 갈아끼우는 자리입니다 ────────────────────────────────────
 * 인터페이스는 하나뿐입니다 —
 *     pdf글자(buf, 이름) → Promise<{ 글, 왜 }>
 *       글  읽어낸 글자 (못 읽으면 '')
 *       왜  못 읽은 까닭 (읽었으면 '')
 *
 * 나중에 구글 Vision 이나 다른 것으로 바꾸려면 **이 파일과 같은 모양의
 * 파일을 하나 만들어 tools/ocr/index.mjs 에서 고르면 됩니다.**
 * 수집기(collect-alio.mjs)는 안 고쳐도 됩니다.
 *
 * ── 왜 Apps Script 인가 ──────────────────────────────────────
 * node 에서 드라이브를 직접 쓰려고 두 가지를 해 봤고 둘 다 막혔습니다 —
 *   · 서비스 계정 — 제 드라이브 용량이 0. 폴더를 공유받아도 올린 파일의
 *     주인이 서비스 계정이라 403 storageQuotaExceeded.
 *     공유 드라이브가 있으면 풀리는데 개인 gmail 에는 없습니다.
 *   · OAuth — 됩니다. 다만 열쇠 셋을 관리해야 하고, 동의 화면이 「테스트」면
 *     7일마다 죽습니다.
 * Apps Script 는 세중님 계정으로 그냥 돕니다. **열쇠 관리가 없습니다.**
 *
 * ── 열쇠 ─────────────────────────────────────────────────────
 *   OCR_GAS_URL   배포한 웹 앱 주소
 *   OCR_KEY       gas/ocr 의 스크립트 속성과 **같은 값**
 * 없으면 OCR 을 안 하고, 부르는 쪽이 그 공고를 보류함으로 보냅니다.
 */

/* 연속으로 실패하면 더 안 두드립니다. 열쇠가 죽은 것과 한 건이 이상한 것은
   다른 일입니다 — 앞엣것은 로그를 90줄로 만들고 아무것도 안 알려줍니다 */
let 연속실패 = 0, 꺼짐 = '';
const 실패한도 = 5;

export const 이름표 = 'Apps Script (세중님 계정)';
export function 쓸수있나() {
  return !!(process.env.OCR_GAS_URL && process.env.OCR_KEY);
}
export function 멈췄나() { return 꺼짐; }

export async function pdf글자(buf, 이름 = '공고문.pdf') {
  if (!쓸수있나()) return { 글: '', 왜: 'OCR 열쇠가 없어 못 읽음' };
  if (꺼짐) return { 글: '', 왜: 'OCR 이 멈춰 있음' };

  /* 받은 것이 정말 PDF 인지는 **여기서도** 봅니다. 저쪽에서도 봅니다.
     주소가 틀리면 HTML 이 오는데, 그걸 보내면 저쪽 드라이브가 헛일을 합니다 */
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return { 글: '', 왜: 'PDF 가 아닌 것이 옴 (' + buf.length + '바이트)' };
  }

  try {
    const r = await fetch(process.env.OCR_GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      /* Apps Script 웹앱은 302 로 googleusercontent 로 넘깁니다 — 따라가야 합니다 */
      redirect: 'follow',
      body: JSON.stringify({
        key: process.env.OCR_KEY,
        name: 이름,
        pdf: buf.toString('base64'),
      }),
    });
    const t = await r.text();
    let j;
    try { j = JSON.parse(t); }
    catch {
      /* JSON 이 아니면 거의 구글 로그인/오류 쪽입니다. 원문 앞을 남깁니다 */
      throw new Error('JSON 이 아닙니다 (HTTP ' + r.status + ') · '
        + t.replace(/\s+/g, ' ').slice(0, 160));
    }
    if (!j.ok) throw new Error((j.error || '까닭 없음') + ' (HTTP ' + (j.status || r.status) + ')');

    연속실패 = 0;
    if (!j.text || !j.text.trim()) return { 글: '', 왜: 'OCR 했지만 글자가 0자' };
    return { 글: j.text, 왜: '' };
  } catch (e) {
    연속실패++;
    const 왜 = String(e.message).slice(0, 170);
    console.error('  OCR 실패 (' + 연속실패 + '번째) · ' + 왜);
    if (연속실패 >= 실패한도) {
      꺼짐 = '★ OCR 확인 — 연속 ' + 연속실패 + '번 실패해서 멈췄습니다. '
        + '마지막 까닭: ' + 왜;
      console.error('\n' + 꺼짐 + '\n');
    }
    return { 글: '', 왜: 'OCR 실패 · ' + 왜 };
  }
}
