/* 첨부담기 — 수집기가 **이미 받아 온 공고문 주소**를 job_attachments 에 담습니다.
 *
 * 왜 있나 (2026-10-10)
 *   공고 상세의 일곱 칸은 ① 제목 → ② 상세 API → ③ 첨부 공고문 순으로 채웁니다.
 *   그런데 `job_attachments` 가 **0줄**이라 ③ 의 재료가 없습니다.
 *   수집기 셋(나라일터·알리오·클린아이)은 공고문을 **열어서 글자는 읽는데**
 *   주소를 그냥 버립니다. 그 자리에서 이 창구로 넘기면 됩니다.
 *
 * 기준을 한 곳에 둡니다 (작업지침 6절)
 *   · 주소는 **&amp; 가 풀린 온전한 값**이어야 합니다. 안 풀면 HTML 오류 화면이
 *     옵니다 (지침 5절 · 나라일터에서 실제로 밟았습니다)
 *   · 받은 파일이 **정말 그 형식인지** 앞 몇 글자로 확인합니다 (지침 5절 —
 *     PDF 는 %PDF-)
 *   · 저장 이름은 **ASCII 만**. 공고문 이름은 거의 다 한글이라 그대로 쓰면
 *     Supabase Storage 가 InvalidKey 로 거절합니다 (지침 6-2b · 2026-10-10)
 *     → <공고번호>-<차례><확장자> 로 짓고, 사람에게 보여줄 이름은 표의 칸에
 *
 * 쓰는 법
 *   const 첨부 = 첨부모으기('GJ2', { 마른: true });
 *   첨부.더하기({ job_id, kind: '공고문', name: f.filename, url: 온전한주소 });
 *   await 첨부.끝내기(cfg);        // 마른이면 파일로, 아니면 DB 로
 *
 * **마른 실행**(--마른)은 DB 를 건드리지 않고 docs/첨부_미리보기_1010.json 에
 * 적습니다. 아침 승인 전에는 늘 마른으로 돕니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');

/* 앞 글자로 본 진짜 형식 — 확장자를 믿지 않습니다 (지침 5절) */
export function 진짜형식(바이트) {
  /* ★ 앞의 빈칸·줄바꿈·BOM 을 걷어내고 봅니다. 안 걷으면 HTML 오류 화면이
     「모름」으로 나옵니다 — 처음 돌렸을 때 30건이 다 「모름」이었습니다 */
  let i = 0;
  if (바이트[0] === 0xef && 바이트[1] === 0xbb && 바이트[2] === 0xbf) i = 3;
  while (i < 바이트.length && (바이트[i] === 0x20 || 바이트[i] === 0x09
         || 바이트[i] === 0x0a || 바이트[i] === 0x0d)) i++;
  const b = 바이트.slice(i);
  const 같나 = (...xs) => xs.every((x, i2) => b[i2] === x);
  if (같나(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'pdf';           /* %PDF- */
  if (같나(0xd0, 0xcf, 0x11, 0xe0)) return 'hwp';                 /* 옛 한글(OLE) */
  if (같나(0x50, 0x4b, 0x03, 0x04)) return 'zip계열';             /* hwpx · docx */
  if (같나(0xff, 0xd8, 0xff)) return 'jpg';
  if (같나(0x89, 0x50, 0x4e, 0x47)) return 'png';
  if (같나(0x3c, 0x21) || 같나(0x3c, 0x68) || 같나(0x3c, 0x48)) return 'HTML(오류 화면일 수 있음)';
  return '모름';
}

/* 저장 이름 — ASCII 만. 한글이 들어가면 저장소가 거절합니다 */
export function 저장이름(job_id, 차례, 원래이름) {
  const 확장자 = (String(원래이름 || '').match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? '').toLowerCase();
  const 안전한번호 = String(job_id).replace(/[^A-Za-z0-9_-]/g, '_');
  return `${안전한번호}-${차례}${확장자}`;
}

/* ★ 2026-10-11 — **켜야 담습니다.**
 *
 * attach-prep 을 main 에 합치자마자 **크론이 곧바로 진짜로 담았습니다.**
 * 알리오 크론은 `--마른` 없이 5분마다 도니까요 (22:00·22:27 에 2줄 들어갔습니다).
 * 세중님이 정한 「첫 실행은 최대 30건」·「밤에 백필 금지」를 넘는 길입니다.
 *
 * 그래서 **기본을 마른으로** 둡니다. 담으려면 환경변수를 켭니다 —
 *
 *   POTJOB_ATTACH_WRITE=1  node tools/collect-nara.mjs
 *
 * 변수 이름이 영문인 까닭은 셸이 한글 변수를 못 쓰기 때문입니다 (지침 8-3).
 * 크론에는 **일부러 안 넣습니다.** 사람이 손으로 켜서 한 바퀴 보고 나서
 * 넣는 것이 맞습니다 (지침 11-2 와 같은 결 — 「돌았다」와 「맞게 돌았다」는 다릅니다). */
const 켜졌나 = () => process.env.POTJOB_ATTACH_WRITE === '1';

/* 한 번에 이보다 많으면 멈춥니다 — 치우개의 50개 뚜껑과 같은 생각입니다.
   POTJOB_ATTACH_MAX 로 올릴 수 있습니다 */
const 뚜껑 = () => Number(process.env.POTJOB_ATTACH_MAX) || 30;

export function 첨부모으기(source, 옵션 = {}) {
  /* 옵션.마른 이 아니어도, 환경변수를 안 켰으면 마른입니다 */
  const 마른 = !!옵션.마른 || !켜졌나();
  const 줄들 = [];
  const 셈 = { 더한것: 0, 주소없음: 0, 겹침: 0 };
  const 본주소 = new Set();

  return {
    마른,
    get 줄들() { return 줄들; },
    get 셈() { return 셈; },

    더하기({ job_id, kind = '공고문', name = '', url }) {
      const 주소 = String(url || '').trim();
      if (!job_id || !주소) { 셈.주소없음++; return; }
      /* &amp; 가 남아 있으면 **여기서 막습니다.** 담고 나서 고치면
         이미 들어간 줄이 남습니다 (지침 9절 — 쌓인 자료는 안 고쳐집니다) */
      if (/&amp;|&#38;/.test(주소)) {
        throw new Error(`첨부 주소에 &amp; 가 남아 있습니다 — 풀어서 넘기십시오: ${주소.slice(0, 120)}`);
      }
      const 열쇠 = job_id + '|' + 주소;
      if (본주소.has(열쇠)) { 셈.겹침++; return; }
      본주소.add(열쇠);
      줄들.push({
        job_id: String(job_id), kind, name: String(name || ''), url: 주소,
        저장이름: 저장이름(job_id, 줄들.filter((r) => r.job_id === String(job_id)).length, name),
      });
      셈.더한것++;
    },

    /* 주소마다 앞 8글자를 받아 **정말 그 형식인지** 봅니다.
       파일을 통째로 안 받습니다 — Range 로 앞부분만.

       ★ 2026-10-11 — **머리(쿠키)를 받습니다.** 안 쓰면 알리오가 파일 대신
       포털 첫 화면(8,333자 HTML)을 줍니다. 10-11 에 28건을 쿠키 없이 두드려
       전부 HTML 이 와서 「첨부 주소가 틀렸다」고 읽었는데, 쿠키를 붙이니
       891,887바이트 `%PDF-` 와 86,528바이트 hwp(OLE)가 왔습니다.
       **주소는 멀쩡했고 제 확인이 틀렸습니다.**
       `collect-alio.mjs` 의 포털쿠키() 주석에 이미 적혀 있던 것입니다 (지침 5절). */
    async 형식확인(최대 = 40, 머리얻기 = null) {
      let 본것 = 0;
      const 머리 = 머리얻기 ? await 머리얻기() : {};
      for (const r of 줄들) {
        if (본것 >= 최대) { r.형식 = '안 봄'; continue; }
        본것++;
        try {
          const res = await fetch(r.url, { headers: { ...머리, Range: 'bytes=0-15' } });
          const b = new Uint8Array(await res.arrayBuffer());
          r.형식 = 진짜형식(b);
          r.HTTP = res.status;
          r.앞글자 = Buffer.from(b.slice(0, 8)).toString('latin1')
            .replace(/[^\x20-\x7e]/g, '.');
        } catch (e) {
          r.형식 = '못 받음'; r.탈 = String(e.message).slice(0, 80);
        }
      }
      return 줄들;
    },

    async 끝내기(cfg) {
      /* ★ 2026-10-11 — **0줄이어도 셈을 찍습니다.** 전에는 부르는 쪽이
         `if (줄들.length)` 로 감싸서 0일 때 아무 줄도 안 나왔습니다.
         그래서 「왜 0인가」를 로그로 알 수 없었습니다 (지침 2절) */
      if (!줄들.length) {
        console.log(`  첨부 담을 것 없음 (${source})`
          + ` · 주소없음 ${셈.주소없음} · 겹침 ${셈.겹침}`
          + ' — 더하기() 가 한 번도 안 불렸으면 셋 다 0입니다');
        return;
      }
      if (마른) {
        const 낼곳 = path.join(뿌리, 'docs', '첨부_미리보기_1010.json');
        let 전 = { 묶음: {} };
        if (fs.existsSync(낼곳)) { try { 전 = JSON.parse(fs.readFileSync(낼곳, 'utf8')); } catch { /* 새로 */ } }
        전.묶음 ||= {};
        전.묶음[source] = { 때: new Date().toISOString(), 셈, 줄들 };
        전.때 = new Date().toISOString();
        fs.mkdirSync(path.dirname(낼곳), { recursive: true });
        fs.writeFileSync(낼곳, JSON.stringify(전, null, 1) + '\n');
        console.log(`  [마른] 첨부 ${줄들.length}줄 → docs/첨부_미리보기_1010.json (${source})`
          + (켜졌나() ? '' : ' · 담으려면 POTJOB_ATTACH_WRITE=1'));
        return;
      }

      /* 뚜껑 — 한 번에 너무 많으면 멈춥니다 */
      if (줄들.length > 뚜껑()) {
        console.error(`  ★ 첨부 ${줄들.length}줄은 한 번 뚜껑(${뚜껑()})을 넘습니다 — **담지 않습니다.**`);
        console.error(`     POTJOB_ATTACH_MAX 로 올리거나, 좁혀서 다시 돌리십시오`);
        return;
      }
      /* 진짜로 담기 — 창구를 거칩니다. 표를 직접 안 씁니다.
         ★ 2026-10-11 — 전에는 `await import('./collect-lib.mjs')` 였는데
         **그 파일은 쓴 적이 없습니다.** 마른 실행만 거쳐서 안 드러났고,
         진짜로 담으려니 ERR_MODULE_NOT_FOUND 로 멈췄습니다.
         수집기마다 제 rpc 를 들고 있어 내보내는 자리가 없습니다 —
         여기서 직접 부릅니다 (collect_attach 는 service_role 전용입니다) */
      const 열쇠 = cfg['COLLECT_KEY_' + source] || cfg.COLLECT_KEY_HS3;
      const rpc = async (_cfg, fn, body) => {
        const k = _cfg.SUPABASE_SERVICE_KEY;
        if (!k) throw new Error('SUPABASE_SERVICE_KEY 가 없습니다 (collect_attach 는 service_role 전용)');
        const r = await fetch(_cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
          method: 'POST',
          headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const t = await r.text();
        if (!r.ok) throw new Error(fn + ' HTTP ' + r.status + ' · ' + t.slice(0, 300));
        try { return JSON.parse(t); } catch { return t; }
      };
      const 합 = { 담음: 0, 겹침: 0, 건너뜀: 0, 공고없음: 0 };
      let 첫탈 = null; let 묶음 = null; let 표줄수 = null;
      for (let i = 0; i < 줄들.length; i += 200) {
        const r = await rpc(cfg, 'collect_attach', {
          p_secret: 열쇠, p_source: source, p_rows: 줄들.slice(i, i + 200),
        });
        for (const k of Object.keys(합)) 합[k] += r[k] || 0;
        첫탈 ||= r['첫탈']; 묶음 = r['묶음']; 표줄수 = r['표 줄수'];
      }
      /* 「몇 건 왔다」만 찍는 진단은 쓸모없습니다 (지침 2절) — 갈래별로 찍습니다 */
      console.log(`  첨부 ${합.담음}줄 담았습니다 (${source})`
        + ` · 겹침 ${합.겹침} · 건너뜀 ${합.건너뜀} · 그 공고가 표에 없음 ${합.공고없음}`
        + ` · 묶음 ${묶음 ?? '(없음)'} · 표 전체 ${표줄수}줄`);
      if (첫탈) console.log(`  ⚠ 첫 탈 — ${첫탈}`);
    },
  };
}
