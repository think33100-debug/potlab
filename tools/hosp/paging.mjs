/* 「이 쪽의 2쪽 주소는 무엇인가」 를 **쪽이 스스로 내놓은 링크에서** 알아냅니다 (2026-09-27).
 *
 * ── 왜 이렇게 하나 ───────────────────────────────────────────
 * 288곳마다 쪽 넘김 규칙을 손으로 적으면 288줄이고, 사이트가 바뀌면 다 틀립니다.
 * 대신 1쪽을 받아 **지금 주소와 숫자 한 칸만 다른 링크**를 찾습니다.
 * 영천이 그랬습니다 — `/bbs/List.do?bbsId=news5&pageNum=2` 가 쪽 안에 그대로 있었습니다.
 *
 * 못 알아내면 `null` 을 돌려줍니다. **짐작으로 `&page=2` 를 붙이지 않습니다** —
 * 엉뚱한 주소가 1쪽을 또 주면 「끝까지 봤다」 고 잘못 세게 됩니다.
 */

/** 쪽 넘김 방식을 알아냅니다 → { 칸, 주소만들기(n), 마지막 } 또는 null */
export function 쪽넘김찾기(html, 첫주소) {
  let 기준;
  try { 기준 = new URL(첫주소); } catch { return null; }

  /* 쪽 안의 모든 링크를 절대 주소로 */
  const 링크 = [];
  for (const m of String(html).matchAll(/href\s*=\s*["']([^"'#][^"']{0,300})["']/g)) {
    try { 링크.push(new URL(m[1].replace(/&amp;/g, '&'), 첫주소)); } catch { /* 주소가 아님 */ }
  }
  /* href 가 `#` 이고 onclick 으로 넘기는 곳이 많습니다 (인제대·을지 등).
     `goPage(2)` · `fn_paging('3')` 같은 것에서 숫자만 꺼내 씁니다 */
  const JS쪽 = new Set();
  for (const m of String(html).matchAll(/(?:go_?Page|goList|fn_?paging|fnPage|movePage|setPage|pageMove|fnSubmitForm|fn_?submit\w*)\s*\(\s*['"]?(\d{1,4})/gi)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 9999) JS쪽.add(n);
  }

  /* 같은 경로이면서 **숫자 한 칸만 다른** 것을 찾습니다 */
  const 셈 = new Map();
  for (const u of 링크) {
    if (u.origin !== 기준.origin || u.pathname !== 기준.pathname) continue;
    for (const [k, v] of u.searchParams) {
      if (!/^\d{1,4}$/.test(v)) continue;
      const 원래 = 기준.searchParams.get(k);
      /* 1쪽 주소에 그 칸이 없거나, 값이 다르면 쪽 번호 후보 */
      if (원래 !== null && 원래 === v) continue;
      /* **1쪽 주소에 있던 칸만** 견줍니다. 쪽 넘김 링크가 칸을 더 붙이는 곳이 많습니다 —
         노원을지가 `?str_page=2&search=&find=board_title&dept=&…` 처럼
         검색 칸을 줄줄이 붙입니다. 더 붙은 것까지 견주면 쪽 번호를 못 찾습니다 */
      let 같나 = true;
      for (const [k2, v2] of 기준.searchParams) {
        if (k2 === k) continue;
        if ((u.searchParams.get(k2) ?? '') !== v2) { 같나 = false; break; }
      }
      if (!같나) continue;
      const s = 셈.get(k) || new Set();
      s.add(Number(v)); 셈.set(k, s);
    }
  }

  /* ⚠ **이름을 먼저 봅니다** (2026-09-27).
     값이 여러 가지인 칸을 그냥 고르면 **글 번호**를 쪽 번호로 오인합니다 —
     센트럴병원의 `number=9762`, 운암한국병원의 `IDX=9590`, 굿모닝병원의 `wr_id` 가
     그랬습니다. 그 바람에 「받을 쪽 9,762쪽」 같은 헛숫자가 나왔습니다.
     쪽 번호는 이름이 거의 정해져 있습니다. 그 이름부터 찾고, 없으면 포기합니다. */
  const 쪽이름 = /^(page|pageno|pagenum|pageindex|currentpage|curpage|cpage|nowpage|str_page|p_page|movepage|pg|paging|startpage|pageidx)$/i;
  let 칸 = null, 값들 = null;
  for (const [k, s] of 셈) {
    if (s.size < 2) continue;                      // 2쪽 이상 보여야 쪽 번호
    if (!쪽이름.test(k)) continue;
    if (!값들 || s.size > 값들.size) { 칸 = k; 값들 = s; }
  }
  if (!칸) {
    /* 주소로는 못 알아냈지만 onclick 으로 넘기는 곳입니다.
       **이때는 주소를 만들 수 없습니다** — 어느 칸에 넣어야 할지 모릅니다.
       몇 쪽인지만 알려주고, 긁는 쪽이 「손으로 봐야 할 곳」 으로 셉니다 */
    if (JS쪽.size >= 2) return { 칸: null, 마지막: Math.max(...JS쪽), JS로넘김: true, 주소만들기: null };
    return null;
  }

  const 마지막 = Math.max(Math.max(...값들), JS쪽.size ? Math.max(...JS쪽) : 0);
  return {
    칸,
    마지막,
    주소만들기(n) {
      const u = new URL(첫주소);
      u.searchParams.set(칸, String(n));
      return u.toString();
    },
  };
}

/** **정말 쪽이 넘어가나** 를 2쪽을 받아 확인합니다 (2026-09-27).
 *
 * 이름으로 골라도 틀릴 수 있습니다. 2쪽이 1쪽과 똑같으면 쪽 번호가 아닙니다 —
 * 그걸 모르고 세면 「9,762쪽」 같은 헛숫자가 나옵니다.
 * @param 받기 (주소) => html
 * @param 뽑기 (html) => 줄 배열 (제목으로 견줍니다)
 */
export async function 넘어가나(넘김, 받기, 뽑기, 첫html) {
  if (!넘김 || !넘김.주소만들기) return { 넘어감: false, 왜: '쪽 주소를 만들 수 없습니다' };
  let h2;
  try { h2 = await 받기(넘김.주소만들기(2)); } catch (e) { return { 넘어감: false, 왜: '2쪽을 못 받음 · ' + (e.message || '') }; }
  if (h2 === 첫html) return { 넘어감: false, 왜: '2쪽이 1쪽과 똑같습니다 (쪽 번호가 아닙니다)' };
  const a = new Set((뽑기(첫html) || []).map((r) => r.title));
  const b = (뽑기(h2) || []).map((r) => r.title);
  if (!b.length) return { 넘어감: false, 왜: '2쪽에서 줄이 안 뽑힙니다' };
  const 새것 = b.filter((t) => !a.has(t)).length;
  if (!새것) return { 넘어감: false, 왜: '2쪽 줄이 1쪽과 같습니다' };
  return { 넘어감: true, 둘째쪽줄: b.length, 새것 };
}

/** 쪽에 적힌 전체 건수 — 「전체 357 건」 「전체 <strong>357</strong> 건」 「전체글 : 34건」 */
export function 적힌전체(html) {
  const t = String(html);
  /* 숫자와 「건」 사이에 닫는 꼬리표가 들어가는 곳이 많습니다 (전체 <strong>357</strong> 건) */
  const m = t.match(/(?:전체|총|Total)\s*(?:글\s*)?[:\s]*(?:<[^>]{1,40}>\s*)?([\d,]{1,7})\s*(?:<\/[^>]{1,20}>\s*)?(?:건|개|EA)/i);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}
