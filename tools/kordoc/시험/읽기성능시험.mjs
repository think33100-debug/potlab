/* 읽기 성능 시험 — 네 가지 방식을 같은 문제로 (2026-10-07 세중님 지시 [2])
 *
 *   node 읽기성능시험.mjs            전부
 *   node 읽기성능시험.mjs --ai없이     (a)(b) 만 — 돈이 안 듭니다
 *
 *   (a) 지금 쓰는 것   본문 + hwp5html(첨부) + hs_dates 규칙
 *   (b) kordoc        첨부를 kordoc 으로 뽑고 hs_dates 규칙
 *   (c) kordoc + Haiku  kordoc 글자를 Claude Haiku 4.5 에 넘겨 칸을 뽑음
 *   (d) 그림           Haiku 4.5 vs Sonnet 4.5 (토막은 **겹침 200px**)
 *
 * ★ DB 에 아무것도 안 씁니다. 결과는 파일로만.
 * ★ 열쇠 값은 찍지 않습니다.
 *
 * 채점 — 항목마다 맞음 · 틀림 · 빈칸을 **따로** 셉니다.
 *   틀림이 빈칸보다 나쁩니다 (지어낸 마감일을 믿은 회원은 공고를 놓칩니다).
 *   정답지에서 「미확인」 인 칸은 **채점에서 뺍니다** (정답을 모르니까).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const 집 = process.env.HOME;
const 저장소 = 집 + '/potlab';
const { hsDetailDates, hsText } = require(저장소 + '/tools/hosp/hs_dates.js');
const KORDOC = 저장소 + '/tools/kordoc/node_modules/kordoc/dist/cli.js';
const 자료 = 집 + '/읽기시험자료/성능시험';
const 정답지 = JSON.parse(fs.readFileSync(집 + '/읽기시험자료/정답지.json', 'utf8'));
const AI없이 = process.argv.includes('--ai없이');
const 열쇠 = process.env.ANTHROPIC_API_KEY;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/* 요금 (2026-10-07 요금표 · $/MTok) */
const 요금 = {
  'claude-haiku-4-5-20251001': { 입력: 1, 출력: 5 },
  'claude-sonnet-4-5-20250929': { 입력: 3, 출력: 15 },
};
const 돈 = (모델, u) => ((u.input_tokens || 0) * 요금[모델].입력 + (u.output_tokens || 0) * 요금[모델].출력) / 1e6;

const 지시문 = `당신은 한국 채용 공고문에서 정해진 항목만 뽑는 도구입니다.
글을 쓰지 말고, 설명하지 말고, JSON 하나만 내십시오.

가장 중요한 규칙 — 원문에 없으면 null 입니다.
 · 항목마다 「근거」 에 **원문 글자를 그대로** 옮기십시오. 한 문장 또는 표의 한 줄.
 · 못 찾으면 값도 null, 근거도 null. 그럴듯한 값을 채우지 마십시오.
 · null 이 틀린 값보다 **낫습니다**. 관행으로 미루어 짐작하지 마십시오.

뽑을 것
 · 마감일: 원서·서류 **접수** 마감일만. YYYY-MM-DD.
   면접일·합격발표일·임용일·계약기간·근무기간은 **아닙니다**.
   「채용시까지」 「수시모집」 처럼 날짜가 없으면 null 입니다.
 · 우리직군있나: 모집 분야에 **물리치료사 또는 작업치료사**가 있으면 true, 없으면 false.
   자격 요건에 「간호사, 작업치료사, 사회복지사 중 하나」 처럼 적혀 있어도 true 입니다.
 · 우리직군인원: 물리치료사·작업치료사 자리의 인원 합. 따로 안 적혀 있으면 null.
 · 전체인원: 모든 직군을 합친 인원. 우리 직군 인원을 여기 넣지 마십시오.
 · 고용형태: 적힌 말 그대로 (정규직·계약직·무기계약직·비정규직·기간제 등).

꼴 (이대로만)
{"마감일":{"값":null,"근거":null},
 "우리직군있나":{"값":null,"근거":null},
 "우리직군인원":{"값":null,"근거":null},
 "전체인원":{"값":null,"근거":null},
 "고용형태":{"값":null,"근거":null}}`;

