/* 하루 한 번 요약 — 사람이 봐야 할 것만 모아 보냅니다 (2026-09-28 · 세중님 결정).
 *
 *   node tools/hold-digest.mjs            만들어서 보냅니다
 *   node tools/hold-digest.mjs --보기      보내지 않고 화면에만 (내용 확인용)
 *   node tools/hold-digest.mjs --시간 48   48시간치로
 *   node tools/hold-digest.mjs --잠금분 1  잠금 경보 기준을 1분으로 (시험용)
 *
 * ── 왜 하루 한 번인가 ────────────────────────────────────────
 * 전에는 gas 가 보류함에 들어갈 때마다 메일을 보냈습니다.
 * 한 건마다 오면 쌓여서 아무도 안 봅니다. 세중님이 **하루 한 번 요약**으로 정하셨습니다.
 *
 * ── 보낼 것이 없으면 안 보냅니다 ──────────────────────────────
 * 새 보류 0건 · 회원 화면 멀쩡 · 수집기 다 제때 → **보내지 않습니다.**
 * 빈 메일이 매일 오면 그것도 안 보게 됩니다.
 *
 * ── 보내는 길 ────────────────────────────────────────────────
 * 아래 중 **있는 것 하나**를 씁니다. 없으면 화면에 찍고 끝냅니다
 * (cron 이 stdout 을 메일로 보내 주는 자리에서는 그것만으로도 됩니다).
 *
 *   RESEND_KEY + NOTIFY_EMAIL      https://resend.com 의 열쇠 (무료 한도 있음)
 *   (없으면)                        화면에만 찍습니다
 *
 * ⚠ service_role 열쇠는 쓰지 않습니다. anon 열쇠 + 경로 내부 열쇠로만 갑니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { 열린것견주기 } from './보안_열린것.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'HS3';

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', '.env'),
    path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}

async function rpc(cfg, fn, body) {
  const k = cfg.SUPABASE_ANON_KEY;
  if (!k) throw new Error('SUPABASE_ANON_KEY 가 없습니다');
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

/** 「대상인데 안 긁는 1층 병원」 (2026-10-14 세중님 지시) ──────
 *
 * 강동경희대학교병원을 **우연히** 찾았습니다 — 대학병원인데 어느 출처에도
 * 공고가 0건이었습니다. 같은 구멍을 사람이 알아채기를 기다리지 않고 셉니다.
 *
 * 셈은 DB 함수 `일층병원_구멍()` 한 곳에서 합니다 (지침 6절).
 * 그 함수는 `service_role` 전용이라 위 `rpc()`(anon)로는 못 부릅니다.
 *
 * 못 부르면 **조용히 null** 을 돌려줍니다 — 이 한 줄 때문에 요약 전체가
 * 안 가면 안 됩니다. */
