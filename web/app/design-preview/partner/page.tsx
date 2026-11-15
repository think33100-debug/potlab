'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { RapoAppBar } from '@/components/rapo/rapo-me';
import { RapoButton } from '@/components/rapo/rapo-ui';

/* 「담당자 신청」 시안 (2026-11-14 세중님 「ㄱㄱ」) — 개발 서버에서만(배포 404).
     ?g=채용(기본) · 기관 · 개인     ?s=채움 이면 칸을 채운 모습

   ★ 저장·동작이 없는 시안입니다. 눌러도 DB 에 아무것도 안 갑니다.
   지금 화면(app/partner/page.tsx)에서 빠진 것 넷을 채웠습니다 —
     ① 서류 올리는 칸 (「올려 주세요」라고만 적혀 있고 올릴 곳이 없었습니다)
     ② 채용 담당의 병원 고르기 (기관번호가 늘 빈 채로 신청됐습니다)
     ③ 개인 강사의 입력 칸 (하나도 없었습니다)
     ④ 새 디자인 (가입 화면 U05 와 같은 선택 카드 · 입력 칸 · 아래 고정 단추)
   피그마에는 이 화면의 원본이 없습니다(교육 담당자의 승인 뒤 화면만 있음 · 13 교육 과정 1512:3423).
   그래서 가입 화면(U05-02)의 부품을 그대로 썼습니다. */

type 갈래 = '채용' | '기관' | '개인';

const 고르기: { k: 갈래; 이름: string; 설명: string }[] = [
  { k: '채용', 이름: '병원 채용 담당', 설명: '우리 병원 공고를 직접 올리고 고쳐요' },
  { k: '기관', 이름: '교육 기관 · 학회', 설명: '교육을 등록하고 신청을 받아요' },
  { k: '개인', 이름: '개인 강사', 설명: '내 이름으로 교육을 열어요' },
];

const 서류: Record<갈래, { 이름: string; 필수: boolean; 설명?: string }[]> = {
  채용: [
    { 이름: '사업자등록증', 필수: true },
    { 이름: '사원증 또는 재직증명서', 필수: true, 설명: '둘 중 하나면 돼요' },
  ],
  기관: [
    { 이름: '사업자등록증 또는 고유번호증', 필수: true, 설명: '학회·협회는 고유번호증' },
  ],
  개인: [
    { 이름: '활동 이력', 필수: true, 설명: '교육 자료나 강의 사진 하나면 돼요' },
    { 이름: '치료사 면허증', 필수: false, 설명: '확인되면 「면허 확인 강사」 배지가 붙어요' },
  ],
};

const 칸 = 'rapo-type-t5-regular h-(--rapo-dimension-x13) w-full min-w-0 rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) '
  + 'border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) '
  + 'placeholder:text-(color:--rapo-color-fg-placeholder)';

function 이름표({ children, 필수 = false, 덧 }: { children: React.ReactNode; 필수?: boolean; 덧?: string }) {
  return (
    <span className="flex flex-col gap-(--rapo-dimension-x1)">
      <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">
        {children}
        {필수
          ? <span className="ml-1 text-(color:--rapo-color-fg-brand-contrast)">*</span>
          : <span className="rapo-type-t3-regular ml-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral-muted)">선택</span>}
      </span>
      {덧 && <span className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{덧}</span>}
    </span>
  );
}

