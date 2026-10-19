/* 고용24(워크넷) **호출 수 기록과 막힘 감지** — 한 자리 (2026-10-19 세중님 2번)
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * 세중님이 신청 화면을 보셨는데 **하루 한도가 적혀 있지 않습니다.** 그래서
 * 한도를 짐작하지 않고(지침 3절) 이렇게 합니다 —
 *
 *   ① 호출을 늘리지 않습니다 (정찰 응답을 다시 쓰고, 새 공고만 상세)
 *   ② **하루 호출 수를 세어** 아침 메일에 한 줄 (목록 · 상세 **따로**)
 *   ③ **막힘을 감지**해 그 출처만 그날 멈추고 메일
 *   ④ ★ **막힘을 「없어짐」 으로 읽지 않습니다** — 오판해 공고를 내리면
 *      회원이 멀쩡한 공고를 못 봅니다. 가장 나쁜 쪽입니다
 *
 * ── 한도 초과의 글귀는 아직 못 봤습니다 ──────────────────────────
 * `messageCd 006`(정보 없음)은 봤습니다. **한도를 넘었을 때 무엇이 오는지는
 * 본 적이 없습니다.** 그래서 글귀로 맞히려 하지 않고 **「우리가 기다리는 꼴이
 * 아니면 막힘」** 으로 봅니다 —
 *
 *   · HTTP 가 200 이 아니다
 *   · 응답이 비었다
 *   · `<wantedDtl` 이 없다 (XML 봉투 자체가 다르다)
 *
 * 그리고 그 **응답 원문을 로그에 남깁니다**(지침 2절). 처음 막히는 날
 * 그 글귀를 알게 되고, 그때 이 파일 한 자리에 적습니다.
 */
import fs from 'node:fs';

/* ★ 로그터를 **부를 때마다** 읽습니다. 불러올 때 한 번 읽으면 자기점검이
   임시 폴더로 바꿀 수 없어, 자기 자신을 다시 import 하다 멈췄습니다 */
const 로그터 = () => process.env.POTJOB_LOG_DIR || '/home/ubuntu/log';
const 호출수파일 = () => 로그터() + '/고용24_호출수.json';
const 막힘파일 = (날) => 로그터() + '/고용24_막힘_' + 날 + '.json';
const 이상로그 = () => 로그터() + '/고용24_막힘.log';

export const 오늘날 = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

/* ── ① 호출 수 — 목록·상세를 따로 셉니다 ───────────────────────── */
const 센것 = { 목록: 0, 상세: 0 };
export function 세기(갈래) {
  if (갈래 !== '목록' && 갈래 !== '상세') throw new Error('갈래는 목록·상세만 — 받은 것 ' + 갈래);
  센것[갈래]++;
}
export const 지금센것 = () => ({ ...센것 });

/** 센 것을 파일에 더하고 비웁니다. 돌려주는 것 — 오늘 누적 { 목록, 상세, 합 } */
export function 남기기() {
  const 날 = 오늘날();
  let 표 = {};
  try {
    fs.mkdirSync(로그터(), { recursive: true });
    try { 표 = JSON.parse(fs.readFileSync(호출수파일(), 'utf8')); } catch { /* 처음 */ }
    const 옛 = 표[날] || { 목록: 0, 상세: 0 };
    표[날] = { 목록: 옛.목록 + 센것.목록, 상세: 옛.상세 + 센것.상세 };
    const 날들 = Object.keys(표).sort();
    while (날들.length > 60) delete 표[날들.shift()];   /* 60일치만 */
    fs.writeFileSync(호출수파일(), JSON.stringify(표, null, 1));
  } catch (e) {
    console.error('고용24 호출 수 기록 실패 · ' + String(e.message).slice(0, 120));
  }
  센것.목록 = 0; 센것.상세 = 0;                        /* 적은 만큼 비웁니다 */
  const n = 표[날] || { 목록: 0, 상세: 0 };
  return { ...n, 합: n.목록 + n.상세 };
}

/** 아침 메일이 읽습니다 — 날을 안 주면 오늘 */
export function 오늘셈(날 = 오늘날()) {
  try {
    const 표 = JSON.parse(fs.readFileSync(호출수파일(), 'utf8'));
    const n = 표[날] || { 목록: 0, 상세: 0 };
    return { ...n, 합: n.목록 + n.상세, 어제: 표[어제날(날)] || null };
  } catch { return { 목록: 0, 상세: 0, 합: 0, 어제: null }; }
}
const 어제날 = (날) => {
  const d = new Date(날 + 'T00:00:00+09:00');
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
};

