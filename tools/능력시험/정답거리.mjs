/* 능력시험 — **정답을 쓰기 위한 원문 거리**를 찍습니다 (2026-10-19 밤)
 *
 *   node tools/능력시험/정답거리.mjs <id> [<id> …]
 *   node tools/능력시험/정답거리.mjs --출처 HS3 --몇개 5
 *   node tools/능력시험/정답거리.mjs --남은것 8      정답을 아직 안 쓴 것부터
 *
 * ★ **뽑기 규칙(칸뽑기 등)을 부르지 않습니다.** 원문 글을 그대로 보여 주고,
 *   사람이(제가) 읽어 정답을 적습니다 — 수집기 답을 베끼면 시험이 아닙니다.
 * ★ 찍는 것 — 쪽 글 앞머리 · **표식말이 있는 줄과 그 앞뒤** · 첨부 글의 같은 자리.
 *   (표식말로 줄을 고르는 것은 **읽을 자리를 찾는 것**이고, 값을 정하는 것은
 *    제가 글을 읽고 합니다)
 * ★ 아무것도 바꾸지 않습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 표식 = /(물리\s*치료|작업\s*치료|도수\s*치료|모집\s*인원|채용\s*인원|인\s*원|접수\s*기간|접수\s*마감|원서\s*접수|제출\s*기간|마감|까지|자\s*격|응시\s*자격|지원\s*자격|면허|보\s*수|급\s*여|연\s*봉|임\s*금|처\s*우|월\s*급|근무\s*지|근무\s*장소|근무\s*부서|고용\s*형태|정규직|계약직|기간제|무기계약|채용\s*구분)/;

const { 표본 } = JSON.parse(fs.readFileSync(path.join(여기, '표본.json'), 'utf8'));
const 정답파일 = path.join(여기, '정답지.jsonl');
const 이미 = new Set(fs.existsSync(정답파일)
  ? fs.readFileSync(정답파일, 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('//'))
    .map((l) => JSON.parse(l).id) : []);

let 볼것 = argv.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a) || /^\d{5,}$/.test(a));
/* --출처 / --남은것 / --몇개 로도 고릅니다 */
const 출처 = 값('--출처', null);
const 남은것 = argv.includes('--남은것') ? Number(값('--남은것', 8)) : 0;
const 몇개 = Number(값('--몇개', 0));
if (!볼것.length || 출처 || 남은것) {
  let 뽑 = 표본;
  if (출처) 뽑 = 뽑.filter((x) => x.source === 출처);
  if (남은것) 뽑 = 뽑.filter((x) => !이미.has(x.id));
  볼것 = 뽑.slice(0, 몇개 || 남은것 || 5).map((x) => x.id);
}

for (const id of 볼것) {
  const x = 표본.find((y) => y.id === id);
  const 방 = path.join(여기, '원문', id);
  console.log('\n════════════════════════════════════════ ' + id + (x ? '  [' + x.source + ']' : ''));
  if (x) {
    console.log('기관 ' + x['기관'] + ' · 숨김 ' + x['숨김'] + ' · 보류 ' + x['보류']);
    console.log('제목 ' + x['제목']);
    console.log('주소 ' + x['주소']);
  }
  if (!fs.existsSync(방)) { console.log('(원문을 안 받았습니다 — 원문받기.mjs 를 돌리십시오)'); continue; }
  const 사실 = JSON.parse(fs.readFileSync(path.join(방, '사실.json'), 'utf8'));
  console.log('쪽 ' + JSON.stringify(사실.쪽).slice(0, 160));

  const 보이기 = (제목, 글) => {
    const 줄 = 글.split('\n').map((l) => l.trim()).filter(Boolean);
    console.log('\n── ' + 제목 + ' (' + 글.length + '자 · ' + 줄.length + '줄) ──');
    const 고른 = new Set();
    줄.forEach((l, i) => { if (표식.test(l)) { for (let k = -1; k <= 1; k++) if (줄[i + k]) 고른.add(i + k); } });
    const 차례 = [...고른].sort((a, b) => a - b);
    let 앞 = -2;
    for (const i of 차례.slice(0, 70)) {
      if (i > 앞 + 1) console.log('   …');
      console.log('   ' + 줄[i].slice(0, 200));
      앞 = i;
    }
    if (!차례.length) console.log('   (표식말이 든 줄이 없습니다) ' + 줄.slice(0, 6).join(' / ').slice(0, 300));
  };

  const 쪽txt = path.join(방, '쪽.txt');
  if (fs.existsSync(쪽txt)) 보이기('쪽 글', fs.readFileSync(쪽txt, 'utf8'));

  const 첨방 = path.join(방, '첨부');
  if (fs.existsSync(첨방)) {
    for (const f of fs.readdirSync(첨방).filter((n) => n.endsWith('.txt'))) {
      보이기('첨부 ' + f.replace(/\.txt$/, ''), fs.readFileSync(path.join(첨방, f), 'utf8'));
    }
    const 못읽은 = (사실.받은첨부 || []).filter((a) => !a.글자수);
    for (const a of 못읽은) {
      console.log('\n── 첨부(글자로 못 바꿈) ' + String(a.이름).slice(0, 40)
        + ' — ' + a.진짜형식 + ' · ' + (a.바이트 || 0) + '바이트 · ' + (a.읽기탈 || '') + ' ──');
    }
    for (const a of (사실.쪽첨부 || []).filter((y) => !y.url)) {
      console.log('   [JS주소] ' + a.함수 + ' — 쪽만 보고는 못 받습니다');
    }
  }
  console.log('\n지금 DB 값 — ' + JSON.stringify(x && x.지금값));
}
console.log('\n정답을 아직 안 쓴 공고 ' + 표본.filter((x) => !이미.has(x.id)).length + '건 남았습니다.');
