/* 병원 채용 사이트 한 곳 → 공고 줄 목록 (2026-09-28).
 *
 * gas 의 `hospSiteRows_` 를 node 로 옮긴 것입니다. 갈래 다섯 가지를 다 다룹니다 —
 *
 *   html      261줄   목록 HTML 을 정규식으로 (hs_test.js 의 hospParseHtml 그대로)
 *   appsite    12줄   마이다스 구형 · POST /app/jobnotice/list.json
 *   listjson    1줄   같은 것 (gas 에서 이미 하나로 합쳤습니다)
 *   cmc         6줄   가톨릭중앙의료원 · JSON 배열
 *   schmc       4줄   순천향 · POST getJobAllListFromFrontNew
 *   greeting    4줄   그리팅 · __NEXT_DATA__ 안의 ["openings"]
 *
 * ── 왜 옮기나 ────────────────────────────────────────────────
 * 세중님이 「특수 채용사이트 15곳도 같이 옮겨」 라고 정하셨습니다 (2026-09-28).
 * 이걸 안 옮기면 사흘 대조에서 15줄이 계속 「gas 에만 있는 것」 으로 남아
 * 통과 기준(gas 에만 있는 것 0)을 못 넘습니다.
 *
 * ── 받는 것은 한 벌입니다 ─────────────────────────────────────
 * 모두 `tools/certs/index.mjs` 의 `글받기`·`붙여받기` 로 받습니다 —
 * 중간 인증서 붙이기 · 옛 암호 허용 · 인코딩 읽기가 거기 한 벌로 있습니다.
 * **인증서 검증은 끄지 않습니다.**
 */
import { createRequire } from 'node:module';
import { 글받기, 붙여받기 } from '../certs/index.mjs';

const require = createRequire(import.meta.url);
const { hospParseHtml, UA } = require('./hs_test.js');

const 기본머리 = { 'User-Agent': UA, 'Accept-Language': 'ko' };

/* gas 의 hsYmd_ 와 같습니다 */
export function 날짜(s) {
  const m = String(s || '').match(/(20\d{2})[.\-/]\s?(\d{1,2})[.\-/]\s?(\d{1,2})/);
  return m ? m[1] + '.' + ('0' + m[2]).slice(-2) + '.' + ('0' + m[3]).slice(-2) : '';
}
/* gas 의 hsMs_ 와 같습니다 — 마이다스는 날짜를 { time: 밀리초 } 로 줍니다 */
export function 밀리초날짜(v) {
  if (!v) return '';
  const n = (typeof v === 'object' && v && v.time) ? Number(v.time) : Number(v);
  if (!isFinite(n) || n < 1e11) return 날짜(String(v));
  /* 한국 시각으로 바꿔서 봅니다 — UTC 로 보면 하루가 밀립니다 */
  return 날짜(new Date(n).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }));
}

/** 공용 채용관 가르기 — 한 host 에 여러 병원이 같이 옵니다 ─────────
 *
 * ★ 2026-10-14 — **한 함수로 모았습니다.** 전에는 appsite 갈래 안에만
 *   있었고, 차병원 갈래를 더하면서 같은 코드가 두 벌이 될 뻔했습니다
 *   (지침 6절 — 기준은 한 자리).
 *
 * 받는 것은 **이미 정규화된 줄**입니다 — `{ title, cls, ... }`.
 *   clsTitle  제목 **또는** cls 로 가릅니다
 *             ⚠ 사이트 오타가 있습니다 — 빛고을이 recruitClassName 에서는
 *               「빚고을」 입니다. 그래서 규칙에 둘 다 적혀 있고 제목도 봅니다
 *   cls       cls 로만 가릅니다
 *   only/not  제목에 그 말이 있나 / 없나
 *
 * 걸린 것이 0건이 되면 **빈 줄과 함께 까닭을 돌려줍니다** — 조용히 0건을
 * 내면 「공고가 없다」 로 읽혀서 설정이 썩은 것을 못 알아챕니다.
 */
