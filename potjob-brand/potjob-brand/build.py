import json, math, os, shutil
import cairosvg
from PIL import Image

OUT = "/home/claude/brand"
RED   = "#FF3B30"
INK   = "#14181C"
WHITE = "#FFFFFF"
TAN11 = math.tan(math.radians(11))

def t_points(S, x0f, x1f, bar_top=.16, bar_bot=.44, sl=.365, sr=.635, cut=.86, bot=1.0):
    """스피드 컷 T. 좌표는 S 크기 정사각 기준, 11도 기울임 적용."""
    cy = S/2
    raw = [(x0f,bar_top),(x1f,bar_top),(x1f,bar_bot),(sr,bar_bot),
           (sr,cut),(sl,bot),(sl,bar_bot),(x0f,bar_bot)]
    pts=[]
    for xf,yf in raw:
        x,y = xf*S, yf*S
        pts.append((x - TAN11*(y-cy), y))
    return pts

def poly(pts):
    return " ".join(f"{x:.2f},{y:.2f}" for x,y in pts)

def bbox(pts):
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
    return min(xs),min(ys),max(xs),max(ys)

# ---------- 아이콘 ----------
def icon_svg(S, bg=RED, fg=WHITE, bleed=True, rounded=None):
    pts = t_points(S, -0.10, 1.10) if bleed else t_points(S, 0.06, 0.94)
    rect = f'<rect x="0" y="0" width="{S}" height="{S}" fill="{bg}"/>'
    if rounded:
        rect = f'<rect x="0" y="0" width="{S}" height="{S}" rx="{rounded}" fill="{bg}"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" '
            f'viewBox="0 0 {S} {S}">\n  {rect}\n'
            f'  <polygon points="{poly(pts)}" fill="{fg}"/>\n</svg>\n')

def t_only_svg(S, fg, fit):
    """S 캔버스 가운데에 T만. fit = T 바운딩박스가 들어갈 정사각 한 변."""
    pts = t_points(1000, 0.06, 0.94)
    x0,y0,x1,y1 = bbox(pts)
    w,h = x1-x0, y1-y0
    k = fit/max(w,h)
    tx = (S - w*k)/2 - x0*k
    ty = (S - h*k)/2 - y0*k
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" '
            f'viewBox="0 0 {S} {S}">\n'
            f'  <g transform="translate({tx:.2f},{ty:.2f}) scale({k:.5f})">\n'
            f'    <polygon points="{poly(pts)}" fill="{fg}"/>\n  </g>\n</svg>\n')

# ---------- 워드마크 ----------
G = json.load(open("/home/claude/glyphs.json"))
UPM, TOTAL, PARTS = G["upm"], G["total"], G["parts"]

def wordmark_svg(c_main, c_t, pad=0.0):
    ys=[]
    body=[]
    for ch,x,d in PARTS:
        fill = c_t if ch=="T" else c_main
        body.append(f'    <path transform="translate({x:.1f},0)" d="{d}" fill="{fill}"/>')
    # Archivo 900 대문자 캡높이 기준 박스
    cap = 730.0
    vb_h = cap
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{TOTAL:.0f}" height="{vb_h:.0f}" '
           f'viewBox="0 0 {TOTAL:.0f} {vb_h:.0f}">\n'
           f'  <g transform="translate(0,{vb_h:.0f}) scale(1,-1)">\n'
           + "\n".join(body) + "\n  </g>\n</svg>\n")
    return svg

def lockup_svg(c_main, c_t, icon_bg=RED, icon_fg=WHITE):
    """아이콘 + 워드마크 가로 조합. 아이콘 높이 = 워드마크 캡높이 x 1.5"""
    cap = 730.0
    isize = cap*1.5
    gap = cap*0.42
    total_w = isize + gap + TOTAL
    r = isize*0.2246   # iOS 슈퍼타원 근사 라운드
    pts = t_points(1000, -0.10, 1.10)
    k = isize/1000
    body=[f'  <g><rect x="0" y="{(cap*1.5-isize)/2:.1f}" width="{isize:.1f}" height="{isize:.1f}" rx="{r:.1f}" fill="{icon_bg}"/>',
          f'  <g transform="translate(0,{(cap*1.5-isize)/2:.1f}) scale({k:.5f})" clip-path="url(#sq)"><polygon points="{poly(pts)}" fill="{icon_fg}"/></g></g>']
    words=[]
    for ch,x,d in PARTS:
        fill = c_t if ch=="T" else c_main
        words.append(f'    <path transform="translate({x:.1f},0)" d="{d}" fill="{fill}"/>')
    H = isize
    wy = (H + cap)/2
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_w:.0f}" height="{H:.0f}" '
           f'viewBox="0 0 {total_w:.0f} {H:.0f}">\n'
           f'  <defs><clipPath id="sq"><rect x="0" y="0" width="1000" height="1000" rx="{r/k:.1f}"/></clipPath></defs>\n'
           + "\n".join(body) + "\n"
           f'  <g transform="translate({isize+gap:.1f},{wy:.1f}) scale(1,-1)">\n'
           + "\n".join(words) + "\n  </g>\n</svg>\n")
    return svg

def w(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path,"w").write(text)

# ===== SVG 출력 =====
w(f"{OUT}/svg/icon-master.svg",            icon_svg(1024))
w(f"{OUT}/svg/icon-ios-1024.svg",          icon_svg(1024))
w(f"{OUT}/svg/icon-play-512.svg",          icon_svg(512))
w(f"{OUT}/svg/icon-preview-rounded.svg",   icon_svg(1024, rounded=230))
w(f"{OUT}/svg/android-background.svg",     f'<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432" viewBox="0 0 432 432"><rect width="432" height="432" fill="{RED}"/></svg>\n')
w(f"{OUT}/svg/android-foreground-safe.svg",t_only_svg(432, WHITE, 186))
w(f"{OUT}/svg/android-foreground-bleed.svg", icon_svg(432, bg="none", fg=WHITE).replace(f'fill="none"','fill-opacity="0"'))
w(f"{OUT}/svg/android-monochrome.svg",     t_only_svg(432, WHITE, 186))
w(f"{OUT}/svg/notification-icon.svg",      t_only_svg(96, WHITE, 62))
w(f"{OUT}/svg/mark-only-red.svg",          t_only_svg(1000, RED, 820))
w(f"{OUT}/svg/mark-only-white.svg",        t_only_svg(1000, WHITE, 820))
w(f"{OUT}/svg/mark-only-ink.svg",          t_only_svg(1000, INK, 820))

w(f"{OUT}/svg/wordmark-on-dark.svg",  wordmark_svg(WHITE, RED))
w(f"{OUT}/svg/wordmark-on-light.svg", wordmark_svg(INK,   RED))
w(f"{OUT}/svg/wordmark-mono-white.svg", wordmark_svg(WHITE, WHITE))
w(f"{OUT}/svg/wordmark-mono-ink.svg",   wordmark_svg(INK,   INK))
w(f"{OUT}/svg/lockup-on-dark.svg",  lockup_svg(WHITE, RED))
w(f"{OUT}/svg/lockup-on-light.svg", lockup_svg(INK,   RED))
print("svg done")
