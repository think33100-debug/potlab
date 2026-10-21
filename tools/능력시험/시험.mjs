/* 능력시험 ③ **채점** (2026-10-19 밤)
 *
 *   node tools/능력시험/시험.mjs                    정답지에 있는 공고를 채점
 *   node tools/능력시험/시험.mjs --표 docs/…md      결과를 문서로도
 *   node tools/능력시험/시험.mjs --자기점검
 *
 * ── 무엇을 재나 (세중님 2번) ─────────────────────────────────────
 *   ① 목록에서 찾음        ← `목록시험.mjs` 가 따로 잽니다 (여기서는 받아 씁니다)
 *   ② 상세 본문            메뉴뿐이 아닌 **진짜 본문**인가
 *   ③ 첨부 찾음            **쪽에 걸린 수** 대비 우리가 적어 둔 수
 *   ④ 첨부 받음            앞 바이트로 가린 **진짜 형식**인가 (HTML 이면 못 받은 것)
 *   ⑤ 첨부 읽음            글자 수 · 표 보존
 *   ⑥ 직군 판정            정답 ↔ 우리 값
 *   ⑦ 일곱 칸              맞음 / 틀림 / **빈칸**(정답 있는데 비움) / **헛채움**(정답 없는데 채움)
 *
 * ★ 두 가지를 **갈라** 잽니다 —
 *     지금값   DB 에 들어 있는 값 (= 회원이 보는 값)
 *     다시뽑음 같은 원문에 **뽑기 규칙만** 다시 걸어 본 값 (`칸뽑기()`)
 *   둘이 다르면 「규칙은 되는데 담길 때 안 들어간 것」입니다.
 * ★ DB 에 아무것도 쓰지 않습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 공고아닌첨부, 칸뽑기, 고용형태판정, 본문직군, 우리직군줄, 마감고르기, 고용형태고르기 } from '../공고문읽기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};

/* ── 채점 규칙 (한 자리) ──────────────────────────────────────── */
export const 없음말 = ['원문에 없음', '없음', null, ''];
export const 애매인가 = (v) => typeof v === 'string' && /^애매/.test(v);
export const 없나 = (v) => v == null || 없음말.includes(v);

/** 한 칸 채점 — 정답 ↔ 우리 값 */
export function 칸채점(정답, 우리) {
  if (애매인가(정답)) return { 점: '애매', 왜: '정답이 애매라 안 셉니다' };
  const 정없 = 없나(정답); const 우없 = 없나(우리);
  if (정없 && 우없) return { 점: '둘다없음' };
  if (정없 && !우없) return { 점: '헛채움', 왜: '정답은 「원문에 없음」인데 우리는 「' + String(우리).slice(0, 40) + '」' };
  if (!정없 && 우없) return { 점: '빈칸', 왜: '정답은 「' + String(정답).slice(0, 40) + '」인데 우리는 비었습니다' };
  return 같나(정답, 우리)
    ? { 점: '맞음' }
    : { 점: '틀림', 왜: '정답 「' + String(정답).slice(0, 40) + '」 ↔ 우리 「' + String(우리).slice(0, 40) + '」' };
}