function 거르기(s, 줄, raw, 본cls값 = []) {
  let 것 = 줄;
  for (const [칸, 집기] of [
    ['clsTitle', (x, re) => re.test(String(x.cls || '') + ' ' + String(x.title || ''))],
    ['cls', (x, re) => re.test(String(x.cls || ''))],
    ['only', (x, re) => re.test(String(x.title || ''))],
    ['not', (x, re) => !re.test(String(x.title || ''))],
  ]) {
    if (!s[칸]) continue;
    const re = new RegExp(s[칸]);
    const 앞 = 것.length;
    것 = 것.filter((x) => 집기(x, re));
    if (!것.length && 앞) {
      const 값 = (본cls값.length ? 본cls값 : [...new Set(줄.map((x) => x.cls).filter(Boolean))])
        .slice(0, 8).join(' · ');
      return {
        rows: [],
        raw: '접수중 ' + 앞 + '건인데 ' + 칸 + '(' + s[칸] + ') 에 걸린 것이 0건'
          + (값 ? ' — 나온 값: ' + 값 : ''),
      };
    }
  }
  const 쓴칸 = ['clsTitle', 'cls', 'only', 'not'].filter((k) => s[k]);
  return {
    rows: 것,
    raw: raw + (쓴칸.length ? ' (' + 쓴칸.map((k) => k + ' ' + s[k]).join(' · ') + ')' : ''),
  };
}

/** POST 로 받습니다. 못 받으면 { code:0, 왜 } */
async function 보내기(url, { body, contentType, headers } = {}) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { ...기본머리, 'Content-Type': contentType || 'application/x-www-form-urlencoded', ...(headers || {}) },
      body,
    });
    return { code: r.status, text: await r.text() };
  } catch (e) {
    return { code: 0, text: '', 왜: String(e && (e.cause?.code || e.message)).slice(0, 80) };
  }
}
const 제이슨 = (r) => { if (!r || r.code !== 200) return null; try { return JSON.parse(r.text); } catch { return null; } };

/* 마이다스 목록 줄을 우리 꼴로 */
function 마이다스줄(list, host) {
  return (list || []).map((x) => ({
    title: String(x.jobnoticeName || '').trim(),
    from: 밀리초날짜(x.applyStartDate), to: 밀리초날짜(x.applyEndDate),
    cls: String(x.recruitClassName || ''),
    url: host + '/app/jobnotice/view?systemKindCode=' + (x.systemKindCode || 'MRS2') + '&jobnoticeSn=' + x.jobnoticeSn,
  }));
}

/**
 * 사이트 하나를 받아 공고 줄을 돌려줍니다.
 * 돌려주는 것 { rows: [{title,url,from,to,posted?,cls?}], raw } · 못 받으면 { err }
 * **던지지 않습니다** — 한 곳이 탈나도 나머지가 돌아야 합니다.
 */
