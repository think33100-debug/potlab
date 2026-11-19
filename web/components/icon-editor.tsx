'use client';

import { useMemo, useState } from 'react';
import { useToast } from '@/app/toast';
import { Icon, ICON_NAMES } from '@/components/icon';
import { browserSupabase } from '@/lib/supabase-browser';
import type { IconSlot } from '@/lib/icons';
import { 관 } from '@/components/rapo/rapo-admin-ui';

/* 2026-11-19 — 관리자 화면(/admin/icons)에서만 씁니다. 새 관리자 디자인(Figma 16)으로 겉모양만 다시 입힘 */

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
    <div className="grid gap-[24px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* 왼쪽 — 아이콘이 쓰이는 자리 */}
      <div>
        {areas.map(([area, list]) => (
          <section key={area} className="mb-[24px]">
            <h2 className={관.h3}>{area}</h2>
            <ul className={'mt-[8px] ' + 관.list}>
              {list.map((r) => (
                <li key={r.slot}>
                  <button
                    type="button"
                    onClick={() => { setPick(r.slot); setDraft(null); }}
                    aria-pressed={r.slot === pick}
                    className={'flex w-full items-center gap-[14px] px-[18px] py-[12px] text-left '
                      + (r.slot === pick ? 'bg-[#fff5f3]' : 'hover:bg-[#f6f8f9]')}
                  >
                    <Icon name={r.icon} size={22} className={'shrink-0 ' + (r.slot === pick ? 'text-[#b42a21]' : 'text-[#304f65]')} />
                    <span className="min-w-0 flex-1">
                      <span className={'block break-keep text-[16px] ' + (r.slot === pick ? 'font-bold text-[#b42a21]' : 'text-[#112231]')}>{r.label}</span>
                      <span className={'block truncate ' + 관.sub}>{r.icon}</span>
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
          <p className={관.muted}>왼쪽에서 자리를 골라 주세요</p>
        ) : (
          <div className={관.card + ' md:sticky md:top-[24px]'}>
            <p className={관.sub}>{cur.area}</p>
            <p className="rapo-type-t7-bold break-keep text-[#112231]">{cur.label}</p>

            <div className="mt-[16px] flex items-center gap-[16px]">
              <div className="flex h-[76px] w-[76px] items-center justify-center rounded-[12px] border border-[#dde4e6] bg-[#f6f8f9] text-[#112231]">
                <Icon name={shown} size={40} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold text-[#112231]">{shown}</p>
                {dirty && <p className="text-[13px] font-bold text-[#b42a21]">아직 저장 전이에요</p>}
              </div>
            </div>

            <label className="mt-[20px] block">
              <span className="sr-only">아이콘 찾기</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="찾기 — 병상, 시계, clock …"
                className={관.input}
              />
            </label>

            <div className="mt-[12px] grid max-h-[320px] grid-cols-[repeat(auto-fill,56px)] gap-[8px] overflow-y-auto">
              {found.map((n) => (
                <button
                  key={n}
                  type="button"
                  title={n}
                  onClick={() => setDraft(n)}
                  aria-pressed={n === shown}
                  className={'flex h-[56px] w-[56px] items-center justify-center rounded-[8px] border-2 '
                    + (n === shown
                      ? 'border-[#ff4f40] bg-[#fff5f3] text-[#b42a21]'
                      : 'border-[#dde4e6] bg-white text-[#304f65] hover:bg-[#f6f8f9]')}
                >
                  <Icon name={n} size={26} />
                </button>
              ))}
              {found.length === 0 && (
                <p className={'col-span-full ' + 관.muted}>그런 아이콘은 없어요</p>
              )}
            </div>

            <div className="mt-[20px] flex flex-wrap items-center justify-end gap-[16px]">
              <button
                type="button"
                onClick={save}
                disabled={!dirty || busy}
                className={관.btn + ' order-2 min-w-[120px]'}
              >
                {busy ? '저장 중…' : '저장하기'}
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                disabled={!dirty}
                className={관.btnText + ' order-1'}
              >
                되돌리기
              </button>
            </div>
          </div>
        )}

        <p className={'mt-[16px] break-keep ' + 관.sub}>
          이름이 잘못 들어가면 기본 아이콘으로 보여요. 화면이 깨지지는 않습니다
        </p>
      </div>
    </div>
  );
}
