'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { RapoButton, RapoChip } from '@/components/rapo/rapo-ui';
import { browserSupabase } from '@/lib/supabase-browser';
import { 문의갈래, type 문의갈래값 } from '@/lib/inquiry';

/* 앱 안 문의 폼 (2026-11-02 · 세중님).

   보내면 창구 `문의넣기()` 를 부릅니다 — 글은 **대한민국 서울(Supabase)** 에만
   저장되고 메일로 나가지 않습니다 (국외 이전이 없습니다 · lib/terms.ts 의 그 절).
   그래서 이 폼은 처리방침의 「거부 방법」이 가리키는 자리입니다 — 빼지 않습니다.

   ── 새 디자인 (2026-11-13) ──
   피그마에 일반 문의 폼은 없습니다. 같은 파일의 「S-ACCESS-INQUIRY / 이용 문의」 1375:531
   (입력 칸 「RAPO / 공통 / 텍스트 입력」 · 채움 버튼 52)을 그대로 빌렸습니다.
   갈래 고르기는 「RAPO / Chip / Selection」(RapoChip) 입니다. 동작(창구·검사·글자 수)은 전과 같습니다. */

/* 「RAPO / 공통 / 텍스트 입력」 1245:956 — 이름 14/19 Medium · 칸 선 1 stroke/neutral-weak · radius 12 · 안쪽 16 · 글 16/22 */
const 칸 = 'rapo-type-t5-regular w-full rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) ' +
  'bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) placeholder:text-(color:--rapo-color-fg-placeholder)';
const 칸이름 = 'rapo-type-t4-medium text-(color:--rapo-color-fg-on-identity)';
const 도움말 = 'rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)';

export function InquiryForm() {
  const { loading, session, me } = useAuth();
  const toast = useToast();

  const [갈래, set갈래] = useState<문의갈래값>('일반');
  const [글, set글] = useState('');
  const [주소, set주소] = useState('');
  const [메일, set메일] = useState('');
  const [보내는중, set보내는중] = useState(false);
  const [보냈나, set보냈나] = useState(false);

  const 고른것 = 문의갈래.find((x) => x.값 === 갈래)!;
  const 주소필요 = '주소필요' in 고른것 && 고른것.주소필요 === true;
  const 보낼수있나 = 글.trim().length >= 5 && (!주소필요 || 주소.trim().length > 0);

  const 보내기 = async () => {
    if (!보낼수있나 || 보내는중) return;
    set보내는중(true);
    const { error } = await browserSupabase().rpc('문의넣기', {
      p_갈래: 갈래,
      p_글: 글.trim(),
      p_공고주소: 주소.trim() || null,
      p_답받을메일: 메일.trim() || null,
    });
    set보내는중(false);
    if (error) {
      toast(`보내지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 });
      return;
    }
    set보냈나(true);
    set글(''); set주소(''); set메일('');
    toast('보냈어요. 평일에 확인하고 답을 드립니다', { ms: 4000 });
  };

  if (loading) {
    return <p role="status" className={도움말}>잠시만요…</p>;
  }

  /* 비회원·가입 중인 분은 위의 메일 단추를 쓰십니다.
     폼을 비회원에게 열면 누가 보냈는지 알 수 없고 스팸을 막을 길이 없습니다 */
  if (!session || !me) {
    return (
      <div className="flex flex-col gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
        <p className="rapo-type-t5-regular break-keep text-(color:--rapo-color-fg-neutral)">
          로그인하시면 앱 안에서 바로 보낼 수 있어요. 그 글은 대한민국 서울에만 저장되고 메일로 나가지 않아요.
        </p>
        <RapoButton href="/login?next=%2Fcontact" tone="outline" size={40} className="self-start">로그인하고 보내기</RapoButton>
      </div>
    );
  }

  if (보냈나) {
    return (
      <div role="status" className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
        <p className="rapo-type-t6-bold text-(color:--rapo-color-fg-neutral)">문의가 접수됐어요</p>
        <p className="rapo-type-t5-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">평일에 확인하고 답을 드릴게요.</p>
        <button type="button" onClick={() => set보냈나(false)}
          className="rapo-type-t4-bold mt-(--rapo-dimension-x1) self-start text-(color:--rapo-color-fg-neutral) underline underline-offset-2">
          하나 더 쓰기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-(--rapo-dimension-x5)">
      <fieldset className="flex flex-col gap-(--rapo-dimension-x2)">
        <legend className={칸이름}>무엇에 대한 문의인가요</legend>
        <div className="flex flex-wrap gap-x-(--rapo-dimension-x2)">
          {문의갈래.map((x) => (
            <RapoChip key={x.값} label={x.이름} on={갈래 === x.값} onClick={() => set갈래(x.값)} />
          ))}
        </div>
        <p className={도움말}>{고른것.설명}</p>
      </fieldset>

      {주소필요 && (
        <div className="flex flex-col gap-(--rapo-dimension-x2)">
          <label htmlFor="문의공고주소" className={칸이름}>
            가려 달라는 공고 주소 <span className="text-(color:--rapo-color-fg-brand-contrast)">(꼭 적어 주세요)</span>
          </label>
          <input id="문의공고주소" value={주소} onChange={(e) => set주소(e.target.value)}
            placeholder="https://www.rapojob.co.kr/jobs/…" className={칸} />
          <p className={도움말}>공고 화면에서 주소를 복사해 붙여 주세요. 주소가 없으면 어느 공고인지 찾기 어려워요</p>
        </div>
      )}

      <div className="flex flex-col gap-(--rapo-dimension-x2)">
        <label htmlFor="문의글" className={칸이름}>문의 내용</label>
        <textarea id="문의글" value={글} onChange={(e) => set글(e.target.value)} rows={6} maxLength={4000}
          placeholder="다섯 글자 이상 적어 주세요" className={칸 + ' resize-y'} />
        <p className={도움말}><span className="tabular-nums">{글.trim().length}</span> / 4000</p>
      </div>

      <div className="flex flex-col gap-(--rapo-dimension-x2)">
        <label htmlFor="문의메일" className={칸이름}>답 받을 메일 (비워도 돼요 — 앱 알림으로 알려 드려요)</label>
        <input id="문의메일" type="email" value={메일} onChange={(e) => set메일(e.target.value)}
          placeholder="answer@example.com" className={칸} />
      </div>

      <RapoButton onClick={보내기} disabled={!보낼수있나} loading={보내는중} full>
        {보내는중 ? '보내는 중…' : 보낼수있나 ? '문의 보내기' : 주소필요 && !주소.trim() ? '공고 주소를 적어 주세요' : '다섯 글자 이상 적어 주세요'}
      </RapoButton>

      <p className={도움말}>
        보내신 글은 답을 드린 뒤 1년이 지나면 지워요 (<Link href="/terms/privacy" className="underline underline-offset-2">개인정보처리방침</Link>과 같아요)
      </p>
    </div>
  );
}
