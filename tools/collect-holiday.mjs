/* 공휴일 받기 — 한국천문연구원 특일 정보 (2026-10-05).
 *
 *  무엇에 쓰나 — 수집기 박동이 「이 날은 공고가 없는 게 맞다」를 가립니다.
 *  주말(토·일)은 날짜로 알지만 공휴일은 이 표가 있어야 압니다.
 *
 *  ── 확인한 것 (2026-10-05) ──────────────────────────────────
 *    서비스   한국천문연구원_특일 정보 (공공데이터포털 15012690)
 *    주소     .../SpcdeInfoService/getRestDeInfo
 *    열쇠     **ALIO_DETAIL_KEY 로 됩니다** — 따로 안 받아도 됩니다
 *             (ALIO_LIST_KEY·YOUTH_KEY·WORK_KEY·CLEANEYE_KEY 는 30 「등록되지 않은 서비스키」)
 *    응답     <item><dateKind>01</dateKind><dateName>한글날</dateName>
 *             <isHoliday>Y</isHoliday><locdate>20261009</locdate><seq>1</seq></item>
 *    2026년   22건
 *
 *  ⚷ isHoliday 가 Y 인 것만 담습니다. 24절기·잡절은 쉬는 날이 아닙니다.
 *  ⚷ 열쇠 값은 안 찍습니다.
 *
 *  쓰는 법
 *    node tools/collect-holiday.mjs            올해와 내년
 *    node tools/collect-holiday.mjs 2027 2028  해를 찍어서
 *    node tools/collect-holiday.mjs --dry      받기만 하고 안 담습니다
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(여기, '..');
const 읽기 = (f) => {
  const o = {};
  if (!fs.existsSync(f)) return o;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
  }
  return o;
};
const cfg = { ...읽기(path.join(ROOT, '.env')), ...읽기(path.join(ROOT, '.env.local')),
  ...읽기(path.join(ROOT, '.env.server')), ...process.env };
cfg.SUPABASE_URL = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;

const URL_ = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
/* HOLIDAY_KEY 가 따로 있으면 그걸 먼저 씁니다. 없으면 되는 것이 확인된 열쇠 */
const KEY = cfg.HOLIDAY_KEY || cfg.ALIO_DETAIL_KEY;

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 올해 = new Date(Date.now() + 9 * 3600e3).getFullYear();
const 해들 = argv.filter((a) => /^\d{4}$/.test(a)).map(Number);
const 받을해 = 해들.length ? 해들 : [올해, 올해 + 1];

console.log('공휴일 받기 · ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  + (dry ? ' · **--dry**' : ''));
if (!KEY) { console.error('열쇠가 없습니다 (HOLIDAY_KEY 또는 ALIO_DETAIL_KEY)'); process.exit(1); }
console.log('  열쇠 ' + (cfg.HOLIDAY_KEY ? 'HOLIDAY_KEY' : 'ALIO_DETAIL_KEY')
  + ' (' + KEY.length + '자 · 값은 안 찍습니다)');
console.log('  받을 해 ' + 받을해.join(' · '));

const 가리기 = (t) => String(t).split(KEY).join('‹열쇠›')
  .split(encodeURIComponent(KEY)).join('‹열쇠›');

const 모은것 = [];
let 탈 = 0;
for (const 해 of 받을해) {
  const u = URL_ + '?serviceKey=' + encodeURIComponent(KEY)
    + '&solYear=' + 해 + '&numOfRows=100&pageNo=1';
  let code = 0, 글 = '';
  try {
    const r = await fetch(u, { headers: { Accept: 'application/xml' } });
    code = r.status; 글 = await r.text();
  } catch (e) { 글 = String(e.message); }

  const 결과 = (글.match(/<resultCode>([^<]*)<\/resultCode>/) || [])[1] || '?';
  if (code !== 200 || (결과 !== '00' && 결과 !== '0')) {
    console.error('  ★ ' + 해 + '년 못 받았습니다 — HTTP ' + code + ' · resultCode ' + 결과);
    console.error('     응답 앞 400자 — ' + 가리기(글).replace(/\s+/g, ' ').slice(0, 400));
    탈++;
    continue;
  }

  const 줄 = [];
  for (const m of 글.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const c = m[1];
    const 값 = (t) => ((c.match(new RegExp('<' + t + '>([^<]*)</' + t + '>')) || [])[1] || '').trim();
    /* ★ 쉬는 날만 담습니다. 24절기·잡절은 일하는 날입니다 */
    if (값('isHoliday') !== 'Y') continue;
    const d = 값('locdate');
    if (!/^\d{8}$/.test(d)) continue;
    줄.push({ 날: d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8), 이름: 값('dateName') });
  }
  console.log('  ' + 해 + '년 ' + 줄.length + '일 — '
    + 줄.map((x) => x.날.slice(5) + ' ' + x.이름).join(' · '));
  모은것.push(...줄);
  await new Promise((f) => setTimeout(f, 400));
}

if (!모은것.length) { console.error('\n받은 것이 없습니다'); process.exit(1); }
console.log('\n모두 ' + 모은것.length + '일');

if (dry) { console.log('--dry 라 안 담았습니다'); process.exit(탈 ? 1 : 0); }

/* 담기 — service_role 로 직접 올립니다 (표가 anon·authenticated 에게 닫혀 있습니다).
   같은 날이 또 와도 이름만 새로 씁니다 */
const k = cfg.SUPABASE_SERVICE_KEY;
if (!k || !cfg.SUPABASE_URL) { console.error('SUPABASE_SERVICE_KEY 또는 URL 이 없습니다'); process.exit(1); }
const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + encodeURIComponent('공휴일')
  + '?on_conflict=' + encodeURIComponent('날'), {
  method: 'POST',
  headers: { apikey: k, Authorization: 'Bearer ' + k,
    'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
  body: JSON.stringify(모은것),
});
const 답 = await r.text();
if (!r.ok) {
  console.error('담지 못했습니다 — HTTP ' + r.status + ' · 응답 원문 — ' + 답.slice(0, 600));
  process.exit(1);
}
console.log('담았습니다 ' + 모은것.length + '일');
process.exit(탈 ? 1 : 0);
