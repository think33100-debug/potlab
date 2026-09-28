import { NextResponse } from 'next/server';

/* 시험용 — 서울 리전에서 「막혔던 병원」 이 열리는지 봅니다 (2026-09-28).
 *
 * ⚠ **운영에 남기지 않습니다.** 시험이 끝나면 이 파일을 지우고 다시 올립니다.
 *
 * ── 왜 ────────────────────────────────────────────────────────
 * 구글(Apps Script)·GitHub Actions 에서 막히던 병원 37곳입니다.
 * 집 컴퓨터(한국 IP)에서는 전부 열렸고, Vercel 서울에서도 네 곳이 열렸습니다.
 * 이제 **나머지 전부**가 서울에서 열리는지 봅니다.
 * 안 열리는 곳이 나오면 AWS 대역 자체를 막는 곳일 수 있어 따로 목록을 뺍니다.
 *
 * ── 이 파일이 지키는 것 ───────────────────────────────────────
 * · 아무 데도 안 씁니다 (시트·DB·저장소)
 * · 비밀값을 안 씁니다 · 로그인·인증 우회를 하지 않습니다
 * · 공개된 채용 게시판만 한 번씩 읽습니다
 *
 * ── 「몇 건 왔다」 만 찍지 않습니다 ────────────────────────────
 * 곳마다 상태코드·응답 원문 앞 1,200자·실패하면 오류 원문을 그대로 담습니다.
 *
 * 명단은 gas/wage.js 의 HOSP_SITES 에서 `off` 가 적힌 줄을 뽑아 만든 것입니다.
 * (gas/ 는 저장소 밖이라 Vercel 에 없습니다. 그래서 여기 적어 둡니다)
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type 곳 = { 이름: string; 까닭: string; url: string; enc?: string };

const 볼곳: 곳[] = [
  { 이름: "충청남도 천안의료원", 까닭: "주소못찾음", url: "https://www.camc.or.kr/board/syfsx" },
  { 이름: "대동병원", 까닭: "403", url: "https://www.ddh.co.kr/board/%EA%B3%A0%EA%B0%9D%EC%84%9C%EB%B9%84%EC%8A%A4/%EC%B1%84%EC%9A%A9%EC%86%8C%EC%8B%9D" },
  { 이름: "대전한국병원", 까닭: "403", url: "https://djh.kr/community/recruit" },
  { 이름: "대진의료재단 분당제생병원", 까닭: "주소못찾음", url: "https://www.dmc.or.kr/recruit/recruit/list.do" },
  { 이름: "동아병원", 까닭: "해외차단", url: "https://dongahospital.co.kr/bbs/board.php?bo_table=0403" },
  { 이름: "의료법인 오성의료재단 동군산병원", 까닭: "주소못찾음", url: "https://www.donggunsanhosp.co.kr/kor/recruit.cs" },
  { 이름: "의료법인 녹산의료재단동수원병원", 까닭: "방화벽406", url: "https://www.dswhosp.co.kr/support/recruit.php" },
  { 이름: "의료법인숭인의료재단 김해복음병원", 까닭: "403", url: "http://www.gimhaebokum.com/05_community/community_07.php?code=employ", enc: "EUC-KR" },
  { 이름: "녹색병원", 까닭: "프록시차단", url: "https://www.greenhospital.co.kr/bbs/board.php?tbl=bbs65" },
  { 이름: "의료법인 광혜의료재단 광혜병원", 까닭: "403", url: "https://www.gwanghyehospital.com/bbs/board.php?bo_table=K050500" },
  { 이름: "창원한마음병원", 까닭: "403", url: "https://recruit.hanheart.co.kr/02_recruit/01_recruit.php" },
  { 이름: "한마음병원", 까닭: "주소못찾음", url: "http://www.hanmaeum.jeju.kr/board/list.do?tblNm=Hire" },
  { 이름: "의료법인 명인의료재단 화홍병원", 까닭: "403", url: "https://www.hwahonghospital.com/page/intro/news/hire.php" },
  { 이름: "의료법인한마음의료재단 여수제일병원", 까닭: "403", url: "https://jeilhp.com/recruit" },
  { 이름: "의료법인 중앙의료재단 중앙병원", 까닭: "403", url: "https://www.jeju-jungangh.com/kor/wpbbs/list.php?wpboard=recruit" },
  { 이름: "제주특별자치도 서귀포의료원", 까닭: "타임아웃", url: "https://www.jjsmc.or.kr/bbs/board.php?bo_table=4_5_1_1" },
  { 이름: "전주고려병원", 까닭: "주소못찾음", url: "http://www.jkhospital.co.kr/bbs/board.php?bo_table=sub06_01" },
  { 이름: "의료법인 건명의료재단 중앙제일병원", 까닭: "방화벽406", url: "https://joongangjeil.co.kr/introduction/recruit.php" },
  { 이름: "전라남도 순천의료원", 까닭: "403", url: "https://jsmc.or.kr/?contentId=c9f0f895fb98ab9159f51fd0297e236d" },
  { 이름: "광주기독병원", 까닭: "주소못찾음", url: "https://www.kch.or.kr/user/board/lists/board_cd/notice" },
  { 이름: "메디인병원", 까닭: "403", url: "https://www.medi-in.co.kr/backend/api/recruit?page=1&limit=20" },
  { 이름: "의료법인동춘의료재단문경제일병원", 까닭: "403", url: "https://www.mgjh.co.kr/bbs/board.php?bo_table=job_01" },
  { 이름: "경상남도마산의료원", 까닭: "주소못찾음", url: "https://www.mmc.or.kr/board/list?id=12&menuId=112" },
  { 이름: "목포시의료원", 까닭: "302고리", url: "https://mokpomc.or.kr/bbs/board.php?bo_table=5_4" },
  { 이름: "의료법인대송의료재단 무안병원", 까닭: "403", url: "http://www.muangh.co.kr/bbs/board.php?bo_table=recruit" },
  { 이름: "온재병원", 까닭: "403", url: "http://www.xn--hc0bs21a7cp8rsyh23j.com/04_customer/customer_07.php" },
  { 이름: "의료법인 양진의료재단 평택성모병원", 까닭: "프록시차단", url: "https://www.ptsm.co.kr/bbs/board.php?tbl=bbs52" },
  { 이름: "(의)성세의료재단 뉴성민병원", 까닭: "주소못찾음", url: "http://www.smgh.co.kr/smgh/main2/board?menuID=service&menuSubID=recruit" },
  { 이름: "의료법인 일심의료재단 포천우리병원", 까닭: "403", url: "http://swoori.co.kr/bbs/board.php?bo_table=recruit" },
  { 이름: "의료법인자인의료재단(더자인병원)", 까닭: "403", url: "https://www.the-jain.co.kr/bbs/board.php?bo_table=ot" },
  { 이름: "울산병원", 까닭: "403", url: "https://ush.kr/bbs/board.php?bo_table=incur_notice" },
  { 이름: "원광대학교 산본병원", 까닭: "403", url: "https://www.wmcsb.co.kr/bbs/board.php?bo_table=hospnews_04" },
  { 이름: "영도병원", 까닭: "403", url: "https://www.ydh.co.kr/bbs/bbs/board.php?bo_table=recruit" },
  { 이름: "의료법인거명의료재단 영광기독병원", 까닭: "403", url: "https://www.ygch.co.kr/?page_id=3917" },
  { 이름: "근로복지공단 태백병원", 까닭: "GitHub400", url: "https://www.comwel.or.kr/taebaek/info/rcrt.jsp" },
  { 이름: "나주종합병원", 까닭: "3연속실패", url: "http://www.ngh.co.kr/cms/bbs/cms.php?dk_cms=comm_02" },
  { 이름: "창원파티마병원", 까닭: "3연속실패", url: "https://www.fatimahosp.co.kr/api/article/3?instNo=1&boardNo=3&startIndex=1&pageRow=20" },];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function 머리글(차수: number, url: string): Record<string, string> {
  if (차수 === 1) return { 'User-Agent': UA };
  let ref = '';
  try { ref = url.split('/').slice(0, 3).join('/') + '/'; } catch { /* 주소가 이상하면 빈 채로 */ }
  return {
    'User-Agent': UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none', 'Sec-Fetch-User': '?1',
    Referer: ref,
  };
}