/* ── ② 막힘 감지 ─────────────────────────────────────────────── */

/**
 * 응답이 **막힌 것**인가. 막혔으면 까닭 글, 멀쩡하면 null.
 *
 * ★ `messageCd 006`(정보 없음)은 **막힘이 아닙니다** — 그 공고가 정말 없어진
 *   것이고, 「없어짐」 판정이 쓰는 신호입니다. 여기서 막힘으로 보면 정찰이
 *   아무것도 못 내립니다.
 */
export function 막힘인가(code, 글) {
  const s = String(글 ?? '');
  if (Number(code) !== 200) return 'HTTP ' + code;
  if (!s.trim().length) return '빈 응답';
  if (!/<wantedDtl[\s>]/.test(s)) {
    /* 우리가 기다리는 봉투가 아닙니다. 무엇이 왔는지 앞부분을 함께 남깁니다 */
    return '응답 꼴이 다름 — 앞부분 「' + s.replace(/\s+/g, ' ').slice(0, 90) + '」';
  }
  return null;
}

/** 막힘을 로그와 깃발 파일에 남깁니다. `문턱`(기본 5)을 넘으면 깃발을 세웁니다 */
export function 막힘적기(출처, 까닭, 원문, 문턱 = 5) {
  const 날 = 오늘날();
  let 표 = { 출처: {}, 적은때: new Date().toISOString() };
  try {
    fs.mkdirSync(로그터(), { recursive: true });
    try { 표 = JSON.parse(fs.readFileSync(막힘파일(날), 'utf8')); } catch { /* 처음 */ }
    표.출처 ??= {};
    const 전 = 표.출처[출처] || { 수: 0, 까닭: '', 처음: new Date().toISOString() };
    표.출처[출처] = { 수: 전.수 + 1, 까닭: 까닭, 처음: 전.처음, 마지막: new Date().toISOString() };
    표.출처[출처].멈춤 = 표.출처[출처].수 >= 문턱;
    fs.writeFileSync(막힘파일(날), JSON.stringify(표, null, 1));
    /* 응답 원문을 남깁니다 — 한도 초과의 글귀를 **처음 막히는 날** 알게 됩니다 */
    fs.appendFileSync(이상로그(), '[' + new Date().toISOString() + '] ' + 출처 + ' · ' + 까닭
      + '\n' + String(원문 ?? '').replace(/authKey=[^&\s]+/g, 'authKey=‹열쇠›').slice(0, 1200) + '\n\n');
  } catch (e) { console.error('고용24 막힘 기록 실패 · ' + String(e.message).slice(0, 120)); }
  return 표.출처?.[출처] || { 수: 1, 멈춤: false };
}

/** 그 출처가 **오늘 멈춤**인가 (수집기가 시작할 때 봅니다) */
export function 막혔나(출처, 날 = 오늘날()) {
  try {
    const 표 = JSON.parse(fs.readFileSync(막힘파일(날), 'utf8'));
    const x = 표.출처?.[출처];
    return x && x.멈춤 ? x : null;
  } catch { return null; }
}

/** 아침 메일이 읽습니다 — 오늘 막힌 출처 전부 */
export function 오늘막힘(날 = 오늘날()) {
  try {
    const 표 = JSON.parse(fs.readFileSync(막힘파일(날), 'utf8'));
    return Object.entries(표.출처 || {}).map(([출처, x]) => ({ 출처, ...x }));
  } catch { return []; }
}

