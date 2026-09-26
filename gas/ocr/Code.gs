/* PDF → 글자. 이것만 하는 Apps Script 입니다 (2026-09-26).
 *
 * ── 왜 따로 두나 ─────────────────────────────────────────────
 * 알리오 공고문은 거의 전부 **스캔 그림**입니다. 글자를 뽑으려면 OCR 이
 * 있어야 하는데, 구글 드라이브의 「문서로 변환」 이 그걸 해 줍니다.
 *
 * node 에서 바로 쓰려고 두 가지를 해 봤고 둘 다 막혔습니다 —
 *   · **서비스 계정** — 제 드라이브 용량이 0 입니다. 폴더를 공유받아도
 *     올린 파일의 주인이 서비스 계정이라 403 storageQuotaExceeded.
 *     공유 드라이브가 있으면 풀리는데 개인 gmail 에는 없습니다.
 *   · **OAuth (세중님 계정)** — 됩니다. 다만 열쇠 세 개를 관리해야 하고,
 *     동의 화면이 「테스트」면 7일마다 죽습니다.
 *
 * Apps Script 는 **세중님 계정으로 그냥 돕니다.** 열쇠 관리가 없습니다.
 *
 * ── 이 프로젝트는 wage.js 와 **다른 프로젝트**입니다 ─────────
 * 수집기(gas/wage.js)는 동결이고, 이건 OCR 만 합니다. 섞지 않습니다.
 * 그래서 이 파일은 **저장소에 올립니다** — 열쇠가 한 줄도 없습니다.
 *
 * ── 비밀값 ───────────────────────────────────────────────────
 * 스크립트 속성 `OCR_KEY`. 코드에 안 적습니다.
 *   편집기 → 프로젝트 설정(톱니) → 스크립트 속성 → 속성 추가
 * 같은 값을 GitHub Secret `OCR_KEY` 에 넣습니다.
 *
 * ── 배포 ─────────────────────────────────────────────────────
 * 배포 → 새 배포 → 웹 앱 · 실행 「나」 · 액세스 「모든 사용자」
 * 그 주소를 GitHub Secret `OCR_GAS_URL` 에 넣습니다.
 * 「모든 사용자」 여도 OCR_KEY 를 모르면 401 입니다.
 */

/** 한 번에 받을 수 있는 크기 — 50MB 요청 한도 안에서 넉넉히 */
var 최대바이트 = 20 * 1024 * 1024;

function doPost(e) {
  var 시작 = Date.now();
  try {
    var 몸 = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    /* ① 비밀값부터. 틀리면 아무것도 안 합니다 */
    var 참열쇠 = PropertiesService.getScriptProperties().getProperty('OCR_KEY');
    if (!참열쇠) return 답_(500, { error: '서버에 OCR_KEY 가 없습니다 (스크립트 속성에 넣어주세요)' });
    if (String(몸.key || '') !== 참열쇠) return 답_(401, { error: '열쇠가 맞지 않습니다' });

    if (!몸.pdf) return 답_(400, { error: 'pdf(base64) 가 없습니다' });

    /* ② base64 → 알맹이 */
    var bytes;
    try { bytes = Utilities.base64Decode(몸.pdf); }
    catch (err) { return 답_(400, { error: 'base64 를 못 풉니다: ' + err.message }); }
    if (bytes.length > 최대바이트) {
      return 답_(413, { error: '너무 큽니다 (' + bytes.length + '바이트)' });
    }

    /* ③ **정말 PDF 인지 봅니다.** 주소가 틀리면 HTML 이 옵니다.
          그걸 드라이브에 올리면 「OCR is not supported for files of type text/html」 */
    var 앞 = '';
    for (var i = 0; i < 5 && i < bytes.length; i++) {
      var b = bytes[i]; 앞 += String.fromCharCode(b < 0 ? b + 256 : b);
    }
    if (앞 !== '%PDF-') {
      return 답_(400, { error: 'PDF 가 아닙니다 (앞 5글자 「' + 앞 + '」 · ' + bytes.length + '바이트)' });
    }

    var 이름 = String(몸.name || '공고문.pdf');
    var blob = Utilities.newBlob(bytes, 'application/pdf', 이름);

    /* ④ 올리면서 문서로 바꿉니다.
          **대상 mimeType 을 정하지 않습니다.** 정하고 OCR 을 같이 요청하면
          「OCR is not supported for files of type …document」 가 납니다.
          convert 로 「문서로 바꿔달라」 고만 해야 합니다 (수집기에서 배운 것) */
    var 만든것 = null, 글 = '';
    try {
      만든것 = Drive.Files.insert({ title: 이름 }, blob, { convert: true, ocrLanguage: 'ko' });
      글 = DocumentApp.openById(만든것.id).getBody().getText();
    } catch (err) {
      if (만든것 && 만든것.id) 지우기_(만든것.id);
      return 답_(500, { error: 'OCR 실패: ' + (err && err.message ? err.message : String(err)) });
    }

    /* ⑤ **바로 지웁니다.** 세중님 드라이브에 쌓이면 안 됩니다 */
    지우기_(만든것.id);

    return 답_(200, {
      ok: true,
      text: 글,
      chars: 글.length,
      hangul: (글.match(/[가-힣]/g) || []).length,
      ms: Date.now() - 시작
    });
  } catch (err) {
    return 답_(500, { error: '알 수 없는 실패: ' + (err && err.message ? err.message : String(err)) });
  }
}

