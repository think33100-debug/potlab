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
/* ★ 2026-10-26 세중님 3번 — DB·저장소 조회는 **공용 받아보기()** 로 합니다.
   지나가는 401(`PGRST303 "JWT issued at future"`)·408·429·5xx·연결 탈을 1·2초 뒤 다시
   두드립니다 (404·403 은 바로 올립니다). 최근 로그에 그 401 이 **28번** 났고,
   첨부 다리는 그 한 번에 죽었습니다 (10/26 05:30). 자는 tools/쪽나눠받기.mjs 한 자리입니다. */
import { 받아보기 } from './쪽나눠받기.mjs';
import { 새는것, 한줄 as 새는한줄 } from './보류함새는것.mjs';
/* ★ 2026-10-27 세중님 3번 — 「승인 기다리는 것」 절. 자율 운행이라 승인 자리에서
   멈추지 않고 문서에 쌓으므로, **메일에 보이지 않으면 영영 안 결정됩니다** */
import { 메일줄 as 승인줄 } from './승인대기읽기.mjs';
/* ★ 2026-10-28 세중님 1번 — 「지난 교육 보임 N」 한 줄. 가르는 규칙은
   **web 과 같은 파일**을 들여다 씁니다 (지침 6절 — 기준은 한 자리) */
import { 교육지났나, 지난까닭 } from '../web/lib/edu-state.ts';   /* 2026-10-22 세중님 1번 */
/* ★ 2026-10-23 — 「크론 N줄 다 도나」를 **손으로** 적고 있었습니다
   (docs/동결까지_남은일_1023.md 2절 — 날마다 한 줄). 156줄을 눈으로 보면
   빠뜨립니다. 재기() 는 crontab 을 못 읽으면 null 을 주고, 한줄() 은 null 에
   빈 배열을 줍니다 — **메일이 이것 때문에 죽지 않습니다** */
import { 재기 as 크론재기, 한줄 as 크론한줄 } from './크론다도나.mjs';
/* ★ 2026-10-23 — 「면접일정 안내」 같은 **결과·안내 공고**가 회원 화면에 있나.
   거르기는 **담을 때 한 번**만 돌고, 나중에 제목이 온전해져도 다시 안 봅니다
   (HS102260084 이 그렇게 들어왔습니다). 그래서 **지금 제목**으로 다시 댑니다.
   크론 줄은 더하지 않습니다 (세중님) — 아침 메일 한 줄로만 봅니다 */
import { HS_SKIP_RE } from './gas-rules.mjs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { 열린것견주기 } from './보안_열린것.mjs';
import { 오늘셈 as 고용24셈, 오늘막힘 as 고용24막힘 } from './고용24한도.mjs';
import { 그림OCR준비됐나 } from './그림OCR점검.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'HS3';

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', '.env'),
    path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      /* ★ 2026-10-24 — **따옴표를 벗깁니다.** 크론은 `set -a && . ./.env` 로 읽어서
         셸이 벗겨 주는데, 손으로 `node tools/hold-digest.mjs --보기` 를 돌리면
         `'https://…'` 가 그대로 들어와 `Invalid URL` 로 죽었습니다 (미리보기가 안 됨) */
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
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
  const r = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

/** 결과·안내 공고가 회원 화면에 있나 — **지금 제목**을 HS_SKIP_RE 에 다시 댑니다
 *  (2026-10-23 · tools/결과공고다시거르기.mjs 와 같은 자) */
async function 결과공고세기(cfg) {
  const k = cfg.SUPABASE_SERVICE_KEY;
  if (!k) return null;
  const H = { apikey: k, Authorization: 'Bearer ' + k };
  const 받 = async (길) => {
    const out = [];
    for (let off = 0; ; off += 100) {
      const 이음 = 길.includes('?') ? '&' : '?';
      const r = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/' + 길 + 이음
        + 'order=id&limit=100&offset=' + off, { headers: H });
      if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 120));
      const a = await r.json();
      out.push(...a);
      if (a.length < 100) break;
      if (off > 40000) break;
    }
    return out;
  };
  try {
    const 원문 = new Map((await 받('job_posts_pub?select=id,' + encodeURIComponent('원문제목')))
      .map((x) => [x.id, x['원문제목'] || '']));
    const 다 = await 받('job_posts?select=id,org_name,title,'
      + encodeURIComponent('보여줄제목'));
    const 걸린것 = [];
    for (const x of 다) {
      if (!원문.has(x.id)) continue;
      const 제목 = [원문.get(x.id) || '', x['보여줄제목'] || '', x.title || '']
        .map(String).sort((a, b) => b.length - a.length)[0];
      const m = 제목.match(HS_SKIP_RE);
      if (m) 걸린것.push({ id: x.id, 기관: x.org_name || '', 걸린말: m[0], 제목 });
    }
    return { 분모: 원문.size, 걸린것 };
  } catch { return null; }
}

/* 공고가 기관에 붙었나 (2026-10-24 세중님 M4) — 번호 % · 이름 % · 없음 · 의심.
   「번호로」가 1순위입니다. 이름으로만 붙은 것은 **동명 기관을 한 묶음으로 볼 수**
   있어서, 의심 건은 회원 화면에 기관 정보를 붙이지 않습니다 (docs/매칭규칙_1024.md) */
async function 매칭재기(cfg) {
  try {
    const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };
    const 받아 = async (길) => {
      const r = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/' + 길, { headers: H });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    };
    /* ★ 쪽을 **차례를 붙여** 넘깁니다. 처음에 limit 만 크게 줬더니 창구가 100줄로
       자르고, 두 쪽이 서로 어긋나 분모가 **1** 로 나왔습니다 (지침 8-20 ③) */
    const 다받아 = async (길) => {
      const out = [];
      /* ★ 창구가 **100줄에서 끊습니다**(max-rows). 1000 으로 넘기면 첫 쪽만 받고
         끝난 줄 알아 분모가 쪼그라듭니다 — 2026-10-24 에 분모가 1 → 0 이 됐습니다 */
      for (let off = 0; ; off += 100) {
        const a = await 받아(길 + '&order=id.asc&limit=100&offset=' + off);
        out.push(...a);
        if (a.length < 100) break;
        if (off > 40000) break;
      }
      return out;
    };
    const 보임 = new Set((await 다받아('job_posts_pub?select=id')).map((x) => x.id));
    const 다 = await 다받아('job_posts?select=id,' + encodeURIComponent('기관번호') + ',sido');
    const 볼것 = 다.filter((x) => 보임.has(x.id));
    const 번호 = 볼것.filter((x) => String(x['기관번호'] || '').startsWith('HIRA:')).length;
    const 이름 = 볼것.filter((x) => String(x['기관번호'] || '').startsWith('NAME:')).length;
    const 없음 = 볼것.filter((x) => !x['기관번호']).length;
    /* 의심 = 한 NAME: 묶음에 공고 시도가 둘 이상 (가장 센 신호 하나만 아침에 찍습니다) */
    const 묶음 = new Map();
    for (const x of 다.filter((y) => String(y['기관번호'] || '').startsWith('NAME:'))) {
      const k = x['기관번호'];
      if (!묶음.has(k)) 묶음.set(k, new Set());
      if (x.sido) 묶음.get(k).add(x.sido);
    }
    const 의심 = [...묶음.values()].filter((s2) => s2.size > 1).length;
    return { 분모: 볼것.length, 번호, 이름, 없음, 의심 };
  } catch { return null; }
}

