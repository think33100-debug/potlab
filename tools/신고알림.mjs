/* 커뮤니티 **신고가 들어오면 바로** 메일 한 통 (2026-10-28 세중님 2번)
 *
 *   node tools/신고알림.mjs            새 신고를 보고 메일 (5분마다 크론)
 *   node tools/신고알림.mjs --보기      보내지 않고 화면에만
 *   node tools/신고알림.mjs --자기점검
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 신고가 들어와도 **아무 알림이 없었습니다.** 관리자가 `/admin/posts` 를 들어가 봐야
 * 알 수 있었고, 그 사이 회원 화면에는 신고된 글이 그대로 보입니다.
 * (신고는 글을 **감추지 않습니다** — 감추는 것은 사람의 판단입니다 · 2026-10-28 확인)
 *
 * ── 어떻게 ──────────────────────────────────────────────────
 *   · **트리거·DB 함수를 만들지 않았습니다** — 서버 도구가 5분마다 묻습니다
 *   · 어디까지 봤는지는 `log/신고알림_본것.json` 에 **신고 번호**로 남깁니다
 *     (DB 에 아무것도 안 씁니다 — 읽기만 합니다)
 *   · 한 번에 여러 건이면 **한 통에 묶어** 보냅니다 (시끄럽지 않게)
 *   · 처음 돌 때는 **지금까지 것을 본 것으로 표시만** 하고 메일을 안 보냅니다
 *     (옛 신고 수십 통이 한꺼번에 가지 않게)
 */
import fs from 'node:fs';
import path from 'node:path';
import { 모두받기, 받아보기 } from './쪽나눠받기.mjs';

const 뿌리 = path.join(import.meta.dirname, '..');
const 보기만 = process.argv.includes('--보기');

export const 관리자화면 = 'https://potjob-web.vercel.app/admin/posts';

/** 메일 한 통의 글 — 신고 줄들을 받아 제목·본문을 만듭니다 */
export function 메일만들기(신고들) {
  const 제목 = '[피오티잡] 커뮤니티 신고 ' + 신고들.length + '건';
  const 줄 = ['커뮤니티 신고가 들어왔습니다. **신고만으로는 글이 감춰지지 않습니다** —',
    '보시고 감출지 정해 주십시오.', ''];
  for (const r of 신고들) {
    const 글 = r.글 || {};
    줄.push('■ 신고 #' + r.id + '  (' + (r.target_type === 'post' ? '글' : r.target_type) + ' ' + r.target_id + ')');
    줄.push('   방      ' + (글.channel || '(모름)'));
    줄.push('   제목    ' + (글.title || '(제목 없음)'));
    줄.push('   사유    ' + (r.reason || '(안 적음)'));
    줄.push('   들어온때 ' + String(r.created_at || '').slice(0, 16).replace('T', ' '));
    줄.push('   지금     ' + (글.hidden ? '**감춰져 있음**' : '회원 화면에 보임'));
    줄.push('');
  }
  줄.push('관리자 화면 — ' + 관리자화면);
  return { 제목, 본문: 줄.join('\n') };
}

if (process.argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const m = 메일만들기([{ id: 7, target_type: 'post', target_id: 80, reason: '욕설',
    created_at: '2026-10-28T10:30:00+00:00', 글: { channel: 'free', title: '어떤 글', hidden: false } }]);
  보('제목에 건수', m.제목.includes('1건'));
  보('방·제목·사유가 있다', /free/.test(m.본문) && /어떤 글/.test(m.본문) && /욕설/.test(m.본문));
  보('관리자 화면 주소가 있다', m.본문.includes(관리자화면));
  보('감춰졌는지 적는다', /회원 화면에 보임/.test(m.본문));
  보('감춘 글은 그렇게 적는다',
    /감춰져 있음/.test(메일만들기([{ id: 1, 글: { hidden: true } }]).본문));
  보('여러 건을 한 통에', 메일만들기([{ id: 1 }, { id: 2 }]).제목.includes('2건'));
  보('제목·사유가 없어도 안 깨진다', /제목 없음/.test(메일만들기([{ id: 1, 글: {} }]).본문));
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const cfg = {};
for (const f of ['.env', '.env.local']) {
  const p = path.join(뿌리, f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('✗ SUPABASE_URL·SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K };

const 본것자리 = path.join(뿌리, 'log', '신고알림_본것.json');
fs.mkdirSync(path.dirname(본것자리), { recursive: true });
let 본것 = { 마지막번호: null, 마지막때: null };
if (fs.existsSync(본것자리)) {
  try { 본것 = JSON.parse(fs.readFileSync(본것자리, 'utf8')); } catch { /* 깨졌으면 처음처럼 */ }
}

/* 아직 처리 안 된 신고를 번호 차례로 받습니다 (지침 8-20 ③ — 공용 모두받기) */
const 신고 = await 모두받기(U + '/rest/v1/reports?select=id,target_type,target_id,reason,created_at'
  + '&handled_at=is.null', H, { 차례: 'id' });
const 새것 = 신고.filter((r) => 본것.마지막번호 == null || Number(r.id) > Number(본것.마지막번호));
console.log('처리 전 신고 ' + 신고.length + '건 · 새로 온 것 ' + 새것.length + '건'
  + ' (마지막으로 본 번호 ' + (본것.마지막번호 ?? '(없음)') + ')');

const 적기 = (번호) => fs.writeFileSync(본것자리,
  JSON.stringify({ 마지막번호: 번호, 마지막때: new Date().toISOString() }, null, 1) + '\n', 'utf8');

const 맨끝 = 신고.length ? 신고[신고.length - 1].id : 본것.마지막번호;
if (본것.마지막번호 == null) {
  적기(맨끝 ?? 0);
  console.log('처음 돌았습니다 — 지금까지 것을 **본 것으로만** 표시했습니다 (메일 안 보냅니다)');
  process.exit(0);
}
if (!새것.length) { console.log('새 신고가 없습니다'); process.exit(0); }

/* 신고된 글의 제목·방·감춤 여부를 함께 받습니다 */
for (const r of 새것) {
  if (r.target_type !== 'post') continue;
  const q = U + '/rest/v1/posts?select=channel,title,hidden&id=eq.' + encodeURIComponent(r.target_id);
  const res = await 받아보기(q, { headers: H });
  if (res.ok) r.글 = (await res.json())[0] || {};
}

const { 제목, 본문 } = 메일만들기(새것);
console.log('\n' + 제목 + '\n' + 본문);

if (보기만) { console.log('\n[보기] 안 보냈습니다 · 본 번호도 안 바꿨습니다'); process.exit(0); }
if (!cfg.RESEND_KEY || !cfg.NOTIFY_EMAIL) {
  console.log('\n※ RESEND_KEY · NOTIFY_EMAIL 이 없어 화면에만 찍었습니다 (본 번호는 그대로)');
  process.exit(0);
}
const 보냄 = await 받아보기('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + cfg.RESEND_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: cfg.MAIL_FROM || 'potjob <onboarding@resend.dev>',
    to: [cfg.NOTIFY_EMAIL], subject: 제목, text: 본문,
  }),
});
if (!보냄.ok) {
  console.error('✗ 메일 못 보냈습니다 — ' + 보냄.status + ' ' + (await 보냄.text()).slice(0, 200));
  console.error('  **본 번호를 안 바꿉니다** — 다음 바퀴에 다시 보냅니다');
  process.exit(1);
}
적기(새것[새것.length - 1].id);
console.log('\n○ 보냈습니다 — ' + 새것.length + '건 · 본 번호 ' + 새것[새것.length - 1].id);
