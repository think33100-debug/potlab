# POTJOB 브랜드 자산 — 앱 적용 명세서

작성일 2026-09-20 · 이 폴더 하나로 iOS·Android·웹 아이콘을 전부 붙일 수 있습니다.
**이 문서의 규격은 2026-09-20 기준으로 애플·구글 문서 및 해설 자료를 확인해 적었습니다. 제출 직전에 스토어 콘솔이 뱉는 검증 메시지를 한 번 더 보세요.**

---

## 1. 로고는 두 개뿐입니다

| 이름 | 쓰는 곳 |
|---|---|
| **마크 (스피드 컷 T)** | 앱 아이콘, 파비콘, SNS 프로필, 알림 아이콘 |
| **워드마크 (PO<span>T</span>JOB)** | 앱 헤더, 스플래시, 웹 상단, 명함, 문서 |

둘을 가로로 붙인 **조합형(lockup)**은 스플래시·소개 페이지용으로만 씁니다.
앱 아이콘 안에 글자를 넣지 않습니다. 워드마크 옆에 마크를 두 번 넣지 않습니다.

---

## 2. 색

| 토큰 | 값 | 용도 |
|---|---|---|
| `potjob_red` | `#FF3B30` | 아이콘 배경, 워드마크의 T, 주요 버튼 |
| `potjob_red_pressed` | `#E0332A` | 버튼 눌림 상태 |
| `potjob_ink` | `#14181C` | 어두운 배경, 밝은 배경 위 글자 |
| `potjob_surface_dark` | `#1B2025` | 어두운 테마 카드 배경 |
| `potjob_on_dark_muted` | `#A8B0B5` | 어두운 배경 위 보조 텍스트 |
| `potjob_paper` | `#F4F4F1` | 밝은 테마 배경 |

`tokens.json`, `android/values/colors.xml`에 같은 값이 들어 있습니다.

> 접근성 주의: `#FF3B30` 위의 흰 글자는 대비가 약 3.1:1입니다. **큰 굵은 글자(24px 이상)와 로고에만** 쓰고, 본문 텍스트를 빨강 배경에 올리지 마세요. 빨강을 글자색으로 쓸 때는 어두운 배경(`#14181C`) 위에만 씁니다.

---

## 3. 서체

- **워드마크: Archivo 900 Italic** (Omnibus-Type)
- 라이선스: **SIL Open Font License 1.1** — 상업 사용·임베딩·수정 가능. 원문은 `LICENSE-Archivo.txt`.
- 본 폴더의 워드마크 SVG는 **글자가 이미 패스로 변환**돼 있습니다. 폰트 설치 없이 어디서나 똑같이 렌더됩니다.
- UI 본문은 한글이 섞이므로 Pretendard 또는 Noto Sans KR을 쓰고, 워드마크 서체를 본문에 쓰지 마세요.

**자간은 -0.04em**입니다. 워드마크를 코드로 다시 조판하지 말고 SVG를 그대로 쓰세요.

---

## 4. 형태 규칙

- 기울기는 **11도**. 마크의 T, 워드마크의 이탤릭이 같은 각도입니다. 다른 각도를 섞지 마세요.
- 마크의 가로획은 **캔버스 좌우를 뚫고 나갑니다.** 여백을 주지 마세요. 그게 이 마크의 특징입니다.
- 마크 색 반전은 두 가지만: 빨강 배경 + 흰 T(기본), 흰 배경 + 빨강 T. 회색·그라데이션 금지.
- 워드마크 주변 여백은 **T 글자 높이의 절반 이상**.

---

## 5. iOS

```
png/ios/AppIcon-1024.png
```

- 1024×1024 PNG, **RGB(알파 채널 없음)**, 모서리 안 둥글림 — 스크립트가 이미 그렇게 저장했습니다.
- Xcode 14 이상은 이 파일 하나만 App Icon의 **Single Size** 슬롯에 넣으면 나머지 크기를 자동 생성합니다.
- 애플은 자기 슈퍼타원 마스크를 씌웁니다. **절대 미리 라운드를 굽지 마세요.** 이중 마스킹으로 가장자리에 틈이 생깁니다.
- 업로드 거절 1위 원인이 알파 채널입니다. 파일을 다시 편집·재저장했다면 아래로 검증하세요.

```bash
python3 -c "from PIL import Image; im=Image.open('AppIcon-1024.png'); print(im.mode, im.size)"
# RGB (1024, 1024) 가 나와야 합니다. RGBA면 거절됩니다.
```

---

## 6. Android

### 6-1. 스토어 등록 아이콘
```
png/play/play-store-icon-512.png     512×512, 5KB (상한 1MB)
```
Play Console에 **앱 안에 넣지 말고** 별도 업로드합니다. 구글이 마스크를 씌우므로 라운드를 굽지 마세요.

### 6-2. 적응형 아이콘
```
android/mipmap-anydpi-v26/ic_launcher.xml        → res/mipmap-anydpi-v26/
android/mipmap-anydpi-v26/ic_launcher_round.xml  → res/mipmap-anydpi-v26/
android/values/ic_launcher_background.xml        → res/values/
png/android/mipmap-*/ic_launcher_foreground.png  → res/mipmap-*/
png/android/mipmap-*/ic_launcher_monochrome.png  → res/mipmap-*/
png/android/mipmap-*/ic_launcher.png             → res/mipmap-*/  (구버전 대비 레거시)
png/android/mipmap-*/ic_launcher_round.png       → res/mipmap-*/
```

