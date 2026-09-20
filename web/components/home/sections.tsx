'use client';

import Link from 'next/link';
import { Icon } from '@/components/icon';
import { Count } from './hero';
import { useSeen } from '@/lib/reveal';
import { therapists, type HomeStats } from '@/lib/home';

/* 홈 랜딩의 구역들.

   밝은 구역은 따뜻한 회색(--color-paper/card/line/body/mute)을 씁니다.
   바탕이 누런 종이색이라 푸른 회색 테두리를 두르면 테두리만 떠 보입니다.
   어두운 구역(어두운 카드 안) 에서만 기존 gray-* 를 씁니다.

   빨강은 셋만 씁니다 — 버튼 바탕, 24px 이상 큰 숫자, 눈썹 앞의 짧은 선.
   작은 글자에는 안 씁니다(#FF3B30 위 흰 글자가 3.55:1 이라 작으면 흐려집니다). */

/* 화면에 들어올 때 아래에서 살짝 올라옵니다. 한 번만 (lib/reveal.ts) */
export function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { ref, seen } = useSeen<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${seen ? 'reveal-on' : ''} ${className}`}>
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3">
      <span aria-hidden className="h-[2px] w-[20px] shrink-0 bg-brand-red" />
      <span className="text-sm font-bold tracking-wide text-mute">{children}</span>
    </p>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-sm border border-line bg-card p-6 ${className}`}>{children}</div>
  );
}

/* 번호가 붙는 기능 카드. 01~09 */
function Feature({
  no, icon, title, body, children,
}: {
  no: string; icon: string; title: string; body: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <Reveal>
      <Card className="mt-3 first:mt-0">
        <div className="flex items-center gap-3">
          <span className="num text-sm font-bold text-mute">{no}</span>
          <Icon name={icon} size={18} className="text-ink" />
          <h3 className="text-h3 font-bold text-ink">{title}</h3>
        </div>
        <p className="mt-2 text-lg text-body">{body}</p>
        {children}
      </Card>
    </Reveal>
  );
}

