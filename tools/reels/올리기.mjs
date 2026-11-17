/* 확인한 릴스를 인스타에 올립니다 — 「올려」 한 마디 길 (2026-11-17)

   node tools/reels/올리기.mjs --목록                       확인 대기 중인 릴스 (메일로 받은 것)
   node tools/reels/올리기.mjs --id HS1869100513            무엇을 올릴지 · 다시 확인한 결과만 (마른)
   node tools/reels/올리기.mjs --id HS1869100513 --실행     올립니다

   ★ 메일로 받아 **눈으로 본 그 영상·캡션 그대로** 올립니다 — 다시 만들지 않습니다 (영상 지문 sha256 이 같아야 함).
   올리기 직전에 다시 봅니다. 하나라도 걸리면 올리지 않고 까닭을 찍습니다
     ① 아직 안 올렸나 · 취소되지 않았나        log/릴스_올림.json
     ② 게시 금지가 아닌가                       do_not_publish.json 을 **지금** 다시 읽음 (rapo777.mjs)
     ③ 마감이 지나지 않았나 (오늘이면 안 올림)
     ④ 원문이 아직 살아 있나                    원문확인() — 통과일 때만
   결과는 log/릴스_올림.json (게시물ID · 상태 「올림」) · log/릴스_발행기록.jsonl 한 줄 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { env, 인스타되나, 릴스올리기IG, 카드올리기IG, 댓글되나, 댓글달기, 답글달기 } from './ig.mjs';
import { 묶음폴더, 묶음읽기, 게시금지인가 } from './rapo777.mjs';
import { 원문확인 } from './원문확인.mjs';
import { 오늘KST } from './reel-data.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(여기, '..', '..');
const 기록파일 = path.join(ROOT, 'log', '릴스_올림.json');
const 발행기록파일 = path.join(ROOT, 'log', '릴스_발행기록.jsonl');
const 인수 = (이름) => { const i = process.argv.indexOf('--' + 이름); return i > 0 ? process.argv[i + 1] : null; };
const cfg = env();
const 기록 = fs.existsSync(기록파일) ? JSON.parse(fs.readFileSync(기록파일, 'utf8')) : {};
const 줄적기 = (줄) => { fs.mkdirSync(path.dirname(발행기록파일), { recursive: true }); fs.appendFileSync(발행기록파일, JSON.stringify({ 때: new Date().toISOString(), ...줄 }) + '\n'); };

/* 같은 영상(묶은 공고)에 딸린 공고 id 들 — 메일 한 통이 공고 둘(PT·OT)일 수 있습니다 */
const 같은편 = (v) => Object.keys(기록).filter((k) => !k.startsWith('__') && 기록[k]?.영상 && 기록[k].영상 === v.영상);

if (process.argv.includes('--목록')) {
  const 본 = new Set();
  for (const [k, v] of Object.entries(기록)) {
    if (k.startsWith('__') || !v?.영상 || 본.has(v.영상)) continue;
    const 릴스남음 = v.상태 === '확인 대기';
    const 카드남음 = (v.카드 || []).length > 0 && !v.카드게시물ID && ['확인 대기', '올림'].includes(v.상태) && !/취소|삭제/.test(v.카드상태 || '');
    if (!릴스남음 && !카드남음) continue;
    본.add(v.영상);
    const 남은것 = [릴스남음 && '릴스', 카드남음 && `카드 ${v.카드.length}장`].filter(Boolean).join(' · ');
    console.log(`  ${같은편(v).join('+')} · ${v.기관} · ${v.직군} · 마감 ${v.마감일 || '?'} · 올릴 것 ${남은것} · 메일 ${String(v.메일보낸때).slice(0, 16)}`);
  }
  if (!본.size) console.log('확인 대기 중인 릴스가 없습니다');
  process.exit(0);
}

const id = 인수('id');
if (!id) { console.error('--id <공고 id> 또는 --목록'); process.exit(2); }
const v = 기록[id];
const 멈춤 = (까닭) => { console.error(`✗ 안 올립니다 — ${까닭}`); if (process.argv.includes('--실행')) 줄적기({ 결과: '실패', 공고: [id], 기관: v?.기관 || null, 까닭: '올리기 전 확인 — ' + 까닭 }); process.exit(1); };

