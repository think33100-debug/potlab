'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/app/toast';
import NotifyToggle from '@/components/notify-toggle';
import { RapoButton, RapoDivider } from './rapo-ui';
import { browserSupabase } from '@/lib/supabase-browser';

/* 알림 설정 — 내 정보 「설정」 (2026-11-11 밤 · 2026-11-14 넓힘).

   2026-11-14 세중님 「봉사랑 청년 교육 모두 알림 만들자. 교육은 학회별 알림, 봉사는 지역이랑 의료관련으로 맞춤 알림」
     공고   찜한 기관 새 공고 · 찜한 공고 마감 (전과 같음)
     교육   학회별 — 교육기관알림켜기() (전부터 /edu/org 카드 종에 있던 것을 여기에도 모음)
     봉사   지역(여럿) + 「의료 관련 봉사만」 — 맞춤알림켜기('봉사', …)
     청년   지역(여럿) — 맞춤알림켜기('청년', …). 전국 정책도 함께 와요
   보내는 길은 하나입니다 — 이 기기의 푸시 알림(맨 위 단추)이 켜져 있어야 어느 알림이든 옵니다.
   보내는 규칙(하루 3건 · 밤 10시~아침 7시 안 보냄 · 켠 뒤 올라온 것만)은 DB 보낼알림() 한 자리입니다. */

const 지역들: { 값: string; 글: string }[] = [
  { 값: '서울', 글: '서울' }, { 값: '경기', 글: '경기' }, { 값: '인천', 글: '인천' }, { 값: '강원', 글: '강원' },
  { 값: '대전', 글: '대전' }, { 값: '세종', 글: '세종' }, { 값: '충북', 글: '충북' }, { 값: '충남', 글: '충남' },
  { 값: '대구', 글: '대구' }, { 값: '경북', 글: '경북' }, { 값: '부산', 글: '부산' }, { 값: '울산', 글: '울산' },
  { 값: '경남', 글: '경남' }, { 값: '전북', 글: '전북' }, { 값: '전남광주', 글: '광주·전남' }, { 값: '제주', 글: '제주' },
];

type 맞춤 = { 켜짐: boolean; 시도: string[]; 의료만: boolean };
type 학회 = { 이름: string; 직군: string | null; 모음: boolean };

/* 미리보기(/design-preview/notify)는 켜 둔 모양을 보려고 미리켬을 넘깁니다. 실제 화면은 안 넘깁니다 */
export function RapoNotifySettings({ 미리켬 = false }: { 미리켬?: boolean }) {
  return (
    <div className="flex flex-col gap-(--rapo-dimension-x6) pt-(--rapo-dimension-x4)">
      <section className="flex flex-col gap-(--rapo-dimension-x3)">
        <h2 className="rapo-type-t6-bold text-(color:--rapo-brand-color-navy)">이 기기에서 알림 받기</h2>
        <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
          아래 알림은 모두 이 기기의 알림으로 와요. 먼저 켜 주세요.
          밤 10시부터 아침 7시까지는 보내지 않고, 하루 3건까지만 보내요.
        </p>
        <NotifyToggle />
      </section>
      <RapoDivider />
      <section className="flex flex-col gap-(--rapo-dimension-x2)">
        <h2 className="rapo-type-t6-bold text-(color:--rapo-brand-color-navy)">공고</h2>
        <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
          찜한 기관에 새 공고가 뜨거나, 저장한 공고의 마감이 다가오면 알려 드려요. 공고 화면의 찜·저장으로 골라요.
        </p>
      </section>
      <RapoDivider />
      <EduSection />
      <RapoDivider />
      <AreaSection id="volunteer" 갈래="봉사" 제목="봉사활동"
        설명="고른 지역에 새 봉사활동이 올라오면 알려 드려요." 의료고름 미리켬={미리켬} />
      <RapoDivider />
      <AreaSection id="youth" 갈래="청년" 제목="청년정책"
        설명="고른 지역(전국 정책 포함)에 새 청년정책 신청이 시작되면 알려 드려요." 미리켬={미리켬} />
    </div>
  );
}

/* 켜기·끄기 스위치 — 토큰만 씁니다 (피그마 원본 없음 · 44 터치) */
function Switch({ on, label, busy, onChange }: { on: boolean; label: string; busy?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={busy}
      onClick={() => onChange(!on)}
      className="flex h-(--rapo-touch-min) w-[52px] shrink-0 items-center justify-center disabled:opacity-60">
      <span className={'relative h-[28px] w-[48px] rounded-full transition-colors motion-reduce:transition-none '
        + (on ? 'bg-(--rapo-color-bg-deep-coral)' : 'bg-(--rapo-color-stroke-neutral-muted)')}>
        <span className={'absolute top-[3px] size-[22px] rounded-full bg-(--rapo-color-bg-layer-default) shadow-(--rapo-shadow-s1) transition-[left] motion-reduce:transition-none '
          + (on ? 'left-[23px]' : 'left-[3px]')} />
      </span>
    </button>
  );
}

