/* 국세청 사업자등록 진위확인 (2026-10-09).
 *
 *   node tools/사업자진위확인.mjs 1234567890 [1234567890 …]
 *
 * ── 열쇠 ─────────────────────────────────────────────────────
 * 서버 ~/potlab/.env 의 **NTS_BIZ_KEY** 를 씁니다.
 * 없으면 아무것도 두드리지 않고 「수동 확인」으로 끝냅니다 —
 * 관리자가 화면에서 눈으로 보고 정합니다. 기능이 멈추지 않습니다.
 *
 * 세중님이 2026-10-09 에 공공데이터포털에서 운영계정 활용신청 승인을 받으셨습니다.
 * 열쇠를 .env 에 NTS_BIZ_KEY= 로 넣으면 이 파일이 저절로 돕니다.
 *
 * ── 명세를 짐작하지 않습니다 (작업지침 3절) ──────────────────
 * 아래 주소와 항목 이름은 **아직 원문으로 확인하지 않았습니다.**
 * 열쇠가 생기면 먼저 한 건을 쏘아 **응답 원문 500~1200자와 항목 이름 목록**을
 * 찍고(--원문), 그걸 보고 읽는 코드를 맞춥니다. 지금 코드는 그 전 단계입니다.
 *
 * ── 무엇을 가리나 ────────────────────────────────────────────
 *   계속사업자 · 휴업자 · 폐업자 · 없는 번호
 * 이 네 가지를 회원자격.사업자상태 에 적습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  return out;
}

/* 공공데이터포털 「국세청_사업자등록정보 진위확인 및 상태조회」.
   주소는 명세를 받은 뒤 맞춥니다 — 지금은 자리만 둡니다 */
const 주소 = 'https://api.odcloud.kr/api/nts-businessman/v1/status';

const cfg = env();
const 번호들 = process.argv.slice(2).filter((x) => /^\d{10}$/.test(x.replace(/-/g, '')));

if (번호들.length === 0) {
  console.error('열 자리 사업자번호를 하나 이상 주세요');
  process.exit(2);
}

if (!cfg.NTS_BIZ_KEY) {
  console.log('NTS_BIZ_KEY 가 없습니다 — 수동 확인으로 둡니다.');
  번호들.forEach((b) => console.log('  ' + b + ' → 수동 확인'));
  process.exit(0);
}

const res = await fetch(주소 + '?serviceKey=' + encodeURIComponent(cfg.NTS_BIZ_KEY), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ b_no: 번호들.map((x) => x.replace(/-/g, '')) }),
});

const 글 = await res.text();

/* ★ 처음 두드릴 때는 **원문을 그대로 찍습니다** (작업지침 2절).
   「몇 건 왔다」만 찍는 진단은 쓸모가 없습니다 */
if (process.argv.includes('--원문') || !res.ok) {
  console.log('HTTP ' + res.status);
  console.log(글.slice(0, 1200));
  try {
    const j = JSON.parse(글);
    console.log('맨 위 항목 이름:', Object.keys(j).join(', '));
    if (Array.isArray(j.data) && j.data[0]) {
      console.log('data[0] 항목 이름:', Object.keys(j.data[0]).join(', '));
    }
  } catch { /* JSON 이 아니면 위 원문으로 봅니다 */ }
  process.exit(res.ok ? 0 : 1);
}

/* 항목 이름은 원문을 보고 맞춥니다. 그 전에는 b_stt 하나만 읽습니다 */
const j = JSON.parse(글);
(j.data ?? []).forEach((r) => {
  const 상태 = r.b_stt || (r.tax_type && r.tax_type.includes('등록되지') ? '없는 번호' : '모름');
  console.log('  ' + r.b_no + ' → ' + 상태);
});
