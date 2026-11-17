"""릴스·스토리 배경음 — 직접 합성 (저작권 걱정 없음) · 2026-11-17 세중님 「기존 건 너무 구려 · AI가 만든 것 같지 않은 걸로 샘플」

  python3 tools/reels/배경음.py <나갈폴더> [초]      → lofi.wav · acoustic.wav · citypop.wav

  옛 자리 채움(music-placeholder.mjs)은 사인파 패드라 「컴퓨터 소리」가 났습니다. 여기서는
    · 악기마다 배음을 따로 쌓고 높은 배음일수록 빨리 사그라들게 (기타·일렉피아노 결)
    · 사람 손처럼 박자를 ±몇 ms 흔들고 세기를 다르게 (기계처럼 딱딱 맞지 않게)
    · 방 울림(잔향) · 테이프 결(로파이) 을 입힙니다
  numpy 만 씁니다. 마무리(압축·음량 맞추기·페이드)는 ffmpeg 가 합니다.
"""
import sys, os, wave
import numpy as np

SR = 44100
rng = np.random.default_rng(7)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def 빈(sec):
    return np.zeros((2, int(SR * sec) + SR))


def 놓기(버퍼, 소리, t, 팬=0.0, 세기=1.0):
    i = int(t * SR)
    if i < 0:
        return
    n = min(len(소리), 버퍼.shape[1] - i)
    if n <= 0:
        return
    l = np.cos((팬 + 1) * np.pi / 4)
    r = np.sin((팬 + 1) * np.pi / 4)
    버퍼[0, i:i + n] += 소리[:n] * l * 세기
    버퍼[1, i:i + n] += 소리[:n] * r * 세기


def 사람(t, ms=9):
    return t + rng.normal(0, ms / 1000)


def 거름(x, 낮=None, 높=None):
    """FFT 로 자르기 — 낮 이하 · 높 이상을 부드럽게 깎음"""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if 높:
        g *= 1 / np.sqrt(1 + (f / 높) ** 4)
    if 낮:
        g *= 1 / np.sqrt(1 + (낮 / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X * g, n)


# ── 악기 ──
def 줄(f, 길이=2.5, 밝기=1.0, 세기=1.0):
    """뜯는 현 — 배음마다 따로 사그라듦 (높을수록 빨리) · 약간의 비조화성"""
    t = np.arange(int(SR * 길이)) / SR
    s = np.zeros_like(t)
    for k in range(1, 18):
        fk = f * k * (1 + 0.0004 * k * k)
        if fk > 16000:
            break
        a = (1 / k ** 1.1) * np.exp(-t * (1.2 + 0.9 * k / 밝기))
        s += a * np.sin(2 * np.pi * fk * t + rng.uniform(0, 6.28))
    s *= np.minimum(1, t / 0.002)
    return s * 0.35 * 세기


def 일렉피아노(f, 길이=2.8, 세기=1.0):
    """FM 일렉 피아노 — 치는 순간 종소리 배음이 빠르게 사라지고 둥근 몸통이 남음 · 약한 트레몰로"""
    t = np.arange(int(SR * 길이)) / SR
    idx = 1.6 * np.exp(-t * 7) + 0.25
    body = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    bell = 0.18 * np.sin(2 * np.pi * f * 14 * t) * np.exp(-t * 18)
    env = np.minimum(1, t / 0.004) * np.exp(-t * 1.1)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.6 * t)
    return (body + bell) * env * trem * 0.22 * 세기


def 베이스(f, 길이=0.6, 세기=1.0):
    t = np.arange(int(SR * 길이)) / SR
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    env = np.minimum(1, t / 0.006) * np.exp(-t * 2.2)
    env[-int(SR * 0.03):] *= np.linspace(1, 0, int(SR * 0.03))
    return np.tanh(1.4 * s) * env * 0.32 * 세기


def 킥(세기=1.0):
    t = np.arange(int(SR * 0.45)) / SR
    f = 46 + 90 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7.5) + 0.25 * rng.normal(0, 1, len(t)) * np.exp(-t * 250)
    return np.tanh(1.6 * s) * 0.6 * 세기


def 스네어(세기=1.0, 밝기=7000):
    t = np.arange(int(SR * 0.3)) / SR
    n = 거름(rng.normal(0, 1, len(t)), 낮=900, 높=밝기) * np.exp(-t * 17)
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 28)
    return (0.55 * n + 0.45 * body) * 0.5 * 세기


def 손뼉(세기=1.0):
    t = np.arange(int(SR * 0.25)) / SR
    s = np.zeros_like(t)
    for d in (0, 0.009, 0.018):
        i = int(d * SR)
        s[i:] += rng.normal(0, 1, len(t) - i) * np.exp(-t[: len(t) - i] * (60 if d < 0.018 else 14))
    return 거름(s, 낮=1100, 높=9000) * 0.32 * 세기


