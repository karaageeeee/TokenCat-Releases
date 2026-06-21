#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "Resources" / "CatFrames"
W, H = 66, 54

KEY = (0, 255, 0, 0)
INK = (24, 24, 24, 255)
BLACK = (36, 37, 40, 255)
DARK = (50, 52, 56, 255)
WHITE = (236, 232, 220, 255)
GRAY = (118, 121, 122, 255)
PINK = (204, 116, 126, 255)
YELLOW = (247, 202, 66, 255)
YELLOW_D = (194, 139, 38, 255)


def new_frame():
    return Image.new("RGBA", (W, H), KEY)


def rect(d, xy, fill):
    d.rectangle(xy, fill=fill)


def poly(d, pts, fill):
    d.polygon(pts, fill=fill)


def px(d, x, y, fill=INK):
    rect(d, (x, y, x, y), fill)


def draw_tail(d, pose, limp=False):
    if pose == 0:
        pts = [(15, 27), (8, 23), (7, 20), (10, 19), (16, 24)]
    elif pose == 1:
        pts = [(15, 29), (8, 30), (6, 28), (8, 26), (15, 26)]
    elif pose == 2:
        pts = [(15, 28), (10, 33), (7, 33), (8, 30), (14, 25)]
    else:
        pts = [(15, 27), (9, 25), (7, 22), (10, 21), (16, 24)]
    if limp:
        pts = [(15, 33), (9, 36 + pose % 2), (7, 35), (9, 33), (15, 31)]
    poly(d, pts, INK)
    poly(d, [(p[0] + (1 if i in (0, 4) else 0), p[1]) for i, p in enumerate(pts)], BLACK)


def draw_head(d, x, y, mood="open", ears_down=False):
    ear_l = [(x + 2, y + 4), (x + 7, y - (2 if not ears_down else 0)), (x + 10, y + 5)]
    ear_r = [(x + 17, y + 5), (x + 22, y - (1 if not ears_down else 1)), (x + 24, y + 8)]
    if ears_down:
        ear_l = [(x + 1, y + 7), (x + 7, y + 2), (x + 11, y + 8)]
        ear_r = [(x + 17, y + 8), (x + 22, y + 4), (x + 25, y + 10)]
    poly(d, ear_l, INK)
    poly(d, ear_r, INK)
    rect(d, (x + 3, y + 5, x + 24, y + 20), INK)
    rect(d, (x + 4, y + 6, x + 23, y + 19), BLACK)
    rect(d, (x + 15, y + 8, x + 23, y + 17), WHITE)
    rect(d, (x + 19, y + 11, x + 25, y + 16), WHITE)
    px(d, x + 24, y + 13, PINK)
    if mood == "open":
        px(d, x + 16, y + 11)
        px(d, x + 22, y + 11)
    elif mood == "half":
        rect(d, (x + 16, y + 12, x + 18, y + 12), INK)
        rect(d, (x + 22, y + 12, x + 23, y + 12), INK)
    elif mood == "sleep":
        rect(d, (x + 16, y + 13, x + 19, y + 13), INK)
        rect(d, (x + 22, y + 13, x + 24, y + 13), INK)
    elif mood == "dazed":
        px(d, x + 16, y + 11)
        px(d, x + 17, y + 12)
        px(d, x + 22, y + 12)
        px(d, x + 23, y + 11)
    rect(d, (x + 20, y + 16, x + 22, y + 16), INK)


def draw_standing(d, frame, status):
    low = status in {"tired", "exhausted"}
    body_y = 27 + (1 if frame in (1, 3) else 0) + (2 if low else 0)
    body_x = 17
    limp = status == "exhausted"
    draw_tail(d, frame, limp=limp)
    rect(d, (body_x, body_y - 6, body_x + 27, body_y + 10), INK)
    rect(d, (body_x + 1, body_y - 5, body_x + 26, body_y + 9), BLACK)
    rect(d, (body_x + 19, body_y - 2, body_x + 26, body_y + 8), WHITE)
    rect(d, (body_x + 3, body_y - 3, body_x + 12, body_y - 1), DARK)

    if status == "running":
        legs = [
            [(21, 37, 24, 43), (34, 37, 37, 43), (25, 36, 30, 39), (39, 34, 44, 36)],
            [(20, 36, 26, 39), (35, 37, 40, 41), (28, 37, 31, 43), (42, 35, 45, 40)],
            [(21, 37, 24, 43), (34, 37, 37, 43), (24, 34, 29, 36), (39, 37, 44, 39)],
            [(20, 37, 26, 41), (35, 36, 40, 39), (28, 37, 31, 43), (42, 34, 45, 39)],
        ][frame]
    elif status == "tired":
        legs = [
            [(21, 39, 24, 44), (37, 39, 40, 44), (29, 39, 31, 43), (44, 38, 46, 42)],
            [(22, 39, 25, 44), (36, 39, 39, 44), (30, 39, 32, 43), (43, 38, 45, 42)],
            [(21, 40, 24, 44), (37, 39, 40, 44), (29, 39, 31, 43), (44, 39, 46, 43)],
            [(22, 39, 25, 44), (36, 40, 39, 44), (30, 39, 32, 43), (43, 39, 45, 43)],
        ][frame]
    else:
        legs = [
            [(22, 41, 25, 45), (37, 41, 40, 45), (29, 41, 31, 44), (43, 40, 45, 43)],
            [(22, 41, 25, 45), (36, 41, 39, 45), (30, 41, 32, 44), (42, 40, 44, 43)],
            [(23, 41, 26, 45), (37, 41, 40, 45), (29, 41, 31, 44), (43, 41, 45, 44)],
            [(22, 41, 25, 45), (36, 41, 39, 45), (30, 41, 32, 44), (42, 41, 44, 44)],
        ][frame]
    for i, leg in enumerate(legs):
        rect(d, leg, INK if i % 2 == 0 else BLACK)
    for leg in legs[:2]:
        rect(d, (leg[0], leg[3] - 1, leg[2] + 1, leg[3]), WHITE)

    mood = "open" if status == "running" else "half"
    draw_head(d, 38, body_y - 14, mood=mood, ears_down=low)


