/* 릴스를 세중님 구글 드라이브 「RAPO 릴스/<YYYY-MM>」 폴더에 올립니다 (2026-11-16 세중님 「드라이브에 올리는 게 좋지 않을까」)

   권한   drive.file — **이 도구가 만든 파일·폴더만** 보고 씁니다. 드라이브의 다른 파일은 못 봅니다
   인증   「TV·입력 제한 기기」 방식 — 서버 화면에 뜬 코드를 휴대폰에서 넣어 허락합니다 (한 번)
   열쇠   서버 .env 의 GDRIVE_CLIENT_ID · GDRIVE_CLIENT_SECRET · GDRIVE_REFRESH_TOKEN
          값은 화면에 안 찍습니다 (지침 8-11) — 길이와 앞 4글자만

   node tools/reels/drive.mjs --인증 [--새로]   처음 한 번 (--새로 = ID·비밀번호를 다시 넣음) (클라이언트 ID·비밀번호를 물어 .env 에 적고, 코드를 띄웁니다)
   node tools/reels/drive.mjs --시험     글 파일 하나를 올려 링크를 찍습니다

   ★ 2026-11-16 에 구글 문서 원문을 못 열었습니다 (이 세션에서 developers.google.com 막힘).
     응답이 기다린 꼴이 아니면 **원문 앞 600자**를 찍고 멈춥니다. 첫 실행에서 맞춥니다 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(여기, '..', '..');
const ENV = path.join(ROOT, '.env');
const 폴더기록 = path.join(ROOT, 'log', '릴스_드라이브폴더.json');
const 범위 = 'https://www.googleapis.com/auth/drive.file';

function env() {
  const out = {};
  for (const f of [ENV, path.join(ROOT, '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return { ...out, ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v)) };
}

/* .env 한 줄 넣기·바꾸기 — 값은 찍지 않습니다. 권한(600 등)은 그대로 둡니다 */
function env적기(이름, 값) {
  const 글 = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : '';
  const 줄 = `${이름}=${값}`;
  const 새글 = new RegExp(`^${이름}=.*$`, 'm').test(글)
    ? 글.replace(new RegExp(`^${이름}=.*$`, 'm'), 줄)
    : 글.replace(/\n?$/, '\n') + 줄 + '\n';
  fs.writeFileSync(ENV, 새글);
  console.log(`  .env 에 ${이름} 적음 · 길이 ${값.length} · 앞 4 ${값.slice(0, 4)}`);
}

const 원문 = (t) => String(t).slice(0, 600);

async function 접근열쇠(cfg) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.GDRIVE_CLIENT_ID, client_secret: cfg.GDRIVE_CLIENT_SECRET,
      refresh_token: cfg.GDRIVE_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  });
  const t = await r.text();
  let j = {}; try { j = JSON.parse(t); } catch { /* 아래에서 원문 */ }
  if (!r.ok || !j.access_token) throw new Error(`접근 열쇠 못 받음 HTTP ${r.status} · ${원문(t).replace(cfg.GDRIVE_CLIENT_SECRET || '\u0000', '‹비밀›')}`);
  return j.access_token;
}

export function 드라이브되나(cfg = env()) {
  return Boolean(cfg.GDRIVE_CLIENT_ID && cfg.GDRIVE_CLIENT_SECRET && cfg.GDRIVE_REFRESH_TOKEN);
}

async function 폴더(tok, 이름, 부모) {
  const 기록 = fs.existsSync(폴더기록) ? JSON.parse(fs.readFileSync(폴더기록, 'utf8')) : {};
  const 열쇠 = (부모 || 'root') + '/' + 이름;
  if (기록[열쇠]) return 기록[열쇠];
  const r = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 이름, mimeType: 'application/vnd.google-apps.folder', ...(부모 ? { parents: [부모] } : {}) }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`폴더 못 만듦 HTTP ${r.status} · ${원문(t)}`);
  기록[열쇠] = JSON.parse(t).id;
  fs.mkdirSync(path.dirname(폴더기록), { recursive: true });
  fs.writeFileSync(폴더기록, JSON.stringify(기록, null, 2));
  return 기록[열쇠];
}

async function 파일올리기(tok, 파일, 이름, 종류, 부모) {
  const 시작 = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': 종류 },
    body: JSON.stringify({ name: 이름, parents: [부모] }),
  });
  const 갈곳 = 시작.headers.get('location');
  if (!시작.ok || !갈곳) throw new Error(`올리기 시작 못 함 HTTP ${시작.status} · ${원문(await 시작.text())}`);
  const r = await fetch(갈곳, { method: 'PUT', headers: { 'content-type': 종류 }, body: fs.readFileSync(파일) });
  const t = await r.text();
  if (!r.ok) throw new Error(`올리기 못 함 HTTP ${r.status} · ${원문(t)}`);
  return JSON.parse(t);   /* { id, webViewLink } */
}

