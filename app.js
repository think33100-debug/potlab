/* ============================================================
 * POT JOB — GitHub Pages ↔ Apps Script 연결
 * ------------------------------------------------------------
 * 화면 코드는 google.script.run 을 그대로 씁니다.
 * 이 파일이 그 호출을 Apps Script 주소로 넘겨주는 다리 역할을 합니다.
 *
 * [설정] 아래 API_URL 만 본인 배포 주소로 바꾸세요.
 *        Apps Script → 배포 → 웹 앱 → 액세스: 모든 사용자
 * ============================================================ */

var API_URL = 'https://script.google.com/macros/s/AKfycbxNKMarYQIwgcz5jHcn-dHYtSeIQpBmt0rGvhlWpTrLwS1x5C3l3_HxvZgjVQUxYwnR/exec';

/* 이 파일이 최신인지 화면 아래에서 바로 확인하려고 둡니다.
   index.html 이 이 값을 읽어 버전과 함께 찍습니다. */
var APP_JS_VER = 'a20 · 2026-09-06';

(function () {
  'use strict';

  var seq = 0;
  var TIMEOUT = 25000;          // 25초 넘으면 실패로 처리
  var MAX_URL = 7500;           // 주소가 너무 길면 서버가 거부합니다

  /* 화면에서 부르는 서버 함수 목록 — Wage.gs 의 API 와 같아야 합니다 */
  var METHODS = [
    'getBrand', 'getJobPosts', 'getNoti', 'saveNoti', 'countNewJobs',
    'getPreview', 'getPublicSummary', 'countByJob', 'totalCount', 'checkNick',
    'submitWage', 'kakaoLogin', 'kakaoExchange', 'kakaoMe', 'getStats', 'getResultBundle',
    'getMyPosition', 'getHourly', 'getSpecMatch', 'getCardData', 'getStudentResult',
    'getStudentCard', 'getMoveEstimate', 'calcSalary', 'searchHospital', 'suggestHospitals',
    'hospitalDetail', 'compareHospitals', 'topHospitals', 'jobRegionSummary', 'regionHospitals',
    'densityTable', 'regionOverview', 'regionDetail', 'regionSggHospitals', 'submitFeedback', 'adminList',
    'adminToggle', 'adminEditSalary', 'adminGetBanners', 'adminSaveBanners',
    'commChannels', 'commOpen', 'commList', 'commRead', 'commWrite', 'commDelete', 'commReport',
    'adminCommList', 'adminCommHide',
    'commComment', 'commCommentDelete', 'commLike', 'commMine', 'commAvatars', 'commSetAvatar',
    'adminGetMenu', 'adminSaveMenu', 'adminAccessLog', 'starJob', 'myStars', 'naverLogin', 'naverExchange', 'hospByName', 'jobOne', 'getEdu',
    'adminJobList', 'adminJobGet', 'adminJobFix', 'adminJobHide', 'adminJobHideMany', 'adminRefixMixed', 'adminGetSchedule', 'adminSaveSchedule', 'adminRefresh', 'adminGetTexts', 'adminSaveTexts',
    'bizMe', 'bizSignup', 'bizSendCode', 'bizVerify', 'bizPostJob', 'bizDocUrl', 'volList', 'volCenters', 'wfList', 'wfOne', 'vcList', 'vcOne',
    'adminBizList', 'adminBizVerify', 'serverVersion',
    'bigPut', 'bigRun'
  ];

  /* ※ 서버(Wage.gs)에 함수를 새로 만들면 위 목록에도 반드시 넣어야 합니다.
        여기 없는 이름은 화면에서 부를 수가 없습니다 —
        오류도 안 나고 그냥 아무 일도 안 일어납니다. 찾기 어려운 사고입니다. */

  var CHUNK = 600;              // 조각 하나에 담을 글자 수
                                // 한글은 주소에서 9배로 부풉니다. 600자가 전부 한글이어도
                                // 주소는 5,700자로 한도(7,500) 안쪽입니다.

  /** 긴 자료를 조각내어 보낸 뒤 한 번에 처리시킵니다 */
  function sendBig(action, args, onOk, onErr) {
    var body;
    try { body = JSON.stringify(args || []); }
    catch (e) { onErr(new Error('보낼 자료를 만들지 못했습니다.')); return; }

    var id = 'B' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    var parts = [];
    for (var p = 0; p < body.length; p += CHUNK) parts.push(body.slice(p, p + CHUNK));

    /* 조각을 하나씩 차례로 보내면 조각 수만큼 기다립니다.
       한꺼번에 띄워 보내고 다 도착하면 처리시킵니다. */
    var left = parts.length, failed = false;
    parts.forEach(function (p, n) {
      call('bigPut', [id, n, parts.length, p], function (r) {
        if (failed) return;
        if (!r || !r.ok) {
          failed = true;
          onErr(new Error((r && r.message) || '보내지 못했습니다.'));
          return;
        }
        left--;
        if (left === 0) call('bigRun', [id, action], onOk, onErr);
      }, function (e) {
        if (failed) return;
        failed = true;
        onErr(e);
      });
    });
  }

  /** 브라우저가 막지 않는 방식(JSONP)으로 요청합니다 */
  function call(action, args, onOk, onErr) {
    if (!API_URL || API_URL.indexOf('/exec') < 0) {
      onErr(new Error('API_URL 이 올바르지 않습니다. app.js 를 확인해주세요.'));
      return;
    }

    var name = '__potlab_cb_' + (++seq) + '_' + Date.now();   // 서버가 이 형식만 허용합니다
    var url = API_URL
      + (API_URL.indexOf('?') > -1 ? '&' : '?')
      + 'callback=' + name
      + '&action=' + encodeURIComponent(action)
      + '&args=' + encodeURIComponent(JSON.stringify(args || []))
      + '&t=' + Date.now();

    /* 주소가 길면 조각내어 보냅니다.
     *
     * 한글은 주소에서 한 글자가 9자로 부풉니다. 메뉴 25개면 8,400자,
     * 문구 153개면 22,800자가 되어 한도(7,500자)를 넘습니다.
     * 예전에는 여기서 「너무 깁니다」 를 띄우고 끝냈습니다 —
     * 서버까지 가지도 못했고, 무엇이 문제인지도 알 수 없었습니다.
     *
     * form + iframe 도 해봤지만 안 됐습니다. Apps Script 는 응답을
     * 다른 주소로 넘기는데, 브라우저가 그 내용을 읽지 못하게 막습니다.
     *
     * 그래서 지금 쓰는 이 길(JSONP)을 그대로 쓰되, 자료만 나눠 보냅니다.
     *   1) 조각을 하나씩 서버에 쌓아두고
     *   2) 다 쌓이면 「이제 처리해라」 한 번 부릅니다
     */
    if (url.length > MAX_URL) {
      sendBig(action, args, onOk, onErr);
      return;
    }

    var script = document.createElement('script');
    var timer = setTimeout(function () {
      cleanup();
      onErr(new Error('응답이 없습니다. 잠시 후 다시 시도해주세요.'));
    }, TIMEOUT);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[name]; } catch (e) { window[name] = undefined; }
      if (script && script.parentNode) script.parentNode.removeChild(script);
    }

    window[name] = function (res) {
      cleanup();
      if (res && res.ok) onOk(res.data);
      else onErr(new Error((res && res.error) || '알 수 없는 오류'));
    };

    script.src = url;
    script.async = true;
    script.onerror = function () {
      cleanup();
      onErr(new Error('서버에 연결하지 못했습니다.'));
    };
    document.head.appendChild(script);
  }

  /* google.script.run 과 같은 모양으로 감쌉니다 */
  function makeRunner(okFn, errFn) {
    var runner = {
      withSuccessHandler: function (f) { return makeRunner(f, errFn); },
      withFailureHandler: function (f) { return makeRunner(okFn, f); }
    };
    METHODS.forEach(function (m) {
      runner[m] = function () {
        var args = Array.prototype.slice.call(arguments);
        call(m, args,
          function (data) { if (okFn) okFn(data); },
          function (err) {
            if (errFn) errFn(err);
            else if (window.console) console.error(m, err);
          });
      };
    });
    return runner;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeRunner(null, null);

  /* Apps Script 에만 있는 것들 흉내 */
  window.google.script.host = {
    close: function () {},
    setHeight: function () {},
    origin: location.origin
  };
})();
