/* RAPO 777기관 이미지 묶음 — 기관 연결 · 이미지 고르기 · 출처 · 게시 금지 (2026-11-17)

   묶음   드라이브 「RAPO_777_assets_20261117」 (CLAUDE_README.txt)
          part01.zip · part02.zip 을 **같은 폴더**에 풀고, JSON 들을 그 폴더에 둡니다
            <폴더>/institutions.json · sources_and_conditions.json · exceptions.json · do_not_publish.json · assets/…
          폴더는 .env 의 RAPO777_DIR (없으면 ~/rapo777) — 저장소 밖입니다 (이미지 1,221장 · 120MB)

   ★ 777곳은 **이미지 수집 범위**입니다. 릴스는 여전히 「회원 화면 1층 새 공고」마다 한 편입니다 (run.mjs).

   기관 연결 — 짐작하지 않습니다 (지침 10-3)
     ① ykiho 가 정확히 같다                    (앱 기관.ykiho ↔ 묶음 ykiho)
     ② org_id 가 앱 기관번호와 정확히 같다       (둘 다 「HIRA:<ykiho>」 꼴. 「NAME:」 꼴은 이름에서 만든 번호라 안 씀)
     ③ 이름(key 또는 name) **과** 주소가 둘 다 정확히 같다 (띄어쓰기·쉼표만 무시)
     걸리는 것이 둘 이상이거나 하나도 없으면 → 대기 (까닭을 남김)
     institution_ref(rapo777_0001)는 이 묶음의 참조번호입니다. 앱 기관번호로 쓰지 않습니다.

   이미지 고르기
     · historical_asset · restricted_reference 는 자동으로 안 고릅니다. 남는 것이 없으면 대기
     · representative 를 먼저 · 안 되면 실제 사진 → 조감도 → 기관 로고 → 공통 브랜드 차례
     · 영상에는 render_path(PNG/JPG)만
     · 긴 로고(가로/세로 6 이상)는 같은 기관의 심볼 파일이 있으면 「심볼 + 병원 이름」으로
     · 공통 브랜드(scope 가 기관 것이 아님)는 name_label(전체 기관명)을 반드시 함께 — 없으면 대기
     · kind=facility_rendering 은 「건축조감도」로 표시합니다 (실사라고 하지 않음)

   출처 — **실제로 고른 파일**의 attribution_text · source_page (대표 파일의 것을 빌려 쓰지 않음)
     permission_confirmed 는 읽기만 합니다. 바꾸지 않습니다.
     운영 방침(출처 표시 · 요청 시 삭제 · 재게시 금지)은 「사용 허가」로 적지 않습니다.

   게시 금지 — 묶음 안 do_not_publish.json + 묶음 밖 ~/rapo777_게시금지.json 을 **매 발행 직전에 다시** 합쳐 읽습니다
     blocked_institutions 의 institution_ref 또는 key 가 같으면 그 기관은 **어떤 이미지로도** 안 냅니다.

   node tools/reels/rapo777.mjs --자기점검                 견본으로 규칙만 (어디서나)
   node tools/reels/rapo777.mjs --점검 [--폴더 <묶음>]      실제 묶음 전수 — 파일이 있나 · 고를 수 있나 · 대기 까닭 셈 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function 묶음폴더(cfg = {}) {
  return cfg.RAPO777_DIR || process.env.RAPO777_DIR || path.join(os.homedir(), 'rapo777');
}

/* ── 읽기 ── */
export function 묶음읽기(폴더) {
  const f = path.join(폴더, 'institutions.json');
  if (!fs.existsSync(f)) throw new Error(`묶음이 없습니다 — ${f} (RAPO777_DIR 를 확인하세요)`);
  const 몸 = JSON.parse(fs.readFileSync(f, 'utf8'));
  const 기관들 = Array.isArray(몸) ? 몸 : 몸.institutions;
  if (!Array.isArray(기관들)) throw new Error('institutions.json 에 institutions 배열이 없습니다');
  /* 파일별 조건 — asset_id 로 찾습니다 (자산 줄에 출처가 빠졌을 때만 씀) */
  const 조건 = new Map();
  const cf = path.join(폴더, 'sources_and_conditions.json');
  if (fs.existsSync(cf)) {
    for (const 기 of JSON.parse(fs.readFileSync(cf, 'utf8'))) for (const a of 기.assets || []) 조건.set(a.asset_id, a);
  }
  return { 폴더, 기관들, 조건, 스냅샷: 몸.snapshot_date || null };
}

