'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { channelsFor } from '@/lib/channels';
import { MAX_POST_IMAGES, postImagePair } from '@/lib/image';
import { browserSupabase } from '@/lib/supabase-browser';
import { useAuth } from '../../auth';
import { setAfterLogin } from '@/lib/after-login';
import { 어둠 } from '@/components/rapo/rapo-community';
import { RapoMaskIcon } from '@/components/rapo/rapo-ui';
import { useToast } from '../../toast';

export default function WritePage() {
  return <Suspense fallback={null}><Write /></Suspense>;
}

type Pick = { file: File; preview: string };

function Write() {
  const router = useRouter();
  const toast = useToast();
  const qs = useSearchParams();
  const { loading, session, me } = useAuth();

  const [ch, setCh] = useState(qs.get('ch') ?? 'free');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [picks, setPicks] = useState<Pick[]>([]);
  /* ★ 2026-10-11 — 중고거래 값·상태 (세중님 결정 「추천대로」).
     전에는 본문에 「가격 0원」처럼 적어서 찾기도 거르기도 안 됐습니다.
     **결제는 안 붙입니다** — POTJOB 은 결제를 받지 않습니다 */
  const [값, set값] = useState('');
  const [거래상태, set거래상태] = useState('판매중');
  const [busy, setBusy] = useState(false);
  /* 태그 — 3개까지 · 한 개 12자 · 공백과 # 없이 (2026-11-12 세중님 「그냥 열어」). 같은 규칙을 DB 가 한 번 더 봅니다(태그맞나 · 금고 SQL_1113/U) */
  const [태그, set태그] = useState<string[]>([]);
  const [태그글, set태그글] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!session) { setAfterLogin(location.pathname + location.search); router.replace('/login'); return; }
    if (!me) router.replace('/welcome');
  }, [loading, session, me, router]);

  /* 미리보기로 만든 주소는 거둬야 합니다 */
  useEffect(() => () => picks.forEach((p) => URL.revokeObjectURL(p.preview)), [picks]);

  if (loading || !me) {
    return <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7"><p className="text-lg text-mute">잠시만요…</p></main>;
  }

  /* 치료사·학생이 아니면 글을 못 씁니다 (2026-10-09 · 뼈대 3-4).
     채용·교육 담당자는 읽기만 합니다 — 병원 사람이 치료사 방에 글을 쓰기
     시작하면 솔직한 말이 사라집니다. 막는 자리는 표의 정책이고(42501),
     여기서는 쓰러 들어왔다가 저장할 때 튕기지 않게 미리 알려 줍니다 */
  if (me.role !== '현직' && me.role !== '학생') {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7">
        <p className="break-keep text-h3 font-bold">글은 치료사·학생만 쓸 수 있어요</p>
        <p className="mt-3 break-keep text-lg text-mute">
          읽는 것은 그대로 하실 수 있어요.
        </p>
        <Link href="/community"
          className="mt-7 inline-block rounded-md border border-gray-200 px-6 py-4 text-lg
                     font-medium text-gray-600 hover:bg-gray-50">
          커뮤니티로
        </Link>
      </main>
    );
  }

  /* 학생에게는 학생 방을, 현직에게는 현직 방을 보여줍니다 (옛 chFor_ 와 같게) */
  const rooms = channelsFor(me.role);

  const addFiles = (files: FileList) => {
    const room = MAX_POST_IMAGES - picks.length;
    if (room <= 0) { toast(`사진은 ${MAX_POST_IMAGES}장까지 넣을 수 있어요`, { tone: 'danger' }); return; }
    const take = Array.from(files).slice(0, room);
    if (files.length > room) toast(`${MAX_POST_IMAGES}장까지라 ${take.length}장만 담았어요`);
    setPicks([...picks, ...take.map((f) => ({ file: f, preview: URL.createObjectURL(f) }))]);
  };

  /* 입력칸 글을 태그 하나로 — 빈 것·겹친 것·12자 넘는 것은 안 넣습니다 */
  const 태그넣기 = () => {
    const t = 태그글.replace(/[\s#,]/g, '').slice(0, 12);
    set태그글('');
    if (!t || 태그.includes(t) || 태그.length >= 3) return;
    set태그([...태그, t]);
  };

  const submit = async () => {
    if (!body.trim()) { toast('내용을 써주세요', { tone: 'danger' }); return; }
    setBusy(true);
    const sb = browserSupabase();

    try {
      const 장터 = ch === 'market';
      const 값숫자 = 값.replace(/[^0-9]/g, '');
      const { data: post, error } = await sb.from('posts').insert({
        channel: ch, author_id: me.id,
        title: title.trim() || null, body: body.trim(),
        /* 장터가 아니면 두 칸을 아예 안 보냅니다 */
        ...(장터 ? { 값: 값숫자 ? Number(값숫자) : null, 거래상태 } : {}),
        태그,
      }).select('id').single();
      if (error) throw error;

      /* 사진은 글이 생긴 뒤에 올립니다 —
         post_images 규칙이 「내 글의 사진만」이라 글 id 가 있어야 통과합니다 */
      for (let i = 0; i < picks.length; i++) {
        const { full, thumb } = await postImagePair(picks[i].file);
        const base = `${me.id}/${post.id}/${i}`;
        const up = await Promise.all([
          sb.storage.from('post-images').upload(`${base}.webp`, full, { contentType: 'image/webp', upsert: true }),
          sb.storage.from('post-images').upload(`${base}-t.webp`, thumb, { contentType: 'image/webp', upsert: true }),
        ]);
        const bad = up.find((u) => u.error);
        if (bad?.error) throw bad.error;

        const { error: rowErr } = await sb.from('post_images').insert({
          post_id: post.id, path: `${base}.webp`, thumb_path: `${base}-t.webp`, sort: i,
        });
        if (rowErr) throw rowErr;
      }

      toast('글이 올라갔어요!');
      router.push(`/post/${post.id}`);
    } catch (e) {
      setBusy(false);
      toast(`올리지 못했어요 — ${(e as Error).message}`, { tone: 'danger', ms: 4000 });
    }
  };

  /* ── 그리기 — 새 디자인 「U09-01 · 공개 글쓰기」 1447:6971 (2026-11-12 밤 근무 · 어두운 판).
     작성 공간 · 관련 병원(선택) · 제목 · 내용 · 사진 · 태그(선택) · 등록.
     ★ 올리는 일(submit · 사진 줄이기 · 중고거래 값)은 그대로입니다 — 모양만.
     「관련 병원」은 저장할 곳이 없어 눌리지 않는 빈 칸으로 둡니다(밤 근무 보고에 적음).
     ★ 「태그」는 2026-11-12 밤에 열었습니다 — 원본 「S-TAG-LIMIT」 1308:8863 (칩 「#치료실 ×」 · 「3개까지 추가할 수 있어요」) */
  const 칸 = 'w-full rounded-[12px] px-[14px] text-[16px] leading-[24px] outline-none placeholder:text-[#8fa3b3] ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffa691]';
  const 칸색 = { background: 어둠.면, color: 어둠.글 } as const;
  const 이름표 = 'mt-[20px] block text-[16px] font-bold leading-[24px]';
  const 도움 = 'mt-[6px] text-[13px] leading-[18px]';
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl" style={{ background: 어둠.바탕 }}>
      <header className="sticky top-0 z-20 flex h-[56px] items-center gap-[8px] px-[8px]" style={{ background: 어둠.바탕 }}>
        <Link href="/community" aria-label="커뮤니티로" className="flex size-[44px] items-center justify-center rounded-[8px]">
          <RapoMaskIcon src="/rapo/detail/arrow-left-20.svg" w={20} h={20} className="text-[#f6f8fa]" />
        </Link>
        <h1 className="text-[18px] font-bold" style={{ color: 어둠.글 }}>글쓰기</h1>
      </header>

      <main className="px-[22px] pb-[40px]">
        <label htmlFor="w-room" className={이름표 + ' !mt-[8px]'} style={{ color: 어둠.글 }}>작성 공간</label>
        <select id="w-room" value={ch} onChange={(e) => setCh(e.target.value)}
          className={칸 + ' mt-[8px] h-[48px] appearance-none'} style={칸색}>
          {rooms.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.desc}</option>)}
        </select>
        <p className={도움} style={{ color: 어둠.흐린글 }}>닉네임으로 게시되며 회원이면 누구나 읽을 수 있어요.</p>

        <p className={이름표} style={{ color: 어둠.글 }}>관련 병원 (선택)</p>
        <div aria-disabled className={칸 + ' mt-[8px] flex h-[48px] items-center opacity-50'} style={칸색}>병원 검색·선택  ›</div>
        <p className={도움} style={{ color: 어둠.흐린글 }}>병원 연결은 아직 비어 있어요. 곧 열려요.</p>

        <label htmlFor="w-title" className={이름표} style={{ color: 어둠.글 }}>제목</label>
        <input id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="제목을 입력해 주세요 (없어도 돼요)"
          className={칸 + ' mt-[8px] h-[48px]'} style={칸색} />
        <p className={도움} style={{ color: 어둠.흐린글 }}>{title.length} / 60</p>

        {ch === 'market' && (
          <div className="mt-[12px] flex flex-wrap items-center gap-[8px]">
            <input value={값} onChange={(e) => set값(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric" placeholder="값 (원) — 비워 두면 「값 안 적음」" aria-label="값"
              className={칸 + ' h-[48px] min-w-[200px] flex-1'} style={칸색} />
            <select value={거래상태} onChange={(e) => set거래상태(e.target.value)} aria-label="거래 상태"
              className={칸 + ' h-[48px] !w-auto appearance-none'} style={칸색}>
              <option value="판매중">판매중</option>
              <option value="예약중">예약중</option>
              <option value="거래완료">거래완료</option>
            </select>
          </div>
        )}

        <label htmlFor="w-body" className={이름표} style={{ color: 어둠.글 }}>내용</label>
        <textarea id="w-body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="경험이나 궁금한 점을 적어 주세요"
          className={칸 + ' mt-[8px] py-[12px]'} style={칸색} />
        <p className={도움} style={{ color: 어둠.흐린글 }}>{body.length.toLocaleString('ko-KR')}자</p>

        <p className={이름표} style={{ color: 어둠.글 }}>사진</p>
        <label className={칸 + ' mt-[8px] flex h-[48px] cursor-pointer items-center gap-[12px]'} style={칸색}>
          <span aria-hidden>+</span> 사진 추가
          <input type="file" accept="image/*" multiple className="sr-only"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
        </label>
        <p className={도움} style={{ color: 어둠.흐린글 }}>{picks.length}/{MAX_POST_IMAGES}장 · 올릴 때 1600px 로 줄여요</p>
        {picks.length > 0 && (
          <ul className="mt-[12px] flex flex-wrap gap-[8px]">
            {picks.map((p, i) => (
              <li key={p.preview} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- 고른 사진 미리보기(blob 주소) */}
                <img src={p.preview} alt="" className="size-[72px] rounded-[8px] object-cover" />
                <button type="button" aria-label={`사진 ${i + 1} 빼기`} onClick={() => setPicks(picks.filter((_, j) => j !== i))}
                  className="absolute -right-[4px] -top-[4px] size-[22px] rounded-full text-[14px]" style={{ background: 어둠.글, color: 어둠.바탕 }}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <label htmlFor="w-tag" className={이름표} style={{ color: 어둠.글 }}>태그 (선택)</label>
        <div className={칸 + ' mt-[8px] flex min-h-[48px] flex-wrap items-center gap-x-[14px] gap-y-[6px] py-[10px]'} style={칸색}>
          {태그.map((t) => (
            <span key={t} className="flex items-center gap-[4px] text-[16px] leading-[24px]">
              #{t}
              <button type="button" aria-label={`태그 ${t} 빼기`} onClick={() => set태그(태그.filter((x) => x !== t))}
                className="px-[2px] text-[15px]" style={{ color: 어둠.흐린글 }}>×</button>
            </span>
          ))}
          {태그.length < 3 && (
            <input id="w-tag" value={태그글} maxLength={13}
              onChange={(e) => set태그글(e.target.value.replace(/[\s#]/g, ''))}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); 태그넣기(); }
                else if (e.key === 'Backspace' && !태그글 && 태그.length) set태그(태그.slice(0, -1));
              }}
              onBlur={태그넣기}
              placeholder={태그.length ? '' : '태그 추가  +'} enterKeyHint="done"
              className="h-[28px] min-w-[96px] flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#8fa3b3]" />
          )}
        </div>
        <p className={도움} style={{ color: 어둠.흐린글 }}>
          {태그.length >= 3 ? '3개까지 추가할 수 있어요. 기존 태그를 지워 주세요.' : '최대 3개 · 한 개에 12자까지 · 입력 뒤 엔터'}
        </p>

        <button type="button" onClick={submit} disabled={busy}
          className="mt-[32px] h-[48px] w-full rounded-[12px] text-[16px] font-bold disabled:opacity-50"
          style={{ background: 어둠.쓰기, color: 어둠.글 }}>
          {busy ? '올리는 중…' : '등록'}
        </button>
        <p className={도움 + ' text-center'} style={{ color: 어둠.흐린글 }}>
          남 비방·저격·허위사실·광고는 지워져요 — <Link href="/terms/community" className="underline">커뮤니티 이용규칙</Link>
        </p>
      </main>
    </div>
  );
}
