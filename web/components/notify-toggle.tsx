'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { 푸시살피기, 푸시켜기 } from '@/lib/push-client';
import { useToast } from '@/app/toast';

/* 알림 켜기·끄기 단추 (2026-10-02).
 *
 * ── 왜 만들었나 ───────────────────────────────────────────────
 * 새 앱이 회원에게 **약속만 하고 보내는 장치가 없었습니다** —
 *   job-closed.tsx 「새 공고가 올라오면 바로 알려드릴게요」
 *   org-save.tsx   「공고 뜨면 알려주기」
 * 눌러도 아무 일도 안 일어났습니다. 그 구멍을 메웁니다.
 *
 * ── 이 단추가 하는 일 ─────────────────────────────────────────
 *   ① 브라우저에 알림 허락을 받습니다
 *   ② service worker 를 등록하고 구독을 만듭니다
 *   ③ 구독을 DB 에 넣습니다 (알림기기등록)
 * **무엇을 보낼지는 안 정합니다.** 그건 기관 찜(org_stars.notify)과
 * 공고 찜(job_stars)이 정하고, 고르는 일은 DB 의 보낼알림() 이 합니다.
 *
 * ── 안 되는 자리 ──────────────────────────────────────────────
 * 아이폰 사파리는 **홈 화면에 추가**해야 웹 푸시가 됩니다. 그 경우를 글로 알립니다 —
 * 단추만 안 먹으면 회원은 고장인 줄 압니다.
 */

/* 구독 살피기·켜기는 lib/push-client.ts 한 자리입니다 (2026-11-12 — 공고 상세 「마감 임박 시 알림받기」와 같이 씁니다) */

type 상태 = '모름' | '못씀' | '꺼짐' | '켜짐' | '막힘';

export default function NotifyToggle({ 작게 = false }: { 작게?: boolean }) {
  const [상태, set상태] = useState<상태>('모름');
  const [바쁨, set바쁨] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let 살아있나 = true;
    푸시살피기().then((v) => { if (살아있나) set상태(v); });
    return () => { 살아있나 = false; };
  }, []);

  const 켜기 = async () => {
    set바쁨(true);
    try {
      const r = await 푸시켜기();
      if (r.상태 !== '켜짐') {
        /* 열쇠 없음·등록 실패는 전처럼 상태를 안 바꿉니다. 허락 거절만 「막힘/꺼짐」으로 */
        if (r.상태 === '막힘' || r.상태 === '못씀') set상태(r.상태);
        toast(r.상태 === '막힘' ? '알림이 허용되지 않았어요' : (r.까닭 ?? '알림을 못 켰어요'));
        return;
      }
      set상태('켜짐');
      toast('알림을 켰어요. 찜한 기관에 새 공고가 뜨면 알려드릴게요');
    } finally { set바쁨(false); }
  };

  const 끄기 = async () => {
    set바쁨(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await browserSupabase().rpc('알림기기끄기', { p_주소: sub.endpoint });
        await sub.unsubscribe();
      }
      set상태('꺼짐');
      toast('알림을 껐어요');
    } catch (e) {
      toast('알림을 못 껐어요 · ' + String((e as Error).message).slice(0, 60));
    } finally { set바쁨(false); }
  };

  if (상태 === '모름') return null;

  if (상태 === '못씀') {
    return (
      <p className={'break-keep text-mute ' + (작게 ? 'text-sm' : 'text-lg')}>
        이 브라우저는 알림을 못 받아요.
        아이폰은 <span className="font-bold">홈 화면에 추가</span>한 뒤에 다시 보세요
      </p>
    );
  }

  if (상태 === '막힘') {
    return (
      <p className={'break-keep text-mute ' + (작게 ? 'text-sm' : 'text-lg')}>
        브라우저에서 알림이 막혀 있어요. 주소창 왼쪽 자물쇠를 눌러 허용으로 바꿔주세요
      </p>
    );
  }

  const 켜짐 = 상태 === '켜짐';
  return (
    <button
      onClick={켜짐 ? 끄기 : 켜기}
      disabled={바쁨}
      className={'rounded-xs font-bold disabled:opacity-60 '
        + (작게 ? 'px-4 py-2 text-sm ' : 'px-5 py-3 text-lg ')
        + (켜짐
          ? 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-900'
          : 'bg-brand-red text-white hover:bg-brand-red-dark')}>
      {바쁨 ? '잠시만요…' : 켜짐 ? '알림 끄기' : '알림 받기'}
    </button>
  );
}