/* ── 기관 연결 ── */
const 글자만 = (s) => String(s || '').replace(/[\s,·]/g, '');

/** @param 앱 { 기관번호, ykiho, 이름, 주소 } (기관 표 한 줄 · 없으면 null) */
export function 기관연결(묶음, 앱) {
  if (!앱) return { 대기: '앱 공고에 기관번호가 없음 — 기관 표 줄이 없어 ykiho·주소로 대조할 수 없음' };
  const 기관들 = 묶음.기관들;
  const 하나만 = (걸림, 근거) => {
    if (걸림.length === 1) return { 기관: 걸림[0], 근거 };
    if (걸림.length > 1) return { 대기: `${근거}가 ${걸림.length}곳에 걸림 (${걸림.map((x) => x.institution_ref).join(', ')}) — 사람이 고름` };
    return null;
  };
  if (앱.ykiho) {
    const r = 하나만(기관들.filter((x) => x.ykiho && x.ykiho === 앱.ykiho), 'ykiho 일치');
    if (r) return r;
  }
  if (앱.기관번호 && !String(앱.기관번호).startsWith('NAME:')) {
    const r = 하나만(기관들.filter((x) => x.org_id && x.org_id === 앱.기관번호), 'org_id = 기관번호 일치');
    if (r) return r;
  }
  if (앱.이름 && 앱.주소) {
    const 이 = 글자만(앱.이름); const 주 = 글자만(앱.주소);
    const r = 하나만(기관들.filter((x) => (글자만(x.key) === 이 || 글자만(x.name) === 이) && x.address && 글자만(x.address) === 주),
      '이름+주소 일치');
    if (r) return r;
  }
  /* 이름만 같은 곳이 있으면 까닭에 적어 사람이 보게 합니다 — 연결은 하지 않습니다 */
  const 이름만 = 기관들.filter((x) => 앱.이름 && (글자만(x.key) === 글자만(앱.이름) || 글자만(x.name) === 글자만(앱.이름)));
  if (이름만.length) {
    return { 대기: `이름만 같은 곳 ${이름만.length}곳 (${이름만.map((x) => `${x.institution_ref} 주소 ${x.address || '없음'}`).join(' / ')}) — ID·주소가 안 맞아 연결 안 함` };
  }
  return { 대기: '777 목록에 맞는 기관 없음 (ykiho·org_id·이름+주소 모두 불일치)' };
}

/* ── 이미지 고르기 ── */
const 사진꼴 = (k) => k === 'photo';
const 조감도꼴 = (k) => k === 'facility_rendering';
const 심볼꼴 = (k) => /symbol|emblem/i.test(String(k || ''));
const 기관것 = (a) => a.scope === 'institution_specific';
const 비율 = (a) => (a.width > 0 && a.height > 0 ? a.width / a.height : 0);
export const 긴로고비율 = 6;

function 쓸수있나(a, 폴더) {
  if (a.historical_asset === true) return '과거 자료(historical_asset)';
  if (a.restricted_reference === true) return '참고 전용(restricted_reference)';
  if (!a.render_path || !/\.(png|jpe?g)$/i.test(a.render_path)) return 'render_path 가 PNG/JPG 아님';
  if (폴더 && !fs.existsSync(path.join(폴더, a.render_path))) return `파일 없음 ${a.render_path} (두 ZIP 을 같은 폴더에 풀었나)`;
  return null;
}

