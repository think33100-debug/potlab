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
  if (s.type === 'appsite' || s.type === 'listjson') {
    const r = await 보내기(s.host + '/app/jobnotice/list.json', {
      body: new URLSearchParams({ currentPage: '1', pageSize: '100', keyword: '', recruitClassName: '' }).toString(),
    });
    const j = 제이슨(r);
    if (!j) return { err: 'HTTP ' + r.code + ' JSON 아님 · ' + (r.왜 || String(r.text).slice(0, 80)) };
    const 다 = j.list || [];
    if (!다.length) return { err: 'list.json 이 0건 · pageUtil ' + JSON.stringify(j.pageUtil || {}).slice(0, 90) };
    let 접수중 = 다.filter((x) => /접수중/.test(String(x.receiptState || '')));

    /* 공용 사이트 가르기 — 한 host 에 여러 병원이 같이 옵니다.
       clsTitle 은 제목 **또는** recruitClassName 으로 가릅니다.
       ⚠ 사이트에 오타가 있습니다 — 빛고을이 recruitClassName 에서는 「빚고을」 입니다.
         그래서 규칙에 둘 다 적혀 있고 제목도 같이 봅니다. */
    if (s.clsTitle) {
      const re = new RegExp(s.clsTitle);
      const 앞 = 접수중.length;
      접수중 = 접수중.filter((x) => re.test(String(x.recruitClassName || '') + ' ' + String(x.jobnoticeName || '')));
      if (!접수중.length && 앞) {
        return { rows: [], raw: '접수중 ' + 앞 + '건인데 clsTitle(' + s.clsTitle + ') 에 걸린 것이 0건' };
      }
    }
    if (s.cls) {
      const re = new RegExp(s.cls);
      const 앞 = 접수중.length;
      접수중 = 접수중.filter((x) => re.test(String(x.recruitClassName || '')));
      if (!접수중.length && 앞) {
        const 본값 = [...new Set(다.map((x) => x.recruitClassName).filter(Boolean))].slice(0, 8).join(' · ');
        return { rows: [], raw: '접수중 ' + 앞 + '건인데 cls(' + s.cls + ') 에 걸린 것이 0건 — 나온 값: ' + 본값 };
      }
    }
    return {
      rows: 마이다스줄(접수중, s.host),
      raw: '전체 ' + ((j.pageUtil || {}).recordCount || 다.length) + '건 중 접수중 ' + 접수중.length + '건'
        + (s.cls ? ' (cls ' + s.cls + ')' : ''),
    };
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
          url: s.base + '/page/board/recruit/' + x.articleNo,
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
