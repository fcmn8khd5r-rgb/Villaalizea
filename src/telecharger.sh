set -u
U="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
cd "$(dirname "$0")/orig"
tail -n +2 ../sources.tsv | while IFS=$'\t' read -r cle four ident auteur lic piece; do
  [ -z "${cle:-}" ] && continue
  [ -f "$cle.jpg" ] && continue
  curl -sS -A "$U" -o "$cle.jpg" "https://images.unsplash.com/photo-$ident?w=2400&q=85&fm=jpg" && echo "ok $cle"
done
# --- videos drone (Pexels) : hero + images aeriennes ---
for v in 31931883:13601788_2560_1440_30fps 17404328:17404328-uhd_2560_1440_24fps 37841349:16052191_2560_1440_60fps 37957946:16106820_2560_1440_60fps 38094658:16174347_2560_1440_60fps; do
  id="${v%%:*}"; f="${v##*:}"
  [ -f "vid-$id.mp4" ] && continue
  curl -sS -A "$U" -o "vid-$id.mp4" "https://videos.pexels.com/video-files/$id/$f.mp4" && echo "ok video $id"
done
echo TERMINE