function 출처찾기(a, 조건) {
  const c = 조건?.get(a.asset_id) || {};
  return {
    출처글: a.attribution_text || c.attribution_text || null,
    출처쪽: a.source_page || c.source_page || null,
    허가확인: (a.permission_confirmed ?? c.permission_confirmed) === true,
    권리: a.rights_status || c.rights_status || null,
  };
}

/** → { 자산, 꼴('사진'|'조감도'|'로고'|'심볼+이름'), 이름표, 출처글, 출처쪽, 파일, 버린것[] } 또는 { 대기 } */
export function 이미지고르기(묶음, 기관, { 파일확인 = true } = {}) {
  if (기관.blocked_by_takedown === true) return { 대기: '묶음에 삭제 요청 기관으로 표시됨(blocked_by_takedown)' };
  if (기관.render_status === 'missing') return { 대기: 'render_status=missing — 이미지 없음 (다른 병원 이미지로 채우지 않음)' };
  const 폴더 = 파일확인 ? 묶음.폴더 : null;
  const 버린것 = [];
  const 후보 = [];
  for (const a of 기관.assets || []) {
    const 왜 = 쓸수있나(a, 폴더);
    if (왜) 버린것.push(`${a.asset_id.slice(0, 10)} ${왜}`); else 후보.push(a);
  }
  if (!후보.length) return { 대기: `자동으로 고를 이미지 없음 — ${버린것.join(' / ') || '자산 0'}`, 버린것 };
  const 점 = (a) => (a.asset_id === 기관.representative_asset_id ? 0 : 사진꼴(a.kind) ? 1 : 조감도꼴(a.kind) ? 2 : 기관것(a) ? 3 : 4);
  후보.sort((x, y) => 점(x) - 점(y));
  let 자산 = 후보[0];
  let 꼴 = 사진꼴(자산.kind) ? '사진' : 조감도꼴(자산.kind) ? '조감도' : '로고';
  /* 공통 브랜드는 전체 기관명 필수 */
  const 공통 = !기관것(자산) || 자산.requires_name_label === true;
  let 이름표 = 공통 ? (기관.name_label || null) : null;
  if (공통 && !이름표) return { 대기: '공통 브랜드인데 name_label 이 비어 있음', 버린것 };
  /* 긴 로고 → 같은 기관의 심볼 + 이름 */
  if (꼴 === '로고' && 비율(자산) >= 긴로고비율) {
    const 심볼 = 후보.find((a) => 심볼꼴(a.kind) && (기관것(a) === 기관것(자산)));
    if (심볼) { 자산 = 심볼; 꼴 = '심볼+이름'; 이름표 = 기관.name_label || 기관.name; }
  }
  const 출처 = 출처찾기(자산, 묶음.조건);
  if (!출처.출처글) return { 대기: `고른 파일(${자산.asset_id.slice(0, 10)})의 attribution_text 가 없음`, 버린것 };
  return {
    자산, 꼴, 이름표, ...출처,
    파일: path.join(묶음.폴더, 자산.render_path),
    투명: 자산.has_transparency === true,
    크기: { 가로: 자산.width || null, 세로: 자산.height || null },
    버린것,
  };
}

