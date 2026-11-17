/* 릴스를 만들기 **직전에** 원문 공고를 직접 열어 봅니다 (2026-11-17 세중님
   「잘못 올린 공고로 릴스를 만들 수도 있으니 공고가 있는지 확인하고 올리자」)

   판정은 셋뿐입니다 — 기존 alive.mjs 와 같은 결 (지침 6절 · 기준은 한 자리)
     통과   원문이 살아 있고, 그 공고 쪽이 맞습니다 → 릴스를 만듭니다
     보류   없어짐 · 마감 표시 · 엉뚱한 쪽 → **만들지 않습니다**
     모름   사이트 장애 · 막힘 · 시간 초과 → 이번 바퀴는 건너뛰고 다음 바퀴에 다시 봅니다
            (사이트가 잠깐 아픈 것을 「없어졌다」로 세지 않습니다)

   판정 규칙은 새로 만들지 않고 이미 있는 것을 씁니다
     없어짐말 · 알림상태 · 제목마감   tools/hosp/hs_목록상태.mjs
     붙여받기 (인증서 빠진 병원)       tools/certs/index.mjs
     날짜 여러 꼴 (2026. 11. 25.)      tools/칸대조.mjs 칸판정
     이름표 (User-Agent)               tools/수집기이름표.mjs

   마감일·직군이 쪽에 **없는 것**은 막지 않고 「?」로만 적습니다 — 병원 게시판은 그 내용을
   첨부·그림에 두는 곳이 많아, 「쪽에 없다」가 「틀렸다」가 아닙니다 (지침 10-5 · 재는 자를 먼저 의심)

   node tools/reels/원문확인.mjs --id 306936,HS1225713085    몇 건만 (서버에서)
   node tools/reels/원문확인.mjs --자기점검                  견본 HTML 로 판정 시험 (어디서나) */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 없어짐말, 알림상태, 제목마감 } from '../hosp/hs_목록상태.mjs';
import { 붙여받기 } from '../certs/index.mjs';
import { 칸판정, 글자만 } from '../칸대조.mjs';
import { 이름표 } from '../수집기이름표.mjs';

