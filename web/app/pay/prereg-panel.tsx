'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/auth';
import {
  createPreregController, 사전신청켜짐,
  type PreregController, type PreregKind, type PreregView,
} from '@/lib/pay-prereg-store';
import { browserSupabase } from '@/lib/supabase-browser';

/* 연봉·후기 사전 신청 패널의 비활성 초안입니다.

   문이 닫혀 있으면 아무것도 그리지 않고, 안쪽을 올리지 않으므로 client 생성·RPC 도 없습니다.
   아래 글은 초안입니다. 세중님 문구 승인 전에는 회원에게 보이면 안 됩니다. */
export function PreregPanel() {
  if (!사전신청켜짐) return null;
  return <PreregPanelBody />;
}

const 종류들: PreregKind[] = ['연봉', '후기'];

const 칸 = 'mt-7 rounded-sm border border-gray-200 p-6 dark:border-gray-700';
const 글 = 'break-keep text-sm text-mute';
const 단추 = `rounded-sm border border-gray-200 px-5 py-3 text-sm font-bold
              disabled:opacity-50 dark:border-gray-700`;

function PreregPanelBody() {
  const { who, session, 설문 } = useAuth();
  const userId = session?.user.id ?? null;
  const [보기, set보기] = useState<PreregView>({ 단계: '확인중' });
  const 조종 = useRef<PreregController | null>(null);

  useEffect(() => {
    const c = createPreregController({
      enabled: 사전신청켜짐,
      getClient: () => browserSupabase(),
      onChange: set보기,
    });
    조종.current = c;
    return () => { c.닫기(); 조종.current = null; };
  }, []);

  useEffect(() => {
    조종.current?.인증바뀜({ who, userId, 설문 });
  }, [who, userId, 설문]);

  switch (보기.단계) {
    case '꺼짐':
      return null;
    case '확인중':
    case '불러오는중':
      return <section className={칸}><p className={글}>확인하고 있어요.</p></section>;
    case '로그인필요':
      return (
        <section className={칸}>
          <Link href={'/login?next=' + encodeURIComponent('/pay')} className={단추}>
            로그인하고 신청하기
          </Link>
        </section>
      );
    case '가입미완료':
      return (
        <section className={칸}>
          <Link href="/welcome" className={단추}>가입 마치기</Link>
        </section>
      );
    case '오류':
      return (
        <section className={칸}>
          <p className={글} role="alert">
            {보기.오류 === 'denied' ? '지금은 신청할 수 없어요.' : '처리하지 못했어요.'}
          </p>
          <button type="button" className={`mt-3 ${단추}`} onClick={() => 조종.current?.다시확인()}>
            다시 확인
          </button>
        </section>
      );
    case '준비':
      return (
        <section className={칸}>
          <ul className="flex flex-col gap-3">
            {종류들.map((kind) => (
              <li key={kind} className="flex items-center justify-between gap-3">
                <span className="break-keep text-body-lg font-bold">
                  {kind} {보기.status[kind] ? '신청함' : '신청 안 함'}
                </span>
                <button
                  type="button"
                  className={단추}
                  disabled={보기.처리중 !== null}
                  onClick={() => (보기.status[kind]
                    ? 조종.current?.취소(kind)
                    : 조종.current?.신청(kind))}
                >
                  {보기.status[kind] ? '취소' : '신청'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      );
  }
}