/* 화면 아래에 적을 짧은 출처 — attribution_text 에서 주소 앞까지 */
export function 화면출처(고른) {
  const 앞 = String(고른.출처글 || '').split(/\s·\s*https?:\/\//)[0].trim();
  return (고른.꼴 === '조감도' ? '건축조감도 · ' : '') + 앞;
}

/* 캡션에 넣을 줄 — 원문 링크 + 고른 파일의 출처. 「허가」라는 말을 쓰지 않습니다 */
export function 캡션출처줄(고른, 원문주소) {
  const 줄 = [];
  if (원문주소) 줄.push(`🔗 공고 원문: ${원문주소}`);
  if (고른) {
    줄.push(`📷 ${고른.출처글}${고른.꼴 === '조감도' ? ' (건축조감도 · 실제 사진 아님)' : ''}`);
    if (고른.출처쪽 && !String(고른.출처글).includes(고른.출처쪽)) 줄.push(`   출처 페이지: ${고른.출처쪽}`);
    if (고른.이름표) 줄.push(`   기관: ${고른.이름표}`);
    줄.push('   기관이 요청하면 이 게시물을 내리고 다시 올리지 않습니다.');
  }
  return 줄;
}

/* ── 게시 금지 ── */
export function 금지파일(폴더) { return path.join(폴더, 'do_not_publish.json'); }
/* ★ 2026-11-17 — 삭제 요청 목록은 **묶음 밖 한 곳**에 둡니다 (세중님: 드라이브 묶음이 계속 새로 쌓임).
   묶음 폴더 안에만 두면 새 묶음으로 바꿀 때 삭제 요청 기록이 사라져 「재게시 금지」가 깨집니다.
   게시중단.mjs 는 여기에만 씁니다. 읽을 때는 이 파일 + 묶음 안 do_not_publish.json 을 **합쳐** 봅니다 */
export function 우리금지파일() { return process.env.RAPO777_BLOCK_FILE || path.join(os.homedir(), 'rapo777_게시금지.json'); }
export function 우리금지읽기() {
  const f = 우리금지파일();
  if (!fs.existsSync(f)) return { schema_version: '1.0', blocked_institutions: [] };
  const 몸 = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!Array.isArray(몸.blocked_institutions)) throw new Error(`${f} 에 blocked_institutions 배열이 없습니다`);
  return 몸;
}
export function 금지읽기(폴더) {
  const f = 금지파일(폴더);
  if (!fs.existsSync(f)) throw new Error(`do_not_publish.json 이 없습니다 — ${f}. 없이는 발행하지 않습니다`);
  const 몸 = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!Array.isArray(몸.blocked_institutions)) throw new Error('do_not_publish.json 에 blocked_institutions 배열이 없습니다');
  return { blocked_institutions: [...몸.blocked_institutions, ...우리금지읽기().blocked_institutions] };
}
/** 같은 기관인가 — 묶음이 바뀌면 institution_ref 번호가 바뀔 수 있어 번호만으로 보지 않습니다.
    ykiho 가 같거나 · key 가 같거나 · (번호가 같고 key 도 같으면). 이름이 같은 다른 병원까지 막힐 수 있는데,
    그쪽은 「안 올림」이라 안전한 쪽입니다 */
function 같은기관(b, 기관) {
  if (b.ykiho && 기관.ykiho && b.ykiho === 기관.ykiho) return true;
  if (b.key && b.key === 기관.key) return true;
  return !!(b.institution_ref && b.institution_ref === 기관.institution_ref && (!b.key || b.key === 기관.key));
}
/** 매 발행 직전에 부릅니다 — 파일을 **그때** 다시 읽습니다 */
export function 게시금지인가(폴더, 기관) {
  const 걸림 = 금지읽기(폴더).blocked_institutions.find((b) => 같은기관(b, 기관));
  return 걸림 ? `게시 금지 (${걸림.requested_at || '때 미상'} · ${걸림.reason || '사유 없음'})` : null;
}

/* 중복 발행 열쇠 — 기관 식별값 + (공고 id · 원문 주소) */
export function 발행열쇠들(기관, 공고ids = [], 원문주소 = null) {
  const 기 = 기관.ykiho || 기관.institution_ref;
  return [...공고ids.map((id) => `${기}|id:${id}`), ...(원문주소 ? [`${기}|url:${String(원문주소).trim()}`] : [])];
}