/* --카드 — 릴스 대신 카드뉴스(캐러셀)를 올립니다. 릴스와 카드는 **따로** 기록합니다 (세중님 (나) 둘 다) */
const 카드길 = process.argv.includes('--카드');
/* --스토리 — 같은 릴스 영상을 스토리로 (2026-11-17). 릴스·카드와 **따로** 기록합니다 (스토리게시물ID) */
const 스토리길 = process.argv.includes('--스토리');
const 무엇 = 카드길 ? '카드뉴스' : 스토리길 ? '스토리' : '릴스';

/* ① 기록 */
if (!v) 멈춤(`기록에 ${id} 가 없습니다 (메일로 보낸 공고 id 를 주세요 · --목록)`);
if (/취소|삭제/.test(v.상태 || '') || /취소|삭제/.test(v.카드상태 || '')) 멈춤(`상태가 「${v.상태}${v.카드상태 ? ' · 카드 ' + v.카드상태 : ''}」 — 게시 중단된 공고입니다`);
if (!['확인 대기', '올림'].includes(v.상태)) 멈춤(`상태가 「${v.상태 || '없음'}」 — 확인 대기(또는 릴스만 올린 것)만 올립니다`);
if (!카드길 && !스토리길 && v.게시물ID) 멈춤(`릴스는 이미 올렸습니다 — 게시물 ${v.게시물ID} (${v.올린때})`);
if (스토리길 && v.스토리게시물ID) 멈춤(`스토리는 이미 올렸습니다 — ${v.스토리게시물ID} (${v.스토리올린때})`);
if (카드길 && v.카드게시물ID) 멈춤(`카드뉴스는 이미 올렸습니다 — 게시물 ${v.카드게시물ID} (${v.카드올린때})`);
if (!카드길) {
  if (!v.영상 || !fs.existsSync(v.영상)) 멈춤(`영상 파일이 없습니다 — ${v.영상 || '경로 없음'}`);
  const 지문 = crypto.createHash('sha256').update(fs.readFileSync(v.영상)).digest('hex');
  if (v.영상지문 && 지문 !== v.영상지문) 멈춤('영상 파일이 메일로 보낸 것과 다릅니다 (지문 불일치)');
} else {
  const 없음 = (v.카드 || []).filter((f) => !fs.existsSync(f));
  if (!(v.카드 || []).length) 멈춤('카드 기록이 없습니다 (카드뉴스가 생기기 전에 만든 공고 — 「만들기」로 다시 만드세요)');
  if (없음.length) 멈춤(`카드 파일이 없습니다 — ${없음.join(', ')}`);
}
console.log(`[${무엇}] ` + `${같은편(v).join('+')} · ${v.기관} · ${v.직군} · 마감 ${v.마감일}`);
console.log(`${같은편(v).join('+')} · ${v.기관} · ${v.직군} · 마감 ${v.마감일}`);
console.log(`  영상 ${v.영상} · 이미지 ${v.이미지?.없음 ? '없음(777 목록 밖)' : `${v.이미지?.꼴 || '?'} (${v.이미지?.기관ref || '?'}) · ${v.이미지?.출처글 || ''}`}`);

/* ② 게시 금지 — 지금 다시 읽음 */
const 묶음 = 묶음읽기(묶음폴더(cfg));
/* 777 목록 밖(이미지 없이 만든 것)은 ykiho·이름으로 봅니다 */
const 기 = v.이미지?.없음 ? { institution_ref: null, key: v.이미지.key || v.기관, ykiho: v.이미지.ykiho || null, name: v.기관 }
  : 묶음.기관들.find((x) => x.institution_ref === v.이미지?.기관ref);
if (!기) 멈춤(`묶음에서 기관 ${v.이미지?.기관ref} 를 못 찾음`);
const 금지 = 게시금지인가(묶음.폴더, 기);
if (금지) 멈춤(금지);
console.log('  ○ 게시 금지 아님');

/* ③ 마감 */
if (!v.마감일) 멈춤('마감일 기록이 없습니다');
if (v.마감일 <= 오늘KST()) 멈춤(`마감 ${v.마감일} — 오늘이거나 지났습니다`);
console.log(`  ○ 마감 ${v.마감일} (오늘 ${오늘KST()})`);

