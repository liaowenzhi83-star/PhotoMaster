#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生成应用图标（纯标准库，无 PIL 依赖）。
用解析式 SDF 做抗锯齿，效果等同于 4x 超采样，但快得多。

用法: python tools/gen_icons.py
输出: assets/icon.png / assets/adaptive-icon.png / assets/splash-icon.png
"""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")

C_BG_TOP = (0x16, 0x3E, 0x31)
C_BG_BOT = (0x05, 0x11, 0x0E)
C_CARD = (0xED, 0xF7, 0xF3)
C_CARD_BACK = (0x7F, 0xB3, 0xA0)
C_CHECK = (0x2F, 0xD1, 0x8E)


def sd_round_rect(px, py, cx, cy, hw, hh, r):
    qx = abs(px - cx) - (hw - r)
    qy = abs(py - cy) - (hh - r)
    ax, ay = max(qx, 0.0), max(qy, 0.0)
    return math.hypot(ax, ay) + min(max(qx, qy), 0.0) - r


def sd_segment(px, py, ax, ay, bx, by, r):
    pax, pay = px - ax, py - ay
    bax, bay = bx - ax, by - ay
    denom = bax * bax + bay * bay
    h = 0.0 if denom == 0 else max(0.0, min(1.0, (pax * bax + pay * bay) / denom))
    return math.hypot(pax - bax * h, pay - bay * h) - r


def cov(d):
    return min(1.0, max(0.0, 0.5 - d))


def mix(dst, src, a):
    return (
        dst[0] + (src[0] - dst[0]) * a,
        dst[1] + (src[1] - dst[1]) * a,
        dst[2] + (src[2] - dst[2]) * a,
    )


def render(size, opaque=True, scale=1.0):
    """返回 (rgb: bytearray, alpha: bytearray)"""
    rgb = bytearray(size * size * 3)
    alpha = bytearray(size * size)

    c = size / 2.0
    card_hw = size * 0.285 * scale
    card_hh = size * 0.222 * scale
    radius = card_hw * 0.30
    off = size * 0.030 * scale
    stroke = max(1.5, size * 0.026 * scale)

    # 对勾三段点（相对卡片中心）
    p1 = (c - card_hw * 0.40, c + card_hh * 0.04)
    p2 = (c - card_hw * 0.10, c + card_hh * 0.36)
    p3 = (c + card_hw * 0.44, c - card_hh * 0.38)

    # 只在这些区域内做精细计算
    margin = off + card_hw + radius + 8
    x0 = max(0, int(c - card_hw - off - 10))
    x1 = min(size, int(c + card_hw + off + 10))
    y0 = max(0, int(c - card_hh - off - 10))
    y1 = min(size, int(c + card_hh + off + 10))

    for y in range(size):
        base = (y * size) * 3
        t = y / float(size - 1) if size > 1 else 0.0
        bg = (
            C_BG_TOP[0] + (C_BG_BOT[0] - C_BG_TOP[0]) * t,
            C_BG_TOP[1] + (C_BG_BOT[1] - C_BG_TOP[1]) * t,
            C_BG_TOP[2] + (C_BG_BOT[2] - C_BG_TOP[2]) * t,
        )
        in_band = y0 <= y < y1

        for x in range(size):
            if opaque:
                col = bg
                a = 1.0
            else:
                col = (0.0, 0.0, 0.0)
                a = 0.0

            if in_band and x0 <= x < x1:
                # 后面那张卡
                d = sd_round_rect(x, y, c + off, c - off * 0.85, card_hw, card_hh, radius)
                k = cov(d) * 0.5
                if k > 0:
                    col = mix(col, C_CARD_BACK, k)
                    a = max(a, k)

                # 前面那张卡
                d = sd_round_rect(x, y, c, c, card_hw, card_hh, radius)
                k = cov(d)
                if k > 0:
                    col = mix(col, C_CARD, k)
                    a = max(a, k)

                # 对勾
                d = min(
                    sd_segment(x, y, p1[0], p1[1], p2[0], p2[1], stroke),
                    sd_segment(x, y, p2[0], p2[1], p3[0], p3[1], stroke),
                )
                k = cov(d)
                if k > 0:
                    col = mix(col, C_CHECK, k)
                    a = max(a, k)

            i = y * size + x
            rgb[base + x * 3] = int(min(255, max(0, round(col[0]))))
            rgb[base + x * 3 + 1] = int(min(255, max(0, round(col[1]))))
            rgb[base + x * 3 + 2] = int(min(255, max(0, round(col[2]))))
            alpha[i] = int(min(255, max(0, round(a * 255))))

    return rgb, alpha


def write_png(path, size, rgb, alpha=None):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        start = y * size * 3
        raw += rgb[start:start + size * 3]
        if alpha is not None:
            raw += alpha[y * size:(y + 1) * size]

    color_type = 6 if alpha is not None else 2

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, color_type, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    return len(png)


def main():
    os.makedirs(OUT, exist_ok=True)

    rgb, _ = render(1024, opaque=True, scale=0.86)
    n = write_png(os.path.join(OUT, "icon.png"), 1024, rgb)
    print("icon.png        ", n, "bytes")

    # 自适应图标前景：透明底，主体缩到安全区内
    rgb, alpha = render(1024, opaque=False, scale=0.72)
    n = write_png(os.path.join(OUT, "adaptive-icon.png"), 1024, rgb, alpha)
    print("adaptive-icon.png", n, "bytes")

    # 启动图（居中显示，四周透明）
    rgb, alpha = render(512, opaque=False, scale=1.0)
    n = write_png(os.path.join(OUT, "splash-icon.png"), 512, rgb, alpha)
    print("splash-icon.png ", n, "bytes")


if __name__ == "__main__":
    main()