/* 긁기 한 줄 (2026-10-24 세중님 D2 · 담기 시작한 뒤부터) — 꼴·곳·보류함·채움률 */
async function 긁기재기(cfg) {
  try {
    const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };
    const 받아 = async (길) => {
      const r = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/' + 길, { headers: H });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    };
    /* 창구가 100줄에서 끊습니다 — 쪽을 넘깁니다 (지침 8-20 ③) */
    const 다 = [];
    for (let off = 0; ; off += 100) {
      const a = await 받아('job_posts?select=id,hold,hidden,hidden_why,job_group,apply_to,'
        + encodeURIComponent('기관번호') + '&source=eq.HS4&order=id.asc&limit=100&offset=' + off);
      다.push(...a);
      if (a.length < 100) break;
      if (off > 10000) break;
    }
    if (!다.length) return null;
    /* ★ 2026-10-24 세중님 3번 — 직군은 **우리 직군 후보 중 몇**인지로 봅니다.
       29건 가운데 21건은 **남의 직군**(영양사·방사선사·전문의…)이라 직군이 비는 것이
       맞습니다. 그것을 분모에 넣으면 「17%」로 보여 일을 잘못 고릅니다.
       첨부가 있는데 직군이 빈 것은 **첨부 대기**입니다 (공고문을 읽으면 채워집니다) */
    const 첨 = new Set();
    for (let off = 0; ; off += 100) {
      const a = await 받아('job_attachments?select=job_id&order=job_id.asc&limit=100&offset=' + off
        + '&job_id=in.(' + 다.map((x) => x.id).join(',') + ')');
      for (const r of a) 첨.add(r.job_id);
      if (a.length < 100) break;
      if (off > 5000) break;
    }
    const 직군 = 다.filter((x) => x.job_group).length;
    const 첨부대기 = 다.filter((x) => !x.job_group && 첨.has(x.id)).length;
    const 남의직군 = 다.filter((x) => !x.job_group && !첨.has(x.id)).length;
    /* ★ 2026-10-24 — 「보류함 밖」을 경고로 쓰면 안 됩니다. 마감이 지난 보류함 공고는
       보류함 마감지남 정리(20분 크론)가 **숨김**으로 보냅니다 — 그것이 설계입니다.
       봐야 할 것은 **회원 화면 수**입니다 (0 이어야 합니다) */
    return { 공고: 다.length,
      보류함: 다.filter((x) => x.hold).length,
      숨김: 다.filter((x) => x.hidden).length,
      /* ★ 2026-10-24 밤 — 숨긴 까닭을 **갈라** 찍습니다. 「마감 지남」으로만 적으면
         HS3 와 겹쳐 숨긴 19건이 마감 지난 것처럼 보입니다 (까닭을 틀리게 적는 것입니다) */
      겹침숨김: 다.filter((x) => x.hidden && /같은 공고/.test(x.hidden_why || '')).length,
      회원화면: 다.filter((x) => !x.hold && !x.hidden).length,
      직군, 첨부대기, 남의직군, 후보: 직군 + 첨부대기,
      마감: 다.filter((x) => x.apply_to).length,
      기관: 다.filter((x) => x['기관번호']).length };
  } catch { return null; }
}

/** 아침 메일에 넣을 줄 */
/* ★ 2026-10-26 세중님 1번 ⓒ — **서버 시계 차이 한 줄.**
   10/26 05:30 에 Supabase 가 `PGRST303 "JWT issued at future"` 로 401 을 줘서 알리오 다리가
   죽었습니다. 그때 **우리 시계는 완벽했습니다** (NTP 켜짐 · 어긋남 0.0000004초 ·
   외부 세 곳 HTTP Date 와 같은 초). 그래도 「시계가 어긋나면 바로 보이게」 한 줄을 둡니다 —
   어긋나기 시작하면 그날 아침에 드러납니다.
   재는 법 — 서버의 **chronyc tracking**(NTP 와의 어긋남)을 읽습니다. 바깥을 두드리지 않습니다 */
function 시계재기() {
  try {
    const t = execFileSync('chronyc', ['tracking'], { encoding: 'utf8', timeout: 5000 });
    const 어긋남 = (t.match(/System time\s*:\s*([\d.]+) seconds (slow|fast)/) || []);
    const 맞춤 = /Leap status\s*:\s*Normal/.test(t);
    if (!어긋남[1]) return null;
    const 초 = Number(어긋남[1]) * (어긋남[2] === 'fast' ? 1 : -1);
    return { 초, 맞춤, 어디서: 'chronyc' };
  } catch { /* chrony 가 없으면 timedatectl */ }
  try {
    const t = execFileSync('timedatectl', ['show'], { encoding: 'utf8', timeout: 5000 });
    return { 초: null, 맞춤: /NTPSynchronized=yes/.test(t), 어디서: 'timedatectl' };
  } catch { return null; }
}
function 시계줄(c) {
  if (!c) return [];
  const 큼 = c.초 != null && Math.abs(c.초) >= 5;
  const 값 = c.초 == null ? '(못 쟀습니다)'
    : (c.초 >= 0 ? '+' : '') + (Math.round(c.초 * 1000) / 1000) + '초';
  return ['   서버 시계      NTP 와 ' + 값 + ' 어긋남 · 맞춰짐 ' + (c.맞춤 ? '예' : '**아니오**')
    + (큼 || !c.맞춤 ? '  ★ **보십시오 — PGRST303(JWT issued at future) 이 그 꼴로 납니다**' : '  (괜찮습니다)')
    + '   (' + c.어디서 + ')'];
}

function 긁기줄(g) {
  if (!g || !g.공고) return [];
  const 퍼 = (n) => Math.round((100 * n) / g.공고) + '%';
  return ['   긁기(HS4)       공고 ' + g.공고 + '건 · 보류함 ' + g.보류함 + '건'
    + ' · **직군 ' + g.직군 + '/' + g.후보 + '** (우리 직군 후보 중)'
    + ' · 남의 직군 ' + g.남의직군 + ' · 첨부 대기 ' + g.첨부대기
    + ' · 마감 ' + 퍼(g.마감) + ' · 기관 ' + 퍼(g.기관)
    + ' · 숨김 ' + g.숨김 + (g.겹침숨김 ? '(HS3 겹침 ' + g.겹침숨김 + ' · 마감 지남 '
      + (g.숨김 - g.겹침숨김) + ')' : '(마감 지남)')
    + (g.회원화면 ? '  ★ **회원 화면에 ' + g.회원화면 + '건 있습니다**' : '  (회원 화면 0 ✓)')];
}

/** 아침 메일에 넣을 줄 */
function 매칭줄(m) {
  if (!m || !m.분모) return [];
  const 퍼 = (n) => Math.round((100 * n) / m.분모) + '%';
  return ['   기관 매칭        번호로 ' + 퍼(m.번호) + ' (' + m.번호 + '건)'
    + ' · 이름으로 ' + 퍼(m.이름) + ' (' + m.이름 + '건)'
    + ' · 없음 ' + m.없음 + '건 · **의심 ' + m.의심 + '묶음**'
    + (m.없음 || m.의심 ? '   (docs/손확인_매핑_1024.md)' : '  ✓')];
}