/* 눌러서 되는지 보는 자리 — 「모든 사용자」 배포가 살아 있는지만 알려줍니다 */
function doGet() {
  return 답_(200, {
    ok: true,
    what: 'potjob OCR',
    열쇠있음: !!PropertiesService.getScriptProperties().getProperty('OCR_KEY')
  });
}

function 답_(code, 몸) {
  몸.status = code;
  return ContentService.createTextOutput(JSON.stringify(몸))
    .setMimeType(ContentService.MimeType.JSON);
}

function 지우기_(id) {
  try { Drive.Files.remove(id); }
  catch (e) {
    /* 휴지통으로라도 보냅니다 */
    try { DriveApp.getFileById(id).setTrashed(true); } catch (e2) {}
  }
}

/* ═══ 세중님이 편집기에서 한 번 실행하실 것 ═══
 *
 *  ① makeOcrKey()   — 비밀값을 만들어 스크립트 속성에 넣고 로그에 찍습니다.
 *                     그 값을 GitHub Secret `OCR_KEY` 에 넣으세요.
 *  ② testOcr()      — 작은 PDF 를 만들어 OCR 이 도는지 봅니다.
 *                     처음 실행할 때 권한 허용 창이 뜹니다. 그때 허용해 주세요.
 *
 *  ※ 밑줄로 끝나는 함수는 실행 목록에 안 뜹니다. 그래서 이 둘은 밑줄이 없습니다.
 */
function makeOcrKey() {
  var p = PropertiesService.getScriptProperties();
  var 있던것 = p.getProperty('OCR_KEY');
  if (있던것) {
    Logger.log('이미 있습니다. 같은 값을 GitHub Secret OCR_KEY 에 넣으세요:\n' + 있던것);
    return 있던것;
  }
  var 글자 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var 새것 = '';
  for (var i = 0; i < 40; i++) 새것 += 글자.charAt(Math.floor(Math.random() * 글자.length));
  p.setProperty('OCR_KEY', 새것);
  Logger.log('만들었습니다. 이 값을 GitHub Secret OCR_KEY 에 넣으세요:\n' + 새것);
  return 새것;
}

function testOcr() {
  /* 글자가 든 아주 작은 PDF 를 손으로 만들어 넣어 봅니다 */
  var pdf = '%PDF-1.4\n'
    + '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
    + '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
    + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 100]'
    + '/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n'
    + '4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n'
    + '5 0 obj<</Length 52>>stream\n'
    + 'BT /F1 24 Tf 20 40 Td (potjob OCR test) Tj ET\n'
    + 'endstream endobj\n'
    + 'trailer<</Root 1 0 R>>\n';
  var blob = Utilities.newBlob(pdf, 'application/pdf', 'potjob-ocr-test.pdf');
  var f = null;
  try {
    f = Drive.Files.insert({ title: 'potjob-ocr-test.pdf' }, blob, { convert: true, ocrLanguage: 'ko' });
    var t = DocumentApp.openById(f.id).getBody().getText();
    Logger.log('됐습니다. 읽어낸 글자 ' + t.length + '자:\n' + t.slice(0, 200));
    return t;
  } catch (e) {
    Logger.log('실패: ' + e.message);
    throw e;
  } finally {
    if (f && f.id) 지우기_(f.id);
  }
}
