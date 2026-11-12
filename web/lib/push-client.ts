import { browserSupabase } from '@/lib/supabase-browser';

/* 웹 푸시 — 이 기기의 구독을 살피고 켜는 일 한 자리 (2026-11-12).
   알림 켜기 단추(components/notify-toggle.tsx)와 공고 상세의 「마감 임박 시 알림받기」
   (components/job-deadline-notify.tsx)가 같이 씁니다. 전에는 notify-toggle 안에만 있었습니다.

   **무엇을 보낼지는 여기서 안 정합니다** — 기관 찜(org_stars.notify)·공고 찜(job_stars)이 정하고,
   고르는 일은 DB 의 보낼알림() 이 합니다. 여기는 「이 기기로 보내도 된다」만 등록합니다. */

export type 푸시상태 = '못씀' | '꺼짐' | '켜짐' | '막힘';

export const 푸시못씀말 = '이 브라우저는 알림을 못 받아요. 아이폰은 홈 화면에 추가한 뒤에 다시 눌러 주세요';
export const 푸시막힘말 = '브라우저에서 알림이 막혀 있어요. 주소창 왼쪽 자물쇠를 눌러 허용으로 바꿔 주세요';

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

/** 이 기기가 지금 알림을 받는가 — 서버에 묻지 않고 브라우저 구독만 봅니다 */
export async function 푸시살피기(): Promise<푸시상태> {
  if (typeof window === 'undefined') return '꺼짐';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return '못씀';
  if (Notification.permission === 'denied') return '막힘';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? '켜짐' : '꺼짐';
  } catch { return '꺼짐'; }
}

/** ① 브라우저 허락 ② service worker·구독 ③ DB 등록(알림기기등록).
    켜졌으면 까닭이 없습니다. 못 켰으면 회원에게 보여 줄 까닭을 함께 돌려줍니다 */
export async function 푸시켜기(): Promise<{ 상태: 푸시상태; 까닭?: string }> {
  if (typeof window === 'undefined') return { 상태: '꺼짐' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return { 상태: '못씀', 까닭: 푸시못씀말 };
  try {
    const 공개키 = process.env.NEXT_PUBLIC_VAPID_PUBLIC;
    if (!공개키) return { 상태: '꺼짐', 까닭: '알림 열쇠가 없어요. 잠시 뒤 다시 해주세요' };

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      return perm === 'denied' ? { 상태: '막힘', 까닭: 푸시막힘말 } : { 상태: '꺼짐', 까닭: '알림이 허용되지 않았어요' };
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
    if (error) return { 상태: '꺼짐', 까닭: error.message };
    return { 상태: '켜짐' };
  } catch (e) {
    return { 상태: '꺼짐', 까닭: '알림을 못 켰어요 · ' + String((e as Error).message).slice(0, 60) };
  }
}