/** 값이 같은가 — 칸마다 결이 다릅니다 */
export function 같나(a, b) {
  const A = String(a).trim(); const B = String(b).trim();
  if (A === B) return true;
  /* 날짜 — 2026-10-24 · 2026.10.24 · 20261024 를 같게 봅니다 */
  const 날 = (s) => {
    const m = s.match(/(20\d\d)\D?(\d{1,2})\D?(\d{1,2})/);
    return m ? m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0') : null;
  };
  if (날(A) && 날(B)) return 날(A) === 날(B);
  /* 시각 — 18:00 · 18시 · 오후 6시 */
  const 시 = (s) => {
    const m = s.match(/(오전|오후)?\s*(\d{1,2})\s*(?::|시)\s*(\d{2})?/);
    if (!m) return null;
    let h = Number(m[2]); if (m[1] === '오후' && h < 12) h += 12;
    return String(h).padStart(2, '0') + ':' + (m[3] || '00');
  };
  if (시(A) && 시(B)) return 시(A) === 시(B);
  /* 숫자 — 2 · 2명 */
  const n = (s) => (/^\D*(\d{1,3})\D*$/.test(s) ? s.match(/(\d{1,3})/)[1] : null);
  if (n(A) && n(B)) return n(A) === n(B);
  /* 금액·글 — 공백·쉼표를 지우고 **한쪽이 다른 쪽을 품으면** 같게 봅니다
     (우리 값에 「(세전)」 같은 꼬리가 붙는 일이 흔합니다) */
  const 납 = (s) => s.replace(/[\s,·()]/g, '');
  const a2 = 납(A); const b2 = 납(B);
  if (a2 && b2 && (a2.includes(b2) || b2.includes(a2))) return true;
  return false;
}

/* ── 자기점검 ─────────────────────────────────────────────────── */
function 검사() {
  let n = 0; const 재다 = (조건, 글) => { n++; if (!조건) throw new Error('자기점검 ' + n + ' ' + 글); };
  재다(칸채점('2026-10-24', '2026.10.24').점 === '맞음', '날짜 꼴이 달라 틀림이 됩니다');
  재다(칸채점('18:00', '오후 6시').점 === '맞음', '시각 꼴이 달라 틀림이 됩니다');
  재다(칸채점(2, '2명').점 === '맞음', '2 와 2명을 다르게 봅니다');
  재다(칸채점('원문에 없음', null).점 === '둘다없음', '둘 다 없음을 못 봅니다');
  재다(칸채점('원문에 없음', '3400만원').점 === '헛채움', '헛채움을 못 봅니다');
  재다(칸채점('2명', null).점 === '빈칸', '빈칸을 못 봅니다');
  재다(칸채점('2명', '5명').점 === '틀림', '틀림을 못 봅니다');
  재다(칸채점('애매 — 통합 공고라 우리 직군 인원이 안 적혀 있음', '3명').점 === '애매', '애매를 안 걸러 냅니다');
  재다(칸채점('3,400만원', '3400만원 (세전)').점 === '맞음', '꼬리 붙은 금액을 틀림으로 봅니다');
  재다(칸채점('내규에 따름', '내규에 따름').점 === '맞음', '같은 글을 틀림으로 봅니다');
  재다(!같나('2026-10-24', '2026-11-03'), '다른 날짜를 같다고 합니다');
  재다(!같나('2명', '20명'), '2명과 20명을 같다고 합니다');
  console.log('○ 시험 채점 규칙 자기점검 통과 — ' + n + '가지');
}
검사();
if (argv.includes('--자기점검')) process.exit(0);

/* ── 자료 읽기 ───────────────────────────────────────────────── */
/* ★ 2026-10-21 — 둘째 표본(처음 보는 공고 30건)도 같은 자로 채점합니다 */
const 정답파일 = path.join(여기, 값('--정답', '정답지.jsonl'));
const 표본파일이름 = 값('--표본', '표본.json');
const 방이름 = 값('--방', '원문');
if (!fs.existsSync(정답파일)) { console.error('✗ ' + 정답파일 + ' 이 없습니다 — 먼저 원문을 읽고 정답을 적습니다'); process.exit(1); }
const 정답들 = fs.readFileSync(정답파일, 'utf8').split('\n').map((l) => l.trim())
  .filter((l) => l && !l.startsWith('//')).map((l) => JSON.parse(l));