async function 일층구멍(cfg) {
  const k = cfg.SUPABASE_SERVICE_KEY;
  if (!k) return null;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent('일층병원_구멍'), {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  const 다 = await r.json();
  if (!Array.isArray(다)) return null;
  const 사각 = 다.filter((x) => x['상태'] === '사각지대');
  const 갈래별 = {};
  for (const x of 사각) 갈래별[x['갈래']] = (갈래별[x['갈래']] ?? 0) + 1;
  return {
    대상: 다.length,
    사각: 사각.length,
    상급종합: 사각.filter((x) => x['갈래'] === '상급종합'),
    갈래별,
  };
}

/** 잠금을 너무 오래 쥔 수집기 (2026-10-12) ───────────────────
 *
 * 10-12 01:50 클린아이가 일을 **다 끝내고도** kordoc 워커 때문에 5시간 19분
 * 살아 있었습니다. 잠금(`~/lock/cleaneye.lock`)을 쥔 채라 그 뒤 실행
 * **13번이 전부 건너뛰었습니다.** 그런데 **아무 경보도 안 울렸습니다** —
 *   · 「늦은 수집기」 는 DB 의 박동을 봅니다. 그 실행은 박동을 **남겼습니다**
 *     (일을 끝냈으니까요). 그래서 늦은 것으로 안 잡힙니다
 *   · 「새 공고 마름」 은 평일 업무시간 기준이라 새벽에는 안 울립니다
 * 멈춘 것을 세중님이 아침에 `ps` 를 보고 아셨습니다. 그 눈을 여기에 옮깁니다.
 *
 * 이것은 **서버 쪽 신호**라 DB 함수가 아니라 여기서 셉니다.
 * 리눅스가 아니면 조용히 빈 배열을 돌려줍니다. */
function 오래쥔잠금(분기준 = 30) {
  try {
    if (!fs.existsSync('/proc')) return [];
    const 잠금들 = new Map();                      /* pid → 잠금 이름 */
    for (const p of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(p)) continue;
      let fds;
      try { fds = fs.readdirSync('/proc/' + p + '/fd'); } catch { continue; }  /* 남의 것은 못 봅니다 */
      for (const fd of fds) {
        let 가리킴;
        try { 가리킴 = fs.readlinkSync('/proc/' + p + '/fd/' + fd); } catch { continue; }
        const m = /\/lock\/([^/]+)\.lock$/.exec(가리킴);
        if (m) { 잠금들.set(p, m[1]); break; }
      }
    }
    if (!잠금들.size) return [];
    /* 걸린 시간은 `ps` 한 번으로 — pid 로만 봅니다 (지침 8-2: 이름으로 찾으면
       제 명령줄까지 걸립니다) */
    const out = execFileSync('ps', ['-eo', 'pid=,etimes=,args='], { encoding: 'utf8' });
    const 센것 = [];
    for (const 줄 of out.split('\n')) {
      const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(줄);
      if (!m) continue;
      const [, pid, 초, 명령] = m;
      if (!잠금들.has(pid)) continue;
      if (Number(초) < 분기준 * 60) continue;
      센것.push({ 수집기: 잠금들.get(pid), pid, 분: Math.round(Number(초) / 60), 명령: 명령.slice(0, 70) });
    }
    /* 한 수집기에 셸·node 둘이 같이 걸립니다 — 오래된 쪽 하나만 */
    const 하나씩 = new Map();
    for (const x of 센것.sort((a, b) => b.분 - a.분)) if (!하나씩.has(x.수집기)) 하나씩.set(x.수집기, x);
    return [...하나씩.values()];
  } catch {
    return [];                                     /* 못 세면 조용히 넘어갑니다 */
  }
}

