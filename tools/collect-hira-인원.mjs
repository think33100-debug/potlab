/* ═══════════════════════════════════════════════════════════════
 *  심평원 물리·작업치료사 인원을 **달마다 한 번** 쌓습니다
 *  2026-10-02 부터 돕니다 (표 심평원인원월별 · 함수 심평원받을곳·심평원인원담기)
 * ═══════════════════════════════════════════════════════════════
 *
 *  쓰는 법
 *    node tools/collect-hira-인원.mjs            이번 달 것을 다 받습니다
 *    node tools/collect-hira-인원.mjs --연월 2026-10
 *    node tools/collect-hira-인원.mjs --dry      받아만 보고 안 담습니다
 *    node tools/collect-hira-인원.mjs --n 5      5곳만 (빠른 확인)
 *
 *  어디서 받는가 — 이미 붙여 둔 API 입니다 (tools/hira.js 가 쓰는 것과 같은 곳)
 *    https://apis.data.go.kr/B551182/MadmDtlInfoService2.8/getEtcHstInfo2.8
 *      ykiho 로 묻습니다. **응답 원문으로 확인한 항목 이름** (2026-10-02) —
 *        dtlGnlNopCdNm · gnlNopCnt · gnlNopDtlCd · yadmNm · ykiho
 *      gnlNopDtlCd 100 = 물리치료사 · 110 = 작업치료사 · gnlNopCnt 가 인원입니다.
 *      100·110 은 숫자로, 071 은 문자열 '071' 로 옵니다 — 그래서 padStart 로 맞춥니다.
 *      **값이 없으면 null 로 둡니다 — 0 과 다릅니다.** 의원급은 이 자료가
 *      원래 없습니다 (오류가 아닙니다 · hira.js 줄 215).
 *
 *  얼마나 드는가
 *    기관 하나에 **한 번**만 씁니다 (hira.js 는 세 번 씁니다 — 거기는 시설정보와
 *    전문의까지 받으니까요. 인원만 쌓는 데는 한 번으로 됩니다).
 *    1층에서 요양기호가 있는 기관 534곳 → 534번. 한도는 하루 10,000번입니다
 *    (2026-09-25·26 에 9,998·9,999 에서 멈춘 실측 · hira_quota 표).
 *
 *  끊기면 이어받습니다
 *    심평원받을곳() 이 **그 달에 아직 안 받은 곳만** 돌려줍니다.
 *    다시 돌리면 남은 것만 받습니다. 중복은 (ykiho, 연월) 열쇠가 막습니다.
 *
 *  열쇠
 *    HIRA_KEY_ENC    **이미 URL 인코딩된 값입니다.** 다시 감싸면 %2B 가 %252B 가
 *                    됩니다. 그래서 문자열로 이어 붙입니다 (hira.js 와 같게).
 *    COLLECT_KEY_HS3 담을 때 쓰는 열쇠
 * ═══════════════════════════════════════════════════════════════ */
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
    /* 홑따옴표도 벗깁니다 — 서버 .env 는 홑따옴표로 감싸 둡니다 */
    if (m) o[m[1]] = m[2].trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
  }
  return o;
};
const cfg = {
  ...읽기(path.join(ROOT, '.env.local')),
  ...읽기(path.join(ROOT, 'web', '.env.local')),
  ...읽기(path.join(ROOT, '.env.server')),
  ...읽기(path.join(ROOT, '.env')),
  ...process.env,
};
/* 이름이 곳마다 다릅니다 — 서버 .env 는 SUPABASE_ANON_KEY,
   집 컴퓨터 web/.env.local 은 NEXT_PUBLIC_SUPABASE_ANON_KEY 입니다.
   2026-10-02 에 여기서 401 「Invalid API key」 가 났습니다 */
cfg.SUPABASE_URL = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
cfg.SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY || cfg.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SOURCE = 'HS3';            // 담는 열쇠는 병원 게시판 것을 같이 씁니다
const API = 'https://apis.data.go.kr/B551182/MadmDtlInfoService2.8/getEtcHstInfo2.8';

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 몇건 = argv.includes('--n') ? Number(argv[argv.indexOf('--n') + 1]) || 0 : 0;
const 연월 = argv.includes('--연월')
  ? String(argv[argv.indexOf('--연월') + 1] || '')
  : new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

if (!/^\d{4}-\d{2}$/.test(연월)) { console.error('연월은 YYYY-MM 꼴이어야 합니다 — ' + 연월); process.exit(1); }

const t0 = Date.now();
console.log('심평원 인원 쌓기 · ' + 연월 + (dry ? ' · **--dry · 담지 않습니다**' : ''));
console.log('  HIRA_KEY_ENC    ' + (cfg.HIRA_KEY_ENC ? '있음 · ' + cfg.HIRA_KEY_ENC.length + '자' : '**없음**'));
console.log('  Supabase        ' + (cfg.SUPABASE_URL ? '있음' : '**없음**'));
const 열쇠 = cfg.COLLECT_KEY_HS3 || '';
console.log('  COLLECT_KEY_HS3 ' + (열쇠 ? '있음' : '**없음**'));
if (!cfg.HIRA_KEY_ENC || !cfg.SUPABASE_URL || !열쇠) { console.error('\n열쇠가 모자랍니다 — 멈춥니다'); process.exit(1); }

