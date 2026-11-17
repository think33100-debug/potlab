/* 인스타그램 — 열쇠 만들기 · 열쇠 확인 · 릴스 올리기 · 게시물 지우기 한 자리 (2026-11-17)

   node tools/reels/ig.mjs --열쇠      처음 한 번 (서버에서). 앱 ID · 앱 비밀번호 · 그래프 API 탐색기의 짧은 토큰을 물어
                                      → 긴 토큰으로 바꾸고 → 페이지 토큰 · 연결된 인스타 비즈니스 계정 ID 를 찾아 .env 에 적습니다
   node tools/reels/ig.mjs --확인      열쇠가 듣나 — 계정 이름 · 토큰 만료 · 받은 권한을 찍습니다 (값은 안 찍음)

   길   Instagram API with **Facebook Login** (graph.facebook.com). 릴스 파일을 바로 올리는 resumable 업로드는 이쪽만 됩니다.
        ① POST /{IG_USER_ID}/media  media_type=REELS · upload_type=resumable · caption
        ② POST rupload.facebook.com/ig-api-upload/{ver}/{컨테이너}  Authorization: OAuth · offset 0 · file_size
        ③ GET  /{컨테이너}?fields=status_code,status  — FINISHED 까지
        ④ POST /{IG_USER_ID}/media_publish  creation_id
        지우기  DELETE /{media_id}  (2025-12 메타 블로그 「IG Media Deleting API」 · instagram_manage_contents 권한)
   ★ 2026-11-17 — 이 세션에서 developers.facebook.com 이 막혀 명세 원문을 못 열었습니다. 검색 요약으로 줄기만 맞췄습니다.
     그래서 응답마다 **원문 앞 600자**를 (열쇠를 가리고) 찍습니다. 첫 실제 호출에서 칸 이름을 맞추고 이 주석을 고칩니다.
   열쇠 값은 화면에 안 찍습니다 (지침 8-11) — 길이와 앞 4글자만 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(여기, '..', '..');
const ENV = path.join(ROOT, '.env');

export function env() {
  const out = {};
  for (const f of [ENV, path.join(ROOT, '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  const 다 = { ...out, ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v)) };
  다.SUPABASE_URL = 다.SUPABASE_URL || 다.NEXT_PUBLIC_SUPABASE_URL;
  return 다;
}
function env적기(이름, 값) {
  const 글 = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : '';
  const 줄 = `${이름}=${값}`;
  const 새글 = new RegExp(`^${이름}=.*$`, 'm').test(글) ? 글.replace(new RegExp(`^${이름}=.*$`, 'm'), () => 줄) : 글.replace(/\n?$/, '\n') + 줄 + '\n';
  fs.writeFileSync(ENV, 새글);
  console.log(`  .env 에 ${이름} 적음 · 길이 ${값.length} · 앞 4 ${값.slice(0, 4)}`);
}

export const 인스타되나 = (cfg) => !!(cfg.IG_USER_ID && cfg.IG_ACCESS_TOKEN);
const 버전 = (cfg) => cfg.IG_GRAPH_VERSION || 'v23.0';
const 가리개 = (cfg) => (s) => [cfg.IG_ACCESS_TOKEN, cfg.META_APP_SECRET].filter(Boolean)
  .reduce((a, k) => a.split(k).join('‹열쇠›'), String(s));

export async function 그래프(cfg, 길, 옵션 = {}) {
  const r = await fetch(`https://graph.facebook.com/${버전(cfg)}${길}`, 옵션);
  const 글 = await r.text();
  console.log(`    ${옵션.method || 'GET'} ${길.split('?')[0]} → ${r.status} · ${가리개(cfg)(글).slice(0, 600)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status} · ${가리개(cfg)(글).slice(0, 200)}`);
  return JSON.parse(글);
}

/** mp4 한 편을 릴스로 올립니다 → { media_id } (실패하면 던짐)
 *  커버(jpg)가 있으면 reels-cards 버킷에 잠깐 올려 cover_url 로 넘기고, 끝나면 지웁니다 (2026-11-17 세중님 「커버 따로」) */
