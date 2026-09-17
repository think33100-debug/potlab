// reports/batch*.md 를 모아 요약하고, 사립대병원_조사.md 의 종합병원 줄(채용게시판주소·구조·난이도·조사일)을 채웁니다.
// 사용: node merge_reports.js [--write]
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'reports');
const files = fs.readdirSync(dir).filter(f => /^batch\d+\.md$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
const rows = {};
files.forEach(f => {
  fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach(l => {
    if (!l.startsWith('|')) return;
    const c = l.split('|').map(s => s.trim());
    if (c.length < 6 || /^-+$/.test(c[1]) || c[1] === '병원명') return;
    rows[c[1]] = { name: c[1], sido: c[2], result: c[3], url: c[4], n: c[5], note: c[6] || '', batch: f };
  });
});
const targets = JSON.parse(fs.readFileSync(path.join(__dirname, 'targets_general.json'), 'utf8'));
const kinds = {};
let missing = [];
targets.forEach(t => { const r = rows[t.name]; if (!r) { missing.push(t.name); return; } const k = r.result.replace(/\(.*$/, '').trim(); kinds[k] = (kinds[k] || 0) + 1; });
console.log('보고서 ' + files.length + '개 · 줄 ' + Object.keys(rows).length + ' / 대상 ' + targets.length);
console.log(JSON.stringify(kinds, null, 1));
if (missing.length) console.log('보고서에 없는 병원 ' + missing.length + ': ' + missing.slice(0, 40).join(' · '));
const extra = Object.keys(rows).filter(n => !targets.some(t => t.name === n));
if (extra.length) console.log('대상에 없는 이름(글자 다름?) ' + extra.length + ': ' + extra.slice(0, 40).join(' · '));
if (process.argv.includes('--write')) {
  const md = path.join(__dirname, '..', '..', '..', '사립대병원_조사.md');
  let s = fs.readFileSync(md, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  let n = 0;
  s = s.split('\n').map(l => {
    if (!l.startsWith('| ') || !l.includes('| 종합병원 |')) return l;
    const c = l.split('|');
    const r = rows[c[1].trim()]; if (!r) return l;
    c[6] = ' ' + (r.url || '') + ' '; c[7] = ' ' + (r.result + (r.note ? ' · ' + r.note : '')).replace(/\|/g, '/') + ' ';
    c[8] = ' ' + (/^자동/.test(r.result) ? '자동(게시판 · ' + today + ')' : /손 확인|미확인/.test(r.result) ? '손 확인' : r.result) + ' ';
    c[9] = ' ' + (/^자동/.test(r.result) ? '쉬움' : '어려움') + ' '; c[10] = ' ' + today + ' ';
    n++; return c.join('|');
  }).join('\n');
  s = s.replace(/진행 · 상급종합 47 \/ 47 · 종합병원 \d+ \/ 332/, '진행 · 상급종합 47 / 47 · 종합병원 ' + n + ' / 332');
  fs.writeFileSync(md, s);
  console.log('조사 문서 ' + n + '줄 채움');
}