async function 부르기(모델, 내용, max = 1500) {
  const t0 = Date.now();
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': 열쇠, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 모델, max_tokens: max, messages: [{ role: 'user', content: 내용 }] }),
  });
  const t = await r.text();
  const ms = Date.now() - t0;
  if (!r.ok) return { 왜: 'HTTP ' + r.status + ' · ' + t.slice(0, 200), ms };
  const j = JSON.parse(t);
  const 글 = (j.content || []).map((c) => c.text || '').join('');
  const m = 글.match(/\{[\s\S]*\}/);
  let 값 = null;
  try { 값 = JSON.parse(m ? m[0] : 글); } catch {}
  return { 값, 답글: 글, usage: j.usage, ms, 비용: 돈(모델, j.usage) };
}

const 꺼내 = (o, k) => (o && o[k] && o[k].값 !== undefined) ? o[k].값 : null;
const 근거 = (o, k) => (o && o[k] && o[k].근거) ? String(o[k].근거).slice(0, 110) : '';

/* ── 채점 ──────────────────────────────────────────────────
   정답이 「미확인」 이면 뺍니다. 정답이 null 이고 낸 값도 null 이면 맞음입니다
   (「마감일이 없는 것」 이 정답인 공고가 있습니다 — 선한병원·영남대영천) */
function 채점(정답, 낸값) {
  if (정답 === '미확인') return '뺌';
  const 같나 = (a, b) => {
    if (a === null) return b === null || b === undefined || b === '';
    if (b === null || b === undefined || b === '') return false;
    if (typeof a === 'boolean') return a === (b === true || b === 'true');
    if (typeof a === 'number') return Number(b) === a;
    return String(b).replace(/[\s.]/g, '').includes(String(a).replace(/[\s.]/g, ''))
        || String(a).replace(/[\s.]/g, '').includes(String(b).replace(/[\s.]/g, ''));
  };
  if (낸값 === null || 낸값 === undefined || 낸값 === '') return 정답 === null ? '맞음' : '빈칸';
  return 같나(정답, 낸값) ? '맞음' : '틀림';
}

const 칸들 = ['마감일', '우리직군있나', '우리직군인원', '전체인원', '고용형태'];
const 결과 = [];

