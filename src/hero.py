# -*- coding: utf-8 -*-
"""Fabrique la sequence d'images du hero pilote au defilement.

Une video scrubbee au doigt bloque sur mobile : Safari ne sait chercher que
les images cles, et tout encoder en images cles triple le poids. On sert donc
une SEQUENCE d'images, chargee par vagues : d'abord une passe grossiere qui
rend le pilotage immediat, puis les images intermediaires en arriere-plan.

Deux cadrages : 16/9 pour les grands ecrans, 3/4 pour le portrait mobile,
afin que la maison reste dans le cadre au lieu d'etre rognee.
"""
import json, os, re, subprocess, sys, shutil
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from etalonnage import etalonner
import numpy as np

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC    = os.path.join(RACINE, "src", "orig", "vid-27815370.mp4")
SORTIE = os.path.join(RACINE, "assets", "hero")
FF     = open(os.path.join(RACINE, "src", ".ffmpeg")).read().strip()

# --- Le plan --------------------------------------------------------------
# DEUX BATEAUX TRAVERSENT UNE BAIE, vus du ciel : chacun tire un long sillage
# blanc sur une eau qui va de l'emeraude au bleu profond, des caps verts
# ferment l'horizon. Pexels 27815370, 2160x3840 a 60 im/s, 9,1 s, 33 Mb/s.
#
# --- Six plans avant celui-ci ---------------------------------------------
#   cocoteraie      le decor ne bougeait pas — seule la camera se deplacait ;
#   plage sauvage   idem : sable et dune sont immobiles par nature ;
#   recif et ecume  tout bougeait, mais le sujet n'etait pas saisissant ;
#   banc de sable   beau et tres mobile — mais irrealiste a Saint-Martin ;
#   plage caribeenne  credible, mais son CONTENU restait immobile : seule la
#                     camera bougeait, encore une fois.
#
# --- Ce qu'un bateau apporte, et qu'aucun paysage ne peut donner -----------
# Un bateau est un OBJET DISCRET : l'oeil le suit, et son deplacement se lit
# immediatement, meme s'il ne represente qu'une petite part des pixels. C'est
# ce que les mesures moyennees ne captent pas — src/animation.py donne 3,6 de
# tremblement ici, contre 14 pour un sillage qui emplit le cadre, et pourtant
# c'est ici qu'on voit le mieux quelque chose bouger.
#
# Cerise : un sillage FIN sur une eau lisse comprime tres bien — 15 a 19 Ko
# l'image, la ou un sillage plein cadre en demandait 45. Le budget passe donc
# en qualite (32) et en nombre d'images (264, une sur deux de la source).
DEBUT, DUREE = 0.1, 8.8                     # segment retenu, en secondes

