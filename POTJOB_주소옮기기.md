# potjob.co.kr 을 새 앱으로 옮기기

2026-09-23 조사. **지금은 옮기지 않습니다.** 옮기기 전에 할 일을 적어둔 문서입니다.

먼저 읽을 것 — **그냥 DNS 만 바꾸면 수집기가 조용히 멈춥니다.**
9/17 멈춤과 같은 자리입니다. 오류가 안 나고 공고만 안 들어옵니다.

---

## 지금 상태

```
potjob.co.kr        →  185.199.108~111.153   GitHub Pages   옛 앱 (index.html · app.js)
potjob-web.vercel.app  →  Vercel                             새 앱 (web/)
```

Vercel 프로젝트(`potjob-web`)에 붙어 있는 주소는 `potjob-web.vercel.app` **하나뿐**입니다
(2026-09-23 확인). 지금까지 퍼진 공유 링크는 전부 이 주소입니다.

옛 앱의 본체는 GitHub Pages 가 아니라 **Apps Script** 입니다.
화면(`index.html` · `app.js`)만 GitHub Pages 에 있고, 자료와 수집기는
`gas/wage.js` 가 Apps Script 위에서 돌립니다
(`https://script.google.com/macros/s/AKfycbx…/exec`).

---

## 옮기면 무엇이 죽나

### ① 수집기가 멈춥니다 — 제일 큰 것

`gas/wage.js` 가 **potjob.co.kr 에서 CSV 7개를 직접 받아갑니다.**
GitHub Pages 가 저장소의 `data/` 폴더를 그대로 내보내고 있어서 지금은 열립니다.

| 받아가는 주소 | `gas/wage.js` |
|---|---|
| `/data/public_hospitals.csv` | 4527행 |
| `/data/dementia_centers_256.csv` | 4529행 |
| `/data/dementia_centers_317.csv` | 4531행 |
| `/data/ltc_facilities.csv` | 5792행 |
| `/data/welfare_facilities.csv` | 5906행 |
| `/data/dev_rehab_std.csv` | 5997 · 6023행 |
| `/data/mental_centers.csv` | 6048행 |

주소를 옮기면 이 7개가 404 가 됩니다.
새 앱에는 `web/public/data/` 폴더가 **없습니다** — 먼저 옮겨야 합니다.

같이 죽는 것 —

| 주소 | 누가 쓰나 |
|---|---|
| `/hospital_data.json` | 옛 앱 화면 (`index.html` 6409행) |
| `/mail.html?act=…` | 수집기가 보내는 **메일 안에 링크로 박혀 있습니다** (`gas/wage.js` 6306행) |
| `/admin.html` | 같음 (`gas/wage.js` 6345행) |
| `/og.png` | 옛 앱 카톡 미리보기 |

### ② 옛 앱 로그인이 끊깁니다

카카오·네이버 개발자센터에 **돌아올 주소가 이 도메인으로 등록돼 있습니다.**

```
gas/wage.js:16313   KAKAO.REDIRECT : 'https://potjob.co.kr/'
gas/wage.js:16329   NAVER.REDIRECT : 'https://potjob.co.kr/'
```

옮기면 `?code=…` 가 새 앱에 떨어지는데 새 앱은 이 값을 모릅니다.
옛 앱 로그인이 그날로 끊깁니다.

**새 앱은 사정이 다릅니다.** 카카오·네이버에 등록된 주소가 우리 것이 아니라
Supabase 것입니다 — `https://qbnxycavokzcdonlfdat.supabase.co/auth/v1/callback`.
그건 안 건드려도 됩니다. 다만 카카오 개발자센터의
「플랫폼 > Web 사이트 도메인」에 `potjob.co.kr` 을 추가해야 할 수 있습니다.
**콘솔을 열어 확인하고 적으세요** — 추측으로 적지 않았습니다.

### ③ 퍼진 공유 링크

지금까지 나간 링크는 `potjob-web.vercel.app/...` 입니다.
`potjob-web.vercel.app` 은 프로젝트 기본 주소라 **옮긴 뒤에도 계속 열립니다.**
그래도 옮기고 나면 한 번은 실제로 눌러 확인하세요.

---

## 옮기기 전 6단계

순서대로 합니다. **6번이 마지막입니다** — 앞을 안 끝내고 DNS 부터 바꾸면 멈춥니다.

```
1. data/ 의 CSV 7개를 web/public/data/ 로 옮기기
     → 이걸 안 하면 수집기가 멈춥니다
2. hospital_data.json · mail.html · admin.html 을 어디에 둘지 정하기
3. 옛 앱을 어느 주소로 보낼지 정하기 (예: old.potjob.co.kr)
4. 카카오·네이버 개발자센터에서 옛 앱 REDIRECT 를 3번 주소로 바꾸기
5. gas/wage.js 의 potjob.co.kr 12군데 고치기
6. 그다음에 —
     · Vercel 프로젝트에 potjob.co.kr · www.potjob.co.kr 추가
     · 도메인 등록업체에서 A 레코드 4개(185.199.…)를 Vercel 값으로,
       www 는 CNAME 으로 교체
     · 저장소 루트의 CNAME 파일 삭제
       (안 지우면 GitHub 이 도메인을 계속 붙잡습니다)
     · Vercel 환경변수 NEXT_PUBLIC_SITE_URL=https://potjob.co.kr
       (카톡 미리보기 그림 주소가 이걸 따라갑니다 — web/lib/site-url.ts)
     · Supabase 인증 설정의 Site URL · Redirect URLs 에
       https://potjob.co.kr/** 추가
```

---

## 언제 하나

**수집기를 Supabase 로 옮길 때 같이 합니다.**
CSV 를 받아가는 주체가 수집기라서, 수집기가 Apps Script 를 떠나는 순간
1번과 5번이 저절로 풀립니다. 따로 하지 마세요.

→ `수집기_옮길때_고칠것.md` 12번 참고.

---

## 확인한 방법 (2026-09-23)

추측으로 적은 줄은 없습니다. 전부 두드려 보거나 코드에서 찾았습니다.

```
nslookup potjob.co.kr 8.8.8.8          185.199.108~111.153 (GitHub Pages)
curl -I https://potjob.co.kr/          Server: GitHub.com
curl https://potjob.co.kr/data/…       7개 전부 200
Vercel 프로젝트 도메인 목록             potjob-web.vercel.app 하나뿐
grep 'potjob.co.kr' gas/wage.js        12군데
grep 'REDIRECT' gas/wage.js            16313 · 16329행
```

확인 못 한 것 — **카카오 개발자센터의 「Web 사이트 도메인」 설정.**
콘솔을 열어야 보이는 값이라 단정하지 않았습니다.
