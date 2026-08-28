/* ============================================================
 * bridge_test.js — app.js 다리가 실제로 도는지 봅니다
 * ------------------------------------------------------------
 * 진짜 브라우저처럼 화면을 띄우고, 가짜 서버를 붙여
 * google.script.run.함수() 를 하나씩 불러봅니다.
 * 짐작하지 않고 실제로 돌려서 확인하는 것이 목적입니다.
 *
 * 쓰는 법:  node bridge_test.js
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = __dirname;
const appjs = fs.readFileSync(path.join(ROOT, 'pages', 'app.js'), 'utf8');
const gs = fs.readFileSync(path.join(ROOT, 'Wage.gs'), 'utf8');

let pass = 0, fail = 0;
const ok = m => { console.log('  ok   ' + m); pass++; };
const bad = m => { console.log('  FAIL ' + m); fail++; };

/* 가짜 브라우저를 만듭니다 */
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>',
  { url: 'https://potjob.co.kr/', runScripts: 'outside-only' });
const win = dom.window;

/* <script> 를 붙이면 진짜로 서버에 가는 대신
   여기서 가로채 가짜 응답을 돌려줍니다 */
const asked = [];
Object.defineProperty(win.HTMLScriptElement.prototype, 'src', {
  set(url) {
    const u = new win.URL(url);
    const cb = u.searchParams.get('callback');
    const action = u.searchParams.get('action');
    const args = JSON.parse(u.searchParams.get('args') || '[]');
    asked.push({ action, args, len: url.length });
    setTimeout(() => {
      if (typeof win[cb] === 'function') {
        win[cb]({ ok: true, data: { echo: action, args: args } });
      }
    }, 0);
  },
  get() { return ''; },
  configurable: true
});

/* app.js 를 브라우저 안에서 실행합니다 */
win.eval(appjs);

console.log('\n[1] 다리가 만들어졌는지');
win.google && win.google.script && win.google.script.run
  ? ok('google.script.run 준비됨') : bad('google.script.run 없음');

/* 서버 API 목록을 그대로 가져와 하나씩 확인합니다 */
const apiBlock = gs.match(/const API\s*=\s*\{([\s\S]*?)\n\};/);
const api = [...apiBlock[1].matchAll(/^\s*([A-Za-z_]\w*)\s*:/gm)].map(m => m[1]);

console.log('\n[2] 서버 함수 ' + api.length + '개가 다리에 다 있는지');
const missing = api.filter(n => typeof win.google.script.run[n] !== 'function');
missing.length ? bad('빠진 함수: ' + missing.join(' ')) : ok('전부 있음');

console.log('\n[3] 예전에 빠져 있던 5개 실제 호출');
const target = ['getJobPosts', 'getNoti', 'saveNoti', 'adminGetBanners', 'adminSaveBanners'];

function callOne(name, args) {
  return new Promise(resolve => {
    let done = false;
    const t = setTimeout(() => { if (!done) resolve({ err: '응답 없음' }); }, 1000);
    try {
      win.google.script.run
        .withSuccessHandler(d => { done = true; clearTimeout(t); resolve({ data: d }); })
        .withFailureHandler(e => { done = true; clearTimeout(t); resolve({ err: e.message }); })
        [name].apply(null, args);
    } catch (e) {
      done = true; clearTimeout(t); resolve({ err: '호출 자체가 실패: ' + e.message });
    }
  });
}

(async () => {
  for (const n of target) {
    const args = n.startsWith('admin') ? ['potjob-admin-9174'] : [];
    const r = await callOne(n, args);
    if (r.err) bad(n + ' → ' + r.err);
    else if (r.data && r.data.echo === n) ok(n + ' → 서버까지 왕복 성공');
    else bad(n + ' → 엉뚱한 응답: ' + JSON.stringify(r.data));
  }

  console.log('\n[4] 보낸 주소가 규격에 맞는지');
  const sample = asked.find(a => a.action === 'getJobPosts');
  if (!sample) bad('요청이 나가지 않았습니다');
  else {
    ok('action=getJobPosts 로 나감');
    sample.len < 7500 ? ok('주소 길이 ' + sample.len + '자 (제한 7500)')
                      : bad('주소가 너무 깁니다: ' + sample.len);
  }

  console.log('\n[5] 관리자 키가 인자로 실려 갔는지');
  const adm = asked.find(a => a.action === 'adminGetBanners');
  adm && adm.args[0] === 'potjob-admin-9174'
    ? ok('키 전달됨') : bad('키가 안 실렸습니다');

  console.log('\n[6] 서버가 거절했을 때 실패 처리가 되는지');
  const r = await new Promise(resolve => {
    const orig = Object.getOwnPropertyDescriptor(win.HTMLScriptElement.prototype, 'src');
    Object.defineProperty(win.HTMLScriptElement.prototype, 'src', {
      set(url) {
        const cb = new win.URL(url).searchParams.get('callback');
        setTimeout(() => win[cb]({ ok: false, error: '권한이 없습니다' }), 0);
      },
      get() { return ''; }, configurable: true
    });
    win.google.script.run
      .withSuccessHandler(d => resolve({ data: d }))
      .withFailureHandler(e => resolve({ err: e.message }))
      .adminGetBanners('틀린키');
    setTimeout(() => Object.defineProperty(win.HTMLScriptElement.prototype, 'src', orig), 50);
  });
  r.err === '권한이 없습니다' ? ok('실패 처리 정상') : bad('실패 처리 이상: ' + JSON.stringify(r));

  console.log('\n' + '='.repeat(46));
  console.log(fail ? '실패 ' + fail + '건 / 통과 ' + pass + '건' : '전부 통과 (' + pass + '건)');
  console.log('='.repeat(46));
  process.exit(fail ? 1 : 0);
})();