async function rpc(이름, body) {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(이름), {
    method: 'POST',
    headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY,
               'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const 글 = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' · 응답 원문 — ' + 글.slice(0, 500));
  return 글 ? JSON.parse(글) : null;
}

/* 묶음마다 — 물어보기 → 받기 → 담기
   Supabase 는 한 번에 **100줄까지만** 내줍니다. Range 헤더도 안 듣습니다 —
   529줄을 물었는데 content-range 가 `0-99/*` 로 고정이었습니다 (2026-10-02 확인).
   심평원받을곳() 이 「그 달에 아직 안 받은 곳」만 돌려주니, 담고 나서 다시
   물으면 저절로 이어집니다. 그래서 **빌 때까지 되묻습니다.**
   --n 을 주면 한 묶음만 보고 멈춥니다 (빠른 확인용). */
const 셈 = { 물음: 0, 받음: 0, 빈곳: 0, 실패: 0, 묶음: 0, 담은수: 0 };
const 처음오류 = [];
const 본보기 = [];

while (true) {
  const 할것0 = await rpc('심평원받을곳', { p_secret: 열쇠, p_source: SOURCE, p_연월: 연월 });
  const 할것 = 몇건 ? 할것0.slice(0, 몇건) : 할것0;
  if (!할것.length) break;
  셈.묶음++;
  console.log('\n── ' + 셈.묶음 + '번째 묶음 · ' + 할것.length + '곳 ──');

  const 담을것 = [];
  for (const o of 할것) {
    const u = API + '?serviceKey=' + cfg.HIRA_KEY_ENC
      + '&ykiho=' + encodeURIComponent(o.ykiho) + '&numOfRows=50&pageNo=1&_type=json';
    셈.물음++;
    try {
      const r = await fetch(u);
      const 글 = await r.text();
      let j = null;
      try { j = JSON.parse(글); } catch { /* 아래에서 처리 */ }
      /* 공공데이터포털은 열쇠·서비스 오류를 **JSON 이든 XML 이든** 200 으로도 보냅니다.
         그래서 코드만 보지 않고 응답 속을 봅니다 */
      if (!j || j.OpenAPI_ServiceResponse || j?.response?.header?.resultCode !== '00') {
        셈.실패++;
        if (처음오류.length < 3) 처음오류.push({ 기관: o.기관명, 원문: 글.slice(0, 600) });
        continue;
      }
      const it = j.response.body?.items?.item;
      const 줄들 = Array.isArray(it) ? it : it ? [it] : [];
      const 찾기 = (cd) => {
        const h = 줄들.find((x) => String(x.gnlNopDtlCd).padStart(3, '0') === cd);
        return h == null ? null : Number(h.gnlNopCnt);
      };
      const 한줄 = {
        ykiho: o.ykiho, 연월, 기관명: o.기관명, 종별: o.종별,
        물리: 찾기('100'), 작업: 찾기('110'),
      };
      담을것.push(한줄);
      if (본보기.length < 3 && (한줄.물리 != null || 한줄.작업 != null)) 본보기.push(한줄);
      셈.받음++;
      if (!줄들.length) 셈.빈곳++;
    } catch (e) {
      셈.실패++;
      if (처음오류.length < 3) 처음오류.push({ 기관: o.기관명, 원문: String(e.message).slice(0, 400) });
    }
    await new Promise((f) => setTimeout(f, 120));
    if (셈.물음 % 100 === 0) console.log('  ' + 셈.물음 + '곳까지 물었습니다');
  }

  if (dry) { console.log('  --dry 라 담지 않습니다 — 되묻기를 멈춥니다'); break; }
  for (let i = 0; i < 담을것.length; i += 300) {
    셈.담은수 += Number(await rpc('심평원인원담기',
      { p_secret: 열쇠, p_source: SOURCE, p_rows: 담을것.slice(i, i + 300) })) || 0;
  }
  console.log('  담음 ' + 담을것.length + '곳 (여기까지 ' + 셈.담은수 + '줄)');
  /* 실패한 곳은 안 담겼으니 다음 묶음에 또 나옵니다. 끝없이 돌지 않게 멈춥니다 */
  if (!담을것.length) { console.error('  ★ 이 묶음에서 하나도 못 받았습니다 — 멈춥니다'); break; }
  if (몇건) break;
}

console.log('\n── 끝 ──');
console.log('  묶음 ' + 셈.묶음 + '번 · 물음 ' + 셈.물음 + '번 · 받음 ' + 셈.받음
  + '곳 · 인원 자료가 빈 곳 ' + 셈.빈곳 + '곳 (의원급은 원래 비어 있습니다) · 실패 ' + 셈.실패 + '곳');
console.log('  담음 ' + 셈.담은수 + '줄');
if (본보기.length) {
  console.log('\n  본보기 —');
  for (const x of 본보기) {
    console.log('    ' + String(x.물리 ?? '-').padStart(4) + '명 물리 · '
      + String(x.작업 ?? '-').padStart(4) + '명 작업   ' + x.기관명 + ' (' + x.종별 + ')');
  }
}
if (처음오류.length) {
  console.log('\n  ★ 실패한 곳의 응답 원문 (앞 세 곳) —');
  for (const x of 처음오류) { console.log('    ' + x.기관); console.log('      ' + x.원문.replace(/\n/g, ' ')); }
}
console.log('\n' + Math.round((Date.now() - t0) / 1000) + '초');
if (셈.실패) {
  console.error('실패 ' + 셈.실패 + '곳이 있습니다 — 다시 돌리면 그곳만 받습니다');
  process.exitCode = 1;
}