/* ── 스스로 하는 검사 — node tools/고용24한도.mjs --자기점검 ───── */
if (process.argv.includes('--자기점검')) {
  const os = await import('node:os');
  const path = await import('node:path');
  /* 실제 로그터를 안 건드립니다 — 임시 폴더로 바꿔 돌립니다 */
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), '고용24-'));
  process.env.POTJOB_LOG_DIR = 임시;
  /* 자기 자신을 다시 import 하면 멈춥니다 — 같은 파일의 함수를 그대로 씁니다 */
  const m = { 세기, 지금센것, 남기기, 오늘셈, 막힘인가, 막힘적기, 막혔나, 오늘막힘 };

  const 어긴것 = [];
  const 봐 = (말, 참) => { if (!참) 어긴것.push(말); };

  /* 2026-10-19 에 실제로 받은 응답들입니다 (지침 2절) */
  const 산것 = '<?xml version="1.0" encoding="UTF-8"?><wantedDtl><wantedAuthNo>K180012610190008</wantedAuthNo>'
    + '<wantedInfo><wantedTitle>화성시장애아동재활센터 물리치료사 채용공고(대체인력/긴급)</wantedTitle></wantedInfo></wantedDtl>';
  const 없어진것 = '<?xml version="1.0" encoding="UTF-8"?><wantedDtl><message>정보가 존재하지 않습니다.</message>'
    + '<messageCd>006</messageCd></wantedDtl>';

  봐('멀쩡한 응답은 막힘이 아니다', m.막힘인가(200, 산것) === null);

  /* ★★ 세중님 2번의 핵심 — **「없어짐」 을 막힘으로 읽지 않습니다** ★★
     여기서 막힘으로 보면 정찰이 없어진 공고를 하나도 못 내립니다 */
  봐('messageCd 006(없어짐)은 막힘이 아니다', m.막힘인가(200, 없어진것) === null);

  /* 그 짝 — 「막힘을 없어짐으로 읽지 않는다」 는 `워크넷없어짐()` 이 사는
     `없어진공고찾기.mjs --자기점검` 에 있습니다 (그 함수가 있는 자리에 둡니다) */

  봐('HTTP 500 은 막힘', /HTTP 500/.test(m.막힘인가(500, 산것) || ''));
  봐('빈 응답은 막힘', m.막힘인가(200, '') === '빈 응답');
  봐('HTML 오류 쪽은 막힘', /응답 꼴이 다름/.test(m.막힘인가(200, '<!DOCTYPE html><html>…') || ''));
  봐('한도 초과 꼴도 막힘 (봉투가 다릅니다)',
    /응답 꼴이 다름/.test(m.막힘인가(200, '<error><msg>일일 트래픽을 초과하였습니다</msg></error>') || ''));
  봐('막힘 까닭에 응답 앞부분이 들어간다',
    /일일 트래픽/.test(m.막힘인가(200, '<error><msg>일일 트래픽을 초과하였습니다</msg></error>') || ''));

  /* 호출 수 — 목록·상세를 따로 */
  m.세기('목록'); m.세기('목록'); m.세기('상세');
  봐('센 것이 갈래별로', m.지금센것().목록 === 2 && m.지금센것().상세 === 1);
  const n1 = m.남기기();
  봐('남긴 뒤 오늘 누적', n1.목록 === 2 && n1.상세 === 1 && n1.합 === 3);
  봐('남긴 뒤 비워진다', m.지금센것().목록 === 0 && m.지금센것().상세 === 0);
  m.세기('상세'); const n2 = m.남기기();
  봐('두 번째도 더해진다', n2.목록 === 2 && n2.상세 === 2 && n2.합 === 4);
  봐('오늘셈 이 같은 값을 읽는다', m.오늘셈().합 === 4);
  let 탈 = '';
  try { m.세기('무엇'); } catch (e) { 탈 = e.message; }
  봐('갈래가 틀리면 멈춘다', /목록·상세만/.test(탈));

  /* 막힘 깃발 — 문턱을 넘어야 멈춤입니다 */
  봐('처음 막힘은 아직 멈춤 아니다', m.막힘적기('WN2', '빈 응답', '', 3).멈춤 === false);
  m.막힘적기('WN2', '빈 응답', '', 3);
  봐('문턱(3)을 넘으면 멈춤', m.막힘적기('WN2', '빈 응답', '', 3).멈춤 === true);
  봐('막혔나 가 그 출처를 알려준다', m.막혔나('WN2')?.수 === 3);
  봐('다른 출처는 안 멈춘다', m.막혔나('AL2') === null);
  봐('오늘막힘 목록', m.오늘막힘().length === 1 && m.오늘막힘()[0].출처 === 'WN2');
  봐('응답 원문을 로그에 남긴다',
    fs.existsSync(임시 + '/고용24_막힘.log')
    && /빈 응답/.test(fs.readFileSync(임시 + '/고용24_막힘.log', 'utf8')));
  봐('열쇠는 가린다',
    (m.막힘적기('X', '시험', 'https://x?authKey=비밀값123&a=1', 99),
      !/비밀값123/.test(fs.readFileSync(임시 + '/고용24_막힘.log', 'utf8'))));

  fs.rmSync(임시, { recursive: true, force: true });
  if (어긴것.length) {
    console.error('✗ 고용24한도 자기점검 실패 ' + 어긴것.length + '가지');
    for (const x of 어긴것) console.error('   · ' + x);
    process.exit(1);
  }
  console.log('○ 고용24한도 자기점검 통과 — 19가지 (API 를 두드리지 않았습니다)');
}
