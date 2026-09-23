'use client';

import Link from 'next/link';
import { Icon } from '@/components/icon';
import { PayNote } from '@/components/pay-note';
import { tx, txLines, type Texts } from '@/lib/home-text';
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
          <h3 className="break-keep text-h3 font-bold text-ink">{title}</h3>
        </div>
        {/* 관리자가 넣은 줄바꿈을 그대로 살립니다 */}
        <p className="mt-2 whitespace-pre-line break-keep text-lg text-body">{body}</p>
        {children}
      </Card>
    </Reveal>
  );
}

/* ───────── 2. 참여 현황 ───────── */
export function Joined({ stats, texts }: { stats: HomeStats; texts: Texts }) {
  const t = (k: string, f?: Record<string, string | number>) => tx(texts, k, f);
  const rows = ['작업치료사', '물리치료사'].map((job) => ({
    job, hit: stats.joined.find((j) => j.job === job),
  }));

  return (
    <Reveal>
      <section className="py-8">
        <h2 className="break-keep text-h2 font-bold text-ink">{t('joined.title')}</h2>
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
        <PayNote className="mt-5 text-mute" />
        <p className="mt-2 whitespace-pre-line break-keep text-lg text-mute">
          {t('joined.tail', { min: stats.min_n })}
        </p>
      </section>
    </Reveal>
  );
}