/* ── 릴스 자료에 붙이기 — run.mjs 가 공고마다 부릅니다 (같은 코드로 견본도 만듭니다) ──
   ① 기관 연결 ② 게시 금지(+옛 내림목록 이름) ③ 이미지 고르기 ④ 중복 열쇠 → 자료에 사진/로고·화면 출처·캡션 줄을 넣습니다
   하나라도 불확실하면 { 대기 } — 이미지 없이 내보내지 않습니다 */
const 이름키 = (s) => String(s || '').replace(/\s+/g, '').replace(/^(학교법인|의료법인|사회복지법인|재단법인)/, '').replace(/부속/g, '');
export function 이미지붙이기(묶음, 자료, 앱, 원문주소, { 낸열쇠 = {}, 옛내림 = [] } = {}) {
  const 연결 = 기관연결(묶음, 앱);
  if (연결.대기) return { 대기: '기관 연결 — ' + 연결.대기 };
  const 기 = 연결.기관;
  const 내림키 = 옛내림.map(이름키);
  const 금지 = 게시금지인가(묶음.폴더, 기) || ([기.key, 기.name, 자료.기관].map(이름키).some((k) => 내림키.includes(k)) ? '옛 내림목록.json 에 있음' : null);
  if (금지) return { 대기: 금지, 기관ref: 기.institution_ref, 제외: true };
  const 고른 = 이미지고르기(묶음, 기);
  if (고른.대기) return { 대기: '이미지 — ' + 고른.대기, 기관ref: 기.institution_ref };
  const 열쇠들 = 발행열쇠들(기, 자료.묶은id || [자료.id], 원문주소);
  const 겹침 = 열쇠들.find((k) => 낸열쇠[k]);
  if (겹침) return { 겹침: `${겹침} → ${낸열쇠[겹침]}` };
  /* 사진·조감도는 화면 가득(가로 600 이상일 때) · 그밖(로고·심볼·작은 사진)은 흰 판에 비율 그대로 */
  if ((고른.꼴 === '사진' || 고른.꼴 === '조감도') && (고른.크기.가로 || 0) >= 600) 자료.사진 = 고른.파일;
  else 자료.로고 = { 파일: 고른.파일, 이름표: 고른.이름표, 가로: 고른.크기.가로, 세로: 고른.크기.세로, 투명: 고른.투명 };
  if (고른.꼴 === '조감도') 자료.사진꼴 = '조감도';
  자료.이미지출처 = 화면출처(고른);
  /* 캡션 — 「⚠️ 원문 확인」 줄 뒤에 원문 링크 + 고른 파일의 출처 (해시태그·CTA 는 그 뒤 그대로) */
  const 줄 = String(자료.캡션 || '').split('\n');
  const 자리 = 줄.findIndex((x) => x.startsWith('⚠️'));
  줄.splice(자리 >= 0 ? 자리 + 1 : 줄.length, 0, '', ...캡션출처줄(고른, 원문주소));
  자료.캡션 = 줄.join('\n');
  자료.이미지 = { 기관ref: 기.institution_ref, key: 기.key, ykiho: 기.ykiho || null, 연결근거: 연결.근거, asset_id: 고른.자산.asset_id,
    꼴: 고른.꼴, 파일: 고른.자산.render_path, 출처글: 고른.출처글, 출처쪽: 고른.출처쪽, permission_confirmed: 고른.허가확인 };
  자료.발행열쇠 = 열쇠들;
  자료.기관묶음 = 기;
  return { 자료 };
}

