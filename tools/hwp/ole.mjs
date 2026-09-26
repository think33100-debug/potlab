/* HWP 5.x (OLE 복합문서) 에서 글자 뽑기 — **맨손** (2026-09-26).
 *
 * 정식 파서가 아닙니다. 라이브러리 셋(hwp.js · @ohah/hwpjs · node-hwp)이
 * 다 실패해서 쓰는 임시 방편입니다. 자세한 것은 `hwp_읽기_조사.md`.
 *
 * 되는 이유 — HWP 5.x 는 글을 **UTF-16LE** 로 담습니다. 스트림이 눌려 있지
 * 않으면 파일을 통째로 utf16le 로 읽어 한글 토막만 주워도 나옵니다.
 * 눌려 있으면(zlib 머리 78 01/9c/da) 풀어서 훑습니다.
 *
 * 한계 — 표는 칸 순서대로 이어 붙어 모양을 잃습니다. 낱말은 다 남아서
 * 직군 판정에는 문제가 없습니다. 확인한 것은 지방의료원 공고문 4건입니다.
 */
import zlib from 'node:zlib';

export const 이름표 = 'HWP 5.x 맨손(UTF-16LE)';
/* OLE 복합문서 머리 */
export const 이꼴인가 = (buf) => buf.length > 8 && buf.readUInt32BE(0) === 0xd0cf11e0;

/* utf16le 로 읽은 글에서 한글 토막만 줍습니다 */
const 한글토막 = (t) => (t.match(/[가-힣][가-힣\s0-9A-Za-z()[\]{}<>.,:;·~%/+\-–—’'"″°]{1,}/g) || [])
  .join(' ').replace(/\s+/g, ' ').trim();

function 맨손(buf) { return 한글토막(buf.toString('utf16le')); }

/* 파일 안의 zlib 덩어리를 하나씩 풀어 훑습니다 */
function 풀어서(buf) {
  let 모음 = '';
  for (let i = 0; i < buf.length - 2; i++) {
    if (buf[i] !== 0x78 || ![0x01, 0x9c, 0xda].includes(buf[i + 1])) continue;
    try {
      const out = zlib.inflateSync(buf.subarray(i), { finishFlush: zlib.constants.Z_SYNC_FLUSH });
      if (out.length > 200) 모음 += out.toString('utf16le');
    } catch { /* zlib 머리처럼 보였을 뿐입니다 */ }
  }
  /* 머리 없이 눌린(raw deflate) 경우 — 앞쪽만 훑어봅니다 */
  if (모음.length < 200) {
    for (let i = 0; i < Math.min(buf.length - 2, 4096); i++) {
      try {
        const out = zlib.inflateRawSync(buf.subarray(i), { finishFlush: zlib.constants.Z_SYNC_FLUSH });
        if (out.length > 2000) { 모음 += out.toString('utf16le'); break; }
      } catch { /* 아닙니다 */ }
    }
  }
  return 한글토막(모음);
}

/** 알맹이 → { 글, 어떻게 }. 던지지 않습니다 */
export function 글자(buf) {
  const a = 맨손(buf), b = 풀어서(buf);
  return a.length >= b.length ? { 글: a, 어떻게: '맨손' } : { 글: b, 어떻게: '풀어서' };
}
