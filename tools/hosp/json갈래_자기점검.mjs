/* type:'json' 갈래 자기점검 — node tools/hosp/json갈래_자기점검.mjs
 *
 * 사이트를 두드리지 않습니다. `사이트줄()` 의 json 가지가 쓰는 규칙
 * (줄경로 길따라가기 · 링크꼴 치환 · 열쇠 집기 · 빈 목록)을 봅니다.
 *
 * 견본은 화성중앙 ajax 응답과 **그 쪽 성공 콜백에 적힌 열쇠 이름**입니다
 * (docs/데이터주소_찾은것_1019.md) — 짐작으로 만든 이름이 아닙니다.
 */
const 어긴것 = [];
const 봐 = (말, 참) => { if (!참) 어긴것.push(말); };

/* `사이트줄()` 의 json 가지와 **같은 규칙**을 여기 적습니다.
   두 자리가 되지만, 저쪽은 네트워크를 타서 점검에 쓸 수 없습니다 —
   규칙이 어긋나면 이 점검이 통과해도 실제가 다를 수 있으니,
   저쪽을 고치면 **이 파일도 함께 고칩니다** (파일 머리에 적어 둡니다). */
const 길따라 = (o, 길) => String(길 || '').split('.').filter(Boolean)
  .reduce((v, k) => (v == null ? v : v[k]), o);

const 줄만들기 = (다, s) => (다 || []).map((x) => {
  const 꼴 = String(s['링크꼴'] || '');
  const url = 꼴
    ? 꼴.replace(/\{([^}]+)\}/g, (_, k) => encodeURIComponent(String(x[k] ?? '')))
    : String(x[s['링크열쇠'] || 'url'] || '');
  return {
    title: String(x[s['제목열쇠'] || 'title'] || '').trim(),
    url,
    posted: s['날짜열쇠'] ? String(x[s['날짜열쇠']] || '') || null : null,
    cls: s['갈래열쇠'] ? String(x[s['갈래열쇠']] || '') : '',
  };
}).filter((x) => x.title && x.url);

/* ── ① 길따라가기 ───────────────────────────────────────── */
const 응답 = { json: { list: [], pagination: '', TotalCount: '0' }, success: true };
봐('줄경로 json.list 가 배열', Array.isArray(길따라(응답, 'json.list')));
봐('셈경로 json.TotalCount', 길따라(응답, 'json.TotalCount') === '0');
봐('없는 길은 undefined', 길따라(응답, 'json.없는것.더없는것') === undefined);
봐('빈 길이면 그대로', 길따라(응답, '') === 응답);

/* ── ② 화성중앙 설정으로 줄 만들기 ─────────────────────── */
const 설정 = {
  '줄경로': 'json.list', '제목열쇠': 'title', '날짜열쇠': 'REG_DATE',
  '링크꼴': 'http://hjhospital.co.kr/bbs/notice_view.php?seq={seq}',
};
/* 그 쪽 콜백이 쓰는 열쇠 그대로 — item.seq · item.title · item.REG_DATE */
const 가짜 = [
  { RNUM: 1, seq: 412, title: '물리치료사 채용 공고', REG_DATE: '2026-10-18', valid: 'Y' },
  { RNUM: 2, seq: 411, title: '2026년 간호사 모집', REG_DATE: '2026-10-10', valid: 'Y' },
  { RNUM: 3, seq: 410, title: '', REG_DATE: '2026-10-01', valid: 'Y' },          /* 제목 없음 → 버림 */
];
const 줄 = 줄만들기(가짜, 설정);
봐('제목 없는 줄은 버린다', 줄.length === 2);
봐('제목이 그대로', 줄[0].title === '물리치료사 채용 공고');
봐('링크꼴이 seq 를 넣는다',
  줄[0].url === 'http://hjhospital.co.kr/bbs/notice_view.php?seq=412');
봐('날짜가 들어간다', 줄[0].posted === '2026-10-18');
봐('두 줄이 다른 주소', 줄[0].url !== 줄[1].url);

/* ── ③ 빈 목록은 **탈이 아닙니다** ─────────────────────── */
봐('빈 목록이면 줄 0', 줄만들기([], 설정).length === 0);
봐('null 이어도 안 터진다', 줄만들기(null, 설정).length === 0);

/* ── ④ 링크꼴에 값이 없으면 ─────────────────────────────── */
const 줄2 = 줄만들기([{ title: '있음', seq: null }], 설정);
봐('seq 가 null 이면 빈 값으로 들어간다',
  줄2.length === 1 && 줄2[0].url.endsWith('seq='));

/* ── ⑤ 주소에 들어갈 값은 인코딩합니다 ─────────────────── */
const 줄3 = 줄만들기([{ title: '있음', seq: 'a b&c' }],
  { ...설정, '링크꼴': 'http://x.kr/v?seq={seq}' });
봐('값에 든 & 와 빈칸을 인코딩한다', 줄3[0].url === 'http://x.kr/v?seq=a%20b%26c');

/* ── ⑥ 링크열쇠 꼴 (링크꼴이 없을 때) ──────────────────── */
const 줄4 = 줄만들기([{ 제목: '있음', 주소: 'http://x.kr/1' }],
  { '제목열쇠': '제목', '링크열쇠': '주소' });
봐('링크열쇠로도 된다', 줄4.length === 1 && 줄4[0].url === 'http://x.kr/1');

if (어긴것.length) {
  console.error('✗ json 갈래 자기점검 실패 ' + 어긴것.length + '가지');
  for (const x of 어긴것) console.error('   · ' + x);
  process.exit(1);
}
console.log('○ json 갈래 자기점검 통과 — 14가지 (사이트를 두드리지 않았습니다)');
