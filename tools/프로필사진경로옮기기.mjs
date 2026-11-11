/* 이미 올라간 프로필 사진을 새 경로로 옮깁니다 (2026-11-11).
 *
 *   node tools/프로필사진경로옮기기.mjs                          ← 마른 실행: 목록·개수만 찍습니다
 *   node tools/프로필사진경로옮기기.mjs --진짜                   ← 복사 + profiles.avatar 바꾸기
 *   node tools/프로필사진경로옮기기.mjs --옛파일 <되돌림.json>     ← 옛 파일 지우기 마른 실행
 *   node tools/프로필사진경로옮기기.mjs --옛파일 <되돌림.json> --진짜   ← 옛 파일 지우기
 *
 * 옛 꼴 `<회원uuid>/<시각>.webp` → 새 꼴 `a/<uuid>.webp` (web/lib/avatar-path.ts).
 * profiles.avatar 값 `u/<경로>|<바탕색>` 의 경로 조각만 바꾸고 바탕색은 그대로 둡니다
 * (web/lib/avatar.ts 의 parseAvatar · withPhoto 를 그대로 씁니다).
 *
 * ── 차례 (글 사진 옮기기와 같은 꼴) ─────────────────────────────
 *   ① 사진을 **복사**합니다 (옛 파일은 남깁니다)
 *   ② profiles 그 줄의 avatar 를 바꿉니다. `id` 와 **옛 avatar 값이 둘 다 맞을 때만**
 *      바꾸고, 바뀐 줄이 1 이 아니면 실패입니다 (작업지침 8-26).
 *      그 사이에 회원이 사진을 바꿨으면 0줄 → 그 줄은 건너뜁니다(회원 값이 이깁니다)
 *   ③ 한 줄 끝날 때마다 되돌림 목록을 `~/되돌림/프로필사진경로_<날짜>.json`·`.sql` 에
 *      **바로** 다시 씁니다 (8-19)
 *   ④ 옛 파일은 **확인 뒤** `--옛파일` 로 따로 지웁니다. 줄마다 DB 가 새 경로를
 *      가리키는지 · 새 파일이 열리는지를 다시 봅니다
 *
 * 마른 실행은 「아무 줄도 안 가리키는 옛 꼴 파일」 수도 셉니다 (전에 바꾼 사진들).
 *   이 도구는 그것을 **지우지 않습니다** — 셈만 찍습니다 (지울지는 세중님).
 */
import fs from 'node:fs';
import path from 'node:path';
import { 모두받기 } from './쪽나눠받기.mjs';
import { 연결, 복사, 열리나, 되돌림터, 날짜, sql문자, 파일지우기, 폴더목록 } from './저장경로옮기기_공용.mjs';
import { 새프로필사진경로, 새꼴, 옛꼴 } from '../web/lib/avatar-path.ts';
import { parseAvatar, withPhoto } from '../web/lib/avatar.ts';

const 통 = 'avatars';
const 진짜 = process.argv.includes('--진짜');
const 옛파일자리 = process.argv.indexOf('--옛파일');
const 옛파일모드 = 옛파일자리 >= 0;

const 잇기 = 연결();
const { URL_, H, 가림 } = 잇기;

/** 사진 줄이면 경로를, 아니면 null */
const 사진경로 = (값) => {
  if (typeof 값 !== 'string' || !값.startsWith('u/')) return null;
  const a = parseAvatar(값);
  return a.kind === 'photo' ? a.path : null;
};