/** 아침 메일에 넣을 줄 */
function 결과공고줄(r) {
  if (!r) return [];
  if (!r.걸린것.length) {
    return ['   결과·안내 공고      0건  ✓   (회원 화면 ' + r.분모 + '건을 제목으로 다시 댔습니다)'];
  }
  const 줄 = ['   ★ 결과·안내 공고가 회원 화면에 **' + r.걸린것.length + '건** 있습니다'
    + '   (마감 지난 공고·결과 발표 공고는 회원에게 안 보입니다 — CLAUDE.md 15절)'];
  for (const x of r.걸린것.slice(0, 5)) {
    줄.push('      ' + x.id + ' 「' + x.걸린말 + '」 ' + String(x.기관).slice(0, 12)
      + ' — ' + String(x.제목).slice(0, 44));
  }
  줄.push('      → 관리자 화면에서 「숨기기」 (node tools/결과공고다시거르기.mjs 로 목록 전체)');
  return 줄;
}

/** 마스터 계정이 **지금 어느 역할**인가 (2026-10-23 세중님 3번) ────
 *
 * 2026-10-23 에 세중님이 관리자 화면에 못 들어가셨습니다. 까닭은 계정이
 * **페르소나(작업치료사) 상태**라 `is_admin()` 이 거짓이었던 것입니다 —
 *   is_admin() = admins 에 끈때 없는 줄 **AND** 마스터페르소나.지금역할 = '관리자'
 * 페르소나 중에는 관리자 힘이 꺼지고 **90군데가 한꺼번에 막힙니다**
 * (web/components/persona-bar.tsx 주석). 그런데 **어디에도 안 적혀** 있어서
 * 「왜 안 들어가지」를 사람이 짐작해야 했습니다.
 *
 * 그래서 아침 메일 맨 위에 적습니다. **읽기만** 합니다 (표 한 줄).
 * 메일 주소는 **적지 않습니다** — 역할만 봅니다 (세중님 지시).
 */
async function 지금역할(cfg) {
  const k = cfg.SUPABASE_SERVICE_KEY;
  if (!k) return null;
  try {
    const r = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/'
      + encodeURIComponent('마스터페르소나') + '?select=' + encodeURIComponent('지금역할,바뀐때'),
    { headers: { apikey: k, Authorization: 'Bearer ' + k } });
    if (!r.ok) return null;
    const a = await r.json();
    if (!Array.isArray(a) || !a.length) return null;
    return a.map((x) => ({ 역할: x['지금역할'] || '(빈칸)', 바뀐때: x['바뀐때'] || null }));
  } catch { return null; }
}

/** 아침 메일에 넣을 줄 — 관리자일 때도 적습니다 (평소 모습을 알아야 이상한 날이 보입니다) */
function 역할줄(목록) {
  if (!목록 || !목록.length) return [];
  const 줄 = [];
  for (const x of 목록) {
    const 언제 = x.바뀐때
      ? new Date(x.바뀐때).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16)
      : '(모름)';
    if (x.역할 === '관리자') {
      줄.push('■ 마스터 계정 지금 역할: **관리자**  ✓ (바뀐 때 ' + 언제 + ')');
    } else {
      줄.push('■ 마스터 계정 지금 역할: **' + x.역할 + '**  ← ★ 관리자 화면에 **못 들어갑니다**'
        + ' (바뀐 때 ' + 언제 + ')');
      줄.push('   되돌리는 길 — 아무 쪽 맨 아래 빨간 띠 「운영진 · ' + x.역할 + '」 → 「관리자」');
      줄.push('   까닭 — is_admin() 이 「마스터페르소나.지금역할 <> 관리자」면 거짓입니다'
        + ' (docs/관리자화면_들어가기.md)');
    }
  }
  줄.push('');
  return 줄;
}

/** 「대상인데 안 긁는 1층 병원」 (2026-10-14 세중님 지시) ──────
 *
 * 강동경희대학교병원을 **우연히** 찾았습니다 — 대학병원인데 어느 출처에도
 * 공고가 0건이었습니다. 같은 구멍을 사람이 알아채기를 기다리지 않고 셉니다.
 *
 * 셈은 DB 함수 `일층병원_구멍셈()` 한 곳에서 합니다 (지침 6절).
 * 그 함수는 `service_role` 전용이라 위 `rpc()`(anon)로는 못 부릅니다.
 *
 * ★ 2026-10-14 — 처음에는 목록 함수 `일층병원_구멍()` 을 그대로 불러
 *   JS 에서 셌습니다. 그런데 **PostgREST 가 100줄에서 잘라서**
 *   「대상 100곳 · 사각지대 100곳」 으로 찍혔습니다 (실제 549 · 236).
 *   쪽을 넘기는 대신 **셈을 DB 에서 끝내는** 창구를 따로 만들었습니다.
 *   목록이 필요하면 `일층병원_구멍()` 을 씁니다.
 *
 * 못 부르면 **조용히 null** 을 돌려줍니다 — 이 한 줄 때문에 요약 전체가
 * 안 가면 안 됩니다. */
/** 네숫자() — **5분 간격으로 세 번**까지 다시 두드립니다 (2026-10-22 세중님 5번)
 *
 *  2026-10-22 05:55 에 `HTTP 500 · {"code":"57014","message":"canceling statement
 *  due to statement timeout"}` 으로 못 쟀습니다. 그때 밤 바퀴가 DB 를 때리던
 *  중이었고, 한가할 때 다시 두드리니 **7.6초에 200** 이었습니다.
 *  한 번 실패로 아침 메일의 숫자가 비면 그날 판단 근거가 없어집니다.
 *
 *  ★ 재시도는 **읽기 한 번**입니다 (rpc 는 읽기 전용). 메일을 막지 않게
 *    세 번 다 실패하면 null 을 돌려주고 메일은 그대로 나갑니다.
 */
async function 네숫자받기(cfg, 몇번 = 3, 쉼ms = 5 * 60 * 1000) {
  const k = cfg.SUPABASE_SERVICE_KEY;
  if (!k) return null;
  let 끝탈 = null;
  for (let i = 1; i <= 몇번; i++) {
    try {
      const t0 = Date.now();
      const r = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent('네숫자'), {
        method: 'POST',
        headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
        body: '{}',
      }, 1);
      if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      if (i > 1) console.log('  네숫자 — ' + i + '번째에 받았습니다 (' + Math.round((Date.now() - t0) / 100) / 10 + '초)');
      return (j && typeof j === 'object') ? j : null;
    } catch (e) {
      끝탈 = e;
      console.error('  네숫자 ' + i + '/' + 몇번 + ' 탈 — ' + String((e && e.message) || e).slice(0, 120));
      if (i < 몇번) await new Promise((y) => setTimeout(y, 쉼ms));
    }
  }
  console.error('  네숫자 — ' + 몇번 + '번 다 실패했습니다. 숫자 없이 메일을 보냅니다');
  if (끝탈) console.error('     마지막 탈 — ' + String(끝탈.message || 끝탈).slice(0, 200));
  return null;
}

