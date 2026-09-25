/* 구글 서버에서 병원 홈페이지를 두드려 봅니다 — node tools/probe.js 목포시의료원 녹색병원
 *
 *   node tools/probe.js 목포시의료원            이름에 그 말이 든 곳
 *   node tools/probe.js --off                   지금 꺼져 있는 곳 전부
 *   node tools/probe.js 녹색병원 --head 2000    앞 2,000자까지
 *
 * ── 왜 여기서 안 두드리고 구글을 거치나 ──────────────────────
 * 막히는 것은 **구글 IP** 입니다. 이 컴퓨터에서 두드리면 잘 열려서, 로컬에서
 * 재현하면 엉뚱한 답을 얻습니다. 2026-09-25 에 동수원병원을 「SSL 인증서
 * 문제」로 잘못 짚었는데, 구글이 받은 것은 nesolution 방화벽 차단(406)이었습니다.
 *
 * 302 는 followRedirects 를 끄고 Location 을 한 칸씩 따라가 전부 적습니다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const cfg = {};
fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m) cfg[m[1]] = m[2];
});

async function call(fn, args) {
  const cb = '__potlab_cb_1_' + Date.now();
  const u = cfg.APPS_SCRIPT_URL + '?callback=' + cb + '&action=' + fn
          + '&args=' + encodeURIComponent(JSON.stringify(args)) + '&t=' + Date.now();
  const txt = await (await fetch(u)).text();
  const m = txt.match(/^__potlab_cb_\d+_\d+\((.*)\);\s*$/s);
  if (!m) throw new Error('JSONP 가 아닙니다: ' + txt.slice(0, 400));
  const j = JSON.parse(m[1]);
  if (!j.ok) throw new Error(j.error);
  return j.data;
}

(async () => {
  const argv = process.argv.slice(2);
  let head = 0, browser = false, rows = false;
  const names = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--head') { head = Number(argv[++i]) || 1200; continue; }
    if (argv[i] === '--rows') { rows = true; continue; }   // 수집기 길로 실제로 긁어 봅니다
    if (argv[i] === '--browser') { browser = true; continue; }   // 머리글을 브라우저처럼
    if (argv[i] === '--off') continue;          // 이름을 안 주면 꺼진 곳 전부입니다
    names.push(argv[i]);
  }
  console.log('구글 서버에서 두드립니다 — ' + (names.length ? names.join(' · ') : '꺼진 곳 전부')
    + (browser ? '  (브라우저 머리글)' : '  (수집기와 같은 머리글)'));
  console.log('(한 곳에 50초씩 먹는 곳이 있어 오래 걸릴 수 있습니다)\n');

  const 결과 = await call('probeSites', [cfg.EXPORT_KEY, names, { head: (head || (rows ? 0 : 1200)), browser: browser, rows: rows }]);
  결과.forEach((r) => {
    console.log('━'.repeat(64));
    console.log(r.name);
    if (r.off) console.log('  전에 꺼둔 이유 — ' + r.off);
    if (r.scrape) {
      const c = r.scrape;
      console.log('  수집기 길로 긁어보면 — ' + (c.err ? '못 받음 · ' + c.err
        : '공고 ' + c.n + '건 · 받은 글자 ' + c.raw) + ' · ' + c.ms + 'ms');
      c.titles.forEach((t, k) => console.log('      ' + (k + 1) + '. ' + t));
    }
    r.hops.forEach((h, i) => {
      console.log('  ' + (i + 1) + ') ' + h.url);
      if (h.err) { console.log('      못 엶 — ' + h.err + '  (' + h.ms + 'ms)'); return; }
      console.log('      HTTP ' + h.code + ' · 받은 글자 ' + h.len
        + ' · 채용말 ' + h.jobWords + '회 · ' + h.ms + 'ms'
        + (h.ctype ? ' · ' + h.ctype : ''));
      if (h.loc) console.log('      Location → ' + h.loc);
      if (h.title) console.log('      쪽제목 — ' + h.title);
      if (h.head) console.log('      앞 ' + h.head.length + '자 — ' + h.head);
    });
    console.log('');
  });
  console.log('본 곳 ' + 결과.length + '곳');
})().catch((e) => { console.error('실패: ' + e.message); process.exit(1); });