export async function 사이트줄(s) {
  /* ── html — 261줄 ── */
  if (s.type === 'html') {
    const g = await 글받기(s.url, { headers: 기본머리, enc: s.enc });
    if (g.왜) return { err: '못 받음 · ' + g.왜 };
    if (g.code !== 200 || (g.html || '').length < 300) {
      return { err: 'HTTP ' + g.code + ' · ' + (g.html || '').length + '자' };
    }
    let rows;
    try { rows = hospParseHtml(g.html, s); }
    catch (e) { return { err: '규칙이 깨졌습니다 · ' + String(e.message).slice(0, 80) }; }
    return { rows, raw: g.바이트 + '바이트 · ' + (g.cs || '') };
  }

  /* ── 마이다스 구형 (appsite · listjson) — 13줄 ──
     ⚠ 쪽 넘김 칸은 **currentPage** 입니다. pageNo·pageIndex·page 는 1쪽을 다시 줍니다.
       확인법 — 2쪽 첫 글의 jobnoticeSn 이 1쪽과 다른가.
     매일 수집은 접수중인 것만 쓰면 되니 한 쪽(100건)으로 충분합니다.
     옛 공고를 쌓는 것은 백필 몫입니다. */
  /* ── json — **일반형** (2026-10-19 세중님 ④ 승인) ───────────────
   * 아래 `listjson` 은 마이다스 솔루션 **전용**입니다 — 주소와 파라미터가
   * 코드에 박혀 있어 다른 사이트에 못 씁니다. 이쪽은 설정에서 받습니다.
   *
   * 설정 칸
   *   url        두드릴 주소 (목록 쪽이 아니라 **데이터 주소**)
   *   방식       'POST'(기본) · 'GET'
   *   몸         POST 일 때 보낼 글 (application/x-www-form-urlencoded)
   *   머리       더할 헤더 (X-Requested-With · Referer 등)
   *   줄경로     응답에서 줄 배열까지 — 점으로 잇습니다 ('json.list')
   *   제목열쇠 · 날짜열쇠 · 시작열쇠 · 끝열쇠 · 갈래열쇠
   *   링크꼴     '…/view.php?seq={seq}' — `{열쇠}` 를 그 줄의 값으로 바꿉니다
   *   셈경로     전체 수가 든 자리 (로그에만 씁니다)
   *
   * ★ 열쇠 이름을 **짐작하지 않습니다.** 화성중앙은 그 쪽 ajax 성공 콜백에
   *   `item.seq` · `item.title` · `item.REG_DATE` 가 그대로 적혀 있어서
   *   그것을 읽어 넣었습니다 (docs/데이터주소_찾은것_1019.md · 지침 3절). */
  if (s.type === 'json') {
    const 길따라 = (o, 길) => String(길 || '').split('.').filter(Boolean)
      .reduce((v, k) => (v == null ? v : v[k]), o);
    const r = (s['방식'] || 'POST').toUpperCase() === 'GET'
      ? await 붙여받기(s.url, { headers: { ...(s['머리'] || {}) } })
        .then((g) => ({ code: g.왜 ? 0 : g.code, text: g.html || '', 왜: g.왜 }))
      : await 보내기(s.url, { body: s['몸'] || '', headers: { ...(s['머리'] || {}) } });
    const j = 제이슨(r);
    if (!j) return { err: 'HTTP ' + r.code + ' JSON 아님 · ' + (r.왜 || String(r.text).slice(0, 80)) };
    const 다 = 길따라(j, s['줄경로'] || 'list');
    if (!Array.isArray(다)) {
      return { err: '줄경로 「' + (s['줄경로'] || 'list') + '」 가 배열이 아닙니다 · 받은 것 '
        + JSON.stringify(j).slice(0, 120) };
    }
    const 셈 = s['셈경로'] ? 길따라(j, s['셈경로']) : 다.length;
    /* 0건은 **탈이 아닙니다** — 그 게시판에 글이 없을 수 있습니다.
       빈 목록을 그대로 돌려주어 「오늘 0건」으로 적히게 합니다 */
    const 줄들 = 다.map((x) => {
      const 꼴 = String(s['링크꼴'] || '');
      const url = 꼴
        ? 꼴.replace(/\{([^}]+)\}/g, (_, k) => encodeURIComponent(String(x[k] ?? '')))
        : String(x[s['링크열쇠'] || 'url'] || '');
      return {
        title: String(x[s['제목열쇠'] || 'title'] || '').trim(),
        url,
        from: s['시작열쇠'] ? String(x[s['시작열쇠']] || '') || null : null,
        to: s['끝열쇠'] ? String(x[s['끝열쇠']] || '') || null : null,
        posted: s['날짜열쇠'] ? String(x[s['날짜열쇠']] || '') || null : null,
        cls: s['갈래열쇠'] ? String(x[s['갈래열쇠']] || '') : '',
      };
    }).filter((x) => x.title && x.url);
    return 거르기(s, 줄들, '전체 ' + 셈 + '건 · 쓸 수 있는 줄 ' + 줄들.length + '건',
      [...new Set(줄들.map((x) => x.cls).filter(Boolean))]);
  }

  if (s.type === 'appsite' || s.type === 'listjson') {
    const r = await 보내기(s.host + '/app/jobnotice/list.json', {
      body: new URLSearchParams({ currentPage: '1', pageSize: '100', keyword: '', recruitClassName: '' }).toString(),
    });
    const j = 제이슨(r);
    if (!j) return { err: 'HTTP ' + r.code + ' JSON 아님 · ' + (r.왜 || String(r.text).slice(0, 80)) };
    const 다 = j.list || [];
    if (!다.length) return { err: 'list.json 이 0건 · pageUtil ' + JSON.stringify(j.pageUtil || {}).slice(0, 90) };
    const 접수중 = 다.filter((x) => /접수중/.test(String(x.receiptState || '')));
    return 거르기(s, 마이다스줄(접수중, s.host),
      '전체 ' + ((j.pageUtil || {}).recordCount || 다.length) + '건 중 접수중 ' + 접수중.length + '건',
      [...new Set(다.map((x) => x.recruitClassName).filter(Boolean))]);
  }

  /* ── 가톨릭중앙의료원 — 6줄 ── */
  if (s.type === 'cmc') {
    const g = await 붙여받기(s.url, { headers: 기본머리 });
    if (g.왜) return { err: '못 받음 · ' + g.왜 };
    let j;
    try { j = JSON.parse(g.buf.toString('utf8')); } catch { j = null; }
    if (!Array.isArray(j)) return { err: 'HTTP ' + g.code + ' 배열 아님 · ' + g.buf.toString('utf8').slice(0, 80) };
    return {
      rows: j.filter((x) => String(x.recruitStatus || '') !== '마감' && String(x.delYn || 'N') !== 'Y')
        .map((x) => ({
          title: String(x.title || '').trim(),
          from: 밀리초날짜(x.createdDt), to: 밀리초날짜(x.recruitClosedDt),
          /* ★ 2026-10-22 세중님 1번 ② — **경로 꼴이 깨집니다.**
             `/page/board/recruit/{articleNo}` 는 302 로 첫 화면으로 가고
             (여섯 곳 다) `/page/board/recruit` 는 200 으로 열립니다.
             물음표 꼴로 달면 **게시판이 열리고 공고 번호도 남습니다** —
             정찰이 그 번호로 목록과 대조합니다 (없어진공고찾기) */
          url: s.base + '/page/board/recruit?articleNo=' + x.articleNo,
          /* ★ 2026-10-22 — **본문을 목록이 같이 줍니다.** 상세 주소는 302 로
             첫 화면으로 되돌아가서(meta refresh /page/main) 열면 95자 껍데기만
             옵니다 — 받은 것을 그대로 씁니다 (collect-hosp 가 `글` 이 있으면
             쪽을 안 엽니다). 서울성모(상급종합)가 그 자리였습니다 */
          글: String(x.content || ''),
        })),
      raw: '배열 ' + j.length + '건',
    };
  }

  /* ── 순천향 — 4줄 ── */
  if (s.type === 'schmc') {
    const r = await 보내기(s.host + '/recruit/biz/job/getJobAllListFromFrontNew', {
      contentType: 'application/json;charset=UTF-8',
      headers: { Referer: s.host + '/?departmentidx=' + s.dept },
      body: JSON.stringify({
        departmentidx: Number(s.dept), currentpage: 0, recordnumberperpage: 20,
        careeridx: 0, searchword: '', totalcount: 0,
      }),
    });
    const j = 제이슨(r);
    if (!Array.isArray(j)) return { err: 'HTTP ' + r.code + ' 배열 아님 · ' + (r.왜 || String(r.text).slice(0, 80)) };
    return {
      rows: j.filter((x) => String(x.isclosed) !== '1').map((x) => ({
        title: String(x.jobtitle || '').trim(),
        from: 날짜(x.sdate), to: 날짜(x.edate),
        url: s.host + '/?departmentidx=' + s.dept,
      })),
      raw: '배열 ' + j.length + '건',
    };
  }

  /* ── 그리팅 — 4줄 ──
     안내 쪽 HTML 의 __NEXT_DATA__ 안에 queryKey ["openings"] 로 목록이 들어 있습니다.
     상세는 /ko/o/{openingId} · dueDate 는 UTC 라 한국 시각으로 바꿉니다 */
  /* ── 차병원 그룹 공동 채용관 (2026-10-14) ───────────────────
   *
   * `recruit.chamc.co.kr` 한 곳에 분당차·일산차·강남차·구미차·차움·
   * 차바이오텍 … 이 **다 섞여** 있고, `psitnNm` 이 **곧 병원 이름**입니다
   * (2026-10-14 에 두드려 보니 59건 중 분당차 19 · 일산차 4 · 강남차 1 ·
   *  구미차 1). 그래서 마이다스의 `recruitClassName` 과 **같은 자리**라
   * `cls` 로 가릅니다 — 거르기 코드는 아래 한 벌을 그대로 씁니다.
   *
   * 창구는 평범한 POST JSON 입니다. 브라우저 없이 `fetch` 로 됩니다
   * (HTTP 200 · 17,929자 · application/json · 지침 12절로 확인).
   *   POST /recruit/announcement/recruitAnnouncementListMain.ckd
   *   {"recrTpCd":"","userViewYn":"Yes","psitnCdIn":"","searchCondition":"all"}
   *
   * 날짜에 **시각이 붙어** 옵니다 — 「2026-10-18 23:50」. 마감 시각 칸의
   * 귀한 재료입니다 (지금 채움률 1.1%). 날짜만 떼어 from/to 에 담고,
   * 시각까지 든 원문은 `접수문장` 에 남깁니다.
   *
   * 상세 주소는 SPA 해시입니다 — 목록에서 글을 눌러 확인했습니다
   *   https://recruit.chamc.co.kr/page.ckd#/recruit/announcement/<recrId>
   */
  if (s.type === 'cha') {
    const r = await 보내기(s.host + '/recruit/announcement/recruitAnnouncementListMain.ckd', {
      body: JSON.stringify({ recrTpCd: '', userViewYn: 'Yes', psitnCdIn: '', searchCondition: 'all' }),
      contentType: 'application/json; charset=UTF-8',
      headers: { Accept: 'application/json, text/plain, */*', Referer: s.host + '/page.ckd' },
    });
    const j = 제이슨(r);
    if (!j) return { err: 'HTTP ' + r.code + ' JSON 아님 · ' + (r.왜 || String(r.text).slice(0, 80)) };
    const 다 = j.recruitAnnouncementListMain || [];
    if (!다.length) return { err: '목록이 0건 · result ' + j.result };
    const 접수중 = 다.filter((x) => String(x.closYn || '') !== 'Y');
    const 줄 = 접수중.map((x) => ({
      title: String(x.recrNm || '').trim(),
      from: 날짜(String(x.rcritStaDt || '')),
      to: 날짜(String(x.rcritEndDt || '')),
      cls: String(x.psitnNm || ''),
      접수문장: '접수기간 ' + (x.rcritStaDt || '') + ' ~ ' + (x.rcritEndDt || ''),
      url: s.host + '/page.ckd#/recruit/announcement/' + x.recrId,
    }));
    return 거르기(s, 줄, '전체 ' + 다.length + '건 중 접수중 ' + 접수중.length + '건');
  }

  if (s.type === 'greeting') {
    const g = await 글받기(s.url, { headers: 기본머리 });
    if (g.왜) return { err: '못 받음 · ' + g.왜 };
    if (g.code !== 200) return { err: 'HTTP ' + g.code };
    const m = g.html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return { err: '__NEXT_DATA__ 없음 · ' + g.html.length + '자' };
    let nd;
    try { nd = JSON.parse(m[1]); } catch { return { err: 'NEXT_DATA 가 JSON 이 아닙니다' }; }
    const qs = (((nd.props || {}).pageProps || {}).dehydratedState || {}).queries || [];
    const q = qs.find((x) => JSON.stringify(x.queryKey) === '["openings"]');
    if (!q) {
      return { err: 'openings 질의 없음 · 질의 ' + qs.map((x) => JSON.stringify(x.queryKey).slice(0, 40)).join(' | ') };
    }
    const list = (q.state && Array.isArray(q.state.data)) ? q.state.data : ((q.state && q.state.data && q.state.data.data) || []);
    const 한국날 = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      return isNaN(d.getTime()) ? '' : 날짜(d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }));
    };
    return {
      rows: list.filter((x) => x.deploy !== false).map((x) => ({
        title: String(x.title || '').trim(),
        from: 한국날(x.openDate), to: 한국날(x.dueDate),
        url: s.host + '/ko/o/' + x.openingId,
      })),
      raw: '목록 ' + list.length + '건',
    };
  }

  return { err: '모르는 type ' + s.type };
}