export async function 릴스올리기IG(cfg, mp4, 캡션, { 커버 = null, 열쇠 = 'reel', 스토리 = false } = {}) {
  /* 스토리 = true — 같은 영상을 **스토리**로 (2026-11-17 세중님 「스토리에 영상은 못 올리나 · 홍성군 스토리로」)
     media_type=STORIES · 글(캡션)·커버·share_to_feed 는 스토리에 없어 안 보냅니다. 링크 스티커는 API 로 못 붙입니다 */
  if (스토리) 커버 = null;
  if (!인스타되나(cfg)) throw new Error('IG_USER_ID · IG_ACCESS_TOKEN 이 없습니다 (node tools/reels/ig.mjs --열쇠)');
  const 폼 = (o) => new URLSearchParams({ ...o, access_token: cfg.IG_ACCESS_TOKEN });
  let 커버길 = null;
  if (커버 && fs.existsSync(커버)) {
    커버길 = `${String(열쇠).replace(/[^A-Za-z0-9_-]/g, '_')}/${Date.now()}/cover.jpg`;
    try { await 저장소(cfg, 'POST', `object/${카드버킷}/${커버길}`, fs.readFileSync(커버), { 'content-type': 'image/jpeg', 'x-upsert': 'true' }); }
    catch (e) { console.error(`    ✗ 커버를 못 올림 — 영상 2.6초 화면으로 · ${String(e.message || e).slice(0, 200)}`); 커버길 = null; }
  }
  try {
  const 덧 = 커버길 ? { cover_url: `${cfg.SUPABASE_URL}/storage/v1/object/public/${카드버킷}/${커버길}` } : { thumb_offset: '2600' };
  /* ★ 릴스는 **릴스 탭에만** — 프로필 그리드(피드)에 안 띄웁니다 (2026-11-17 세중님 「그리드에서 삭제해서 릴스 탭에만 · 계속 기억해」)
     share_to_feed=false → 「릴스 탭에만」. 그리드는 카드뉴스·브랜드 게시물 자리입니다 */
  const 컨 = await 그래프(cfg, `/${cfg.IG_USER_ID}/media`, { method: 'POST',
    body: 폼(스토리 ? { media_type: 'STORIES', upload_type: 'resumable' }
      : { media_type: 'REELS', upload_type: 'resumable', caption: 캡션, share_to_feed: 'false', ...덧 }) });
  const 크기 = fs.statSync(mp4).size;
  const up = await fetch(`https://rupload.facebook.com/ig-api-upload/${버전(cfg)}/${컨.id}`, { method: 'POST',
    headers: { Authorization: 'OAuth ' + cfg.IG_ACCESS_TOKEN, offset: '0', file_size: String(크기) }, body: fs.readFileSync(mp4) });
  const 업글 = 가리개(cfg)(await up.text()).slice(0, 600);
  console.log(`    업로드 → ${up.status} · ${업글}`);
  if (!up.ok) throw new Error('업로드 HTTP ' + up.status + ' · ' + 업글.slice(0, 200));
  let 상태 = '';
  for (let i = 0; i < 30; i++) {           /* 최대 5분 */
    await new Promise((z) => setTimeout(z, 10000));
    const s = await 그래프(cfg, `/${컨.id}?fields=status_code,status&access_token=${encodeURIComponent(cfg.IG_ACCESS_TOKEN)}`);
    상태 = s.status_code || '';
    if (상태 === 'FINISHED') break;
    if (상태 === 'ERROR' || 상태 === 'EXPIRED') throw new Error('컨테이너 ' + 상태 + ' · ' + (s.status || ''));
  }
  if (상태 !== 'FINISHED') throw new Error('5분 안에 안 끝남 · 마지막 ' + 상태);
  const 올림 = await 그래프(cfg, `/${cfg.IG_USER_ID}/media_publish`, { method: 'POST', body: 폼({ creation_id: 컨.id }) });
  let 주소 = null;
  try { 주소 = (await 그래프(cfg, `/${올림.id}?fields=permalink&access_token=${encodeURIComponent(cfg.IG_ACCESS_TOKEN)}`)).permalink || null; } catch { /* 주소는 없어도 됩니다 */ }
  return { media_id: 올림.id, 주소, 커버: !!커버길 };
  } finally {
    if (커버길) try { await 저장소(cfg, 'DELETE', `object/${카드버킷}`, JSON.stringify({ prefixes: [커버길] }), { 'content-type': 'application/json' }); } catch (e) { console.error(`    ✗ 커버를 버킷에서 못 지움 (${커버길}) — 손으로 지워 주세요`); }
  }
}

