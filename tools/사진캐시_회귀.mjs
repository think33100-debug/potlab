// 오프라인 실제 GET 회귀: 외부 모듈/네트워크 대신 VM 안에 모의 객체만 주입한다.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const candidates = [
  new URL('../web/node_modules/typescript/lib/typescript.js', import.meta.url),
  new URL('file:///C:/Users/홈스테드/Desktop/RAPO/potlab/web/node_modules/typescript/lib/typescript.js'),
];
const compiler = candidates.find(path => existsSync(path));
assert.ok(compiler, '설치된 TypeScript가 필요합니다 (설치/네트워크 사용 안 함)');
const ts = require(fileURLToPath(compiler));
const source = readFileSync(new URL('../web/app/api/post-image/[post]/[idx]/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

let externalAttempts = 0;
let checks = 0;
let failures = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { externalAttempts++; throw new Error('외부 호출 차단'); };
const photo = { 큰것: 'synthetic-author/42/large.webp', 작은것: 'synthetic-author/42/thumb.webp' };
const cases = [
  { name: '400-post', post: 'invalid', status: 400, body: '잘못된 주소', rpc: 0 },
  { name: '400-idx', idx: '-1', status: 400, body: '잘못된 주소', rpc: 0 },
  { name: '400-idx-upper', idx: '100', status: 400, body: '잘못된 주소', rpc: 0 },
  { name: '400-fraction', idx: '0.5', status: 400, body: '잘못된 주소', rpc: 0 },
  { name: '404-empty', data: [], status: 404, body: '없는 사진' },
  { name: '404-null', data: null, status: 404, body: '없는 사진' },
  { name: '404-index', idx: '1', status: 404, body: '없는 사진' },
  { name: '502-upstream', ok: false, status: 502, body: '사진을 못 읽었어요', fetch: 1 },
  { name: '502-no-body', emptyBody: true, status: 502, body: '사진을 못 읽었어요', fetch: 1 },
  { name: '200-type', status: 200, fetch: 1, type: 'image/png' },
  { name: '200-fallback', status: 200, fetch: 1 },
];

try {
  for (const thumbnail of [false, true]) {
    for (const test of cases) {
      const label = `${thumbnail ? '썸네일' : '큰사진'} ${test.name}`;
      const rpcCalls = [];
      const fetchCalls = [];
      const upstreamBody = new Uint8Array([1, 2, 3]);
      class NextResponse {
        constructor(body, init) {
          this.body = body;
          this.status = init.status;
          this.headers = new Headers(init.headers);
        }
      }
      const exports = {};
      const context = vm.createContext({
        exports, URL, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://storage.invalid' } },
        require(name) {
          if (name === 'next/server') return { NextResponse };
          if (name === '@/lib/supabase') return { supabase: { rpc: async (name, args) => {
            rpcCalls.push({ name, args });
            return { data: Object.hasOwn(test, 'data') ? test.data : [photo] };
          } } };
          externalAttempts++;
          throw new Error('외부 모듈 차단');
        },
        fetch: async (url, init) => {
          fetchCalls.push({ url, init });
          return { ok: test.ok ?? true, body: test.emptyBody ? null : upstreamBody,
            headers: new Headers(test.type ? { 'content-type': test.type } : {}) };
        },
      });
      vm.runInContext(compiled, context, { filename: 'post-image-route.cjs' });
      const response = await exports.GET({ url: `https://app.invalid/api/post-image/42/0${thumbnail ? '?t=1' : ''}` },
        { params: Promise.resolve({ post: test.post ?? '42', idx: test.idx ?? '0' }) });
      const verify = (name, run) => {
        checks++;
        try { run(); } catch { failures++; console.log(`FAIL ${label}: ${name}`); }
      };
      verify('status', () => assert.equal(response.status, test.status));
      verify('Cache-Control private, no-store', () => assert.equal(response.headers.get('cache-control'), 'private, no-store'));
      verify('RPC count', () => assert.equal(rpcCalls.length, test.rpc ?? 1));
      for (const call of rpcCalls) {
        verify('RPC contract', () => {
          assert.equal(call.name, '글사진');
          assert.equal(JSON.stringify(call.args), '{"p_post":42}');
        });
      }
      verify('fetch count', () => assert.equal(fetchCalls.length, test.fetch ?? 0));
      for (const call of fetchCalls) {
        verify('fetch cache:no-store', () => assert.equal(call.init?.cache, 'no-store'));
        verify('synthetic image selection', () => assert.equal(call.url,
          `https://storage.invalid/storage/v1/object/public/post-images/${thumbnail ? photo.작은것 : photo.큰것}`));
      }
      verify('body unchanged', () => assert.equal(response.body, test.status === 200 ? upstreamBody : test.body));
      if (test.status === 200) verify('Content-Type', () => assert.equal(response.headers.get('content-type'), test.type ?? 'image/webp'));
    }
  }
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(externalAttempts, 0);
console.log(`실제 Supabase/Storage 호출 0; 외부 호출 시도 ${externalAttempts}; 모의 객체만 주입`);
console.log(`${failures ? 'RED' : 'GREEN'}: 22 GET 사례, ${checks} 검사, 실패 ${failures}`);
if (failures) process.exitCode = 1;