for (const q of 정답지.문제) {
  const 한건 = { id: q.id, 기관: q.기관, 갈래: q.갈래, 층: q.층, 정답: q.정답, 방식: {} };
  console.log('\n===== ' + q.id + ' ' + q.기관 + ' [' + q.갈래 + ']');

  /* 본문 글자 — (a)(b) 둘 다 씁니다 */
  let 본문 = '';
  try {
    const r = await fetch(q.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' } });
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || '';
    let cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
          || (buf.subarray(0, 3000).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    try { 본문 = hsText(new TextDecoder(cs.toLowerCase()).decode(buf)); }
    catch { 본문 = hsText(buf.toString('utf8')); }
  } catch (e) { 본문 = ''; }

  const 첨부 = q.파일 ? path.join(자료, q.파일) : null;
  const 첨부있나 = 첨부 && fs.existsSync(첨부);

  /* ── (a) 지금 쓰는 것 — 본문 + hwp5html + hs_dates ── */
  {
    const t0 = Date.now();
    let 글 = 본문;
    if (첨부있나 && /\.hwp$/i.test(첨부)) {
      try {
        const 밖 = path.join(자료, 'h_' + path.basename(첨부, '.hwp'));
        execFileSync(집 + '/hwp읽기/bin/hwp5html', ['--output', 밖, 첨부], { timeout: 120000, stdio: 'ignore' });
        const x = fs.readFileSync(path.join(밖, 'index.xhtml'), 'utf8');
        글 = 본문 + ' ' + x.replace(/<[^>]+>/g, ' ').replace(/&#13;/g, ' ').replace(/\s+/g, ' ');
      } catch {}
    } else if (첨부있나 && /\.pdf$/i.test(첨부)) {
      try { 글 = 본문 + ' ' + execFileSync('pdftotext', ['-layout', 첨부, '-'], { encoding: 'utf8', timeout: 120000 }).replace(/\s+/g, ' '); } catch {}
    }
    const d = hsDetailDates(글);
    한건.방식.a = { 이름: '지금 (본문+hwp5html/pdftotext+규칙)', 초: (Date.now() - t0) / 1000, 비용: 0,
      값: { 마감일: d.to ? d.to.replace(/\./g, '-') : null, 우리직군있나: null, 우리직군인원: null, 전체인원: null, 고용형태: null } };
  }

  /* ── (b) kordoc + hs_dates ── */
  let kordoc글 = '';
  {
    const t0 = Date.now();
    if (첨부있나) {
      try { kordoc글 = execFileSync(process.execPath, [KORDOC, 첨부], { encoding: 'utf8', maxBuffer: 64e6, timeout: 180000 }); } catch {}
    }
    const 글 = (본문 + ' ' + kordoc글.replace(/\s+/g, ' ')).trim();
    const d = hsDetailDates(글);
    한건.방식.b = { 이름: 'kordoc + 규칙', 초: (Date.now() - t0) / 1000, 비용: 0, kordoc글자: kordoc글.length,
      값: { 마감일: d.to ? d.to.replace(/\./g, '-') : null, 우리직군있나: null, 우리직군인원: null, 전체인원: null, 고용형태: null } };
  }

  /* ── (c) kordoc 글자 + Haiku ── */
  if (!AI없이 && q.갈래 !== '그림') {
    const 글 = (본문.slice(0, 8000) + '\n\n--- 첨부 ---\n' + kordoc글.slice(0, 14000)).trim();
    const r = await 부르기('claude-haiku-4-5-20251001',
      [{ type: 'text', text: '아래는 채용 공고 한 건의 **상세 화면 글**과 **첨부 공고문**입니다.\n\n' + 글 },
       { type: 'text', text: 지시문 }]);
    한건.방식.c = { 이름: 'kordoc + Haiku 4.5', 초: (r.ms || 0) / 1000, 비용: r.비용 || 0, usage: r.usage, 왜: r.왜,
      값: { 마감일: 꺼내(r.값, '마감일'), 우리직군있나: 꺼내(r.값, '우리직군있나'),
            우리직군인원: 꺼내(r.값, '우리직군인원'), 전체인원: 꺼내(r.값, '전체인원'), 고용형태: 꺼내(r.값, '고용형태') },
      근거: Object.fromEntries(칸들.map((k) => [k, 근거(r.값, k)])) };
  }

  /* ── (d) 그림 — Haiku vs Sonnet (겹침 200px) ── */
  if (!AI없이 && q.갈래 === '그림') {
    const 토막 = fs.readdirSync(자료).filter((f) => new RegExp('^' + q.그림앞 + '_\\d+\\.jpg$').test(f))
      .sort((a, b) => Number(a.match(/_(\d+)/)[1]) - Number(b.match(/_(\d+)/)[1]));
    const 내용 = [];
    토막.forEach((f, i) => {
      내용.push({ type: 'text', text: '토막 ' + (i + 1) + ' / ' + 토막.length + ' (앞 토막과 200픽셀 겹칩니다):' });
      내용.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: fs.readFileSync(path.join(자료, f)).toString('base64') } });
    });
    내용.push({ type: 'text', text: '위 그림들은 공고문 한 장을 위에서 아래로 자른 것입니다. 이어서 읽으십시오.\n\n' + 지시문 });
    for (const [키, 모델] of [['d_haiku', 'claude-haiku-4-5-20251001'], ['d_sonnet', 'claude-sonnet-4-5-20250929']]) {
      const r = await 부르기(모델, 내용);
      한건.방식[키] = { 이름: '그림 · ' + 모델, 토막수: 토막.length, 초: (r.ms || 0) / 1000, 비용: r.비용 || 0, usage: r.usage, 왜: r.왜,
        값: { 마감일: 꺼내(r.값, '마감일'), 우리직군있나: 꺼내(r.값, '우리직군있나'),
              우리직군인원: 꺼내(r.값, '우리직군인원'), 전체인원: 꺼내(r.값, '전체인원'), 고용형태: 꺼내(r.값, '고용형태') },
        근거: Object.fromEntries(칸들.map((k) => [k, 근거(r.값, k)])) };
    }
  }

  /* 채점 */
  for (const [키, v] of Object.entries(한건.방식)) {
    v.채점 = Object.fromEntries(칸들.map((k) => [k, 채점(q.정답[k], v.값[k])]));
    const c = Object.values(v.채점);
    console.log('   ' + 키.padEnd(9) + v.이름.slice(0, 34).padEnd(36)
      + '맞음 ' + c.filter((x) => x === '맞음').length
      + ' · 틀림 ' + c.filter((x) => x === '틀림').length
      + ' · 빈칸 ' + c.filter((x) => x === '빈칸').length
      + ' · 뺌 ' + c.filter((x) => x === '뺌').length
      + ' · ' + v.초.toFixed(1) + '초 · $' + (v.비용 || 0).toFixed(5)
      + (v.왜 ? '  ✗ ' + v.왜 : ''));
  }
  결과.push(한건);
}

