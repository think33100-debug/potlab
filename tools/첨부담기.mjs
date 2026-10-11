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

export function 첨부모으기(source, 옵션 = {}) {
  const 마른 = !!옵션.마른;
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
       파일을 통째로 안 받습니다 — Range 로 앞부분만 */
    async 형식확인(최대 = 40) {
      let 본것 = 0;
      for (const r of 줄들) {
        if (본것 >= 최대) { r.형식 = '안 봄'; continue; }
        본것++;
        try {
          const res = await fetch(r.url, { headers: { Range: 'bytes=0-15' } });
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
      if (!줄들.length) { console.log('  첨부 담을 것 없음'); return; }
      if (마른) {
        const 낼곳 = path.join(뿌리, 'docs', '첨부_미리보기_1010.json');
        let 전 = { 묶음: {} };
        if (fs.existsSync(낼곳)) { try { 전 = JSON.parse(fs.readFileSync(낼곳, 'utf8')); } catch { /* 새로 */ } }
        전.묶음 ||= {};
        전.묶음[source] = { 때: new Date().toISOString(), 셈, 줄들 };
        전.때 = new Date().toISOString();
        fs.mkdirSync(path.dirname(낼곳), { recursive: true });
        fs.writeFileSync(낼곳, JSON.stringify(전, null, 1) + '\n');
        console.log(`  [마른] 첨부 ${줄들.length}줄 → docs/첨부_미리보기_1010.json (${source})`);
        return;
      }
      /* 진짜로 담기 — 창구를 거칩니다. 표를 직접 안 씁니다 */
      const { rpc } = await import('./collect-lib.mjs');
      const 열쇠 = cfg['COLLECT_KEY_' + source] || cfg.COLLECT_KEY_HS3;
      let 담음 = 0;
      for (let i = 0; i < 줄들.length; i += 200) {
        const r = await rpc(cfg, 'collect_attach', {
          p_secret: 열쇠, p_source: source, p_rows: 줄들.slice(i, i + 200),
        });
        담음 += r['담음'] || 0;
      }
      console.log(`  첨부 ${담음}줄 담았습니다 (${source})`);
    },
  };
}