/** 지난 교육이 회원 화면에 몇 건 보이나 (2026-10-28 세중님 1번)
 *  규칙 — 끝 → 시작 → 담은 날 +30일 · 셋 다 모르면 안 내립니다 (web/lib/edu-state.ts)
 *  ★ 화면은 그 규칙으로 **걸러서 그립니다.** 이 줄은 **창구가 아직 내려 주는 수**를
 *    셉니다 — 숫자가 0 이 아니어도 회원에게 보이지는 않습니다. 창구까지 고치면 0 이 됩니다 */
async function 지난교육줄(cfg) {
  const k = cfg.SUPABASE_SERVICE_KEY;
  if (!k) return [];
  try {
    const { 모두받기 } = await import('./쪽나눠받기.mjs');
    const 칸 = ['번호', '시작', '끝', '올린날'].join(',');
    const 줄 = await 모두받기(cfg.SUPABASE_URL + '/rest/v1/' + encodeURIComponent('교육')
      + '?select=' + 칸, { apikey: k, Authorization: 'Bearer ' + k },
      { 차례: '번호' });   /* 차례붙이기() 가 알아서 encode 합니다 */
    const 오늘 = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const 지난것 = 줄.filter((e) => 교육지났나(e, 오늘));
    const 갈래 = {};
    for (const e of 지난것) {
      const 왜 = 지난까닭(e, 오늘) || '모름';
      갈래[왜] = (갈래[왜] || 0) + 1;
    }
    const 꼬리 = Object.entries(갈래).map(([k2, v]) => k2 + ' ' + v).join(' · ');
    return ['· 지난 교육이 창구에 남은 수 ' + 지난것.length + ' / 교육 ' + 줄.length + '건'
      + (꼬리 ? '  (' + 꼬리 + ')' : '')
      + '   ← 화면은 걸러 그립니다 (lib/edu-state.ts)'];
  } catch (e) {
    return ['· 지난 교육 셈 — 못 쟀습니다 (' + String(e.message || e).slice(0, 60) + ')'];
  }
}

/** 아침 짧은 글 — 조용한 날에도 보냅니다 (2026-10-14 세중님 결정) ──
 *
 * 「08:00 은 조용한 날에도 짧게 보냄(네 숫자 · 멈춘 수집기 ·
 *   안 긁는 1층 병원 N곳). 15:00 은 지금처럼 문제 있을 때만.」
 *
 * 숫자는 DB 함수 `네숫자()` 한 자리에서 옵니다 (지침 6절).
 * ④ 와 ①의 경쟁사 기준은 아직 못 재므로 **「아직 못 잼」 이라고 적습니다** —
 * 0 이나 100% 로 적으면 거짓이 됩니다 (지침 15절). */
/* ★ 2026-10-19 세중님 2번 — 고용24 하루 한도가 **신청 화면에 안 적혀 있습니다.**
   그래서 한도를 짐작하지 않고 **호출 수를 세어 한 줄**로 적습니다. 목록·상세를
   따로 적는 것이 세중님 조건입니다 (어느 쪽이 늘었는지 봐야 하니까).
   ★ 아침 숫자(조용한 아침)와 보류함 요약 **둘 다**에 찍습니다 — 보류 공고가
     있는 날에는 아침글() 이 안 돌아서, 그쪽만 고치면 안 보입니다 */
function 고용24줄() {
  const 줄 = [];
  const 고 = 고용24셈();
  const 어 = 고.어제;
  줄.push('고용24 호출    오늘 목록 ' + 고.목록 + ' · 상세 ' + 고.상세 + ' (합 ' + 고.합 + ')'
    + (어 ? '   어제 목록 ' + 어.목록 + ' · 상세 ' + 어.상세 : '')
    + '   ※ 하루 한도는 신청 화면에 안 적혀 있습니다');
  const 막 = 고용24막힘();
  const 멈춘것 = 막.filter((x) => x.멈춤);
  if (막.length) {
    줄.push('   ' + (멈춘것.length ? '★ 고용24 막힘 — **멈췄습니다**' : '⚠ 고용24 막힘(멈춤 아님)')
      + ' ' + 막.map((x) => x.출처 + ' ' + x.수 + '번').join(' · '));
    for (const x of 막.slice(0, 3)) 줄.push('      ' + x.출처 + ' 「' + String(x.까닭).slice(0, 90) + '」');
    줄.push('      응답 원문 — log/고용24_막힘.log');
    if (멈춘것.length) 줄.push('      ★ 막힌 응답은 **「없어짐」으로 세지 않습니다** — 공고를 내리지 않았습니다');
  }
  return 줄;
}

/** **회원이 신뢰를 느끼는 셋** — 오픈(11/10)까지의 목표입니다. **셋 다 0** 이어야 합니다.
 *  (2026-10-22 세중님 · docs/오픈일정_1110.md)
 *
 *  숫자는 `네숫자()` 의 '신뢰셋' 한 자리에서 옵니다 — 여기서 다시 세지 않습니다.
 *  ② 는 주 1회 손으로 재어 site_settings['신뢰셋_틀림'] 에 넣습니다.
 *  **안 쟀으면 「아직 못 잼」 이라고 적습니다 — 0 으로 적으면 거짓입니다** (지침 15절). */
/** 보류함에서 풀려 회원 화면으로 간 공고 — 글을 만들기 **전에** 한 번 재서 담습니다.
 *  글로()·아침글() 은 sync 라 안에서 await 를 못 합니다. 못 재면 null 이고 줄을 뺍니다. */
let 샌것 = null;
/** ★ 2026-10-28 세중님 1번 — 「지난 교육」 줄도 **글을 만들기 전에** 재서 담습니다
 *  (글로()·아침글() 은 sync 라 안에서 await 를 못 합니다 — 위 샌것 과 같은 꼴) */
let 교육줄들 = [];

