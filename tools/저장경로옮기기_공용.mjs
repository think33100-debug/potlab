/* 저장소(Storage) 파일을 「회원 id 없는 경로」로 옮기는 도구들의 공용 부품 (2026-11-11).
 *
 * 쓰는 곳 — tools/프로필사진경로옮기기.mjs
 *   (글 사진 옮기기 tools/글사진경로옮기기.mjs 도 같은 부품을 따로 갖고 있습니다 —
 *    두 가지가 다 합쳐지면 그쪽도 이 파일을 부르게 줄입니다 · 작업지침 6-3)
 *
 * 들어 있는 것 — 열쇠 읽기 · 머리글 · 열쇠 가리기 · 공개 주소 · 복사 · 열리나 ·
 *                되돌림 자리(~/되돌림 · 8-19) · 날짜 · SQL 글자 · 옛 파일 지우기
 *
 * 열쇠 — SUPABASE_URL · SUPABASE_SERVICE_KEY(또는 SUPABASE_SERVICE_ROLE_KEY).
 *   .env 를 셸에 먹이지 않고 node 로 읽습니다 (8-12). 열쇠 값은 찍지 않습니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));

function env() {
  const out = {};
  for (const f of ['.env.local', '.env', 'web/.env.local'].map((x) => path.join(여기, '..', x))) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);   /* 이름 없는 줄은 버립니다 */
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  return out;
}

/** 열쇠·주소·머리글을 한 번에 냅니다. 없으면 멈춥니다 (값은 안 찍습니다) */
export function 연결() {
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
  return { URL_, H, 가림 };
}

export function 공개주소(URL_, 통, 길) {
  return `${URL_}/storage/v1/object/public/${통}/${길.split('/').map(encodeURIComponent).join('/')}`;
}

/** 같은 통 안에서 복사합니다 (옮기기 아님 — 옛 파일은 남습니다) */
export async function 복사({ URL_, H, 가림 }, 통, 옛, 새) {
  const r = await fetch(`${URL_}/storage/v1/object/copy`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ bucketId: 통, sourceKey: 옛, destinationKey: 새 }),
  });
  if (!r.ok) throw new Error(`복사 실패 HTTP ${r.status} ${가림(await r.text()).slice(0, 200)}`);
}

/** 공개 주소로 열리나 — 화면이 쓰는 길 그대로 봅니다 */
export async function 열리나(URL_, 통, 길) {
  const r = await fetch(공개주소(URL_, 통, 길), { method: 'HEAD' });
  return r.ok;
}

export function 되돌림터() {
  const 터 = path.join(os.homedir(), '되돌림');
  fs.mkdirSync(터, { recursive: true });
  return 터;
}

/** 20261111_1530 꼴 (KST) — 되돌림 파일 이름에 붙여 덮지 않게 합니다 */
export function 날짜() {
  const d = new Date(Date.now() + 9 * 3600_000).toISOString();
  return d.slice(0, 10).replace(/-/g, '') + '_' + d.slice(11, 16).replace(':', '');
}

export const sql문자 = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** 옛 파일을 100개씩 지웁니다. 지운 수와 지울 수가 같아야 0 을 돌려줍니다 (8-26) */
export async function 파일지우기({ URL_, H, 가림 }, 통, 목록) {
  const 덩이 = 100;
  let 지운 = 0;
  for (let i = 0; i < 목록.length; i += 덩이) {
    const 이번 = 목록.slice(i, i + 덩이);
    const d = await fetch(`${URL_}/storage/v1/object/${통}`, {
      method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: 이번 }) });
    if (!d.ok) { console.error(`  ✗ 지우기 실패 HTTP ${d.status} ${가림(await d.text()).slice(0, 200)}`); return 1; }
    const 결과 = await d.json();
    지운 += Array.isArray(결과) ? 결과.length : 0;
  }
  console.log(`지운 옛 파일 ${지운}개 (지울 것 ${목록.length}개)`);
  return 지운 === 목록.length ? 0 : 1;
}

/** 통의 맨 위 폴더 아래 파일 목록 (폴더 한 겹) — 이름 차례로 받습니다 (8-20 ③) */
export async function 폴더목록({ URL_, H }, 통, 앞) {
  const 모두 = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${URL_}/storage/v1/object/list/${통}`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ prefix: 앞, limit: 1000, offset: off, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!r.ok) throw new Error(`목록 ${통}/${앞} → HTTP ${r.status}`);
    const 쪽 = await r.json();
    모두.push(...쪽);
    if (쪽.length < 1000) return 모두;
  }
}