type 한번 = { code: number | null; 자수: number; 본문: string; 왜: string; ms: number };

async function 두드리기(s: 곳, 차수: number): Promise<한번> {
  const t0 = Date.now();
  try {
    const c = new AbortController();
    const tm = setTimeout(() => c.abort(), 11000);
    const r = await fetch(s.url, { headers: 머리글(차수, s.url), redirect: 'follow', signal: c.signal, cache: 'no-store' });
    clearTimeout(tm);
    const buf = Buffer.from(await r.arrayBuffer());
    /* EUC-KR 쪽이 많습니다. UTF-8 로 읽으면 한글이 깨져 「채용」 이 0번으로 세집니다 */
    const ct = r.headers.get('content-type') || '';
    const cs = s.enc || (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
      || (buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    let html: string;
    try { html = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
    return { code: r.status, 자수: html.length, 본문: html, 왜: '', ms: Date.now() - t0 };
  } catch (e: unknown) {
    const err = e as { cause?: { code?: string }; name?: string; message?: string };
    return {
      code: null, 자수: 0, 본문: '',
      왜: String(err?.cause?.code || err?.name || err?.message || e).slice(0, 200),
      ms: Date.now() - t0,
    };
  }
}

async function 한곳(s: 곳) {
  const a = await 두드리기(s, 1);
  const b = a.code === 200 ? null : await 두드리기(s, 2);
  const 최종 = (b && b.code === 200) ? b : a;
  const 글 = 최종.본문.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  /* 「열렸다」 는 200 만으로는 모자랍니다 — 403 안내문도 200 으로 오는 곳이 있습니다.
     알맹이가 있고 채용 관련 말이 있어야 진짜 열린 것입니다 */
  const 채용말 = (글.match(/채용|모집|공고/g) || []).length;
  return {
    이름: s.이름, 막힌까닭: s.까닭, 주소: s.url,
    성공: 최종.code === 200 && 글.length > 300,
    상태코드: 최종.code,
    '채용·모집·공고_몇번': 채용말,
    '1차_UA만': a.code !== null ? 'HTTP ' + a.code + ' · ' + a.자수 + '자 · ' + a.ms + 'ms'
      : '못 엶 · ' + a.왜 + ' · ' + a.ms + 'ms',
    '2차_브라우저흉내': b === null ? '(1차에 열려 안 함)'
      : (b.code !== null ? 'HTTP ' + b.code + ' · ' + b.자수 + '자 · ' + b.ms + 'ms'
        : '못 엶 · ' + b.왜 + ' · ' + b.ms + 'ms'),
    머리글로_풀렸나: !!(b && b.code === 200),
    오류_원문: 최종.왜 || '',
    응답_원문_앞1200자: (글 || '(빈 본문)').slice(0, 1200),
  };
}

export async function GET() {
  const 리전 = process.env.VERCEL_REGION || '(모름)';
  const t0 = Date.now();
  /* 한꺼번에 다 던지면 상대 서버에도 우리 함수에도 무리입니다. 12곳씩 나눕니다 */
  const 결과: Awaited<ReturnType<typeof 한곳>>[] = [];
  for (let i = 0; i < 볼곳.length; i += 12) {
    결과.push(...await Promise.all(볼곳.slice(i, i + 12).map(한곳)));
  }
  const 열림 = 결과.filter((r) => r.성공);
  const 막힘 = 결과.filter((r) => !r.성공);
  return NextResponse.json({
    잰때: new Date().toISOString(),
    '이_함수가_돈_리전': 리전,
    '서울인가': 리전 === 'icn1',
    본_곳: 볼곳.length,
    열린_곳: 열림.length,
    '아직_막힌_곳': 막힘.length,
    걸린초: Math.round((Date.now() - t0) / 100) / 10,
    한줄: 리전 !== 'icn1'
      ? '⚠ 서울(icn1)이 아니라 ' + 리전 + ' 에서 돌았습니다 — 이 결과로는 판단할 수 없습니다'
      : 막힘.length === 0 ? '서울에서는 ' + 볼곳.length + '곳 다 열립니다'
        : 막힘.length + '곳이 아직 막힙니다 — AWS 대역을 막는 곳일 수 있습니다',
    '아직_막힌_곳_목록': 막힘.map((r) => ({
      이름: r.이름, 막힌까닭: r.막힌까닭, 상태코드: r.상태코드,
      오류: r.오류_원문, 주소: r.주소,
      본문앞200: r.응답_원문_앞1200자.slice(0, 200),
    })),
    결과,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