/* ── 카드뉴스(캐러셀) 올리기 (2026-11-17 세중님 「카드뉴스도 · 저장소 만들어」) ──
   인스타는 캐러셀 사진을 **공개 주소(image_url)** 로만 받습니다. 그래서
     ① 카드를 Supabase Storage 공개 버킷 reels-cards 에 올리고 (열쇠는 ASCII — 지침 6-2b)
     ② 장마다 POST /{IG}/media image_url · is_carousel_item=true → 자식 id
     ③ POST /{IG}/media media_type=CAROUSEL · children · caption → 부모 → FINISHED 까지
     ④ media_publish
     ⑤ 성공이든 실패든 버킷의 그 사진은 지웁니다 (공개로 남겨 두지 않음)
   ★ 명세 원문을 못 열어 검색 요약으로 맞췄습니다. 응답 원문 600자를 찍으니 첫 실제 호출에서 칸 이름을 맞춥니다 */
export const 카드버킷 = 'reels-cards';
async function 저장소(cfg, 방법, 길, 몸, 머리 = {}) {
  const k = cfg.SUPABASE_SERVICE_KEY;
  if (!cfg.SUPABASE_URL || !k) throw new Error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다');
  const r = await fetch(`${cfg.SUPABASE_URL}/storage/v1/${길}`, { method: 방법, headers: { apikey: k, Authorization: 'Bearer ' + k, ...머리 }, body: 몸 });
  const 글 = (await r.text()).split(k).join('‹열쇠›');
  if (!r.ok) throw new Error(`저장소 ${방법} ${길.split('?')[0]} HTTP ${r.status} · ${글.slice(0, 300)}`);
  return 글;
}

export async function 카드올리기IG(cfg, 장들, 캡션, 열쇠) {
  if (!인스타되나(cfg)) throw new Error('IG_USER_ID · IG_ACCESS_TOKEN 이 없습니다 (node tools/reels/ig.mjs --열쇠)');
  if (장들.length < 2 || 장들.length > 10) throw new Error(`캐러셀은 2~10장 — 지금 ${장들.length}장`);
  const 앞 = `${String(열쇠).replace(/[^A-Za-z0-9_-]/g, '_')}/${Date.now()}`;
  const 경로들 = 장들.map((_, i) => `${앞}/${i + 1}.jpg`);
  const 폼 = (o) => new URLSearchParams({ ...o, access_token: cfg.IG_ACCESS_TOKEN });
  try {
    for (const [i, f] of 장들.entries()) {
      await 저장소(cfg, 'POST', `object/${카드버킷}/${경로들[i]}`, fs.readFileSync(f), { 'content-type': 'image/jpeg', 'x-upsert': 'true' });
    }
    console.log(`    저장소 ${카드버킷}/${앞}/ — ${장들.length}장 올림`);
    const 자식 = [];
    for (const p of 경로들) {
      const 주소 = `${cfg.SUPABASE_URL}/storage/v1/object/public/${카드버킷}/${p}`;
      const c = await 그래프(cfg, `/${cfg.IG_USER_ID}/media`, { method: 'POST', body: 폼({ image_url: 주소, is_carousel_item: 'true' }) });
      자식.push(c.id);
    }
    const 부모 = await 그래프(cfg, `/${cfg.IG_USER_ID}/media`, { method: 'POST', body: 폼({ media_type: 'CAROUSEL', children: 자식.join(','), caption: 캡션 }) });
    let 상태 = '';
    for (let i = 0; i < 18; i++) {           /* 최대 3분 */
      const s = await 그래프(cfg, `/${부모.id}?fields=status_code,status&access_token=${encodeURIComponent(cfg.IG_ACCESS_TOKEN)}`);
      상태 = s.status_code || '';
      if (상태 === 'FINISHED') break;
      if (상태 === 'ERROR' || 상태 === 'EXPIRED') throw new Error('캐러셀 컨테이너 ' + 상태 + ' · ' + (s.status || ''));
      await new Promise((z) => setTimeout(z, 10000));
    }
    if (상태 !== 'FINISHED') throw new Error('3분 안에 안 끝남 · 마지막 ' + 상태);
    const 올림 = await 그래프(cfg, `/${cfg.IG_USER_ID}/media_publish`, { method: 'POST', body: 폼({ creation_id: 부모.id }) });
    let 주소 = null;
    try { 주소 = (await 그래프(cfg, `/${올림.id}?fields=permalink&access_token=${encodeURIComponent(cfg.IG_ACCESS_TOKEN)}`)).permalink || null; } catch { /* 없어도 됨 */ }
    return { media_id: 올림.id, 주소 };
  } finally {
    try { await 저장소(cfg, 'DELETE', `object/${카드버킷}`, JSON.stringify({ prefixes: 경로들 }), { 'content-type': 'application/json' }); console.log(`    저장소 ${카드버킷}/${앞}/ — 지움`); }
    catch (e) { console.error(`    ✗ 저장소 사진을 못 지움 (${앞}) — ${String(e.message || e).slice(0, 200)} · 손으로 지워 주세요`); }
  }
}