/* ④ 원문 */
if (v.원문자료) {
  const r = await 원문확인(v.원문자료);
  if (r.판정 !== '통과') 멈춤(`원문 확인 「${r.판정}」 — ${r.까닭}`);
  console.log(`  ○ 원문 통과 · ${(r.확인 || []).join(' / ')}`);
} else 멈춤('원문 자료 기록이 없습니다');

console.log('\n── 캡션 ──\n' + v.캡션 + '\n── 캡션 끝 ──');
if (카드길) console.log(`  카드 ${v.카드.length}장`);
if (!process.argv.includes('--실행')) { console.log(`\n마른 실행 — ${무엇}를 올리지 않았습니다. --실행 을 붙이면 올립니다`); process.exit(0); }
if (!인스타되나(cfg)) 멈춤('IG 열쇠가 없습니다 (node tools/reels/ig.mjs --열쇠)');

/* 댓글 권한이 있으면 해시태그 줄을 캡션에서 빼고 대댓글로 옮깁니다. 없으면 태그는 캡션에 그대로 (태그가 빠진 채 올라가지 않게) */
const 댓글 = !스토리길 && !!(v.첫댓글 && v.태그) && await 댓글되나(cfg);   /* 스토리에는 댓글이 없습니다 */
const 올릴캡션 = 댓글 ? String(v.캡션).split('\n').filter((l) => l.trim() !== v.태그.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim() : v.캡션;
console.log(댓글 ? '  ○ 댓글 권한 있음 — 첫 댓글 + 태그 대댓글 · 캡션에서 태그 뺌' : '  · 댓글 권한 없음 — 태그는 캡션에');
try {
  const 올림 = 카드길 ? await 카드올리기IG(cfg, v.카드, 올릴캡션, 같은편(v)[0])
    : await 릴스올리기IG(cfg, v.영상, 올릴캡션, { 커버: v.커버 || null, 열쇠: 같은편(v)[0], 스토리: 스토리길 });
  /* 첫 댓글 · 태그 대댓글 — 실패해도 게시물은 이미 올라갔습니다. 손으로 달 글을 찍어 둡니다 */
  let 댓글기록 = null;
  if (댓글) {
    try {
      const 첫 = await 댓글달기(cfg, 올림.media_id, v.첫댓글);
      const 답 = await 답글달기(cfg, 첫, v.태그);
      댓글기록 = { 첫댓글ID: 첫, 태그답글ID: 답 };
      console.log(`  ○ 첫 댓글 ${첫} · 태그 대댓글 ${답}`);
    } catch (e) {
      console.error(`  ✗ 댓글을 못 달았습니다 — ${String(e.message || e).slice(0, 200)}\n    손으로 달아 주세요 →\n    첫 댓글: ${v.첫댓글}\n    대댓글: ${v.태그}`);
    }
  }
  const 때 = new Date().toISOString();
  for (const k of 같은편(v)) {
    기록[k] = 카드길 ? { ...기록[k], 카드상태: '올림', 카드올린때: 때, 카드게시물ID: 올림.media_id, 카드게시물주소: 올림.주소, 카드댓글: 댓글기록 }
      : 스토리길 ? { ...기록[k], 스토리올린때: 때, 스토리게시물ID: 올림.media_id, 스토리주소: 올림.주소 }
      : { ...기록[k], 상태: '올림', 올린때: 때, 게시물ID: 올림.media_id, media_id: 올림.media_id, 게시물주소: 올림.주소, 댓글: 댓글기록 };
  }
  fs.writeFileSync(기록파일, JSON.stringify(기록, null, 2));
  줄적기({ 결과: '성공', 공고: 같은편(v), 기관: v.기관, 기관ref: v.이미지?.기관ref, 이미지: v.이미지, 원문: v.원문, 게시물ID: 올림.media_id, 게시물주소: 올림.주소, 길: `확인 뒤 올림 · ${무엇}` });
  console.log(`\n● ${무엇}를 올렸습니다 — 게시물 ${올림.media_id}${올림.주소 ? ' · ' + 올림.주소 : ''}`);
} catch (e) {
  줄적기({ 결과: '실패', 공고: 같은편(v), 기관: v.기관, 까닭: String(e.message || e).slice(0, 300) });
  console.error(`✗ 못 올렸습니다 — ${String(e.message || e).slice(0, 300)}`);
  process.exit(1);
}
