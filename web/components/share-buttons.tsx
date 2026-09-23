'use client';

import { Icon } from '@/components/icon';
import { useToast } from '@/app/toast';

/* 공유 · 링크 복사.

   커뮤니티 글에 있던 것을 그대로 떼어냈습니다 (components/post-actions.tsx).
   공고·병원·급여가 같은 것을 쓰게 하려고 뺐습니다 — 두 벌이 되면
   다음에 문구를 고칠 때 한쪽만 고치게 됩니다.

   휴대폰에서는 기계가 주는 공유창을 씁니다. 거기에 카카오톡이 들어 있어서
   SDK 없이도 카톡으로 보낼 수 있습니다.
   카카오 SDK 로 「카카오톡」 단추를 따로 두려면 JavaScript 키가 필요합니다
   (지금 가진 것은 로그인용 REST 키라 다릅니다).
   데스크톱에는 공유창이 없어 링크 복사로 떨어집니다. */
export function ShareButtons({
  title, text, path, compact = false,
}: {
  /* 공유창에 뜨는 제목. 뒤에 · POTJOB 이 붙습니다 */
  title: string;
  /* 한 줄 설명. 안 주면 제목을 그대로 씁니다 */
  text?: string;
  /* 이 사이트 안의 주소 (/post/12 · /jobs/abc). 앞의 주소는 브라우저에서 붙입니다 */
  path: string;
  /* 상단바처럼 자리가 좁은 곳에서는 아이콘 하나로 줄입니다.
     누르면 공유창이 뜨고, 공유창이 없는 컴퓨터에서는 링크 복사로 떨어집니다 */
  compact?: boolean;
}) {
  const toast = useToast();

  const url = () => `${location.origin}${path}`;

  const share = async () => {
    const data = { title: `${title} · POTJOB`, text: text ?? title, url: url() };

    if (navigator.share && navigator.canShare?.(data)) {
      try { await navigator.share(data); return; }
      catch { /* 취소는 잘못이 아닙니다 */ return; }
    }
    await copyLink();
  };

  const copyLink = async () => {
    const u = url();
    try {
      await navigator.clipboard.writeText(u);
      toast('링크를 복사했어요!');
    } catch {
      /* 안전하지 않은 연결(http)에서는 clipboard 가 막힙니다 */
      toast(`복사하지 못했어요 — 주소: ${u}`, { tone: 'danger', ms: 5000 });
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={share}
        /* 누르는 자리 48px — 손가락에 맞춥니다.
           눈금(--spacing)이 지워져 있어 h-9 는 CSS 가 안 나옵니다 */
        className="flex h-[48px] w-[48px] items-center justify-center rounded-full text-[#4A5056]
                   transition-transform duration-[120ms] active:scale-[0.88]
                   motion-reduce:transition-none"
      >
        <Icon name="share" size={24} />
        <span className="sr-only">공유</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        className="rounded-md bg-brand-red px-6 py-4 text-body-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]"
      >
        공유
      </button>

      <button
        type="button"
        onClick={copyLink}
        className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
      >
        링크 복사
      </button>
    </>
  );
}
