# gas_백업_0925 를 저장소 밖으로 (세중님이 하실 일)

2026-09-25 밤에 정리했습니다. **옮기는 것은 세중님이 하십니다** — 여기는 안내만 있습니다.

---

## 먼저, 지금 새고 있지는 않습니다

```
git ls-files | grep gas_백업      → 0줄   (한 번도 안 올라갔습니다)
git check-ignore -v gas_백업_0925/wage.js
   → .gitignore:31  gas_백업_*/
```

`.gitignore` 31줄이 막고 있습니다. **지금 당장 새는 것은 아닙니다.**

## 그런데도 옮기는 까닭

이 저장소는 **공개**입니다 (potjob.co.kr 이 GitHub Pages 로 여기서 나갑니다).
그 안에 열쇠가 든 폴더를 두면, 막는 것이 `.gitignore` 한 줄뿐입니다.

```
gas_백업_0925/wage.js      열쇠처럼 보이는 자리 37곳
gas_백업_0925/creds.json   clasp 자격증명 (395바이트)
```

`.gitignore` 를 누가 고치거나, `git add -f` 를 한 번 잘못 치거나,
폴더 이름을 `gas_backup_0925` 처럼 바꾸면 **그날로 공개됩니다.**
`gas_백업_*` 라는 이름에 기대고 있는 셈입니다.

한 번 올라가면 커밋을 지워도 GitHub 캐시·포크·크롤러에 남습니다.
**저장소 밖에 두면 실수할 자리 자체가 없어집니다.**

---

## 옮길 자리 — 여기를 권합니다

```
C:\Users\think\potjob-비밀\gas_백업_0925\
```

저장소 밖이고 **OneDrive 밖**입니다. `creds.json` 은 클라우드에 올릴 이유가
없는 자격증명입니다.

### 옮기는 법 (PowerShell 한 줄)

```powershell
New-Item -ItemType Directory -Force "C:\Users\think\potjob-비밀" | Out-Null
Move-Item "C:\Users\think\OneDrive\바탕 화면\potjob\potlab\gas_백업_0925" "C:\Users\think\potjob-비밀\"
```

옮긴 뒤 확인 —

```powershell
Test-Path "C:\Users\think\potjob-비밀\gas_백업_0925\wage.js"   # True 여야 합니다
Test-Path "C:\Users\think\OneDrive\바탕 화면\potjob\potlab\gas_백업_0925"   # False 여야 합니다
```

### 백업도 클라우드에 두고 싶으시면

```
C:\Users\think\OneDrive\potjob-비밀\gas_백업_0925\
```

저장소 밖이긴 합니다. 다만 `creds.json` 이 OneDrive 로 올라갑니다.
**그럴 거면 creds.json 만 빼고 옮기시는 편이 낫습니다** — 그 파일은
`clasp login` 을 다시 하면 새로 만들어집니다.

---

## 옮긴 뒤에 할 일

**아무것도 없습니다.** 백업 폴더를 쓰는 코드가 없습니다.

```
grep -rn "gas_백업" --include=*.js --include=*.ps1 --include=*.ts .   → 0줄
```

`push.ps1` 은 `gas/` 폴더 안의 것을 씁니다 (`Set-Location $PSScriptRoot`).
백업 폴더와 상관없습니다.

`.gitignore` 의 `gas_백업_*/` 줄은 **그대로 두세요.** 나중에 또 백업을 뜰 때
저장소 안에 잠깐 생기더라도 막아 줍니다.

---

## 남는 것 — gas/ 폴더

`gas/` 도 같은 열쇠가 들어 있고 같은 이유로 `.gitignore` 한 줄에 기대고 있습니다.
다만 이쪽은 **clasp 가 그 자리를 알아야 해서** 옮기면 `push.ps1` 도 같이
고쳐야 합니다. 백업과 달리 간단하지 않습니다.

지금 당장 할 일은 아니고, 언젠가 손볼 때 같이 보면 됩니다.
