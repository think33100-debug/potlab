'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { AdminTitleCheck } from '@/components/admin-title-check';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { AdminSection, 관, 배지꼴 } from '@/components/rapo/rapo-admin-ui';

/* 손으로 확인할 곳 — 기계가 못 가는 병원 (2026-09-30).
 *
 * 「빠지지 않는 것이 자동화보다 중요합니다.」
 * 아마존 대역에서 막는 병원이 넷 있습니다. 서버를 서울로 옮겨도 안 풀립니다
 * (Lightsail 도 AWS 입니다). 그래서 버리지 않고 여기 남기고 사람이 봅니다.
 *
 * 하루 한 번 서버가 두드려 보고 결과를 남깁니다 — 병원이 막기를 그만두면
 * 「열림」 으로 바뀌어 바로 압니다.
 *
 * 자세한 것은 저장소의 `손으로_확인할곳.md`.
 */

type 줄 = {
  이름: string; 결과: string | null; 공고줄: number | null; 까닭: string | null;
  어디서: string | null; 마지막확인: string | null; 마지막열린날: string | null;
  사람이본날: string | null; 메모: string | null;
  확인한지며칠: number | null; 사람이본지며칠: number | null;
};

type 영자줄 = {
  때: string; 경로: string; 공고: string | null; 파일: string | null;
  바이트: number | null; 앞5: string | null; ctype: string | null;
  두번째도0: boolean; 원문: string | null;
};
type 영자 = { 오늘: number; 줄: 영자줄[] };

type 한도줄 = {
  서비스: string; 한도: number; 남음: number; 쓴양: number;
  몇퍼센트: number; 빨간줄: boolean; 본때: string;
};
type 한도 = { 넘은것: number; 줄: 한도줄[] };

const 날 = (s: string | null) => (s ? String(s).slice(0, 10) : '—');

