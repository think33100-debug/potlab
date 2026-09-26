/* OCR 을 어디에 맡길지 고르는 자리 (2026-09-26).
 *
 * 수집기는 **여기만** 부릅니다. 어디에 맡기는지는 몰라도 됩니다.
 * 나중에 구글 Vision 이나 다른 것으로 바꾸려면 —
 *   ① tools/ocr/ 아래 같은 모양의 파일을 하나 만들고
 *        export const 이름표
 *        export function 쓸수있나()
 *        export function 멈췄나()
 *        export async function pdf글자(buf, 이름) → { 글, 왜 }
 *   ② 아래 목록에 넣습니다
 * 수집기는 한 줄도 안 고칩니다.
 */
import * as gas from './gas.mjs';

/* 앞에 있는 것부터 봅니다. 쓸 수 있는 첫 번째를 씁니다 */
const 후보 = [gas];

const 골라진것 = 후보.find((p) => p.쓸수있나()) || null;

export const 이름표 = 골라진것 ? 골라진것.이름표 : '없음';
export function 쓸수있나() { return !!골라진것; }
export function 멈췄나() { return 골라진것 ? 골라진것.멈췄나() : ''; }

/** PDF 알맹이 → { 글, 왜 }. **던지지 않습니다** — 못 읽으면 부르는 쪽이 보류함으로 */
export async function pdf글자(buf, 이름) {
  if (!골라진것) return { 글: '', 왜: 'OCR 을 맡길 곳이 없음 (OCR_GAS_URL · OCR_KEY 를 넣어주세요)' };
  return 골라진것.pdf글자(buf, 이름);
}
