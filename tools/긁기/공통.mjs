/* 긁기 **공통** — robots · 같은 집 틈 · 담는 길 (2026-10-24 세중님 C1)
 *
 *   import { 가도되나집, 틈지키기, 받기, 담기 } from './공통.mjs';
 *
 * ── 왜 따로 ─────────────────────────────────────────────────
 * 기존 수집기는 **10/31 동결**입니다 (`v-open-collector`). 긁기를 넓히는 코드가
 * 그 파일들을 건드리면 동결이 뜻을 잃습니다. 그래서 `tools/긁기/` 로 **갈라** 둡니다
 * (세중님 C1). 첨부는 기존 길(`첨부담기.mjs`)을 그대로 씁니다 — 두 벌로 만들지 않습니다.
 *
 * ── 지키는 것 ───────────────────────────────────────────────
 *   ★ robots.txt 를 **먼저** 읽습니다. 금지면 **안 두드립니다** (`tools/robots.mjs` 한 자리)
 *   ★ 같은 집은 **3.5초** 띄웁니다 (지침)
 *   ★ 담을 때 **hold = true** 고정 — 10/31 까지 **보류함만**입니다 (세중님 C1).
 *     회원 화면에 바로 올리지 않습니다
 *   ★ 기관번호를 **직접** 적어 담습니다 — 긁기는 어느 기관인지 알고 시작하므로
 *     이름 매칭을 거치지 않습니다 (세중님 C3 · docs/매칭규칙_1024.md)
 */
import fs from 'node:fs';
import { robots읽기, 가도되나 } from '../robots.mjs';

export const UA = 'Mozilla/5.0 (compatible; potjob-collector/1.0; +https://potjob.co.kr)';
export const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));

const robots표 = new Map();
const 집때 = new Map();

/** 그 집의 robots 를 읽어(한 번만) 그 길에 가도 되나 */
export async function 가도되나집(주소) {
  let U;
  try { U = new URL(주소); } catch { return { 됨: false, 왜: '주소 꼴이 아닙니다' }; }
  if (!robots표.has(U.host)) {
    try {
      const r = await fetch(U.origin + '/robots.txt', { headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(12000), redirect: 'follow' });
      /* robots.txt 가 없으면(404) **규칙이 없는 것**이라 가도 됩니다 (tools/robots.mjs 머리글) */
      robots표.set(U.host, r.ok ? robots읽기(await r.text()) : null);
    } catch { robots표.set(U.host, null); }
    await 자고(500);
  }
  const rb = robots표.get(U.host);
  if (!rb) return { 됨: true, 왜: 'robots 규칙 없음' };
  return 가도되나(rb, U.pathname + (U.search || ''));
}

/** 같은 집이면 3.5초, 다른 집이면 0.8초 띄웁니다 */
export async function 틈지키기(주소) {
  let 집 = '';
  try { 집 = new URL(주소).host; } catch { return; }
  const 앞 = 집때.get(집) || 0;
  const 기다림 = Math.max(0, (집때.has(집) ? 3500 : 800) - (Date.now() - 앞));
  if (기다림) await 자고(기다림);
  집때.set(집, Date.now());
}

/** 쪽 하나 받기 — robots·틈을 지키고 글자와 HTML 을 함께 돌려줍니다 */
export async function 받기(주소) {
  const 허락 = await 가도되나집(주소);
  if (!허락.됨) return { 됨: false, 왜: 'robots 금지 (' + 허락.왜 + ')' };
  await 틈지키기(주소);
  try {
    const r = await fetch(주소, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' },
      signal: AbortSignal.timeout(20000), redirect: 'follow' });
    const html = await r.text();
    return { 됨: r.ok, 코드: r.status, 주소: r.url, html,
      글: html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(),
      왜: r.ok ? '' : 'HTTP ' + r.status };
  } catch (e) { return { 됨: false, 왜: '못 받음 (' + String(e.message).slice(0, 50) + ')' }; }
}

/** .env 를 읽습니다 (셸로 source 하지 않습니다 · 지침 8-12) */
export function 설정() {
  const cfg = {};
  for (const f of ['.env', '.env.local']) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return cfg;
}

/**
 * 담기 — `collect_put` 창구로 보냅니다. **hold 를 true 로 고정**합니다.
 * @param {object} cfg
 * @param {string} 출처   collect_source 에 등록된 출처 코드 (아직 없으면 **안 담습니다**)
 * @param {object[]} 줄들 {id, org_name, title, url, 기관번호, apply_to, ...}
 */
export async function 담기(cfg, 출처, 줄들, { 진짜 = false } = {}) {
  const 열쇠 = cfg['COLLECT_KEY_' + 출처];
  if (!열쇠) {
    return { 됨: false, 왜: 'COLLECT_KEY_' + 출처 + ' 가 없습니다 — 출처 등록이 먼저입니다'
      + ' (collect_source 줄 + collect_secret 열쇠 · 승인 자리)' };
  }
  const 줄 = 줄들.map((x) => ({
    ...x,
    /* ★ 10/31 까지 **보류함만** (세중님 C1) — 회원 화면에 바로 올리지 않습니다 */
    hold: true,
    /* ★ 긁기는 기관을 알고 시작합니다 — 번호를 직접 적습니다 (세중님 C3) */
    연결상태: '사람',
    연결근거: '긁기 설정',
  }));
  if (!진짜) return { 됨: true, 마른: true, 줄: 줄.length };
  /* ★ `collect_put` 은 **service_role 에만** 열려 있습니다 (ACL 확인 —
     {postgres,service_role}). anon 으로 부르면 42501 입니다. 기존 수집기도
     service_role 로 부릅니다 (collect-hosp.mjs:117) — 권한은 그 위에
     **출처 열쇠(p_secret)** 로 한 번 더 봅니다 */
  const 창구열쇠 = cfg.SUPABASE_SERVICE_KEY || cfg.SUPABASE_ANON_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/collect_put', {
    method: 'POST',
    headers: { apikey: 창구열쇠, Authorization: 'Bearer ' + 창구열쇠,
      'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: 열쇠, p_source: 출처, p_rows: 줄 }),
  });
  const t = await r.text();
  if (!r.ok) return { 됨: false, 코드: r.status, 답: t.slice(0, 300) };

  /* ★ `collect_put` 은 **기관번호를 안 받습니다**(칸 목록에 없습니다 · 전문 확인).
     그래서 담은 뒤 그 칸만 따로 적습니다 — 긁기는 기관을 알고 시작하니
     이름 매칭을 거치지 않습니다 (세중님 C3). 연결상태 「사람」이라 규칙이 안 덮습니다 */
  let 기관붙임 = 0;
  for (const x of 줄들) {
    if (!x.기관번호) continue;
    const p = await fetch(cfg.SUPABASE_URL + '/rest/v1/job_posts?id=eq.' + encodeURIComponent(x.id), {
      method: 'PATCH',
      headers: { apikey: cfg.SUPABASE_SERVICE_KEY,
        Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ 기관번호: x.기관번호, 연결상태: '사람', 연결근거: '긁기 설정' }),
    });
    if (p.ok) 기관붙임++;
  }
  return { 됨: true, 코드: r.status, 답: t.slice(0, 300), 기관붙임 };
}
