/* 순찰이 같은 공고를 다시 열지 않게, 한 번 내린 판정을 기억합니다 (2026-10-01).
 *
 * 왜 필요한가 —
 *   「우리 직군이 아니라 안 담은」 공고는 job_posts 에 없습니다. 그래서
 *   있는번호() 로 걸러도 순찰마다 되살아나 상세를 다시 열고, 첨부가 있으면
 *   OCR 까지 다시 돕니다.
 *     알리오   받은 100건 중 13건이 그랬고, 그중 9건이 상세를 다시 열었습니다
 *     클린아이  매번 88건 상세 · 30건 OCR 을 통째로 다시 돌려 971초 걸렸습니다
 *
 * 무엇을 남기는가 —
 *   수집판정 표에 **번호·출처·판정·판정때·지문**뿐입니다. 공고 본문은 안 담습니다.
 *
 * 다시 보는 조건 —
 *   목록 줄의 지문이 달라졌을 때, 또는 전체 한 바퀴(순찰 아닌 돌기) 때.
 *   원 출처가 수정일을 주면 그걸 쓰는 게 맞지만, 알리오·클린아이 목록에는
 *   수정일 칸이 없습니다 (알리오는 pbancBgngYmd·pbancEndYmd 둘뿐이고
 *   decimalDay 는 D-day 라 날마다 바뀝니다). 그래서 목록 줄 전체를 지문으로
 *   견줍니다 — 제목·마감일·자격 어느 하나라도 바뀌면 다시 봅니다.
 *
 * 창구가 막히면(열쇠·통신) **거르지 않고 그대로 갑니다.**
 * 거르다 실패했다고 공고를 놓치면 안 됩니다.
 */
import { createHash } from 'node:crypto';

/** 목록 줄의 지문. 날마다 바뀌는 칸과 우리가 붙인 칸(__)은 뺍니다 */
export function 지문(o, 뺄칸 = []) {
  const 빼기 = new Set(['decimalDay', 'ongoingYn', ...뺄칸]);
  return createHash('sha1').update(JSON.stringify(
    Object.fromEntries(Object.entries(o)
      .filter(([k]) => !k.startsWith('__') && !빼기.has(k)))
  )).digest('hex').slice(0, 32);
}

async function rpc(cfg, 이름, body) {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(이름), {
    method: 'POST',
    headers: {
      apikey: cfg.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const 글 = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' · 응답 원문 — ' + 글.slice(0, 400));
  return 글 ? JSON.parse(글) : null;
}

/**
 * 전에 판정한 줄을 빼고 돌려줍니다. 실패하면 받은 것을 그대로 돌려줍니다.
 * @param 번호뽑기 (줄) => '305658' 같은 원 출처 번호
 */
export async function 판정한것빼기(cfg, { 열쇠, source, 줄들, 번호뽑기, 뺄칸 = [] }) {
  if (!줄들.length) return 줄들;
  try {
    if (!열쇠) throw new Error('COLLECT_KEY 가 없습니다');
    const 안것 = new Map();
    for (let i = 0; i < 줄들.length; i += 500) {
      const 묶음 = 줄들.slice(i, i + 500).map((o) => String(번호뽑기(o) || '')).filter(Boolean);
      if (!묶음.length) continue;
      const j = await rpc(cfg, '판정물어보기', { p_secret: 열쇠, p_source: source, p_ids: 묶음 });
      for (const x of (j || [])) 안것.set(String(x.번호), String(x.지문));
    }
    const 남을것 = 줄들.filter((o) => {
      const 기억 = 안것.get(String(번호뽑기(o) || ''));
      return !(기억 && 기억 === 지문(o, 뺄칸));
    });
    console.log('순찰        전에 판정한 것 ' + (줄들.length - 남을것.length)
      + '건을 빼고 ' + 남을것.length + '건만 봅니다');
    return 남을것;
  } catch (e) {
    console.error('순찰        ★ 전에 내린 판정을 못 물어봤습니다 — 거르지 않고 그대로 갑니다');
    console.error('            ' + String(e.message).slice(0, 400));
    return 줄들;
  }
}

/**
 * 이번에 내린 판정을 남깁니다 — **버린 것까지.**
 * 던져서 판정이 안 난 줄은 안 남깁니다. 다음에 다시 봐야 하니까요.
 * @param 줄들 [{ 번호, 판정, 지문 }]
 */
export async function 판정남기기(cfg, { 열쇠, source, 줄들 }) {
  if (!열쇠 || !줄들.length) return 0;
  let 남긴수 = 0;
  try {
    for (let i = 0; i < 줄들.length; i += 500) {
      남긴수 += Number(await rpc(cfg, '판정남기기',
        { p_secret: 열쇠, p_source: source, p_rows: 줄들.slice(i, i + 500) })) || 0;
    }
    console.log('판정 기억   ' + 남긴수 + '건');
  } catch (e) {
    console.error('판정 기억   ★ 못 남겼습니다 — ' + String(e.message).slice(0, 300));
  }
  return 남긴수;
}
