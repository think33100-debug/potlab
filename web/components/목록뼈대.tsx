/* 목록 화면의 **뼈대** — 누르는 순간 이것이 먼저 뜹니다 (2026-10-28 세중님 ⓐ)
 *
 * ── 왜 이것이 느림을 고치나 ──────────────────────────────────
 * 느린 여섯(/jobs·/community·/orgs·/edu·/youth·/compete)은 `dynamic = 'force-dynamic'`
 * 입니다. 그러면 Next 가 **미리 받아 둘 것이 없어서**, 누른 뒤에야 서버 왕복을
 * 시작합니다 — 그동안 화면이 **안 바뀝니다** (세중님이 느낀 2초).
 * `loading.tsx` 를 두면 ㉠ 누르는 순간 이 뼈대가 뜨고 ㉡ Next 가 그 **뼈대만 미리
 * 받아 둘 수 있습니다**. 빠른 둘(/pay·/spec)은 **정적(○)** 이라 이미 그 값을 받고 있습니다
 * (docs/속도진단_1028.md).
 *
 * ── 뼈대를 어떻게 그리나 ────────────────────────────────────
 *   · 글자를 쓰지 않습니다 — 「불러오는 중…」 같은 말은 **화면이 두 번 바뀌어** 더 산만합니다
 *   · 참 화면과 **같은 테두리·같은 폭**을 씁니다 (max-w-3xl · px-6 py-7) — 안 맞으면 뜰 때 덜컹합니다
 *   · `animate-pulse` 하나만 씁니다. 돌아가는 바퀴는 안 씁니다 (0.3초면 끝나는 자리입니다)
 *   · 몇 줄을 그릴지는 `줄` 로 받습니다 — 화면마다 길이가 다릅니다
 */
export function 목록뼈대({ 줄 = 6, 제목 = true, 폭 = 'max-w-3xl' }:
  { 줄?: number; 제목?: boolean; 폭?: string }) {
  return (
    <main
      className={`mx-auto w-full ${폭} px-6 py-7 pb-[88px] md:px-7 md:pb-7`}
      aria-busy="true"
      aria-live="polite"
    >
      {/* 눈에는 안 보이고 읽어 주는 기계에만 들립니다 */}
      <span className="sr-only">불러오는 중</span>
      <div className="animate-pulse">
        {제목 && <div className="h-7 w-40 rounded-sm bg-line" />}
        <div className="mt-5 space-y-3">
          {Array.from({ length: 줄 }).map((_, i) => (
            <div key={i} className="rounded-sm border border-line bg-card px-5 py-5">
              <div className="h-4 w-3/4 rounded-sm bg-line" />
              <div className="mt-3 h-3 w-1/2 rounded-sm bg-line" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
