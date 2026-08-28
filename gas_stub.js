/* ============================================================
 * gas_stub.js — Apps Script 흉내
 * ------------------------------------------------------------
 * Wage.gs 를 노트북에서 그대로 돌리기 위한 가짜 구글 환경입니다.
 * 시트는 메모리 배열로 만들고, 메일·외부호출은 기록만 남깁니다.
 * 서버 코드를 고치지 않고 진짜 로직을 그대로 시험하는 것이 목적입니다.
 * ============================================================ */
const fs = require('fs');
const path = require('path');

function makeSheet(name, rows) {
  const data = rows ? rows.map(r => r.slice()) : [];
  const sh = {
    _name: name,
    _data: data,
    getName: () => name,
    getLastRow: () => data.length,
    getLastColumn: () => data.reduce((m, r) => Math.max(m, r.length), 0),
    appendRow(r) { data.push(r.slice()); return sh; },
    clear() { data.length = 0; return sh; },
    getRange(row, col, nRow, nCol) {
      nRow = nRow || 1; nCol = nCol || 1;
      return {
        getValues() {
          const out = [];
          for (let i = 0; i < nRow; i++) {
            const src = data[row - 1 + i] || [];
            const line = [];
            for (let j = 0; j < nCol; j++) {
              const v = src[col - 1 + j];
              line.push(v === undefined ? '' : v);
            }
            out.push(line);
          }
          return out;
        },
        getValue() { return this.getValues()[0][0]; },
        setValues(vals) {
          vals.forEach((line, i) => {
            const ri = row - 1 + i;
            if (!data[ri]) data[ri] = [];
            line.forEach((v, j) => { data[ri][col - 1 + j] = v; });
          });
          return this;
        },
        setValue(v) { return this.setValues([[v]]); },
        setNumberFormat() { return this; },
        setFontWeight() { return this; },
        setBackground() { return this; }
      };
    },
    deleteRows(row, n) { data.splice(row - 1, n || 1); return sh; },
    deleteRow(row) { data.splice(row - 1, 1); return sh; },
    setFrozenRows() { return sh; },
    autoResizeColumns() { return sh; },
    getDataRange() { return sh.getRange(1, 1, Math.max(data.length, 1), sh.getLastColumn() || 1); }
  };
  return sh;
}

