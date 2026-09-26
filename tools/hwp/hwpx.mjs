/* .hwpx 에서 글자 뽑기 (2026-09-26).
 *
 * .hwpx 는 zip 안에 XML 입니다 (OWPML). 글은 `Contents/section*.xml` 의
 * <hp:t> 에 그대로 들어 있어 .hwp 보다 쉽습니다.
 *
 * zip 은 손으로 풉니다 — 덩어리가 deflate 라 zlib.inflateRawSync 면 됩니다.
 * 라이브러리를 하나 더 붙일 만한 일이 아닙니다 (클린아이 의료 95건 중 1건).
 */
import zlib from 'node:zlib';

export const 이름표 = 'HWPX(zip+XML)';
export const 이꼴인가 = (buf) => buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b
  && buf[2] === 0x03 && buf[3] === 0x04;

/* zip 의 중앙 목록을 읽어 { 이름: 알맹이 } 로 돌려줍니다 */
function zip풀기(buf) {
  /* 끝쪽에서 EOCD(0x06054b50) 를 찾습니다. 주석이 붙어 있을 수 있어 뒤에서부터 */
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip 끝 표시(EOCD)를 못 찾았습니다');
  const 개수 = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const 것들 = {};
  for (let k = 0; k < 개수; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip 목록이 깨졌습니다 (' + k + '번째)');
    const 눌림 = buf.readUInt16LE(p + 10);
    const 눌린크기 = buf.readUInt32LE(p + 20);
    const 이름길이 = buf.readUInt16LE(p + 28);
    const 덤1 = buf.readUInt16LE(p + 30), 주석 = buf.readUInt16LE(p + 32);
    const 앞자리 = buf.readUInt32LE(p + 42);
    const 이름 = buf.subarray(p + 46, p + 46 + 이름길이).toString('utf8');
    /* 앞머리(local header)에서 실제 알맹이가 시작하는 자리를 다시 셉니다 */
    const 이름길이2 = buf.readUInt16LE(앞자리 + 26), 덤2 = buf.readUInt16LE(앞자리 + 28);
    const 시작 = 앞자리 + 30 + 이름길이2 + 덤2;
    const 몸 = buf.subarray(시작, 시작 + 눌린크기);
    try {
      것들[이름] = 눌림 === 0 ? 몸 : zlib.inflateRawSync(몸);
    } catch { /* 이 덩어리만 못 풉니다 */ }
    p += 46 + 이름길이 + 덤1 + 주석;
  }
  return 것들;
}

/** 알맹이 → { 글, 어떻게 }. 던지지 않습니다 */
export function 글자(buf) {
  let 것들;
  try { 것들 = zip풀기(buf); } catch (e) { return { 글: '', 어떻게: 'zip 못 풂 · ' + e.message }; }
  const 쪽 = Object.keys(것들).filter((n) => /^Contents\/section\d+\.xml$/i.test(n))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const 볼것 = 쪽.length ? 쪽 : Object.keys(것들).filter((n) => /\.xml$/i.test(n));
  if (!볼것.length) return { 글: '', 어떻게: 'zip 안에 XML 이 없습니다 (' + Object.keys(것들).slice(0, 6).join(' ') + ')' };
  let 글 = '';
  for (const n of 볼것) {
    const xml = 것들[n].toString('utf8');
    for (const m of xml.matchAll(/<hp:t(?:\s[^>]*)?>([\s\S]*?)<\/hp:t>/g)) 글 += m[1] + ' ';
    /* 이름칸(prefix)이 다를 수 있습니다 */
    if (!글.trim()) for (const m of xml.matchAll(/<[A-Za-z0-9]*:?t(?:\s[^>]*)?>([^<]*)<\/[A-Za-z0-9]*:?t>/g)) 글 += m[1] + ' ';
  }
  글 = 글.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  return { 글, 어떻게: 'XML ' + 볼것.length + '쪽' };
}