const { 표본 } = JSON.parse(fs.readFileSync(path.join(여기, 표본파일이름), 'utf8'));
const 표본맵 = new Map(표본.map((x) => [x.id, x]));
/* ★ 2026-10-20 — **공고마다 있는 `원문/<id>/사실.json` 을 바로 읽습니다.**
   모아 둔 `원문사실.json` 은 **그 바퀴에 받은 것만** 담습니다 — 50건을
   나눠 받으면 마지막 묶음만 남아, 채점이 45건을 「원문에 없는 정답」으로
   건너뛰었습니다 (2026-10-20 에 그랬습니다) */
const 사실맵 = new Map();
for (const 이름 of fs.readdirSync(path.join(여기, 방이름))) {
  const p = path.join(여기, 방이름, 이름, '사실.json');
  if (!fs.existsSync(p)) continue;
  try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); if (j && j.id) 사실맵.set(j.id, j); } catch { /* 깨진 것은 건너뜁니다 */ }
}
console.log('원문을 받아 둔 공고 ' + 사실맵.size + '건');
const 목록결과 = fs.existsSync(path.join(여기, '목록시험.json'))
  ? JSON.parse(fs.readFileSync(path.join(여기, '목록시험.json'), 'utf8')) : null;

/* ★ 2026-10-21 — 머리말이 약속한 **「다시뽑음」을 이제 실제로 잽니다.**
 *   --다시뽑음   받아 둔 원문(쪽.txt + 첨부 글)에 **뽑기 규칙만** 다시 걸어 채점
 *   --새글       첨부 글을 *.새.txt (형식다시읽기 --글적기 가 적은 **고친 뒤** 글) 로
 *   깃발이 없으면 *.txt (**고치기 전** 글) 입니다 → 둘을 돌려 **읽기 고침의 전후**가 나옵니다.
 *   일곱 칸 본표는 그대로 지금값(회원이 보는 값)입니다 — 그것은 다시 수집해야 움직입니다. */
const 다시뽑나 = argv.includes('--다시뽑음');
/* ★ 2026-10-21 — `--못뽑은꼴` : 못 뽑은 칸을 **정답이 원문에 있던 꼴**로 묶습니다.
 *   꼴을 먼저 보고 고칠 차례를 정하자는 세중님 지시(1번)입니다. 정답지에 칸마다
 *   적어 둔 `근거`(원문 글귀)와 `어디`(어느 쪽·어느 첨부·어느 표)가 잣대입니다. */
const 꼴보기 = argv.includes('--못뽑은꼴');

/** 정답이 원문에 있던 **꼴** — 어디 + 근거 글귀의 모양으로 가립니다 */
export function 정답꼴(어디, 근거) {
  const d = String(어디 || ''); const g = String(근거 || '');
  const 바탕 = /첨부/.test(d) ? '첨부' : /쪽/.test(d) ? '쪽' : '모름';
  const 그림 = /[.](jpe?g|png|webp)/i.test(d) || /OCR/i.test(d);
  const 표 = /표/.test(d) || /[|]/.test(g);
  const 괄호 = /[(（][^)）]{1,20}[)）]/.test(g) && !표;
  const 목록 = /^[\s]*[-·❍○•▪◦□■◇☐*]/.test(g) || /^[0-9]+[.)]/.test(g.trim());
  const 꼴 = 그림 ? 'OCR 줄' : 표 ? '표 안' : 목록 ? '목록 줄' : 괄호 ? '괄호 안' : '문단';
  return 바탕 + ' · ' + 꼴;
}
const 다시틀린것 = [];
const 마감보류 = [];   /* 쪽·첨부가 둘 다 마감이라는데 다른 것 */
const 새글인가 = argv.includes('--새글');
const 칸이름 = ['모집인원', '접수마감', '마감시각', '근무지', '지원자격', '예상연봉', '고용형태'];
const 셈 = {
  목록: { '○': 0, '✗': 0, 안재봄: 0 },
  본문: { '○': 0, '△': 0, '✗': 0 },
  첨부찾기: { '○': 0, '△': 0, '✗': 0, 첨부없음: 0 },
  첨부받기: { '○': 0, '△': 0, '✗': 0, 해당없음: 0 },
  첨부읽기: { '○': 0, '△': 0, '✗': 0, 해당없음: 0 },
  직군: { 맞음: 0, 틀림: 0, 빈칸: 0, 애매: 0 },
};
const 칸셈 = {};
for (const k of 칸이름) 칸셈[k] = { 맞음: 0, 틀림: 0, 빈칸: 0, 헛채움: 0, 둘다없음: 0, 애매: 0 };
const 다시셈 = {};
for (const k of 칸이름) 다시셈[k] = { 맞음: 0, 틀림: 0, 빈칸: 0, 헛채움: 0, 둘다없음: 0, 애매: 0 };