/* 사진 한 장을 스토리로 (2026-11-18 세중님 「하이라이트였던 로고 화면 4개 다시」) — jpg 를 버킷에 잠깐 올려 image_url 로 넘기고 지웁니다 */
export async function 스토리사진올리기IG(cfg, jpg, 열쇠 = 'story') {
  if (!인스타되나(cfg)) throw new Error('IG_USER_ID · IG_ACCESS_TOKEN 이 없습니다');
  const 길 = `${String(열쇠).replace(/[^A-Za-z0-9_-]/g, '_')}/${Date.now()}/story.jpg`;
  const 폼 = (o) => new URLSearchParams({ ...o, access_token: cfg.IG_ACCESS_TOKEN });
  try {
    await 저장소(cfg, 'POST', `object/${카드버킷}/${길}`, fs.readFileSync(jpg), { 'content-type': 'image/jpeg', 'x-upsert': 'true' });
    const 컨 = await 그래프(cfg, `/${cfg.IG_USER_ID}/media`, { method: 'POST',
      body: 폼({ media_type: 'STORIES', image_url: `${cfg.SUPABASE_URL}/storage/v1/object/public/${카드버킷}/${길}` }) });
    let 상태 = '';
    for (let i = 0; i < 18; i++) {
      const s = await 그래프(cfg, `/${컨.id}?fields=status_code,status&access_token=${encodeURIComponent(cfg.IG_ACCESS_TOKEN)}`);
      상태 = s.status_code || '';
      if (상태 === 'FINISHED') break;
      if (상태 === 'ERROR' || 상태 === 'EXPIRED') throw new Error('스토리 컨테이너 ' + 상태 + ' · ' + (s.status || ''));
      await new Promise((z) => setTimeout(z, 5000));
    }
    if (상태 !== 'FINISHED') throw new Error('안 끝남 · 마지막 ' + 상태);
    const 올림 = await 그래프(cfg, `/${cfg.IG_USER_ID}/media_publish`, { method: 'POST', body: 폼({ creation_id: 컨.id }) });
    let 주소 = null;
    try { 주소 = (await 그래프(cfg, `/${올림.id}?fields=permalink&access_token=${encodeURIComponent(cfg.IG_ACCESS_TOKEN)}`)).permalink || null; } catch { /* 없어도 됨 */ }
    return { media_id: 올림.id, 주소 };
  } finally {
    try { await 저장소(cfg, 'DELETE', `object/${카드버킷}`, JSON.stringify({ prefixes: [길] }), { 'content-type': 'application/json' }); }
    catch (e) { console.error(`    ✗ 저장소 사진을 못 지움 (${길}) — 손으로 지워 주세요`); }
  }
}

/* ── 댓글 (2026-11-17 세중님 「첫 댓글에 공고 관련 말 · 대댓글로 태그」) ──
   POST /{media_id}/comments message → 댓글 id · POST /{comment_id}/replies message → 답글 id
   권한 instagram_manage_comments 가 토큰에 있어야 합니다 (없으면 댓글되나() 가 false — 그때는 태그를 캡션에 둡니다)
   ★ 명세 원문을 못 열었습니다. 응답 원문 600자를 찍습니다 */
