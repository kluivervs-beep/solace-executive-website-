#!/bin/bash
# Builds the folder that is deployed: copies the site, strips hidden data (EXIF, XMP) from JPEG photos
# without re-compressing them, and minifies our own scripts. Usage: scripts/build-protected.sh <out-dir>
set -e
SRC="$(cd "$(dirname "$0")/.." && pwd)"; OUT="$1"; [ -n "$OUT" ] || { echo "usage: build-protected.sh <out-dir>"; exit 1; }
rm -rf "$OUT"; mkdir -p "$OUT"
rsync -a --delete --exclude .git --exclude .claude --exclude supabase --exclude '*.sql' --exclude scripts --exclude '.DS_Store' "$SRC"/ "$OUT"/
python3 - "$OUT" <<'PY'
import sys,glob,struct
out=sys.argv[1]
def strip(path):
    b=open(path,'rb').read()
    if b[:2]!=b'\xff\xd8': return False
    i=2; res=[b[:2]]
    while i<len(b):
        if b[i]!=0xFF: res.append(b[i:]); break
        m=b[i+1]
        if m==0xDA: res.append(b[i:]); break
        if m in (0xD8,0x01) or 0xD0<=m<=0xD7: res.append(b[i:i+2]); i+=2; continue
        L=struct.unpack('>H',b[i+2:i+4])[0]; seg=b[i:i+2+L]
        if m==0xE1: pass          # APP1: EXIF / XMP dropped
        else: res.append(seg)
        i+=2+L
    open(path,'wb').write(b''.join(res)); return True
n=sum(1 for f in glob.glob(out+'/assets/**/*.*',recursive=True) if f.lower().endswith(('.jpg','.jpeg')) and strip(f))
print('jpeg metadata stripped:',n)
PY
for f in window-hero.js jet-fly.js keep-playing.js protect.js; do
  npx --yes terser "$OUT/$f" --compress --mangle -o "$OUT/$f" 2>/dev/null || echo "minify skipped: $f"
done
echo "built: $OUT"
