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
    'commChannels', 'commList', 'commRead', 'commWrite', 'commDelete', 'commReport',
    'adminCommList', 'adminCommHide',
    'commComment', 'commCommentDelete', 'commMine', 'commAvatars', 'commSetAvatar',
    'adminGetMenu', 'adminSaveMenu', 'starJob', 'myStars', 'naverLogin', 'naverExchange', 'hospByName'
  ];

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

    if (url.length > MAX_URL) {
      onErr(new Error('보내는 내용이 너무 깁니다. 글자 수를 줄여주세요.'));
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
