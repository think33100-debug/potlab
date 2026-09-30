/* 밤마다 도는 정리 — 보관기간이 지난 것을 지우고, 마감 지난 공고를 옮깁니다 (2026-10-01).
 *
 *   node tools/밤정리.mjs          정리합니다
 *   node tools/밤정리.mjs --dry    무엇을 지울지 세기만 하고 지우지 않습니다
 *
 * ── 무엇을 하나 ──────────────────────────────────────────────
 * ① 접속·이용 기록(job_events) 중 3개월 지난 것을 지웁니다
 * ② 마감 지난 공고를 「지난 공고」로 옮깁니다 (hide_stale_posts)
 *
 * ── 공고는 지우지 않습니다 ───────────────────────────────────
 * ②는 `hidden = true, hidden_why = '마감 지남'` 으로 **옮기기만** 합니다.
 * 관리자가 잠근 줄(admin_locked)은 건드리지 않습니다.
 *
 * ── 왜 여기로 옮겼나 ─────────────────────────────────────────
 * ②는 지금까지 **옛 시스템의 다리**(tools/sync_jobs.js)가 불렀습니다.
 * 옛 수집기를 끄면 같이 멈춰서, 마감 지난 공고가 회원 화면에 남습니다.
 * 그래서 새 서버로 옮겨 태웁니다. 옛 것은 아직 안 끕니다 —
 * 두 곳에서 불러도 같은 결과입니다 (이미 옮긴 줄은 건너뜁니다).
 *
 * ── 열쇠 ─────────────────────────────────────────────────────
 * 서버에는 service_role 열쇠가 없습니다. 수집기와 같은 방식으로
 * collect_secret 을 확인하는 창구(밤정리)를 씁니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'HS3';
const dry = process.argv.includes('--dry');

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', '.env'),
    path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^'|'$/g, '');
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const cfg = env();

async function rpc(fn, body) {
  const k = cfg.SUPABASE_ANON_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(fn), {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  /* 진단은 원문을 찍습니다 — 「몇 건 왔다」만 찍으면 막혔을 때 아무것도 못 봅니다 */
  if (!r.ok) throw new Error(fn + ' HTTP ' + r.status + '\n    응답 원문 — ' + t.slice(0, 600));
  try { return JSON.parse(t); } catch { return t; }
}

const t0 = Date.now();
console.log('밤정리 · ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  + (dry ? ' · --dry (지우지 않습니다)' : ''));

if (!cfg.COLLECT_KEY_HS3) {
  console.error('★ COLLECT_KEY_HS3 가 없습니다. 아무것도 안 했습니다');
  process.exit(1);
}

if (dry) {
  /* --dry 는 창구를 부르지 않고 **셀 수 있는 것만** 셉니다.
     job_events 는 anon 이 못 읽으므로 여기서는 셀 수 없습니다 — 그대로 밝힙니다 */
  console.log('  --dry 는 지우지 않습니다. 무엇을 지울지는 anon 권한으로 셀 수 없어');
  console.log('  숫자를 보여드리지 못합니다. 진짜로 돌리면 지운 건수가 나옵니다');
  process.exit(0);
}

try {
  const r = await rpc('밤정리', { p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE });
  console.log('  이용 기록 지움(3개월)          ' + r['이용 기록 지움(3개월)'] + '건');
  console.log('  탈퇴 이름 파기(30일)           ' + r['탈퇴 이름 파기(30일)'] + '건');
  console.log('  신고 처리 중이라 남긴 이름      ' + r['신고 처리 중이라 남긴 이름'] + '건');
  console.log('  채팅 글 지움(1년)              ' + r['채팅 글 지움(1년)'] + '건');
  console.log('  신고 기록 지움(처리 뒤 1년)     ' + r['신고 기록 지움(처리 1년)'] + '건');
  console.log('  관리자 접속기록 지움(1년)       ' + r['관리자 접속기록 지움(1년)'] + '건');
  const 공고 = r['공고 옮김'] || {};
  console.log('  마감 지나 옮긴 공고            ' + (공고['마감 지남'] ?? '?') + '건');
  console.log('  마감일 없이 45일 지나 옮김      ' + (공고['45일 지남'] ?? 0) + '건');
  console.log('  수시인데 180일 지나 옮김        ' + (공고['180일 지남(수시)'] ?? 0) + '건');
  console.log('  다시 보이게 한 것              ' + (공고['다시 보이게'] ?? 0) + '건');
  console.log('\n' + Math.round((Date.now() - t0) / 1000) + '초');
} catch (e) {
  console.error('★ 막혔습니다 · ' + e.message);
  process.exit(1);
}
