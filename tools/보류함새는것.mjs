/* **보류함에서 풀려 회원 화면으로 간 공고** 를 하루 한 줄로 셉니다 (2026-10-22 세중님 1번)
 *
 *   node tools/보류함새는것.mjs            한 줄 + 목록
 *   node tools/보류함새는것.mjs --시간 48  몇 시간을 볼지 (기본 24)
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * 2026-10-22 에 **보류함이 매시 새고 있었습니다.** 「마감 지났나」 판정이 아홉 시간
 * 틀려서 보류함 공고의 `hold` 가 풀리고, 다음 바퀴가 그것을 회원 화면으로
 * 올렸습니다 (이레 동안 41건). **아무 숫자도 그것을 안 보고 있었습니다.**
 *
 * 그래서 이 줄이 묻습니다 — 「어제오늘 보류함에서 풀려 **회원 화면에 있는** 공고가
 * 몇 건이고, **누가** 풀었나」. 제대로 도는 길은 「수집기가 첨부를 읽어 직군을
 * 찾았다」입니다. 빨간 줄은 **직군이 빈칸인 채로 풀린 것**입니다 — 그것은
 * 아무도 안 가린 공고가 회원 화면에 있다는 뜻입니다.
 *
 * ★ 읽기만 합니다.
 */
import fs from 'node:fs';
/* ★ 2026-10-25 — 쪽을 넘길 때는 **차례(order)를 반드시** 붙입니다. 안 붙이면 줄이
   겹치거나 빠집니다 (지침 8-20 ③ · 10/23 에 292→231, 10/25 에 281→219 로 잘못 셌습니다).
   자는 tools/쪽나눠받기.mjs 의 차례붙이기() 하나입니다 — **직접 offset 을 쓰지 않습니다**. */
import { 차례붙이기 } from './쪽나눠받기.mjs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));

export function 열쇠읽기() {
  const cfg = {};
  for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return cfg;
}

