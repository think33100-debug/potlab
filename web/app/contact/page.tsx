import Link from 'next/link';
import { InquiryForm } from '@/components/inquiry-form';
import { RapoAppBar } from '@/components/rapo/rapo-me';
import { HELP_EMAIL, KAKAO_CHANNEL } from '@/lib/contact';
import { 문의폼_켰나 } from '@/lib/inquiry';
import { 색인메타 } from '@/lib/seo';

/* 문의하기 (2026-10-01 · 새 디자인 2026-11-13 세중님 「문의하기 누르면 옛날 화면이 나와 · 피그마 확인」).
   ★ 2026-11-15 세중님 「문의하기도 바꿔야할듯」 — 피그마 「12 · 내 정보」 이용 문의 1442:1538 꼴로 다시 짰습니다:
     앱 바 제목 「문의하기」 · 큰 제목 · 바로 아래 문의 폼 → 메일 안내는 아래 회색 칸 · 구제 기관은 접어 둠.
     (아래 옛 설명은 11/13 판입니다)

   피그마 원본 — 「15 · 기본 화면 템플릿」 T05 / Mobile / 짧은 문의 안내 605:10494
   (본문 「짧은 문의 안내」 605:9256 · 문서 아이콘 32 · 화면 제목 26/35 · 본문 16/24 · 메일 t6 Bold brand-contrast ·
   채움 버튼 Navy 40 · 도움말 t4 muted). 원본의 위쪽 줄(로고·로그인)과 아래 줄(약관 링크)은 공통 틀이라
   여기서는 내 정보 아래 화면들과 같은 「뒤로」 줄과 layout 의 꼬리말을 씁니다.

   원본에 없는데 남긴 것 둘 —
   ① 앱 안 문의 폼(components/inquiry-form.tsx) — 처리방침의 국외 이전 「거부 방법」이 이 폼을 가리킵니다
   ② 권익 침해 구제 기관 — 저장소에서 이 화면에만 적혀 있습니다. 빼면 회원이 볼 자리가 없어집니다
   만든 곳·보호책임자는 꼬리말(app/layout.tsx)에 이미 있어 뺐습니다. 주소는 lib/contact.ts 한 곳입니다. */

/* 검색엔진에 올리는 쪽입니다 (2026-11-13 세중님 「검색 가능하게」 · lib/seo.ts 색인길과 짝) */
export const metadata = { title: '문의하기', robots: 색인메타, alternates: { canonical: '/contact' } };

const 구제기관 = [
  '개인정보 침해신고센터 — privacy.kisa.or.kr · 국번없이 118',
  '개인정보 분쟁조정위원회 — kopico.go.kr · 1833-6972',
  '대검찰청 사이버수사과 — spo.go.kr · 1301',
  '경찰청 사이버수사국 — ecrm.police.go.kr · 182',
];

export default function ContactPage() {
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoAppBar title="문의하기" back="/me" />

      <main className="flex flex-col gap-(--rapo-dimension-x8) px-(--rapo-dimension-x5) pb-(--rapo-dimension-x8)">
        {/* 피그마 12 「이용 문의」 1442:1538 꼴 — 큰 제목 · 설명 · 문의 내용 · 보내기 */}
        <section className="flex flex-col gap-(--rapo-dimension-x6)">
          <div className="flex flex-col gap-(--rapo-dimension-x2) pt-(--rapo-dimension-x6)">
            <h1 className="rapo-type-t11-bold break-keep text-(color:--rapo-color-fg-neutral)">무엇을 도와드릴까요?</h1>
            <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
              궁금한 점이나 불편한 점을 알려 주세요. 평일에 확인하고 답을 드려요.
            </p>
          </div>
          {/* 2026-11-16 세중님 「문의하기는 카톡 채널로 오게」 — 카카오톡 채널을 맨 위 큰 단추로 (약관 26조 ③) */}
          <a href={KAKAO_CHANNEL} target="_blank" rel="noopener noreferrer"
            className="rapo-type-t5-bold flex h-[52px] w-full items-center justify-center rounded-(--rapo-radius-r3) bg-[#FEE500] text-[#191919] md:max-w-[360px]">
            카카오톡 채널로 문의하기
          </a>
          {/* 앱 안 문의 폼 — 개인정보·가림 요청처럼 기록이 필요한 요청용으로 남김(처리방침 3.2). 끄는 스위치는 lib/inquiry.ts 그대로 */}
          {문의폼_켰나 && (
            <details>
              <summary className="rapo-type-t4-bold cursor-pointer text-(color:--rapo-color-fg-neutral-muted)">앱 안에서 글로 남기기 (개인정보·게시물 가림 요청)</summary>
              <div className="mt-(--rapo-dimension-x3)"><InquiryForm /></div>
            </details>
          )}
        </section>

        {/* 메일로 — 비회원·가입 전에도 쓸 수 있는 길 (원본 T05 의 메일 안내를 아래로) */}
        <section className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
          <h2 className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">메일로 보내기</h2>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">문의 내용을 확인할 수 있는 화면이나 정보를 함께 알려 주세요.</p>
          <a href={`mailto:${HELP_EMAIL}`} className="rapo-type-t5-bold self-start break-all text-(color:--rapo-color-fg-brand-contrast)">{HELP_EMAIL}</a>
        </section>

        {/* 권익 침해 구제 — 원본에 없음(머리 주석 ②) · 접어 둠 */}
        <details className="group">
          <summary className="rapo-type-t4-bold cursor-pointer text-(color:--rapo-color-fg-neutral-muted)">여기 말고 도움을 청할 수 있는 곳</summary>
          <div className="mt-(--rapo-dimension-x3) flex flex-col gap-(--rapo-dimension-x3)">
            <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
              저희 답이 만족스럽지 않으시면 아래에 도움을 청하실 수 있어요.{' '}
              <Link href="/terms/privacy" className="underline underline-offset-2">개인정보처리방침</Link>
            </p>
            <ul className="flex flex-col gap-(--rapo-dimension-x3)">
              {구제기관.map((x) => (
                /* 이름 한 줄 · 연락처 한 줄 (2026-11-14 세중님 「글씨 잘리고」) */
                <li key={x} className="rapo-type-t4-regular flex flex-col text-(color:--rapo-color-fg-neutral-muted)">
                  <span className="rapo-type-t4-medium break-keep text-(color:--rapo-color-fg-neutral)">{x.split(' — ')[0]}</span>
                  <span className="whitespace-nowrap">{x.split(' — ')[1]}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </main>
    </div>
  );
}
