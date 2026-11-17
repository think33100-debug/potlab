/* RAPO 777 이미지 묶음 — 드라이브 공유 링크 폴더에서 서버로 받기 (2026-11-17 세중님 「드라이브 링크로 · 사진이 언제든 추가될 수 있어」)

   node tools/reels/묶음받기.mjs             바뀐 것이 있으면 받아 검사하고, 통과하면 ~/rapo777 를 새 판으로 바꿈
   node tools/reels/묶음받기.mjs --마른      목록만 보고 무엇이 바뀌었는지 찍음 (받지 않음)
   node tools/reels/묶음받기.mjs --자기점검  규칙만 (어디서나 · 드라이브를 안 두드림)

   열쇠   .env 의 GDRIVE_API_KEY (구글 클라우드 「API 키」 · Drive API 만 허용) · RAPO777_DRIVE_FOLDER (폴더 ID)
          폴더는 「링크가 있는 모든 사용자 · 뷰어」로 공유되어 있어야 합니다
   길    Drive API v3 — files.list (q='<폴더>' in parents · 하위 폴더까지) · files.get alt=media
   ★ 2026-11-17 — 이 세션에서 공유 폴더를 API 키로 실제로 읽어 보지는 못했습니다. 응답 원문 600자를 찍으니 첫 실행에서 맞춥니다.

   쌓이는 중에 받아도 틀린 그림이 들어가지 않게
     ① 바뀐 파일(md5)만 받고, 안 바뀐 것은 전 판에서 복사해 **새 폴더** ~/rapo777_<YYYYMMDD_HHMMSS>/ 를 만듭니다
     ② ZIP 은 그 폴더에 풉니다. package_index.json 에 지문이 있으면 ZIP sha256 이 같아야 합니다
     ③ 검사 — institutions.json 이 읽히나 · 그림 파일 지문이 render_sha256 과 같나 (다르면 실패)
        아직 안 온 그림은 실패가 아니라 셈만 합니다 (그 기관은 run.mjs 에서 「파일 없음」 대기)
     ④ 다 통과하면 ~/rapo777 (링크)를 새 폴더로 바꿉니다. 실패하면 그대로 두고 다음 바퀴에 다시
     ⑤ 전 판은 셋까지 남깁니다 — 되돌리기: ln -sfn ~/rapo777_<전 때> ~/rapo777
   삭제 요청 목록(~/rapo777_게시금지.json)은 묶음 밖이라 바꿔도 그대로입니다 (rapo777.mjs) */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { env } from './ig.mjs';
import { 묶음읽기 } from './rapo777.mjs';

const 집 = os.homedir();
const 링크 = process.env.RAPO777_DIR || path.join(집, 'rapo777');
const 상태파일 = path.join(집, 'rapo777_받기.json');
const 지문 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

/* 목록(경로·md5) 과 전 상태를 견줘 할 일을 정합니다 — 드라이브 없이 시험할 수 있게 갈라 둠 */
export function 계획(전, 지금) {
  const 받을 = []; const 그대로 = [];
  for (const f of 지금) {
    const 옛 = 전[f.경로];
    if (옛 && f.md5 && 옛.md5 === f.md5) 그대로.push(f); else 받을.push(f);
  }
  const 빠짐 = Object.keys(전).filter((k) => !지금.some((f) => f.경로 === k));
  return { 받을, 그대로, 빠짐, 바뀜: 받을.length > 0 || 빠짐.length > 0 };
}

/* 새 판 검사 — 묶음이 읽히나 · 있는 그림의 지문이 맞나 · 없는 그림 셈 */
export function 검사(폴더) {
  const 묶음 = 묶음읽기(폴더);
  let 있음 = 0; let 없음 = 0; const 다름 = [];
  const 본 = new Set();
  for (const 기 of 묶음.기관들) for (const a of 기.assets || []) {
    if (!a.render_path || 본.has(a.render_path)) continue;
    본.add(a.render_path);
    const f = path.join(폴더, a.render_path);
    if (!fs.existsSync(f)) { 없음++; continue; }
    있음++;
    if (a.render_sha256 && 지문(f) !== a.render_sha256) 다름.push(a.render_path);
  }
  if (!fs.existsSync(path.join(폴더, 'do_not_publish.json'))) 다름.push('do_not_publish.json 없음');
  return { 기관: 묶음.기관들.length, 있음, 없음, 다름 };
}