/** 받아 둔 원문을 글로 — 첨부 글이 본령, 쪽글은 받침입니다 */
function 받아둔글(id) {
  const 방 = path.join(여기, 방이름, id);
  const 쪽p = path.join(방, '쪽.txt');
  const 글 = fs.existsSync(쪽p) ? fs.readFileSync(쪽p, 'utf8') : '';
  let md = '';
  const 첨 = path.join(방, '첨부');
  if (fs.existsSync(첨)) {
    for (const f of fs.readdirSync(첨).sort()) {
      if (!f.endsWith('.txt')) continue;
      if (f.endsWith('.새.txt') !== 새글인가) continue;
      if (공고아닌첨부(f)) continue;   /* 쪽 꼬리말 인증서 (2026-10-21) */
      md += (md ? '\n\n' : '') + fs.readFileSync(path.join(첨, f), 'utf8');
    }
  }
  return { md, 글 };
}

/** 뽑기 규칙이 낸 것을 **일곱 칸 꼴**로 — 지금값과 같은 자리에 놓고 견주려고 */
/* ★ 2026-10-21 — **수집기와 같은 길로 부릅니다.**
 *   수집기는  칸뽑기(첨부md, 첨부글)  ·  고용형태판정(제목, 글)  로 부릅니다
 *   (collect-cleaneye:472 · collect-nara:473,605 · collect-hosp:675).
 *   처음에 쪽글을 합친글 자리에 넣었더니, 첨부에만 우리 직군이 적힌 공고에서
 *   「공고문에 물리치료사·작업치료사가 안 적혀 있습니다」 가드가 걸려
 *   지원자격·근무지·예상연봉이 통째로 비었습니다 (CE80464). */
export function 다시일곱(뽑, 글, 직군, 제목 = '') {
  const 꼴 = 뽑.모집인원 && Object.keys(뽑.모집인원).length ? 뽑.모집인원 : null;
  const 인 = 꼴 ? (직군 && 꼴[직군] != null ? 꼴[직군] : Object.values(꼴)[0]) : null;
  return { 모집인원: 인 != null ? 인 : (뽑.모집인원글 || null),
    접수마감: 뽑.접수마감 || null, 마감시각: 뽑.접수시각 || null,
    근무지: 뽑.근무지 || null, 지원자격: 뽑.지원자격 || null, 예상연봉: 뽑.예상연봉 || null,
    /* ★ 고용형태판정() 은 꾸러미({값,왜})를 돌려줍니다 — 값만 집습니다
           (처음에 꾸러미째 견주어 고용형태가 다 틀림으로 찍혔습니다) */
        /* ★ 통합공고는 **우리 직군 줄만** 떼어 넘깁니다 — 고용형태_바로잡기.mjs:85 와 같은 꼴.
       글 전체를 넘기면 「간호사 무기계약직 / 물리치료사 기간제」 가 섞임으로 비워집니다 */
    /* ★ 2026-10-21 — 직군 줄 먼저, 비면 글 전체 (고용형태고르기 한 자리) */
    고용형태: (() => { const v = 고용형태고르기(제목 || '', 글 || '');
      return (v && v.값) || null; })() };
}

const 출처셈 = new Map();
const 틀린것 = [];