export async function 댓글되나(cfg) {
  if (!인스타되나(cfg) || !cfg.META_APP_ID || !cfg.META_APP_SECRET) return false;
  try {
    const r = await fetch(`https://graph.facebook.com/${버전(cfg)}/debug_token?input_token=${encodeURIComponent(cfg.IG_ACCESS_TOKEN)}&access_token=${encodeURIComponent(cfg.META_APP_ID + '|' + cfg.META_APP_SECRET)}`);
    const d = (await r.json())?.data || {};
    return (d.scopes || []).includes('instagram_manage_comments');
  } catch { return false; }
}
export async function 댓글달기(cfg, 게시물, 글) {
  const r = await 그래프(cfg, `/${게시물}/comments`, { method: 'POST', body: new URLSearchParams({ message: 글, access_token: cfg.IG_ACCESS_TOKEN }) });
  return r.id;
}
export async function 답글달기(cfg, 댓글, 글) {
  const r = await 그래프(cfg, `/${댓글}/replies`, { method: 'POST', body: new URLSearchParams({ message: 글, access_token: cfg.IG_ACCESS_TOKEN }) });
  return r.id;
}

/** 게시물 하나 지우기 → { ok, 응답 } (던지지 않음 — 실패는 「손으로 지울 것」으로 넘깁니다) */
export async function 게시물지우기(cfg, id) {
  if (!인스타되나(cfg)) return { ok: false, 응답: 'IG 열쇠 없음' };
  try {
    const r = await fetch(`https://graph.facebook.com/${버전(cfg)}/${encodeURIComponent(id)}?access_token=${encodeURIComponent(cfg.IG_ACCESS_TOKEN)}`, { method: 'DELETE' });
    const 글 = 가리개(cfg)(await r.text()).slice(0, 600);
    console.log(`    DELETE ${id} → ${r.status} · ${글}`);
    return { ok: r.ok, 응답: `HTTP ${r.status} · ${글}` };
  } catch (e) { return { ok: false, 응답: 가리개(cfg)(e.message || e).slice(0, 200) }; }
}

/* ── 열쇠 만들기 ── */
async function 열쇠만들기() {
  const 묻기 = readline.createInterface({ input: process.stdin, output: process.stdout });
  const cfg = env();
  console.log('메타 앱의 「앱 설정 → 기본 설정」에 있는 값 두 개와, 그래프 API 탐색기에서 받은 짧은 사용자 토큰을 넣습니다.');
  console.log('값은 화면에 다시 찍지 않습니다.\n');
  const 앱ID = (await 묻기.question(cfg.META_APP_ID ? `앱 ID (Enter = 전에 넣은 것 · 앞 4 ${cfg.META_APP_ID.slice(0, 4)}): ` : '앱 ID: ')).trim() || cfg.META_APP_ID;
  const 앱비번 = (await 묻기.question('앱 시크릿 코드 (Enter = 전에 넣은 것): ')).trim() || cfg.META_APP_SECRET;
  const 짧은 = (await 묻기.question('짧은 사용자 토큰 (그래프 API 탐색기 「Generate Access Token」): ')).trim();
  묻기.close();
  if (!앱ID || !앱비번 || !짧은) { console.error('세 값이 다 필요합니다'); process.exit(1); }
  const 임시 = { ...cfg, IG_ACCESS_TOKEN: 짧은, META_APP_SECRET: 앱비번 };
  const 긴 = await 그래프(임시, `/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(앱ID)}&client_secret=${encodeURIComponent(앱비번)}&fb_exchange_token=${encodeURIComponent(짧은)}`);
  const 긴토큰 = 긴.access_token;
  const 가림2 = { ...임시, IG_ACCESS_TOKEN: 긴토큰 };
  const 쪽 = await 그래프(가림2, `/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(긴토큰)}`);
  const 이은 = (쪽.data || []).filter((p) => p.instagram_business_account?.id);
  console.log(`\n페이지 ${(쪽.data || []).length}개 · 인스타 비즈니스 계정이 이어진 페이지 ${이은.length}개`);
  이은.forEach((p, i) => console.log(`  ${i + 1}. 페이지 「${p.name}」 → 인스타 @${p.instagram_business_account.username || '?'}`));
  if (!이은.length) {
    console.error('\n인스타 비즈니스 계정이 이어진 페이지가 없습니다. ① 인스타가 비즈니스 계정인지 ② 페이스북 페이지에 연결됐는지 ③ 토큰을 만들 때 그 페이지를 골랐는지 보세요.');
    process.exit(1);
  }
  let 고른 = 이은[0];
  if (이은.length > 1) {
    const 또 = readline.createInterface({ input: process.stdin, output: process.stdout });
    const n = Number(await 또.question('어느 것? 번호: ')); 또.close();
    고른 = 이은[n - 1]; if (!고른) process.exit(1);
  }
  env적기('META_APP_ID', 앱ID);
  env적기('META_APP_SECRET', 앱비번);
  env적기('IG_USER_ID', 고른.instagram_business_account.id);
  env적기('IG_ACCESS_TOKEN', 고른.access_token);   /* 페이지 토큰 — 긴 사용자 토큰에서 받은 것 */
  console.log('\n이제 node tools/reels/ig.mjs --확인 으로 만료·권한을 봅니다.');
}

