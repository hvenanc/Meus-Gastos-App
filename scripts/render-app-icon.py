"""Render the app's original vector wallet artwork at launcher sizes."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parent.parent / 'assets'
art = '''<rect x="280" y="305" width="440" height="180" rx="48" fill="#c8f9e4"/><rect x="235" y="365" width="550" height="350" rx="70" fill="#29d899"/><path d="M320 600L425 495L510 550L655 405M580 405H655V480" fill="none" stroke="#103b2d" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/><rect x="665" y="495" width="145" height="125" rx="30" fill="#103b2d"/><circle cx="715" cy="557" r="17" fill="#c8f9e4"/>'''
(root/'app-icon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="200" fill="#101b17"/><circle cx="512" cy="512" r="390" fill="#173c2e"/>'+art+'</svg>\n')
def draw(size, transparent=False, monochrome=False):
    scale=4
    im=Image.new('RGBA',(1024*scale,1024*scale),(0,0,0,0) if transparent else '#101b17')
    d=ImageDraw.Draw(im)
    def box(coords):return tuple(int(v*scale) for v in coords)
    def rect(coords,r,fill):d.rounded_rectangle(box(coords),r*scale,fill=fill)
    def circle(coords,fill):d.ellipse(box(coords),fill=fill)
    if not transparent:circle((122,122,902,902),'#173c2e')
    pale='white' if monochrome else '#c8f9e4'
    mint='white' if monochrome else '#29d899'
    dark=(0,0,0,0) if monochrome else '#103b2d'
    rect((280,305,720,485),48,pale);rect((235,365,785,715),70,mint)
    d.line([box(p) for p in [(320,600),(425,495),(510,550),(655,405)]],fill=dark,width=32*scale,joint='curve')
    for x,y in [(320,600),(425,495),(510,550),(655,405)]:circle((x-16,y-16,x+16,y+16),dark)
    d.line([box(p) for p in [(580,405),(655,405),(655,480)]],fill=dark,width=32*scale,joint='curve')
    rect((665,495,810,620),30,dark);circle((698,540,732,574),pale)
    return im.resize((size,size),Image.Resampling.LANCZOS)
draw(1024).convert('RGB').save(root/'app-icon.png')
draw(1024,True).save(root/'app-icon-foreground.png')
draw(1024,True,True).save(root/'app-icon-monochrome.png')
draw(64).save(root/'app-favicon.png')