/* ───────── 6. 급여 섹션 01~05 ───────── */
export function PaySection({ texts }: { texts: Texts }) {
  const t = (k: string) => tx(texts, k);
  return (
    <section className="py-8">
      <Reveal>
        <Eyebrow>{t('pay.eyebrow')}</Eyebrow>
        <h2 className="mt-5 whitespace-pre-line break-keep text-h1 font-bold leading-[1.25] text-ink">
          {t('pay.title')}
        </h2>
        <p className="mt-5 break-keep text-body-lg text-body">{t('pay.lead')}</p>
      </Reveal>

      <div className="mt-7">
        {/* 아이콘 이름과 번호는 코드에 둡니다 — 오타가 나면 아이콘이 점으로 떨어집니다 */}
        <Feature no="01" icon="bar-chart" title={t('pay.f01.title')} body={t('pay.f01.body')}>
          <Spread />
        </Feature>
        <Feature no="02" icon="trending-up" title={t('pay.f02.title')} body={t('pay.f02.body')}>
          <Compare />
        </Feature>
        <Feature no="03" icon="clock" title={t('pay.f03.title')} body={t('pay.f03.body')} />
        <Feature no="04" icon="calculator" title={t('pay.f04.title')} body={t('pay.f04.body')} />
        <Feature no="05" icon="share" title={t('pay.f05.title')} body={t('pay.f05.body')} />
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
export function JobSection({ stats, texts }: { stats: HomeStats; texts: Texts }) {
  const t = (k: string) => tx(texts, k);
  const all = therapists(stats);

  return (
    <section className="py-8">
      <Reveal>
        <Eyebrow>{t('job.eyebrow')}</Eyebrow>
        <h2 className="mt-5 whitespace-pre-line break-keep text-h1 font-bold leading-[1.25] text-ink">
          {t('job.title')}
        </h2>
      </Reveal>

      {/* 어두운 카드 — 여기 안에서는 기존 gray-* 를 씁니다 */}
      <Reveal>
        <div className="mt-6 rounded-sm bg-gray-900 p-7 text-white">
          <p className="break-keep text-body-lg text-gray-300">{t('job.dark.lead')}</p>
          <p className="mt-3 text-h1 font-bold leading-[1.3]">
            <Count to={stats.hospitals} /> 병원 · <Count to={all} /> 치료사
          </p>
          <p className="mt-2 break-keep text-body-lg text-gray-300">{t('job.dark.tail')}</p>

          <ul className="mt-6 flex flex-wrap gap-2">
            <Chip n={stats.ot} label="작업치료사" />
            <Chip n={stats.pt} label="물리치료사" />
            <Chip n={stats.hospitals} label="병원" />
          </ul>

          {/* 자료판(분기 표기)은 화면에 안 씁니다 — 분기가 지나면
              「낡은 자료」로 읽힙니다. 값은 lib/home.ts 가 계속 들고 있습니다 */}
          <p className="mt-5 break-keep text-sm text-gray-400">{t('job.dark.source')}</p>
        </div>
      </Reveal>

      <Reveal>
        <p className="mt-6 whitespace-pre-line break-keep text-body-lg text-body">
          {t('job.lead')}
        </p>
      </Reveal>

      <div className="mt-6">
        <Feature no="06" icon="building" title={t('job.f06.title')} body={t('job.f06.body')}>
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

        <Feature no="07" icon="flame" title={t('job.f07.title')} body={t('job.f07.body')}>
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

        <Feature no="08" icon="git-compare" title={t('job.f08.title')} body={t('job.f08.body')} />
        <Feature no="09" icon="map-pin" title={t('job.f09.title')} body={t('job.f09.body')} />
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
export function Together({ texts }: { texts: Texts }) {
  const t = (k: string) => tx(texts, k);
  /* 마지막 칸만 어둡게 칠합니다 — 「여기까지 가면」을 가리키는 자리입니다 */
  const steps = txLines(texts, 'together.steps').map((line, i, all) => {
    const [n, t] = line.split('|').map((x) => x.trim());
    return { n, t: t ?? '', on: i === all.length - 1 };
  });
  return (
    <Reveal>
      <section className="py-8">
        <h2 className="whitespace-pre-line break-keep text-h1 font-bold leading-[1.25] text-ink">
          {t('together.title')}
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
        <p className="mt-6 break-keep text-body-lg text-body">{t('together.tail')}</p>
      </section>
    </Reveal>
  );
}

/* ───────── 9. 익명 ───────── */
export function Anonymous({ texts }: { texts: Texts }) {
  const t = (k: string) => tx(texts, k);
  return (
    <Reveal>
      <section className="py-8">
        <h2 className="break-keep text-h1 font-bold text-ink">{t('anon.title')}</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="flex items-center gap-2 text-body-lg font-bold text-ink">
              <Icon name="x" size={16} className="text-mute" />
              {t('anon.no.title')}
            </p>
            <ul className="mt-3 space-y-2 break-keep text-lg text-body">
              {txLines(texts, 'anon.no.items').map((x) => <li key={x}>{x}</li>)}
            </ul>
          </Card>
          <Card>
            <p className="flex items-center gap-2 text-body-lg font-bold text-ink">
              <Icon name="check" size={16} className="text-teal-strong" />
              {t('anon.yes.title')}
            </p>
            <ul className="mt-3 space-y-2 break-keep text-lg text-body">
              {txLines(texts, 'anon.yes.items').map((x) => <li key={x}>{x}</li>)}
            </ul>
          </Card>
        </div>
      </section>
    </Reveal>
  );
}

/* ───────── 10. 이용 방법 ───────── */
export function HowTo({ texts }: { texts: Texts }) {
  const t = (k: string) => tx(texts, k);
  /* 아이콘 이름은 코드에 둡니다. 글만 DB 입니다 */
  const steps = [
    { icon: 'log-in', t: t('how.s1.t'), d: t('how.s1.d') },
    { icon: 'user-plus', t: t('how.s2.t'), d: t('how.s2.d') },
    { icon: 'users', t: t('how.s3.t'), d: t('how.s3.d') },
  ];
  return (
    <Reveal>
      <section className="py-8">
        <h2 className="break-keep text-h1 font-bold text-ink">{t('how.title')}</h2>
        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <li key={s.t}>
              <Card className="flex gap-5">
                <span className="num flex size-[28px] shrink-0 items-center justify-center rounded-md bg-ink text-sm font-bold text-white">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <b className="flex items-center gap-2 break-keep text-body-lg text-ink">
                    <Icon name={s.icon} size={16} />
                    {s.t}
                  </b>
                  <span className="mt-1 block break-keep text-lg text-body">{s.d}</span>
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
export function FinalCta({ stats, texts }: { stats: HomeStats; texts: Texts }) {
  const t = (k: string, f?: Record<string, string | number>) => tx(texts, k, f);
  return (
    <section className="-mx-6 mt-8 bg-gray-900 px-6 py-8 text-white md:-mx-7 md:px-7">
      <div className="mx-auto max-w-3xl">
        <p className="break-keep text-sm font-bold tracking-wide text-gray-400">{t('cta.eyebrow')}</p>
        <h2 className="mt-5 whitespace-pre-line break-keep text-h1 font-bold leading-[1.25]">
          {t('cta.title')}
        </h2>
        <Link
          href="/welcome"
          className="mt-7 block rounded-md bg-brand-red px-7 py-5 text-center text-body-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]"
        >
          {t('cta.button')}
        </Link>
        <p className="mt-7 whitespace-pre-line break-keep text-sm text-gray-400">
          {t('cta.source', { min: stats.min_n })}
        </p>
      </div>
    </section>
  );
}
