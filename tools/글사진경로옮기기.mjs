/* 이미 올라간 커뮤니티 글 사진을 새 경로로 옮깁니다 (2026-11-11).
 *
 *   node tools/글사진경로옮기기.mjs                          ← 마른 실행: 목록·개수만 찍습니다
 *   node tools/글사진경로옮기기.mjs --진짜                   ← 복사 + DB 경로 칸 바꾸기
 *   node tools/글사진경로옮기기.mjs --옛파일 <되돌림.json>     ← 옛 파일 지우기 마른 실행
 *   node tools/글사진경로옮기기.mjs --옛파일 <되돌림.json> --진짜   ← 옛 파일 지우기
 *
 * 옛 꼴 `<회원uuid>/<글번호>/<n>.webp` → 새 꼴 `i/<uuid>.webp` (web/lib/post-image-path.ts).
 *
 * ── 차례 ──────────────────────────────────────────────────────
 *   ① 사진 두 장(큰 것·작은 것)을 **복사**합니다 (옮기기 아님 — 옛 파일은 남깁니다)
 *   ② 두 장이 다 되면 post_images 그 줄의 path·thumb_path 를 바꿉니다.
 *      `id` 와 **옛 path 가 둘 다 맞을 때만** 바꾸고, 바뀐 줄이 1 이 아니면 실패입니다
 *      (작업지침 8-26)
 *   ③ 한 줄 끝날 때마다 되돌림 목록을 `~/되돌림/글사진경로_<날짜>.json`·`.sql` 에
 *      **바로** 다시 씁니다 — 중간에 끊겨도 한 데까지는 되돌릴 수 있습니다 (8-19)
 *   ④ 옛 파일은 **확인 뒤** `--옛파일` 로 따로 지웁니다. 그때 DB 가 새 경로를
 *      가리키는지 · 새 파일이 실제로 열리는지를 줄마다 다시 봅니다
 *
 * ── 왜 한 줄씩 바로 DB 를 바꾸나 ────────────────────────────────
 *   정리 도구(clean_orphan_files.js)는 10분마다 돕니다. 지금 그 도구는 **옛 꼴만**
 *   지울 수 있어 `i/…` 를 안 건드리지만, 복사와 DB 사이를 짧게 두는 편이 덜 아픕니다.
 *
 * 열쇠 — SUPABASE_URL · SUPABASE_SERVICE_KEY(또는 SUPABASE_SERVICE_ROLE_KEY).
 *   .env 를 node 로 읽습니다 (작업지침 8-12). 열쇠는 화면에 찍지 않습니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 모두받기 } from './쪽나눠받기.mjs';
import { 새글사진경로, 새꼴, 옛꼴 } from '../web/lib/post-image-path.ts';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 통 = 'post-images';
const 진짜 = process.argv.includes('--진짜');
const 옛파일자리 = process.argv.indexOf('--옛파일');
const 옛파일모드 = 옛파일자리 >= 0;

function env() {
  const out = {};
  for (const f of ['.env.local', '.env', 'web/.env.local'].map((x) => path.join(여기, '..', x))) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  return out;
}
const cfg = env();
const URL_ = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
const KEY = cfg.SUPABASE_SERVICE_ROLE_KEY || cfg.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) {
  console.error('SUPABASE_URL 과 SUPABASE_SERVICE_KEY 가 없습니다 (값은 찍지 않습니다)');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
/* 혹시 오류 글에 열쇠가 섞여 와도 가립니다 (8-12) */
const 가림 = (s) => String(s).split(KEY).join('‹열쇠›');

const 공개주소 = (길) =>
  `${URL_}/storage/v1/object/public/${통}/${길.split('/').map(encodeURIComponent).join('/')}`;

async function 복사(옛, 새) {
  const r = await fetch(`${URL_}/storage/v1/object/copy`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ bucketId: 통, sourceKey: 옛, destinationKey: 새 }),
  });
  if (!r.ok) throw new Error(`복사 실패 HTTP ${r.status} ${가림(await r.text()).slice(0, 200)}`);
}

async function 열리나(길) {
  const r = await fetch(공개주소(길), { method: 'HEAD' });
  return r.ok;
}

