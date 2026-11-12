import Link from 'next/link';
import { InquiryForm } from '@/components/inquiry-form';
import { HELP_EMAIL } from '@/lib/contact';
import { 문의폼_켰나 } from '@/lib/inquiry';

/* 문의하기 (2026-10-01 · 새 디자인 2026-11-13 세중님 「문의하기 누르면 옛날 화면이 나와 · 피그마 확인」).

   피그마 원본 — 「15 · 기본 화면 템플릿」 T05 / Mobile / 짧은 문의 안내 605:10494
   (본문 「짧은 문의 안내」 605:9256 · 문서 아이콘 32 · 화면 제목 26/35 · 본문 16/24 · 메일 t6 Bold brand-contrast ·
   채움 버튼 Navy 40 · 도움말 t4 muted). 원본의 위쪽 줄(로고·로그인)과 아래 줄(약관 링크)은 공통 틀이라
   여기서는 내 정보 아래 화면들과 같은 「뒤로」 줄과 layout 의 꼬리말을 씁니다.

   원본에 없는데 남긴 것 둘 —
   ① 앱 안 문의 폼(components/inquiry-form.tsx) — 처리방침의 국외 이전 「거부 방법」이 이 폼을 가리킵니다
   ② 권익 침해 구제 기관 — 저장소에서 이 화면에만 적혀 있습니다. 빼면 회원이 볼 자리가 없어집니다
   만든 곳·보호책임자는 꼬리말(app/layout.tsx)에 이미 있어 뺐습니다. 주소는 lib/contact.ts 한 곳입니다. */

export const metadata = { title: '문의하기' };

const 구제기관 = [
  '개인정보 침해신고센터 — privacy.kisa.or.kr · 국번없이 118',
  '개인정보 분쟁조정위원회 — kopico.go.kr · 1833-6972',
  '대검찰청 사이버수사과 — spo.go.kr · 1301',
  '경찰청 사이버수사국 — ecrm.police.go.kr · 182',
];

export default function ContactPage() {
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      {/* 내 정보 아래 화면들과 같은 앱 바(라이트 · 56) — 제목은 본문의 화면 제목이 맡습니다(원본 T05) */}
      <header className="sticky top-0 z-20 flex h-[56px] items-center bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x2)">
        <Link href="/me" aria-label="뒤로"
          className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-(--rapo-color-bg-transparent-pressed)">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src="/rapo/detail/arrow-left-20.svg" alt="" width={20} height={20} />
        </Link>
      </header>

      <main className="flex flex-col gap-(--rapo-dimension-x8) p-(--rapo-dimension-x5)">
        {/* 짧은 문의 안내 605:9256 */}
        <section className="flex flex-col gap-(--rapo-dimension-x6)">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 「RAPO / Icon / 문서」 원본 SVG 그대로 */}
          <img src="/rapo/contact/doc-32.svg" alt="" width={32} height={32} />
          <h1 className="rapo-type-screen-title text-(color:--rapo-color-fg-neutral)">문의하기</h1>
          <p className="rapo-type-article-body break-keep text-(color:--rapo-color-fg-neutral)">
            서비스 이용 중 궁금한 점이나 불편한 점을 이메일로 보내주세요.
          </p>
          <p className="rapo-type-t6-bold break-all text-(color:--rapo-color-fg-brand-contrast)">{HELP_EMAIL}</p>
          <a href={`mailto:${HELP_EMAIL}`}
            className="rapo-type-t4-bold flex h-(--rapo-dimension-x10) w-[188px] max-w-full items-center justify-center rounded-(--rapo-radius-r2)
                       bg-(--rapo-color-bg-navy-solid) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-on-navy-solid) active:bg-(--rapo-color-bg-navy-solid-pressed)">
            이메일로 문의하기
          </a>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            문의 내용을 확인할 수 있는 화면이나 정보를 함께 알려주세요.
          </p>
        </section>

        <div aria-hidden className="h-px bg-(--rapo-color-stroke-neutral-muted)" />

        {/* 앱 안에서 보내기 — 원본에 없음(머리 주석 ①). 끄는 스위치는 lib/inquiry.ts 그대로 */}
        {문의폼_켰나 && (<>
        <section aria-labelledby="문의-앱안" className="flex flex-col gap-(--rapo-dimension-x4)">
          <div className="flex flex-col gap-(--rapo-dimension-x1)">
            <h2 id="문의-앱안" className="rapo-type-t7-bold text-(color:--rapo-color-fg-neutral)">앱 안에서 보내기</h2>
            <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
              여기로 보내시면 글이 대한민국 서울에만 저장돼요 (메일로 나가지 않아요)
            </p>
          </div>
          <InquiryForm />
        </section>
        </>)}

        <div aria-hidden className="h-px bg-(--rapo-color-stroke-neutral-muted)" />

        {/* 권익 침해 구제 — 원본에 없음(머리 주석 ②) */}
        <section aria-labelledby="문의-구제" className="flex flex-col gap-(--rapo-dimension-x2)">
          <h2 id="문의-구제" className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">여기 말고 도움을 청할 수 있는 곳</h2>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            저희 답이 만족스럽지 않으시면 아래에 도움을 청하실 수 있어요.{' '}
            <Link href="/terms/privacy" className="underline underline-offset-2">개인정보처리방침</Link>
          </p>
          <ul className="flex flex-col gap-(--rapo-dimension-x1)">
            {구제기관.map((x) => (
              <li key={x} className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">· {x}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