for (const 답 of 정답들) {
  const x = 표본맵.get(답.id); const f = 사실맵.get(답.id);
  if (!x || !f) { console.log('  (표본·원문에 없는 정답 — ' + 답.id + ')'); continue; }
  const s = x.source || '?';
  if (!출처셈.has(s)) 출처셈.set(s, { 공고: 0, 맞음: 0, 틀림: 0, 빈칸: 0, 헛채움: 0 });
  출처셈.get(s).공고++;

  /* ① 목록 */
  if (목록결과 && 목록결과[답.id] != null) 셈.목록[목록결과[답.id] ? '○' : '✗']++;
  else 셈.목록.안재봄++;

  /* ② 본문 — 메뉴뿐이 아닌가 */
  const 쪽글 = (() => {
    const p = path.join(여기, 방이름, 답.id, '쪽.txt');
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  })();
  const 본문표식 = ['접수', '모집', '자격', '채용', '제출', '기간'].filter((w) => 쪽글.includes(w)).length;
  셈.본문[쪽글.length >= 300 && 본문표식 >= 3 ? '○' : (쪽글.length >= 120 ? '△' : '✗')]++;

  /* ③ 첨부 찾기 — 쪽에 걸린 수 대비
     ★ `JS주소`(javascript:gfn_fileDown…)는 **쪽만 보고는 받을 수 없는 꼴**이라
       「쪽에 있는 첨부」로 세지 않습니다. 따로 적습니다 (워크넷·나라일터가 그 꼴이고
       거기는 **API** 로 받습니다 — getItemFile) */
  const 쪽첨 = (f.쪽첨부 || []).filter((a) => a.url).length;
  const js첨 = (f.쪽첨부 || []).filter((a) => !a.url).length;
  if (js첨) 셈.첨부찾기.JS주소 = (셈.첨부찾기.JS주소 || 0) + 1;
  const db첨 = f.DB첨부 || 0;
  if (!쪽첨 && !db첨) 셈.첨부찾기.첨부없음++;
  else if (db첨 >= 쪽첨 && db첨 > 0) 셈.첨부찾기['○']++;
  else if (db첨 > 0) 셈.첨부찾기['△']++;
  else 셈.첨부찾기['✗']++;

  /* ④⑤ 첨부 받기·읽기 */
  const 받은 = f.받은첨부 || [];
  if (!받은.length) { 셈.첨부받기.해당없음++; 셈.첨부읽기.해당없음++; } else {
    const 진짜 = 받은.filter((a) => ['pdf', 'hwp', 'zip계열'].includes(a.진짜형식)).length;
    셈.첨부받기[진짜 === 받은.length ? '○' : (진짜 ? '△' : '✗')]++;
    const 읽힘 = 받은.filter((a) => (a.글자수 || 0) > 200).length;
    셈.첨부읽기[읽힘 === 받은.length ? '○' : (읽힘 ? '△' : '✗')]++;
  }

  /* ⑥ 직군 */
  const 직답 = 답.우리직군 || null;
  if (애매인가(직답)) 셈.직군.애매++;
  else if (!x.지금값.직군) 셈.직군[직답 === '아님' ? '맞음' : '빈칸']++;
  else if (직답 === '아님') 셈.직군.틀림++;
  else 셈.직군[String(x.지금값.직군).includes(String(직답).replace('사', '')) ? '맞음' : '틀림']++;

  /* ⑧ 다시뽑음 — 같은 원문에 **뽑기 규칙만** 다시 (그물·DB 를 안 두드립니다) */
  if (다시뽑나) {
    const o = 받아둔글(답.id);
    /* 첨부 글이 있으면 그것이 본령 — 수집기도 첨부 md 와 첨부 글만 넘깁니다 */
    /* ★ 첨부와 쪽을 **둘 다** 봅니다 — 첨부가 본령이고, 첨부에 없는 칸만
       쪽에서 채웁니다. 수집기도 날짜는 쪽·목록에서, 내용은 첨부에서 얻습니다.
       첨부만 보게 했더니 접수마감이 63%→40% 로 떨어졌습니다 (쪽의 날짜를 잃음) */
    const 온글 = (o.md || '') + '\n' + (o.글 || '');
    const 직 = 본문직군(o.md || o.글) || null;
    const 첨뽑 = o.md ? 칸뽑기(o.md, '') : null;
    const 쪽뽑 = o.글 ? 칸뽑기('', o.글) : null;
    const 첨값 = 첨뽑 ? 다시일곱(첨뽑, 온글, 직, x.제목 || '') : null;
    const 쪽값 = 쪽뽑 ? 다시일곱(쪽뽑, 온글, 직, x.제목 || '') : null;
    const 다 = {};
    /* ★ **칸마다 바탕이 다릅니다** — 재는 쪽을 수집기에 맞춥니다.
     *   날짜(접수마감·마감시각)는 **쪽·목록**이 기준입니다 (수집기가 거기서 담고
     *   칸되메우기는 null 인 칸만 첨부로 채웁니다). 첨부를 먼저 두면 첨부에 적힌
     *   다른 일정이 쪽의 바른 날짜를 덮습니다 — 접수마감 틀림이 1→5 로 늘었습니다.
     *   내용 칸(모집인원·지원자격·근무지·예상연봉·고용형태)은 **첨부**가 기준입니다 —
     *   쪽을 먼저 두면 모집인원 65%→54% · 지원자격 23%→19% 로 떨어집니다. */
    const 쪽먼저 = new Set(['접수마감', '마감시각']);
    const 있나 = (v) => v != null && v !== '';
    for (const k of 칸이름) {
      const 앞 = 쪽먼저.has(k) ? 쪽값 : 첨값;
      const 뒤 = 쪽먼저.has(k) ? 첨값 : 쪽값;
      다[k] = (앞 && 있나(앞[k])) ? 앞[k] : (뒤 && 있나(뒤[k]) ? 뒤[k] : null);
    }
    /* ★ 2026-10-21 — **접수마감은 충돌 규칙으로 고릅니다** (세중님 결정 · 마감고르기()).
       쪽이 시작·게시이거나 이름표가 없고 첨부에 마감이 적혀 있으면 첨부를 믿습니다.
       둘 다 마감이라는데 날짜가 다르면 비우고 보류합니다 */
    {
      const 고 = 마감고르기({
        쪽값: 쪽값 ? 쪽값.접수마감 : null,
        쪽근거: 쪽뽑 && 쪽뽑.근거 ? String(쪽뽑.근거.접수마감 || '') : '',
        첨값: 첨값 ? 첨값.접수마감 : null,
        첨근거: 첨뽑 && 첨뽑.근거 ? String(첨뽑.근거.접수마감 || '') : '',
      });
      다.접수마감 = 고.값;
      if (고.보류) 마감보류.push({ id: 답.id, 왜: 고.왜 });
    }
    for (const k of 칸이름) {
      const 정 = 답.칸 && 답.칸[k] ? 답.칸[k].값 : undefined;
      if (정 === undefined) continue;
      const r = 칸채점(정, 다[k] == null ? null : 다[k]);
      다시셈[k][r.점] = (다시셈[k][r.점] || 0) + 1;
      if (['틀림', '빈칸', '헛채움'].includes(r.점)) {
        다시틀린것.push({ id: 답.id, source: s, 칸: k, 점: r.점,
          정답: 정, 우리: 다[k] == null ? null : 다[k],
          근거: 답.칸[k].근거 || '', 어디: 답.칸[k].어디 || '',
          꼴: 정답꼴(답.칸[k].어디, 답.칸[k].근거),
          회원값: x.지금값[k] == null ? null : x.지금값[k] });
      }
    }
  }

  /* ⑦ 일곱 칸 — 지금값(회원이 보는 값) 으로 채점 */
  for (const k of 칸이름) {
    const 정 = 답.칸 && 답.칸[k] ? 답.칸[k].값 : undefined;
    if (정 === undefined) continue;             /* 정답을 아직 안 적은 칸 */
    const 우 = x.지금값[k] ?? null;
    const r = 칸채점(정, 우);
    칸셈[k][r.점] = (칸셈[k][r.점] || 0) + 1;
    if (['맞음', '틀림', '빈칸', '헛채움'].includes(r.점)) 출처셈.get(s)[r.점] = (출처셈.get(s)[r.점] || 0) + 1;
    if (['틀림', '빈칸', '헛채움'].includes(r.점)) {
      틀린것.push({ id: 답.id, source: s, 칸: k, 점: r.점, 왜: r.왜,
        근거: (답.칸[k].근거 || '').slice(0, 60), 어디: 답.칸[k].어디 || '' });
    }
  }
}

