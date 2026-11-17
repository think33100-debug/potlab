'use client';

import { createContext, useContext } from 'react';
import type { JobGroup } from './who';

/* 가입 미리보기에서 **미리 골라 둔 갈래** (2026-11-17 · components/signup-preview.tsx 가 줍니다).
   가입 화면(app/welcome/page.tsx)은 이것이 있으면 ② 직군·근무 경험을 그 값으로 채워 놓고 시작합니다.
   진짜 가입(/welcome)에서는 늘 null 이라 아무것도 달라지지 않습니다 */
export type 가입미리갈래 = { 직군: JobGroup | null; 경험: '없음' | '있음' | null };

export const 가입미리 = createContext<가입미리갈래 | null>(null);
export const useSignupPick = () => useContext(가입미리);