/* ── 합계 ──────────────────────────────────────────────── */
console.log('\n\n━━━━ 합계 ━━━━');
const 방식들 = [...new Set(결과.flatMap((r) => Object.keys(r.방식)))];
for (const m of 방식들) {
  const 것들 = 결과.map((r) => r.방식[m]).filter(Boolean);
  const 셈 = { 맞음: 0, 틀림: 0, 빈칸: 0, 뺌: 0 };
  것들.forEach((v) => Object.values(v.채점).forEach((x) => 셈[x]++));
  const 돈합 = 것들.reduce((s, v) => s + (v.비용 || 0), 0);
  const 초합 = 것들.reduce((s, v) => s + (v.초 || 0), 0);
  console.log(m.padEnd(10) + (것들[0] ? 것들[0].이름.slice(0, 32) : '').padEnd(34)
    + '맞음 ' + String(셈.맞음).padStart(3) + ' · 틀림 ' + String(셈.틀림).padStart(2)
    + ' · 빈칸 ' + String(셈.빈칸).padStart(3) + ' · 뺌 ' + String(셈.뺌).padStart(3)
    + '  |  ' + 것들.length + '건 · ' + (초합 / 것들.length).toFixed(1) + '초/건 · $'
    + (돈합 / 것들.length).toFixed(5) + '/건');
}
console.log('\n━━━━ 칸마다 (맞음/틀림/빈칸) ━━━━');
for (const k of 칸들) {
  let 줄 = k.padEnd(12);
  for (const m of 방식들) {
    const 것들 = 결과.map((r) => r.방식[m]).filter(Boolean).map((v) => v.채점[k]);
    줄 += m + ' ' + 것들.filter((x) => x === '맞음').length + '/' + 것들.filter((x) => x === '틀림').length
       + '/' + 것들.filter((x) => x === '빈칸').length + '   ';
  }
  console.log(줄);
}

const 때 = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const 쓸곳 = 집 + '/읽기시험자료/성능시험_' + 때 + '.json';
fs.writeFileSync(쓸곳, JSON.stringify({ 때, 결과 }, null, 2), 'utf8');
console.log('\n결과 파일 — ' + 쓸곳);