def draw_sleepy(d, frame):
    y = 31 + (frame % 2)
    rect(d, (19, y - 4, 42, y + 11), INK)
    rect(d, (20, y - 3, 41, y + 10), BLACK)
    rect(d, (18, y + 8, 43, y + 13), INK)
    rect(d, (21, y + 7, 40, y + 12), BLACK)
    poly(d, [(17, y + 2), (10, y + 5), (9, y + 8), (15, y + 8), (21, y + 4)], INK)
    draw_head(d, 36, y - 14, mood="sleep" if frame in (1, 2) else "half", ears_down=True)
    rect(d, (24, y + 10, 29, y + 14), WHITE)


def draw_collapsed(d, frame):
    y = 36 + (1 if frame == 2 else 0)
    rect(d, (15, y - 5, 45, y + 7), INK)
    rect(d, (16, y - 4, 44, y + 6), BLACK)
    rect(d, (34, y - 2, 44, y + 5), WHITE)
    poly(d, [(14, y + 1), (8, y + 4 + frame % 2), (7, y + 6), (13, y + 5), (18, y + 3)], INK)
    rect(d, (24, y + 5, 30, y + 8), WHITE)
    rect(d, (38, y + 5, 45, y + 8), WHITE)
    draw_head(d, 41, y - 11, mood="sleep", ears_down=True)


def draw_chick(d, x, y, face=1):
    rect(d, (x + 1, y + 2, x + 7, y + 7), YELLOW_D)
    rect(d, (x + 2, y + 1, x + 8, y + 6), YELLOW)
    px(d, x + 6, y + 3, INK)
    if face >= 0:
        poly(d, [(x + 8, y + 4), (x + 10, y + 5), (x + 8, y + 6)], YELLOW_D)
    else:
        poly(d, [(x + 2, y + 4), (x, y + 5), (x + 2, y + 6)], YELLOW_D)


def draw_unavailable(d, frame):
    draw_standing(d, frame % 2, "tired")
    draw_head(d, 38, 16 + (frame % 2), mood="dazed", ears_down=False)
    paths = [
        [(30, 6, 1), (43, 5, 1), (36, 1, -1)],
        [(35, 3, 1), (47, 8, -1), (27, 8, 1)],
        [(42, 5, -1), (36, 10, 1), (29, 3, 1)],
        [(35, 9, -1), (28, 5, 1), (45, 3, -1)],
    ][frame]
    for x, y, face in paths:
        draw_chick(d, x, y, face)


def save(name, draw_func):
    for frame in range(4):
        img = new_frame()
        d = ImageDraw.Draw(img)
        draw_func(d, frame)
        img.save(OUT / f"{name}_{frame}.png")


def make_preview():
    statuses = ["running", "tired", "sleepy", "exhausted", "collapsed", "unavailable"]
    scale = 4
    pad = 8
    pw = W * 4 * scale + pad * 5
    ph = H * len(statuses) * scale + pad * (len(statuses) + 1)
    preview = Image.new("RGB", (pw, ph), (0, 255, 0))
    for row, status in enumerate(statuses):
        for frame in range(4):
            img = Image.open(OUT / f"{status}_{frame}.png").convert("RGBA").resize((W * scale, H * scale), Image.Resampling.NEAREST)
            bg = Image.new("RGBA", img.size, (0, 255, 0, 255))
            bg.alpha_composite(img)
            x = pad + frame * (W * scale + pad)
            y = pad + row * (H * scale + pad)
            preview.paste(bg.convert("RGB"), (x, y))
    preview.save(OUT / "preview.png")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    save("running", lambda d, f: draw_standing(d, f, "running"))
    save("tired", lambda d, f: draw_standing(d, f, "tired"))
    save("sleepy", draw_sleepy)
    save("exhausted", lambda d, f: draw_standing(d, f, "exhausted"))
    save("collapsed", draw_collapsed)
    save("unavailable", draw_unavailable)
    make_preview()


if __name__ == "__main__":
    main()