/* ───────────────────────── 옮기기 ───────────────────────── */
async function 옮기기() {
  const 줄들 = await 모두받기(`${URL_}/rest/v1/profiles?select=id,avatar&avatar=like.u%2F*`, H, { 차례: 'id' });

  const 옛것 = [], 새것 = [], 모를것 = [];
  for (const r of 줄들) {
    const 길 = 사진경로(r.avatar);
    if (길 && 옛꼴.test(길)) 옛것.push({ ...r, 길 });
    else if (길 && 새꼴.test(길)) 새것.push(r);
    else 모를것.push(r);
  }

  console.log(`사진 프로필 전체 ${줄들.length}줄 · ${new Date().toISOString()}`);
  console.log(`  옛 꼴(옮길 것)    ${옛것.length}줄`);
  console.log(`  새 꼴(이미 끝남)  ${새것.length}줄`);
  console.log(`  꼴 모름(안 건드림) ${모를것.length}줄`);
  /* 꼴 모름은 회원 id 를 안 찍고 꼴만 찍습니다 */
  for (const r of 모를것) console.log(`    · ${String(r.avatar).replace(/[0-9a-f-]{36}/g, '<uuid>').slice(0, 80)}`);
  console.log('옮길 목록 (옛 경로)');
  for (const r of 옛것) console.log(`    · ${r.길}`);

  /* 아무 줄도 안 가리키는 옛 꼴 파일 — 셈만 (지우지 않습니다) */
  try {
    const 쓰는것 = new Set(줄들.map((r) => 사진경로(r.avatar)).filter(Boolean));
    let 옛꼴파일 = 0, 안가리킴 = 0;
    for (const f of await 폴더목록(잇기, 통, '')) {
      if (f.id !== null || f.name === 'a') continue;      // 폴더만 · 새 꼴 폴더 a 는 뺍니다
      for (const it of await 폴더목록(잇기, 통, f.name)) {
        const 길 = `${f.name}/${it.name}`;
        if (it.id === null || !옛꼴.test(길)) continue;
        옛꼴파일++;
        if (!쓰는것.has(길)) 안가리킴++;
      }
    }
    console.log(`통 ${통}: 옛 꼴 파일 ${옛꼴파일}개 · 그중 아무 줄도 안 가리키는 것 ${안가리킴}개 (이 도구는 안 지웁니다)`);
  } catch (e) {
    console.error(`통 목록을 못 읽었습니다 — ${가림(e.message)} (셈만 빠집니다)`);
  }

  if (!진짜) {
    console.log('\n마른 실행입니다 — 아무것도 안 바꿨습니다. 옮기려면 --진짜 를 붙이십시오');
    return 0;
  }
  if (!옛것.length) { console.log('옮길 것이 없습니다'); return 0; }

  const 이름 = `프로필사진경로_${날짜()}`;
  const json길 = path.join(되돌림터(), `${이름}.json`);
  const sql길 = path.join(되돌림터(), `${이름}.sql`);
  const 한것 = [];
  const 쓰기 = () => {
    fs.writeFileSync(json길, JSON.stringify(한것, null, 2));
    fs.writeFileSync(sql길, [
      `-- 프로필 사진 경로 되돌림 (${이름}) · ${한것.length}줄`,
      '-- DB 칸만 옛 값으로 돌립니다. 옛 파일은 --옛파일 단계 전까지 그대로 있습니다',
      '-- 회원이 그 뒤 사진을 또 바꿨으면 그 줄은 0줄입니다(회원 값이 이깁니다)',
      'begin;',
      ...한것.map((x) => `update public.profiles set avatar = ${sql문자(x.옛값)}`
        + ` where id = ${sql문자(x.id)} and avatar = ${sql문자(x.새값)};`),
      `-- 위 update 가 각각 1줄이어야 합니다 (모두 ${한것.length}줄)`,
      'commit;', '',
    ].join('\n'));
  };

  let 실패 = 0;
  for (const r of 옛것) {
    const 새길 = 새프로필사진경로();
    const 새값 = withPhoto(r.avatar, 새길);
    try {
      await 복사(잇기, 통, r.길, 새길);
      const u = await fetch(
        `${URL_}/rest/v1/profiles?id=eq.${encodeURIComponent(r.id)}&avatar=eq.${encodeURIComponent(r.avatar)}`,
        { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' },
          body: JSON.stringify({ avatar: 새값 }) });
      if (!u.ok) throw new Error(`DB 바꾸기 실패 HTTP ${u.status} ${가림(await u.text()).slice(0, 200)}`);
      const 바뀐 = await u.json();
      if (!Array.isArray(바뀐) || 바뀐.length !== 1) throw new Error(`바뀐 줄이 ${바뀐?.length ?? '?'}줄입니다 (1이어야 함)`);
      한것.push({ id: r.id, 옛값: r.avatar, 새값, 옛길: r.길, 새길 });
      쓰기();
      console.log(`  옮김 ${r.길} → ${새길}`);
    } catch (e) {
      실패++;
      console.error(`  ✗ ${r.길} — ${가림(e.message)}`);
      console.error('    (복사된 새 파일이 있으면 a/ 아래 주인 없이 남습니다 · 옛 값·옛 파일은 그대로입니다)');
    }
  }
  console.log(`\n옮김 ${한것.length}줄 · 실패 ${실패}줄 (옮길 것 ${옛것.length}줄)`);
  if (한것.length) {
    console.log(`되돌림 목록 ${json길}`);
    console.log(`되돌림 SQL  ${sql길}`);
    console.log(`다음 — 화면에서 사진이 보이는지 확인한 뒤: node tools/프로필사진경로옮기기.mjs --옛파일 ${json길}`);
  }
  return 실패 ? 1 : 0;
}

/* ───────────────────────── 옛 파일 지우기 ───────────────────────── */
async function 옛파일지우기() {
  const 파일 = process.argv[옛파일자리 + 1];
  if (!파일 || !fs.existsSync(파일)) { console.error('되돌림 .json 경로를 --옛파일 뒤에 적어 주십시오'); return 1; }
  const 목록 = JSON.parse(fs.readFileSync(파일, 'utf8'));
  console.log(`되돌림 목록 ${목록.length}줄 · ${파일}`);

  const 지울것 = [];
  let 안됨 = 0;
  for (const x of 목록) {
    /* 줄마다 다시 확인합니다 — 옛 경로를 아직 누가 가리키나 · 새 파일이 열리나 · 옛 것이 옛 꼴인가 */
    const 아직 = await 모두받기(
      `${URL_}/rest/v1/profiles?select=id&avatar=like.${encodeURIComponent('u/' + x.옛길 + '|*')}`, H, { 차례: 'id' });
    const 까닭 = 아직.length ? `아직 ${아직.length}줄이 옛 경로를 가리킵니다`
      : !옛꼴.test(x.옛길) ? '옛 경로가 옛 꼴이 아닙니다'
      : !(await 열리나(URL_, 통, x.새길)) ? '새 파일이 안 열립니다'
      : null;
    if (까닭) { 안됨++; console.log(`  건너뜀 ${x.옛길} — ${까닭}`); continue; }
    지울것.push(x.옛길);
  }
  const 겹침없이 = [...new Set(지울것)];
  console.log(`지울 옛 파일 ${겹침없이.length}개 · 건너뜀 ${안됨}줄`);
  for (const 길 of 겹침없이) console.log(`    · ${길}`);
  if (!진짜) { console.log('\n마른 실행입니다 — 아무것도 안 지웠습니다. 지우려면 --진짜 를 붙이십시오'); return 0; }
  if (!겹침없이.length) return 0;
  return 파일지우기(잇기, 통, 겹침없이);
}

const 끝 = await (옛파일모드 ? 옛파일지우기() : 옮기기()).catch((e) => {
  console.error(가림(e.message)); return 1;
});
process.exit(끝);
