/* OCR 을 해 주는 곳 — Apps Script 웹앱 (2026-09-26).
 *
 * ── 갈아끼우는 자리입니다 ────────────────────────────────────
 * 인터페이스는 하나뿐입니다 —
 *     pdf글자(buf, 이름, 곁들이) → Promise<{ 글, 왜 }>
 *       글      읽어낸 글자 (못 읽으면 '')
 *       왜      못 읽은 까닭 (읽었으면 '')
 *       곁들이  { ctype, 공고 } — 0자가 나왔을 때 남길 자료. 없어도 됩니다
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
 *
 * ── 0자 덫 (2026-09-30 · 세중님 지시) ────────────────────────
 * 9월 30일에 서버에서 한 건이 0자로 나왔다가 **같은 열쇠·같은 PDF 로**
 * 다시 하니 14,586자가 됐습니다. 원인을 못 잡았습니다. 그래서 —
 *   · 0자가 나오면 받은 크기·앞 5글자·content-type·응답 원문 500자를 찍고
 *   · **한 번만** 다시 해 봅니다
 *   · 두 번째도 0자면 부르는 쪽이 보류함으로 보내게 합니다
 *   · DB `ocr_zero` 에 남겨 관리자 화면과 매일 요약 메일에 셉니다
 */

/* 연속으로 실패하면 더 안 두드립니다. 열쇠가 죽은 것과 한 건이 이상한 것은
   다른 일입니다 — 앞엣것은 로그를 90줄로 만들고 아무것도 안 알려줍니다 */
let 연속실패 = 0, 꺼짐 = '';
const 실패한도 = 5;

/** 이번 실행에서 0자가 몇 번 나왔나 — 수집기가 마지막 줄에 찍습니다 */
export let 영자셈 = 0;
export function 영자몇번() { return 영자셈; }

export const 이름표 = 'Apps Script (세중님 계정)';
export function 쓸수있나() {
  return !!(process.env.OCR_GAS_URL && process.env.OCR_KEY);
}
export function 멈췄나() { return 꺼짐; }

/** 한 번 쏘기. { j, 원문, code } 를 돌려줍니다. 던지지 않습니다 */
async function 한번(buf, 이름) {
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
  const 원문 = await r.text();
  let j = null;
  try { j = JSON.parse(원문); } catch { /* JSON 이 아니면 아래에서 원문으로 알립니다 */ }
  return { j, 원문, code: r.status };
}

/** 0자를 DB 에 남깁니다. 실패해도 수집을 멈추지 않습니다 */
async function 영자남기기(x) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const 열쇠 = process.env.COLLECT_KEY_HS3 || process.env.COLLECT_KEY_AL2
            || process.env.COLLECT_KEY_CE2 || process.env.COLLECT_KEY_JF;
  if (!url || !anon || !열쇠) return;
  const 경로 = process.env.COLLECT_KEY_HS3 ? 'HS3'
             : process.env.COLLECT_KEY_AL2 ? 'AL2'
             : process.env.COLLECT_KEY_CE2 ? 'CE2' : 'JF';
  try {
    await fetch(url + '/rest/v1/rpc/ocr_zero_put', {
      method: 'POST',
      headers: { apikey: anon, Authorization: 'Bearer ' + anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: 열쇠, p_source: 경로, p_x: x }),
    });
  } catch { /* 남기기 실패로 수집을 멈추지 않습니다 */ }
}

export async function pdf글자(buf, 이름 = '공고문.pdf', 곁들이 = {}) {
  if (!쓸수있나()) return { 글: '', 왜: 'OCR 열쇠가 없어 못 읽음' };
  if (꺼짐) return { 글: '', 왜: 'OCR 이 멈춰 있음' };

  /* 받은 것이 정말 PDF 인지는 **여기서도** 봅니다. 저쪽에서도 봅니다.
     주소가 틀리면 HTML 이 오는데, 그걸 보내면 저쪽 드라이브가 헛일을 합니다 */
  const 앞5 = buf.subarray(0, 5).toString('latin1');
  if (앞5 !== '%PDF-') {
    return { 글: '', 왜: 'PDF 가 아닌 것이 옴 (' + buf.length + '바이트 · 앞5 「' + 앞5 + '」)' };
  }

  try {
    let { j, 원문, code } = await 한번(buf, 이름);
    if (!j) {
      /* JSON 이 아니면 거의 구글 로그인/오류 쪽입니다. 원문 앞을 남깁니다 */
      throw new Error('JSON 이 아닙니다 (HTTP ' + code + ') · '
        + 원문.replace(/\s+/g, ' ').slice(0, 160));
    }
    if (!j.ok) throw new Error((j.error || '까닭 없음') + ' (HTTP ' + (j.status || code) + ')');

    연속실패 = 0;

    /* ── 0자 덫 ───────────────────────────────────────────── */
    if (!j.text || !j.text.trim()) {
      const 자국 = (원문) => '    파일 ' + 이름 + ' · ' + buf.length + '바이트 · 앞5 「' + 앞5 + '」'
        + ' · content-type ' + (곁들이.ctype || '(모름)')
        + '\n    응답 원문 500자 — ' + 원문.replace(/\s+/g, ' ').slice(0, 500);
      console.error('  ★ OCR 0자 (1번째) — 한 번만 다시 해 봅니다');
      console.error(자국(원문));

      const 다시 = await 한번(buf, 이름);
      const 됐나 = 다시.j && 다시.j.ok && 다시.j.text && 다시.j.text.trim();
      if (됐나) {
        console.error('  ○ 두 번째에 읽었습니다 — 글자 ' + 다시.j.text.length + '자.'
          + ' 첫 번째가 왜 0자였는지는 위 원문에 남겼습니다');
        영자셈++;
        await 영자남기기({ 공고: 곁들이.공고 || '', 파일이름: 이름, 바이트: buf.length,
          앞5, ctype: 곁들이.ctype || '', 원문: 원문.slice(0, 500), 두번째도0: false });
        return { 글: 다시.j.text, 왜: '' };
      }

      console.error('  ★ OCR 0자 (2번째도) — 보류함으로 보냅니다');
      console.error(자국(다시.원문 || ''));
      영자셈++;
      await 영자남기기({ 공고: 곁들이.공고 || '', 파일이름: 이름, 바이트: buf.length,
        앞5, ctype: 곁들이.ctype || '', 원문: (다시.원문 || '').slice(0, 500), 두번째도0: true });
      return { 글: '', 왜: 'OCR 0자 (두 번 다) — 사람이 봐야 합니다' };
    }

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
