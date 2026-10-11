/* 「시험 배너」 그림을 만들어 올리고 켭니다 (2026-10-11 · 세중님 결정 ②).
 *
 *   node tools/시험배너만들기.mjs            만들기만 (바탕에 안 올림)
 *   node tools/시험배너만들기.mjs --올리기     ad-images 에 올리고 켭니다
 *
 * 왜 — 배너 둘이 다 꺼져 있어 **모양을 한 번도 못 봤습니다.**
 * 진짜 광고처럼 보이면 안 되므로 **빗금 바탕에 「시험 배너」**만 큼직하게
 * 적습니다. `광고배너.시험자료` 를 켜서 **관리자·마스터에게만** 보입니다.
 *
 * 저장소 열쇠는 **영문**입니다 (작업지침 6-2b) — 자리 이름을 app/community 로.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const 올릴까 = process.argv.includes('--올리기');

const cfg = {};
for (const f of [path.join(뿌리, '.env'), path.join(뿌리, '.env.local')]) {
  if (!fs.existsSync(f)) continue;
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
}
for (const k of Object.keys(process.env)) if (process.env[k]) cfg[k] = process.env[k];

const 너비 = 1200, 높이 = 400;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${너비}" height="${높이}">
  <defs>
    <pattern id="빗금" width="40" height="40" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill="#F3F4F6"/>
      <rect width="20" height="40" fill="#E5E7EB"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#빗금)"/>
  <rect x="24" y="24" width="${너비 - 48}" height="${높이 - 48}" fill="#FFFFFF" fill-opacity="0.88"
        stroke="#9CA3AF" stroke-width="4" stroke-dasharray="16 12"/>
  <text x="50%" y="44%" text-anchor="middle" font-size="96" font-weight="bold"
        fill="#374151" font-family="Malgun Gothic, Apple SD Gothic Neo, NanumGothic, sans-serif">시험 배너</text>
  <text x="50%" y="63%" text-anchor="middle" font-size="40"
        fill="#6B7280" font-family="Malgun Gothic, Apple SD Gothic Neo, NanumGothic, sans-serif">TEST BANNER — NOT A REAL AD</text>
  <text x="50%" y="78%" text-anchor="middle" font-size="30"
        fill="#9CA3AF" font-family="Malgun Gothic, Apple SD Gothic Neo, NanumGothic, sans-serif">관리자·마스터에게만 보입니다 (2026-10-11)</text>
</svg>`;

import { pathToFileURL } from 'node:url';
const sharp = (await import(pathToFileURL(path.join(뿌리, 'web', 'node_modules', 'sharp', 'dist', 'index.mjs')).href)).default;
const 낼곳 = path.join(뿌리, 'tmp', '시험배너.png');
fs.mkdirSync(path.dirname(낼곳), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(낼곳);
console.log('그림을 만들었습니다 — ' + 낼곳 + ' (' + fs.statSync(낼곳).size + '바이트)');

if (!올릴까) { console.log('--올리기 를 주면 ad-images 에 올리고 켭니다.'); process.exit(0); }

const URL_ = cfg.SUPABASE_URL, KEY = cfg.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(2); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

/* 자리 이름이 한글(앱·커뮤니티)이라 **경로에는 영문**을 씁니다 (6-2b) */
const 길 = 'app/test-banner.png';
const up = await fetch(`${URL_}/storage/v1/object/ad-images/${길}`, {
  method: 'POST', headers: { ...H, 'Content-Type': 'image/png', 'x-upsert': 'true' },
  body: fs.readFileSync(낼곳),
});
console.log('올리기 → HTTP ' + up.status + (up.ok ? '' : ' · ' + (await up.text()).slice(0, 140)));
if (!up.ok) process.exit(1);

const 그림주소 = `${URL_}/storage/v1/object/public/ad-images/${길}`;
const r = await fetch(`${URL_}/rest/v1/${encodeURIComponent('광고배너')}?${encodeURIComponent('자리')}=eq.${encodeURIComponent('앱')}`, {
  method: 'PATCH',
  headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify({
    이름: '시험 배너 (2026-10-11 · 10/25 에 치웁니다)',
    그림: 그림주소, 링크: null, 표시초: 2, 켜짐: true,
    시작일: null, 끝일: null, 시험자료: true,
  }),
});
const j = await r.text();
console.log('배너 켜기 → HTTP ' + r.status + ' · ' + j.replace(/\s+/g, ' ').slice(0, 160));
