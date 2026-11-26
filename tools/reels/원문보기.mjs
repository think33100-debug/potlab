/* 공고 원문 쪽을 서버에서 열어 「N명 · 인원 · 직군」 둘레 글과 첨부 줄을 찍습니다 — 원격 할일 source-view
   (2026-11-26 · 홍성 GJ308684 「8명」이 맞는지 보려고 — 정부 사이트는 클라우드 작업 자리에서 안 열립니다). 읽기만 합니다 */
import { env } from './ig.mjs';
import { 붙여받기 } from '../certs/index.mjs';
import { 받아보기 } from '../쪽나눠받기.mjs';
const cfg = env();
const i = process.argv.indexOf('--id'); const id = i > 0 ? process.argv[i + 1] : null;
if (!id) { console.error('--id <공고id>'); process.exit(2); }
const K = cfg.SUPABASE_SERVICE_KEY;
const r = await 받아보기(`${cfg.SUPABASE_URL}/rest/v1/job_posts?select=id,title,org_name,url,headcount,job_group,employ_type,apply_to,detail&id=eq.${encodeURIComponent(id)}`, { headers: { apikey: K, Authorization: 'Bearer ' + K } });
const [공고] = await r.json();
if (!공고) { console.error('그 id 의 공고가 없습니다'); process.exit(1); }
console.log(`${공고.id} · ${공고.org_name} · ${공고.title}\n  우리 값 — 직군 ${공고.job_group} · ${공고.employ_type} · 인원 ${공고.headcount} · 마감 ${공고.apply_to}\n  첨부 줄 — ${JSON.stringify(공고.detail?.첨부 || 공고.detail?.files || null)?.slice(0, 600)}`);
const g = await 붙여받기(공고.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36', 'Accept-Language': 'ko' }, timeout: 25000 });
if (g.왜 || !g.buf) { console.log('✗ 원문을 못 받음 — ' + String(g.왜 || g.code).slice(0, 120)); process.exit(0); }
const ct = g.headers?.get?.('content-type') || '';
const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1] || (g.buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
let html; try { html = new TextDecoder(cs.toLowerCase()).decode(g.buf); } catch { html = g.buf.toString('utf8'); }
const 글 = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ');
console.log(`HTTP ${g.code} · ${cs} · HTML ${html.length}자 · 글 ${글.length}자`);
const 본 = 글.indexOf(String(공고.title).slice(0, 12));
console.log('── 본문 앞 1,500자 ──\n' + 글.slice(Math.max(0, 본), Math.max(0, 본) + 1500));
console.log('── 「N명 · 인원 · 치료」 둘레 ──');
let n = 0;
for (const m of 글.matchAll(/(?:[0-9○O]+\s*명|모집\s*인원|채용\s*인원|선발\s*인원|(?:작업|물리)\s*치료)/g)) {
  if (++n > 40) break;
  console.log(`  … ${글.slice(Math.max(0, m.index - 80), m.index + 100)}`);
}
console.log('── 첨부로 보이는 줄 ──');
for (const m of [...html.matchAll(/<a\b[^>]*(?:href|onclick)=["'][^"']*(?:down|file|atch|attach)[^"']*["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)].slice(0, 15)) console.log('  ' + m[0].replace(/\s+/g, ' ').slice(0, 300));
