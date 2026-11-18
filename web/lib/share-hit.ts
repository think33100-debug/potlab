/* 공유 단추를 눌렀다고 알립니다 (2026-11-19 세중님 · 관리자 홈 「공유 버튼 클릭 수」 칸).

   담는 것은 page_hits 한 줄 — kind 'other' · target 'sh:<수단>:<주소>' (재방문 근사치 'rv:…' 와 같은 자리).
     수단   share(기계 공유창 · 카카오톡) · copy(링크 복사)
     주소   이 사이트 안의 공개 주소 (/jobs/HS123 · /post/12) — 회원 번호·이름은 안 담습니다
   같은 날 · 같은 브라우저 · 같은 주소 · 같은 수단은 **한 번만** 셉니다 (서버 하루번호 + DB 「하루 한 번」 색인).
   세는 쪽은 DB 의 admin_stats_shares() 입니다.

   눌린 것을 셉니다 — 공유창에서 취소해도 1 입니다(「공유 버튼 클릭 수」의 뜻 그대로).
   실패해도 화면은 아무 일 없습니다. 숫자보다 화면이 먼저입니다 (components/hit.tsx 와 같은 결) */
export function 공유셈(수단: 'share' | 'copy', 주소: string, admin: boolean) {
  try {
    fetch('/api/hit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'share', target: `sh:${수단}:${encodeURI(주소)}`.slice(0, 64), admin }),
      keepalive: true,
    }).catch(() => { /* 조용히 넘어갑니다 */ });
  } catch { /* 조용히 넘어갑니다 */ }
}
