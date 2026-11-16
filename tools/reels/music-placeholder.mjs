/* 자리 채움 배경음 — 우리가 직접 합성한 소리라 저작권 걱정이 없습니다 (2026-11-16)
   진짜 곡이 정해지면 render.mjs --음악 <파일> 로 바꿔 끼웁니다. 이 파일은 그때까지의 자리입니다.

   C - Am - F - G 네 마디 패드 + 8분 아르페지오 + 약한 킥. 15초 · 44.1kHz · 스테레오 · WAV
   node tools/reels/music-placeholder.mjs <나갈.wav> [초] */
import fs from 'node:fs';

const out = process.argv[2] || 'placeholder.wav';
const SEC = Number(process.argv[3] || 15);
const SR = 44100, N = Math.round(SR * SEC);
const L = new Float32Array(N), R = new Float32Array(N);

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const BPM = 96, beat = 60 / BPM, bar = beat * 4;
const 마디 = [[48, 55, 60, 64, 67], [45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62]];

for (let i = 0; i < N; i++) {
  const t = i / SR;
  const b = Math.floor(t / bar) % 4, tb = t % bar;
  const ch = 마디[b];
  /* 패드 — 부드럽게 들어오고 나가는 사인 겹침 */
  const env = Math.min(1, tb / 0.4) * Math.min(1, (bar - tb) / 0.3);
  let pad = 0;
  for (const m of ch.slice(1)) pad += Math.sin(2 * Math.PI * hz(m) * t) + 0.3 * Math.sin(2 * Math.PI * hz(m) * 2.003 * t);
  pad *= 0.045 * env;
  /* 베이스 */
  const bass = 0.12 * Math.sin(2 * Math.PI * hz(ch[0] - 12) * t) * Math.min(1, tb / 0.05) * Math.exp(-((tb % (beat * 2)) * 1.2));
  /* 아르페지오 — 8분음표 */
  const step = beat / 2, k = Math.floor(tb / step), ts = tb % step;
  const note = ch[[1, 2, 3, 4, 3, 2, 3, 4][k % 8]] + 12;
  const pl = 0.09 * Math.exp(-ts * 7) * (Math.sin(2 * Math.PI * hz(note) * t) + 0.25 * Math.sin(2 * Math.PI * hz(note) * 3 * t));
  /* 킥 — 박마다, 짧게 */
  const tk = t % beat;
  const kick = 0.22 * Math.exp(-tk * 22) * Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-tk * 40)) * tk);
  const 끝 = Math.min(1, (SEC - t) / 1.2) * Math.min(1, t / 0.3);  /* 앞뒤 페이드 */
  L[i] = (pad + bass + pl * 0.8 + kick) * 끝;
  R[i] = (pad + bass + pl * 1.1 + kick) * 끝;
}

const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
}
fs.writeFileSync(out, buf);
console.log('배경음', out, SEC + '초');