def 하이햇(세기=1.0, 열림=False):
    t = np.arange(int(SR * (0.35 if 열림 else 0.07))) / SR
    s = 거름(rng.normal(0, 1, len(t)), 낮=7000) * np.exp(-t * (9 if 열림 else 70))
    return s * 0.22 * 세기


def 셰이커(세기=1.0):
    t = np.arange(int(SR * 0.09)) / SR
    env = np.minimum(1, t / 0.02) * np.exp(-t * 40)
    return 거름(rng.normal(0, 1, len(t)), 낮=4500, 높=12000) * env * 0.15 * 세기


# ── 공간 ──
def 잔향(x, 길이=1.6, 섞기=0.22, 어둡게=5000):
    n = int(SR * 길이)
    t = np.arange(n) / SR
    ir = rng.normal(0, 1, (2, n)) * np.exp(-t * (6.9 / 길이))
    ir = np.stack([거름(ir[0], 높=어둡게), 거름(ir[1], 높=어둡게)])
    ir[:, : int(SR * 0.012)] = 0
    m = x.shape[1] + n
    L = 1 << (m - 1).bit_length()
    wet = np.stack([np.fft.irfft(np.fft.rfft(x[c], L) * np.fft.rfft(ir[c], L), L)[: x.shape[1]] for c in range(2)])
    wet /= (np.max(np.abs(wet)) + 1e-9) / (np.max(np.abs(x)) + 1e-9)
    return x * (1 - 섞기) + wet * 섞기


def 테이프(x, 바늘=True):
    """로파이 — 고음을 깎고 아주 약한 흔들림 · 레코드 바늘 소리"""
    y = np.stack([거름(x[0], 낮=40, 높=5200), 거름(x[1], 낮=40, 높=5200)])
    if 바늘:
        n = y.shape[1]
        hiss = 거름(rng.normal(0, 1, n), 낮=2000, 높=9000) * 0.004
        pops = np.zeros(n)
        idx = rng.choice(n, size=int(n / SR * 9), replace=False)
        pops[idx] = rng.uniform(0.02, 0.09, len(idx)) * rng.choice([-1, 1], len(idx))
        pops = 거름(pops, 낮=900)
        y += hiss + pops
    return y


# ── 곡 셋 ──
def 로파이(sec):
    """78 BPM · Fmaj9 - Em7 - Dm9 - Cmaj7 · 일렉피아노 + 스윙 드럼 + 바늘 소리"""
    bpm = 78; b = 60 / bpm; 버 = 빈(sec)
    진행 = [[53, 57, 60, 64, 67], [52, 55, 59, 62, 67], [50, 53, 57, 60, 64], [48, 52, 55, 59, 64]]
    근음 = [41, 40, 38, 36]
    마디 = 0; t0 = 0.0
    while t0 < sec:
        ch = 진행[마디 % 4]
        for j, m in enumerate(ch):                  # 살짝 흩어 치기 (손으로 굴리듯)
            놓기(버, 일렉피아노(hz(m), 4 * b + 0.6, 세기=rng.uniform(0.75, 1.0)), 사람(t0 + j * 0.018, 5), 팬=-0.3 + 0.15 * j)
        if 마디 % 2:                                # 둘째 박 뒤에 짧게 한 번 더
            for m in ch[1:4]:
                놓기(버, 일렉피아노(hz(m), 1.2, 0.45), 사람(t0 + 2.5 * b, 8), 팬=0.25)
        놓기(버, 베이스(hz(근음[마디 % 4]), 1.6 * b), 사람(t0, 4))
        놓기(버, 베이스(hz(근음[마디 % 4] + 7), 0.8 * b, 0.7), 사람(t0 + 2.75 * b, 6))
        for k in range(4):
            if k in (0,) or (k == 2 and rng.random() < 0.6):
                놓기(버, 킥(rng.uniform(0.85, 1)), 사람(t0 + k * b, 6))
            if k in (1, 3):
                놓기(버, 스네어(rng.uniform(0.7, 0.9), 4500), 사람(t0 + k * b + 0.012, 8), 팬=0.05)
            for h in (0, 1):                         # 스윙 8분 (뒤를 늦게)
                놓기(버, 하이햇(rng.uniform(0.35, 0.7) if h else rng.uniform(0.6, 0.9)), 사람(t0 + k * b + h * b * 0.62, 7), 팬=0.35)
        t0 += 4 * b; 마디 += 1
    return 테이프(잔향(버, 1.8, 0.2, 3500))