export default function AdminHand() {
  const [d, setD] = useState<줄[] | null>(null);
  const [영, set영] = useState<영자 | null>(null);
  const [한, set한] = useState<한도 | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const 읽기 = useCallback(() => {
    browserSupabase().rpc('admin_hand_check').then(({ data, error }) => {
      if (error) setErr(error.message); else setD((data as 줄[]) ?? []);
    });
    /* PDF 를 글자로 못 바꾼 건 — 9월 30일에 한 번 나왔고 원인을 못 잡아 덫을 놨습니다 */
    browserSupabase().rpc('admin_ocr_zero').then(({ data }) => {
      if (data) set영(data as 영자);
    });
    /* 공공데이터 하루 한도 — 쓴 양은 신청 건마다 하나라 남이 써도 우리 몫이 줄어듭니다 */
    browserSupabase().rpc('admin_api_quota').then(({ data }) => {
      if (data) set한(data as 한도);
    });
  }, []);
  useEffect(읽기, [읽기]);

  const 봤다 = async (이름: string) => {
    const 메모 = prompt(
      ['「' + 이름 + '」 를 오늘 눈으로 보셨습니까?', '',
        '치료사 공고가 있었으면 메모에 적어 주세요.',
        '없었으면 그냥 확인만 눌러도 됩니다.'].join('\n'), '');
    if (메모 === null) return;
    const { error } = await browserSupabase()
      .rpc('admin_hand_check_seen', { p_이름: 이름, p_메모: 메모 || null });
    if (error) { setErr(error.message); return; }
    읽기();
  };

  if (err) return <p role="alert" className={관.error}>{err}</p>;
  if (!d) return <p className={관.muted}>잠시만요…</p>;

  const 막힌것 = d.filter((x) => x.결과 !== '열림');
  const 오래된것 = d.filter((x) => (x.사람이본지며칠 ?? 999) > 30);

  /* 2026-11-19 — 새 관리자 디자인으로 겉모양만 바꿨습니다 (알림 띠 · 표 · 배지).
     전에 쓰던 amber·emerald·red 색 이름은 이 저장소 토큰에 없어 색이 안 나오고 있었습니다 */
  return (
    <div className="max-w-[932px]">
      <RapoAdminHeader title="손으로 확인할 곳" />
      <p className={관.muted + ' -mt-[16px] mb-[24px] break-keep'}>
        기계가 못 가는 병원입니다. <b className="text-[#112231]">빠지지 않는 것이 자동화보다 중요합니다</b> —
        버리지 않고 여기 두고 사람이 봅니다.
      </p>

      {/* 제목 때문에 사람이 봐야 하는 네 갈래 (2026-10-05).
          위 목록은 **출처**(못 가는 병원)이고, 이것은 **공고 제목**입니다 —
          성격이 달라 섞지 않고 따로 둡니다 */}
      <AdminTitleCheck />

      <div className="mt-[32px] flex flex-col gap-[12px]">
        {막힌것.length > 0 && (
          <div className={관.warn}>
            <b>지금 {막힌것.length}곳이 막혀 있습니다.</b>
            <div className="mt-[4px]">
              아마존 대역을 막는 병원이라 <b>서버를 서울로 옮겨도 안 풀립니다</b>
              (Lightsail 도 아마존입니다). 집 인터넷에서는 열립니다.
              하루 한 번 서버가 두드려 보므로, 병원이 막기를 그만두면 바로 「열림」으로 바뀝니다.
            </div>
          </div>
        )}
        {오래된것.length > 0 && (
          <div className={관.error}>
            <b>사람이 한 달 넘게 안 본 곳이 {오래된것.length}곳입니다.</b>
            <div className="mt-[4px]">{오래된것.map((x) => x.이름).join(' · ')}</div>
          </div>
        )}
      </div>

      <AdminSection title="못 가는 병원" className="mt-[16px]">
        <div className={관.tableWrap}>
          <table className={관.table + ' min-w-[760px]'}>
            <thead className={관.thead}>
              <tr>
                <th className={관.th}>병원</th>
                <th className={관.th}>기계가 본 결과</th>
                <th className={관.th}>마지막 확인</th>
                <th className={관.th}>사람이 본 날</th>
                <th className={관.th}>메모</th>
                <th className={관.th}><span className="sr-only">확인</span></th>
              </tr>
            </thead>
            <tbody>
              {d.map((x) => (
                <tr key={x.이름} className={관.tr + ' align-top'}>
                  <td className={관.tdMain}>{x.이름}</td>
                  <td className={관.td}>
                    <span className={배지꼴(x.결과 === '열림' ? 'ok' : 'warn')}>
                      {x.결과 ?? '—'}
                    </span>
                    {x.공고줄 ? <span className="ml-[6px] text-[13px] text-[#555d6d]">공고 {x.공고줄}줄</span> : null}
                    <div className="mt-[4px] text-[13px] text-[#555d6d]">{x.까닭 ?? ''}</div>
                    <div className="text-[13px] text-[#555d6d]">{x.어디서 ?? ''}</div>
                  </td>
                  <td className={관.td}>
                    {날(x.마지막확인)}
                    {x.확인한지며칠 != null && x.확인한지며칠 > 2 && (
                      <div className="text-[13px] font-bold text-[#b42a21]">{x.확인한지며칠}일 전 — 자동 확인이 멈췄나요</div>
                    )}
                    {x.마지막열린날 && (
                      <div className="text-[13px] text-[#065a2e]">열린 적: {x.마지막열린날}</div>
                    )}
                  </td>
                  <td className={관.td}>
                    {x.사람이본날 ? (
                      <>
                        {x.사람이본날}
                        <div className={'text-[13px] ' + ((x.사람이본지며칠 ?? 0) > 30 ? 'font-bold text-[#b42a21]' : 'text-[#555d6d]')}>
                          {x.사람이본지며칠}일 전
                        </div>
                      </>
                    ) : <span className="font-bold text-[#b42a21]">아직 없음</span>}
                  </td>
                  <td className={관.td}>{x.메모 ?? ''}</td>
                  <td className={관.td}>
                    <button onClick={() => 봤다(x.이름)} className={관.btnSm}>
                      오늘 봤음
                    </button>
                  </td>
                </tr>
              ))}
              {d.length === 0 && (
                <tr><td colSpan={6} className={관.empty}>
                  손으로 확인할 곳이 없습니다
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>

      {한 && 한.줄.length > 0 && (
        <AdminSection title="공공데이터 하루 한도"
          sub={<span className={배지꼴(한.넘은것 ? 'coral' : 'ok')}>
            {한.넘은것 ? 한.넘은것 + '곳이 70%를 넘었습니다' : '넉넉합니다'}
          </span>}>
          <p className={관.muted}>
            쓴 양은 <b className="text-[#112231]">신청 건마다 하나</b>입니다 — 우리 열쇠가 둘이어도 같이 세고,
            남이 같은 신청 건을 쓰면 우리 몫도 줄어듭니다. 바닥나면 그날 공고를 못 받습니다.
            자정에 돌아옵니다.
          </p>
          <div className={관.tableWrap}>
            <table className={관.table + ' min-w-[600px]'}>
              <thead className={관.thead}>
                <tr>
                  <th className={관.th}>서비스</th>
                  <th className={관.th}>오늘 쓴 양</th>
                  <th className={관.th + ' w-40'}>얼마나</th>
                  <th className={관.th}>본 때</th>
                </tr>
              </thead>
              <tbody>
                {한.줄.map((x) => (
                  <tr key={x.서비스} className={관.tr}>
                    <td className={관.td + ' font-mono text-[12px]'}>
                      {x.서비스.replace(/^apis?\.data\.go\.kr/, '')}
                    </td>
                    <td className={관.td + ' whitespace-nowrap tabular-nums'}>
                      {x.쓴양.toLocaleString()} / {x.한도.toLocaleString()}
                    </td>
                    <td className={관.td}>
                      <div className="flex items-center gap-[8px]">
                        <div className="h-[8px] flex-1 rounded-full bg-[#f1f5f8]">
                          <div
                            className={'h-[8px] rounded-full ' + (x.빨간줄 ? 'bg-[#ff4f40]' : 'bg-[#304f65]')}
                            style={{ width: Math.min(100, Math.max(2, x.몇퍼센트)) + '%' }}
                          />
                        </div>
                        <span className={'w-10 text-right text-[13px] tabular-nums '
                          + (x.빨간줄 ? 'font-bold text-[#b42a21]' : 'text-[#555d6d]')}>
                          {x.몇퍼센트}%
                        </span>
                      </div>
                    </td>
                    <td className={관.td + ' whitespace-nowrap'}>{x.본때}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>
      )}

      {영 && 영.줄.length > 0 && (
        <AdminSection title="PDF 0자"
          sub={<span className={배지꼴(영.오늘 ? 'coral' : 'neutral')}>오늘 {영.오늘}건</span>}>
          <p className={관.muted}>
            PDF 는 받았는데 글자가 한 자도 안 나온 건입니다. <b className="text-[#112231]">한 번 더 해 보고</b>,
            두 번째도 0자면 보류함으로 보냅니다. 원인을 잡으려고 받은 크기·앞 5글자·
            content-type·응답 원문을 같이 남깁니다.
          </p>
          <div className={관.tableWrap}>
            <table className={관.table + ' min-w-[760px]'}>
              <thead className={관.thead}>
                <tr>
                  <th className={관.th}>때</th>
                  <th className={관.th}>경로 · 공고</th>
                  <th className={관.th}>파일</th>
                  <th className={관.th}>두 번째도</th>
                  <th className={관.th}>응답 원문</th>
                </tr>
              </thead>
              <tbody>
                {영.줄.map((x, i) => (
                  <tr key={i} className={관.tr + ' align-top'}>
                    <td className={관.td + ' whitespace-nowrap'}>{x.때}</td>
                    <td className={관.td}>
                      {x.경로}
                      {x.공고 ? <div className="text-[13px] text-[#555d6d]">{x.공고}</div> : null}
                    </td>
                    <td className={관.td}>
                      <div className="max-w-xs truncate">{x.파일 ?? '—'}</div>
                      <div className="text-[13px] text-[#555d6d]">
                        {x.바이트 ?? '?'}바이트 · 앞5 「{x.앞5 ?? ''}」
                      </div>
                      <div className="text-[13px] text-[#555d6d]">{x.ctype ?? ''}</div>
                    </td>
                    <td className={관.td}>
                      {x.두번째도0
                        ? <span className={배지꼴('coral')}>0자 — 보류함</span>
                        : <span className={배지꼴('ok')}>두 번째엔 읽음</span>}
                    </td>
                    <td className={관.td}>
                      <div className="max-h-24 max-w-md overflow-y-auto whitespace-pre-wrap break-all text-[12px] text-[#555d6d]">
                        {x.원문 ?? ''}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>
      )}

      <p className={관.sub + ' leading-relaxed'}>
        확인하는 법 — 병원 채용 페이지를 열어 물리치료사·작업치료사 공고가 있는지 보고,
        있으면 관리자 → 공고에서 손으로 넣은 뒤 「오늘 봤음」을 누르십시오.
        주소와 자세한 내력은 저장소의 <code>손으로_확인할곳.md</code> 에 있습니다.
      </p>
    </div>
  );
}