/** 사람이 읽을 글로 */
function 글로(d, 관리자주소, 잠금, 보안, 구멍) {
  const 줄 = [];

  /* ★ 2026-10-14 — 「대상인데 안 긁는 1층 병원」 (세중님 지시).
     경보가 아니라 **늘 보이는 한 줄**입니다 — 숫자가 늘면 눈에 띕니다 */
  if (구멍) {
    줄.push('· 대상인데 안 긁는 1층 병원 ' + 구멍.사각 + '곳'
      + ' (상급종합 ' + 구멍.상급종합.length + ') / 대상 ' + 구멍.대상 + '곳');
    if (구멍.상급종합.length) {
      줄.push('   상급종합 — ' + 구멍.상급종합.map((x) => x['기관']).join(' · '));
    }
    줄.push('   갈래별 — ' + Object.entries(구멍.갈래별)
      .sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · '));
    줄.push('');
  }

  /* ★ 2026-10-12 — 허용 목록 밖에 열린 창구 (세중님 지시).
     점검 자체는 GitHub 워크플로 anon-check.yml 이 날마다 돌며 **빌드를 떨굽니다.**
     여기는 그 위에 얹는 눈입니다 — 워크플로가 멈춰도 메일로는 보입니다.
     셈은 tools/보안_열린것.mjs 한 곳에서 합니다 (지침 6절). */
  if (보안 && 보안.밖합) {
    줄.push('██ 허용 목록 밖에 열린 창구가 있습니다 ██');
    for (const 칸 of ['비로그인', '로그인']) {
      const s = 보안[칸];
      if (!s || !s.밖.length) continue;
      줄.push('   ' + 칸 + ' — ' + s.밖.length + '건');
      s.밖.slice(0, 8).forEach((n) => 줄.push('      ' + n));
      if (s.밖.length > 8) 줄.push('      … 그밖 ' + (s.밖.length - 8) + '건');
    }
    줄.push('   ※ 일부러 연 것이면 tools/공개허용목록.json 에 **왜** 와 함께 적으십시오.');
    줄.push('     인수가 바뀌면 새 함수가 되어 권한이 PUBLIC 으로 돌아갑니다 (지침 6-2)');
    줄.push('');
  }
  if (보안 && (보안.못봄 || []).length) {
    줄.push('· 보안 점검을 못 한 칸 — ' + 보안.못봄.join(' / '));
    줄.push('');
  }
  const 보류 = d['새 보류'] || [];
  const 샘 = d['회원 화면'] || {};
  const 늦음 = d['늦은 수집기'] || [];

  if ((잠금 || []).length) {
    줄.push('██ 수집기가 잠금을 오래 쥐고 있습니다 ██');
    잠금.forEach((x) => 줄.push('   ' + x.수집기 + ' — ' + x.분 + '분째 (pid ' + x.pid + ') ' + x.명령));
    줄.push('   ※ 그 수집기의 다음 실행이 **전부 건너뜁니다.** 로그 끝줄이 이미');
    줄.push('     끝난 꼴이면 멈춰 선 것입니다 — ps 로 보고 pid 로 죽이십시오');
    줄.push('');
  }
  if (늦음.length) {
    줄.push('██ 수집기가 제때 안 돌았습니다 ██');
    늦음.forEach((x) => 줄.push('   ' + x.경로 + ' — ' + x.왜 + ' (' + x.몇시간째 + '시간째)'));
    줄.push('');
  }
  const 기준 = d["기준값"] || {};
  if (기준["넘었나"]) {
    줄.push("██ 회원 화면 공고 수가 기준에서 벗어났습니다 ██");
    줄.push("   지금 " + 기준["지금"] + "건 · 기준 " + 기준["기준"] + "건 (" + 기준["몇퍼센트"] + "%)");
    줄.push("   기준을 정한 날 " + 기준["정한날"] + " — " + (기준["까닭"] || ""));
    줄.push("   ※ 10% 넘게 바뀌면 원인부터 봅니다. 맞는 변화면 기준을 새로 정하십시오");
    줄.push("");
  }
  const 한도 = d["하루 한도"] || {};
  const 넘은것 = (한도["줄"] || []).filter((x) => x["빨간줄"]);
  if (넘은것.length) {
    줄.push("██ 공공데이터 하루 한도가 얼마 안 남았습니다 ██");
    넘은것.forEach((x) => 줄.push("   " + x["서비스"] + " — " + x["쓴양"] + "/" + x["한도"]
      + " (" + x["몇퍼센트"] + "%) · " + x["본때"] + " 기준"));
    줄.push("   ※ 쓴 양은 신청 건마다 하나입니다. 남이 써도 우리 몫이 줄어듭니다");
    줄.push("");
  }
  /* ★ 2026-10-11 — 「평일인데 새 공고가 안 들어온다」.
     주말·공휴일 시간은 안 세므로, 금요일 밤에 멈추면 월요일 낮에 울립니다 */
  const 마름 = d['공고마름'] || {};
  if (마름['마름']) {
    줄.push('██ 평일인데 새 공고가 안 들어옵니다 ██');
    줄.push('   마지막 새 공고 ' + String(마름['마지막새공고'] || '').slice(0, 16)
      + ' — ' + 마름['몇시간째'] + '시간째');
    줄.push('   그 사이 평일 업무시간(09~21시) ' + 마름['업무시간'] + '시간 지났습니다 (기준 ' + 마름['기준'] + '시간)');
    줄.push('   ※ 주말·공휴일은 안 셉니다. 수집기가 ok 로 돌면서 0건을 담을 수 있습니다');
    줄.push('');
  }
  if (d['PDF 0자']) {
    줄.push('██ PDF 를 글자로 못 바꾼 것이 있습니다 ██');
    줄.push('   **두 번 다 0자** ' + d['PDF 0자'] + '건 — 관리자 화면 「PDF 0자」 에 원문이 있습니다');
    /* ★ 2026-10-11 — 「한 번 0자였다가 다시 읽힌 것」은 알려만 줍니다.
       전체 112건 중 93건(83%)이 그랬습니다. 그걸 빨간 줄로 세우면
       아무도 빨간 줄을 안 믿게 됩니다 (교육 수집기 헛경보와 같은 결) */
    if (d['PDF 0자 다시읽힘']) {
      줄.push('   (한 번 0자였다가 다시 읽힌 것 ' + d['PDF 0자 다시읽힘'] + '건 — 탈은 아닙니다)');
    }
    줄.push('');
  } else if (d['PDF 0자 다시읽힘']) {
    줄.push('첫 번째에 0자였다가 다시 읽힌 PDF ' + d['PDF 0자 다시읽힘'] + '건 (탈은 아닙니다)');
    줄.push('');
  }
  /* ★ 2026-10-07 — 회원이 보낸 「공고 오류 신고」. 관리자 화면 「신고」 아래쪽입니다 */
  if (d['오류 신고']) {
    줄.push('██ 회원이 공고 오류를 신고했습니다 ██');
    줄.push('   처리 안 한 신고 ' + d['오류 신고'] + '건 — 관리자 화면 「신고」 에 사유가 있습니다');
    줄.push('');
  }
  if (샘['샘']) {
    줄.push('██ 회원 화면에 있으면 안 될 공고가 있습니다 ██');
    줄.push('   마감 지남 ' + 샘['마감 지남'] + '건 (물리치료사 ' + 샘['마감 지남 · 물리치료사']
      + ' · 작업치료사 ' + 샘['마감 지남 · 작업치료사'] + ')');
    줄.push('   신호 없이 30일 넘음 ' + 샘['신호 없이 30일 넘음'] + '건 · 정찰이 보는 중 ' + 샘['정찰이 살아있다고 보는 중'] + '건');
    줄.push('');
  }
  줄.push('사람이 봐야 할 새 공고 ' + d['새 보류 건수'] + '건 (최근 ' + d['몇시간치'] + '시간)');
  줄.push('');
  보류.forEach((x, i) => {
    줄.push((i + 1) + '. [' + (x.기관 || '') + '] ' + (x.제목 || ''));
    if (x.까닭) 줄.push('   왜 보류 — ' + x.까닭);
    if (x.마감) 줄.push('   마감 ' + x.마감);
    줄.push('   ' + (x.주소 || ''));
    줄.push('');
  });
  줄.push('─────────────────────────────');
  줄.push('올릴지 말지는 관리자 화면에서 정합니다 — ' + 관리자주소);
  줄.push('회원 화면 ' + (샘['회원 화면 전체'] ?? '?') + '건 · 마감 지난 것 ' + (샘['마감 지남'] ?? '?') + '건');
  return 줄.join('\n');
}

/* ── 본체 ── */
const argv = process.argv.slice(2);
const 보기만 = argv.includes('--보기');
const 시간 = Number(argv.includes('--시간') ? argv[argv.indexOf('--시간') + 1] : 24) || 24;
const cfg = env();
if (!cfg.COLLECT_KEY_HS3) { console.error('COLLECT_KEY_HS3 가 없습니다'); process.exit(1); }

const d = await rpc(cfg, 'hold_digest', {
  p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE, p_hours: 시간,
});

/* ★ 잠금 경보는 **DB 가 모르는 신호**라 여기서 셉니다. 그래서 「보낼것있나」
   보다 **먼저** 세고, 이것만 있어도 보냅니다. 전에는 아래 early return 때문에
   10-12 처럼 수집기가 5시간 19분 멈춰도 메일이 안 갔습니다 */
const 잠금분 = Number(argv.includes('--잠금분') ? argv[argv.indexOf('--잠금분') + 1] : 30) || 30;
const 잠금 = 오래쥔잠금(잠금분);

/* 허용 목록 밖에 열린 창구 — 못 봐도 요약은 보냅니다 (빈 값으로 둡니다) */
let 보안 = null;
try { 보안 = await 열린것견주기(cfg); }
catch (e) { console.error('보안 점검을 못 했습니다 — ' + String(e.message || e).slice(0, 120)); }

/* 「대상인데 안 긁는 1층 병원」 — 못 세도 요약은 보냅니다 */
let 구멍 = null;
try { 구멍 = await 일층구멍(cfg); }
catch (e) { console.error('1층 병원 구멍을 못 셌습니다 — ' + String(e.message || e).slice(0, 120)); }

if (!d['보낼것있나'] && !잠금.length && !(보안 && 보안.밖합)) {
  console.log('보낼 것이 없습니다 — 새 보류 0건 · 회원 화면 멀쩡 · 수집기 다 제때 · PDF 0자 0건 · 오래 쥔 잠금 0');
  process.exit(0);
}

const 관리자 = cfg.ADMIN_URL || 'https://potjob-web.vercel.app/admin/jobs';
const 본문 = 글로(d, 관리자, 잠금, 보안, 구멍);
const 제목 = '[피오티잡] 확인할 공고 ' + d['새 보류 건수'] + '건'
  + ((보안 && 보안.밖합) ? ' · ⚠ 허용 목록 밖 ' + 보안.밖합 + '건' : '')
  + (잠금.length ? ' · ⚠ 수집기 잠금 ' + 잠금.map((x) => x.수집기 + ' ' + x.분 + '분').join('·') : '')
  + (d['PDF 0자'] ? ' · ⚠ PDF 0자 ' + d['PDF 0자'] + '건' : '')
  + (((d['하루 한도'] || {})['넘은것'] || 0) ? ' · ⚠ 한도 임박' : '')
  + (((d['기준값'] || {})['넘었나']) ? ' · ⚠ 공고 수 ' + (d['기준값'] || {})['몇퍼센트'] + '%' : '')
  + ((d['늦은 수집기'] || []).length ? ' · ⚠ 수집기 멈춤' : '')
  + (((d['공고마름'] || {})['마름']) ? ' · ⚠ 새 공고 마름' : '')
  + ((d['회원 화면'] || {})['샘'] ? ' · ⚠ 회원 화면에 샘' : '')
  + (d['오류 신고'] ? ' · ⚠ 오류 신고 ' + d['오류 신고'] + '건' : '');

if (보기만) {
  console.log('제목: ' + 제목 + '\n');
  console.log(본문);
  process.exit(0);
}

/* Resend 가 있으면 보내고, 없으면 화면에 찍습니다.
   cron 이 stdout 을 메일로 넘겨 주는 자리에서는 찍는 것만으로도 됩니다 */
if (cfg.RESEND_KEY && cfg.NOTIFY_EMAIL) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: cfg.MAIL_FROM || 'potjob <onboarding@resend.dev>',
      to: [cfg.NOTIFY_EMAIL], subject: 제목, text: 본문,
    }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('메일 못 보냄 · HTTP ' + r.status + ' · ' + t.slice(0, 300)); process.exit(1); }
  /* ★ 2026-10-11 — **id 를 남깁니다.** 「Resend 가 받아들였다」와 「도착했다」는
     다릅니다. id 가 있으면 나중에 상태를 조회할 수 있습니다 (지침 12절) */
  let id = '';
  try { id = (JSON.parse(t) || {}).id || ''; } catch { /* 모양이 바뀌어도 넘어갑니다 */ }
  console.log('보냈습니다 — ' + 제목);
  console.log('   Resend id ' + (id || '(응답에 id 가 없습니다: ' + t.slice(0, 120) + ')'));
} else {
  console.log('※ RESEND_KEY · NOTIFY_EMAIL 이 없어 화면에만 찍습니다\n');
  console.log('제목: ' + 제목 + '\n');
  console.log(본문);
}