function makeEnv(opts) {
  opts = opts || {};
  const sheets = {};
  const log = { mail: [], fetch: [], toast: [] };

  const ss = {
    getSheetByName: n => sheets[n] || null,
    insertSheet(n) { sheets[n] = makeSheet(n, []); return sheets[n]; },
    getSheets: () => Object.keys(sheets).map(k => sheets[k]),
    getName: () => '가짜시트',
    toast: (m) => log.toast.push(m),
    getId: () => 'FAKE_SS_ID'
  };

  const g = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      openById: () => ss,
      flush: () => {}
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => true, waitLock: () => true, releaseLock: () => {}, hasLock: () => true
      })
    },
    CacheService: (() => {
      const store = {};
      const c = {
        get: k => (store[k] === undefined ? null : store[k]),
        put: (k, v) => { store[k] = v; },
        remove: k => { delete store[k]; },
        removeAll: ks => (ks || []).forEach(k => delete store[k]),
        getAll: ks => { const o = {}; (ks || []).forEach(k => { if (store[k] !== undefined) o[k] = store[k]; }); return o; },
        putAll: o => Object.keys(o).forEach(k => { store[k] = o[k]; })
      };
      return { getScriptCache: () => c, getUserCache: () => c, getDocumentCache: () => c };
    })(),
    PropertiesService: (() => {
      const store = {};
      const p = {
        getProperty: k => (store[k] === undefined ? null : store[k]),
        setProperty: (k, v) => { store[k] = String(v); return p; },
        deleteProperty: k => { delete store[k]; return p; },
        getProperties: () => Object.assign({}, store),
        setProperties: o => { Object.assign(store, o); return p; }
      };
      return { getScriptProperties: () => p, getUserProperties: () => p };
    })(),
    MailApp: {
      sendEmail: (a, b, c) => log.mail.push(typeof a === 'object' ? a : { to: a, subject: b, body: c }),
      getRemainingDailyQuota: () => 100
    },
    GmailApp: { sendEmail: (a, b, c) => log.mail.push({ to: a, subject: b, body: c }) },
    UrlFetchApp: {
      fetch: (url, o) => {
        log.fetch.push({ url, o });
        const hit = opts.fetch && opts.fetch(url, o);
        const body = hit === undefined ? '{}' : hit;
        return {
          getResponseCode: () => 200,
          getContentText: () => body,
          getBlob: () => ({ getBytes: () => [] })
        };
      }
    },
    ScriptApp: {
      getProjectTriggers: () => [],
      newTrigger: () => ({
        timeBased: () => ({
          everyHours: () => ({ create: () => {} }),
          everyDays: () => ({ atHour: () => ({ create: () => {} }) }),
          onWeekDay: () => ({ atHour: () => ({ create: () => {} }), create: () => {} })
        })
      }),
      deleteTrigger: () => {},
      WeekDay: { MONDAY: 'MON', SUNDAY: 'SUN' }
    },
    Session: {
      getScriptTimeZone: () => 'Asia/Seoul',
      getActiveUser: () => ({ getEmail: () => 'test@example.com' })
    },
    Utilities: {
      sleep: () => {},
      formatDate(d, tz, fmt) {
        // 서울 시간으로 맞춥니다
        const t = new Date(d.getTime() + 9 * 3600 * 1000);
        const p2 = n => String(n).padStart(2, '0');
        const map = {
          'yyyy-MM-dd HH:mm': `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())} ${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}`,
          'yyyy-MM-dd': `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`,
          'yyyyMMdd': `${t.getUTCFullYear()}${p2(t.getUTCMonth() + 1)}${p2(t.getUTCDate())}`,
          'yyyy.MM.dd': `${t.getUTCFullYear()}.${p2(t.getUTCMonth() + 1)}.${p2(t.getUTCDate())}`,
          'M월 d일': `${t.getUTCMonth() + 1}월 ${t.getUTCDate()}일`,
          'HH:mm': `${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}`
        };
        return map[fmt] !== undefined ? map[fmt] : t.toISOString();
      },
      getUuid: () => 'uuid-' + Math.random().toString(36).slice(2, 10),
      base64Encode: s => Buffer.from(String(s)).toString('base64'),
      base64Decode: s => Array.from(Buffer.from(String(s), 'base64')),
      computeDigest: () => [1, 2, 3],
      DigestAlgorithm: { MD5: 'MD5', SHA_256: 'SHA_256' },
      parseCsv: txt => txt.split(/\r?\n/).filter(Boolean).map(l => l.split(','))
    },
    HtmlService: {
      createHtmlOutputFromFile: () => ({
        setTitle() { return this; }, addMetaTag() { return this; },
        setXFrameOptionsMode() { return this; }, getContent: () => ''
      }),
      createHtmlOutput: (s) => ({
        setTitle() { return this; }, addMetaTag() { return this; },
        setXFrameOptionsMode() { return this; }, getContent: () => s
      }),
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }
    },
    ContentService: {
      createTextOutput: (s) => ({ _t: s, setMimeType() { return this; }, getContent: () => s }),
      MimeType: { JSON: 'JSON', JAVASCRIPT: 'JAVASCRIPT', TEXT: 'TEXT' }
    },
    Logger: { log: () => {} },
    console: console
  };

  return { g, ss, sheets, log, makeSheet };
}

/* Wage.gs 를 가짜 환경 안에서 실행하고, 안의 함수들을 꺼내옵니다 */
function loadServer(env, gsPath) {
  const vm = require('vm');
  let src = fs.readFileSync(gsPath, 'utf8');

  /* const 로 선언된 것은 전역에 안 붙습니다.
     이름을 모아 맨 끝에서 한 번에 꺼내옵니다. */
  const names = new Set();
  for (const m of src.matchAll(/^(?:function|const|let|var)\s+([A-Za-z_]\w*)/gm)) names.add(m[1]);

  const epilogue = '\n;globalThis.__SRV__ = {};\n'
    + [...names].map(n => `try{ __SRV__[${JSON.stringify(n)}] = ${n}; }catch(e){}`).join('\n');

  const ctx = vm.createContext(env.g);
  vm.runInContext(src + epilogue, ctx, { filename: 'Wage.gs' });
  return ctx.__SRV__;
}

module.exports = { makeEnv, makeSheet, loadServer };
