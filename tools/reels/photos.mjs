/* 기관 전경 사진 — 고르기 · 받기 · 지문 확인 (2026-11-16)

   2026-11-16 세중님 「사진 모두 사용하고 출처는 적자 · 문제있다고 하면 그때 내릴게」
   → 사진이 있는 기관은 다 씁니다. 화면 맨 아래에 「출처: <병원 이름>」.
   → 기관이 내려 달라고 하면 내림목록.json 에 그 기관 이름을 한 줄 더합니다 (그 뒤로 안 씀)

   목록   photo-list.json (드라이브 병원이미지_수집 의 photo 152장 · 125곳)
   받기   병원 공식 사이트 원본 주소(asset_url)에서 받고 **sha256 이 드라이브 것과 같아야** 씁니다.
          다르면(사이트가 그림을 바꿈) 안 쓰고 알립니다 — 확인 안 된 그림을 올리지 않습니다
   둘 곳  tools/reels/photo-cache/<sha 앞 16>.<확장자>  (저장소 밖 · .gitignore)

   node tools/reels/photos.mjs --기관 전남대학교병원    한 곳 받기
   node tools/reels/photos.mjs --모두                    152장 다 받기 (서버에서 한 번) */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
export const 사진터 = path.join(여기, 'photo-cache');
const 목록 = JSON.parse(fs.readFileSync(path.join(여기, 'photo-list.json'), 'utf8')).사진;
const 내림파일 = path.join(여기, '내림목록.json');
const 내림 = fs.existsSync(내림파일) ? JSON.parse(fs.readFileSync(내림파일, 'utf8')) : [];

/* 이름 맞추기 — 띄어쓰기 · 법인 머리 · 「부속」을 뗍니다 (고려대학교의과대학부속구로병원 ↔ …의과대학구로병원) */
export const 이름키 = (s) => String(s || '').replace(/\s+/g, '').replace(/^(학교법인|의료법인|사회복지법인|재단법인)/, '').replace(/부속/g, '');

/* 그 기관의 사진 하나 — 가로 사진 가운데 가장 큰 것 */
export function 사진고르기(이름들) {
  const 키들 = 이름들.filter(Boolean).map(이름키);
  if (내림.map(이름키).some((k) => 키들.includes(k))) return null;
  const 후보 = 목록.filter((x) => 키들.includes(이름키(x.key)) || 키들.includes(이름키(x.name)));
  if (!후보.length) return null;
  후보.sort((a, b) => (b.width >= b.height) - (a.width >= a.height) || b.width - a.width);
  return 후보[0];
}

const 확장자 = (x) => (/\.png$/i.test(x.upload_name) ? '.png' : '.jpg');
export const 캐시경로 = (x) => path.join(사진터, x.sha256.slice(0, 16) + 확장자(x));

/* 받아 두고 경로를 줍니다. 이미 있으면 그대로 */
export async function 사진받기(x) {
  const f = 캐시경로(x);
  if (fs.existsSync(f)) return { 파일: f };
  fs.mkdirSync(사진터, { recursive: true });
  let r;
  try {
    r = await fetch(x.asset_url, { headers: { 'user-agent': 'Mozilla/5.0', referer: x.source_page || '' }, signal: AbortSignal.timeout(20000) });
  } catch (e) { return { 못함: '받기 실패 ' + String(e.message || e).slice(0, 80) }; }
  if (!r.ok) return { 못함: 'HTTP ' + r.status };
  const 몸 = Buffer.from(await r.arrayBuffer());
  const 지문 = crypto.createHash('sha256').update(몸).digest('hex');
  if (지문 !== x.sha256) return { 못함: `지문 다름 (사이트가 그림을 바꿨을 수 있음) · 받은 ${몸.length}바이트 앞 4 ${몸.subarray(0, 4).toString('hex')}` };
  fs.writeFileSync(f, 몸);
  return { 파일: f };
}

/* 기관 이름(들) → { 파일, 출처 } 또는 null */
export async function 기관사진(이름들) {
  const x = 사진고르기(이름들);
  if (!x) return null;
  const r = await 사진받기(x);
  if (!r.파일) { console.log(`  사진 못 씀 ${x.key} — ${r.못함}`); return null; }
  return { 파일: r.파일, 출처: x.name || x.key };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const i = process.argv.indexOf('--기관');
  const 대상 = i > 0 ? [사진고르기([process.argv[i + 1]])].filter(Boolean)
    : process.argv.includes('--모두') ? 목록 : [];
  if (!대상.length) { console.log('대상 없음 — --기관 <이름> 또는 --모두'); process.exit(1); }
  let 됨 = 0; const 안됨 = [];
  for (const x of 대상) {
    const r = await 사진받기(x);
    if (r.파일) 됨++; else 안됨.push(`${x.key} · ${r.못함}`);
  }
  console.log(`사진 ${대상.length}장 · 받음 ${됨} · 못 받음 ${안됨.length}`);
  안됨.forEach((s) => console.log('  ✗ ' + s));
}