function EduSection() {
  const toast = useToast();
  const [목록, set목록] = useState<학회[] | null>(null);
  const [켠것, set켠것] = useState<Set<string>>(new Set());
  const [바쁨, set바쁨] = useState<string | null>(null);

  useEffect(() => {
    const sb = browserSupabase();
    Promise.all([sb.rpc('교육기관목록', { p_직군: null }), sb.rpc('내교육기관알림')]).then(([a, b]) => {
      if (a.error || b.error) { set목록([]); return; }
      /* 교육을 모아 오는 학회만 — 모으지 않는 곳은 알림을 켜도 올 것이 없습니다 */
      set목록(((a.data ?? []) as 학회[]).filter((x) => x.모음));
      set켠것(new Set(((b.data ?? []) as { 기관: string }[]).map((x) => x.기관)));
    });
  }, []);

  const 바꾸기 = async (이름: string, 켤까: boolean) => {
    set바쁨(이름);
    const { error } = await browserSupabase().rpc('교육기관알림켜기', { p_기관: 이름, p_켤까: 켤까 });
    set바쁨(null);
    if (error) { toast('저장하지 못했어요', { tone: 'danger' }); return; }
    set켠것((s) => { const n = new Set(s); if (켤까) n.add(이름); else n.delete(이름); return n; });
  };

  return (
    <section id="edu" className="flex scroll-mt-(--rapo-dimension-x4) flex-col gap-(--rapo-dimension-x2)">
      <h2 className="rapo-type-t6-bold text-(color:--rapo-brand-color-navy)">교육 · 학회별</h2>
      <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">켠 학회에 새 교육이 올라오면 알려 드려요.</p>
      {목록 === null && <p role="status" className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">불러오는 중…</p>}
      {목록 && 목록.length === 0 && <p className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">학회 목록을 불러오지 못했어요.</p>}
      <ul>
        {(목록 ?? []).map((g) => (
          <li key={g.이름} className="flex min-h-(--rapo-dimension-x14) items-center gap-(--rapo-dimension-x3)">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="rapo-type-t5-medium break-keep text-(color:--rapo-color-fg-neutral)">{g.이름}</span>
              {g.직군 && <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">{g.직군}</span>}
            </span>
            <Switch on={켠것.has(g.이름)} label={g.이름 + ' 새 교육 알림'} busy={바쁨 === g.이름} onChange={(v) => 바꾸기(g.이름, v)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AreaSection({ id, 갈래, 제목, 설명, 의료고름 = false, 미리켬 = false }: {
  id: string; 갈래: '봉사' | '청년'; 제목: string; 설명: string; 의료고름?: boolean; 미리켬?: boolean;
}) {
  const toast = useToast();
  const [값, set값] = useState<맞춤 | null>(null);
  const [저장중, set저장중] = useState(false);

  useEffect(() => {
    browserSupabase().rpc('내맞춤알림').then(({ data }) => {
      const 줄 = ((data ?? []) as ({ 갈래: string } & 맞춤)[]).find((x) => x.갈래 === 갈래);
      set값(줄 ? { 켜짐: 줄.켜짐, 시도: 줄.시도 ?? [], 의료만: 줄.의료만 } : { 켜짐: 미리켬, 시도: 미리켬 ? ['서울', '전남광주'] : [], 의료만: false });
    });
  }, [갈래, 미리켬]);

  const 저장 = async (다음: 맞춤) => {
    if (다음.켜짐 && 다음.시도.length === 0) { toast('지역을 하나 이상 골라 주세요', { tone: 'danger' }); return; }
    set저장중(true);
    const { error } = await browserSupabase().rpc('맞춤알림켜기', { p_갈래: 갈래, p_켤까: 다음.켜짐, p_시도: 다음.시도, p_의료만: 다음.의료만 });
    set저장중(false);
    if (error) { toast('저장하지 못했어요', { tone: 'danger' }); return; }
    set값(다음);
    toast(다음.켜짐 ? `${제목} 알림을 켰어요` : `${제목} 알림을 껐어요`);
  };

  return (
    <section id={id} className="flex scroll-mt-(--rapo-dimension-x4) flex-col gap-(--rapo-dimension-x3)">
      <div className="flex items-center gap-(--rapo-dimension-x3)">
        <h2 className="rapo-type-t6-bold min-w-0 flex-1 text-(color:--rapo-brand-color-navy)">{제목}</h2>
        {값 && <Switch on={값.켜짐} label={제목 + ' 알림'} busy={저장중}
          onChange={(v) => (v ? set값({ ...값, 켜짐: true }) : 저장({ ...값, 켜짐: false }))} />}
      </div>
      <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{설명}</p>
      {값?.켜짐 && (
        <>
          <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-neutral)">지역 <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">여러 곳 고를 수 있어요</span></p>
          <ul className="flex flex-wrap gap-(--rapo-dimension-x2)">
            {지역들.map((r) => {
              const 고름 = 값.시도.includes(r.값);
              return (
                <li key={r.값}>
                  <button type="button" aria-pressed={고름}
                    onClick={() => set값({ ...값, 시도: 고름 ? 값.시도.filter((s) => s !== r.값) : [...값.시도, r.값] })}
                    className={'rapo-type-t4-medium flex h-[40px] items-center whitespace-nowrap rounded-(--rapo-radius-r1_5) px-(--rapo-dimension-x3) '
                      + (고름 ? 'bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid)' : 'bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-color-fg-neutral)')}>
                    {r.글}
                  </button>
                </li>
              );
            })}
          </ul>
          {의료고름 && (
            <label className="flex min-h-(--rapo-touch-min) cursor-pointer items-center gap-(--rapo-dimension-x2)">
              <input type="checkbox" checked={값.의료만} onChange={(e) => set값({ ...값, 의료만: e.target.checked })}
                className="size-[20px] accent-(--rapo-color-bg-deep-coral)" />
              <span className="rapo-type-t4-medium break-keep text-(color:--rapo-color-fg-neutral)">병원·보건·재활 같은 의료 관련 봉사만</span>
            </label>
          )}
          <RapoButton tone="navy" size={52} full loading={저장중} onClick={() => 저장(값)}>저장하기</RapoButton>
        </>
      )}
    </section>
  );
}
