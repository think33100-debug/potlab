/* kordoc parse-worker 의 **규약 2** 가 되는지 시험합니다 (2026-10-11 세중님 지시).
 *
 *   node tools/워커규약2시험.mjs <파일>
 *
 * 세중님이 주신 문서(usage.md 214줄) —
 *   「--protocol 2 는 ParseOptions(예: tableFormat)와 이미지 파일 전송을 받습니다」
 * 문서는 **4.18.8** 기준이고 깔린 것은 **4.19.1** 입니다. 되는지 재 봅니다.
 *
 * 보는 것
 *   ① --protocol 2 로 띄워지나 (첫 줄의 protocol 값)
 *   ② classifyTables 를 넘기면 IRTable.classification 이 오나
 *   ③ 규약 1 에서는 안 오는 것이 맞나 (견줄 값)
 *
 * **아무것도 담지 않습니다.**
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 꾸러미 = path.join(여기, 'kordoc');
const CLI = path.join(꾸러미, 'node_modules', 'kordoc', 'dist', 'cli.js');
const 파일 = process.argv[2];
if (!파일 || !fs.existsSync(파일)) { console.error('볼 파일을 주십시오'); process.exit(1); }

function 한바퀴(깃발, 요청) {
  return new Promise((맺) => {
    const 아이 = spawn(process.execPath, [CLI, 'parse-worker', ...깃발], { cwd: 꾸러미, stdio: ['pipe', 'pipe', 'pipe'] });
    let 쌓임 = ''; let 첫줄 = null; let 답 = null; let 에러 = '';
    const 끝내기 = () => { try { 아이.kill('SIGKILL'); } catch { /* 넘어갑니다 */ } };
    const 시계 = setTimeout(() => { 끝내기(); 맺({ 첫줄, 답, 에러: 에러 || '시간 초과' }); }, 90000);
    아이.stdout.setEncoding('utf8');
    아이.stdout.on('data', (c) => {
      쌓임 += c;
      let i;
      while ((i = 쌓임.indexOf('\n')) >= 0) {
        const 줄 = 쌓임.slice(0, i).trim(); 쌓임 = 쌓임.slice(i + 1);
        if (!줄) continue;
        let o; try { o = JSON.parse(줄); } catch { continue; }
        if (o.ready) { 첫줄 = o; 아이.stdin.write(JSON.stringify(요청) + '\n'); continue; }
        답 = o; clearTimeout(시계); 끝내기(); 맺({ 첫줄, 답, 에러 });
      }
    });
    아이.stderr.setEncoding('utf8');
    아이.stderr.on('data', (c) => { 에러 += c; });
    아이.on('error', (e) => { clearTimeout(시계); 맺({ 첫줄, 답, 에러: String(e.message) }); });
    아이.on('exit', (코드) => {
      if (답 || 첫줄) return;
      clearTimeout(시계);
      맺({ 첫줄: null, 답: null, 에러: (에러 || '').slice(0, 300) + ' (exit ' + 코드 + ')' });
    });
  });
}

const 분류본것 = (결과) => {
  const 표 = (결과?.blocks || []).filter((b) => b.type === 'table' && b.table);
  return {
    표수: 표.length,
    분류붙은표: 표.filter((b) => b.table.classification).length,
    갈래: [...new Set(표.map((b) => b.table.classification?.kind).filter(Boolean))],
  };
};

for (const [이름, 깃발] of [['규약 1 (기본)', []], ['규약 2 (--protocol 2)', ['--protocol', '2']]]) {
  console.log('\n══ ' + 이름);
  const r = await 한바퀴(깃발, { id: 1, file: 파일, images: false, classifyTables: true });
  if (!r.첫줄) { console.log('   ✗ 안 떴습니다 — ' + (r.에러 || '').replace(/\s+/g, ' ').slice(0, 200)); continue; }
  console.log('   첫 줄   ' + JSON.stringify(r.첫줄));
  if (!r.답) { console.log('   ✗ 답이 안 왔습니다 — ' + (r.에러 || '').replace(/\s+/g, ' ').slice(0, 200)); continue; }
  const x = r.답.result || {};
  console.log('   답     success ' + x.success + ' · fileType ' + x.fileType
    + ' · rss ' + Math.round((r.답.rss || 0) / 1e6) + 'MB'
    + ' · 글자 ' + (x.markdown || '').length);
  const c = 분류본것(x);
  console.log('   표     ' + c.표수 + '개 · **분류 붙은 표 ' + c.분류붙은표 + '개**'
    + (c.갈래.length ? ' · 갈래 ' + c.갈래.join('·') : ''));
}
console.log('\n아무것도 담지 않았습니다.');