async function 드라이브목록(cfg, 폴더id, 앞 = '') {
  const 모 = [];
  let 쪽 = '';
  do {
    const q = encodeURIComponent(`'${폴더id}' in parents and trashed=false`);
    const u = `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=1000&fields=${encodeURIComponent('nextPageToken,files(id,name,mimeType,md5Checksum,size,modifiedTime)')}&key=${encodeURIComponent(cfg.GDRIVE_API_KEY)}${쪽 ? '&pageToken=' + encodeURIComponent(쪽) : ''}`;
    const r = await fetch(u);
    const 글 = await r.text();
    if (!r.ok) throw new Error(`목록 HTTP ${r.status} · ${글.split(cfg.GDRIVE_API_KEY).join('‹열쇠›').slice(0, 600)}`);
    const j = JSON.parse(글);
    for (const f of j.files || []) {
      if (f.mimeType === 'application/vnd.google-apps.folder') 모.push(...await 드라이브목록(cfg, f.id, 앞 + f.name + '/'));
      else if (!f.mimeType.startsWith('application/vnd.google-apps')) 모.push({ id: f.id, 경로: 앞 + f.name, md5: f.md5Checksum || null, 크기: Number(f.size || 0), 때: f.modifiedTime });
    }
    쪽 = j.nextPageToken || '';
  } while (쪽);
  return 모;
}

