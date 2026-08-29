#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Recupere les originaux listes dans src/sources.tsv.

Deux fournisseurs :
  unsplash — telechargement direct par identifiant ;
  extrait  — image tiree d'une video Pexels deja presente dans src/orig.
"""
import csv, os, re, subprocess, sys, urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(RACINE, "src", "orig")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124 Safari/537.36")
FF = open(os.path.join(RACINE, "src", ".ffmpeg")).read().strip()

# Instant retenu dans chaque video source, en fraction de sa duree.
INSTANTS = {"ciel-01": 0.78, "ile-baielongue": 0.35}


def duree(chemin):
    out = subprocess.run([FF, "-hide_banner", "-i", chemin],
                         capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


def main():
    os.makedirs(ORIG, exist_ok=True)
    for l in csv.DictReader(open(os.path.join(RACINE, "src", "sources.tsv")), delimiter="\t"):
        cle = (l.get("cle") or "").strip()
        if not cle:
            continue
        dest = os.path.join(ORIG, cle + ".jpg")
        if os.path.exists(dest):
            continue
        if l["fournisseur"].strip() == "unsplash":
            u = "https://images.unsplash.com/photo-%s?w=2400&q=85&fm=jpg" % l["ident"].strip()
            r = urllib.request.Request(u, headers={"User-Agent": UA})
            open(dest, "wb").write(urllib.request.urlopen(r, timeout=60).read())
            print("  telecharge", cle)
        elif l["fournisseur"].strip() == "extrait":
            src = os.path.join(ORIG, l["ident"].strip() + ".mp4")
            if not os.path.exists(src):
                print("  MANQUE la video", src); continue
            t = duree(src) * INSTANTS.get(cle, 0.5)
            subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-ss", "%.2f" % t,
                            "-i", src, "-frames:v", "1", "-q:v", "2", dest], check=True)
            print("  extrait   ", cle, "a %.1f s" % t)
    print("termine")


if __name__ == "__main__":
    main()