def 어쿠스틱(sec):
    """100 BPM · C - G - Am - F · 줄 스트럼(D DU UDU) + 셰이커 + 손뼉"""
    bpm = 100; b = 60 / bpm; 버 = 빈(sec)
    진행 = [[48, 55, 60, 64, 67, 72], [43, 50, 55, 59, 62, 67], [45, 52, 57, 60, 64, 69], [41, 48, 53, 57, 60, 65]]
    근음 = [36, 31, 33, 29]
    패턴 = [(0, 'D', 1.0), (1, 'D', 0.7), (1.5, 'U', 0.55), (2.5, 'U', 0.6), (3, 'D', 0.75), (3.5, 'U', 0.5)]
    마디 = 0; t0 = 0.0
    while t0 < sec:
        ch = 진행[마디 % 4]
        for (p, 방향, 세) in 패턴:
            순 = ch if 방향 == 'D' else ch[::-1][:4]
            for j, m in enumerate(순):             # 줄을 차례로 긁는 시간차
                놓기(버, 줄(hz(m), 2.2, 밝기=1.3 if 방향 == 'U' else 1.0, 세기=세 * rng.uniform(0.85, 1)),
                     사람(t0 + p * b + j * 0.011, 6), 팬=-0.35 + 0.12 * j)
        놓기(버, 베이스(hz(근음[마디 % 4]), 1.8 * b, 0.9), 사람(t0, 4))
        놓기(버, 베이스(hz(근음[마디 % 4]), 1.2 * b, 0.7), 사람(t0 + 2.5 * b, 5))
        for k in range(8):
            놓기(버, 셰이커(rng.uniform(0.6, 1.0) * (1.0 if k % 2 else 0.7)), 사람(t0 + k * b / 2, 6), 팬=0.45)
        for k in range(4):
            if k in (0, 2):
                놓기(버, 킥(0.55), 사람(t0 + k * b, 5))
            else:
                놓기(버, 손뼉(rng.uniform(0.8, 1)), 사람(t0 + k * b, 7), 팬=-0.1)
        t0 += 4 * b; 마디 += 1
    return 잔향(버, 1.4, 0.18, 7000)


def 시티팝(sec):
    """112 BPM · Dmaj9 - C#m7 - Bm9 - E9 · 일렉피아노 엇박 + 통통 튀는 베이스 + 손뼉 · 밝게"""
    bpm = 112; b = 60 / bpm; 버 = 빈(sec)
    진행 = [[54, 57, 61, 64, 69], [52, 56, 59, 64, 68], [50, 54, 57, 61, 64], [52, 56, 59, 62, 66]]
    근음 = [38, 37, 35, 40]
    베이스꼴 = [(0, 0, 0.9), (0.75, 12, 0.6), (1.5, 0, 0.8), (2.5, 7, 0.7), (3, 12, 0.55), (3.5, 10, 0.6)]
    마디 = 0; t0 = 0.0
    while t0 < sec:
        ch = 진행[마디 % 4]
        for (p, 길이, 세) in [(0, 1.4, 0.9), (1.5, 0.5, 0.6), (2.5, 0.9, 0.75), (3.5, 0.4, 0.5)]:
            for j, m in enumerate(ch):
                놓기(버, 일렉피아노(hz(m + 12 * (j == 4)), 길이 * b + 0.3, 세 * rng.uniform(0.85, 1)), 사람(t0 + p * b + j * 0.006, 5), 팬=-0.2 + 0.1 * j)
        for (p, 간격, 세) in 베이스꼴:
            놓기(버, 베이스(hz(근음[마디 % 4] + 간격), 0.42 * b, 세), 사람(t0 + p * b, 4))
        for k in range(4):
            놓기(버, 킥(0.75 if k % 2 == 0 else 0.5), 사람(t0 + k * b, 4))
            if k in (1, 3):
                놓기(버, 손뼉(0.9), 사람(t0 + k * b, 6), 팬=0.1)
                놓기(버, 스네어(0.4, 9000), 사람(t0 + k * b, 6))
            for h in range(4):
                열림 = (h == 2 and k == 3)
                놓기(버, 하이햇(rng.uniform(0.4, 0.8), 열림), 사람(t0 + k * b + h * b / 4, 4), 팬=0.4)
        t0 += 4 * b; 마디 += 1
    return 잔향(버, 1.2, 0.16, 8000)


def 쓰기(x, 길, sec):
    x = x[:, : int(SR * sec)]
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
    y = (np.clip(x.T, -1, 1) * 32767).astype('<i2')
    with wave.open(길, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(y.tobytes())


if __name__ == '__main__':
    나감 = sys.argv[1] if len(sys.argv) > 1 else '.'
    sec = float(sys.argv[2]) if len(sys.argv) > 2 else 15
    os.makedirs(나감, exist_ok=True)
    for 이름, 곡 in (('lofi', 로파이), ('acoustic', 어쿠스틱), ('citypop', 시티팝)):
        쓰기(곡(sec), os.path.join(나감, 이름 + '.wav'), sec)
        print('○', 이름)
