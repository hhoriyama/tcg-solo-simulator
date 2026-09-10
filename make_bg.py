# -*- coding: utf-8 -*-
"""
シアターモード用の背景画像を作ります（要 Pillow / numpy：pip install pillow numpy）

  python make_bg.py

  bg_theater.png    … シートの外側（画面いっぱい）に敷く背景
  playsheet_wide.png… playsheet.png を 16:9 に広げたもの（左右の余白を同じ模様で描き足し）

赤地に白い結晶模様。カードゲームのプレイシートを想定した色味です。
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, random, math, os

SEED = 20260908

def crystal_bg(W, H, seed=SEED, c_in=(158,32,22), c_out=(70,3,4),
               vig=175, n_big=70, n_small=300, n_streak=6):
    random.seed(seed)
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = W*0.5, H*0.42
    d = np.sqrt(((xx-cx)/(W*0.72))**2 + ((yy-cy)/(H*0.95))**2)
    t = np.clip(d, 0, 1.35)/1.35
    a, b = np.array(c_in, float), np.array(c_out, float)
    base = a[None,None,:]*(1-t[...,None]) + b[None,None,:]*t[...,None]
    img = Image.fromarray(base.astype(np.uint8), 'RGB').convert('RGBA')

    def shard(dr, px, py, r, alpha, rot):
        n = random.choice([3,3,3,4]); pts=[]
        for i in range(n):
            ang = rot + i*2*math.pi/n + random.uniform(-.5,.5)
            rr = r*random.uniform(.45,1.25)
            pts.append((px+math.cos(ang)*rr, py+math.sin(ang)*rr*random.uniform(.6,1.3)))
        dr.polygon(pts, fill=(255,255,255,alpha))

    big = Image.new('RGBA',(W,H),(0,0,0,0)); d1=ImageDraw.Draw(big)
    for _ in range(n_big):
        shard(d1, random.uniform(-100,W+100), random.uniform(-100,H+100),
              random.uniform(180,520), random.randint(7,16), random.uniform(0,6.3))
    img = Image.alpha_composite(img, big.filter(ImageFilter.GaussianBlur(16)))

    st = Image.new('RGBA',(W,H),(0,0,0,0)); d2=ImageDraw.Draw(st)
    for _ in range(n_streak):
        x0=random.uniform(-W*0.4, W*1.1); w=random.uniform(22,80)
        ang=math.radians(-58); dx,dy=math.cos(ang)*W*2, math.sin(ang)*W*2
        d2.polygon([(x0,H*1.2),(x0+w,H*1.2),(x0+w+dx,H*1.2+dy),(x0+dx,H*1.2+dy)],
                   fill=(255,255,255,random.randint(9,22)))
    img = Image.alpha_composite(img, st.filter(ImageFilter.GaussianBlur(7)))

    sm = Image.new('RGBA',(W,H),(0,0,0,0)); d3=ImageDraw.Draw(sm)
    for _ in range(n_small):
        shard(d3, random.uniform(0,W), random.uniform(0,H),
              random.uniform(26,140), random.randint(5,20), random.uniform(0,6.3))
    img = Image.alpha_composite(img, sm.filter(ImageFilter.GaussianBlur(1.3)))

    v = (np.clip((d-0.45)/0.85, 0, 1)**1.5*vig).astype(np.uint8)
    z = np.zeros_like(v)
    img = Image.alpha_composite(img, Image.fromarray(np.dstack([z,z,z,v]),'RGBA'))
    return img.convert('RGB')

def main():
    crystal_bg(2560,1440).save('bg_theater.png', optimize=True)
    print('bg_theater.png')

    if not os.path.exists('playsheet.png'):
        print('playsheet.png が無いので playsheet_wide.png は作りません')
        return
    sheet = Image.open('playsheet.png').convert('RGB')
    sw, sh = sheet.size
    W, H = int(round(sh*16/9)), sh                      # 16:9 に広げる
    if W < sw: W = sw
    # 余白は同じ結晶模様（シートより少し暗め）
    bg = crystal_bg(W, H, seed=SEED+7, c_in=(150,28,20), c_out=(62,3,4), vig=190).convert('RGBA')
    x = (W-sw)//2
    # シートの影
    sha = Image.new('RGBA',(W,H),(0,0,0,0))
    ImageDraw.Draw(sha).rectangle([x-6,-6,x+sw+6,H+6], fill=(0,0,0,150))
    bg = Image.alpha_composite(bg, sha.filter(ImageFilter.GaussianBlur(22)))
    bg.paste(sheet, (x,0))
    bg.convert('RGB').save('playsheet_wide.png', optimize=True)
    print('playsheet_wide.png', (W,H), 'sheet x=%d..%d (%.2f%%..%.2f%%)'%(x,x+sw,x/W*100,(x+sw)/W*100))

if __name__ == '__main__':
    main()
