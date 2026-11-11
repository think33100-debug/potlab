/* 프로필 사진의 저장 경로 (2026-11-11).

   새 꼴   a/<무작위 uuid>.webp          ← 올린 사람과 무관한 이름
   옛 꼴   <회원 uuid>/<올린 시각>.webp   ← 옮기기 도구가 새 꼴로 바꿉니다

   profiles.avatar 에는 `u/<경로>|<바탕색>` 으로 담깁니다 (lib/avatar.ts).
   `a/` 앞머리는 뜻이 없는 고정 글자입니다. 옛 꼴과 한눈에 갈리고,
   정리 도구(tools/clean_orphan_files.js)의 옛 꼴 목록에 **안 맞아서**
   새 파일을 건드리지 않습니다.

   같은 꼴을 세 곳이 씁니다 — 사진 고르기(components/avatar-picker.tsx) ·
   옮기기 도구(tools/프로필사진경로옮기기.mjs) · Storage 정책 SQL(금고).
   기준은 이 파일 한 자리입니다 (작업지침 6절). */
import { UUID꼴, 무작위이름 } from './storage-path.ts';

/** 새 꼴 — `a/<uuid>.webp` */
export const 새꼴 = new RegExp(`^a/${UUID꼴}\\.webp$`);

/** 옛 꼴 — `<회원uuid>/<숫자>.webp` (숫자는 올린 시각 ms) */
export const 옛꼴 = new RegExp(`^${UUID꼴}/\\d+\\.webp$`);

/** 새 프로필 사진 경로. 인수 없이 부르는 것이 원칙입니다 —
    회원 id 도 uuid 꼴이라 이 함수가 그것을 가려내지 못합니다 */
export function 새프로필사진경로(uuid?: string): string {
  return `a/${무작위이름(uuid)}.webp`;
}