/* ── 열쇠 확인 ── */
async function 열쇠확인() {
  const cfg = env();
  if (!인스타되나(cfg)) { console.error('IG_USER_ID · IG_ACCESS_TOKEN 이 없습니다 — --열쇠 먼저'); process.exit(1); }
  console.log(`IG_USER_ID 길이 ${cfg.IG_USER_ID.length} · IG_ACCESS_TOKEN 길이 ${cfg.IG_ACCESS_TOKEN.length} 앞 4 ${cfg.IG_ACCESS_TOKEN.slice(0, 4)}`);
  const 나 = await 그래프(cfg, `/${cfg.IG_USER_ID}?fields=username,name&access_token=${encodeURIComponent(cfg.IG_ACCESS_TOKEN)}`);
  console.log(`○ 인스타 계정 @${나.username || '?'} (${나.name || ''})`);
  if (cfg.META_APP_ID && cfg.META_APP_SECRET) {
    const d = (await 그래프(cfg, `/debug_token?input_token=${encodeURIComponent(cfg.IG_ACCESS_TOKEN)}&access_token=${encodeURIComponent(cfg.META_APP_ID + '|' + cfg.META_APP_SECRET)}`)).data || {};
    const 만료 = d.expires_at === 0 ? '만료 없음' : d.expires_at ? new Date(d.expires_at * 1000).toISOString().slice(0, 10) + ' 만료' : '모름';
    console.log(`○ 토큰 ${d.type || '?'} · ${만료} · 유효 ${d.is_valid}`);
    /* 토큰이 「만료 없음」이어도 데이터 접근은 90일마다 다시 로그인해야 합니다 (2026-11-17 첫 확인에서 본 칸) */
    if (d.data_access_expires_at) {
      const 끝 = d.data_access_expires_at * 1000;
      const 남은날 = Math.floor((끝 - Date.now()) / 86400e3);
      const 날 = new Date(끝 + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
      console.log(`${남은날 <= 14 ? '  ★ ' : '  '}데이터 접근 ${날} KST 까지 (${남은날}일 남음)${남은날 <= 14 ? ' — 그 전에 그래프 API 탐색기에서 토큰을 다시 받아 --열쇠 를 돌리세요' : ''}`);
    }
    const 권한 = d.scopes || [];
    console.log(`  권한 ${권한.join(', ')}`);
    for (const 꼭 of ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement']) if (!권한.includes(꼭)) console.log(`  ✗ ${꼭} 이 없습니다 — 올리기가 안 될 수 있습니다`);
    if (!권한.includes('instagram_manage_comments')) console.log('  △ instagram_manage_comments 이 없습니다 — 첫 댓글·태그 대댓글을 못 달고 태그는 캡션에 둡니다');
    if (!권한.includes('instagram_manage_contents')) console.log('  △ instagram_manage_contents 이 없습니다 — 삭제 요청 때 API 로 못 지우고 손으로 지웁니다');
  } else console.log('  (META_APP_ID · META_APP_SECRET 이 없어 만료·권한은 못 봅니다)');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--열쇠')) await 열쇠만들기();
  else if (process.argv.includes('--확인')) await 열쇠확인();
  else console.log('--열쇠 (처음 한 번) 또는 --확인');
}
