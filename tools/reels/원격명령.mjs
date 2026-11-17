/* 릴스 원격 명령 문지기 — GitHub Actions 「릴스 원격」이 ssh 로 들어오면 이것만 돕니다 (2026-11-17 세중님 「닿을 수 있게 해봐」)

   서버 ~/.ssh/authorized_keys 의 그 열쇠 줄 앞에 강제 명령을 겁니다 —
     command="cd ~/potlab && node tools/reels/원격명령.mjs",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA… rapo-reels-gha
   그러면 이 열쇠로는 서버 셸을 못 열고, 아래 네 가지만 됩니다. 들어온 글은 SSH_ORIGINAL_COMMAND 로 받습니다.

     목록                 확인 대기 중인 릴스        node tools/reels/올리기.mjs --목록
     확인 <공고id>        올리기 마른 실행           node tools/reels/올리기.mjs --id <공고id>
     올리기 <공고id>      인스타에 올림              node tools/reels/올리기.mjs --id <공고id> --실행
     만들기 <공고id>      그 공고 릴스를 만들어 메일  node tools/reels/run.mjs --메일 --id <공고id>
   (영어 낱말 list · check · publish · make 도 같은 뜻)

   공고id 는 영문·숫자·-·_ 만 받습니다 (셸로 넘기지 않고 인수 배열로 넘깁니다).
   돌 때마다 log/릴스_원격.log 에 한 줄 (때 · 할일 · 공고id · 끝난 코드) */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(여기, '..', '..');

const 할일표 = {
  목록: (id) => (id ? null : ['tools/reels/올리기.mjs', '--목록']),
  확인: (id) => (id ? ['tools/reels/올리기.mjs', '--id', id] : null),
  올리기: (id) => (id ? ['tools/reels/올리기.mjs', '--id', id, '--실행'] : null),
  만들기: (id) => (id ? ['tools/reels/run.mjs', '--메일', '--id', id] : null),
  카드확인: (id) => (id ? ['tools/reels/올리기.mjs', '--id', id, '--카드'] : null),
  /* 브랜드 카드 — id 자리에 판 이름(intro · story). 비우면 intro */
  브랜드확인: (id) => ['tools/reels/브랜드카드.mjs', ...(id ? ['--판', id] : [])],
  브랜드올리기: (id) => ['tools/reels/브랜드카드.mjs', '--실행', ...(id ? ['--판', id] : [])],
  브랜드바꾸기: (id) => ['tools/reels/브랜드카드.mjs', '--바꾸기', ...(id ? ['--판', id] : [])],
  브랜드댓글: (id) => ['tools/reels/브랜드카드.mjs', '--댓글만', ...(id ? ['--판', id] : [])],
  /* 댓글 「링크」 → DM (2026-11-17 ㉠) — id 없음 */
  디엠확인: (id) => (id ? null : ['tools/reels/댓글링크.mjs']),
  디엠보내기: (id) => (id ? null : ['tools/reels/댓글링크.mjs', '--실행']),
  /* 게시물 단어 정하기 — id = 게시물 짧은주소 · 셋째 낱말 = 단어(또는 - 지우기). 없으면 목록 */
  디엠단어: (id, 단어) => (!id ? ['tools/reels/댓글링크.mjs', '--단어목록'] : 단어 ? ['tools/reels/댓글링크.mjs', '--단어', id, 단어] : null),
  카드올리기: (id) => (id ? ['tools/reels/올리기.mjs', '--id', id, '--카드', '--실행'] : null),
  /* 당기기 — 서버 코드를 main 에 맞춤 (지침 8-10: 서버 반영은 git pull 로만). node 가 아니라 git 이라 따로 돌립니다 */
  당기기: (id) => (id ? null : ['git', 'pull', '--ff-only']),
};
const 영어 = { list: '목록', check: '확인', publish: '올리기', make: '만들기', pull: '당기기', 'check-cards': '카드확인', 'publish-cards': '카드올리기', 'brand-check': '브랜드확인', 'brand-publish': '브랜드올리기', 'brand-replace': '브랜드바꾸기', 'brand-comment': '브랜드댓글', 'dm-check': '디엠확인', 'dm-send': '디엠보내기', 'dm-word': '디엠단어' };

/** 들어온 글 → { 할일, id, 인수 } 또는 { 거절 } — 시험할 수 있게 갈라 둠 */
export function 풀기(글) {
  const 낱 = String(글 || '').trim().split(/\s+/).filter(Boolean);
  const 할일 = 영어[낱[0]] || 낱[0];
  if (낱.length < 1 || 낱.length > (할일 === '디엠단어' ? 3 : 2)) return { 거절: '「할일 [공고id]」 꼴만 받습니다' };
  const id = 낱[1] || null;
  const 단어 = 낱[2] || null;
  if (단어 && !/^([가-힣A-Za-z0-9]{1,20}|-)$/.test(단어)) return { 거절: '단어는 한글·영문·숫자 1~20자 (지우기는 -)' };
  if (!할일표[할일]) return { 거절: `모르는 할일 「${낱[0]}」 — 목록 · 확인 · 올리기 · 만들기 · 당기기 · 카드확인 · 카드올리기 · 브랜드확인 · 브랜드올리기 · 브랜드바꾸기 · 브랜드댓글 · 디엠확인 · 디엠보내기 · 디엠단어` };
  if (id && !/^[A-Za-z0-9_-]{1,40}$/.test(id)) return { 거절: '공고id 는 영문·숫자·-·_ 만' };
  const 인수 = 할일표[할일](id, 단어);
  if (!인수) return { 거절: 할일 === '디엠단어' ? '디엠단어에는 게시물 짧은주소와 단어가 함께 필요합니다' : ['목록', '당기기', '디엠확인', '디엠보내기'].includes(할일) ? `${할일}에는 공고id 를 붙이지 않습니다` : `${할일}에는 공고id 가 필요합니다` };
  return { 할일, id, 인수 };
}