/* ── 찍기 ────────────────────────────────────────────────────── */
console.log('\n채점한 공고 ' + 정답들.length + '건');
console.log('\n── 단계별 ──');
for (const [단, v] of Object.entries(셈)) {
  console.log('  ' + 단.padEnd(10) + Object.entries(v).map(([k, n]) => k + ' ' + n).join(' · '));
}
console.log('\n── 칸별 (정답 ↔ 회원이 보는 값) ──');
console.log('  칸        맞음  틀림  빈칸  헛채움  둘다없음  애매');
for (const k of 칸이름) {
  const c = 칸셈[k];
  const 분모 = c.맞음 + c.틀림 + c.빈칸 + c.헛채움 + c.둘다없음;
  console.log('  ' + k.padEnd(8) + String(c.맞음).padStart(4) + String(c.틀림).padStart(6)
    + String(c.빈칸).padStart(6) + String(c.헛채움).padStart(7) + String(c.둘다없음).padStart(9)
    + String(c.애매).padStart(6)
    + (분모 ? '   정답률 ' + (100 * (c.맞음 + c.둘다없음) / 분모).toFixed(0) + '%' : ''));
}
if (다시뽑나) {
  console.log('\n── 다시뽑음 (같은 원문 · 뽑기 규칙만 · 첨부 글 '
    + (새글인가 ? '*.새.txt = 고친 뒤' : '*.txt = 고치기 전') + ') ──');
  console.log('  칸        맞음  틀림  빈칸  헛채움  둘다없음  애매');
  for (const k of 칸이름) {
    const c2 = 다시셈[k];
    const 분모2 = c2.맞음 + c2.틀림 + c2.빈칸 + c2.헛채움 + c2.둘다없음;
    console.log('  ' + k.padEnd(8) + String(c2.맞음).padStart(4) + String(c2.틀림).padStart(6)
      + String(c2.빈칸).padStart(6) + String(c2.헛채움).padStart(7) + String(c2.둘다없음).padStart(9)
      + String(c2.애매).padStart(6)
      + (분모2 ? '   정답률 ' + (100 * (c2.맞음 + c2.둘다없음) / 분모2).toFixed(0) + '%' : ''));
  }
}