/* ───────── 2. 참여 현황 ───────── */
export function Joined({ stats }: { stats: HomeStats }) {
  const rows = ['작업치료사', '물리치료사'].map((job) => ({
    job, hit: stats.joined.find((j) => j.job === job),
  }));

  return (
    <Reveal>
      <section className="py-8">
        <h2 className="text-h2 font-bold text-ink">지금까지 모인 것</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {rows.map(({ job, hit }) => (
            <li key={job}>
              <Card>
                <p className="text-body-lg font-bold text-ink">{job}</p>
                <p className="mt-1 text-lg text-body">
                  {hit ? `${hit.n}명 참여` : '0명 참여'}
                  {' · '}
                  {hit?.mid != null ? `중위 ${hit.mid}만원` : '아직 집계 전'}
                </p>
              </Card>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-lg text-mute">
          {stats.min_n}명이 안 되면 안 보여드려요.
          통계가 아니라 그냥 누구 한 명 얘기가 되니까요.
        </p>
      </section>
    </Reveal>
  );
}

/* ───────── 6. 급여 섹션 01~05 ───────── */
export function PaySection() {
  return (
    <section className="py-8">
      <Reveal>
        <Eyebrow>주 기능 · 급여</Eyebrow>
        <h2 className="mt-5 text-h1 font-bold leading-[1.25] text-ink">
          내 연봉을<br />숫자로 확인합니다
        </h2>
        <p className="mt-5 text-body-lg text-body">
          작업치료사랑 물리치료사는 따로 집계해요. 섞으면 의미가 없거든요.
        </p>
      </Reveal>

      <div className="mt-7">
        <Feature
          no="01" icon="bar-chart" title="내 위치"
          body={<>같은 직군, 같은 연차, 같은 병원유형에서 내가 상위 몇 %인지.<br />
                상여까지 넣어 연 단위로 환산한 기준입니다.</>}
        >
          <Spread />
        </Feature>

        <Feature
          no="02" icon="trending-up" title="이직하면 얼마나 달라질까"
          body={<>병원유형이나 지역을 바꾸면 중위값이 얼마나 달라지는지 봐요.<br />
                월로도 보고 연으로도 봅니다.</>}
        >
          <Compare />
        </Feature>

        <Feature
          no="03" icon="clock" title="진짜 시급"
          body={<>당직이랑 주말까지 넣어서 계산합니다.<br />
                월급은 위인데 시급은 아래인 경우, 여기서 드러나요.</>}
        />
        <Feature
          no="04" icon="calculator" title="세전 · 세후 계산기"
          body="2026년 요율 기준입니다. 공제 내역까지 하나씩 보여드려요."
        />
        <Feature
          no="05" icon="share" title="결과 카드"
          body="내 위치를 카드 이미지로 저장하거나, 링크로 친구한테 보낼 수 있어요."
        />
      </div>
    </section>
  );
}

/* 01 — 분포 막대. 내 자리만 빨강입니다.
   보여주기용 모양이라 숫자를 자료로 쓰지 않습니다 (「예시」라고 적습니다) */
function Spread() {
  const { ref, seen } = useSeen<HTMLDivElement>();
  const bars = [8, 16, 30, 52, 74, 96, 82, 58, 34, 18];
  const mine = 7;

  return (
    <div ref={ref} className="mt-6">
      <div className="flex h-[72px] items-end gap-1">
        {bars.map((h, i) => (
          <span
            key={i}
            className={'flex-1 rounded-xs ' + (i === mine ? 'bg-brand-red' : 'bg-line')}
            style={{
              height: `${h}%`,
              transition: 'transform 0.7s cubic-bezier(0.22,1,0.36,1)',
              transitionDelay: `${i * 45}ms`,
              transformOrigin: 'bottom',
              transform: seen ? 'scaleY(1)' : 'scaleY(0)',
            }}
          />
        ))}
      </div>
      <p className="mt-3 text-lg">
        <b className="text-ink">상위 23%</b>
        <span className="text-mute"> · 같은 조건 47명 중</span>
      </p>
      <p className="mt-1 text-sm text-mute">화면 예시입니다</p>
    </div>
  );
}

/* 02 — 비교 막대 */
function Compare() {
  const { ref, seen } = useSeen<HTMLDivElement>();
  const rows = [
    { name: '대학병원', w: 100, right: '+31만원 (연 +372만원)', hot: true },
    { name: '요양병원 (지금)', w: 72, right: '±0', hot: false },
  ];
  return (
    <div ref={ref} className="mt-6 space-y-3">
      {rows.map((r, i) => (
        <div key={r.name}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-lg text-body">{r.name}</span>
            <span className={'text-lg font-bold ' + (r.hot ? 'text-ink' : 'text-mute')}>{r.right}</span>
          </div>
          <div className="mt-1 h-2 rounded-md bg-line">
            <div
              className={'h-2 rounded-md ' + (r.hot ? 'bg-brand-red' : 'bg-mute')}
              style={{
                width: `${r.w}%`,
                transformOrigin: 'left',
                transition: 'transform 0.7s cubic-bezier(0.22,1,0.36,1)',
                transitionDelay: `${i * 120}ms`,
                transform: seen ? 'scaleX(1)' : 'scaleX(0)',
              }}
            />
          </div>
        </div>
      ))}
      <p className="text-sm text-mute">화면 예시입니다</p>
    </div>
  );
}

/* ───────── 7. 취업·이직 섹션 06~09 ───────── */
export function JobSection({ stats }: { stats: HomeStats }) {
  const all = therapists(stats);

  return (
    <section className="py-8">
      <Reveal>
        <Eyebrow>취업 · 이직</Eyebrow>
        <h2 className="mt-5 text-h1 font-bold leading-[1.25] text-ink">
          이직 준비 중이시라면<br />여기부터 보세요
        </h2>
      </Reveal>

      {/* 어두운 카드 — 여기 안에서는 기존 gray-* 를 씁니다 */}
      <Reveal>
        <div className="mt-6 rounded-sm bg-gray-900 p-7 text-white">
          <p className="text-body-lg text-gray-300">작업치료사 · 물리치료사를 위해</p>
          <p className="mt-3 text-h1 font-bold leading-[1.3]">
            <Count to={stats.hospitals} /> 병원 · <Count to={all} /> 치료사
          </p>
          <p className="mt-2 text-body-lg text-gray-300">의 자료를 모았어요</p>

          <ul className="mt-6 flex flex-wrap gap-2">
            <Chip n={stats.ot} label="작업치료사" />
            <Chip n={stats.pt} label="물리치료사" />
            <Chip n={stats.hospitals} label="병원" />
          </ul>

          {stats.hira_ver && (
            <p className="mt-5 text-sm text-gray-400">
              건강보험심사평가원 {stats.hira_ver} 기준
            </p>
          )}
        </div>
      </Reveal>

      <Reveal>
        <p className="mt-6 text-body-lg text-body">
          인력이랑 병상, 진료과목을 병원 한 곳 단위로 다시 묶었습니다.
          치료사한테 필요한 것만 남겼어요.
        </p>
      </Reveal>

      <div className="mt-6">
        <Feature
          no="06" icon="building" title="병원 뜯어보기"
          body="치료사 인원, 병상 수, 재활의학과 전문의까지 한 화면에서 봅니다."
        >
          <div className="mt-5 rounded-xs border border-line p-5">
            <p className="text-body-lg font-bold text-ink">○○재활병원</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 text-lg text-body">
              <Row k="병상" v="290" />
              <Row k="재활의학과" v="7명" />
              <Row k="작업치료사" v="24" />
              <Row k="물리치료사" v="38" />
              <Row k="1인당 병상" v="12.1" />
            </dl>
            <p className="mt-3 text-sm text-mute">화면 예시입니다</p>
          </div>
        </Feature>

        <Feature
          no="07" icon="flame" title="얼마나 바쁜 곳인지"
          body={<>치료사 한 명이 몇 명을 맡는지, 재활 환자가 많은 병원인지 따져봐요.<br />
                바쁜 곳인지 여유로운 곳인지 알려드립니다.</>}
        >
          <div className="mt-5 rounded-xs border border-line p-5">
            <p className="flex items-center gap-2 text-body-lg font-bold text-ink">
              <Icon name="flame" size={16} className="text-brand-red" />
              바쁜 곳
            </p>
            <p className="mt-1 text-lg text-body">회복기 재활병원 · 사람 뽑을 가능성 높아요</p>
            <p className="mt-1 text-lg text-mute">일이 많은 만큼 사람도 더 필요하거든요</p>
            <p className="mt-3 text-sm text-mute">화면 예시입니다</p>
          </div>
        </Feature>

        <Feature
          no="08" icon="git-compare" title="두 곳 비교"
          body="고민되는 병원 두 곳을 나란히 놓고 봐요. 분점도 다 나옵니다."
        />
        <Feature
          no="09" icon="map-pin" title="지역별 병원 찾기"
          body={<>내 지역에서 치료사가 일하는 병원 목록입니다.<br />공고가 없어도 미리 봐두세요.</>}
        />
      </div>
    </section>
  );
}

function Chip({ n, label }: { n: number; label: string }) {
  return (
    <li className="rounded-md border border-gray-700 px-5 py-2 text-lg">
      <b><Count to={n} /></b>
      <span className="ml-2 text-gray-400">{label}</span>
    </li>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-mute">{k}</dt>
      <dd className="text-right font-bold text-ink">{v}</dd>
    </>
  );
}

/* ───────── 8. 함께 만듭니다 ───────── */
export function Together() {
  const steps = [
    { n: '5명', t: '참고만' },
    { n: '30명', t: '연차별' },
    { n: '100명', t: '지역·유형별' },
    { n: '300명', t: '세부 조건까지', on: true },
  ];
  return (
    <Reveal>
      <section className="py-8">
        <h2 className="text-h1 font-bold leading-[1.25] text-ink">
          한 명이 더 넣을수록<br />정확해집니다
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {steps.map((s) => (
            <li key={s.n}>
              <div className={
                'rounded-sm p-6 ' +
                (s.on ? 'bg-gray-900 text-white' : 'border border-line bg-card')
              }>
                <p className={'text-h2 font-bold ' + (s.on ? '' : 'text-ink')}>{s.n}</p>
                <p className={'mt-1 text-lg ' + (s.on ? 'text-gray-300' : 'text-mute')}>{s.t}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-body-lg text-body">
          내가 넣은 숫자 하나가 다음 사람의 기준이 돼요.
        </p>
      </section>
    </Reveal>
  );
}

/* ───────── 9. 익명 ───────── */
export function Anonymous() {
  return (
    <Reveal>
      <section className="py-8">
        <h2 className="text-h1 font-bold text-ink">이름은 안 물어봐요</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="flex items-center gap-2 text-body-lg font-bold text-ink">
              <Icon name="x" size={16} className="text-mute" />
              받지 않는 것
            </p>
            <ul className="mt-3 space-y-2 text-lg text-body">
              <li>이름 · 연락처 · 이메일</li>
              <li>다니는 병원 이름</li>
              <li>생년월일 · 상세 주소</li>
            </ul>
          </Card>
          <Card>
            <p className="flex items-center gap-2 text-body-lg font-bold text-ink">
              <Icon name="check" size={16} className="text-teal-strong" />
              받는 것
            </p>
            <ul className="mt-3 space-y-2 text-lg text-body">
              <li>닉네임 (본명 아니어도 됩니다)</li>
              <li>권역 · 출생연도</li>
              <li>연차 · 병원유형 · 급여</li>
            </ul>
          </Card>
        </div>
      </section>
    </Reveal>
  );
}

/* ───────── 10. 이용 방법 ───────── */
export function HowTo() {
  const steps = [
    { icon: 'log-in', t: '카카오 · 네이버로 로그인', d: '이름이나 연락처는 안 넘어옵니다' },
    { icon: 'user-plus', t: '내 정보 등록', d: '연차, 병원유형, 급여. 3분쯤 걸려요' },
    { icon: 'users', t: '단톡방 입장', d: '가입하신 분만 들어갑니다. 새 공고를 제일 먼저 받아보세요' },
  ];
  return (
    <Reveal>
      <section className="py-8">
        <h2 className="text-h1 font-bold text-ink">3분이면 끝나요</h2>
        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <li key={s.t}>
              <Card className="flex gap-5">
                <span className="num flex size-[28px] shrink-0 items-center justify-center rounded-md bg-ink text-sm font-bold text-white">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <b className="flex items-center gap-2 text-body-lg text-ink">
                    <Icon name={s.icon} size={16} />
                    {s.t}
                  </b>
                  <span className="mt-1 block text-lg text-body">{s.d}</span>
                </span>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </Reveal>
  );
}

/* ───────── 11. 마지막 CTA + 출처 ───────── */
export function FinalCta({ stats }: { stats: HomeStats }) {
  return (
    <section className="-mx-6 mt-8 bg-gray-900 px-6 py-8 text-white md:-mx-7 md:px-7">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-bold tracking-wide text-gray-400">POTJOB</p>
        <h2 className="mt-5 text-h1 font-bold leading-[1.25]">
          치료사의 숫자는<br />치료사가 만듭니다
        </h2>
        <Link
          href="/welcome"
          className="mt-7 block rounded-md bg-brand-red px-7 py-5 text-center text-body-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]"
        >
          지금 시작하기
        </Link>
        <p className="mt-7 text-sm text-gray-400">
          건강보험심사평가원 {stats.hira_ver ?? ''} 병원 자료, 공공기관 채용공시,
          회원이 직접 등록한 급여입니다. {stats.min_n}명이 안 되는 조건은 안 보여드립니다.
        </p>
      </div>
    </section>
  );
}