/* ── 자기점검 · 전수 점검 ── */
function 자기점검() {
  const 자산 = (o) => ({ asset_id: 'a_' + Math.random().toString(16).slice(2).padEnd(12, '0'), render_path: 'assets/x.png', kind: 'wordmark',
    scope: 'institution_specific', width: 400, height: 200, attribution_text: '이미지 출처: 가 · https://a.kr/', source_page: 'https://a.kr/',
    permission_confirmed: false, historical_asset: false, restricted_reference: false, ...o });
  const 강릉로고 = 자산({ kind: 'wordmark', attribution_text: '이미지 출처: 강릉아산병원 · https://www.gnah.co.kr/kor/Main.do', source_page: 'https://www.gnah.co.kr/kor/Main.do' });
  const 강릉사진 = 자산({ kind: 'photo', attribution_text: '이미지 출처: 강릉아산병원 · https://www.gnah.co.kr/photo', source_page: 'https://www.gnah.co.kr/photo' });
  const 기관들 = [
    { institution_ref: 'rapo777_0001', key: '강릉아산병원', name: '강릉아산병원', name_label: '강릉아산병원',
      ykiho: 'YK1', org_id: 'HIRA:YK1', address: '강원특별자치도 강릉시 사천면 방동길 38-0, 강릉아산병원',
      render_status: 'ready', representative_asset_id: 강릉로고.asset_id, assets: [강릉로고, 강릉사진] },
    /* 같은 이름 둘 (본원·분원 꼴) */
    { institution_ref: 'rapo777_0100', key: '강남병원', name: '강남병원', ykiho: 'YK100', address: '대구 수성구 1', render_status: 'ready', assets: [자산({})] },
    { institution_ref: 'rapo777_0101', key: '강남병원', name: '강남병원', ykiho: null, org_id: null, address: '경기 용인시 2', render_status: 'ready', assets: [자산({})] },
    /* 과거 자료만 (exceptions.json 의 포항노인전문요양병원 꼴) */
    { institution_ref: 'rapo777_0356', key: '경상북도포항노인전문요양병원', name: '경상북도포항노인전문요양병원', ykiho: null, render_status: 'historical_only',
      representative_asset_id: 'h', assets: [자산({ asset_id: 'h', historical_asset: true })] },
    /* 공통 브랜드 */
    { institution_ref: 'rapo777_0500', key: '근로복지공단창원병원', name: '근로복지공단 창원병원', name_label: '근로복지공단 창원병원', ykiho: 'YK500',
      render_status: 'ready', assets: [자산({ scope: 'shared_brand', kind: 'wordmark' })] },
    { institution_ref: 'rapo777_0501', key: '이름표없음', name: '이름표없음', ykiho: 'YK501', render_status: 'ready', assets: [자산({ scope: 'shared_brand' })] },
    /* 긴 로고 + 심볼 */
    { institution_ref: 'rapo777_0600', key: '긴로고병원', name: '긴로고병원', name_label: '긴로고병원', ykiho: 'YK600', render_status: 'ready',
      representative_asset_id: 'long', assets: [자산({ asset_id: 'long', width: 1488, height: 200 }),
        자산({ asset_id: 'sym', kind: 'symbol', width: 300, height: 300, attribution_text: '이미지 출처: 긴로고병원 · https://long.kr/sym' })] },
    /* 조감도만 · 참고 전용 사진은 버림 */
    { institution_ref: 'rapo777_0700', key: '새병원', name: '새병원', ykiho: 'YK700', render_status: 'ready', representative_asset_id: 'ref',
      assets: [자산({ asset_id: 'ref', kind: 'photo', restricted_reference: true }), 자산({ asset_id: 'rend', kind: 'facility_rendering', attribution_text: '이미지 출처: 새병원 · https://new.kr/' })] },
    { institution_ref: 'rapo777_0800', key: '빈병원', name: '빈병원', ykiho: 'YK800', render_status: 'missing', assets: [] },
  ];
  const 묶음 = { 폴더: '/없음', 기관들, 조건: new Map() };
  const 고 = (ref) => 이미지고르기(묶음, 기관들.find((x) => x.institution_ref === ref), { 파일확인: false });
  const 틀림 = [];
  const 봐 = (이름, 참) => { console.log((참 ? '○ ' : '✗ ') + 이름); if (!참) 틀림.push(이름); };

  봐('연결 — ykiho 일치', 기관연결(묶음, { ykiho: 'YK1', 기관번호: 'HIRA:YK1', 이름: '강릉아산병원' }).기관?.institution_ref === 'rapo777_0001');
  봐('연결 — ykiho 없고 org_id = 기관번호', 기관연결(묶음, { ykiho: null, 기관번호: 'HIRA:YK1', 이름: '아무' }).기관?.institution_ref === 'rapo777_0001');
  봐('연결 — NAME: 기관번호는 org_id 대조에 안 씀', !기관연결(묶음, { 기관번호: 'NAME:강남병원', 이름: '강남병원' }).기관);
  봐('연결 — 동명 병원, 주소 없으면 대기', /이름만 같은 곳 2곳/.test(기관연결(묶음, { 기관번호: 'NAME:강남병원', 이름: '강남병원' }).대기 || ''));
  봐('연결 — 동명 병원, 이름+주소 같은 한 곳만', 기관연결(묶음, { 기관번호: 'NAME:강남병원', 이름: '강남병원', 주소: '경기 용인시 2' }).기관?.institution_ref === 'rapo777_0101');
  봐('연결 — 대구 강남(ykiho)에 용인 주소를 안 붙임', 기관연결(묶음, { ykiho: 'YK100', 이름: '강남병원', 주소: '경기 용인시 2' }).기관?.institution_ref === 'rapo777_0100');
  봐('연결 — 기관 표 줄 없으면 대기', !!기관연결(묶음, null).대기);
  봐('연결 — 목록에 없으면 대기', /맞는 기관 없음/.test(기관연결(묶음, { ykiho: 'ZZ', 이름: '없는병원' }).대기 || ''));

  const g1 = 고('rapo777_0001');
  봐('고르기 — 대표 파일 먼저 (로고)', g1.자산?.asset_id === 강릉로고.asset_id && g1.꼴 === '로고');
  봐('출처 — 고른 파일의 attribution_text', g1.출처글 === 강릉로고.attribution_text);
  봐('고르기 — 과거 자료만이면 대기', /과거 자료/.test(고('rapo777_0356').대기 || ''));
  const g5 = 고('rapo777_0500');
  봐('고르기 — 공통 브랜드는 name_label 함께', g5.이름표 === '근로복지공단 창원병원');
  봐('고르기 — 공통 브랜드인데 name_label 없으면 대기', /name_label/.test(고('rapo777_0501').대기 || ''));
  const g6 = 고('rapo777_0600');
  봐('고르기 — 긴 로고는 같은 기관 심볼 + 이름', g6.꼴 === '심볼+이름' && g6.자산.asset_id === 'sym' && g6.이름표 === '긴로고병원');
  봐('출처 — 심볼로 바꾸면 심볼 파일의 출처', g6.출처글 === '이미지 출처: 긴로고병원 · https://long.kr/sym');
  const g7 = 고('rapo777_0700');
  봐('고르기 — 참고 전용 대표는 건너뛰고 조감도', g7.자산?.asset_id === 'rend' && g7.꼴 === '조감도');
  봐('화면 출처 — 조감도 표시 · 주소 뺌', 화면출처(g7) === '건축조감도 · 이미지 출처: 새병원');
  봐('캡션 — 조감도를 실사라 하지 않음', 캡션출처줄(g7, 'https://x').some((s) => s.includes('실제 사진 아님')));
  봐('캡션 — 원문 링크가 들어감', 캡션출처줄(g1, 'https://recruit.example/1')[0] === '🔗 공고 원문: https://recruit.example/1');
  봐('캡션 — 「허가」라는 말을 안 씀', !캡션출처줄(g1, 'u').join('\n').includes('허가'));
  봐('고르기 — missing 은 대기', /missing/.test(고('rapo777_0800').대기 || ''));
  봐('고르기 — 허가 미확인은 그대로 false', g1.허가확인 === false);

  /* 게시 금지 — 실제 파일로 (묶음 밖 목록도 임시 자리로) */
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'rapo777-'));
  const 전 = process.env.RAPO777_BLOCK_FILE; process.env.RAPO777_BLOCK_FILE = path.join(임시, '우리.json');
  fs.writeFileSync(금지파일(임시), JSON.stringify({ blocked_institutions: [{ institution_ref: 'rapo777_0001', key: '강릉아산병원', reason: '시험', requested_at: '2026-11-17T00:00:00+09:00' }] }));
  봐('금지 — 등록된 기관은 걸림', !!게시금지인가(임시, 기관들[0]));
  봐('금지 — 다른 기관은 안 걸림', !게시금지인가(임시, 기관들[1]));
  fs.writeFileSync(금지파일(임시), JSON.stringify({ blocked_institutions: [] }));
  봐('금지 — 매번 다시 읽음 (지운 뒤엔 안 걸림)', !게시금지인가(임시, 기관들[0]));
  fs.rmSync(금지파일(임시));
  let 던짐 = false; try { 게시금지인가(임시, 기관들[0]); } catch { 던짐 = true; }
  봐('금지 — 파일이 없으면 발행하지 않음(던짐)', 던짐);
  /* 묶음 밖 목록 — 새 묶음(번호가 바뀜)에서도 ykiho·key 로 막힘 · 묶음 안 목록이 비어도 막힘 */
  fs.writeFileSync(금지파일(임시), JSON.stringify({ blocked_institutions: [] }));
  fs.writeFileSync(path.join(임시, '우리.json'), JSON.stringify({ blocked_institutions: [{ institution_ref: 'rapo777_0001', key: '강릉아산병원', ykiho: 'YK1', reason: '요청' }] }));
  봐('금지 — 묶음 밖 목록도 읽음', !!게시금지인가(임시, 기관들[0]));
  봐('금지 — 새 묶음에서 번호가 바뀌어도 ykiho 로 막음', !!게시금지인가(임시, { ...기관들[0], institution_ref: 'rapo777_0999', key: '강릉아산병원(새)' }));
  봐('금지 — 번호만 같은 다른 기관은 안 막음', !게시금지인가(임시, { institution_ref: 'rapo777_0001', key: '다른병원', ykiho: 'ZZ' }));
  if (전) process.env.RAPO777_BLOCK_FILE = 전; else delete process.env.RAPO777_BLOCK_FILE;
  fs.rmSync(임시, { recursive: true });

  봐('중복 열쇠 — 기관 + 공고 id + 원문 주소', 발행열쇠들(기관들[0], ['A1'], 'https://u').join(' ') === 'YK1|id:A1 YK1|url:https://u');
  console.log(`\n견본 ${틀림.length ? '✗ 틀림 ' + 틀림.length : '틀림 0'}`);
  if (틀림.length) process.exit(1);
}

function 전수점검(폴더) {
  const 묶음 = 묶음읽기(폴더);
  금지읽기(폴더);
  const 셈 = {}; const 대기 = [];
  for (const 기 of 묶음.기관들) {
    const g = 이미지고르기(묶음, 기);
    const 칸 = g.대기 ? '대기' : g.꼴 + (g.이름표 ? '(이름표)' : '');
    셈[칸] = (셈[칸] || 0) + 1;
    if (g.대기) 대기.push(`${기.institution_ref} ${기.name} — ${g.대기}`);
  }
  console.log(`묶음 ${폴더} · 기관 ${묶음.기관들.length}곳 · 스냅샷 ${묶음.스냅샷}`);
  console.log(Object.entries(셈).map(([k, v]) => `${k} ${v}`).join(' · '));
  대기.forEach((s) => console.log('  대기 ' + s));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--자기점검')) 자기점검();
  else if (process.argv.includes('--점검')) {
    const i = process.argv.indexOf('--폴더');
    전수점검(i > 0 ? process.argv[i + 1] : 묶음폴더());
  } else console.log('--자기점검 또는 --점검 [--폴더 <묶음>]');
}
