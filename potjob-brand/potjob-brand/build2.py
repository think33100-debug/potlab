import os, math, cairosvg
from PIL import Image
exec(open('build.py').read().split('# ===== SVG 출력 =====')[0])

OUT="/home/claude/brand"
def png(svg, out, w, h=None, flatten=False):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    cairosvg.svg2png(url=svg, write_to=out, output_width=w, output_height=h or w)
    if flatten:
        im = Image.open(out).convert("RGB")
        im.save(out, "PNG")

S=f"{OUT}/svg"

# iOS — 알파 없는 1024 하나
png(f"{S}/icon-ios-1024.svg", f"{OUT}/png/ios/AppIcon-1024.png", 1024, flatten=True)

# Google Play 스토어 등록용
png(f"{S}/icon-play-512.svg", f"{OUT}/png/play/play-store-icon-512.png", 512, flatten=True)

# Android 런처 (레거시 정사각)
for d,s in [("mdpi",48),("hdpi",72),("xhdpi",96),("xxhdpi",144),("xxxhdpi",192)]:
    png(f"{S}/icon-master.svg", f"{OUT}/png/android/mipmap-{d}/ic_launcher.png", s, flatten=True)
    png(f"{S}/icon-master.svg", f"{OUT}/png/android/mipmap-{d}/ic_launcher_round.png", s, flatten=True)

# Android 적응형 레이어 (108dp)
for d,s in [("mdpi",108),("hdpi",162),("xhdpi",216),("xxhdpi",324),("xxxhdpi",432)]:
    png(f"{S}/android-foreground-safe.svg", f"{OUT}/png/android/mipmap-{d}/ic_launcher_foreground.png", s)
    png(f"{S}/android-monochrome.svg",      f"{OUT}/png/android/mipmap-{d}/ic_launcher_monochrome.png", s)

# 알림 아이콘 (24dp, 흰 실루엣)
for d,s in [("mdpi",24),("hdpi",36),("xhdpi",48),("xxhdpi",72),("xxxhdpi",96)]:
    png(f"{S}/notification-icon.svg", f"{OUT}/png/android/drawable-{d}/ic_stat_potjob.png", s)

# 웹 / PWA
png(f"{S}/icon-master.svg", f"{OUT}/png/web/favicon-16.png", 16, flatten=True)
png(f"{S}/icon-master.svg", f"{OUT}/png/web/favicon-32.png", 32, flatten=True)
png(f"{S}/icon-master.svg", f"{OUT}/png/web/apple-touch-icon-180.png", 180, flatten=True)
png(f"{S}/icon-master.svg", f"{OUT}/png/web/icon-192.png", 192, flatten=True)
png(f"{S}/icon-master.svg", f"{OUT}/png/web/icon-512.png", 512, flatten=True)

# maskable: 안전영역 80% 안에 T
w(f"{S}/icon-maskable-512.svg",
  f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'
  f'<rect width="512" height="512" fill="{RED}"/></svg>')
mask = t_only_svg(512, WHITE, 232).replace('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="{RED}"/>')
w(f"{S}/icon-maskable-512.svg", mask)
png(f"{S}/icon-maskable-512.svg", f"{OUT}/png/web/icon-512-maskable.png", 512, flatten=True)

# 워드마크 / 조합 (높이 96 기준 1x 2x 3x)
for name in ["wordmark-on-dark","wordmark-on-light","wordmark-mono-white","wordmark-mono-ink"]:
    for mult in [1,2,3]:
        h=96*mult; wd=int(round(h*(TOTAL/730.0)))
        png(f"{S}/{name}.svg", f"{OUT}/png/wordmark/{name}@{mult}x.png", wd, h)
for name in ["lockup-on-dark","lockup-on-light"]:
    for mult in [1,2,3]:
        h=120*mult
        import re
        src=open(f"{S}/{name}.svg").read()
        vw=float(re.search(r'width="([\d.]+)"',src).group(1)); vh=float(re.search(r'height="([\d.]+)"',src).group(1))
        png(f"{S}/{name}.svg", f"{OUT}/png/lockup/{name}@{mult}x.png", int(round(h*vw/vh)), h)

print("png done")
