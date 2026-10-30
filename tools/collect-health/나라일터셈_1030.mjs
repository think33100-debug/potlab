/* 나라일터(GJ2) 가 **보건소·치매안심센터** 공고를 얼마나 주나 — 읽기 전용 셈
 * (2026-10-30 12:04 세중님 「보건소 API」)
 *
 *   node tools/collect-health/나라일터셈_1030.mjs            최근 90일
 *   node tools/collect-health/나라일터셈_1030.mjs --며칠 30   날수 바꾸기
 *   node tools/collect-health/나라일터셈_1030.mjs --자기점검   물음 없이 셈 규칙만 시험
 *
 * ── 읽는 길 ──────────────────────────────────────────────────
 * 나라일터는 **쪽 긁기가 아닙니다** — 인사혁신처 「공공취업정보 조회 서비스」
 * 오픈API 입니다 (https://apis.data.go.kr/1760000/PblJobService · 운영계정 일 10만건).
 * 우리는 이미 그 API 로 GJ2 를 담고 있습니다 (tools/collect-nara.mjs · 하루 크론).
 * 그래서 이 도구는 **같은 /getList 를 읽기만** 합니다 — DB 에 쓰지 않습니다.
 *
 * ── 울타리 ───────────────────────────────────────────────────
 *  · 쓰기 없음 (collect_put·collect_beat 를 부르지 않습니다)
 *  · 한 쪽 100건 · 쪽 사이 2초 · 쪽 상한 60 (90일이면 6,000건까지)
 *  · 열쇠는 ALIO_DETAIL_KEY (collect-nara.mjs 와 같은 것)
 */
import fs from 'node:fs';

const 인수 = process.argv.slice(2);
const 값 = (이름, 기본) => { const i = 인수.indexOf(이름); return i < 0 ? 기본 : 인수[i + 1]; };
const 며칠 = Number(값('--며칠', '90'));
const 최대쪽 = Number(값('--쪽', '60'));
const 자기점검 = 인수.includes('--자기점검');

/* ── 셈 규칙 (한 자리) ─────────────────────────────────────── */
const 보건기관꼴 = /보건소|보건의료원|보건지소|보건진료소/;
const 치매꼴 = /치매안심센터|치매안심|광역치매센터|치매센터/;
const 지자체꼴 = /특별시|광역시|특별자치시|특별자치도|[가-힣]+도$|[가-힣]+시$|[가-힣]+군$|[가-힣]+구$|시청|군청|구청|도청/;
export const 갈래 = (기관) => {
  const g = String(기관 || '');
  if (치매꼴.test(g)) return '치매';
  if (보건기관꼴.test(g)) return '보건기관';
  if (지자체꼴.test(g)) return '지자체(그 밖)';
  return '그 밖';
};

if (자기점검) {
  const 짝 = [
    ['서울특별시 강동구보건소', '보건기관'], ['음성군보건소', '보건기관'],
    ['완주군보건의료원', '보건기관'], ['포천시 소흘보건지소', '보건기관'],
    ['강동구 치매안심센터', '치매'], ['경기도광역치매센터', '치매'],
    ['서울특별시', '지자체(그 밖)'], ['김해시', '지자체(그 밖)'],
    ['가평군', '지자체(그 밖)'], ['종로구청', '지자체(그 밖)'],
    ['한국철도공사', '그 밖'], ['국민건강보험공단', '그 밖'],
  ];
  let 틀림 = 0;
  for (const [기관, 바람] of 짝) {
    const 난것 = 갈래(기관);
    if (난것 !== 바람) { 틀림++; console.log('✗ ' + 기관 + ' → ' + 난것 + ' (바란 것 ' + 바람 + ')'); }
  }
  console.log((틀림 ? '✗ ' + 틀림 + '건 틀림' : '○ ' + 짝.length + '가지 통과'));
  process.exit(틀림 ? 1 : 0);
}

/* ── 열쇠 ───────────────────────────────────────────────────── */
const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!cfg.ALIO_DETAIL_KEY) { console.error('✗ ALIO_DETAIL_KEY 가 없습니다 (서버에서 돌리십시오)'); process.exit(1); }

