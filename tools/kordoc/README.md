# 공고 첨부 읽기 도구 (kordoc) — 판을 못 박아 둔 폴더

공고 첨부(`.hwp` · `.hwpx` · `.pdf`)에서 글자와 **표**를 뽑습니다.
결과는 마크다운이고, 표가 파이프 표로 복원됩니다 —
그래서 「응시원서 접수 = 08.03~08.13」 처럼 **어느 날짜가 어느 칸의 것인지** 알 수 있습니다.
(기존 `~/hwp읽기` 의 `hwp5html` 은 칸 구분이 줄바꿈뿐이라 그걸 못 가립니다)

## 깔기

```
cd ~/potlab && git pull --ff-only
cd ~/potlab/tools/kordoc && npm ci
```

**손으로 폴더를 만들지 마십시오.** 설정은 저장소에 있습니다 (2026-10-07 세중님 지시).

## 왜 이 폴더에 .npmrc 가 있나

```
omit=optional        kordoc 의 optionalDependencies 에 onnxruntime-node(287MB)와
                     @huggingface/transformers 가 있습니다. 둘 다 OCR 쪽이고 안 씁니다.
                     ★ 명령줄에 --omit=optional 을 한 번만 쓰면 **두 번째 npm install
                       에서 되돌아옵니다.** 2026-10-07 에 그렇게 되돌아왔습니다
ignore-scripts=true  onnxruntime-node 의 postinstall 이 Nuget 피드에서 CUDA 바이너리를
                     **내려받아 파일로 씁니다.** 그 스크립트가 아예 안 돌게 막습니다
                     (kordoc 자체에는 설치 스크립트가 하나도 없습니다)
```

## 쓰기

```
node node_modules/kordoc/dist/cli.js <파일> [-o 나올파일]
node node_modules/kordoc/dist/cli.js <파일> --format json
```

**★ `--ocr` 과 `--formula-ocr` 은 쓰지 마십시오.** 첫 사용 때 모델을 내려받습니다
(PP-OCRv5 약 18MB · 수식 약 155MB). 그림으로만 된 공고는 Claude 에 그림을 그대로
보내는 쪽으로 정했습니다 — `읽기구조_설계안_2026-10-07.md` 2절.

## 판

```
kordoc      4.19.1   MIT  node>=20   (반년에 161판이 나왔습니다 — 꼭 못 박아 둡니다)
pdfjs-dist  4.10.38  Apache-2.0      PDF 를 읽으려면 있어야 합니다.
                                     없으면 「PDF 파싱에 pdfjs-dist가 필요합니다」 로 멈춥니다
```

판을 올릴 때는 `읽기_시험문제.md` 의 아홉 문제를 먼저 돌리십시오.

## 시험 결과

`첨부읽기_kordoc시험_2026-10-07.md` 에 열 건의 비교가 있습니다.