- 캔버스 108dp(xxxhdpi 432px), 마스크로 보이는 영역은 가운데 72dp, **원형 마스크에서 확실히 살아남는 건 지름 66dp(264px)**입니다.
- 이 폴더의 foreground는 T를 안전원 안으로 줄여 넣었습니다. **실측: 가장 먼 불투명 픽셀이 중심에서 125.3px** (안전 한계 132px). 원·스퀴클·라운드사각·물방울 어느 마스크에서도 안 잘립니다.
- `monochrome` 레이어는 안드로이드 13 이상 테마 아이콘용입니다. 흰 단색 실루엣이고, 시스템이 벽지 색으로 칠합니다. 빼지 마세요 — 빼면 테마 아이콘 켠 사용자 홈 화면에서만 혼자 튑니다.
- 배경은 이미지가 아니라 **색(`#FF3B30`)** 입니다. PNG 배경 레이어를 따로 넣지 마세요.

> **가장자리를 뚫는 원래 디자인을 그대로 쓰고 싶다면** `svg/android-foreground-bleed.svg`가 있습니다. 마스크에 따라 가로획 끝이 잘립니다. 잘려도 T로는 읽히지만, 기본값은 안전한 쪽(`-safe`)으로 잡았습니다.

### 6-3. 알림 아이콘
```
png/android/drawable-*/ic_stat_potjob.png    24dp 기준
```
흰 실루엣 + 투명 배경. 안드로이드는 알림 아이콘을 단색으로 뭉갭니다. 컬러 아이콘을 쓰면 흰 사각형만 뜹니다.

---

## 7. 웹 / PWA

```
png/web/favicon-16.png
png/web/favicon-32.png
png/web/apple-touch-icon-180.png
png/web/icon-192.png
png/web/icon-512.png
png/web/icon-512-maskable.png     ← purpose: maskable 전용, T가 안쪽으로 들어가 있음
web/site.webmanifest
```

```html
<link rel="icon" href="/icons/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#FF3B30">
```

---

## 8. 워드마크 / 조합형 이미지

```
svg/wordmark-on-dark.svg       어두운 배경용 (PO·JOB 흰색, T 빨강)
svg/wordmark-on-light.svg      밝은 배경용 (PO·JOB 잉크, T 빨강)
svg/wordmark-mono-white.svg    단색 흰색 (사진 위, 1도 인쇄)
svg/wordmark-mono-ink.svg      단색 검정 (팩스, 흑백 문서)
svg/lockup-on-dark.svg         마크+워드마크 가로 조합
svg/lockup-on-light.svg
png/wordmark/*@1x,2x,3x.png    높이 96 / 192 / 288
png/lockup/*@1x,2x,3x.png      높이 120 / 240 / 360
```

앱 안에서는 **SVG를 쓰세요.** PNG는 SVG를 못 쓰는 자리(이메일 템플릿, 일부 스토어 배너)용 예비입니다.

---

## 9. 마크 단독

```
svg/mark-only-white.svg    배경 없는 흰 T
svg/mark-only-red.svg      배경 없는 빨강 T
svg/mark-only-ink.svg      배경 없는 잉크 T
svg/icon-master.svg        빨강 정사각 + 흰 T (모든 PNG의 원본)
svg/icon-preview-rounded.svg   라운드 적용 미리보기 — 배포용 아님
```

`icon-preview-rounded.svg`는 눈으로 확인하는 용도입니다. **스토어에 올리지 마세요.**

---

## 10. 제출 전 점검

- [ ] iOS 1024 PNG가 `RGB` 모드인가 (RGBA면 거절)
- [ ] iOS 아이콘에 직접 굽은 라운드가 없는가
- [ ] Play 512 PNG가 정확히 512×512, 1MB 이하인가
- [ ] `mipmap-anydpi-v26/ic_launcher.xml`에 foreground·background·monochrome 세 줄이 다 있는가
- [ ] foreground의 T가 안전원(중심에서 132px) 안에 있는가
- [ ] 알림 아이콘이 흰 실루엣 + 투명인가
- [ ] 아이콘을 48px로 줄여서 T가 읽히는가
- [ ] 라이트/다크 배경 양쪽에서 워드마크가 읽히는가

---

## 11. 다시 뽑아야 할 때

`build.py`와 `build2.py`가 들어 있습니다. 색이나 비례를 바꾸려면 `build.py` 위쪽 상수만 고치고 두 스크립트를 차례로 돌리면 전 사이즈가 다시 나옵니다.

```bash
pip install fonttools brotli cairosvg pillow
python3 build.py && python3 build2.py
```

`glyphs.json`은 Archivo 900 Italic에서 뽑은 "POTJOB" 여섯 글자의 아웃라인입니다. 워드마크를 바꿀 일이 없으면 건드릴 필요 없습니다.

---

## 12. 아직 안 정한 것

- **앱 이름 표기**: 로고는 붙여쓰기 `POTJOB`입니다. 스토어 앱 이름과 앱 내 표기도 붙여쓰기로 통일하세요. `POT JOB`과 섞어 쓰면 검색이 갈립니다.
- **스토어 스크린샷·피처 그래픽**: 이 폴더에 없습니다. 실제 화면이 나온 뒤에 만듭니다.
- **서비스 범위**: 지금 자료는 작업치료사·물리치료사 기준입니다. 병원 전 직군으로 넓히면 아이콘의 T와 이름 POT부터 다시 봐야 합니다.
