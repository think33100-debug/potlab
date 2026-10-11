/* 주인이 사라진 저장소 파일을 치웁니다.

   왜 필요한가 —
   auth.users 를 지우면 profiles·posts·comments 는 cascade 로 따라 지워지지만
   storage 의 파일은 안 따라 지워집니다. 아무 데서도 안 부르는데 주소를 아는
   사람은 열 수 있는 파일로 남습니다.

   SQL 로는 못 지웁니다 — storage.protect_delete() 가 막습니다.
   Storage API 로 지워야 하고, 그러려면 service_role 키가 필요합니다.

   쓰는 법:
     SUPABASE_URL=https://xxxx.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=... \
     node tools/clean_orphan_files.js            ← 무엇을 지울지 보여주기만 함
     node tools/clean_orphan_files.js --yes      ← 실제로 지움

   service_role 키는 모든 규칙을 지나갑니다. 절대 web/ 안이나 브라우저에
   두지 마세요. 이 스크립트를 돌릴 때만 환경변수로 주고 끝내세요. */

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DO_IT = process.argv.includes('--yes');

if (!URL || !KEY) {
  console.error('SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 를 넣어 주세요');
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

/* 폴더 이름이 회원 id 인 통들. post-images 는 <회원id>/<글id>/<번호>.webp 입니다 */
const BUCKETS = ['avatars', 'post-images'];

/* ★ 2026-10-11 — proofs(재직 증빙) 는 **주인이 아니라 「쓰는 줄이 있나」**로
   봅니다. 검토가 끝나면 재직인증.경로 가 비워지므로, 아무 줄도 안 가리키는
   파일은 지울 것입니다.

   왜 그물이 필요한가 — 이제는 /admin/verify 가 **정하는 그 순간** 지웁니다.
   그래도 그때 실패하거나(창을 닫는 등) 검토 전에 탈퇴하면 파일이 남습니다.
   개인정보라 두 겹으로 둡니다.

   **갓 올린 파일은 안 건드립니다** — 올리고 줄을 쓰는 사이에 지우면 안 됩니다 */
const 증빙통 = 'proofs';
const 봐줄분 = 15;          /* 올린 지 15분 안 된 파일은 그대로 둡니다 */

async function rest(path) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  /* 지금 살아 있는 회원 id */
  const users = await rest('profiles?select=id');
  const alive = new Set(users.map((u) => u.id));
  console.log(`살아 있는 회원 ${alive.size}명`);

  for (const bucket of BUCKETS) {
    /* 파일 목록은 Storage API 로 받습니다. 폴더를 한 겹씩 들어갑니다 */
    const folders = await list(bucket, '');
    let orphans = [];

    for (const f of folders) {
      if (alive.has(f.name)) continue;          // 주인이 있는 폴더는 건너뜁니다
      orphans = orphans.concat(await walk(bucket, f.name));
    }

    if (orphans.length === 0) { console.log(`${bucket}: 치울 것 없음`); continue; }

    console.log(`${bucket}: 주인 없는 파일 ${orphans.length}개`);
    orphans.forEach((p) => console.log('   ' + p));

    if (!DO_IT) { console.log('   (--yes 를 붙이면 실제로 지웁니다)'); continue; }

    const r = await fetch(`${URL}/storage/v1/object/${bucket}`, {
      method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: orphans }),
    });
    console.log(r.ok ? `   지웠습니다` : `   실패 HTTP ${r.status} ${await r.text()}`);
  }
  await 증빙치우기();
}

async function 증빙치우기() {
  /* 아직 쓰이는 경로 */
  const r = await fetch(`${URL}/rest/v1/${encodeURIComponent('재직인증')}?select=${encodeURIComponent('경로')}&${encodeURIComponent('경로')}=not.is.null`, { headers: H });
  if (!r.ok) { console.error('재직인증을 못 읽었습니다 — HTTP ' + r.status); return; }
  const 쓰는것 = new Set((await r.json()).map((x) => x['경로']).filter(Boolean));

  const 지울것 = [];
  const 폴더들 = await list(증빙통, '');
  for (const f of 폴더들) {
    if (f.id !== null) continue;                     /* 파일이 아니라 폴더만 */
    for (const it of await list(증빙통, f.name)) {
      if (it.id === null) continue;
      const 길 = `${f.name}/${it.name}`;
      if (쓰는것.has(길)) continue;
      const 만든때 = Date.parse(it.created_at ?? it.updated_at ?? 0);
      if (Number.isFinite(만든때) && Date.now() - 만든때 < 봐줄분 * 60_000) continue;
      지울것.push(길);
    }
  }
  if (!지울것.length) { console.log(`${증빙통}: 치울 것 없음`); return; }
  console.log(`${증빙통}: 아무 줄도 안 가리키는 파일 ${지울것.length}개`);
  지울것.slice(0, 10).forEach((x) => console.log('   ' + x));
  if (!DO_IT) { console.log('   (--yes 를 주면 지웁니다)'); return; }
  const d = await fetch(`${URL}/storage/v1/object/${증빙통}`, {
    method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: 지울것 }),
  });
  console.log(d.ok ? `   지웠습니다 ${지울것.length}개` : `   못 지웠습니다 — HTTP ${d.status}`);
}

async function list(bucket, prefix) {
  const r = await fetch(`${URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  if (!r.ok) throw new Error(`list ${bucket}/${prefix} → HTTP ${r.status}`);
  return r.json();
}

/* 폴더 안을 끝까지 훑습니다. id 가 null 이면 폴더, 있으면 파일입니다 */
async function walk(bucket, prefix) {
  const items = await list(bucket, prefix);
  let out = [];
  for (const it of items) {
    const path = `${prefix}/${it.name}`;
    if (it.id === null) out = out.concat(await walk(bucket, path));
    else out.push(path);
  }
  return out;
}

main().catch((e) => { console.error(e.message); process.exit(1); });
