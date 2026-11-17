/* 하이라이트용 R 로고 화면을 스토리로 올립니다 (2026-11-18 세중님 「하이라이트였던 로고 화면 4개 다시 · 4 5 6 7」)

   node tools/reels/로고스토리.mjs 4-5-6-7            마른 실행 — 무엇을 올릴지만
   node tools/reels/로고스토리.mjs 4-5-6-7 --실행     올림 (번호 차례대로)
   원격: logo-stories (job_id = 4-5-6-7)

   그림은 profile-kit.mjs 의 logo-highlight (1080×1920 · 원에 안 잘리게 작은 R) 를 그대로 다시 만들어 jpg 로 바꿉니다.
   ★ 하이라이트에 넣는 것은 API 로 못 합니다 — 인스타 앱에서 하이라이트 편집으로 넣습니다 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { env, 스토리사진올리기IG } from './ig.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(여기, '..', '..');
const 나감 = path.join(ROOT, 'log', 'reels', 'profile-kit');
const 발행기록파일 = path.join(ROOT, 'log', '릴스_발행기록.jsonl');
const 번호들 = String(process.argv[2] || '').split('-').filter(Boolean).map((x) => x.padStart(2, '0'));
if (!번호들.length || 번호들.some((n) => !/^[0-9]{2}$/.test(n))) { console.error('번호를 4-5-6-7 꼴로'); process.exit(2); }

const r = spawnSync(process.execPath, [path.join(여기, 'profile-kit.mjs'), 나감], { encoding: 'utf8' });
if (r.status !== 0) { console.error('✗ 그림을 못 만듦 —', (r.stderr || '').slice(-300)); process.exit(1); }
const 폴더 = path.join(나감, 'logo-highlight');
const 파일들 = 번호들.map((n) => fs.readdirSync(폴더).find((f) => f.startsWith(n + '-') && f.endsWith('.png')));
if (파일들.some((f) => !f)) { console.error('✗ 없는 번호 —', 번호들.filter((_, i) => !파일들[i]).join(', ')); process.exit(1); }
for (const f of 파일들) console.log(`  · ${f}`);
if (!process.argv.includes('--실행')) { console.log('마른 실행 — 올리지 않았습니다'); process.exit(0); }

const cfg = env();
for (const f of 파일들) {
  const jpg = path.join(폴더, f.replace(/\.png$/, '.jpg'));
  spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(폴더, f), '-q:v', '2', jpg]);
  try {
    const 올림 = await 스토리사진올리기IG(cfg, jpg, 'logo-' + f.replace(/\.png$/, ''));
    fs.appendFileSync(발행기록파일, JSON.stringify({ 때: new Date().toISOString(), 결과: '성공', 길: '로고 스토리(하이라이트용)', 기관: f, 게시물ID: 올림.media_id, 게시물주소: 올림.주소 }) + '\n');
    console.log(`● ${f} → 스토리 ${올림.media_id} · ${올림.주소 || ''}`);
  } catch (e) { console.error(`✗ ${f} — ${String(e.message || e).slice(0, 300)}`); }
  await new Promise((z) => setTimeout(z, 2000));
}
