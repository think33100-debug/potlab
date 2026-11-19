'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { 관, AdminBadge, AdminSection, 배지꼴, type 배지색 } from '@/components/rapo/rapo-admin-ui';

/* 경쟁사 비교 — 관리자만 (2026-09-30).
 *
 * ── 지키는 선 ────────────────────────────────────────────────
 * · **회원 화면에는 절대 안 씁니다.** 이 화면에서만 봅니다
 * · 경쟁사 공고를 우리 공고로 옮겨 싣지 않습니다
 * · 쓰는 것은 「이 기관을 우리도 봐야겠다」 는 신호뿐입니다
 *
 * ── 땡큐오티는 게시 날짜를 안 줍니다 ─────────────────────────
 * 그래서 「우리가 처음 본 시각」 을 씁니다. 켤 때 이미 목록에 있던 것은
 * 언제 올라왔는지 몰라 **기존** 으로 두고 빠름·늦음 셈에서 뺍니다.
 */

type 줄 = {
  경쟁사: string; 글번호: string; 제목: string; 기관분류: string | null;
  기관명: string | null; 지역: string | null; 고용형태: string | null; 링크: string | null;
  처음본때: string; 기존: boolean; 넣은이: string;
  판정: string | null; 차이시간: number | null; 원인: string | null;
  상태: string | null; 메모: string | null;
  우리것: string | null; 우리제목: string | null; 우리경로: string | null;
};
type 후보 = { 기관명: string; 어디서: string | null; 상태: string; 메모: string | null };
type 짐 = {
  요약: Record<string, number>;
  원인별: Record<string, number>;
  줄: 줄[];
  수집후보: 후보[];
};

const 판정색 = (p: string | null): 배지색 =>
  p === '우리가 빠름' ? 'ok'
    : p === '우리가 늦음' ? 'coral'
      : p && p.includes('없음') ? 'warn'
        : 'neutral';

const 상태들 = ['미처리', '원인 확인', '수정 완료'];
const 원인들 = ['수집 목록에 없는 기관', '수집 주기 탓', '직군 못 가림', '보류함 대기', '막힌 병원', '모름'];

