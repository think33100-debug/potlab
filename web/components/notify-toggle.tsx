'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
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

/* 공개키는 base64url 입니다. 브라우저는 BufferSource 를 받습니다.
   ArrayBuffer 를 먼저 만들고 그 위에 Uint8Array 를 올립니다 —
   그냥 new Uint8Array(n) 로 만들면 타입이 ArrayBufferLike 라
   applicationServerKey 가 안 받습니다 (SharedArrayBuffer 일 수도 있어서) */
function 열쇠바꾸기(b64: string): Uint8Array<ArrayBuffer> {
  const 채움 = '='.repeat((4 - (b64.length % 4)) % 4);
  const s = (b64 + 채움).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type 상태 = '모름' | '못씀' | '꺼짐' | '켜짐' | '막힘';

export default function NotifyToggle({ 작게 = false }: { 작게?: boolean }) {
  const [상태, set상태] = useState<상태>('모름');
  const [바쁨, set바쁨] = useState(false);
  const toast = useToast();

  const 살피기 = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { set상태('못씀'); return; }
    if (Notification.permission === 'denied') { set상태('막힘'); return; }
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      set상태(sub ? '켜짐' : '꺼짐');
    } catch { set상태('꺼짐'); }
  }, []);

  useEffect(() => { 살피기(); }, [살피기]);

  const 켜기 = async () => {
    set바쁨(true);
    try {
      const 공개키 = process.env.NEXT_PUBLIC_VAPID_PUBLIC;
      if (!공개키) { toast('알림 열쇠가 없어요. 잠시 뒤 다시 해주세요'); return; }

      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        set상태(perm === 'denied' ? '막힘' : '꺼짐');
        toast('알림이 허용되지 않았어요');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription()
        ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: 열쇠바꾸기(공개키),
        });

      const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const { error } = await browserSupabase().rpc('알림기기등록', {
        p_주소: j.endpoint ?? '',
        p_열쇠1: j.keys?.p256dh ?? '',
        p_열쇠2: j.keys?.auth ?? '',
      });
      if (error) { toast(error.message); return; }
      set상태('켜짐');
      toast('알림을 켰어요. 찜한 기관에 새 공고가 뜨면 알려드릴게요');
    } catch (e) {
      toast('알림을 못 켰어요 · ' + String((e as Error).message).slice(0, 60));
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
      <p className={'break-keep text-gray-500 ' + (작게 ? 'text-sm' : 'text-lg')}>
        이 브라우저는 알림을 못 받아요.
        아이폰은 <span className="font-bold">홈 화면에 추가</span>한 뒤에 다시 보세요
      </p>
    );
  }

  if (상태 === '막힘') {
    return (
      <p className={'break-keep text-gray-500 ' + (작게 ? 'text-sm' : 'text-lg')}>
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