if (마감보류.length) {
  console.log('\n★ 접수마감 충돌로 **보류**할 것 ' + 마감보류.length + '건 (쪽·첨부가 둘 다 마감인데 다릅니다)');
  for (const x of 마감보류) console.log('  ' + x.id + ' — ' + x.왜);
}

if (꼴보기) {
  const 볼칸 = ['지원자격', '예상연봉', '고용형태', '마감시각'];
  console.log('\n\n══ 못 뽑은 칸의 **정답이 있던 꼴** (틀린 수가 많은 칸부터) ══');
  for (const k of 볼칸) {
    const 들 = 다시틀린것.filter((v) => v.칸 === k);
    const 묶 = new Map();
    for (const v of 들) {
      const t = 묶.get(v.꼴) || { n: 0, 틀림: 0, 빈칸: 0, 헛채움: 0, 보기: [] };
      t.n++; t[v.점]++; if (t.보기.length < 3) t.보기.push(v);
      묶.set(v.꼴, t);
    }
    console.log('\n── ' + k + ' — 못 뽑음 ' + 들.length + '건 ──');
    for (const [꼴, t] of [...묶].sort((a, b) => b[1].n - a[1].n)) {
      console.log('  ' + 꼴.padEnd(14) + String(t.n).padStart(3) + '건'
        + '  (틀림 ' + t.틀림 + ' · 빈칸 ' + t.빈칸 + ' · 헛채움 ' + t.헛채움 + ')');
      for (const v of t.보기) {
        console.log('      ' + v.id.padEnd(19) + v.source.padEnd(4) + v.점
          + '  정답 「' + String(v.정답).slice(0, 46) + '」');
        console.log('          우리 ' + JSON.stringify(v.우리) + ' · 회원값 ' + JSON.stringify(v.회원값));
        console.log('          근거 「' + String(v.근거).slice(0, 72) + '」 (' + v.어디 + ')');
      }
    }
  }
  fs.writeFileSync(path.join(여기, '못뽑은꼴.json'),
    JSON.stringify({ 잰때: new Date().toISOString(), 다시틀린것 }, null, 1) + '\n', 'utf8');
  console.log('\n  (' + path.join(여기, '못뽑은꼴.json') + ' 에 전부 적었습니다)');
}