export default function AdminRival() {
  const [d, setD] = useState<짐 | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [손, set손] = useState({ 기관명: '', 제목: '', 링크: '', 본날짜: '' });

  const 읽기 = useCallback(() => {
    browserSupabase().rpc('admin_rival').then(({ data, error }) => {
      if (error) setErr(error.message); else setD(data as 짐);
    });
  }, []);
  useEffect(읽기, [읽기]);

  const 바꾸기 = async (x: 줄, 상태?: string, 메모?: string, 원인?: string) => {
    const { error } = await browserSupabase().rpc('admin_rival_set', {
      p_경쟁사: x.경쟁사, p_글번호: x.글번호,
      p_상태: 상태 ?? x.상태, p_메모: 메모 ?? x.메모, p_원인: 원인 ?? null,
    });
    if (error) { setErr(error.message); return; }
    읽기();
  };

  const 후보로 = async (x: 줄) => {
    const 이름 = x.기관명 || prompt('기관 이름을 적어주세요', x.제목.slice(0, 20)) || '';
    if (!이름) return;
    const { error } = await browserSupabase().rpc('admin_rival_org_todo', {
      p_기관명: 이름, p_어디서: x.경쟁사 + ' ' + x.글번호 + ' · ' + x.제목.slice(0, 60),
    });
    if (error) { setErr(error.message); return; }
    읽기();
  };

  const 손넣기 = async () => {
    if (!손.제목.trim()) { alert('제목을 적어주세요'); return; }
    const { error } = await browserSupabase().rpc('admin_rival_add', {
      p_경쟁사: '굿잡피티', p_기관명: 손.기관명 || null, p_제목: 손.제목,
      p_본날짜: 손.본날짜 ? new Date(손.본날짜).toISOString() : new Date().toISOString(),
      p_링크: 손.링크 || null, p_기관분류: null,
    });
    if (error) { setErr(error.message); return; }
    set손({ 기관명: '', 제목: '', 링크: '', 본날짜: '' });
    읽기();
  };

  if (err) return <p role="alert" className={관.error}>{err}</p>;
  if (!d) return <p className={관.muted}>잠시만요…</p>;

  const s = d.요약 || {};
  const 작은칸 = 'h-[36px] rounded-[8px] border border-[#dde4e6] bg-white px-[10px] text-[13px] text-[#112231] focus:border-[#304f65] focus:outline-none';

  return (
    <div className="max-w-[1100px]">
      {/* 2026-11-19 새 관리자 디자인(Figma 16)으로 겉모양만 다시 입힘 */}
      <RapoAdminHeader title="경쟁사 비교" />
      <p className={'-mt-[20px] mb-[24px] break-keep ' + 관.muted}>
        <b className="text-[#112231]">관리자만 봅니다. 회원 화면에는 쓰지 않습니다.</b> 경쟁사 공고를 우리 공고로
        옮겨 싣지 않습니다 — 쓰는 것은 「이 기관을 우리도 봐야겠다」는 신호뿐입니다.
        공고는 그 기관에서 직접 긁습니다.
      </p>

      {/* ── 요약 ── */}
      <AdminSection title="이번 주 요약">
        <div className="grid grid-cols-2 gap-[12px] md:grid-cols-3 lg:grid-cols-6">
          {([
            ['이번 주 비교', s['이번 주 비교'], 'neutral'],
            ['우리가 빠름', s['우리가 빠름'], 'ok'],
            ['우리가 늦음', s['우리가 늦음'], 'coral'],
            ['우리에게 없음', s['우리에게 없음'], 'warn'],
            ['평균 늦은 시간', s['평균 늦은 시간'], 'neutral'],
            ['미처리', s['미처리'], 'info'],
          ] as [string, number | undefined, 배지색][]).map(([라벨, 값, 색]) => (
            <div key={라벨} className="flex min-h-[96px] flex-col justify-between rounded-[12px] border border-[#dde4e6] bg-white px-[15px] py-[12px]">
              <span className={배지꼴(색) + ' self-start'}>{라벨}</span>
              <div className="text-[28px] font-bold leading-none text-[#112231] tabular-nums">
                {값 ?? 0}{라벨 === '평균 늦은 시간' ? <span className="text-[14px] font-normal"> 시간</span> : null}
              </div>
            </div>
          ))}
        </div>

        <div className={관.card + ' text-[14px] text-[#112231]'}>
          <b>원인별</b>{' '}
          {Object.entries(d.원인별 || {}).length === 0
            ? <span className="text-[#555d6d]">아직 없습니다</span>
            : Object.entries(d.원인별).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <span key={k} className={배지꼴('neutral') + ' mr-[6px] mt-[4px]'}>{k} {v}</span>
            ))}
          <span className={'ml-[6px] ' + 관.sub}>
            · 「기존」 {s['기존 (셈에서 뺌)'] ?? 0}건은 켤 때 이미 목록에 있어 빠름·늦음 셈에서 뺐습니다
          </span>
        </div>
      </AdminSection>

      {/* ── 손으로 넣기 (굿잡피티) ── */}
      <section className={'mb-[32px] ' + 관.card}>
        <h2 className="rapo-type-t7-bold text-[#112231]">굿잡피티 — 손으로 넣기</h2>
        <p className={'mt-[6px] break-keep ' + 관.sub}>
          굿잡피티는 이용약관에 「회사의 사전 승락없이 복제 또는 유통시키거나 상업적으로
          이용하는 경우」가 이용제한 사유로 적혀 있어 <b>자동으로 보지 않습니다.</b>
          세중님이 눈으로 보신 것만 여기 적습니다.
        </p>
        <div className="mt-[16px] grid gap-[12px] md:grid-cols-5">
          <input className={관.input} placeholder="기관명" aria-label="기관명"
            value={손.기관명} onChange={(e) => set손({ ...손, 기관명: e.target.value })} />
          <input className={관.input + ' md:col-span-2'} placeholder="제목" aria-label="제목"
            value={손.제목} onChange={(e) => set손({ ...손, 제목: e.target.value })} />
          <input className={관.input} type="datetime-local" aria-label="본 날짜"
            value={손.본날짜} onChange={(e) => set손({ ...손, 본날짜: e.target.value })} />
          <input className={관.input} placeholder="링크" aria-label="링크"
            value={손.링크} onChange={(e) => set손({ ...손, 링크: e.target.value })} />
        </div>
        <div className="mt-[12px] flex justify-end">
          <button type="button" onClick={손넣기} className={관.btn + ' min-w-[120px]'}>
            넣기
          </button>
        </div>
      </section>

      {/* ── 줄 ── */}
      <AdminSection title="경쟁사 공고 대조">
        <div className={관.tableWrap}>
          <table className={관.table + ' min-w-[880px]'}>
            <thead className={관.thead}>
              <tr>
                <th className={관.th}>경쟁사 공고</th>
                <th className={관.th}>우리 것</th>
                <th className={관.th}>판정</th>
                <th className={관.th}>원인</th>
                <th className={관.th}>상태 · 메모</th>
              </tr>
            </thead>
            <tbody>
              {d.줄.map((x) => (
                <tr key={x.경쟁사 + x.글번호} className={관.tr + ' align-top'}>
                  <td className={관.td}>
                    <div className="flex flex-wrap items-center gap-[4px]">
                      <span className={배지꼴('neutral')}>{x.경쟁사}</span>
                      {x.기관분류 && <span className={배지꼴('info')}>{x.기관분류}</span>}
                      {x.기존 && <span className={배지꼴('neutral')}>기존</span>}
                      {x.넣은이 === '손' && <span className={배지꼴('info')}>손 입력</span>}
                    </div>
                    <div className="mt-[6px] max-w-md text-[14px] font-bold text-[#112231]">
                      {x.링크
                        ? <a href={x.링크} target="_blank" rel="noreferrer"
                          className="underline decoration-dotted underline-offset-2 hover:decoration-solid">{x.제목}</a>
                        : x.제목}
                    </div>
                    <div className={관.sub}>
                      {x.기관명 ? x.기관명 + ' (어림)' : ''} {x.지역 ?? ''} {x.고용형태 ?? ''} · 처음 본 때 {x.처음본때}
                    </div>
                  </td>
                  <td className={관.td}>
                    {x.우리것
                      ? <>
                        <div className="max-w-xs text-[13px] text-[#112231]">{x.우리제목}</div>
                        <div className={관.sub}>{x.우리경로} · {x.우리것}</div>
                      </>
                      : <AdminBadge tone="coral">없습니다</AdminBadge>}
                  </td>
                  <td className={관.td + ' whitespace-nowrap'}>
                    <span className={배지꼴(판정색(x.판정))}>{x.판정 ?? '-'}</span>
                    {x.차이시간 != null && (
                      <div className={'mt-[4px] ' + 관.sub}>
                        {x.차이시간 >= 0 ? '+' : ''}{x.차이시간} 시간
                      </div>
                    )}
                  </td>
                  <td className={관.td}>
                    <select className={작은칸} aria-label="원인"
                      value={x.원인 ?? ''} onChange={(e) => 바꾸기(x, undefined, undefined, e.target.value)}>
                      <option value="">(없음)</option>
                      {원인들.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {x.원인 === '수집 목록에 없는 기관' && (
                      <div className="mt-[6px]">
                        <button type="button" onClick={() => 후보로(x)} className={관.btnSm}>
                          수집 후보로 올리기
                        </button>
                      </div>
                    )}
                  </td>
                  <td className={관.td}>
                    <select className={작은칸} aria-label="상태"
                      value={x.상태 ?? '미처리'} onChange={(e) => 바꾸기(x, e.target.value)}>
                      {상태들.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input className={작은칸 + ' mt-[6px] block w-44'} placeholder="메모" aria-label="메모"
                      defaultValue={x.메모 ?? ''}
                      onBlur={(e) => { if (e.target.value !== (x.메모 ?? '')) 바꾸기(x, undefined, e.target.value); }} />
                  </td>
                </tr>
              ))}
              {d.줄.length === 0 && (
                <tr><td colSpan={5} className={관.empty}>아직 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>

      {/* ── 수집 후보 ── */}
      {d.수집후보.length > 0 && (
        <AdminSection title={`수집 대상 후보 ${d.수집후보.length}곳`}>
          <ul className={관.list}>
            {d.수집후보.map((c) => (
              <li key={c.기관명} className={관.row + ' flex flex-wrap items-center gap-[8px] text-[14px] text-[#112231]'}>
                <b>{c.기관명}</b>
                <span className={배지꼴('info')}>{c.상태}</span>
                <span className={관.sub}>{c.어디서}</span>
              </li>
            ))}
          </ul>
        </AdminSection>
      )}
    </div>
  );
}