function 자기점검() {
  const 틀림 = []; const 봐 = (n, c) => { console.log((c ? '○ ' : '✗ ') + n); if (!c) 틀림.push(n); };
  봐('목록', 풀기('목록').인수?.join(' ') === 'tools/reels/올리기.mjs --목록');
  봐('올리기 + id', 풀기('올리기 306973-PT').인수?.join(' ') === 'tools/reels/올리기.mjs --id 306973-PT --실행');
  봐('영어 publish 도 같음', 풀기('publish HS123').할일 === '올리기');
  봐('만들기', 풀기('만들기 306973-PT').인수?.[0] === 'tools/reels/run.mjs');
  봐('확인은 --실행 없음', !풀기('확인 A1').인수.includes('--실행'));
  봐('거절 — 셸 글자', !!풀기('올리기 A1;rm').거절 && !!풀기('올리기 $(id)').거절 && !!풀기('올리기 `id`').거절);
  봐('거절 — 낱말 셋 이상', !!풀기('올리기 A1 --x').거절);
  봐('거절 — 모르는 할일', !!풀기('bash').거절 && !!풀기('').거절);
  봐('거절 — id 없는 올리기 · id 붙은 목록', !!풀기('올리기').거절 && !!풀기('목록 A1').거절);
  봐('카드올리기 — --카드 --실행', 풀기('publish-cards A1').인수?.join(' ') === 'tools/reels/올리기.mjs --id A1 --카드 --실행' && !풀기('check-cards A1').인수.includes('--실행'));
  봐('브랜드올리기 — 판 없으면 intro · 판 있으면 --판', 풀기('brand-publish').인수?.join(' ') === 'tools/reels/브랜드카드.mjs --실행' && 풀기('brand-publish story').인수?.join(' ') === 'tools/reels/브랜드카드.mjs --실행 --판 story');
  봐('당기기 — git pull --ff-only · id 붙으면 거절', 풀기('당기기').인수?.join(' ') === 'git pull --ff-only' && 풀기('pull').할일 === '당기기' && !!풀기('당기기 main').거절);
  봐('디엠 — id 없음 · 보내기는 --실행', 풀기('dm-check').인수?.join(' ') === 'tools/reels/댓글링크.mjs' && 풀기('dm-send').인수?.join(' ') === 'tools/reels/댓글링크.mjs --실행' && !!풀기('dm-send A1').거절);
  봐('디엠단어 — 짧은주소 + 단어 · 셸 글자 거절 · 비우면 목록', 풀기('dm-word Df1jEuVn4OG 이벤트').인수?.join(' ') === 'tools/reels/댓글링크.mjs --단어 Df1jEuVn4OG 이벤트' && !!풀기('dm-word Df1jEuVn4OG a;b').거절 && 풀기('dm-word').인수?.includes('--단어목록') && !!풀기('dm-word Df1jEuVn4OG').거절 && !!풀기('check A1 B2').거절);
  console.log(`\n견본 ${틀림.length ? '✗ 틀림 ' + 틀림.length : '틀림 0'}`);
  if (틀림.length) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--자기점검')) { 자기점검(); process.exit(0); }
  const 글 = process.env.SSH_ORIGINAL_COMMAND ?? process.argv.slice(2).join(' ');
  const 줄 = 풀기(글);
  const 기록 = (o) => { fs.mkdirSync(path.join(ROOT, 'log'), { recursive: true }); fs.appendFileSync(path.join(ROOT, 'log', '릴스_원격.log'), JSON.stringify({ 때: new Date().toISOString(), ...o }) + '\n'); };
  if (줄.거절) { console.error('✗ 거절 — ' + 줄.거절); 기록({ 글: String(글).slice(0, 80), 거절: 줄.거절 }); process.exit(2); }
  console.log(`▶ ${줄.할일}${줄.id ? ' ' + 줄.id : ''} · 서버 ${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')} KST`);
  const [머리, ...나머지] = 줄.인수[0] === 'git' ? 줄.인수 : [process.execPath, ...줄.인수];
  const r = spawnSync(머리, 나머지, { cwd: ROOT, stdio: 'inherit' });
  if (줄.할일 === '당기기' && r.status === 0) spawnSync('git', ['log', '--oneline', '-1'], { cwd: ROOT, stdio: 'inherit' });
  기록({ 할일: 줄.할일, id: 줄.id, 코드: r.status });
  process.exit(r.status ?? 1);
}
