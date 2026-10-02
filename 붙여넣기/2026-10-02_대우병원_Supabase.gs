/* ───────────────────────────────────────────────────────────────
 * 붙여 넣는 법 (2026-10-02)
 *
 * 1. 앱스 스크립트 편집기를 엽니다
 * 2. Wage.gs 의 **맨 끝**에 아래를 그대로 붙입니다 (기존 코드는 안 건드립니다)
 * 3. 프로젝트 설정 → 스크립트 속성에 세 칸을 넣습니다
 *      SB_URL           https://○○○.supabase.co
 *      SB_ANON          공개 열쇠 (브라우저에 나가도 되는 것)
 *      COLLECT_KEY_HS3  43자 공용 열쇠
 * 4. 실행 목록에서 collectDaewooToSupabase 를 한 번 눌러 봅니다
 *    → 「대우병원 — 읽은 줄 N · 담음 N/N · 쓰레기통 N/N」 이 나오면 됩니다
 * 5. 잘 되면 트리거를 겁니다 — 시간 기반 · 1~2시간마다
 * 6. 그다음에 hospTick 을 끕니다
 *
 * ※ 새 버전 배포는 필요 없습니다 — 트리거로 도는 함수입니다.
 *   (웹앱 doGet 을 고친 게 아니라서 배포와 무관합니다)
 * ─────────────────────────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════════
 *  대우병원 한 곳만 — 시트를 거치지 않고 Supabase 에 바로 넣습니다
 *  2026-10-02. 토요일에 collectTick·hospTick·다리를 다 끄기 위해 만들었습니다.
 * ═══════════════════════════════════════════════════════════════
 *
 *  왜 이것만 따로인가
 *    대우병원(거제)은 **Lightsail 에서 막힙니다** —
 *      HTTP 200 · 43바이트 · 본문 「접근 불가합니다.」
 *    구글 IP 에서는 읽힙니다. 그래서 이 한 곳만 앱스 스크립트에 남깁니다.
 *    동아병원·광혜병원·제주 한마음병원은 **구글 IP 에서도 막혀** 남길 값이 없습니다
 *    (동아병원은 「This service is currently limited to users in Korea.」).
 *
 *  왜 시트를 안 거치나
 *    collectHosp() 는 initJobSheet() 에 적습니다. 그러면 다리(sync.yml)를
 *    끌 수 없습니다. 이 함수는 collect_put() 으로 **Supabase 에 바로** 넣습니다.
 *
 *  열쇠
 *    스크립트 속성에 두 칸을 넣어야 돕니다. **코드에 박지 않습니다.**
 *      SB_URL            https://○○○.supabase.co
 *      SB_ANON           공개 열쇠 (브라우저에 나가도 되는 것)
 *      COLLECT_KEY_HS3   43자 공용 열쇠
 *    넣는 곳 — 스크립트 편집기 → 프로젝트 설정 → 스크립트 속성
 *
 *  **기존 코드는 한 줄도 안 건드렸습니다.** 쓰는 것은 읽기만 하는 조각뿐입니다 —
 *    HOSP_SITES · hospSiteRows_ · hospVerdict_ · hashStr_ · mixedTitle_ · hospIndex_ · norm_
 *
 *  공고ID 규칙은 collectHosp 과 **똑같습니다** —
 *    'HS' + Math.abs(hashStr_(기관 + '|' + 주소 + '|' + 제목))
 *  그래야 옛 줄과 겹치고, 두 번 담기지 않습니다.
 * ═══════════════════════════════════════════════════════════════ */

/* 세중님이 트리거로 거는 함수입니다 — 인자 없이 돕니다 (CLAUDE.md 8번) */
function collectDaewooToSupabase() {
  return hospOneToSupabase_('의료법인 대우의료재단대우병원');
}

