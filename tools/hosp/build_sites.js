// cfgs/*.json + JSON 사이트 목록 → HOSP_SITES 배열 문자열(hosp_sites.js) 을 만듭니다.
// 사용: node build_sites.js  → ../hosp_sites.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'cfgs');
const jsonSites = [
  { name: '전남대학교병원', type: 'appsite', host: 'https://cnuh.recruiter.co.kr', sn: 4978, settingType: 'E', not: '화순' },
  { name: '화순전남대학교병원', type: 'appsite', host: 'https://cnuh.recruiter.co.kr', sn: 4978, settingType: 'E', only: '화순' },
  { name: '전북대학교병원', type: 'appsite', host: 'https://jbuh.recruiter.co.kr', sn: 13192, settingType: 'A' },
  { name: '충북대학교병원', type: 'appsite', host: 'https://cbnuh.recruiter.co.kr', sn: 9932, settingType: 'E' },
  { name: '의료법인 길의료재단 길병원', type: 'appsite', host: 'https://gilhospital.recruiter.co.kr', sn: 2714, settingType: 'E' },
  { name: '분당서울대학교병원', type: 'appsite', host: 'https://snubh.recruiter.co.kr', sn: 658, settingType: 'E' },
  { name: '아주대학교병원', type: 'appsite', host: 'https://ajoumc.recruiter.co.kr', sn: 3327, settingType: 'E' },
  { name: '부산대학교병원', type: 'listjson', host: 'https://pnuh.recruiter.co.kr' },
  { name: '학교법인가톨릭학원가톨릭대학교서울성모병원', type: 'cmc', url: 'https://www.cmcseoul.or.kr/api/article/64?page=1&size=12', base: 'https://www.cmcseoul.or.kr' },
  { name: '가톨릭대학교 성빈센트병원', type: 'cmc', url: 'https://www.cmcvincent.or.kr/api/article/167?page=1&size=12&vincentRecruitYn=Y', base: 'https://www.cmcvincent.or.kr' },
  { name: '순천향대학교부속부천병원', type: 'schmc', host: 'https://jobapplication.schmc.ac.kr', dept: 190003 }
];
const KEYS = ['name', 'type', 'url', 'host', 'base', 'enc', 'sn', 'settingType', 'dept', 'row', 'title', 'link', 'linkFmt', 'date', 'skip', 'single', 'only', 'not', 'note'];
function lit(v) { return typeof v === 'number' ? String(v) : "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
const all = jsonSites.slice();
fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().forEach(f => {
  const c = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (!c.name || !c.row || !c.title || !c.url) { console.error('빠진 항목: ' + f); process.exit(1); }
  c.type = 'html'; all.push(c);
});
const lines = all.map(s => '  { ' + KEYS.filter(k => s[k] !== undefined && s[k] !== '').map(k => k + ': ' + lit(s[k])).join(', ') + ' }');
const out = '/* 설정표 — name 은 심평원 병원목록 이름 그대로. html 은 hs_test.js 로 검증한 것만. (' + new Date().toISOString().slice(0, 10) + ' · ' + all.length + '곳) */\nconst HOSP_SITES = [\n' + lines.join(',\n') + '\n];\n';
fs.writeFileSync(path.join(__dirname, '..', 'hosp_sites.js'), out);
console.log(all.length + '곳 → hosp_sites.js');
