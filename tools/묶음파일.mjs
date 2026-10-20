/* 묶음 파일(ZIP) 들여다보기 — **맨손**입니다 (바깥 꾸러미를 안 씁니다)
 *
 *   node tools/묶음파일.mjs            자기점검 (파일·그물을 안 두드립니다)
 *   node tools/묶음파일.mjs <파일>      그 묶음 안을 찍어 봅니다
 *
 * ── 왜 맨손인가 (2026-10-20) ──────────────────────────────────
 * `jszip` 은 `tools/kordoc/node_modules/` 안에만 있습니다. `tools/*.mjs` 에서
 * 이름으로 `import('jszip')` 하면 **언제나 실패합니다** — 모듈을 찾는 자리가
 * `tools/node_modules` · `potlab/node_modules` 이고 둘 다 없습니다.
 * 실제로 `공고문읽기.mjs` 의 `await import('kordoc')` 가 그 꼴이었고,
 * `catch {}` 가 삼켜서 **ZIP 가리기 분기가 한 번도 안 돌았습니다.**
 * 그래서 붙박이(zlib)만 씁니다 — 찾는 자리 문제가 없습니다.
 *
 * ── ZIP 바닥 구조에서 쓰는 것만 ───────────────────────────────
 *   끝 기록(EOCD)  PK\x05\x06  — 가운데 목록이 어디서 몇 개인지
 *   가운데 목록      PK\x01\x02  — 이름 · 압축방식 · 크기 · 자리
 *   앞 머리         PK\x03\x04  — 실제 자료가 그 뒤에 붙어 있습니다
 * 압축방식 0(그냥) 과 8(deflate) 만 풉니다 — 공고 첨부는 다 이 둘입니다.
 *
 * ★ **이름의 역사선(\\)을 바로 눕힙니다.** 한컴·옛 워드가 `word\document.xml`
 *   꼴로 적습니다 — kordoc 의 parseDocx 는 `word/document.xml` 을 찾아서
 *   「유효하지 않은 DOCX 파일」로 돌려보냅니다 (뉴고려병원 첨부가 그 꼴입니다).
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

export const 최대묶음파일수 = 200;        /* 묶음 폭탄 막기 */
export const 최대푼크기 = 80 * 1024 * 1024;

const 글자 = (b) => {
  /* 이름은 UTF-8 깃발(비트 11)이 있으면 UTF-8, 없으면 CP949 인 일이 많습니다.
     우리는 **갈래를 가리는 데만** 쓰므로 UTF-8 로 읽고, 깨져도 길은 남습니다 */
  try { return new TextDecoder('utf-8', { fatal: false }).decode(b); } catch { return b.toString('latin1'); }
};

/** 묶음 안의 목록 — [{ 이름, 압축방식, 압축크기, 푼크기, 머리자리 }] */
export function 목록(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  /* 끝 기록을 뒤에서 찾습니다 (덧말이 최대 64KB 붙을 수 있습니다) */
  let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { e = i; break; }
  }
  if (e < 0) return null;                       /* ZIP 이 아닙니다 */
  const 개수 = b.readUInt16LE(e + 10);
  let p = b.readUInt32LE(e + 16);
  const 나온것 = [];
  for (let n = 0; n < 개수 && n < 최대묶음파일수; n++) {
    if (p + 46 > b.length) break;
    if (b.readUInt32LE(p) !== 0x02014b50) break;
    const 압축방식 = b.readUInt16LE(p + 10);
    const 압축크기 = b.readUInt32LE(p + 20);
    const 푼크기 = b.readUInt32LE(p + 24);
    const 이름길이 = b.readUInt16LE(p + 28);
    const 덧길이 = b.readUInt16LE(p + 30);
    const 꼬리길이 = b.readUInt16LE(p + 32);
    const 머리자리 = b.readUInt32LE(p + 42);
    const 이름0 = 글자(b.subarray(p + 46, p + 46 + 이름길이));
    const 이름 = 이름0.replace(/\\/g, '/');     /* ★ 역사선을 눕힙니다 */
    나온것.push({ 이름, 원래이름: 이름0, 압축방식, 압축크기, 푼크기, 머리자리,
      폴더인가: /\/$/.test(이름) });
    p += 46 + 이름길이 + 덧길이 + 꼬리길이;
  }
  return 나온것;
}