const BASE = 'https://apis.data.go.kr/1760000/PblJobService';
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));
const 날 = (더할) => {
  const d = new Date(Date.now() + 더할 * 86400000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
};
const 칸 = (글, 이름) => {
  const m = 글.match(new RegExp('<' + 이름 + '>([\s\S]*?)</' + 이름 + '>'));
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
};
const 아이템들 = (글) => (글.match(/<item>[\s\S]*?<\/item>/g) || []).map((it) => ({
  idx: 칸(it, 'idx'), title: 칸(it, 'title'), 기관: 칸(it, 'insttname'),
  기관코드: 칸(it, 'insttcode'), 지역: 칸(it, 'areacode'),
  등록일: 칸(it, 'regdate'), 시작: 칸(it, 'begindate'), 마감: 칸(it, 'enddate'),
  type01: 칸(it, 'type01'), type02: 칸(it, 'type02'),
}));

/* ── 읽기 ───────────────────────────────────────────────────── */
console.log('나라일터 /getList — 최근 ' + 며칠 + '일 (읽기 전용 · 쓰기 0)');
const 모은것 = [];
let 전체 = null;
for (let 쪽 = 1; 쪽 <= 최대쪽; 쪽++) {
  const u = BASE + '/getList?serviceKey=' + cfg.ALIO_DETAIL_KEY
    + '&pageNo=' + 쪽 + '&numOfRows=100&Sort_order=2'
    + '&Begin_de=' + 날(-며칠) + '&End_de=' + 날(1);
  const r = await fetch(u, { headers: { accept: 'application/xml' } }).catch((e) => ({ ok: false, status: 0, 왜: String(e.message) }));
  if (!r.ok) { console.error('✗ ' + 쪽 + '쪽 HTTP ' + (r.status || 0) + ' ' + (r.왜 || '')); break; }
  const 글 = await r.text();
  if (전체 === null) {
    전체 = Number(칸(글, 'totalCount') || 0);
    console.log('  totalCount ' + 전체 + '건');
  }
  const 줄 = 아이템들(글);
  if (!줄.length) break;
  모은것.push(...줄);
  process.stdout.write('\r  받은 줄 ' + 모은것.length + (전체 ? ' / ' + 전체 : ''));
  if (전체 && 모은것.length >= 전체) break;
  await 자고(2000);
}
console.log('');

/* ── 셈 ─────────────────────────────────────────────────────── */
const 셈 = {};
for (const x of 모은것) { const g = 갈래(x.기관); 셈[g] = (셈[g] || 0) + 1; }
console.log('\n갈래별 (기관 이름으로 가름)');
for (const [k, v] of Object.entries(셈).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + k.padEnd(14) + String(v).padStart(6) + '건');
}

const 보건 = 모은것.filter((x) => 갈래(x.기관) === '보건기관');
const 치매 = 모은것.filter((x) => 갈래(x.기관) === '치매');
console.log('\n★ 한 줄 — 최근 ' + 며칠 + '일 나라일터 ' + 모은것.length + '건 중 '
  + '보건기관 ' + 보건.length + '건 · 치매 ' + 치매.length + '건');

const 곳셈 = (줄들) => {
  const m = new Map();
  for (const x of 줄들) m.set(x.기관, (m.get(x.기관) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
for (const [이름, 줄들] of [['보건기관', 보건], ['치매', 치매]]) {
  if (!줄들.length) continue;
  console.log('\n' + 이름 + ' — 곳 ' + 곳셈(줄들).length + '곳 (많은 순 10곳)');
  for (const [기관, n] of 곳셈(줄들).slice(0, 10)) console.log('  ' + String(n).padStart(3) + '건  ' + 기관);
  console.log('  본보기 5건');
  for (const x of 줄들.slice(0, 5)) {
    console.log('    ' + x.등록일.padEnd(11) + (x.기관 || '').slice(0, 18).padEnd(20) + (x.title || '').slice(0, 44));
  }
}

/* type01·type02 가 무엇인가 — 「지방자치단체」 갈래 칸이 따로 있나 보려고 */
const 묶음 = (키) => {
  const m = new Map();
  for (const x of 모은것) m.set(x[키] || '(빈칸)', (m.get(x[키] || '(빈칸)') || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
};
for (const 키 of ['type01', 'type02', '지역']) {
  console.log('\n' + 키 + ' 값 묶음 — ' + 묶음(키).map(([k, v]) => k + ' ' + v).join(' · '));
}