async function 받기(cfg, f, 어디) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}?alt=media&key=${encodeURIComponent(cfg.GDRIVE_API_KEY)}`);
  if (!r.ok) throw new Error(`받기 ${f.경로} HTTP ${r.status} · ${(await r.text()).split(cfg.GDRIVE_API_KEY).join('‹열쇠›').slice(0, 300)}`);
  const 몸 = Buffer.from(await r.arrayBuffer());
  if (f.md5 && crypto.createHash('md5').update(몸).digest('hex') !== f.md5) throw new Error(`받기 ${f.경로} — md5 가 다름 (받는 중 바뀜)`);
  fs.mkdirSync(path.dirname(어디), { recursive: true });
  fs.writeFileSync(어디, 몸);
}

function 자기점검() {
  const 틀림 = []; const 봐 = (n, c) => { console.log((c ? '○ ' : '✗ ') + n); if (!c) 틀림.push(n); };
  const 전 = { 'a.zip': { md5: '1' }, 'institutions.json': { md5: '2' }, '옛.json': { md5: '9' } };
  const p = 계획(전, [{ 경로: 'a.zip', md5: '1' }, { 경로: 'institutions.json', md5: '3' }, { 경로: 'assets/new.png', md5: '4' }]);
  봐('계획 — md5 같은 것은 그대로', p.그대로.map((x) => x.경로).join() === 'a.zip');
  봐('계획 — 바뀐 것·새 것은 받음', p.받을.map((x) => x.경로).join() === 'institutions.json,assets/new.png');
  봐('계획 — 드라이브에서 빠진 것을 셈', p.빠짐.join() === '옛.json');
  봐('계획 — 그대로면 바뀜 없음', !계획({ 'a': { md5: '1' } }, [{ 경로: 'a', md5: '1' }]).바뀜);
  const 차례 = [{ 경로: 'institutions.json' }, { 경로: 'a.zip' }, { 경로: 'b.zip' }].sort((a, b) => Number(!/\.zip$/i.test(a.경로)) - Number(!/\.zip$/i.test(b.경로)));
  봐('차례 — ZIP 을 먼저 풀고 목록 파일은 나중에 덮음', 차례.map((x) => x.경로).join() === 'a.zip,b.zip,institutions.json');
  봐('계획 — md5 없는 파일은 늘 받음', 계획({ 'a': { md5: null } }, [{ 경로: 'a', md5: null }]).바뀜);
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), '묶음받기-'));
  fs.mkdirSync(path.join(임시, 'assets'));
  fs.writeFileSync(path.join(임시, 'assets', 'x.png'), 'X');
  const sx = crypto.createHash('sha256').update('X').digest('hex');
  const 기관 = (sha) => ({ institutions: [{ institution_ref: 'r1', assets: [{ render_path: 'assets/x.png', render_sha256: sha }, { render_path: 'assets/없음.png', render_sha256: 'z' }] }] });
  fs.writeFileSync(path.join(임시, 'institutions.json'), JSON.stringify(기관(sx)));
  fs.writeFileSync(path.join(임시, 'do_not_publish.json'), '{"blocked_institutions":[]}');
  const g = 검사(임시);
  봐('검사 — 지문 맞으면 통과 · 없는 그림은 셈만', g.다름.length === 0 && g.있음 === 1 && g.없음 === 1);
  fs.writeFileSync(path.join(임시, 'institutions.json'), JSON.stringify(기관('틀린지문')));
  봐('검사 — 그림 지문이 다르면 실패', 검사(임시).다름.length === 1);
  fs.rmSync(임시, { recursive: true });
  console.log(`\n견본 ${틀림.length ? '✗ 틀림 ' + 틀림.length : '틀림 0'}`);
  if (틀림.length) process.exit(1);
}

async function 본체() {
  const cfg = env();
  for (const k of ['GDRIVE_API_KEY', 'RAPO777_DRIVE_FOLDER']) if (!cfg[k]) { console.error(`${k} 가 .env 에 없습니다`); process.exit(1); }
  const 전상태 = fs.existsSync(상태파일) ? JSON.parse(fs.readFileSync(상태파일, 'utf8')) : { 파일: {}, 판: null };
  /* 보기용 html(작은 사진이 박힌 22MB)은 안 받습니다 — 사람이 드라이브에서 바로 엽니다 */
  const 목록 = (await 드라이브목록(cfg, cfg.RAPO777_DRIVE_FOLDER)).filter((f) => !/\.html?$/i.test(f.경로));
  /* 보기용 html·README 는 받아도 쓰지 않지만 함께 둡니다 (사람이 서버에서 볼 때) */
  const p = 계획(전상태.파일 || {}, 목록);
  console.log(`드라이브 ${목록.length}개 · 받을 것 ${p.받을.length} · 그대로 ${p.그대로.length} · 드라이브에서 빠짐 ${p.빠짐.length}`);
  p.받을.slice(0, 30).forEach((f) => console.log(`  ↓ ${f.경로} (${(f.크기 / 1e6).toFixed(1)}MB · ${f.때})`));
  if (!p.바뀜) { console.log('바뀐 것이 없습니다 — 그대로 둡니다'); return; }
  if (process.argv.includes('--마른')) { console.log('마른 실행 — 받지 않았습니다'); return; }

  const 때 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1_');   /* 초까지 — 같은 분에 두 번 받아도 안 겹침 */
  const 새판 = path.join(집, `rapo777_${때}`);
  const 받는곳 = 새판 + '.받는중';
  fs.rmSync(받는곳, { recursive: true, force: true });
  fs.mkdirSync(받는곳, { recursive: true });
  const 전판 = 전상태.판 && fs.existsSync(path.join(전상태.판, '.받은파일')) ? path.join(전상태.판, '.받은파일') : null;
  try {
    /* ① 드라이브 파일 그대로 — .받은파일/ 아래에 (ZIP 원본 보관 · 다음 판에서 복사해 씀) */
    const 원본 = path.join(받는곳, '.받은파일');
    for (const f of p.그대로) {
      const 옛 = 전판 && path.join(전판, f.경로);
      if (옛 && fs.existsSync(옛)) { fs.mkdirSync(path.dirname(path.join(원본, f.경로)), { recursive: true }); fs.copyFileSync(옛, path.join(원본, f.경로)); }
      else p.받을.push(f);
    }
    let 받은수 = 0;
    for (const f of p.받을) {   /* 진행을 찍습니다 — 큰 ZIP 을 받는 몇 분 동안 멈춘 것처럼 보이지 않게 */
      const t0 = Date.now();
      await 받기(cfg, f, path.join(원본, f.경로));
      console.log(`  ○ ${++받은수}/${p.받을.length} ${f.경로} · ${(f.크기 / 1e6).toFixed(1)}MB · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
    }
    /* ② 판 짜기 — ZIP 은 풀고, 나머지는 같은 자리로 복사 */
    const 색인f = path.join(원본, 'package_index.json');
    const 색인 = fs.existsSync(색인f) ? JSON.parse(fs.readFileSync(색인f, 'utf8')) : { archives: [] };
    /* ★ ZIP 을 **먼저 다** 풀고, 낱개 파일(최신 institutions.json 등)을 그 위에 덮습니다 —
       ZIP 안의 목록은 옛 판입니다 (README 1절 · 2026-11-17 갱신) */
    const 차례 = [...목록].sort((a, b) => Number(!/\.zip$/i.test(a.경로)) - Number(!/\.zip$/i.test(b.경로)));
    for (const f of 차례) {
      const 원 = path.join(원본, f.경로);
      if (/\.zip$/i.test(f.경로)) {
        const 적힌 = (색인.archives || []).find((a) => a.file_name === path.basename(f.경로));
        if (적힌?.sha256 && 지문(원) !== 적힌.sha256) throw new Error(`${f.경로} 지문이 package_index.json 과 다름 (아직 쓰는 중일 수 있음)`);
        const r = spawnSync('python3', ['-m', 'zipfile', '-e', 원, path.join(받는곳, path.dirname(f.경로))], { encoding: 'utf8' });
        if (r.status !== 0) throw new Error(`${f.경로} 풀기 실패 · ${(r.stderr || '').slice(0, 300)}`);
      } else {
        fs.mkdirSync(path.dirname(path.join(받는곳, f.경로)), { recursive: true });
        fs.copyFileSync(원, path.join(받는곳, f.경로));
      }
    }
    /* ③ 검사 */
    const g = 검사(받는곳);
    console.log(`검사 — 기관 ${g.기관} · 그림 있음 ${g.있음} · 아직 없음 ${g.없음} · 지문 다름 ${g.다름.length}`);
    if (g.다름.length) throw new Error('지문 다름 — ' + g.다름.slice(0, 5).join(', '));
  } catch (e) {
    fs.rmSync(받는곳, { recursive: true, force: true });
    console.error(`✗ 이번 판은 안 씁니다 — ${e.message} · ~/rapo777 는 그대로`);
    process.exit(1);
  }
  /* ④ 바꾸기 — 링크를 한 번에 */
  fs.renameSync(받는곳, 새판);
  if (fs.existsSync(링크) && !fs.lstatSync(링크).isSymbolicLink()) {
    const 옛이름 = path.join(집, `rapo777_처음_${때}`);
    fs.renameSync(링크, 옛이름);
    console.log(`  처음 있던 폴더를 ${옛이름} 로 옮겼습니다`);
  }
  const 임시링크 = 링크 + '.새';
  fs.rmSync(임시링크, { force: true });
  fs.symlinkSync(새판, 임시링크);
  fs.renameSync(임시링크, 링크);
  fs.writeFileSync(상태파일, JSON.stringify({ 판: 새판, 받은때: new Date().toISOString(), 파일: Object.fromEntries(목록.map((f) => [f.경로, { md5: f.md5, 때: f.때 }])) }, null, 2));
  console.log(`● ~/rapo777 → ${새판}`);
  /* ⑤ 전 판은 셋까지 · 지금 판이 아닌 판의 .받은파일(ZIP 원본 사본)은 지움 — 다음 판은 지금 판에서만 복사합니다 */
  const 판들 = fs.readdirSync(집).filter((n) => /^rapo777_\d{8}_\d{6}$/.test(n)).sort();
  for (const n of 판들.slice(0, Math.max(0, 판들.length - 3))) { fs.rmSync(path.join(집, n), { recursive: true, force: true }); console.log(`  옛 판 지움 ${n}`); }
  for (const n of 판들) if (path.join(집, n) !== 새판) fs.rmSync(path.join(집, n, '.받은파일'), { recursive: true, force: true });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--자기점검')) 자기점검();
  else await 본체();
}
