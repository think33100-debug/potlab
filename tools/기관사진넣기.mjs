#!/usr/bin/env node
/* 기관 사진·마크 넣기 — 코덱스가 넘긴 묶음 하나를 web/lib/org-photos.json + web/public/org-photos/ 에 더합니다.
   (2026-11-23 세중님 「코덱스가 사진 2개 — 배경과 로고를 주면 너가 넣고 코덱스가 점검」)

   쓰는 법
     node tools/기관사진넣기.mjs <묶음폴더> --이름 <이름확인.json>            마른 실행 — 무엇을 넣을지만 찍습니다
     node tools/기관사진넣기.mjs <묶음폴더> --이름 <이름확인.json> --쓰기     넣습니다
     덧붙임  --직군 작업치료사   그 직군 공고에만 붙임 (없으면 그 기관 모든 공고 — 11/23 세중님 「모든 공고에」 · 보통은 안 씀)

   묶음폴더   목록.json + 그림 파일 (형식은 RAPO/기관이미지_코덱스/넣을것/읽어주세요_코덱스.md)
   이름확인    { "<기관번호>": ["공고에 쓰인 이름", …] } — 운영 DB 에서 읽어 만든 것.
              같은 이름이 다른 기관번호에도 쓰이면 넣지 않습니다(화면이 이름으로 찾기 때문 · lib/org-photo.ts).

   넣는 기준 (하나라도 어긋나면 그 기관은 건너뛰고 까닭을 찍습니다)
     · 파일이 있고 sha256 이 목록과 같다 · 앞 바이트가 jpg/png/webp 다 · 2MB 이하
     · 출처글·출처주소(https?://)가 있다 · 이름확인에 이름이 하나 이상 있다
   파일 이름은 기관번호에서 만든 영어 이름(org-<md5 10자>-bg.jpg)입니다 — 한글 경로 금지(지침 6-2b).
   되돌림: git 으로 web/lib/org-photos.json 과 web/public/org-photos/ 를 되돌립니다. */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const 뿌리 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 표파일 = path.join(뿌리, 'web/lib/org-photos.json');
const 그림터 = path.join(뿌리, 'web/public/org-photos');

const 인수 = process.argv.slice(2);
const 묶음 = 인수.find((a) => !a.startsWith('--'));
const 값 = (이름) => { const i = 인수.indexOf(이름); return i >= 0 ? 인수[i + 1] : null; };
const 쓰기 = 인수.includes('--쓰기');
const 직군 = 값('--직군');
const 이름파일 = 값('--이름');
if (!묶음 || !이름파일) {
  console.error('쓰는 법: node tools/기관사진넣기.mjs <묶음폴더> --이름 <이름확인.json> [--직군 작업치료사] [--쓰기]');
  process.exit(2);
}

const 목록 = JSON.parse(fs.readFileSync(path.join(묶음, '목록.json'), 'utf8'));
const 이름확인 = JSON.parse(fs.readFileSync(이름파일, 'utf8'));
const 표 = JSON.parse(fs.readFileSync(표파일, 'utf8'));

const 지문 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const 꼴 = (b) => (b[0] === 0xff && b[1] === 0xd8 ? 'jpg'
  : b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? 'png'
  : b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' ? 'webp' : null);
const 열쇠 = (no) => 'org-' + crypto.createHash('md5').update(no).digest('hex').slice(0, 10);

function 그림읽기(칸, 이름, 갈래) {
  if (!칸) return { 값: null };
  const 탈 = [];
  const f = path.join(묶음, 칸.파일 ?? '');
  if (!칸.파일 || !fs.existsSync(f)) return { 탈: [`${갈래} 파일 없음 (${칸.파일})`] };
  const b = fs.readFileSync(f);
  const k = 꼴(b);
  if (!k) 탈.push(`${갈래} jpg/png/webp 가 아님`);
  if (지문(b) !== String(칸.sha256 ?? '').toLowerCase()) 탈.push(`${갈래} 지문 다름 (목록 ${String(칸.sha256).slice(0, 8)} · 파일 ${지문(b).slice(0, 8)})`);
  if (b.length > 2 * 1024 * 1024) 탈.push(`${갈래} 2MB 넘음 (${(b.length / 1048576).toFixed(1)}MB)`);
  if (!칸.출처글 || !/^https?:\/\//.test(칸.출처주소 ?? '')) 탈.push(`${갈래} 출처글·출처주소 빠짐`);
  if (탈.length) return { 탈 };
  return { 값: { 파일: `${이름}.${k}`, sha256: 지문(b), 출처글: 칸.출처글, 출처주소: 칸.출처주소 }, 바이트: b };
}

let 넣음 = 0, 건넘 = 0;
const 오늘 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
for (const 줄 of 목록) {
  const no = 줄.기관번호;
  const 이름들 = 이름확인[no];
  const 탈 = [];
  if (!/^(HIRA|NAME):/.test(no ?? '')) 탈.push('기관번호 꼴이 아님');
  if (!Array.isArray(이름들) || 이름들.length === 0) 탈.push('이름확인에 없음 (DB 에서 공고 이름을 읽어 넣어야 함)');
  const 배경 = 그림읽기(줄.배경, `${열쇠(no ?? '')}-bg`, '배경');
  const 로고 = 그림읽기(줄.로고, `${열쇠(no ?? '')}-logo`, '로고');
  if (!줄.배경) 탈.push('배경 없음');
  탈.push(...(배경.탈 ?? []), ...(로고.탈 ?? []));
  if (탈.length) { 건넘++; console.log(`✗ ${줄.이름 ?? no} — ${탈.join(' · ')}`); continue; }

  const 새줄 = {
    기관번호: no, ref: 줄.institution_ref ?? undefined, 이름들, 직군: 직군 ?? null,
    설명: `${줄.이름} 건물 전경`, 배경: 배경.값, 로고: 로고.값, 넣은날: 오늘,
  };
  const 있던 = 표.findIndex((s) => s.기관번호 === no);
  console.log(`${있던 >= 0 ? '↻ 바꿈' : '＋ 더함'} ${줄.이름} — 배경 ${배경.값.파일}${로고.값 ? ' · 로고 ' + 로고.값.파일 : ' · 로고 없음'} · 이름 ${이름들.join('/')}`);
  if (쓰기) {
    fs.mkdirSync(그림터, { recursive: true });
    fs.writeFileSync(path.join(그림터, 배경.값.파일), 배경.바이트);
    if (로고.값) fs.writeFileSync(path.join(그림터, 로고.값.파일), 로고.바이트);
    if (있던 >= 0) 표[있던] = 새줄; else 표.push(새줄);
  }
  넣음++;
}
if (쓰기) fs.writeFileSync(표파일, JSON.stringify(표, null, 2) + '\n');
console.log(`\n${쓰기 ? '넣음' : '(마른 실행) 넣을 것'} ${넣음} · 건넘 ${건넘} · 표 ${표.length}줄`);