function 되돌림터() {
  const 터 = path.join(os.homedir(), '되돌림');
  fs.mkdirSync(터, { recursive: true });
  return 터;
}
const 날짜 = () => {
  const d = new Date(Date.now() + 9 * 3600_000).toISOString();   // KST
  return d.slice(0, 10).replace(/-/g, '') + '_' + d.slice(11, 16).replace(':', '');
};
const sql문자 = (s) => `'${String(s).replace(/'/g, "''")}'`;

/* ───────────────────────── 옮기기 ───────────────────────── */
async function 옮기기() {
  const 줄들 = await 모두받기(`${URL_}/rest/v1/post_images?select=id,post_id,path,thumb_path,sort`, H, { 차례: 'id' });

  const 옛것 = [], 새것 = [], 모를것 = [];
  for (const r of 줄들) {
    const 큰 = r.path, 작 = r.thumb_path ?? r.path;
    if (옛꼴.test(큰) && 옛꼴.test(작)) 옛것.push(r);
    else if (새꼴.test(큰) && 새꼴.test(작)) 새것.push(r);
    else 모를것.push(r);
  }

  console.log(`post_images 전체 ${줄들.length}줄 · ${new Date().toISOString()}`);
  console.log(`  옛 꼴(옮길 것)   ${옛것.length}줄`);
  console.log(`  새 꼴(이미 끝남) ${새것.length}줄`);
  console.log(`  꼴 모름(안 건드림) ${모를것.length}줄`);
  for (const r of 모를것) console.log(`    · id ${r.id} · 글 ${r.post_id} · ${r.path}`);
  console.log('옮길 목록 (id · 글번호 · 차례 · 옛 큰것 · 옛 작은것)');
  for (const r of 옛것) console.log(`    · ${r.id} · ${r.post_id} · ${r.sort} · ${r.path} · ${r.thumb_path}`);

  if (!진짜) {
    console.log('\n마른 실행입니다 — 아무것도 안 바꿨습니다. 옮기려면 --진짜 를 붙이십시오');
    return 0;
  }
  if (!옛것.length) { console.log('옮길 것이 없습니다'); return 0; }

  const 이름 = `글사진경로_${날짜()}`;
  const json길 = path.join(되돌림터(), `${이름}.json`);
  const sql길 = path.join(되돌림터(), `${이름}.sql`);
  const 한것 = [];
  const 쓰기 = () => {
    fs.writeFileSync(json길, JSON.stringify(한것, null, 2));
    fs.writeFileSync(sql길, [
      `-- 글사진 경로 되돌림 (${이름}) · ${한것.length}줄`,
      '-- DB 칸만 옛 경로로 돌립니다. 옛 파일은 --옛파일 단계 전까지 그대로 있습니다',
      'begin;',
      ...한것.map((x) => `update public.post_images set path = ${sql문자(x.옛큰것)}, thumb_path = ${sql문자(x.옛작은것)}`
        + ` where id = ${Number(x.id)} and path = ${sql문자(x.새큰것)};`),
      `-- 위 update 가 각각 1줄이어야 합니다 (모두 ${한것.length}줄)`,
      'commit;', '',
    ].join('\n'));
  };

  let 실패 = 0;
  for (const r of 옛것) {
    const 새 = 새글사진경로();
    const 옛작 = r.thumb_path ?? r.path;
    try {
      await 복사(r.path, 새.큰것);
      await 복사(옛작, 새.작은것);
      const u = await fetch(
        `${URL_}/rest/v1/post_images?id=eq.${Number(r.id)}&path=eq.${encodeURIComponent(r.path)}`,
        { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' },
          body: JSON.stringify({ path: 새.큰것, thumb_path: 새.작은것 }) });
      if (!u.ok) throw new Error(`DB 바꾸기 실패 HTTP ${u.status} ${가림(await u.text()).slice(0, 200)}`);
      const 바뀐 = await u.json();
      if (!Array.isArray(바뀐) || 바뀐.length !== 1) throw new Error(`바뀐 줄이 ${바뀐?.length ?? '?'}줄입니다 (1이어야 함)`);
      한것.push({ id: r.id, post_id: r.post_id, 옛큰것: r.path, 옛작은것: 옛작, 새큰것: 새.큰것, 새작은것: 새.작은것 });
      쓰기();
      console.log(`  옮김 id ${r.id} → ${새.큰것}`);
    } catch (e) {
      실패++;
      console.error(`  ✗ id ${r.id} — ${가림(e.message)}`);
      console.error('    (복사된 새 파일이 있으면 i/ 아래 주인 없이 남습니다 · 옛 줄·옛 파일은 그대로입니다)');
    }
  }
  console.log(`\n옮김 ${한것.length}줄 · 실패 ${실패}줄 (옮길 것 ${옛것.length}줄)`);
  if (한것.length) {
    console.log(`되돌림 목록 ${json길}`);
    console.log(`되돌림 SQL  ${sql길}`);
    console.log(`다음 — 화면에서 사진이 보이는지 확인한 뒤: node tools/글사진경로옮기기.mjs --옛파일 ${json길}`);
  }
  return 실패 ? 1 : 0;
}

