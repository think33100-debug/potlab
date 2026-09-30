/* 서버 .env 를 **덮어쓰지 않고 합칩니다** (2026-09-30).
 *
 *   node tools/서버env.mjs --내보내기 | ssh … 'node ~/potlab/tools/env합치기.mjs ~/potlab/.env'
 *
 * ── 왜 만드나 ────────────────────────────────────────────────
 * 오늘 제가 서버 `.env` 를 통째로 덮어써서 세 줄을 잃었습니다 —
 * `COLLECT_KEY_AL2` · `COLLECT_KEY_CE2` · `ALIVE_KEY`.
 * 그 값들은 집 컴퓨터 어디에도 없고 **서버에만** 있던 것이었습니다.
 *
 * `서버env.mjs` 는 집에 있는 것으로 파일을 새로 만듭니다. 그러니 집에 없는 값은
 * 조용히 사라집니다. 덮어쓰기를 **합치기**로 바꾸면 다시는 안 잃습니다.
 *
 * ── 규칙 ─────────────────────────────────────────────────────
 * · 들어온 것(stdin)이 이깁니다 — 같은 이름이면 새 값으로
 * · 서버에만 있던 이름은 **그대로 둡니다**
 * · 값은 한 글자도 안 찍습니다. 이름과 몇 개인지만
 */
import fs from 'node:fs';

const 파일 = process.argv[2];
if (!파일) { console.error('쓰는 법: node tools/env합치기.mjs <.env 경로>   (새 값은 stdin 으로)'); process.exit(1); }

const 읽기 = (글) => {
  const o = new Map();
  const 머리 = [];
  for (const l of String(글).split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=(.*)$/);
    if (m) o.set(m[1], m[2]);
    else if (l.trim()) 머리.push(l);
  }
  return { o, 머리 };
};

let 들어온것 = '';
for await (const c of process.stdin) 들어온것 += c;
if (!들어온것.trim()) { console.error('stdin 이 비었습니다 — 아무것도 안 했습니다'); process.exit(1); }

const 새것 = 읽기(들어온것);
const 옛것 = fs.existsSync(파일) ? 읽기(fs.readFileSync(파일, 'utf8')) : { o: new Map(), 머리: [] };

const 합친것 = new Map(옛것.o);
for (const [k, v] of 새것.o) 합친것.set(k, v);

const 지킨것 = [...옛것.o.keys()].filter((k) => !새것.o.has(k));
const 바뀐것 = [...새것.o.keys()].filter((k) => 옛것.o.has(k) && 옛것.o.get(k) !== 새것.o.get(k));
const 새이름 = [...새것.o.keys()].filter((k) => !옛것.o.has(k));

/* 먼저 임시 파일에 쓰고 옮깁니다 — 쓰다 죽어도 .env 가 반토막 나지 않게 */
const 글 = [...새것.머리, ...[...합친것].map(([k, v]) => k + '=' + v)].join('\n') + '\n';
fs.writeFileSync(파일 + '.새것', 글, { mode: 0o600 });
fs.renameSync(파일 + '.새것', 파일);
fs.chmodSync(파일, 0o600);

console.log('합쳤습니다 — 모두 ' + 합친것.size + '줄');
if (새이름.length) console.log('  새로 생김  ' + 새이름.join(' · '));
if (바뀐것.length) console.log('  값이 바뀜  ' + 바뀐것.join(' · '));
if (지킨것.length) console.log('  서버에만 있어 지킨 것  ' + 지킨것.join(' · '));