# --- Aucune interpolation --------------------------------------------------
# La source est a 60 im/s : 30 im/s en sortie, c'est UNE IMAGE SUR DEUX, donc
# des images reelles a intervalle regulier. Le profil portrait descend a 20
# im/s (une sur trois) pour tenir la memoire d'un telephone.
#
# (cle, images/s, largeur, hauteur, qualite AVIF, coupe horizontale,
#  coupe verticale, zoom)
#
# Le ZOOM de 1,35 est le levier qui rend le mouvement des bateaux VISIBLE :
# resserre, chacun parcourt une bien plus grande fraction du cadre. Il tombe
# juste : 2160 / 1,35 = 1600, soit exactement la largeur de sortie — aucun
# reechantillonnage, donc aucune perte de nettete.
#
# La coupe verticale, elle, sert a EXCLURE les caps bruns de l'horizon : ils
# sont arides, ils ne passent pas pour Saint-Martin. Il ne reste que l'eau et
# les bateaux, sans indice geographique.
# --- La zone sure, et pourquoi il a fallu la mesurer ----------------------
# La toile est peinte en `cover` : l'image remplit le cadre et deborde de ce
# qui ne rentre pas. Ce qui deborde depend de la FORME de l'ecran, et la marge
# est loin d'etre negligeable :
#
#   ecran 21/9 (2560x1080)      12 % coupes en HAUT et en bas
#   tablette 4/3 en paysage     12,5 % coupes a GAUCHE et a droite
#   telephone allonge (9/19,5)  19,5 % coupes sur les cotes, en portrait
#
# Le premier reglage placait les coques a 15 % du haut : elles disparaissaient
# sur un ecran large et passaient sous la barre de navigation sur les autres.
# Il ne restait que les sillages.
#
# Les valeurs ci-dessous sont donc MESUREES et non choisies a l'oeil : on
# repere la coque image par image — le point clair le plus haut de chaque
# trainee — et on verifie qu'elle reste dans la zone qui survit a tous les
# cadrages.
#
#   large    coque a 35 % du haut, entre 75 % et 86 % de la largeur
#   portrait coque a 15 % du haut, entre 67 % et 79 % de la largeur
#
# --- Les coques descendues, en portrait ------------------------------------
# A 15 % du haut, elles se serraient contre le bord superieur d'un telephone :
# le bandeau de demonstration et la barre de navigation occupent les 80
# premiers pixels sur 844, et les bateaux venaient buter juste dessous. On ne
# les voyait pas, on les devinait.
#
# La fenetre de recadrage a donc ete REMONTEE dans la source, ce qui fait
# descendre le sujet dans le cadre. Le reglage est serre des deux cotes :
#
#   oy 0.62  coques a 19 % de l'ecran — trop haut, contre la barre
#   oy 0.58  coques a 22,5 %          — degagees, et AUCUNE terre visible
#   oy 0.56  un cap apparait dans l'angle superieur droit
#   oy 0.50  les deux caps et le ciel entrent dans le cadre
#
# 0.58 est donc la derniere valeur qui descend les bateaux sans faire entrer
# les caps arides que la coupe verticale sert precisement a exclure. Verifie
# sur toute la duree du plan — t = 0,1 / 1,9 / 3,6 / 5,4 / 7,1 / 8,8 s — et sur
# trois tailles de telephone : la terre ne parait a aucun moment.
#
# Le profil large n'est pas touche : le defaut ne concerne que le portrait.
PROFILS = [("l", 30, 1600, 900, 32, 0.50, 0.36, 1.35),   # large   : 264 images
           ("p", 20,  416, 555, 33, 0.72, 0.58, 1.35)]   # portrait: 176 images


def cadence_source():
    """Cadence reelle du fichier, lue dans l'entete."""
    out = subprocess.run([FF, "-hide_banner", "-i", SRC],
                         capture_output=True, text=True).stderr
    m = re.search(r"(\d+(?:\.\d+)?) fps", out)
    return float(m.group(1)) if m else 0.0


def extraire(cadence, n):
    """Extrait le segment retenu a la cadence demandee.

    Au-dela de la cadence native, minterpolate synthetise les images
    manquantes par compensation de mouvement. C'est lent — quelques minutes —
    mais c'est ce qui distingue un vrai deplacement d'un fondu entre deux
    positions."""
    tmp = "/tmp/hero-brut"
    shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    # On reduit AVANT tout traitement : travailler sur du 4K coute des minutes
    # pour rien, puisque la plus grande sortie fait 1600 px de large. 2160 px
    # laisse de la marge au recadrage portrait, qui ne garde que les trois
    # quarts de la largeur.
    #
    # Et on n'interpole QUE si l'on demande plus d'images que la source n'en
    # a. Sinon on prend ses images telles quelles : elles sont vraies, et
    # elles gardent le fremissement que l'interpolation lisserait.
    native = cadence_source()
    # Tolerance de 2 % : une source annoncee a 29,97 im/s pour une sortie a 30
    # est la MEME cadence, et basculer sur l'interpolation pour trois
    # centiemes lisserait l'ecume — exactement ce qu'on vient chercher.
    if native and cadence <= native * 1.02:
        filtre = "scale=2160:-2,fps=%d" % cadence
    else:
        filtre = ("scale=2160:-2,minterpolate=fps=%d:mi_mode=mci:mc_mode=aobmc:"
                  "me_mode=bidir:vsbmc=1" % cadence)
    subprocess.run([FF, "-hide_banner", "-loglevel", "error",
                    "-ss", str(DEBUT), "-t", str(DUREE + 0.2), "-i", SRC,
                    "-vf", filtre, "-frames:v", str(n + 3),
                    os.path.join(tmp, "b%04d.png")], check=True)
    noms = sorted(os.listdir(tmp))
    if len(noms) < n:
        raise SystemExit("segment trop court : %d images extraites, %d attendues"
                         % (len(noms), n))
    return noms[:n], tmp