/** 묶음 안의 한 파일을 풉니다 — 못 풀면 null */
export function 꺼내기(buf, 이름) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const 들 = 목록(b);
  if (!들) return null;
  const x = 들.find((y) => y.이름 === 이름 || y.원래이름 === 이름);
  if (!x || x.폴더인가) return null;
  const h = x.머리자리;
  if (h + 30 > b.length || b.readUInt32LE(h) !== 0x04034b50) return null;
  const 이름길이 = b.readUInt16LE(h + 26);
  const 덧길이 = b.readUInt16LE(h + 28);
  const 시작 = h + 30 + 이름길이 + 덧길이;
  const 조각 = b.subarray(시작, 시작 + (x.압축크기 || (b.length - 시작)));
  try {
    if (x.압축방식 === 0) return Buffer.from(조각);
    if (x.압축방식 === 8) return zlib.inflateRawSync(조각);
  } catch { return null; }
  return null;                                  /* 그밖 압축방식은 안 풉니다 */
}

/** 묶음의 **갈래** — 안의 목록으로 가립니다 */
export function 묶음갈래(buf) {
  const 들 = 목록(buf);
  if (!들) return null;
  const 이름들 = 들.map((x) => x.이름.toLowerCase());
  const 있나 = (잣대) => 이름들.some((n) => 잣대.test(n));
  if (있나(/^contents\/(section\d+\.xml|content\.hpf)/)) return 'hwpx';
  if (있나(/^word\/document\.xml$/)) return 'docx';
  if (있나(/^xl\//)) return 'xlsx';
  if (있나(/^ppt\//)) return 'pptx';
  return 'zip';
}

/** 묶음 안에서 **공고문으로 보이는 것**을 먼저 — 이름 → 크기 */
export const 공고문말 = /(공고|채용|모집|구인)/;
export const 서식말 = /(지원서|응시원서|서식|양식|제출서류|동의서|이력서|자기소개)/;

export function 공고문먼저(들) {
  const 볼것 = 들.filter((x) => !x.폴더인가 && /[.](pdf|hwpx?|docx?|xlsx?|jpe?g|png)$/i.test(x.이름));
  const 점수 = (x) => (서식말.test(x.이름) ? 0 : 공고문말.test(x.이름) ? 2 : 1);
  return [...볼것].sort((a, b) => (점수(b) - 점수(a)) || (b.푼크기 - a.푼크기));
}

/* ── 묶음 만들기 (자기점검과 **DOCX 바로잡기**에 씁니다) ──────────── */
export function 묶기(파일들) {
  const 머리들 = []; const 가운데 = []; let 자리 = 0;
  for (const { 이름, 내용 } of 파일들) {
    const nm = Buffer.from(이름, 'utf8');
    const 몸 = zlib.deflateRawSync(내용);
    const crc = zlib.crc32 ? zlib.crc32(내용) : crc32(내용);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6);
    h.writeUInt16LE(8, 8); h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(몸.length, 18); h.writeUInt32LE(내용.length, 22);
    h.writeUInt16LE(nm.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10); c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(몸.length, 20); c.writeUInt32LE(내용.length, 24);
    c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(자리, 42);
    머리들.push(h, nm, 몸);
    가운데.push(c, nm);
    자리 += h.length + nm.length + 몸.length;
  }
  const 앞 = Buffer.concat(머리들);
  const 가 = Buffer.concat(가운데);
  const 끝 = Buffer.alloc(22);
  끝.writeUInt32LE(0x06054b50, 0);
  끝.writeUInt16LE(파일들.length, 8); 끝.writeUInt16LE(파일들.length, 10);
  끝.writeUInt32LE(가.length, 12); 끝.writeUInt32LE(앞.length, 16);
  return Buffer.concat([앞, 가, 끝]);
}

/* zlib.crc32 가 없는 판을 위한 받침 */
let 표 = null;
function crc32(buf) {
  if (!표) {
    표 = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      표[i] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = 표[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** 역사선 이름을 **바로 눕혀 다시 묶습니다** — kordoc 이 읽게 */
export function 역사선바로잡기(buf) {
  const 들 = 목록(buf);
  if (!들) return null;
  if (!들.some((x) => x.원래이름.includes('\\'))) return null;   /* 고칠 것이 없습니다 */
  const 새것 = [];
  let 합 = 0;
  for (const x of 들) {
    if (x.폴더인가) continue;
    const 몸 = 꺼내기(buf, x.이름);
    if (!몸) return null;
    합 += 몸.length;
    if (합 > 최대푼크기) return null;
    새것.push({ 이름: x.이름, 내용: 몸 });
  }
  return 새것.length ? 묶기(새것) : null;
}

/* ── 자기점검 ─────────────────────────────────────────── */
function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 글 = (s) => Buffer.from(s, 'utf8');

  const hwpx = 묶기([{ 이름: 'mimetype', 내용: 글('application/hwp+zip') },
    { 이름: 'Contents/section0.xml', 내용: 글('<sec/>') }]);
  const docx = 묶기([{ 이름: '[Content_Types].xml', 내용: 글('<t/>') },
    { 이름: 'word/document.xml', 내용: 글('<w:document/>') }]);
  const xlsx = 묶기([{ 이름: 'xl/workbook.xml', 내용: 글('<wb/>') }]);
  const 그냥 = 묶기([{ 이름: 'NCS 직무기술서(물리치료사).hwp', 내용: Buffer.alloc(40, 7) },
    { 이름: '지원서.hwp', 내용: Buffer.alloc(10, 7) }]);
  const 역 = 묶기([{ 이름: 'word\\document.xml', 내용: 글('<w:document/>') },
    { 이름: '[Content_Types].xml', 내용: 글('<t/>') }]);

  보('HWPX 를 가린다', 묶음갈래(hwpx) === 'hwpx');
  보('DOCX 를 가린다', 묶음갈래(docx) === 'docx');
  보('XLSX 를 가린다', 묶음갈래(xlsx) === 'xlsx');
  보('그냥 ZIP 은 zip', 묶음갈래(그냥) === 'zip');
  보('ZIP 이 아니면 null', 묶음갈래(글('%PDF-1.7 ...')) === null);

  보('목록을 읽는다', (목록(그냥) || []).length === 2);
  보('꺼낸 내용이 같다', Buffer.compare(꺼내기(그냥, '지원서.hwp') || Buffer.alloc(0), Buffer.alloc(10, 7)) === 0);
  보('없는 이름은 null', 꺼내기(그냥, '없는것.hwp') === null);

  보('★ 역사선 이름을 눕혀 가린다', 묶음갈래(역) === 'docx');
  const 고친것 = 역사선바로잡기(역);
  보('역사선을 바로잡아 다시 묶는다', !!고친것 && 묶음갈래(고친것) === 'docx');
  보('바로잡은 뒤 이름에 역사선이 없다',
    !!고친것 && (목록(고친것) || []).every((x) => !x.원래이름.includes('\\')));
  보('고칠 것이 없으면 null', 역사선바로잡기(docx) === null);

  const 차례 = 공고문먼저(목록(그냥) || []);
  보('공고문을 먼저 고른다', 차례[0] && /직무기술서/.test(차례[0].이름));
  보('지원서는 뒤로', 차례[차례.length - 1] && /지원서/.test(차례[차례.length - 1].이름));
  const 섞 = 공고문먼저(목록(묶기([{ 이름: '응시원서.hwp', 내용: Buffer.alloc(900, 1) },
    { 이름: '2026년 채용 공고문.hwp', 내용: Buffer.alloc(20, 1) }])) || []);
  보('이름이 크기보다 셉니다', 섞[0] && /공고문/.test(섞[0].이름));

  const 탈 = 잼.filter((y) => !y[1]);
  for (const y of 잼) if (!y[1]) console.log('  ✗ ' + y[0]);
  console.log((탈.length ? '✗ 자기점검 ' + 탈.length + '가지 탈'
    : '○ 묶음파일 자기점검 통과 — ' + 잼.length + '가지') + ' (파일·그물을 안 두드렸습니다)');
  return !탈.length;
}

if (process.argv[1] && process.argv[1].endsWith('묶음파일.mjs')) {
  const 파일 = process.argv[2];
  if (!파일) { process.exit(자기점검() ? 0 : 1); }
  if (!자기점검()) process.exit(1);
  const b = fs.readFileSync(파일);
  console.log('\n' + 파일 + ' · ' + b.length + '바이트 · 갈래 ' + 묶음갈래(b));
  for (const x of 목록(b) || []) {
    console.log('  ' + (x.폴더인가 ? '[폴더] ' : '') + x.이름
      + '  ' + x.푼크기 + 'B (압축 ' + x.압축크기 + ' · 방식 ' + x.압축방식 + ')'
      + (x.원래이름 !== x.이름 ? '   ← 원래 이름에 역사선' : ''));
  }
}