console.log('\n── 출처별 ──');
for (const [s, c] of [...출처셈].sort((a, b) => b[1].공고 - a[1].공고)) {
  const 분모 = c.맞음 + c.틀림 + c.빈칸 + c.헛채움;
  console.log('  ' + s.padEnd(5) + '공고 ' + String(c.공고).padStart(3) + ' · 맞음 ' + String(c.맞음).padStart(3)
    + ' · 틀림 ' + String(c.틀림).padStart(3) + ' · 빈칸 ' + String(c.빈칸).padStart(3)
    + ' · 헛채움 ' + String(c.헛채움).padStart(3)
    + (분모 ? ' · ' + (100 * c.맞음 / 분모).toFixed(0) + '%' : ''));
}
console.log('\n── 틀린 것·놓친 것 ' + 틀린것.length + '개 ──');
for (const v of 틀린것.slice(0, 40)) {
  console.log('  ' + v.id.padEnd(20) + v.source.padEnd(5) + v.칸.padEnd(7) + v.점.padEnd(5) + (v.왜 || ''));
  if (v.근거) console.log('      정답 근거 「' + v.근거 + '」 ' + (v.어디 ? '(' + v.어디 + ')' : ''));
}

const 낼이름 = 값('--낼것', 다시뽑나 ? ('시험결과_다시' + (새글인가 ? '_후' : '_전') + '.json') : '시험결과.json');
const 낼곳 = path.isAbsolute(낼이름) ? 낼이름 : path.join(여기, 낼이름);
fs.writeFileSync(낼곳, JSON.stringify({ 잰때: new Date().toISOString(), 셈,
  /* ★ 다시뽑음일 때는 **다시셈**을 칸셈 자리에 적습니다 — 점수견주기가 그 자리를 봅니다 */
  칸셈: 다시뽑나 ? 다시셈 : 칸셈, 회원이보는값: 다시뽑나 ? 칸셈 : undefined,
  /* ★ 다시뽑음 쪽 틀린 목록도 넣습니다 — 하위 갈래(우리 직군만·원문 연 것만)를 다시 세려면 필요합니다 */
  다시틀린것: 다시뽑나 ? 다시틀린것 : undefined,
  출처별: Object.fromEntries(출처셈), 틀린것 }, null, 1) + '\n', 'utf8');
console.log('\n' + 낼곳 + ' 에 적었습니다. DB 에 아무것도 쓰지 않았습니다.');
