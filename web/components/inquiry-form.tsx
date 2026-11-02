'use client';

import { useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { browserSupabase } from '@/lib/supabase-browser';
import { 문의갈래, type 문의갈래값 } from '@/lib/inquiry';

/* 앱 안 문의 폼 (2026-11-02 · 세중님).

   보내면 창구 `문의넣기()` 를 부릅니다 — 글은 **대한민국 서울(Supabase)** 에만
   저장되고 메일로 나가지 않습니다 (국외 이전이 없습니다 · lib/terms.ts 의 그 절).

   ★ 창구는 **아직 DB 에 없습니다** (승인대기_1102.md ㉠). 그래서 이 폼은
     lib/inquiry.ts 의 스위치가 꺼진 동안 회원에게 안 보입니다. 미리보기에서
     ?폼=1 로 열어 보면 「보내기」가 창구 없음 오류를 냅니다 — 그게 맞는 상태입니다. */
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
    return <p className="mt-6 text-lg text-mute">잠시만요…</p>;
  }

  /* 비회원·가입 중인 분은 메일 단추를 쓰십니다 (아래에 그대로 있습니다).
     폼을 비회원에게 열면 누가 보냈는지 알 수 없고 스팸을 막을 길이 없습니다 */
  if (!session || !me) {
    return (
      <p className="mt-6 break-keep rounded-sm border border-gray-200 p-5 text-lg text-mute dark:border-gray-700">
        로그인하시면 <b>앱 안에서 바로</b> 보낼 수 있어요. 그 글은 대한민국 서울에만
        저장되고 메일로 나가지 않습니다. 로그인 없이 보내시려면 아래 메일을 써 주세요
      </p>
    );
  }

  if (보냈나) {
    return (
      <div className="mt-6 rounded-sm border border-teal-strong p-6">
        <p className="break-keep text-lg font-bold">보냈어요</p>
        <p className="mt-2 break-keep text-lg text-mute">
          평일에 확인하고 답을 드립니다. 더 보내실 것이 있으면{' '}
          <button type="button" onClick={() => set보냈나(false)}
            className="text-interaction-blue underline underline-offset-2">
            하나 더 쓰기
          </button>
        </p>
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-sm border border-gray-200 p-5 dark:border-gray-700">
      <h2 className="text-h3 font-bold">앱 안에서 보내기</h2>
      <p className="mt-2 break-keep text-lg text-mute">
        여기로 보내시면 글이 <b>대한민국 서울</b>에만 저장됩니다 (메일로 나가지 않습니다)
      </p>

      <fieldset className="mt-5">
        <legend className="text-lg font-bold">무엇에 대한 문의인가요</legend>
        <div className="mt-3 space-y-2">
          {문의갈래.map((x) => (
            <label key={x.값}
              className={'flex cursor-pointer items-start gap-3 rounded-sm border p-4 '
                + (갈래 === x.값
                  ? 'border-teal-strong bg-badge-teal-bg dark:bg-transparent'
                  : 'border-gray-200 dark:border-gray-700')}>
              <input type="radio" name="문의갈래" value={x.값} checked={갈래 === x.값}
                onChange={() => set갈래(x.값)} className="mt-1 size-5 accent-[#0B7A75]" />
              <span className="break-keep">
                <span className="block text-lg font-medium">{x.이름}</span>
                <span className="block text-sm text-mute">{x.설명}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {주소필요 && (
        <div className="mt-5">
          <label htmlFor="문의공고주소" className="block text-lg font-medium">
            가려 달라는 공고 주소 <span className="text-brand-red">(꼭 적어 주세요)</span>
          </label>
          <input id="문의공고주소" value={주소} onChange={(e) => set주소(e.target.value)}
            placeholder="https://potjob.co.kr/jobs/…"
            className="mt-2 w-full rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950" />
          <p className="mt-1 break-keep text-sm text-mute">
            공고 화면에서 주소를 복사해 붙여 주세요. 주소가 없으면 어느 공고인지 찾기 어렵습니다
          </p>
        </div>
      )}

      <div className="mt-5">
        <label htmlFor="문의글" className="block text-lg font-medium">하고 싶은 말</label>
        <textarea id="문의글" value={글} onChange={(e) => set글(e.target.value)} rows={6}
          placeholder="다섯 글자 이상 적어 주세요"
          className="mt-2 w-full rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950" />
        <p className="mt-1 text-sm text-mute">
          <span className="num tabular-nums">{글.trim().length}</span> / 4000
        </p>
      </div>

      <div className="mt-5">
        <label htmlFor="문의메일" className="block text-lg font-medium">
          답 받을 메일 <span className="text-mute">(비워도 됩니다 — 앱 알림으로 알려드려요)</span>
        </label>
        <input id="문의메일" type="email" value={메일} onChange={(e) => set메일(e.target.value)}
          placeholder="answer@example.com"
          className="mt-2 w-full rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950" />
      </div>

      <button type="button" onClick={보내기} disabled={!보낼수있나 || 보내는중}
        className="mt-6 w-full rounded-md bg-teal-strong px-6 py-5 text-btn font-bold text-white hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
        {보내는중 ? '보내는 중…' : 보낼수있나 ? '보내기' : 주소필요 && !주소.trim() ? '공고 주소를 적어 주세요' : '다섯 글자 이상 적어 주세요'}
      </button>

      <p className="mt-3 break-keep text-sm text-mute">
        보내신 글은 답을 드린 뒤 1년이 지나면 지웁니다 (개인정보처리방침과 같습니다)
      </p>
    </section>
  );
}
