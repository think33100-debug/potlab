/* 「링크가 안 눌려요」 하신 분께 「공고 보러 가기」 단추 DM 을 다시 보냅니다 — 원격 할일 dm-resend <인스타 이름>
   (2026-11-28 세중님 「이 사람 줄 것 좀 줘 · 디엠에선 링크가 안 돼」 · rebodypt)
   · 받는 분은 log/댓글링크_보냄.json 에서 찾습니다 — 「라포」 댓글로 DM 을 받은 적 있는 분만 (받는이 · 공고 · 응답의 recipient_id)
   · 그분이 우리에게 답장한 뒤 24시간 안에만 보낼 수 있습니다 (인스타 규칙). 막히면 오류를 그대로 찍습니다
   · 그분의 가장 최근 「보냄」 기록 하나에만, 한 번 실행에 DM 한 통입니다 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, 그래프 } from './ig.mjs';
import { 보낼단추 } from './댓글링크.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const 기록파일 = path.join(ROOT, 'log', '댓글링크_보냄.json');
const i = process.argv.indexOf('--이름'); const 이름 = i > 0 ? String(process.argv[i + 1] || '') : '';
const 실행 = process.argv.includes('--실행');
if (!/^[A-Za-z0-9._]{1,30}$/.test(이름)) { console.error('--이름 <인스타 이름>'); process.exit(2); }
const 기록 = fs.existsSync(기록파일) ? JSON.parse(fs.readFileSync(기록파일, 'utf8')) : {};
const 줄 = Object.entries(기록).filter(([, v]) => v?.받는이 === 이름 && v.결과 === '보냄').sort((a, b) => String(b[1].때).localeCompare(String(a[1].때)))[0];
if (!줄) { console.error(`✗ @${이름} 에게 보낸 기록이 없습니다`); process.exit(1); }
const [댓글id, v] = 줄;
const 받는id = (String(v.응답 || '').match(/"recipient_id":"(\d+)"/) || [])[1];
if (!받는id) { console.error('✗ 기록에 recipient_id 가 없습니다 — ' + String(v.응답 || '').slice(0, 120)); process.exit(1); }
const 말 = 보낼단추(v.공고 || null);
console.log(`@${이름} · 댓글 ${댓글id} · 공고 ${v.공고} · 받는 id ${받는id}\n보낼 것: ${JSON.stringify(말).slice(0, 400)}`);
if (!실행) { console.log('\n마른 실행 — 보내지 않았습니다 (--실행)'); process.exit(0); }
const cfg = env();
try {
  const r = await 그래프(cfg, `/${cfg.IG_USER_ID}/messages`, { method: 'POST', body: new URLSearchParams({ recipient: JSON.stringify({ id: 받는id }), message: JSON.stringify(말), access_token: cfg.IG_ACCESS_TOKEN }) });
  console.log(`○ 보냄 · ${JSON.stringify(r).slice(0, 200)}`);
} catch (e) { console.error(`✗ 못 보냄 — ${String(e.message || e).slice(0, 400)}`); process.exit(1); }
