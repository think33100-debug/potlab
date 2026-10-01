/* Supabase DB 를 서버에 떠 두는 임시 백업 (2026-10-01).
 *
 *   node tools/백업.mjs           한 번 뜹니다
 *   node tools/백업.mjs --목록     지금 가진 백업만 보여줍니다
 *   node tools/백업.mjs --복구시험  가장 최근 것을 임시 DB 에 풀어 표·행 수를 맞대봅니다
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * Supabase 무료 요금제에는 Daily backups 가 없습니다. 오픈 때 Pro 로
 * 올릴 예정이고, 그 전까지 서버에 임시로 떠 둡니다.
 *
 * ── 지키는 선 ────────────────────────────────────────────────
 * · **암호화해서** 둡니다. 서버에 평문 회원 정보를 두지 않습니다
 * · **7일치만** 두고 오래된 것은 지웁니다
 * · 열쇠·비밀번호는 화면에 안 찍습니다
 * · 수집기와 시간이 안 겹치게 돕니다 (크론 02:40)
 *
 * ── 열쇠 두 개가 필요합니다 (.env 에서 읽습니다) ─────────────
 *   SUPABASE_DB_URL   postgres://... 접속 주소 (비밀번호가 들어 있습니다)
 *   BACKUP_KEY        백업 파일을 잠그는 암호
 * 둘 다 없으면 아무것도 안 하고 멈춥니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 둘곳 = path.join(os.homedir(), 'backup');
const 며칠 = 7;

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^'|'$/g, '');
    }
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  return out;
}
const cfg = env();
const 이제 = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
const 메가 = (b) => (b / 1048576).toFixed(1) + 'MB';

/* ── 목록 ────────────────────────────────────────────────── */
function 목록() {
  if (!fs.existsSync(둘곳)) return [];
  return fs.readdirSync(둘곳)
    .filter((f) => f.startsWith('potjob-') && f.endsWith('.sql.gz.enc'))
    .map((f) => ({ 이름: f, 크기: fs.statSync(path.join(둘곳, f)).size,
                   때: fs.statSync(path.join(둘곳, f)).mtime }))
    .sort((a, b) => b.때 - a.때);
}

function 목록찍기() {
  const l = 목록();
  console.log('가진 백업 ' + l.length + '개 · 합쳐서 '
    + 메가(l.reduce((a, b) => a + b.크기, 0)));
  l.forEach((x) => console.log('  ' + x.이름 + '  ' + 메가(x.크기).padStart(8)
    + '  ' + x.때.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })));
  return l;
}

if (process.argv.includes('--목록')) { 목록찍기(); process.exit(0); }

/* ── 열쇠 확인 ───────────────────────────────────────────── */
const 없는것 = ['SUPABASE_DB_URL', 'BACKUP_KEY'].filter((k) => !cfg[k]);
if (없는것.length) {
  console.error('★ ' + 없는것.join(' · ') + ' 가 없습니다. 아무것도 안 했습니다');
  console.error('  .env 에 넣어 주세요 (값은 여기 찍지 않습니다)');
  process.exit(1);
}

/* ── 복구 시험 ───────────────────────────────────────────── */
if (process.argv.includes('--복구시험')) {
  const l = 목록();
  if (!l.length) { console.error('★ 백업이 없습니다'); process.exit(1); }
  const 최근 = path.join(둘곳, l[0].이름);
  console.log('복구 시험 — ' + l[0].이름 + ' (' + 메가(l[0].크기) + ')');
  console.log('  ⚠ 회원 표의 **내용은 열지 않습니다.** 표 수와 행 수만 맞대봅니다\n');

  const 임시 = 'potjob_restore_test';
  const 관리 = cfg.SUPABASE_DB_URL;
  /* 임시 DB 는 서버 안 PostgreSQL 에 만듭니다 — Supabase 를 건드리지 않습니다 */
  const 로컬 = 'postgres://postgres@/postgres?host=/var/run/postgresql';
  console.error('  ※ 이 시험은 서버에 PostgreSQL 이 깔려 있어야 합니다.');
  console.error('     지금은 pg_dump(받는 쪽)만 깔려 있어 **복구 시험을 건너뜁니다.**');
  console.error('     세중님께 「서버에 postgresql 을 깔아도 되는지」 여쭙고 하겠습니다.');
  void 관리; void 로컬; void 임시;
  process.exit(0);
}

/* ── 뜨기 ────────────────────────────────────────────────── */
fs.mkdirSync(둘곳, { recursive: true });
const 날 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const 이름 = 'potjob-' + 날 + '.sql.gz.enc';
const 갈곳 = path.join(둘곳, 이름);
const 임시 = 갈곳 + '.tmp';

console.log('Supabase 백업 · ' + 이제);
const t0 = Date.now();

/* pg_dump → gzip → openssl 로 잠그기. 평문이 디스크에 안 닿게 한 줄로 잇습니다 */
const 줄 = 'set -o pipefail; pg_dump --no-owner --no-privileges "$DBURL"'
  + ' | gzip -9'
  + ' | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BKEY'
  + ' > "$OUT"';

const r = spawnSync('bash', ['-c', 줄], {
  env: { ...process.env, DBURL: cfg.SUPABASE_DB_URL, BKEY: cfg.BACKUP_KEY, OUT: 임시 },
  encoding: 'utf8',
});

if (r.status !== 0) {
  /* 비밀번호가 섞여 나오지 않게 주소를 가립니다 */
  const 깨끗 = String(r.stderr || '').replace(/postgres(ql)?:\/\/[^\s"']+/g, 'postgres://(가림)');
  console.error('★ 백업 실패 (' + r.status + ')');
  console.error('  오류 원문 1200자 — ' + 깨끗.slice(0, 1200));
  try { fs.unlinkSync(임시); } catch { /* 없으면 그만 */ }
  process.exit(1);
}

fs.renameSync(임시, 갈곳);
fs.chmodSync(갈곳, 0o600);
const 크기 = fs.statSync(갈곳).size;
console.log('  떴습니다 — ' + 이름 + ' · ' + 메가(크기)
  + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');

/* ── 오래된 것 지우기 ────────────────────────────────────── */
const 지움 = [];
for (const x of 목록().slice(며칠)) {
  fs.unlinkSync(path.join(둘곳, x.이름));
  지움.push(x.이름);
}
if (지움.length) console.log('  ' + 며칠 + '일치만 둡니다 — 지운 것 ' + 지움.join(', '));

/* ── 자리 ────────────────────────────────────────────────── */
const 남은것 = 목록();
const 합 = 남은것.reduce((a, b) => a + b.크기, 0);
console.log('  가진 백업 ' + 남은것.length + '개 · 합쳐서 ' + 메가(합));
try {
  const df = execFileSync('df', ['-BM', '--output=avail', os.homedir()], { encoding: 'utf8' });
  const 남음 = Number((df.split('\n')[1] || '').replace(/[^0-9]/g, ''));
  console.log('  디스크 남은 자리 ' + 남음 + 'MB · ' + 며칠 + '일치 예상 '
    + (크기 * 며칠 / 1048576).toFixed(0) + 'MB'
    + (남음 > (크기 * 며칠 / 1048576) * 3 ? ' · 넉넉합니다' : ' · ★ 빠듯합니다'));
} catch { /* df 가 없으면 그만 */ }