function 신뢰셋줄(네) {
  const t = 네 && 네['신뢰셋'];
  if (!t) return [];
  const 수 = (v) => (v === null || v === undefined ? null : Number(v));
  const 첫째 = 수(t['①마감지난공고가보임']);
  const 둘째 = 수(t['②회원화면에틀린값']);
  const 셋째 = 수(t['③우리직군아님_직군빈칸']);
  const 표 = (n) => (n === null ? '아직 못 잼' : n + '건' + (n === 0 ? '  ✓' : '  ← 0 이어야 합니다'));
  const 줄 = [];
  줄.push('■ 신뢰 셋 (목표 0)');
  줄.push('  ① 마감 지난 공고가 회원 화면에 보임      ' + 표(첫째));
  줄.push('  ② 회원 화면에 틀린 값                    ' + 표(둘째)
    + (t['②잰날'] ? '   (' + t['②잰날'] + ' · 표본 ' + String(t['②표본'] || '').slice(0, 40) + ')' : ''));
  줄.push('  ③ 우리 직군이 아닌 공고 · 직군 빈칸      ' + 표(셋째)
    + '   (빈칸 ' + (t['③직군빈칸'] ?? '?') + ' · 직군의심 ' + (t['③직군의심'] ?? '?')
    + (t['③겹친것'] ? ' · 겹침 ' + t['③겹친것'] : '') + ')');
  /* ★ 2026-10-23 세중님 H-2 = ⓐ — 목록꼴은 ③ 에서 뺐습니다. 목표값 없는 **보조 줄**입니다 */
  줄.push('     └ 보조 · 자격증 목록꼴                ' + (t['③자격증목록꼴'] ?? '?')
    + '건 (목표 없음 — 우리 직군 공고로 둡니다)');
  if (둘째 === null) 줄.push('     ※ ② 는 주 1회 손으로 잽니다 — 이번 주 아직 안 쟀습니다');
  /* ★ 2026-10-22 — ③ 을 **지키는 줄**입니다. ③ 은 「지금 보이나」만 보고,
     이 줄은 「어떻게 거기 갔나」를 봅니다. 10-22 에 보류함이 매시 새는 것을
     아무 숫자도 안 보고 있었습니다 */
  줄.push(...새는한줄(샌것));
  /* ★ 2026-10-23 — 크론 줄이 다 도는지. 2026-10-12 에 ~/수집크론.sh 의 실행
     권한이 빠져 5시간 7분 몰랐던 꼴을 잡습니다 (지침 8-15) */
  try { 줄.push(...크론한줄(크론재기())); } catch { /* 못 재면 적지 않습니다 */ }
  /* ★ 2026-10-23 — 결과·안내 공고가 회원 화면에 있나 (제목을 다시 댑니다) */
  try { 줄.push(...결과공고줄(결과공고)); } catch { /* 못 재면 적지 않습니다 */ }
  /* ★ 2026-10-24 세중님 M4 — 기관 매칭률 한 줄 */
  try { 줄.push(...매칭줄(매칭)); } catch { /* 못 재면 적지 않습니다 */ }
  /* ★ 2026-10-24 세중님 D2 — 긁기 한 줄 (담기 시작한 뒤부터 보입니다) */
  try { 줄.push(...긁기줄(긁기)); } catch { /* 못 재면 적지 않습니다 */ }
  /* ★ 2026-10-26 세중님 1번 ⓒ — 서버 시계 차이 한 줄 */
  try { 줄.push(...시계줄(시계재기())); } catch { /* 못 재면 적지 않습니다 */ }
  줄.push('');
  return 줄;
}