/** 100줄에서 끊깁니다 — 받은 줄 수만큼 넘기고 0줄일 때 멈춥니다 (지침) */
async function 다받기(U, H, 길) {
  const 모 = [];
  for (let off = 0; ;) {
    const r = await fetch(U + '/rest/v1/' + 차례붙이기(길)
      + '&limit=1000&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 160));
    const a = await r.json();
    모.push(...a);
    if (!a.length) return 모;
    off += a.length;
    if (off > 200000) throw new Error('너무 많습니다');
  }
}

/**
 * @returns {{수:number, 까닭없음:number, 사람:number, 직군빈칸:number, 누가별:Object, 목록:Array}}
 */
export async function 새는것(cfg, 시간 = 24) {
  const U = cfg.SUPABASE_URL, K = cfg.SUPABASE_SERVICE_KEY;
  const H = { apikey: K, Authorization: 'Bearer ' + K };
  const 부터 = new Date(Date.now() - 시간 * 3600e3).toISOString();

  /* 보류함에서 **풀린** 줄만 */
  const 로그 = await 다받기(U, H, 'job_state_log?select=job_id,'
    + [encodeURIComponent('누가'), encodeURIComponent('왜'), encodeURIComponent('바뀐때'),
      encodeURIComponent('옛_hold'), encodeURIComponent('새_hold')].join(',')
    + '&' + encodeURIComponent('옛_hold') + '=is.true'
    + '&' + encodeURIComponent('새_hold') + '=is.false'
    + '&' + encodeURIComponent('바뀐때') + '=gte.' + 부터
    + '&order=' + encodeURIComponent('바뀐때') + '.asc');

  const 풀린것 = new Map();
  for (const l of 로그) {
    const 전 = 풀린것.get(l.job_id) || { 누가: [], 까닭적힘: false };
    전.누가.push(String(l['누가'] || '(안 적힘)'));
    if (String(l['왜'] || '').trim()) 전.까닭적힘 = true;
    풀린것.set(l.job_id, 전);
  }
  if (!풀린것.size) return { 수: 0, 까닭없음: 0, 사람: 0, 직군빈칸: 0, 누가별: {}, 목록: [] };

  /* 지금 회원 화면에 있는 것만 남깁니다 */
  const 보임 = new Set((await 다받기(U, H, 'job_posts_pub?select=id&order=id')).map((x) => x.id));
  const ids = [...풀린것.keys()].filter((id) => 보임.has(id));
  if (!ids.length) return { 수: 0, 까닭없음: 0, 사람: 0, 직군빈칸: 0, 누가별: {}, 목록: [] };

  const 공고 = [];
  for (let i = 0; i < ids.length; i += 60) {
    공고.push(...await 다받기(U, H, 'job_posts?select=id,source,org_name,title,job_group'
      + '&id=in.(' + ids.slice(i, i + 60).join(',') + ')&order=id'));
  }

  const 누가별 = {};
  const 목록 = [];
  let 까닭없음 = 0, 사람 = 0, 직군빈칸 = 0;
  for (const j of 공고) {
    const f = 풀린것.get(j.id);
    const 누구 = f.누가[f.누가.length - 1];
    누가별[누구] = (누가별[누구] || 0) + 1;
    if (!f.까닭적힘) 까닭없음++;
    if (/^관리자/.test(누구)) 사람++;
    const 빈칸 = !String(j.job_group || '').trim();
    if (빈칸) 직군빈칸++;
    목록.push({ id: j.id, 출처: j.source, 기관: j.org_name, 제목: j.title,
      직군: j.job_group || '(빈칸)', 누가: 누구 });
  }
  return { 수: 공고.length, 까닭없음, 사람, 직군빈칸, 누가별, 목록 };
}

/** 메일·보고에 붙일 한 줄 (직군 빈칸이 있으면 ★ 를 붙입니다) */
export function 한줄(s, 시간 = 24) {
  if (!s) return [];
  const 줄 = ['   보류함에서 풀림  ' + 시간 + '시간 동안 ' + s.수 + '건이 회원 화면으로'
    + (s.수 ? ' (사람이 푼 것 ' + s.사람 + ' · 까닭 안 적힌 것 ' + s.까닭없음
      + ' · **직군 빈칸 ' + s.직군빈칸 + '**)' : '')];
  if (s.수) {
    줄.push('                   누가 — ' + Object.entries(s.누가별)
      .sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · '));
  }
  if (s.직군빈칸) {
    줄.push('   ★ 직군이 빈칸인 채로 풀린 공고가 있습니다 — 아무도 안 가린 공고가 회원 화면에 있습니다');
    for (const x of s.목록.filter((x) => x.직군 === '(빈칸)').slice(0, 5)) {
      줄.push('      ' + x.id + ' [' + x.출처 + '] ' + String(x.기관).slice(0, 14)
        + ' | ' + String(x.제목).slice(0, 34) + '  ← ' + x.누가);
    }
  }
  return 줄;
}

/* 직접 돌렸을 때만 찍습니다 (import 하면 아무 일도 안 합니다) */
if (import.meta.url === pathToFileURL(process.argv[1] || '.').href) {
  const cfg = 열쇠읽기();
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE_URL·열쇠가 없습니다 (서버에서 돌리십시오)'); process.exit(1);
  }
  const 시간 = Number(process.argv.includes('--시간')
    ? process.argv[process.argv.indexOf('--시간') + 1] : 24) || 24;
  const s = await 새는것(cfg, 시간);
  console.log(한줄(s, 시간).join('\n'));
  if (s.수) {
    console.log('\n── 목록 ──');
    for (const x of s.목록.slice(0, 20)) {
      console.log('  ' + x.id.padEnd(19) + String(x.출처).padEnd(5) + String(x.직군).padEnd(11)
        + String(x.기관 || '').slice(0, 14).padEnd(16) + String(x.제목 || '').slice(0, 40)
        + '  ← ' + x.누가);
    }
  }
}
