// hosp_sites.js(build_sites.js 결과) 로 wage.js 의 HOSP_SITES 설정표를 통째로 바꿉니다.
// 사용: node replace_sites.js <wage.js>
const fs = require('fs'), path = require('path');
const W = process.argv[2];
let s = fs.readFileSync(W, 'utf8');
const start = s.indexOf('/* 설정표 — name 은 심평원 병원목록 이름 그대로.');
const endMark = '\n];\n';
const end = s.indexOf(endMark, start);
if (start < 0 || end < 0) { console.error('설정표를 못 찾음'); process.exit(1); }
const between = s.slice(start, end);
if (between.indexOf('function ') > -1) { console.error('설정표 사이에 함수가 있음 — 멈춤'); process.exit(1); }
const fresh = fs.readFileSync(path.join(__dirname, '..', 'hosp_sites.js'), 'utf8');
s = s.slice(0, start) + fresh.replace(/\n$/, '') + s.slice(end + endMark.length - 1);
fs.writeFileSync(W, s);
console.log('설정표 바꿈 · ' + (fresh.match(/\n  \{ name:/g) || []).length + '곳');