function 아침글(네, 늦음, 구멍, 잠금, 의심, 못담음, 역할) {
  const 줄 = [];
  const 칸 = 네 ? 네['③일곱칸'] : null;
  const 놓침 = 네 ? 네['①놓친공고'] : null;
  줄.push('피오티잡 아침 숫자 — ' + new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16));
  줄.push('');
  /* ★ 2026-10-23 세중님 3번 — **맨 위**입니다. 페르소나 상태인 것을 잊기 쉽습니다 */
  줄.push(...역할줄(역할));
  줄.push(...신뢰셋줄(네));
  if (놓침) {
    /* ★ 2026-10-14 — **공공 / 민간 두 줄**로 나눠 찍습니다 (세중님 결정).
       1층 기준이 바뀌었습니다 — 공공이면 종류 무관 전부(보건소 포함),
       민간은 상급종합·대학·종합만. 두 쪽의 사정이 아주 다릅니다 */
    /* ★ 2026-10-24 세중님 3번 — **숫자 이름을 고정했습니다.** 「457곳」 하나로
       부르면 셋이 섞입니다 —
         사각지대   주소를 **모르는** 곳 (손확인 길. 열어 볼 거리가 없습니다)
         사이트있음   사이트표에 줄이 있는 곳 = **HS3 가 이미 긁는 곳**입니다
                   (2026-10-24 밤에 함수 원문을 읽고 바로잡았습니다 — 「긁기 후보」가
                    아닙니다. 139곳을 대 보니 95곳이 최근 30일 공고를 받고 있었습니다)
         들어옴     이미 들어오는 곳
       2026-10-24 에 사각지대 456곳의 주소를 기관 표·심평원·사이트표에 다 대 봤고
       **0곳**이었습니다 (docs/사각지대_분류_1024.md) */
    const 더해 = (칸) => ['공공', '민간']
      .reduce((a, k) => a + Number((놓침[k] || {})[칸] || 0), 0);
    줄.push('① 놓친 공고   사각지대(주소 없음) ' + 놓침['안긁는_1층기관'] + '곳'
      + ' · 사이트있음(HS3 가 긁는 곳) ' + 더해('사이트있음') + '곳'
      + ' · 들어옴 ' + 더해('공고만들어옴') + '곳'
      + ' / 대상 ' + 놓침['대상_1층기관'] + '곳');
    for (const 칸이름 of ['공공', '민간']) {
      const x = 놓침[칸이름];
      if (!x) continue;
      줄.push('              ' + 칸이름 + '  안 긁는 곳 ' + String(x['사각지대']).padStart(4)
        + ' / 대상 ' + String(x['대상']).padStart(4)
        + '  (사이트있음 ' + x['사이트있음'] + ' · 공고만들어옴 ' + x['공고만들어옴'] + ')');
    }
    /* ★ 2026-10-14 — 보건소는 **지소를 묶은 시군구 단위**로 셉니다 (세중님 결정).
       보건지소 213곳을 따로 세면 한 시군구를 열 번 세는 셈이라 사각지대가 부풉니다 */
    if (구멍 && 구멍.보건소) {
      줄.push('              보건소 ' + 구멍.보건소['사각지대'] + '곳(지소 묶음)'
        + ' / 대상 ' + 구멍.보건소['대상'] + '곳   ← 공공 안에 들어 있습니다');
    }
    줄.push('              안 긁는 상급종합 ' + 놓침['안긁는_상급종합'] + '곳'
      + ' · 경쟁사 기준 — 아직 못 잼 (짝 맞추기 뒤)');
  }
  if (네) 줄.push('② 마감인데 보임   ' + 네['②마감인데보임'] + '건 (회원 화면 ' + 네['회원화면'] + '건)');
  /* ★ 2026-10-18 세중님 7번 — 「정찰이 한 번도 안 본 회원 화면 공고」 를 날마다 찍습니다.
     목표는 **0** 입니다. 그날 처음 쟀을 때 323건(회원 화면 342건의 94%)이었습니다 —
     정찰이 HS3·AL2·HS·ND2 만 보고 있어서, 워크넷·알리오·클린아이·나라일터 공고는
     원문이 없어져도 아무도 안 봤습니다. 숫자가 다시 오르면 크론이 멈춘 것입니다
     (8-15 「로그가 안 쌓이는 것이 유일한 신호인 때」와 같은 결) */
  /* ★ 2026-10-18 세중님 2번 — 「숨긴 수 로그 + 아침 메일 한 줄」.
     중복숨기기.mjs 가 남기는 기록을 읽습니다 (표를 직접 읽지 않습니다).
     하루 뚜껑 10건을 넘으면 그 도구가 **아무것도 안 숨기고** 따로 메일을 보냅니다 */
  try {
    const p = process.env.POTJOB_중복기록
      || path.join(process.env.HOME || process.env.USERPROFILE || '.', '중복숨긴기록.json');
    if (fs.existsSync(p)) {
      const 기 = JSON.parse(fs.readFileSync(p, 'utf8'));
      const 오늘 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      줄.push('   중복 숨김     오늘 ' + (기.날 === 오늘 ? 기.숨긴수 : 0) + '건 (뚜껑 10 · 넘으면 멈추고 따로 메일)');
    }
  } catch { /* 기록이 없거나 깨졌으면 한 줄을 뺍니다 — 메일 전체를 막지 않습니다 */ }
  if (네 && 네['②정찰이한번도안본것'] !== undefined) {
    줄.push('   정찰 범위     한 번도 안 본 공고 ' + 네['②정찰이한번도안본것'] + '건'
      + ' (목표 0) · 사흘 안에 본 것 ' + 네['②정찰이사흘안에본것'] + '건');
    if (네['②원문없어짐인데보임'] > 0) {
      줄.push('   ★ 원문이 없어졌는데 보이는 공고 ' + 네['②원문없어짐인데보임'] + '건');
    }
  }
  /* ★ 2026-10-20 세중님 1번 뿌리② — 「마감일이 비어 보이는 것」 그물.
     ② 는 apply_to 를 오늘과 견주니 **비어 있으면 0** 입니다. 그 0 이 마감
     지난 공고 네 건을 가리고 있었습니다 (광주씨티는 2021년 공고였습니다).
     **0 이 아니면 원문 확인 목록**을 냅니다 — 자동으로 숨기지 않습니다.
     `네숫자()` 에 칸이 아직 없으면 이 줄은 안 찍습니다 (메일을 막지 않게). */
  /* ★ 2026-10-20 — **그림 OCR 이 준비됐나** 날마다 묻습니다 (세중님 4번).
     kordoc 은 그림을 읽는데 sharp 의 바탕 꾸러미가 **optional** 이라
     `tools/kordoc/.npmrc` 의 `omit=optional` 때문에 `npm ci` 로는 빠집니다.
     빠지면 그림 공고가 **조용히 다시 0%** 가 됩니다 — 그래서 그물을 겁니다.
     규칙은 `tools/그림OCR점검.mjs` 한 자리입니다 (지침 6절). */
  try {
    const g = 그림OCR준비됐나();
    if (!g.됨) {
      줄.push('██ 그림 OCR 이 안 됩니다 — ' + g.왜);
      줄.push('   고치는 법 — cd ~/potlab/tools/kordoc 에서');
      줄.push('     ONNXRUNTIME_NODE_INSTALL=skip npm install --include=optional --os=linux --cpu=x64');
    }
  } catch (e) {
    줄.push('(그림 OCR 점검을 못 돌렸습니다 — ' + String((e && e.message) || e).slice(0, 80) + ')');
  }
  if (네 && 네['②마감일비어보임'] !== undefined) {
    const 확 = 네['②마감일비어보임_확인할것'];
    줄.push('   마감일 비어 보임  ' + 네['②마감일비어보임'] + '건'
      + (확 !== undefined ? ' · 원문을 확인할 것 ' + 확 + '건 (올린지 60일 넘음 또는 올린날 없음)' : ''));
    if (확 > 0) 줄.push('      → node tools/마감비어보임.mjs  (목록 · 읽기만)');
  }
  if (칸) {
    /* ★ 2026-10-14 — 세는 칸이 **화면이 그리는 칸**과 같습니다
       (대조표 docs/일곱칸_대조_1014.md). 1층은 사정이 아주 다르므로 함께 찍습니다 */
    줄.push('③ 일곱 칸     모집인원 ' + 칸['모집인원'] + ' (1층 ' + 칸['모집인원_1층'] + ')'
      + ' · 접수마감 ' + 칸['접수마감']);
    줄.push('              근무지 ' + 칸['근무지']
      + ' · 지원자격 ' + 칸['지원자격'] + ' (1층 ' + 칸['지원자격_1층'] + ')');
    /* 마감시각은 **분모가 다릅니다** — 시각을 주는 출처만 (워크넷은 API 가 안 줍니다).
       전체 % 는 참고로 옆에 둡니다 (세중님 결정) */
    줄.push('              마감시각 ' + 칸['마감시각'] + '  (시각을 주는 출처 '
      + 칸['마감시각_찬것'] + '/' + 칸['마감시각_분모'] + '건 · 전체로는 '
      + 칸['마감시각_전체참고'] + ')');
    /* ★ 2026-10-14 — 세 칸은 **이미 화면에 있습니다.** 제가 「아직 칸이 없다」로
       적어 둔 것이 틀렸습니다. 층을 나눠 찍습니다 — 1층과 2층의 사정이
       정반대입니다 (병원 자료는 1층이 100%, 예상연봉은 1층이 20% 대) */
    줄.push('              예상연봉 ' + 칸['예상연봉'] + '%(금액 적힌 것)' + '  (1층만 ' + 칸['예상연봉_1층']
      + ' · 1층 공고 ' + 칸['예상연봉_1층분모'] + '건)');
    줄.push('              바쁜정도 ' + 칸['바쁜정도'] + ' · 병원뜯어보기 ' + 칸['병원뜯어보기']
      + '  (1층만 ' + 칸['병원뜯어보기_1층'] + ' · 자료 있는 기관 '
      + 칸['병원자료있는기관'] + '/' + 칸['회원화면기관'] + '곳)');
    if (칸['※세는칸']) 줄.push('              ※ ' + 칸['※세는칸']);
  }
  줄.push('④ 먼저 올린 비율   아직 못 잼');
  줄.push('');
  줄.push('멈춘 수집기   ' + (늦음.length ? '⚠ ' + 늦음.length + '곳 — '
    + 늦음.map((x) => (x['출처'] || x['수집기'] || '?')).join(' · ') : '0곳'));
  줄.push('오래 쥔 잠금   ' + (잠금.length ? '⚠ ' + 잠금.map((x) => x.수집기 + ' ' + x.분 + '분').join(' · ') : '0'));
  /* ★ 2026-10-19 세중님 2번 — 고용24 하루 한도가 **신청 화면에 안 적혀 있습니다.**
     그래서 한도를 짐작하지 않고 **호출 수를 세어 여기 한 줄**로 적습니다.
     목록·상세를 따로 적는 것이 세중님 조건입니다 (어느 쪽이 늘었는지 봐야 하니까) */
  줄.push(...고용24줄());
  /* ★ 2026-10-14 — 「직군 의심」 (세중님 결정 3).
     기관 원문에 우리 직군 말이 없는데 직군이 붙어 회원 화면에 있는 공고입니다.
     통합공고(우리 직군이 첨부에 있을 수 있는 것)는 **따로** 적습니다 —
     섞으면 숫자가 부풀어 아무도 안 믿게 됩니다 (지침 15절). */
  /* ★ 2026-10-14 세중님 0번 — 수집기가 창구에 못 보낸 줄. 0 이 정상입니다 */
  if (못담음) {
    const n = Number(못담음['건수'] || 0);
    줄.push('담지 못한 줄  ' + (n ? '⚠ ' + n + '건 (바퀴 ' + (못담음['바퀴수'] || 0) + ')' : '0건'));
    for (const x of (못담음['목록'] || []).slice(0, 5)) {
      줄.push('              ' + String(x['때'] || '').padEnd(12)
        + String(x['경로'] || '').padEnd(6) + String(x['공고'] || '').padEnd(16)
        + String(x['까닭'] || '').slice(0, 60));
    }
  }
  if (의심) {
    const n = Number(의심['의심'] || 0);
    줄.push('직군 의심   ' + (n ? '⚠ ' + n + '건' : '0건')
      + (Number(의심['통합공고'] || 0)
         ? '   (통합공고 ' + 의심['통합공고'] + '건은 첨부에 근거가 있을 수 있어 따로 셉니다)' : ''));
    for (const x of (의심['의심목록'] || []).slice(0, 8)) {
      줄.push('              ' + String(x['직군'] || '직군없음').padEnd(7)
        + String(x['기관'] || '').slice(0, 16).padEnd(18) + String(x['제목'] || '').slice(0, 46));
    }
    for (const x of (의심['통합공고목록'] || []).slice(0, 5)) {
      줄.push('      통합    ' + String(x['직군'] || '직군없음').padEnd(7)
        + String(x['기관'] || '').slice(0, 16).padEnd(18) + String(x['제목'] || '').slice(0, 46));
    }
  }
  if (구멍 && 구멍.상급종합.length) {
    줄.push('');
    줄.push('안 긁는 상급종합 — ' + 구멍.상급종합.join(' · '));
  }
  if (!네) {
    줄.push('');
    줄.push('※ 네 숫자를 못 받았습니다 (네숫자() 창구) — 위 숫자가 비어 있습니다');
  }
  줄.push(...교육줄들);
  줄.push(...승인줄());          /* ★ 2026-10-27 세중님 3번 — 기다리는 것이 없으면 아무 줄도 안 나옵니다 */
  줄.push('');
  줄.push('따로 알릴 것은 없습니다. 문제가 있으면 긴 요약이 따로 옵니다.');
  return 줄.join('\n');
}

