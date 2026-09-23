'use client';

import { useMemo, useState } from 'react';
import { useToast } from '@/app/toast';
import { Icon, ICON_NAMES } from '@/components/icon';
import { browserSupabase } from '@/lib/supabase-browser';
import type { IconSlot } from '@/lib/icons';

/* 아이콘 이름을 한글로도 찾을 수 있게. 안 적힌 이름은 영어로만 찾아집니다 */
const KO: Record<string, string> = {
  briefcase: '가방 서류가방 일',
  wallet: '지갑 급여 돈',
  'message-circle': '말풍선 댓글 커뮤니티',
  'book-open': '책 학력 공부',
  building: '건물 병원 기관',
  house: '집 홈',
  'user-round': '사람 회원 치료사',
  users: '사람들 인원 여러명',
  lock: '자물쇠 잠금',
  check: '체크 확인 자격',
  x: '엑스 닫기',
  flame: '불꽃 바쁨 인기',
  'arrow-down': '아래 화살표',
  'arrow-right': '오른쪽 화살표',
  'trending-up': '올라가는 그래프 전형 단계',
  'bar-chart': '막대 그래프 통계',
  clock: '시계 마감 시간',
  calculator: '계산기',
  share: '공유 내보내기 출처',
  search: '돋보기 검색 찾기',
  'git-compare': '비교',
  'map-pin': '핀 위치 근무지 지역',
  'log-in': '로그인',
  'user-plus': '회원가입 사람추가',
  bookmark: '북마크 저장 찜',
  'chevron-left': '왼쪽 화살표 뒤로',
  'arrow-up-right': '바깥으로 나가기 지원',
  'bed-double': '침대 병상',
  stethoscope: '청진기 의사 전문의',
  paperclip: '클립 첨부 파일',
  'list-checks': '목록 체크 서류',
  info: '정보 안내',
  'graduation-cap': '학사모 학력 졸업',
  /* 병원정보 · 종별 */
  'layout-grid': '네모 네개 전체 모두',
  hospital: '병원 건물 십자',
  'id-card-lanyard': '사원증 목걸이 신분증 재활병원',
  bed: '침대 하나 요양 장기요양',
  heart: '하트 마음 복지',
  landmark: '관공서 기둥 보건소 공공',
  phone: '전화 수화기',
  'chevron-down': '아래 화살표 펼치기',
};

const match = (name: string, q: string) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return name.toLowerCase().includes(s) || (KO[name] ?? '').includes(s);
};

export function IconEditor({ slots }: { slots: IconSlot[] }) {
  const toast = useToast();
  const [rows, setRows] = useState(slots);
  const [pick, setPick] = useState(slots[0]?.slot ?? '');
  const [draft, setDraft] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const cur = rows.find((r) => r.slot === pick);
  const shown = draft ?? cur?.icon ?? '';
  const dirty = draft != null && draft !== cur?.icon;

  const areas = useMemo(() => {
    const m = new Map<string, IconSlot[]>();
    rows.forEach((r) => { m.set(r.area, [...(m.get(r.area) ?? []), r]); });
    return [...m.entries()];
  }, [rows]);

  const found = useMemo(() => ICON_NAMES.filter((n) => match(n, q)), [q]);

  async function save() {
    if (!cur || !dirty || busy) return;
    setBusy(true);
    const sb = browserSupabase();
    const { error } = await sb.from('ui_icons')
      .update({ icon: draft, updated_at: new Date().toISOString() })
      .eq('slot', cur.slot);
    setBusy(false);
    if (error) { toast('저장하지 못했어요 — ' + error.message, { tone: 'danger', ms: 5000 }); return; }
    setRows(rows.map((r) => (r.slot === cur.slot ? { ...r, icon: draft! } : r)));
    setDraft(null);
    toast('바꿨어요!');
  }

  return (
    <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* 왼쪽 — 아이콘이 쓰이는 자리 */}
      <div>
        {areas.map(([area, list]) => (
          <section key={area} className="mb-6">
            <h2 className="text-lg font-bold">{area}</h2>
            <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
              {list.map((r) => (
                <li key={r.slot}>
                  <button
                    type="button"
                    onClick={() => { setPick(r.slot); setDraft(null); }}
                    className={'flex w-full items-center gap-4 px-5 py-4 text-left '
                      + (r.slot === pick ? 'bg-teal-strong/10' : 'hover:bg-gray-50 dark:hover:bg-gray-950')}
                  >
                    <Icon name={r.icon} size={22} className="shrink-0 text-gray-600 dark:text-gray-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block break-keep text-lg">{r.label}</span>
                      <span className="block truncate text-sm text-gray-500">{r.icon}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* 오른쪽 — 고른 자리 바꾸기 */}
      <div>
        {!cur ? (
          <p className="text-lg text-gray-500">왼쪽에서 자리를 골라 주세요</p>
        ) : (
          <div className="rounded-md border border-gray-200 p-6 dark:border-gray-700">
            <p className="text-sm text-gray-500">{cur.area}</p>
            <p className="break-keep text-h3 font-bold">{cur.label}</p>

            <div className="mt-5 flex items-center gap-5">
              <div className="flex h-[76px] w-[76px] items-center justify-center rounded-md border border-gray-200 dark:border-gray-700">
                <Icon name={shown} size={40} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-medium">{shown}</p>
                {dirty && <p className="text-sm text-brand-red">아직 저장 전이에요</p>}
              </div>
            </div>

            <label className="mt-6 block">
              <span className="sr-only">아이콘 찾기</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="찾기 — 병상, 시계, clock …"
                className="w-full rounded-md border border-gray-200 px-5 py-4 text-lg dark:border-gray-700 dark:bg-transparent"
              />
            </label>

            <div className="mt-4 grid max-h-[320px] grid-cols-[repeat(auto-fill,62px)] gap-2 overflow-y-auto">
              {found.map((n) => (
                <button
                  key={n}
                  type="button"
                  title={n}
                  onClick={() => setDraft(n)}
                  className={'flex h-[62px] w-[62px] items-center justify-center rounded-md border-2 '
                    + (n === shown
                      ? 'border-brand-red text-brand-red'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-950')}
                >
                  <Icon name={n} size={26} />
                </button>
              ))}
              {found.length === 0 && (
                <p className="col-span-full text-lg text-gray-500">그런 아이콘은 없어요</p>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={!dirty || busy}
                className="rounded-md bg-brand-red px-7 py-4 text-body-lg font-bold text-white disabled:opacity-40"
              >
                {busy ? '저장 중…' : '저장하기'}
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                disabled={!dirty}
                className="rounded-md border border-gray-200 px-7 py-4 text-lg font-medium text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400"
              >
                되돌리기
              </button>
            </div>
          </div>
        )}

        <p className="mt-5 break-keep text-sm leading-relaxed text-gray-500">
          이름이 잘못 들어가면 기본 아이콘으로 보여요. 화면이 깨지지는 않습니다
        </p>
      </div>
    </div>
  );
}
