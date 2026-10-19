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
  { name: '순천향대학교부속부천병원', type: 'schmc', host: 'https://jobapplication.schmc.ac.kr', dept: 190003 },
  /* 위탁 운영 공공병원 — 알리오·나라일터에 안 뜸. 그리팅(greetinghr) __NEXT_DATA__ openings (2026-09-12) */
  { name: '국립교통재활병원', type: 'greeting', host: 'https://ntrh.career.greetinghr.com', url: 'https://ntrh.career.greetinghr.com/ko/guide' }
];
const KEYS = ['name', 'type', 'url', 'host', 'base', 'enc', 'sn', 'settingType', 'dept', 'row', 'title', 'link', 'linkFmt', 'date', 'skip', 'single', 'only', 'not', 'off', 'note',
  /* type:'json' 이 쓰는 칸 (2026-10-19) — 여기 없으면 hosp_sites.js 에서 **조용히 빠집니다**.
     수집기는 cfgs/*.json 을 통째로 읽어서 안 빠지지만, 이 도구로 표를 다시 만들면
     빠지므로 함께 적어 둡니다 (지침 6절 — 같은 기준이 두 자리) */
  '방식', '몸', '머리', '줄경로', '셈경로', '제목열쇠', '날짜열쇠', '시작열쇠', '끝열쇠', '갈래열쇠', '링크꼴', '링크열쇠'];
function lit(v) { return typeof v === 'number' ? String(v) : "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
const all = jsonSites.slice();
fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().forEach(f => {
  const c = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  /* type 이 적혀 있으면(appsite·listjson·cmc·schmc·greeting) 그대로, 없으면 html */
  if (!c.type) c.type = 'html';
  if (c.type === 'html' && (!c.name || !c.row || !c.title || !c.url)) { console.error('빠진 항목: ' + f); process.exit(1); }
  if (c.type === 'appsite' && (!c.name || !c.host || !c.sn)) { console.error('appsite 항목 부족: ' + f); process.exit(1); }
  if (c.type === 'greeting' && (!c.name || !c.host || !c.url)) { console.error('greeting 항목 부족: ' + f); process.exit(1); }
  if (c.type === 'json' && (!c.name || !c.url || !c['줄경로'] || !c['제목열쇠'] || !(c['링크꼴'] || c['링크열쇠']))) {
    console.error('json 항목 부족: ' + f + ' — url · 줄경로 · 제목열쇠 · (링크꼴 또는 링크열쇠) 가 있어야 합니다');
    process.exit(1);
  }
  if (all.some(x => x.name === c.name && x.type === c.type && (x.url || x.host) === (c.url || c.host))) { console.error('같은 사이트가 두 번: ' + f); process.exit(1); }
  all.push(c);
});
const lines = all.map(s => '  { ' + KEYS.filter(k => s[k] !== undefined && s[k] !== '').map(k => k + ': ' + lit(s[k])).join(', ') + ' }');
const out = '/* 설정표 — name 은 심평원 병원목록 이름 그대로. html 은 hs_test.js 로 검증한 것만. (' + new Date().toISOString().slice(0, 10) + ' · ' + all.length + '곳) */\nconst HOSP_SITES = [\n' + lines.join(',\n') + '\n];\n';
fs.writeFileSync(path.join(__dirname, '..', 'hosp_sites.js'), out);
console.log(all.length + '곳 → hosp_sites.js');
