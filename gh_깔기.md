# `gh` 깔기 — 앞으로는 제가 GitHub 자동 실행을 직접 돌립니다

2026-09-30. 오늘 OCR 시험을 세중님이 눌러 주셔야 했습니다.
이 컴퓨터에 `gh` 가 없어서입니다 (`gh: command not found`).
한 번만 깔면 다음부터는 제가 돌리고 로그도 제가 읽습니다.

---

## 1 · 깔기 (winget)

PowerShell 을 **그냥** 열면 됩니다 (관리자 권한 필요 없습니다).

```powershell
winget install --id GitHub.cli --source winget --accept-package-agreements --accept-source-agreements
```

깔고 나면 **창을 닫았다 새로 여세요.** 안 그러면 `gh` 를 못 찾습니다
(`PATH` 는 새 창부터 반영됩니다).

확인 —

```powershell
gh --version
```

`gh version 2.x.x` 같은 줄이 나오면 됐습니다.

> winget 이 없다고 나오면 Microsoft Store 에서 「앱 설치 관리자」 를 깔거나,
> https://cli.github.com 에서 내려받아 깔아도 똑같습니다.

---

## 2 · 로그인

```powershell
gh auth login
```

물어보는 차례대로 —

```
1. What account do you want to log into?        → GitHub.com
2. What is your preferred protocol …?           → HTTPS
3. Authenticate Git with your GitHub credentials? → Y
4. How would you like to authenticate?          → Login with a web browser
5. 화면에 여덟 자리 코드가 뜹니다. 복사하세요 (예: ABCD-1234)
6. Enter 를 누르면 브라우저가 열립니다
7. 코드를 붙여넣고 → Authorize github
8. 터미널로 돌아오면 「Logged in as …」 가 뜹니다
```

확인 —

```powershell
gh auth status
gh repo view --json nameWithOwner
```

> 이 창에서 직접 하시려면 클로드 입력칸에 `!` 를 앞에 붙여 치셔도 됩니다.
> 예: `!gh auth login` — 그러면 결과가 이 대화에 바로 들어옵니다.

---

## 3 · 되는지 한 번

```powershell
cd "$env:USERPROFILE\OneDrive\바탕 화면\potjob\potlab"
gh workflow list
```

워크플로 여덟 개가 나와야 합니다 —
`alive` · `collect-alio` · `collect-cleaneye` · `collect-jobflex` ·
`probe-browser` · `push` · `site-probe-test` · `sync`

---

## 4 · 그다음부터 제가 하는 것

```
gh workflow run collect-cleaneye.yml -f dry=true     돌리기
gh run list --workflow=collect-cleaneye.yml -L 3     상태 보기
gh run watch <번호>                                   끝날 때까지 보기
gh run view <번호> --log                              로그 통째로
```

**로그를 통째로 읽을 수 있게 되는 게 핵심입니다.** 잘린 로그 때문에
두 번 헛짚은 적이 있습니다 (`CLAUDE.md` 14번).

---

## 5 · 지금은 — 손으로 누르는 순서

`gh` 를 깔기 전까지는 이렇게 하십시오.

```
1. https://github.com  로그인
2. potlab 저장소 → 위쪽 「Actions」 탭
3. 왼쪽 목록에서  collect-cleaneye  를 누릅니다
4. 오른쪽 「Run workflow ▾」 단추
5. dry 칸에  true  를 넣습니다   ← 담지 않고 시험만 합니다
6. 초록색 「Run workflow」
7. 3~5분 뒤 새로고침 → 맨 위 실행을 누릅니다
8. 「collect」 단계를 펼쳐 로그를 봅니다

보셔야 할 것 —
  「한글 읽음 N/N」 · 「PDF 읽음 N/N」     ← OCR 열쇠가 맞은 것
  「OCR 실패 … 열쇠가 맞지 않습니다」      ← GitHub Secret 이 옛 값
  「OCR 0자」                              ← 새로 놓은 덫에 걸린 것

9. 로그를 **통째로** 주세요. 길면 나눠서라도 전부요
```

`collect-alio` 도 같은 방법입니다. 둘 다 `dry` 칸이 있습니다.
