/* 지금까지 본 공고 제목을 전부 모아 파일로 굽습니다 (2026-09-28).
 *
 *   node tools/제목모음-굽기.mjs
 *
 * ── 왜 있나 ────────────────────────────────────────────────
 * `check-sort.mjs` 는 손으로 고른 30칸만 봤습니다. 그런데 그 칸들은
 * 제가 `sort-rule.mjs` 를 보면서 쓴 것이라, sort-rule 의 빈틈이
 * 시험 칸에도 똑같이 빠져 있었습니다 — **자기 답안지로 자기를 채점**한 것입니다.
 * 그래서 두 규칙이 940건 중 550건(58%)에서 갈라진 것을 못 잡았습니다.
 *
 * 이제 **진짜 공고 제목 전부**를 넣고 두 규칙의 답을 견줍니다.
 * Actions 에는 DB 열쇠 없이도 돌아야 하므로 파일로 구워 둡니다.
 *
 * 제목만 담습니다 — 기관명·주소·사람 이름은 안 담습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 둘곳 = path.join(여기, '제목모음.json');

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  out.KEY = out.SUPABASE_SERVICE_KEY || out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return out;
}

const cfg = env();
if (!cfg.SUPABASE_URL || !cfg.KEY) { console.error('SUPABASE_URL · 열쇠가 없습니다'); process.exit(1); }

/* ⚠ PostgREST 는 `limit=1000` 을 달라 해도 **한 번에 100줄만** 줍니다 (max-rows).
   처음엔 `j.length < 1000` 이면 끝난 줄 알고 멈춰서 197개만 구웠습니다.
   **받은 만큼**으로 다음 자리를 잡습니다 */
async function 가져오기(표) {
  const 모음 = [];
  let i = 0, 쪽 = 0;
  for (;;) {
    const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + 표 + '?select=title&limit=1000&offset=' + i, {
      headers: { apikey: cfg.KEY, Authorization: 'Bearer ' + cfg.KEY },
    });
    if (!r.ok) { console.error('  ' + 표 + ' HTTP ' + r.status + ' · ' + (await r.text()).slice(0, 200)); break; }
    const j = await r.json();
    if (!j.length) break;
    모음.push(...j.map((x) => String(x.title || '').trim()).filter(Boolean));
    i += j.length;
    if (++쪽 > 200) { console.error('  ' + 표 + ' 쪽이 200 을 넘었습니다 — 멈춥니다'); break; }
  }
  console.log('  ' + 표.padEnd(12) + 모음.length + '건 (' + 쪽 + '쪽)');
  return 모음;
}

const 전부 = [...(await 가져오기('job_posts')), ...(await 가져오기('job_trash'))];
const 제목 = [...new Set(전부)].sort();
fs.writeFileSync(둘곳, JSON.stringify({
  구운날: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }),
  메모: '지금까지 본 공고 제목. 두 규칙(gas · sort-rule)이 같은 답을 내는지 대보는 데 씁니다',
  제목,
}, null, 0) + '\n', 'utf8');
console.log('\n구웠습니다 · ' + 둘곳 + ' · 제목 ' + 제목.length + '개 · '
  + Math.round(fs.statSync(둘곳).size / 1024) + 'KB');
