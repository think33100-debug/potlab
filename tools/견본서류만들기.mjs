/* 예시(시험) 자료용 **가짜 서류**를 만듭니다 (2026-10-09).
 *
 *   node tools/견본서류만들기.mjs <나갈폴더>
 *
 * ── 왜 PDF 이고 왜 영문인가 ──────────────────────────────────
 * PDF 는 글꼴을 안 심어도 Helvetica 를 쓸 수 있습니다. 한글을 넣으려면
 * 글꼴 파일을 통째로 심어야 해서 파일이 무거워지고, 견본에 그럴 값이
 * 없습니다. 그래서 **영문으로 「SAMPLE」** 이라고 크게 적습니다.
 * 보는 사람이 진짜 서류와 헷갈릴 일이 없어야 하는 것이 전부입니다.
 *
 * ── 진짜 자료는 한 글자도 안 들어갑니다 ──────────────────────
 * 실제 사람 이름·주민등록번호·사업자번호·기관 이름을 쓰지 않습니다.
 * 기관 이름 자리에는 늘 「TEST HOSPITAL」 같은 가짜만 넣습니다.
 */
import fs from 'node:fs';
import path from 'node:path';

const 나갈곳 = process.argv[2];
if (!나갈곳) { console.error('나갈 폴더를 주세요'); process.exit(2); }
fs.mkdirSync(나갈곳, { recursive: true });

/* 줄 하나를 PDF 글자 명령으로 */
const 줄 = (x, y, 크기, 글) =>
  `BT /F1 ${크기} Tf ${x} ${y} Td (${글.replace(/[()\\]/g, '\\$&')}) Tj ET`;

function pdf(줄들) {
  const 내용 = 줄들.join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 595] '
      + '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(내용)} >>\nstream\n${내용}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let 글 = '%PDF-1.4\n';
  const 자리 = [];
  objs.forEach((o, i) => {
    자리.push(Buffer.byteLength(글));
    글 += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(글);
  글 += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  자리.forEach((p) => { 글 += String(p).padStart(10, '0') + ' 00000 n \n'; });
  글 += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(글, 'latin1');
}

const 것들 = [
  ['견본-사업자등록증.pdf', 'BUSINESS REGISTRATION', 'TEST HOSPITAL (MASTER ONLY)'],
  ['견본-고유번호증.pdf',   'TAX ID CERTIFICATE',     'TEST ACADEMY (MASTER ONLY)'],
  ['견본-사원증.pdf',       'EMPLOYEE ID CARD',       'TEST HOSPITAL (MASTER ONLY)'],
  ['견본-재직증명서.pdf',   'EMPLOYMENT CERTIFICATE', 'TEST HOSPITAL (MASTER ONLY)'],
  ['견본-활동이력.pdf',     'TEACHING HISTORY',       'TEST ACADEMY (MASTER ONLY)'],
  ['견본-면허증.pdf',       'THERAPIST LICENSE',      'TEST LICENSE BOARD'],
];

for (const [이름, 제목, 기관] of 것들) {
  const 줄들 = [
    줄(40, 520, 44, 'SAMPLE'),
    줄(40, 480, 16, 'TEST DATA - NOT A REAL DOCUMENT'),
    줄(40, 430, 20, 제목),
    줄(40, 400, 13, 기관),
    줄(40, 360, 13, 'Name          TEST USER'),
    줄(40, 340, 13, 'Resident ID   900101-*******   (masked)'),
    줄(40, 320, 13, 'Issued        2026-10-09'),
    줄(40, 260, 12, 'Created by tools/견본서류만들기.mjs for screen testing.'),
    줄(40, 242, 12, 'Delete with 시험자료치우기() and the storage cleanup.'),
  ];
  fs.writeFileSync(path.join(나갈곳, 이름), pdf(줄들));
  console.log('만들었습니다 · ' + 이름);
}
