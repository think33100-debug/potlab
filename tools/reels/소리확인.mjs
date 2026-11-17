/* 올라간 게시물·스토리의 영상에 소리가 있나 — 인스타가 준 media_url 을 받아 ffprobe · volumedetect (2026-11-18 세중님 「왜 소리도 없어?」)
   node tools/reels/소리확인.mjs <게시물ID>      원격: sound-check <게시물ID> */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { env, 그래프 } from './ig.mjs';

const id = process.argv[2];
if (!/^[0-9]{6,30}$/.test(id || '')) { console.error('게시물ID(숫자)가 필요합니다'); process.exit(2); }
const cfg = env();
const m = await 그래프(cfg, `/${id}?fields=media_type,media_product_type,media_url,timestamp&access_token=${encodeURIComponent(cfg.IG_ACCESS_TOKEN)}`);
if (!m.media_url) { console.error('✗ media_url 이 없습니다'); process.exit(1); }
const f = path.join(os.tmpdir(), `ig-${id}.mp4`);
const r = await fetch(m.media_url);
fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
console.log(`받음 ${(fs.statSync(f).size / 1e6).toFixed(2)}MB · ${m.media_product_type || ''} ${m.media_type || ''}`);
const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,duration', '-of', 'compact', f], { encoding: 'utf8' });
console.log(p.stdout.trim());
const v = spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' });
console.log((v.stderr.match(/(mean|max)_volume: [-0-9.]+ dB/g) || ['소리 줄 없음']).join(' · '));
fs.unlinkSync(f);
