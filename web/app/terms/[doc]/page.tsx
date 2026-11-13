import { notFound } from 'next/navigation';
import { RapoBackButton } from '@/components/rapo/rapo-back';
import { TERMS, TERMS_VERSION, 초안띠보이나, type TermKey } from '@/lib/terms';

export function generateStaticParams() {
  return Object.keys(TERMS).map((doc) => ({ doc }));
}

/* ★ 2026-11-02 — 「초안입니다」 띠가 **시행일 00:00(KST)에 저절로 사라지게** 하려면
   이 쪽이 그 시각 뒤에 한 번은 다시 그려져야 합니다. 그대로 두면 **빌드 때 값이
   굳어** 11/10 이 지나도 띠가 남습니다 (배포를 다시 할 때까지).
   그래서 30분마다 다시 그리게 합니다 — 늦어도 00:30 에는 사라집니다.
   쪽은 글만 있는 정적 쪽이라 30분 간격이 부담이 되지 않습니다 */
export const revalidate = 1800;

/* ★ 2026-11-13 세중님 「개인정보 처리방침 · 이용약관도 옛날 느낌」 — 새 틀(lib/nav.ts 새틀화면)로 옮겼습니다.
   문의하기(app/contact)와 같은 「뒤로」 줄 · 화면 제목 26/35 · 본문 16/24.

   글(lib/terms.ts)은 **한 글자도 바꾸지 않습니다.** 줄 나눔만 다시 합니다 —
   원문은 40자쯤에서 손으로 줄을 바꿔 둔 글이라, 폰 폭에서는 줄 가운데가 또 끊겨 보였습니다.
     · 빈 줄            문단을 가릅니다
     · 글머리로 시작      (· - ※ ★ 1. ① ㉠ 가.) 새 항목
     · 들여 쓴 이음 줄    앞 항목·문단에 이어 붙입니다 (손으로 바꾼 줄)
     · 쉼표로 끝난 줄 뒤   같은 문장이라 이어 붙입니다
     · 짧은 홑줄(끝 부호 없음) 뒤에 빈 줄이나 글머리가 오면 작은 제목 */
type 조각 = { 꼴: '제목' | '항목' | '문단'; 머리?: string; 글: string; 들임: number };
const 글머리 = /^(·|•|-|–|※|★|\d{1,2}[.)]|[①-⑳]|[㉠-㉯]|[가-하]\.)\s+/;

function 조각내기(body: string): 조각[] {
  const 줄들 = body.split('\n');
  const out: 조각[] = [];
  let 앞빈줄 = true;
  줄들.forEach((원, i) => {
    const 글 = 원.trim();
    if (!글) { 앞빈줄 = true; return; }
    const 들임 = 원.length - 원.trimStart().length;
    const m = 글머리.exec(글);
    const 앞 = out[out.length - 1];
    if (m) {
      out.push({ 꼴: '항목', 머리: m[1], 글: 글.slice(m[0].length), 들임 });
    } else if (앞 && !앞빈줄 && 앞.꼴 !== '제목' && (들임 >= 2 || /[,，]$/.test(앞.글))) {
      앞.글 += ' ' + 글;                       /* 손으로 바꾼 줄 — 앞 줄에 잇습니다 */
    } else {
      const 다음 = 줄들.slice(i + 1).find((l) => l.trim()) ?? '';
      const 제목인가 = 들임 === 0 && 글.length <= 24 && !/[.,:;」”"]$/.test(글)
        && (!줄들[i + 1]?.trim() || 글머리.test(다음.trim()));
      out.push({ 꼴: 제목인가 ? '제목' : '문단', 글, 들임 });
    }
    앞빈줄 = false;
  });
  return out;
}

export default async function TermsPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const t = TERMS[doc as TermKey];
  if (!t) notFound();
  const 조각들 = 조각내기(t.body);

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <header className="sticky top-0 z-20 flex h-[56px] items-center bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x2)">
        <RapoBackButton fallback="/me" />
      </header>

      <main className="flex flex-col gap-(--rapo-dimension-x6) p-(--rapo-dimension-x5) pb-(--rapo-dimension-x10)">
        <div className="flex flex-col gap-(--rapo-dimension-x2)">
          <h1 className="rapo-type-screen-title break-keep text-(color:--rapo-color-fg-neutral)">{t.title}</h1>
          <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">{TERMS_VERSION} 판</p>
        </div>

        {t.draft && 초안띠보이나() && (
          <p className="rapo-type-t4-medium break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x4)
                        text-(color:--rapo-color-fg-brand-contrast)">
            초안입니다. 법률 검토를 받기 전이라 문구가 바뀔 수 있습니다
          </p>
        )}

        <div className="flex flex-col gap-(--rapo-dimension-x3) text-(color:--rapo-color-fg-neutral)">
          {조각들.map((c, i) => c.꼴 === '제목' ? (
            <h2 key={i} className={'rapo-type-t6-bold break-keep ' + (i > 0 ? 'mt-(--rapo-dimension-x4)' : '')}>{c.글}</h2>
          ) : c.꼴 === '항목' ? (
            <div key={i} className="rapo-type-article-body flex gap-(--rapo-dimension-x2)" style={{ paddingLeft: Math.min(c.들임, 6) * 4 }}>
              <span className="shrink-0 text-(color:--rapo-color-fg-neutral-muted)">{c.머리}</span>
              <p className="min-w-0 flex-1 break-keep [overflow-wrap:anywhere]">{c.글}</p>
            </div>
          ) : (
            <p key={i} className="rapo-type-article-body break-keep [overflow-wrap:anywhere]" style={{ paddingLeft: Math.min(c.들임, 6) * 4 }}>{c.글}</p>
          ))}
        </div>
      </main>
    </div>
  );
}
