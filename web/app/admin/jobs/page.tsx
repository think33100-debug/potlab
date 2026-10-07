'use client';

import Link from 'next/link';
import { AdminMerge } from '@/components/admin-merge';
import { AdminTabCards } from '@/components/admin-tab-cards';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  ADMIN_LIST_COLS, STATES, type AdminJobListItem, type StateKey,
} from '@/lib/admin-jobs';
import { SOURCE_NAME, TABS, tabLabel } from '@/lib/supabase';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../../toast';

/* 관리자 공고 화면.

   admin_jobs 뷰를 봅니다 — 숨김·보류도 나오고 출처·수집일도 나옵니다.
   회원 화면(job_posts)에서는 둘 다 안 보입니다.

   보류함을 첫 칸에 둡니다. 「못 가린 공고는 버리지 말고 보류함으로.
   관리자가 확인 후 올림」이 이 제품의 규칙이라 여기가 매일 보는 자리입니다. */

const PAGE = 50;

export default function AdminJobs() {
  const toast = useToast();
  /* ── 뒤로 가기가 **보던 화면**으로 돌아가게 (2026-09-29) ──
     전에는 탭·검색어·쪽이 화면 안 상태(useState)에만 있어서, 공고를 열었다
     뒤로 오면 기본 탭(보류함)으로 튀었습니다.
     주소(?state=…&q=…&page=…)에 담으면 브라우저가 알아서 되돌려 줍니다.
     스크롤 위치는 Next.js 가 주소마다 기억합니다. */
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const state = (params.get('state') as StateKey) || 'hold';
  const tab = params.get('tab') || '';
  const q = params.get('q') || '';
  const page = Number(params.get('page') || 0);
  const [typed, setTyped] = useState(q);
  /* 주소를 바꿉니다. push 라야 **뒤로 가기가 그 화면으로** 돌아갑니다 */
  const 주소로 = useCallback((바꿀것: Record<string, string | number | null>) => {
    const u = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(바꿀것)) {
      if (v === null || v === '' || v === 0) u.delete(k); else u.set(k, String(v));
    }
    router.push(pathname + (u.toString() ? '?' + u.toString() : ''), { scroll: false });
  }, [params, pathname, router]);
  /* 검색칸은 주소가 바뀌면 따라갑니다 (뒤로 가기로 왔을 때) */
  const 앞주소 = useRef(q);
  useEffect(() => { if (앞주소.current !== q) { 앞주소.current = q; setTyped(q); } }, [q]);

  const [rows, setRows] = useState<AdminJobListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const build = useCallback(() => {
    let b = browserSupabase().from('admin_jobs').select(ADMIN_LIST_COLS, { count: 'exact' });
    if (state === 'hold') b = b.eq('hold', true);
    if (state === 'live') b = b.eq('hold', false).eq('hidden', false);
    if (state === 'hidden') b = b.eq('hidden', true);
    /* 규칙을 바꿔 다시 판정한 것만 — 되살릴 수 있게 따로 모읍니다 (2026-09-28) */
    if (state === 'rejudged') b = b.eq('hidden', true).like('hidden_why', '재판정으로 버림%');
    /* 마감일 없이 날수가 지나 내린 것 (2026-10-07).
       「30일 지남」 과 옛 「45일 지남」 을 같이 모읍니다.
       「180일 지남(수시)」 는 뺍니다 — 그건 진짜 수시 공고라 사람이 볼 것이 없습니다 */
    if (state === 'needcheck') {
      b = b.eq('hidden', true).like('hidden_why', '%일 지남').not('hidden_why', 'like', '%(수시)%');
    }
    if (tab) b = b.like('tab', TABS.find((t) => t.key === tab)?.like ?? '%');
    if (q) b = b.or(`title.ilike.%${q}%,org_name.ilike.%${q}%,id.ilike.%${q}%`);
    return b;
  }, [state, tab, q]);

  const fetchRows = useCallback(async () => {
    const { data, count } = await build()
      .order('collected_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    return { rows: (data ?? []) as unknown as AdminJobListItem[], total: count ?? 0 };
  }, [build, page]);

  /* 칸마다 몇 건인지 — 줄은 안 받고 세기만 합니다 */
  const fetchCounts = useCallback(async () => {
    const sb = browserSupabase();
    const one = (f: (b: ReturnType<typeof sb.from>) => unknown) => f;
    void one;
    const [hold, live, hidden, needcheck, all] = await Promise.all([
      sb.from('admin_jobs').select('id', { count: 'exact', head: true }).eq('hold', true),
      sb.from('admin_jobs').select('id', { count: 'exact', head: true }).eq('hold', false).eq('hidden', false),
      sb.from('admin_jobs').select('id', { count: 'exact', head: true }).eq('hidden', true),
      /* 마감일 없이 날수가 지나 내린 것 — 사람이 봐야 합니다 (2026-10-07) */
      sb.from('admin_jobs').select('id', { count: 'exact', head: true })
        .eq('hidden', true).like('hidden_why', '%일 지남').not('hidden_why', 'like', '%(수시)%'),
      sb.from('admin_jobs').select('id', { count: 'exact', head: true }),
    ]);
    return {
      hold: hold.count ?? 0, live: live.count ?? 0,
      hidden: hidden.count ?? 0, needcheck: needcheck.count ?? 0, all: all.count ?? 0,
    };
  }, []);

  const reload = useCallback(async () => {
    const [r, c] = await Promise.all([fetchRows(), fetchCounts()]);
    setRows(r.rows); setTotal(r.total); setCounts(c);
  }, [fetchRows, fetchCounts]);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchRows(), fetchCounts()]).then(([r, c]) => {
      if (!alive) return;
      setRows(r.rows); setTotal(r.total); setCounts(c);
    });
    return () => { alive = false; };
  }, [fetchRows, fetchCounts]);

  /* ── 관리자 결정 (2026-09-29) ──
     전에는 hold 와 hidden 을 **따로 뒤집었습니다.** 그래서
     「보류 풀기」 를 눌러도 hidden 이 남아 안 보이고,
     「다시 보이기」 를 눌러도 hold 가 남아 보류함으로 돌아갔습니다.
     서귀포의료원 공고(CE77568)가 그래서 안 살아났습니다.

     이제 살리기·숨기기·보류함으로 셋 중 하나입니다.
     **결정하면 잠깁니다** — 규칙·재판정·동기화가 다시 못 덮어씁니다. */
  const decide = async (id: string, what: '살리기' | '숨기기' | '보류함으로' | '잠금풀기',
                        jobGroup?: string, note?: string) => {
    setBusy(id);
    const { error } = await browserSupabase().rpc('admin_decide', {
      p_id: id, p_what: what, p_job_group: jobGroup ?? null, p_note: note ?? null,
    });
    setBusy(null);
    if (error) { toast(`바꾸지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 }); return; }
    toast(what === '살리기' ? `회원 화면에 올렸어요 (${jobGroup})`
      : what === '숨기기' ? '숨겼어요'
      : what === '보류함으로' ? '보류함으로 보냈어요' : '잠금을 풀었어요 — 규칙에 맡깁니다');
    await reload();
  };

  /* 살릴 때는 직군을 골라야 합니다 — 물리/작업/공통 */
  const 살리기 = (id: string, title: string) => {
    const 물음 = [
      `「${title.slice(0, 40)}」 를 회원 화면에 올립니다.`,
      '',
      '직군을 고르세요 —',
      '  1  물리치료사',
      '  2  작업치료사',
      '  3  공통(둘 다)',
      '',
      '번호를 넣어 주세요',
    ].join('\n');
    const 답 = prompt(물음, '3');
    if (답 === null) return;
    const 직군 = { 1: '물리치료사', 2: '작업치료사', 3: '공통' }[Number(답.trim()) as 1 | 2 | 3];
    if (!직군) { toast('1 · 2 · 3 중에 골라 주세요', { tone: 'danger' }); return; }
    void decide(id, '살리기', 직군);
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(`「${title}」를 지울까요?\n되돌릴 수 없어요. 보류함으로 보내는 쪽이 안전해요`)) return;
    setBusy(id);
    const { error } = await browserSupabase().from('job_posts').delete().eq('id', id);
    setBusy(null);
    if (error) { toast(`지우지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    toast('공고를 지웠어요');
    await reload();
  };

  const go = (s: StateKey) => 주소로({ state: s === 'hold' ? null : s, page: null });
  const search = () => 주소로({ q: typed.trim() || null, page: null });

  return (
    <div>
      <AdminTabCards />
      {/* 같은 공고가 둘로 올라온 짝. 접어 두고, 펼쳐서 하나씩 가립니다 */}
      <AdminMerge />
      {/* 상태 칸 */}
      <nav className="flex flex-wrap gap-2" aria-label="공고 상태">
        {STATES.map((s) => (
          <button
            key={s.key} type="button" onClick={() => go(s.key)}
            aria-current={state === s.key ? 'true' : undefined}
            className={
              'rounded-md border px-6 py-4 text-lg font-medium ' +
              (state === s.key
                ? 'border-teal-strong bg-teal-strong text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400')
            }
          >
            {s.label}
            <span className={'ml-2 text-sm ' + (state === s.key ? 'text-white/70' : 'text-mute')}>
              {counts[s.key] ?? '…'}
            </span>
          </button>
        ))}
      </nav>
      {STATES.find((s) => s.key === state)?.hint && (
        <p className="mt-2 text-sm text-mute">{STATES.find((s) => s.key === state)!.hint}</p>
      )}

      {state === 'hold' && <HoldCleanup onDone={reload} />}

      {/* 찾기 · 탭 거르기 */}
      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) search(); }}
          placeholder="기관명 · 공고명 · 공고ID"
          aria-label="공고 찾기"
          className="min-w-0 flex-1 rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950"
        />
        <button type="button" onClick={search}
          className="shrink-0 rounded-md bg-brand-red px-7 py-4 text-btn font-bold text-white hover:bg-brand-red-dark">
          찾기
        </button>
        <select
          value={tab}
          onChange={(e) => 주소로({ tab: e.target.value || null, page: null })}
          aria-label="탭으로 거르기"
          className="appearance-none rounded-xs border border-gray-200 bg-gray-50 py-4 pl-5 pr-[36px] text-lg dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="">탭 전체</option>
          {TABS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {q && (
        <p className="mt-2 text-sm text-mute">
          「{q}」로 찾은 {total}건{' '}
          <button type="button" onClick={() => { setTyped(''); 주소로({ q: null, page: null }); }}
            className="text-interaction-blue hover:underline">검색 지우기</button>
        </p>
      )}

      {/* 목록 */}
      {rows === null ? (
        <p className="mt-7 text-lg text-mute">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="mt-7 py-8 text-center text-lg text-mute">
          {state === 'hold' ? '보류함이 비었어요. 좋은 신호죠' : '해당하는 공고가 없어요'}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((r) => (
            <li key={r.id} className="py-6">
              <div className="flex flex-wrap items-center gap-2 text-sm text-mute">
                {r.hold && <Badge tone="red">보류</Badge>}
                {r.hidden && <Badge tone="gray">숨김</Badge>}
                {r.tab && <Badge tone="blue">{tabLabel(r.tab)}</Badge>}
                <span>{r.org_name}</span>
                <span className="flex-1" />
                <span>{SOURCE_NAME[r.source] ?? r.source} · 수집 {r.collected_at?.slice(0, 10)}</span>
              </div>

              <Link href={`/admin/jobs/${r.id}`} className="mt-1 block text-body-lg font-medium hover:underline">
                {r.title}
              </Link>

              <p className="mt-1 text-sm text-mute">
                {[r.job_group, r.employ_type, r.work_place,
                  r.headcount ? `${r.headcount}명` : null,
                  r.apply_to ? `~${r.apply_to}` : null,
                  r.id].filter(Boolean).join(' · ')}
              </p>

              {/* 왜 보류인지 — 목록에서 바로 보이게 (2026-09-25).
                  없으면 관리자가 한 건씩 열어 원문을 읽어야 합니다.
                  시트의 「보류사유」 칸이 evidence 에 실려 옵니다 */}
              {/* 왜 감췄는지 — 되살릴지 정하려면 까닭이 보여야 합니다 (2026-09-28) */}
              {r.hidden && r.hidden_why && (
                <p className="mt-1 break-keep text-[13px] text-[#8b979d]">
                  감춘 까닭 — {r.hidden_why}
                </p>
              )}
              {/* 관리자가 정한 것 — 규칙이 못 덮어씁니다 */}
              {r.admin_locked && (
                <p className="mt-1 break-keep text-[13px] font-bold text-[#0d5c4f]">
                  관리자가 정한 공고 — 규칙·재판정·동기화가 못 바꿉니다
                  {r.admin_note ? ' · ' + r.admin_note : ''}
                </p>
              )}
              {r.hold && r.evidence?.['보류사유'] && (
                <p className="mt-1 break-keep text-sm font-medium text-brand-red-dark">
                  보류 이유 — {r.evidence['보류사유']}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {/* 살리기 · 숨기기 · 보류함으로 — 셋 중 하나. 지금 상태인 것은 안 보입니다 */}
                {(r.hold || r.hidden) && (
                  <Act onClick={() => 살리기(r.id, r.title)} busy={busy === r.id}>회원 화면에 올리기</Act>
                )}
                {!r.hidden && (
                  <Act onClick={() => decide(r.id, '숨기기')} busy={busy === r.id}>숨기기</Act>
                )}
                {!r.hold && (
                  <Act onClick={() => decide(r.id, '보류함으로')} busy={busy === r.id}>보류함으로</Act>
                )}
                {r.admin_locked && (
                  <Act onClick={() => decide(r.id, '잠금풀기')} busy={busy === r.id}>잠금 풀기</Act>
                )}
                <Link href={`/admin/jobs/${r.id}`}
                  className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
                  수정
                </Link>
                <Link href={`/jobs/${r.id}`} target="_blank"
                  className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">
                  회원 화면
                </Link>
                <span className="flex-1" />
                <Act onClick={() => remove(r.id, r.title)} busy={busy === r.id} danger>삭제</Act>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 쪽 넘기기 */}
      {total > PAGE && (
        <div className="mt-7 flex items-center justify-between gap-5">
          <button type="button" disabled={page === 0} onClick={() => 주소로({ page: page - 1 })}
            className="rounded-md border border-gray-200 px-6 py-4 text-lg disabled:opacity-30 dark:border-gray-700">
            ← 이전
          </button>
          <span className="text-sm text-mute">
            {page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} / {total}건
          </span>
          <button type="button" disabled={(page + 1) * PAGE >= total} onClick={() => 주소로({ page: page + 1 })}
            className="rounded-md border border-gray-200 px-6 py-4 text-lg disabled:opacity-30 dark:border-gray-700">
            다음 →
          </button>
        </div>
      )}
    </div>
  );
}

function Badge({ tone, children }: { tone: 'red' | 'gray' | 'blue'; children: React.ReactNode }) {
  const cls = tone === 'red' ? 'bg-brand-red-soft text-brand-red-dark'
    : tone === 'blue' ? 'bg-badge-blue-bg text-interaction-blue'
    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  return <span className={'rounded-md px-3 font-medium ' + cls}>{children}</span>;
}

/* 보류함에서 **마감 지난 것만** 한 번에 치웁니다 (2026-10-07 세중님).
 *
 *   마감일이 없는 공고는 넣지 않습니다 — 아직 뽑는 중일 수 있습니다
 *   브라우저 confirm 을 안 씁니다. 화면 안에서 건수를 먼저 보여주고
 *   한 번 더 눌러야 돕니다
 *   지우지 않습니다. 보류함에서 빼고 감춤으로 두며 사유는
 *   「보류함 정리(마감 지남)」 — job_state_log 에 남아 되돌릴 수 있습니다
 *   관리자인지는 **DB 의 보류함마감정리() 안에서** is_admin() 으로 봅니다.
 *   화면에서 숨기는 것은 자물쇠가 아닙니다 */
function HoldCleanup({ onDone }: { onDone: () => void }) {
  const [셀것, set셀것] = useState<number | null>(null);
  const [도는중, set도는중] = useState(false);
  const [끝난말, set끝난말] = useState<string | null>(null);

  const 세기 = async () => {
    set도는중(true); set끝난말(null);
    const { data, error } = await browserSupabase().rpc('보류함마감정리', { p_정말: false });
    set도는중(false);
    if (error) { set끝난말('세지 못했습니다 — ' + error.message); return; }
    set셀것(Number((data as Record<string, number>)?.['셀것'] ?? 0));
  };

  const 치우기 = async () => {
    set도는중(true);
    const { data, error } = await browserSupabase().rpc('보류함마감정리', { p_정말: true });
    set도는중(false); set셀것(null);
    if (error) { set끝난말('치우지 못했습니다 — ' + error.message); return; }
    set끝난말(((data as Record<string, number>)?.['치운것'] ?? 0) + '건을 치웠습니다. '
      + '「숨긴 것」 칸에서 사유 「보류함 정리(마감 지남)」 으로 찾을 수 있습니다');
    onDone();
  };

  return (
    <div className="mt-3 rounded-md border border-gray-200 p-4 dark:border-gray-700">
      {셀것 === null ? (
        <Act onClick={세기} busy={도는중}>마감 지난 것 한 번에 치우기</Act>
      ) : 셀것 === 0 ? (
        <p className="text-lg text-mute">
          마감 지난 보류함 공고가 없습니다.
          <button type="button" onClick={() => set셀것(null)}
            className="ml-3 text-sm text-interaction-blue hover:underline">닫기</button>
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-lg">
            마감 지난 공고 <b>{셀것}건</b>을 보류함에서 치웁니다. 지우지 않고 감춥니다
          </p>
          <Act onClick={치우기} busy={도는중} danger>정말 치우기</Act>
          <button type="button" onClick={() => set셀것(null)}
            className="text-sm text-interaction-blue hover:underline">그만두기</button>
        </div>
      )}
      {끝난말 && <p className="mt-2 text-sm text-mute">{끝난말}</p>}
    </div>
  );
}

function Act({
  onClick, busy, danger, children,
}: { onClick: () => void; busy: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className={
        'rounded-md border px-6 py-4 text-lg font-medium disabled:opacity-40 ' +
        (danger
          ? 'border-gray-200 text-mute hover:border-brand-red hover:text-brand-red dark:border-gray-700'
          : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300')
      }>
      {children}
    </button>
  );
}