function hospOneToSupabase_(이름) {
  const p = PropertiesService.getScriptProperties();
  const SB = String(p.getProperty('SB_URL') || '').replace(/\/+$/, '');
  const ANON = String(p.getProperty('SB_ANON') || '');
  const KEY = String(p.getProperty('COLLECT_KEY_HS3') || '');
  const 없는것 = [];
  if (!SB) 없는것.push('SB_URL');
  if (!ANON) 없는것.push('SB_ANON');
  if (!KEY) 없는것.push('COLLECT_KEY_HS3');
  if (없는것.length) {
    const m = '스크립트 속성에 ' + 없는것.join(' · ') + ' 이 없습니다'
      + ' (프로젝트 설정 → 스크립트 속성)';
    Logger.log(m); return m;
  }

  const 걸린것 = HOSP_SITES.filter(function (x) { return x.name.indexOf(이름) > -1; });
  if (!걸린것.length) { const m = 'HOSP_SITES 에서 못 찾음: ' + 이름; Logger.log(m); return m; }
  if (걸린것.length > 1) {
    const m = 걸린것.length + '곳이 걸립니다 — ' + 걸린것.map(function (x) { return x.name; }).join(' · ');
    Logger.log(m); return m;
  }
  const s = 걸린것[0];

  const got = hospSiteRows_(s);
  if (got.err) {
    const m = s.name + ' 못 받음 · ' + got.err;
    Logger.log(m); return m;
  }
  let rows = got.rows || [];
  if (s.only) rows = rows.filter(function (r) { return new RegExp(s.only).test(r.title); });
  if (s.not) rows = rows.filter(function (r) { return !new RegExp(s.not).test(r.title); });

  const today = Utilities.formatDate(new Date(), WTZ, 'yyyy.MM.dd');
  const I = hospIndex_();
  const h = (I.byNorm[norm_(s.name)] || [])[0];
  const 넣을것 = [], 버릴것 = [], 쪽지 = [];
  /* NL 은 다른 함수 안의 지역 변수라 여기서 못 씁니다 — 따로 둡니다 (2026-10-02) */
  const 줄바꿈 = String.fromCharCode(10);

  rows.forEach(function (r) {
    if (!r.title || !r.url) return;
    if (r.to && r.to < today) return;                       // 마감 지난 것
    const v = hospVerdict_(r.title, s.name);
    const id = 'HS' + Math.abs(hashStr_(s.name + '|' + r.url + '|' + r.title));
    /* 「버림」 은 쓰레기통으로 — 지우지 않고 까닭을 남깁니다 */
    if (v.indexOf('버림') === 0) {
      버릴것.push({ id: id, org_name: s.name, title: r.title, url: r.url,
        why: '병원 게시판 제목 판정 · ' + v });
      return;
    }
    const 쌓기 = v.indexOf('쌓음') === 0;                    // 임상병리사·방사선사 — 담되 감춤
    const 담음 = v.indexOf('담음') === 0;
    넣을것.push({
      id: id,
      org_name: s.name,
      title: r.title,
      sido: h ? h.sido : '',
      sgg: h ? h.sgg : '',
      apply_from: r.from || r.posted || '',
      apply_to: r.to || '',
      posted_at: r.posted || r.from || '',
      url: r.url,
      job_group: 담음 ? v.slice(3, -1) : '',
      form: mixedTitle_(r.title) ? '포함' : '',
      org_kind: h ? h.kind : '공공',
      hidden: 쌓기 ? 'true' : 'false',
      /* 제목만으로 못 가린 것은 보류함으로. 여기서는 상세를 열지 않습니다 —
         한 곳만 보는 작은 트리거라 짧게 끝나야 합니다. 관리자가 봅니다 */
      hold: (!담음 && !쌓기) ? 'true' : 'false',
      detail: { 근거: '병원 게시판 제목 · ' + v, 기관홈: s.base || s.host || '' },
      evidence: (!담음 && !쌓기)
        ? { 보류사유: '제목만으로 직군을 못 가렸습니다 · ' + v + ' (대우병원 전용 트리거 — 상세를 안 엽니다)' }
        : (쌓기 ? { 감춘까닭: v } : {}),
    });
  });

  const 보내기 = function (fn, 줄들) {
    if (!줄들.length) return { ok: 0, why: '' };
    const res = UrlFetchApp.fetch(SB + '/rest/v1/rpc/' + fn, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON },
      payload: JSON.stringify({ p_secret: KEY, p_source: 'HS', p_rows: 줄들 }),
    });
    const code = res.getResponseCode(), 글 = res.getContentText();
    if (code !== 200) return { ok: 0, why: 'HTTP ' + code + ' · ' + 글.slice(0, 300) };
    let j = null; try { j = JSON.parse(글); } catch (e) {}
    return { ok: (j && j['담음']) || 0, why: '' };
  };

  /* 출처는 **HS** 입니다 — 옛 수집기와 같은 자리입니다. 그래야 collect_put 이
     이미 있는 옛 줄을 고칠 수 있고, 토요일 주인 넘기기와도 어긋나지 않습니다 */
  const a = 보내기('collect_put', 넣을것);
  const b = 보내기('collect_trash', 버릴것);
  쪽지.push(s.name + ' — 읽은 줄 ' + rows.length
    + ' · 담음 ' + a.ok + '/' + 넣을것.length
    + ' · 쓰레기통 ' + b.ok + '/' + 버릴것.length);
  if (a.why) 쪽지.push('★ collect_put 실패 · ' + a.why);
  if (b.why) 쪽지.push('★ collect_trash 실패 · ' + b.why);
  const m = 쪽지.join(줄바꿈);
  Logger.log(m);
  return m;
}
