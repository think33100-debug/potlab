/* 인스타에 지금 올라가 있는 게시물을 글 앞머리와 함께 찍고, 겹치는 것(같은 기관 줄 + 같은 조건·접수 줄)을 묶어 보여 줍니다
   — 원격 할일 post-list (2026-11-26 세중님 「지금 겹치는 것들 있는 거 같은데 확인해」). 읽기만 합니다 */
import { env, 인스타되나, 그래프 } from './ig.mjs';
const cfg = env();
if (!인스타되나(cfg)) { console.error('IG 열쇠가 없습니다'); process.exit(1); }
const 열쇠 = encodeURIComponent(cfg.IG_ACCESS_TOKEN);
let 길 = `/${cfg.IG_USER_ID}/media?fields=id,timestamp,permalink,media_type,media_product_type,caption,comments_count,like_count&limit=50&access_token=${열쇠}`;
const 모두 = [];
for (let i = 0; i < 4 && 길; i++) {
  const r = await 그래프(cfg, 길, {}, { 조용히: true }).catch((e) => { console.error('✗ ' + String(e.message || e).slice(0, 200)); process.exit(1); });
  모두.push(...(r.data || []));
  const 다음 = r.paging?.next; 길 = 다음 ? 다음.replace(/^https:\/\/graph\.facebook\.com\/v[0-9.]+/, '') : null;
}
console.log(`게시물 ${모두.length}개`);
const 묶음 = new Map();
for (const m of 모두) {
  const 줄 = String(m.caption || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const 때 = new Date(Date.parse(m.timestamp) + 9 * 3600e3).toISOString().slice(5, 16).replace('T', ' ');
  console.log(`· ${때} · ${m.media_product_type || m.media_type} · ${m.permalink} · 좋아요 ${m.like_count ?? '?'} · 댓글 ${m.comments_count ?? '?'}`);
  for (const l of 줄.slice(0, 4)) console.log(`    ${l.slice(0, 110)}`);
  const k = `${m.media_product_type || m.media_type}|${줄[1] || ''}|${줄[2] || ''}|${(줄[3] || '').split('·')[0]}`;
  if (줄.length >= 3) 묶음.set(k, [...(묶음.get(k) || []), m]);
}
const 겹 = [...묶음.entries()].filter(([, v]) => v.length > 1);
console.log(`\n겹치는 묶음 ${겹.length}개 (같은 갈래 · 같은 기관 줄 · 같은 조건 줄 · 같은 접수 줄)`);
for (const [k, v] of 겹) { console.log(`  ${k}`); for (const m of v) console.log(`    - ${m.permalink} · ${m.timestamp} · 좋아요 ${m.like_count ?? '?'} · 댓글 ${m.comments_count ?? '?'}`); }