def main(profils=None):
    """profils : liste de cles a fabriquer, ou None pour tout.

    Refabriquer un seul profil evite de rejouer un encodage de vingt minutes
    quand on ne retouche que le cadrage de l'autre. hero.json est alors mis a
    jour, pas reecrit."""
    os.makedirs(SORTIE, exist_ok=True)
    c = json.load(open(os.path.join(RACINE, "src", "cible.json")))
    cible = (np.array(c["moyenne"], "float32"), np.array(c["ecart"], "float32"))
    chemin_fiche = os.path.join(RACINE, "src", "hero.json")
    fiche = {}
    if profils and os.path.exists(chemin_fiche):
        fiche = json.load(open(chemin_fiche, encoding="utf-8"))
    for nom, cadence, lw, lh, q, ox, oy, zoom in PROFILS:
        if profils and nom not in profils:
            continue
        n = int(round(DUREE * cadence))
        synth = cadence > cadence_source() * 1.02
        print("  %s : %d images a %d/s — %s"
              % (nom, n, cadence,
                 "interpolation en cours, patientez..." if synth
                 else "images reelles du plan, sans interpolation"))
        noms, tmp = extraire(cadence, n)
        poids = 0
        for i, f in enumerate(noms):
            im = Image.open(os.path.join(tmp, f)).convert("RGB")
            # Recadrage au bon rapport, puis mise a l'echelle.
            #
            # Le point de coupe n'est pas force au centre : passer un plan
            # 16/9 en 3/4 jette les deux tiers de la largeur, et le tiers a
            # garder n'est pas toujours celui du milieu.
            #
            # Le ZOOM resserre encore le cadre. Ce n'est pas un effet : un
            # bateau qui traverse un cadre resserre parcourt une plus grande
            # FRACTION de l'image, donc son deplacement se voit davantage,
            # sans qu'on ait touche ni au plan ni a la vitesse.
            r_cible = lw / lh
            w = min(im.width, im.height * r_cible)
            h = w / r_cible
            w /= zoom; h /= zoom
            gx = round((im.width - w) * ox); gy = round((im.height - h) * oy)
            im = im.crop((gx, gy, gx + round(w), gy + round(h)))
            im = im.resize((lw, lh), Image.LANCZOS)
            # Alignement volontairement leger : pousse plus loin, le turquoise
            # du lagon vire au laiteux et le plan perd ce qui fait son prix.
            im = etalonner(im, cible, force_align=0.40)
            p = os.path.join(SORTIE, "%s%03d.avif" % (nom, i))
            im.save(p, quality=q, speed=4)
            poids += os.path.getsize(p)
            if i == 0:                      # image d'affiche = repli sans JS
                im.save(os.path.join(SORTIE, "affiche-%s.avif" % nom), quality=62, speed=3)
                im.save(os.path.join(SORTIE, "affiche-%s.webp" % nom), quality=80, method=6)
        fiche[nom] = {"n": n, "cadence": cadence, "w": lw, "h": lh, "poids": poids}
        print("  %s : %d images, %.2f Mo (%.1f Ko/image)"
              % (nom, n, poids/1048576, poids/1024/n))
        shutil.rmtree(tmp, ignore_errors=True)
    json.dump(fiche, open(chemin_fiche, "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1:] or None)