/* ───────────────────────── 옛 파일 지우기 ───────────────────────── */
async function 옛파일지우기() {
  const 파일 = process.argv[옛파일자리 + 1];
  if (!파일 || !fs.existsSync(파일)) { console.error('되돌림 .json 경로를 --옛파일 뒤에 적어 주십시오'); return 1; }
  const 목록 = JSON.parse(fs.readFileSync(파일, 'utf8'));
  console.log(`되돌림 목록 ${목록.length}줄 · ${파일}`);

  const 지울것 = [];
  let 안됨 = 0;
  for (const x of 목록) {
    /* 줄마다 다시 확인합니다 — DB 가 새 경로를 가리키나 · 새 파일이 열리나 · 옛 것이 옛 꼴인가 */
    const 줄 = await 모두받기(`${URL_}/rest/v1/post_images?select=id,path,thumb_path&id=eq.${Number(x.id)}`, H, { 차례: 'id' });
    const 지금 = 줄[0];
    const 까닭 = !지금 ? '줄이 없습니다(글이 지워졌을 수 있음)'
      : 지금.path !== x.새큰것 || 지금.thumb_path !== x.새작은것 ? 'DB 가 새 경로를 안 가리킵니다'
      : !(옛꼴.test(x.옛큰것) && 옛꼴.test(x.옛작은것)) ? '옛 경로가 옛 꼴이 아닙니다'
      : !(await 열리나(x.새큰것)) || !(await 열리나(x.새작은것)) ? '새 파일이 안 열립니다'
      : null;
    if (까닭 && 지금) { 안됨++; console.log(`  건너뜀 id ${x.id} — ${까닭}`); continue; }
    /* 줄이 없으면(글 삭제) 옛 파일도 쓰는 곳이 없으므로 지울 것에 넣습니다 */
    if (!지금) console.log(`  id ${x.id} — ${까닭} → 옛 파일만 지울 것에 넣습니다`);
    지울것.push(x.옛큰것, x.옛작은것);
  }
  const 겹침없이 = [...new Set(지울것)];
  console.log(`지울 옛 파일 ${겹침없이.length}개 · 건너뜀 ${안됨}줄`);
  for (const 길 of 겹침없이) console.log(`    · ${길}`);
  if (!진짜) { console.log('\n마른 실행입니다 — 아무것도 안 지웠습니다. 지우려면 --진짜 를 붙이십시오'); return 0; }
  if (!겹침없이.length) return 0;

  const 덩이 = 100;
  let 지운 = 0;
  for (let i = 0; i < 겹침없이.length; i += 덩이) {
    const 이번 = 겹침없이.slice(i, i + 덩이);
    const d = await fetch(`${URL_}/storage/v1/object/${통}`, {
      method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: 이번 }) });
    if (!d.ok) { console.error(`  ✗ 지우기 실패 HTTP ${d.status} ${가림(await d.text()).slice(0, 200)}`); return 1; }
    const 결과 = await d.json();
    지운 += Array.isArray(결과) ? 결과.length : 0;
  }
  console.log(`지운 옛 파일 ${지운}개 (지울 것 ${겹침없이.length}개)`);
  return 지운 === 겹침없이.length ? 0 : 1;
}

const 끝 = await (옛파일모드 ? 옛파일지우기() : 옮기기()).catch((e) => {
  console.error(가림(e.message)); return 1;
});
process.exit(끝);