function Body() {
  const q = useSearchParams();
  const [g, setG] = useState<갈래>((q.get('g') as 갈래) ?? '채용');
  const 채움 = q.get('s') === '채움';
  const [올림, set올림] = useState<Record<string, boolean>>({});
  const 올렸나 = (이름: string) => 채움 || !!올림[g + 이름];
  const 다됨 = 채움 || 서류[g].filter((x) => x.필수).every((x) => 올림[g + x.이름]);

  return (
    <div data-rapo className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-(--rapo-color-bg-layer-default)">
      <RapoAppBar title="담당자 신청" back="/me" />

      <main className="flex flex-1 flex-col gap-(--rapo-dimension-x8) px-(--rapo-dimension-x5) pb-(--rapo-dimension-x6) pt-(--rapo-dimension-x4)">
        <header className="flex flex-col gap-(--rapo-dimension-x2)">
          <h1 className="rapo-type-t11-bold break-keep text-(color:--rapo-color-fg-neutral)">어떤 담당자로<br />신청하세요?</h1>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            소속을 확인한 뒤 공고를 올리거나 교육을 열 수 있어요. 확인은 보통 1~2일 걸려요.
          </p>
        </header>

        {/* ① 갈래 — 가입 화면(U05-02)의 선택 카드 */}
        <section className="flex flex-col gap-(--rapo-dimension-x3)">
          {고르기.map((x) => {
            const on = g === x.k;
            return (
              <button key={x.k} type="button" onClick={() => setG(x.k)} aria-pressed={on}
                className={'flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) px-(--rapo-dimension-x5) py-(--rapo-dimension-x4) text-left '
                  + (on ? 'border-(color:--rapo-color-fg-brand-contrast) bg-(--rapo-color-bg-brand-weak)'
                        : 'border-(color:--rapo-color-stroke-neutral-weak) active:bg-(--rapo-color-bg-transparent-pressed)')}>
                <span className="min-w-0 flex-1">
                  <span className="rapo-type-t6-bold block text-(color:--rapo-color-fg-neutral)">{x.이름}</span>
                  <span className="rapo-type-t3-regular mt-(--rapo-dimension-x1) block break-keep text-(color:--rapo-color-fg-neutral-muted)">{x.설명}</span>
                </span>
                <span aria-hidden className={'flex size-[20px] shrink-0 items-center justify-center rounded-(--rapo-radius-full) border-(length:--rapo-border-default) '
                  + (on ? 'border-(color:--rapo-color-bg-navy-solid) bg-(--rapo-color-bg-navy-solid)' : 'border-(color:--rapo-color-stroke-neutral-weak)')}>
                  {on && <span className="size-[8px] rounded-(--rapo-radius-full) bg-(--rapo-color-bg-layer-default)" />}
                </span>
              </button>
            );
          })}
        </section>

        {/* ② 소속 */}
        <section className="flex flex-col gap-(--rapo-dimension-x5)">
          <h2 className="rapo-type-t7-bold text-(color:--rapo-color-fg-neutral)">{g === '개인' ? '강사 정보' : '소속 정보'}</h2>

          {g === '채용' && (
            <label className="flex flex-col gap-(--rapo-dimension-x2)">
              <이름표 필수 덧="이름을 넣으면 목록에서 고를 수 있어요">병원 이름</이름표>
              <input className={칸} placeholder="예) 가온병원" defaultValue={채움 ? '가온병원' : ''} key={'h' + 채움} />
              {채움 && (
                <span className="flex items-center gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x4) py-(--rapo-dimension-x3)">
                  <span className="min-w-0 flex-1">
                    <span className="rapo-type-t4-bold block text-(color:--rapo-color-fg-neutral)">가온병원</span>
                    <span className="rapo-type-t3-regular block text-(color:--rapo-color-fg-neutral-muted)">종합병원 · 서울 강서구</span>
                  </span>
                  <span className="rapo-type-t3-bold whitespace-nowrap text-(color:--rapo-color-fg-brand-contrast)">선택됨</span>
                </span>
              )}
            </label>
          )}

          {g === '기관' && (
            <label className="flex flex-col gap-(--rapo-dimension-x2)">
              <이름표 필수 덧="교육 화면에 보일 이름이에요">교육 기관 이름</이름표>
              <input className={칸} placeholder="예) 대한작업치료사협회" defaultValue={채움 ? '대한작업치료사협회' : ''} key={'o' + 채움} />
            </label>
          )}

          {g === '개인' && (
            <>
              <label className="flex flex-col gap-(--rapo-dimension-x2)">
                <이름표 필수 덧="교육 화면에 보일 이름이에요">강사 이름</이름표>
                <input className={칸} placeholder="예) 홍길동 작업치료사" defaultValue={채움 ? '홍길동 작업치료사' : ''} key={'n' + 채움} />
              </label>
              <label className="flex flex-col gap-(--rapo-dimension-x2)">
                <이름표 덧="예전에 열었던 교육 모집 글이 있으면 넣어 주세요">예전 모집 공고 주소</이름표>
                <input className={칸} inputMode="url" placeholder="https://" />
              </label>
            </>
          )}

          {g !== '개인' && (
            <div className="flex flex-col gap-(--rapo-dimension-x2)">
              <label className="flex flex-col gap-(--rapo-dimension-x2)">
                <이름표 필수 덧={g === '기관' ? '고유번호증이면 고유번호를 넣어 주세요' : undefined}>사업자등록번호</이름표>
                <span className="flex gap-(--rapo-dimension-x2)">
                  <input className={칸 + ' flex-1'} inputMode="numeric" placeholder="숫자 10자리" defaultValue={채움 ? '1234567890' : ''} key={'b' + 채움} />
                  <button type="button"
                    className="rapo-type-t4-bold h-(--rapo-dimension-x13) shrink-0 whitespace-nowrap rounded-(--rapo-radius-r3) border-(length:--rapo-border-default)
                               border-(color:--rapo-color-stroke-neutral-muted) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) active:bg-(--rapo-color-bg-transparent-pressed)">
                    확인
                  </button>
                </span>
              </label>
              {채움 && <p className="rapo-type-t3-bold text-(color:--rapo-color-fg-informative)">국세청 확인 · 계속사업자</p>}
            </div>
          )}
        </section>

        {/* ③ 서류 — 한 줄에 하나씩. 올리면 「올림」으로 바뀝니다 */}
        <section className="flex flex-col gap-(--rapo-dimension-x4)">
          <div className="flex flex-col gap-(--rapo-dimension-x1)">
            <h2 className="rapo-type-t7-bold text-(color:--rapo-color-fg-neutral)">확인 서류</h2>
            <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">사진이나 PDF로 올려 주세요.</p>
          </div>
          <ul className="flex flex-col gap-(--rapo-dimension-x3)">
            {서류[g].map((x) => {
              const on = 올렸나(x.이름);
              return (
                <li key={x.이름} className="flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) p-(--rapo-dimension-x4)">
                  <span className="min-w-0 flex-1">
                    <이름표 필수={x.필수} 덧={on ? '올린 파일 1개' : x.설명}>{x.이름}</이름표>
                  </span>
                  <button type="button" onClick={() => set올림({ ...올림, [g + x.이름]: !올림[g + x.이름] })}
                    className={'rapo-type-t4-bold flex h-(--rapo-dimension-x10) shrink-0 items-center whitespace-nowrap rounded-(--rapo-radius-r2) px-(--rapo-dimension-x4) '
                      + (on ? 'border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-muted) text-(color:--rapo-color-fg-neutral)'
                            : 'bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid)')}>
                    {on ? '다시 올리기' : '올리기'}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)">
            <b>주민등록번호는 받지 않아요.</b> 서류에 뒷자리가 보이면 가리고 올려 주세요.
          </p>
          <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            올려 주신 서류는 소속 확인에만 쓰고, 승인 권한이 있는 운영진만 볼 수 있어요. 탈퇴하면 지워요.
          </p>
        </section>

        {/* ④ 내 신청 — 채운 모습에서만 한 건 보입니다 */}
        {채움 && (
          <section className="flex flex-col gap-(--rapo-dimension-x3)">
            <h2 className="rapo-type-t7-bold text-(color:--rapo-color-fg-neutral)">내 신청</h2>
            <div className="flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4)">
              <span className="min-w-0 flex-1">
                <span className="rapo-type-t5-bold block text-(color:--rapo-color-fg-neutral)">{고르기.find((x) => x.k === g)!.이름}</span>
                <span className="rapo-type-t3-regular block text-(color:--rapo-color-fg-neutral-muted)">11.14 신청 · 서류 {서류[g].length}개</span>
              </span>
              <span className="rapo-type-t3-bold whitespace-nowrap rounded-(--rapo-radius-full) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x3) py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral)">확인 중</span>
            </div>
          </section>
        )}
      </main>

      <div className="sticky bottom-0 bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x5) pt-(--rapo-dimension-x2) pb-[calc(var(--rapo-dimension-x4)+env(safe-area-inset-bottom))]">
        <RapoButton full disabled={!다됨} onClick={() => {}}>{다됨 ? '신청하기' : '필수 서류를 올려 주세요'}</RapoButton>
      </div>
    </div>
  );
}

export default function DesignPreviewPartner() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Suspense><Body /></Suspense>;
}
