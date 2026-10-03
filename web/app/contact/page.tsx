import Link from 'next/link';
import { COMPANY, CONTACT_EMAIL, PRIVACY_OFFICER } from '@/lib/contact';

/* 문의하기 (2026-10-01).

   메일 주소 하나만 있으면 되는 화면이라 폼을 만들지 않았습니다.
   폼을 두면 문의 내용과 보낸 사람을 우리가 또 보관하게 됩니다 —
   그러면 그것도 개인정보라 보관기간을 정하고 파기까지 붙여야 합니다.
   메일로 받으면 그 짐이 없습니다.

   주소는 lib/contact.ts 한 곳에만 적혀 있습니다. */

export const metadata = { title: '문의하기' };

const 무엇을 = [
  { 제목: '공고가 잘못됐어요',
    설명: '마감된 공고가 보이거나, 직군이 틀렸거나, 링크가 안 열릴 때' },
  { 제목: '우리 기관 공고를 올려주세요',
    설명: '기관 이름과 채용공고 게시판 주소를 같이 보내주시면 수집 대상에 넣습니다' },
  { 제목: '내 개인정보를 보고 싶어요 · 지워주세요',
    설명: '열람·정정·삭제·처리정지를 요청하실 수 있습니다. 탈퇴는 내 정보 화면에서 바로 하실 수 있어요' },
  { 제목: '그 밖에 하고 싶은 말',
    설명: '불편한 점, 있었으면 하는 기능 — 무엇이든 좋습니다' },
];

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <h1 className="text-h2 font-bold">문의하기</h1>
      <p className="mt-2 break-keep text-lg text-mute">
        아래 메일로 보내주세요. 평일에 확인하고 답을 드립니다
      </p>

      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="mt-6 block rounded-md bg-teal-strong px-6 py-5 text-center text-body-lg font-bold text-white hover:opacity-90 active:scale-[0.98]"
      >
        {CONTACT_EMAIL} 으로 메일 보내기
      </a>

      <section className="mt-8">
        <h2 className="text-h3 font-bold">이런 것을 보내주세요</h2>
        <ul className="mt-4 space-y-4">
          {무엇을.map((x) => (
            <li key={x.제목} className="rounded-sm border border-gray-200 p-5 dark:border-gray-700">
              <p className="text-lg font-bold">{x.제목}</p>
              <p className="mt-1 break-keep text-lg text-gray-600 dark:text-gray-400">{x.설명}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-sm bg-badge-teal-bg p-6 dark:border dark:border-teal-strong/40 dark:bg-transparent">
        <h2 className="text-lg font-bold">개인정보 보호책임자</h2>
        <p className="mt-2 break-keep text-lg text-gray-700 dark:text-gray-300">
          {PRIVACY_OFFICER.이름} ({PRIVACY_OFFICER.직책})
          <br />
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-3 break-keep text-sm text-mute">
          개인정보와 관련한 문의·불만·피해구제는 이쪽으로 주세요.{' '}
          <Link href="/terms/privacy" className="underline underline-offset-2">
            개인정보처리방침
          </Link>
          에서 무엇을 모으고 얼마나 두는지 보실 수 있어요
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">만든 곳</h2>
        <p className="mt-2 break-keep text-lg leading-relaxed text-gray-600 dark:text-gray-400">
          {COMPANY.이름}
          <br />
          {COMPANY.주소}
          <br />
          직업정보제공사업 신고번호 {COMPANY.신고번호}
        </p>
      </section>

      <section className="mt-8 border-t border-gray-100 pt-6 dark:border-gray-800">
        <h2 className="text-lg font-bold">여기 말고 갈 수 있는 곳</h2>
        <p className="mt-2 break-keep text-lg leading-relaxed text-gray-600 dark:text-gray-400">
          저희 답이 만족스럽지 않으시면 아래에 도움을 청하실 수 있어요.
        </p>
        <ul className="mt-3 space-y-1 break-keep text-lg text-gray-600 dark:text-gray-400">
          <li>· 개인정보 침해신고센터 — privacy.kisa.or.kr · 국번없이 118</li>
          <li>· 개인정보 분쟁조정위원회 — kopico.go.kr · 1833-6972</li>
          <li>· 대검찰청 사이버수사과 — spo.go.kr · 1301</li>
          <li>· 경찰청 사이버수사국 — ecrm.police.go.kr · 182</li>
        </ul>
      </section>
    </main>
  );
}