const UA = 이름표('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
const 법인뗌 = (s) => String(s || '').replace(/^(학교법인|의료법인|사회복지법인|재단법인)\s*/, '');

/* 기관 이름이 쪽에 있나 — 「충청남도 홍성군 보건소」 처럼 긴 이름은 끝 낱말 둘로도 봅니다 */
function 기관있나(글자, 이름들) {
  for (const n of 이름들.filter(Boolean)) {
    const 전체 = 글자만(법인뗌(n));
    if (전체.length >= 4 && 글자.includes(전체)) return true;
    const 낱 = 법인뗌(n).split(/\s+/).filter((w) => w.length >= 2);
    const 끝둘 = 글자만(낱.slice(-2).join(''));
    if (낱.length >= 2 && 끝둘.length >= 4 && 글자.includes(끝둘)) return true;
  }
  return false;
}

/** HTML 하나로 판정합니다 (받기와 갈라 두어 견본으로 시험할 수 있게) */
export function 쪽판정(html, 공고) {
  const 원본 = String(html || '');
  if (없어짐말.test(원본)) return { 판정: '보류', 까닭: '원문이 없어졌습니다 「' + (원본.match(없어짐말) || [''])[0] + '」' };
  const A = 알림상태(원본);
  if (A.결과 === 'closed') return { 판정: '보류', 까닭: A.왜 };
  const 글 = 원본.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim();
  if (글.length < 200) return { 판정: '모름', 까닭: `쪽 글이 ${글.length}자뿐 (판단 못 함)` };
  for (const 제목 of [공고.원문제목, 공고.title].filter(Boolean)) {
    const T = 제목마감(원본, 제목);
    if (T.결과 === 'closed') return { 판정: '보류', 까닭: T.왜 };
  }
  if (/(접수|모집|원서)\s*기간[^가-힣0-9]{0,8}(＜|<|&lt;|\[|\()?\s*마감/.test(글)) return { 판정: '보류', 까닭: '본문 접수기간 자리에 「마감」' };

  const 글자 = 글자만(글);
  const 제목있음 = [공고.원문제목, 공고.title].filter(Boolean).some((t) => {
    const 토 = 글자만(t).slice(0, 14);
    return 토.length >= 6 && 글자.includes(토);
  });
  const 기관있음 = 기관있나(글자, [공고.기관이름, 공고.org_name]);
  if (!제목있음 && !기관있음) return { 판정: '보류', 까닭: '쪽에 이 공고 제목도 기관 이름도 없습니다 (엉뚱한 쪽일 수 있음)' };

  /* 덧붙여 보는 것 — 막지 않고 메일에 ✓ / ? 로 */
  const 확인 = [];
  확인.push(제목있음 ? '✓ 공고 제목이 원문에 있음' : '✓ 기관 이름이 원문에 있음');
  const 마감 = 칸판정('접수마감', { 값: 공고.apply_to, 어디서: '공고문' }, 글);
  확인.push(마감.판정 === '맞음' ? `✓ 마감일 ${공고.apply_to} 이 원문에 있음` : `? 마감일 ${공고.apply_to} 을 원문 쪽에서 못 찾음 (첨부에 있을 수 있음)`);
  const 직군말 = /물리/.test(공고.job_group || '') ? /물리\s*치료/ : /작업/.test(공고.job_group || '') ? /작업\s*치료/ : /(물리|작업)\s*치료/;
  확인.push(직군말.test(글) ? '✓ 직군이 원문에 있음' : '? 직군을 원문 쪽에서 못 찾음 (첨부·통합공고일 수 있음)');
  return { 판정: '통과', 까닭: '원문이 살아 있고 이 공고 쪽입니다', 확인 };
}

/** 원문을 받아 판정합니다. 던지지 않습니다 */
export async function 원문확인(공고) {
  const url = 공고.url;
  if (!url) return { 판정: '모름', 까닭: '원문 주소가 없습니다' };
  const g = await 붙여받기(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' }, timeout: 20000 });
  if (g.왜) return { 판정: '모름', 까닭: '못 붙음 · ' + String(g.왜).slice(0, 60) };
  if (g.code === 404 || g.code === 410) return { 판정: '보류', 까닭: `원문 주소가 HTTP ${g.code} (없어짐)` };
  if (g.code >= 400) return { 판정: '모름', 까닭: `HTTP ${g.code}` + (g.code >= 500 ? ' (사이트 장애)' : g.code === 403 ? ' (막힘)' : '') };
  const ct = g.headers?.get?.('content-type') || '';
  const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
    || (g.buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  let html;
  try { html = new TextDecoder(cs.toLowerCase()).decode(g.buf); } catch { html = g.buf.toString('utf8'); }
  return { ...쪽판정(html, 공고), 주소: url };
}

/* ── 자기점검 — 견본 HTML 로 갈래마다 한 번씩 ── */
function 자기점검() {
  const 길 = 'x'.repeat(250);
  const 공고 = { title: '전남대학교병원 작업치료사 계약직 채용공고', 원문제목: '2026년 11월 전남대학교병원 직원(지원직) 공개채용 공고',
    org_name: '전남대학교병원', 기관이름: '전남대학교병원', apply_to: '2026-11-25', job_group: '작업치료사' };
  const 견본 = [
    ['없어진 글', `<p>존재하지 않는 게시물입니다</p>${길}`, '보류'],
    ['알림창 마감', `<script>alert('이미 마감된 게시글 입니다.')</script><div>${길}</div>`, '보류'],
    ['제목에 [마감]', `<h1>[마감] 2026년 11월 전남대학교병원 직원(지원직) 공개채용 공고</h1><p>${길}</p>`, '보류'],
    ['엉뚱한 쪽', `<h1>채용 게시판</h1><p>다른 병원 이야기 ${길}</p>`, '보류'],
    ['빈 껍데기', '<html><body>로딩중</body></html>', '모름'],
    ['멀쩡 · 날짜 있음', `<h1>2026년 11월 전남대학교병원 직원(지원직) 공개채용 공고</h1><p>작업치료사 1명 · 원서접수 2026. 11. 18. ~ 2026. 11. 25. 17:00 ${길}</p>`, '통과'],
    ['멀쩡 · 날짜는 첨부', `<h1>2026년 11월 전남대학교병원 직원(지원직) 공개채용 공고</h1><p>첨부파일을 확인하세요 ${길}</p>`, '통과'],
    ['보건소 · 이름 끝 둘', `<p>홍성군 보건소 기간제근로자 채용 공고 작업치료사 ${길}</p>`, '통과', { title: '홍성군 보건소 작업치료사 계약직 채용공고', 원문제목: '2027년 홍성군정신건강복지센터 기간제근로자 채용 공고', org_name: '충청남도 홍성군 보건소', apply_to: '2026-11-27', job_group: '작업치료사' }],
  ];
  let 틀림 = 0;
  for (const [이름, html, 기대, 다른공고] of 견본) {
    const r = 쪽판정(html, 다른공고 || 공고);
    const ok = r.판정 === 기대;
    if (!ok) 틀림++;
    console.log(`${ok ? '○' : '✗'} ${이름} → ${r.판정} (기대 ${기대}) · ${r.까닭}${r.확인 ? ' · ' + r.확인.join(' / ') : ''}`);
  }
  console.log(`\n견본 ${견본.length} · 틀림 ${틀림}`);
  process.exit(틀림 ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--자기점검')) 자기점검();
}