async function 일층구멍(cfg) {
  const k = cfg.SUPABASE_SERVICE_KEY;
  if (!k) return null;
  const r = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent('일층병원_구멍셈'), {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  if (!j || typeof j !== 'object') return null;
  return {
    대상: j['대상'],
    사각: j['사각지대'],
    상급종합: j['사각_상급종합'] || [],
    갈래별: j['사각_갈래별'] || {},
    공공: j['공공'], 민간: j['민간'], 보건소: j['보건소'],
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
function 글로(d, 관리자주소, 잠금, 보안, 구멍, 네, 역할) {
  const 줄 = [];

  /* ★ 2026-10-23 세중님 3번 — **맨 위**입니다. 페르소나 상태인 것을 잊기 쉽습니다.
     아침글() 과 **여기 둘 다** 겁니다 — 보류 공고가 있는 날에는 아침글() 이 안 돕니다 */
  줄.push(...역할줄(역할));

  /* ★ 2026-10-22 — **신뢰 셋을 맨 앞에.** 아침글(조용한 아침) 과 **여기 둘 다**
     찍습니다 — 보류 공고가 있는 날에는 아침글() 이 안 돌아서, 그쪽만 고치면
     보이지 않습니다 (고용24줄 에서 같은 실수를 한 번 했습니다) */
  줄.push(...신뢰셋줄(네));
  줄.push(...교육줄들);
  줄.push(...승인줄());          /* ★ 2026-10-27 세중님 3번 — 여기도 함께 */

  /* ★ 2026-10-14 — 「대상인데 안 긁는 1층 병원」 (세중님 지시).
     경보가 아니라 **늘 보이는 한 줄**입니다 — 숫자가 늘면 눈에 띕니다 */
  if (구멍) {
    줄.push('· 대상인데 안 긁는 1층 기관 ' + 구멍.사각 + '곳'
      + ' (상급종합 ' + 구멍.상급종합.length + ') / 대상 ' + 구멍.대상 + '곳'
      + (구멍.공공 && 구멍.민간 ? '  —  공공 ' + 구멍.공공['사각지대'] + '/' + 구멍.공공['대상']
        + ' · 민간 ' + 구멍.민간['사각지대'] + '/' + 구멍.민간['대상'] : ''));
    if (구멍.상급종합.length) 줄.push('   상급종합 — ' + 구멍.상급종합.join(' · '));
    줄.push('   갈래별 — ' + Object.entries(구멍.갈래별)
      .sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · ')
      + '   (보건기관은 보건소 단위 · 지소 묶음)');
    줄.push('');
  }
  줄.push(...고용24줄());
  줄.push('');

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
  /* ★ 2026-10-14 — 「직군 의심」 (세중님 결정 3). 아침 메일과 같은 숫자입니다 */
  /* ★ 2026-10-14 세중님 0번 */
  const 못담음 = d['담지 못한 줄'] || {};
  if (Number(못담음['건수'] || 0)) {
    줄.push('██ 수집기가 창구에 못 보낸 줄이 있습니다 ██');
    줄.push('   ' + 못담음['건수'] + '건 (바퀴 ' + (못담음['바퀴수'] || 0) + ') — 나머지는 담았습니다');
    for (const x of (못담음['목록'] || []).slice(0, 10)) {
      줄.push('     ' + String(x['때'] || '').padEnd(12) + String(x['경로'] || '').padEnd(6)
        + String(x['공고'] || '').padEnd(16) + String(x['어디'] || '').padEnd(14)
        + String(x['까닭'] || '').slice(0, 70));
    }
    줄.push('');
  }
  const 의심 = d['직군 의심'] || {};
  if (Number(의심['의심'] || 0)) {
    줄.push('██ 직군이 의심스러운 공고가 회원 화면에 있습니다 ██');
    줄.push('   ' + 의심['의심'] + '건 — 기관 원문에 우리 직군 말이 없는데 직군이 붙었습니다');
    for (const x of (의심['의심목록'] || []).slice(0, 10)) {
      줄.push('     ' + String(x['직군'] || '직군없음').padEnd(7)
        + String(x['기관'] || '').slice(0, 18).padEnd(20) + String(x['제목'] || '').slice(0, 52));
      if (x['주소']) 줄.push('       ' + x['주소']);
    }
    if (Number(의심['통합공고'] || 0)) {
      줄.push('   통합공고 ' + 의심['통합공고'] + '건은 첨부에 근거가 있을 수 있어 따로 셉니다 —');
      for (const x of (의심['통합공고목록'] || []).slice(0, 6)) {
        줄.push('     ' + String(x['직군'] || '직군없음').padEnd(7)
          + String(x['기관'] || '').slice(0, 18).padEnd(20) + String(x['제목'] || '').slice(0, 52));
      }
    }
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
  /* ★ 2026-10-20 세중님 1번 뿌리② — 「마감일이 비어 보이는 것」 그물.
     ② 「마감인데 보임」은 apply_to 를 오늘과 견주니 **비어 있으면 0** 입니다.
     그 0 이 마감 지난 공고 네 건을 가리고 있었습니다 (광주씨티는 2021년 공고).
     0 이 아니면 **원문 확인 목록**을 냅니다 — 자동으로 숨기지 않습니다. */
  /* ★ 2026-10-20 — **그림 OCR 이 준비됐나** 날마다 묻습니다 (세중님 4번).
     kordoc 은 그림을 읽는데 sharp 의 바탕 꾸러미가 **optional** 이라
     `tools/kordoc/.npmrc` 의 `omit=optional` 때문에 `npm ci` 로는 빠집니다.
     빠지면 그림 공고가 **조용히 다시 0%** 가 됩니다 — 그래서 그물을 겁니다.
     규칙은 `tools/그림OCR점검.mjs` 한 자리입니다 (지침 6절). */
  try {
    const g = 그림OCR준비됐나();
    if (!g.됨) {
      줄.push('██ 그림 OCR 이 안 됩니다 — ' + g.왜);
      줄.push('   고치는 법 — cd ~/potlab/tools/kordoc 에서');
      줄.push('     ONNXRUNTIME_NODE_INSTALL=skip npm install --include=optional --os=linux --cpu=x64');
    }
  } catch (e) {
    줄.push('(그림 OCR 점검을 못 돌렸습니다 — ' + String((e && e.message) || e).slice(0, 80) + ')');
  }
  if (네 && 네['②마감일비어보임'] !== undefined) {
    const 확 = 네['②마감일비어보임_확인할것'];
    줄.push('마감일 비어 보임 ' + 네['②마감일비어보임'] + '건'
      + (확 !== undefined ? ' · 원문을 확인할 것 ' + 확 + '건 (올린지 60일 넘음 또는 올린날 없음)' : ''));
    if (확 > 0) 줄.push('   → node tools/마감비어보임.mjs   (목록 · 읽기만)');
  }
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

/* ★ 2026-10-14 — **아침에는 조용한 날에도 짧게 보냅니다** (세중님 결정).
 *
 * 「08:00 은 조용한 날에도 짧게 보냄(네 숫자 · 멈춘 수집기 · 안 긁는 1층
 *   병원 N곳). 15:00 은 지금처럼 문제 있을 때만.」
 *
 * 시각은 **한국 시간**으로 봅니다 (서버는 UTC 입니다). 크론이 08:00·15:00
 * 둘 다 같은 명령을 부르므로, 깃발 대신 시각으로 가릅니다 — 크론 줄을
 * 안 고쳐도 되고, 손으로 돌릴 때는 `--아침` 으로 흉내낼 수 있습니다. */
const 한국시 = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).slice(0, 2));
const 아침인가 = argv.includes('--아침') || (한국시 >= 5 && 한국시 < 12);

/* `--조용한척` — 보낼 것이 있어도 **조용한 날인 것처럼** 아침 갈래를 돌립니다.
   조용한 날이 올 때까지 기다려서는 이 길을 시험할 수 없습니다 (지침 8-16 ·
   「기준을 잠깐 낮춰 실제로 메일이 나가는지 보고 원래대로」). */
const 조용한척 = argv.includes('--조용한척');

/* ★ 2026-10-23 세중님 3번 — 마스터 계정이 지금 어느 역할인가.
   **두 갈래(조용한 아침·긴 메일) 앞**에서 한 번만 읽습니다 — 조용한 갈래는
   안에서 process.exit 로 끝나니, 안에 선언하면 긴 메일 쪽이 못 봅니다.
   읽기만 하고, 못 읽으면 null 이라 줄이 빠집니다 (메일은 그대로 나갑니다) */
const 역할목록 = await 지금역할(cfg);
/* ★ 2026-10-23 — 결과·안내 공고 (읽기만 · 못 재면 null 이라 줄이 빠집니다) */
const 결과공고 = await 결과공고세기(cfg);
/* 기관 매칭률 (2026-10-24 세중님 M4 · 읽기만 · 못 재면 null 이라 줄이 빠집니다) */
const 매칭 = await 매칭재기(cfg);
/* 긁기 (2026-10-24 · 읽기만 · 못 재면 null 이라 줄이 빠집니다) */
const 긁기 = await 긁기재기(cfg);

if (조용한척 || (!d['보낼것있나'] && !잠금.length && !(보안 && 보안.밖합))) {
  if (!아침인가) {
    console.log('보낼 것이 없습니다 — 새 보류 0건 · 회원 화면 멀쩡 · 수집기 다 제때 · PDF 0자 0건 · 오래 쥔 잠금 0');
    process.exit(0);
  }
  /* 조용한 아침 — 짧은 글만 보냅니다 */
  let 네 = null;
  try { 네 = await 네숫자받기(cfg); }
  catch (e) { console.error('네 숫자를 못 받았습니다 — ' + String(e.message || e).slice(0, 120)); }
  try { 샌것 = await 새는것(cfg); }
  catch (e) { console.error('보류함에서 풀린 것을 못 셌습니다 — ' + String(e.message || e).slice(0, 120)); }
  교육줄들 = await 지난교육줄(cfg);
  const 짧은본문 = 아침글(네, d['늦은 수집기'] || [], 구멍, 잠금, d['직군 의심'], d['담지 못한 줄'], 역할목록);
  const 짧은제목 = '[피오티잡] 아침 숫자 — 안 긁는 1층 기관 '
    + (구멍 ? 구멍.사각 + '곳' : '?') + ' · 마감인데 보임 '
    + (네 ? 네['②마감인데보임'] + '건' : '?') + ' · 멈춘 수집기 '
    + ((d['늦은 수집기'] || []).length) + '곳'
    + ' · 직군 의심 ' + ((d['직군 의심'] || {})['의심'] ?? '?') + '건';
  if (보기만) { console.log('제목: ' + 짧은제목 + '\n'); console.log(짧은본문); process.exit(0); }
  if (cfg.RESEND_KEY && cfg.NOTIFY_EMAIL) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + cfg.RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: cfg.MAIL_FROM || 'potjob <onboarding@resend.dev>',
        to: [cfg.NOTIFY_EMAIL], subject: 짧은제목, text: 짧은본문,
      }),
    });
    const t = await r.text();
    if (!r.ok) { console.error('메일 못 보냄 · HTTP ' + r.status + ' · ' + t.slice(0, 300)); process.exit(1); }
    let id = '';
    try { id = (JSON.parse(t) || {}).id || ''; } catch { /* 모양이 바뀌어도 넘어갑니다 */ }
    console.log('아침 숫자를 보냈습니다 — ' + 짧은제목);
    console.log('   Resend id ' + (id || '(응답에 id 가 없습니다)'));
  } else {
    console.log('※ RESEND_KEY · NOTIFY_EMAIL 이 없어 화면에만 찍습니다\n');
    console.log('제목: ' + 짧은제목 + '\n');
    console.log(짧은본문);
  }
  process.exit(0);
}

const 관리자 = cfg.ADMIN_URL || 'https://potjob-web.vercel.app/admin/jobs';
/* ★ 2026-10-20 — 긴 메일에도 네 숫자를 넘깁니다. 「마감일 비어 보임」은
   조용한 아침(짧은 글)에만 뜨면 안 됩니다 — 바쁜 날에도 날마다 봐야 합니다 */
let 네긴 = null;
try { 네긴 = await 네숫자받기(cfg); }
catch (e) { console.error('네 숫자를 못 받았습니다 — ' + String(e.message || e).slice(0, 120)); }
try { 샌것 = await 새는것(cfg); }
catch (e) { console.error('보류함에서 풀린 것을 못 셌습니다 — ' + String(e.message || e).slice(0, 120)); }
if (!교육줄들.length) 교육줄들 = await 지난교육줄(cfg);
const 본문 = 글로(d, 관리자, 잠금, 보안, 구멍, 네긴, 역할목록);
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
