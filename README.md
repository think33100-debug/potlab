# POTJOB

**처음 오셨으면 [`docs/인계/00_읽는법.md`](docs/인계/00_읽는법.md)
(또는 [`00_읽는법.html`](docs/인계/00_읽는법.html)) 부터 보십시오.**

> clone 해서 **파일을 두 번 눌러** 보실 거면 `.html` 쪽이 편합니다 —
> 브라우저가 `.md` 는 그냥 내려받습니다. GitHub 에서 보실 거면 `.md` 가 낫습니다.

작업치료사·물리치료사 **채용공고를 하나도 안 빼고** 모아 보여주는 서비스입니다.
공공기관·종합병원·대학병원이 1층이고, 재활·요양은 2층입니다.

| 어디 | 무엇 |
|---|---|
| [`docs/인계/`](docs/인계/) | **인계 문서 여섯** — 기획 · 기술 스펙 · IA · 화면 스펙 · 부록 |
| [`docs/screens/index.html`](docs/screens/index.html) | **캡처 갤러리** 230장 (화면 × 페르소나 × 상태 × PC/휴대폰) |
| [`CLAUDE.md`](CLAUDE.md) | 이 저장소의 **헌법**. 실제로 밟은 실수를 적어 둔 것입니다 |
| [`docs/승인대기_1009.md`](docs/승인대기_1009.md) | 아직 안 올린 것과 그 까닭 |
| `web/` | 화면 (Next.js · Vercel) |
| `tools/` | 수집기와 도구 (서버 크론에서 돕니다) |
| `sql/` | 손으로 올린 SQL |
| `gas/` | 옛 앱 (Apps Script) — 아직 공고 일부를 모읍니다 |

```
돌려 보기
  cd web && npm install && npm run dev

맞는지 보기
  node tools/인계점검.mjs      인계 문서·캡처가 서로 맞나 (다섯 가지)
  node tools/check.js          관리자 화면 수 ↔ 메뉴 줄 수 · 박아 넣은 색 수
  node tools/문서html.mjs       docs/인계/*.md 를 고친 뒤 .html 다시 만들기
```

열쇠·비밀번호는 저장소에 **한 글자도 없습니다**. `.env` 는 `.gitignore` 에 있고
커밋된 적이 없습니다 (`node tools/인계점검.mjs` 가 날마다 묻습니다).