/* 릴스 한 편 — 영상 · 표지 · 캡션 글을 「RAPO 릴스/<YYYY-MM>/」 에. 영상 링크를 돌려줍니다 */
export async function 릴스올리기({ mp4, 표지, 카드 = [], 캡션, 이름, 달 }) {
  const cfg = env();
  const tok = await 접근열쇠(cfg);
  const 위 = await 폴더(tok, 'RAPO 릴스', null);
  const 아래 = await 폴더(tok, 달, 위);
  const 영상 = await 파일올리기(tok, mp4, 이름 + '.mp4', 'video/mp4', 아래);
  if (표지 && fs.existsSync(표지)) await 파일올리기(tok, 표지, 이름 + '-표지.jpg', 'image/jpeg', 아래);
  /* 카드뉴스 (2026-11-17) — 같은 폴더에 「…-카드1.jpg」… */
  for (const [i, f] of 카드.entries()) if (fs.existsSync(f)) await 파일올리기(tok, f, `${이름}-카드${i + 1}.jpg`, 'image/jpeg', 아래);
  if (캡션) {
    const f = mp4.replace(/\.mp4$/, '-캡션.txt');
    fs.writeFileSync(f, 캡션 + '\n');
    await 파일올리기(tok, f, 이름 + '-캡션.txt', 'text/plain', 아래);
  }
  return 영상.webViewLink;
}

/* ── 처음 한 번: 인증 ── */
async function 인증() {
  const 새로 = process.argv.includes('--새로');      /* 잘못 넣은 ID·비밀번호를 다시 넣을 때 */
  const cfg = env();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (새로 || !cfg.GDRIVE_CLIENT_ID) {
    const id = (await rl.question('클라이언트 ID 를 붙여 넣으세요 (….apps.googleusercontent.com 으로 끝납니다): ')).trim();
    if (!/^[0-9]+-[0-9a-z]+\.apps\.googleusercontent\.com$/.test(id)) {
      console.error(`  ✗ 클라이언트 ID 모양이 아닙니다 · 길이 ${id.length} · 앞 4 ${id.slice(0, 4)} · 끝 ${id.slice(-12)} — 다시 복사해 주세요`); rl.close(); process.exit(1);
    }
    env적기('GDRIVE_CLIENT_ID', id);
  }
  if (새로 || !cfg.GDRIVE_CLIENT_SECRET) env적기('GDRIVE_CLIENT_SECRET', (await rl.question('클라이언트 보안 비밀번호를 붙여 넣으세요 (GOCSPX- 로 시작): ')).trim());
  rl.close();
  const c = env();
  const r = await fetch('https://oauth2.googleapis.com/device/code', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.GDRIVE_CLIENT_ID, scope: 범위 }),
  });
  const t = await r.text();
  let d = {}; try { d = JSON.parse(t); } catch { /* 아래 */ }
  if (!r.ok || !d.device_code) { console.error(`코드 못 받음 HTTP ${r.status} · ${원문(t)}`); process.exit(1); }
  console.log(`\n휴대폰(또는 PC)에서 열기:  ${d.verification_url || d.verification_uri}\n넣을 코드:               ${d.user_code}\n(${Math.round(d.expires_in / 60)}분 안에 · 세중님 구글 계정으로 「허용」)\n`);
  let 쉼 = (d.interval || 5) * 1000;
  for (const 끝 = Date.now() + d.expires_in * 1000; Date.now() < 끝;) {
    await new Promise((z) => setTimeout(z, 쉼));
    const p = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: c.GDRIVE_CLIENT_ID, client_secret: c.GDRIVE_CLIENT_SECRET,
        device_code: d.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
    });
    const pt = await p.text();
    let j = {}; try { j = JSON.parse(pt); } catch { /* 아래 */ }
    if (j.refresh_token) { env적기('GDRIVE_REFRESH_TOKEN', j.refresh_token); console.log('허락 받음 · 이제 --시험'); return; }
    if (j.error === 'authorization_pending') continue;
    if (j.error === 'slow_down') { 쉼 += 5000; continue; }
    console.error(`멈춤 HTTP ${p.status} · ${원문(pt).replace(c.GDRIVE_CLIENT_SECRET, '‹비밀›')}`); process.exit(1);
  }
  console.error('시간이 지났습니다 — 다시 --인증'); process.exit(1);
}

async function 시험() {
  const f = path.join(ROOT, 'log', 'reels-drive-test.txt');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, `RAPO 릴스 드라이브 시험 ${new Date().toISOString()}\n`);
  const tok = await 접근열쇠(env());
  const 위 = await 폴더(tok, 'RAPO 릴스', null);
  const 파일 = await 파일올리기(tok, f, '시험-지워도-됨.txt', 'text/plain', 위);
  console.log('올림 →', 파일.webViewLink);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--인증')) await 인증();
  else if (process.argv.includes('--시험')) await 시험();
  else console.log('--인증 또는 --시험');
}
