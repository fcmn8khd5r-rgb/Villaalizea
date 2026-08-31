# Villa Alizéa — site vitrine de location saisonnière

Maquette pour un **meublé de tourisme haut de gamme** aux Terres Basses, à Saint-Martin.
Huit pages statiques — HTML, CSS et JavaScript natifs, aucune dépendance, aucune étape de
compilation — et quatre fonctions serveur pour les intégrations.

Le système visuel, le rythme des animations et la finition sont repris de la démonstration
**Villa Damencourt** : sa palette crème et ocre brûlée, son couple Marcellus / Jost, ses
blocs qui montent à l'entrée dans le champ, ses images révélées par volet, ses compteurs.
Le hero piloté au défilement est la seule chose en plus.

> **La Villa Alizéa n'existe pas.** Le nom, les textes, les tarifs, les avis, les
> coordonnées et le numéro de déclaration ont été inventés. Les photographies viennent de
> banques d'images libres de droits et représentent d'autres propriétés. Une mention le dit
> en pied de chaque page ; le détail figure dans `mentions.html`.

## Lancer le site

Double-cliquez **`Ouvrir le site.command`**, ou en ligne de commande :

```bash
node src/serveur-local.mjs 8150
```

Puis <http://localhost:8150>. Ce petit serveur sert les fichiers **et** route `/api/*` vers
les vraies fonctions, ce qu'un simple serveur de fichiers ne ferait pas : sans lui, le
calendrier tomberait sur son repli.

## Les pages

| Fichier | Contenu |
|---|---|
| `index.html` | Hero piloté, le seuil, le lieu et ses chiffres, aperçu de la galerie, l'île, avis, appel à réserver |
| `la-villa.html` | Les cinq pièces en détail, les six prestations |
| `galerie.html` | 22 vues, filtrables par pièce, visionneuse clavier et tactile |
| `l-ile.html` | Six lieux avec image, distance et temps de trajet ; vidéo de Baie Longue |
| `le-sejour.html` | Tarifs, conditions, six avis sourcés, formulaire de contact |
| `reserver.html` | Calendrier synchronisé iCal, calcul du séjour, acompte en ligne |
| `confirmation.html` | Récapitulatif après paiement |
| `mentions.html` | Mentions légales, meublé de tourisme, RGPD, crédits photo |
| `essai-replis.html` | Outil de vérification des replis du hero — non déployé |

## Le hero piloté au défilement

### Le plan, et pourquoi celui-là

**Deux bateaux traversent une baie**, vus du ciel : chacun tire un long sillage blanc sur une
eau qui va de l'émeraude au bleu profond. Le cadre est resserré sur l'eau — aucune côte,
aucun relief, donc aucun lieu identifiable.

Source : [Pexels n° 27815370](https://www.pexels.com/video/drone-view-of-boats-on-ocean-27815370/),
de Khrystyna Ivanova, licence Pexels. 2160 × 3840 à 60 im/s, 9,1 s.

### Six plans avant celui-ci, et ce que chacun a appris

| Plan | Ce qui n'allait pas |
|---|---|
| Cocoteraie parcourue | le décor ne bougeait pas — seule la caméra se déplaçait |
| Plage sauvage et dune | idem : sable et dune sont immobiles par nature |
| Récif et écume | tout bougeait, mais le sujet n'était pas saisissant |
| Banc de sable | beau et très mobile — mais irréaliste à Saint-Martin |
| Plage caribéenne | crédible, mais son *contenu* restait immobile |

### Ce qu'un bateau apporte, et qu'aucun paysage ne peut donner

Un bateau est un **objet discret** : l'œil le suit, et son déplacement se lit immédiatement,
même s'il ne représente qu'une petite part des pixels. C'est précisément ce que les mesures
moyennées ne captent pas — `src/animation.py` donne 3,6 de tremblement ici, contre 14 pour un
sillage qui emplit le cadre, et pourtant c'est ici qu'on voit le mieux quelque chose bouger.

Un paysage, si beau soit-il, n'offre que du décor fixe qu'une caméra survole. Cinq essais ont
été nécessaires pour en tirer la conséquence : **pour qu'on voie bouger, il faut un sujet qui
bouge, pas seulement une caméra qui bouge.**

### La zone sûre : ce que la forme de l'écran emporte

La toile est peinte en `cover` — l'image remplit le cadre, et ce qui ne rentre pas déborde.
Ce qui déborde dépend de la **forme** de l'écran, et la marge est loin d'être négligeable :

| Écran | Ce qui est coupé |
|---|---|
| 21/9 (2560 × 1080) | **12 %** en haut et en bas |
| Tablette 4/3 en paysage | **12,5 %** à gauche et à droite |
| Téléphone allongé (9/19,5) | **19,5 %** sur les côtés du profil portrait |

Le premier cadrage plaçait les coques à **15 % du haut**. Sur un écran large elles
disparaissaient purement et simplement, et sur les autres elles passaient sous la barre de
navigation : il ne restait que les sillages. Le hero perdait son sujet précisément sur les
grands écrans, là où il est censé impressionner.

Les points de coupe ne sont donc plus choisis à l'œil mais **mesurés** : on repère la coque
image par image — le point clair le plus haut de chaque traînée — et on vérifie qu'elle
reste dans la zone qui survit à tous les cadrages.

| Profil | Coque, hauteur | Coque, largeur | Zone sûre |
|---|---|---|---|
| Large | 35 % du haut | 75 – 86 % | 12 – 88 % en hauteur, 12,5 – 87,5 % en largeur |
| Portrait | 15 % du haut | 67 – 79 % | 19,5 – 80,5 % en largeur |

La leçon vaut au-delà de ce plan : **un sujet cadré au bord n'est pas cadré**, dès lors que
l'image est servie en `cover` à des écrans de formes libres.

### Deux réglages qui rendent ce mouvement visible

| Levier | Valeur | Effet |
|---|---|---|
| **Zoom du cadrage** | 1,35 | chaque bateau parcourt une bien plus grande fraction du cadre |
| **Hauteur de course** | 150 vh | le même trajet se fait en deux fois moins de défilement |

Le zoom tombe juste : 2160 / 1,35 = 1600, soit exactement la largeur de sortie — le recadrage
se fait donc **sans aucun rééchantillonnage**, et la netteté est celle du capteur.

La coupe verticale, elle, sert à exclure les caps bruns de l'horizon : arides, ils ne
passaient pas pour Saint-Martin. Il ne reste que l'eau et les bateaux.

Cerise : un sillage **fin** sur une eau lisse comprime très bien — 19 Ko l'image, là où un
sillage plein cadre en demandait 45. Le budget passe donc en qualité (32) et en nombre
d'images (264, une sur deux de la source).

### Faire bouger davantage : trois leviers, pas un seul

Ce que l'on perçoit, c'est **combien la scène avance pour un geste donné**, et cela dépend
d'autant du montage que du plan :

| Levier | Avant | Après | Ce que ça coûte |
|---|---|---|---|
| Sujet du plan | décor fixe | **un long banc de sable parcouru** | rien |
| Profil d'entrée | 22 % | **4 %** | rien |
| Hauteur de course | 340 vh | **175 vh** | rien |
| Durée parcourue | 4,5 s | **18 s** | rien |

Le premier de ces leviers est de loin le plus important, et c'est celui que j'avais introduit
moi-même : à lui seul il multipliait par douze ce qu'un petit geste fait avancer.

Les deux derniers ne coûtent ni poids ni fluidité : l'écart entre deux images affichées ne
change pas, on les traverse seulement plus vite.

### La fluidité — ce qui a été corrigé

La première version répartissait 32 images sur les 13 secondes du plan, soit **2,4 images
par seconde**. L'écart entre deux images voisines valait alors environ **cinq fois** l'écart
natif de la vidéo : l'œil voyait la succession, pas un mouvement.

La correction n'est pas d'ajouter des images sur la même distance — ce serait trop lourd —
mais de **resserrer le mouvement**. On garde donc un segment court, échantillonné dense :

| | |
|---|---|
| Segment retenu | **3,5 s** du plan (à partir de t = 2,0 s) |
| Cadence | **50 images/s** en bureau, **40** en mobile |
| Nombre d'images | **175** et **140** |
| Écart entre images voisines | **0,69 %** de l'échelle des gris |

La vidéo source est à 25 images/s : échantillonner plus dense n'aurait fait que dupliquer.
On passe donc par une **interpolation à compensation de mouvement** (`minterpolate` en mode
`mci`), qui fabrique de vraies positions intermédiaires au lieu de superposer deux images.
Un fondu entre voisines superpose deux positions et double les contours — c'est ce
doublement qui se lit comme un tremblement, même quand l'écart est faible.

Trois relevés successifs, sur le même protocole :

| | Écart entre images voisines |
|---|---|
| 32 images sur 13 s | ~10 % — diaporama |
| 70 images sur 3,5 s | 1,98 % — fluide, mais un grain subsiste |
| **175 images interpolées sur 3,5 s** | **0,69 %** |

Le facteur ×1,37 est mesuré, pas estimé : `src/mouvement.py` compare l'écart absolu moyen
entre images consécutives à celui de la vidéo à sa cadence native. Un fondu entre images
voisines achève de lisser.

### Le poids, et le temps d'affichage

| | Bureau 1600×900 | Mobile 416×555 |
|---|---|---|
| Images | 264 | 176 |
| Séquence complète | **4,11 Mo** | **1,08 Mo** |
| Plafond convenu | 5 Mo | 1,5 Mo |

Un sillage **fin** sur une eau lisse comprime très bien — 16 Ko l'image, là où un sillage
plein cadre en demandait 45 et de l'écume 34.

**Le plafond a été tenu délibérément.** Doubler la fluidité (60 im/s, 528 images) coûterait
environ 9,4 Mo, soit sept secondes de chargement en 4G moyenne. Les prospects ouvrent le lien
depuis leur téléphone, souvent en déplacement : mieux vaut un hero un peu moins fluide qui
s'affiche tout de suite qu'un hero parfait que personne n'attend. La netteté, elle, est déjà
au maximum de ce plan — le recadrage mesure exactement 1600 px dans la source, soit la
largeur de sortie : le pixel est transporté tel quel.

| Réseau | Séquence bureau | Séquence mobile |
|---|---|---|
| Bon réseau, 25 Mb/s | 1,4 s | 0,4 s |
| 4G moyenne, 10 Mb/s | 3,5 s | 0,9 s |
| 4G faible, 5 Mb/s | 6,9 s | 1,8 s |

Le visiteur n'attend jamais devant un écran vide : **82 Ko** suffisent au premier rendu
(HTML + CSS + affiche), l'affiche reste à l'écran pendant le préchargement, et une jauge
discrète montre l'avancement.

### La liaison d'entrée et de sortie, et une erreur qu'elle a causée

La course reçoit un **profil de vitesse** — accélération, plateau, décélération — dont la
position affichée est l'intégrale normalisée. Les deux bouts **ne sont pas symétriques**, et
c'est le résultat d'une correction.

Le profil était d'abord adouci des deux côtés sur 22 % de la course, au nom du principe
qu'« une caméra ne démarre pas d'un coup ». Mesuré, c'était désastreux :

| Défilement | Images avancées, ancien profil | Nouveau profil |
|---|---|---|
| 60 px | **2 / 162** | 25 / 212 |
| 120 px *(un cran de molette)* | 10 / 162 | 54 / 212 |
| 240 px | 29 / 162 | 113 / 212 |

Les 60 premiers pixels — le geste qui décide de l'impression — n'avançaient que de **deux
images**. Le hero passait pour immobile, et aucun changement de plan n'y aurait rien fait :
le mouvement était mangé par la courbe, pas absent de l'image.

Il n'y avait d'ailleurs aucune raison d'adoucir l'entrée : avant le premier geste, l'image
est déjà à l'arrêt sur son premier plan, il n'y a pas de rupture à masquer. La sortie, elle,
en a besoin — le hero s'y efface pendant que la page suivante monte.

```
vitesse(p) = adoucie(p / 0,04)          sur les 4 premiers pour cent
             1                          au milieu
             adoucie((1 - p) / 0,16)    sur les 16 derniers
```

Le ressort a été raidi en même temps (0,055 → 0,11) : trop mou, il ajoutait son propre
retard à celui du profil, et les deux se cumulaient au démarrage.

Pendant la mise en route, le titre se retire vers le haut en s'effaçant, le voile sombre
s'allège, et l'image se pose depuis un très léger rapprochement. À la sortie, un voile
couleur de page monte et le hero s'y dissout au lieu de la heurter.

### La fluidité du pilotage

Trois causes de saccade, corrigées :

1. **Le chargement progressif pendant le pilotage.** Tant que les vagues 2 et 3 arrivaient,
   l'affichage retombait sur l'image chargée la plus proche et sautait de quatre en quatre.
   La séquence est désormais **entièrement préchargée avant que l'effet ne s'active**.
   Jusque-là, l'affiche fixe reste et le hero garde une hauteur d'écran : le visiteur ne
   défile pas dans une image immobile. Un indicateur discret montre l'avancement.
2. **La position d'image calquée sur la position de défilement.** Une molette ou un pavé
   tactile envoient des sauts irréguliers, que l'image reproduisait tels quels. La cible
   vient toujours du défilement, mais la valeur affichée la rejoint par un **ressort
   amorti** (raideur 0,055, amortissement 0,53), réglé au bord du régime critique : la
   course se prolonge d'environ un quart de seconde après l'arrêt du doigt, sans jamais
   repartir en arrière — un dépassement, ici, se verrait comme un tremblement de la caméra.
   L'intégrateur tourne à pas fixe de 1/60 s, quelle que soit la cadence d'affichage :
   le comportement est donc le même sur un écran à 60 Hz et sur un à 120 Hz.
3. **Un seuil de redessin trop grossier**, qui avalait les variations fines. Pendant
   l'animation, on redessine à chaque image.

Mesuré sur le rendu, avec des pas de défilement volontairement irréguliers :

| | Irrégularité relative |
|---|---|
| Les pas de défilement envoyés | 0,62 |
| Ce que montre l'image | **0,30** |

L'à-coup est divisé par deux — et le résultat est le même à 70 ms qu'à 400 ms entre deux
pas, c'est-à-dire pendant un défilement rapide comme au repos.

Si une seule image manque, l'effet ne s'active pas et l'affiche fixe reste : une séquence
trouée saute, et un saut est exactement ce qu'on cherche à éviter.

### La lisibilité du texte

Le blanc du hero ne tenait que **2,5:1** sur le fond, là où il en faut 4,5. Mesure faite,
pas estimée : `src/lisibilite.py` calcule la luminance du fond sous chaque ligne de texte,
sur les 140 images des deux séquences, applique l'opacité de l'écran à cette hauteur et en
tire le rapport de contraste.

Un écran dégradé, confiné à la gauche par un masque pour ne pas assombrir toute l'image,
ramène le pire cas à :

| Ligne | Exigé | Obtenu |
|---|---|---|
| Sur-titre (petites capitales) | 4,5:1 | **5,8:1** |
| Titre | 3:1 | **7,0:1** |
| Phrase | 4,5:1 | **8,7:1** |
| Bouton | 4,5:1 | **10,1:1** |

`python3 src/lisibilite.py` recontrôle après toute modification de la séquence ou du voile.

### Décider sur une mesure, pas sur une estimation

Une première version consultait `navigator.connection.downlink` et coupait l'effet sous
1,4 Mb/s. Mauvaise méthode : c'est une estimation glissante, arrondie et plafonnée par le
navigateur, souvent fausse au début d'une page et sans objet en local — elle annonçait
1,3 Mb/s sur une machine sans réseau, ce qui suffisait à désactiver l'effet pour de bon.

Le même travers valait pour `effectiveType`. Sur cette machine, sans aucun réseau, l'API a
annoncé tour à tour « 3g à 1,3 Mb/s » puis « 2g à 0,25 Mb/s » — deux verdicts opposés en
quelques minutes, sur la même absence de réseau.

Une seule chose bloque donc sans discussion : **l'économiseur de données**, parce que c'est
une intention exprimée par le visiteur et non une mesure. Pour tout le reste on **sonde** —
une image, on mesure le débit réellement obtenu, on décide — et on refait la vérification
après chaque paquet, au cas où le débit s'effondrerait. Sur une vraie 2G le verdict tombe
après 26 Ko.

### Cinq replis, tous vérifiés

| Situation | Comportement | Octets de séquence |
|---|---|---|
| Pas de JavaScript | L'affiche reste, en plein écran ; le hero fait une hauteur d'écran | 0 |
| `prefers-reduced-motion` | Idem, `data-repli="animations-reduites"` | **0** |
| Économiseur de données | Idem, `data-repli="connexion-lente"` | **0** |
| Débit mesuré trop faible | On s'arrête après l'image sonde, `data-repli="debit-insuffisant"` | 1 image |
| Images inaccessibles | Idem, `data-repli="chargement-impossible"` | — |
| Séquence non fabriquée | Idem, `data-repli="sequence-absente"` | 0 |

Le type de réseau annoncé par le navigateur n'est pas consulté : il s'est révélé faux trop
souvent — 1,3 Mb/s annoncés sur une machine locale sans réseau, `effectiveType` à « 2g » sur
une fibre. Seul l'**économiseur de données**, qui est une intention explicite de la
personne, interdit d'emblée. Tout le reste se décide sur une mesure : on charge une image,
on chronomètre, et on renonce si le reste demanderait plus de dix secondes.

`essai-replis.html?cas=sobre|lent|donnees|panne|debit|latence|normal` rejoue chacun de ces cas.

### L'effet de souris

Sur ordinateur et au pointeur fin uniquement, le déplacement horizontal de la souris fait
glisser l'image d'un peu plus d'un pour cent — assez pour qu'elle réponde, trop peu pour
qu'on sache dire pourquoi. La toile est peinte 3,5 % plus large que le cadre : la marge sert
au glissement, qui ne découvre donc jamais un bord. Sur écran tactile, l'effet n'existe pas.

## Bilingue

Une villa de luxe à Saint-Martin se loue à des Américains et à des Britanniques bien plus
qu'à des Français. Le site existe donc en entier dans les deux langues : dix pages
françaises à la racine, dix pages anglaises sous `/en/`.

**Le français reste à la racine.** C'est cette adresse-là qu'on partage aux propriétaires
francophones ; s'ils atterrissaient en anglais, la démonstration manquerait sa cible.
L'anglais n'en est pas moins un site entier — mêmes pages, mêmes blocs, indexé séparément.

**Où vivent les traductions.** Nulle part deux fois :

| Ce qui est traduit | Où |
|---|---|
| Prose des pages | `en/*.html`, écrites comme de vraies pages, pas transposées mot à mot |
| Prose de la configuration | `config/villa.json`, champs `{"fr": …, "en": …}` |
| Libellés des blocs engendrés | dictionnaire `TXT` de `construire.py` |
| Descriptions des pièces | `PIECES`, dans `construire.py` |
| Légendes des images | `config/legendes-en.json` — le français vit dans `src/manifeste.json`, que `src/traiter.py` réécrit |
| Textes affichés par le navigateur | `TEXTES_JS` de `construire.py` → `js/textes.js` |
| Messages des fonctions | tables `MESSAGES` dans chaque fonction |
| Refus du calcul de prix | `MESSAGES` de `js/tarifs.mjs`, partagé serveur et navigateur |

Un champ traduit s'écrit `{"fr": …, "en": …}` ; `T()` le résout et **retombe sur le
français** si l'anglais manque. Un trou de traduction n'ouvre donc jamais un trou dans la
page.

**Ce qui change avec la langue, au-delà des mots.** Les montants s'écrivent « 4 200,00 € »
en français et « €4,200.00 » en anglais ; les dates « 12 sept. 2026 » et « Sep 12, 2026» ;
les initiales du calendrier « LMMJVSD » et « MTWTFSS ». Les montants, eux, sont identiques —
c'est le même argent.

**Le sélecteur de langue affiche la langue vers laquelle on va**, pas celle où l'on est :
« EN » sur le site français. Il renvoie sur la **page équivalente**, jamais sur l'accueil.

**Pour les moteurs.** Chaque page déclare ses deux variantes en `hreflang`, plus un
`x-default` sur le français, et le plan du site les répète en `xhtml:link`. Sans cela les
deux versions se feraient concurrence au lieu d'être reconnues comme une même page en deux
langues.

**Un piège, rencontré.** Les pages anglaises vivent un cran plus bas : **tout chemin
relatif y désigne autre chose**. Les pages sont donc en chemins absolus depuis la racine, et
les deux seules adresses construites en JavaScript — les images du hero et la grande image
de la visionneuse — l'ont été aussi. Avant correction, le hero anglais retombait en image
fixe sans rien signaler.

## Les intégrations

Les quatre fonctions sont écrites pour la production. **Il suffit de renseigner les
variables d'environnement** (voir `.env.exemple`) pour qu'elles passent du mode
démonstration au mode réel ; aucune ligne n'est à réécrire. Sans variable, chacune répond
avec un jeu de démonstration et le signale à l'écran.

| Fonction | Sert à | Variables |
|---|---|---|
| `disponibilites.mjs` | Agrège les calendriers iCal d'Airbnb et Booking | `ICAL_AIRBNB`, `ICAL_BOOKING` |
| `acompte.mjs` | Session de paiement Stripe Checkout | `STRIPE_SECRET_KEY` |
| `avis.mjs` | Avis de la fiche Google (API Places New) | `GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACE_ID` |
| `demande.mjs` | Envoi du formulaire par courriel | `RESEND_API_KEY` |

### L'acompte, et pourquoi il est sûr

1. **Le montant n'est jamais reçu du navigateur.** Il est recalculé côté serveur à partir
   des seules dates et du nombre de voyageurs. Un client qui envoie « acompte : 1 € » se
   voit facturer le vrai montant — c'est vérifié par un test.
2. **La disponibilité est revérifiée** avant d'ouvrir le paiement : on n'encaisse pas pour
   une semaine louée entre-temps sur une autre plateforme (réponse 409).
3. **Aucun numéro de carte ne transite par le site.** Stripe héberge la page de paiement,
   condition de la conformité PCI DSS.

Le calcul du prix vit dans **`js/tarifs.mjs`**, chargé des *deux* côtés : par le navigateur
pour l'affichage en direct, par la fonction d'acompte pour le montant facturé. Un seul jeu
de règles, donc aucune divergence entre ce que le visiteur lit et ce qu'il paie.

### Sur cette maquette, le paiement est simulé

Le bouton « Réserver » déroule le parcours complet — vérification des dates auprès des
calendriers, calcul du montant côté serveur, page de confirmation avec le détail du séjour
— mais **aucune carte n'est demandée et rien n'est encaissé**. Une mention discrète le dit
sous le bouton, et une seconde sur la confirmation ; les libellés y sont ajustés (« acompte
à régler » et non « acompte réglé »).

C'est un choix assumé pour une démonstration : ouvrir un compte Stripe pour une maquette
serait un engagement de plus à surveiller. **L'intégration reste entière dans le code.**
Le jour où un client apporte son compte, il suffit de renseigner `STRIPE_SECRET_KEY` :

- une clé `sk_test_…` ouvre le bac à sable — page Stripe hébergée, carte de test
  `4242 4242 4242 4242`, retour sur `confirmation.html` avec le détail réel de la session ;
- une clé `sk_live_…` met le paiement en service.

Aucune ligne de code n'est à changer dans un cas comme dans l'autre : `acompte.mjs` bascule
sur la présence de la variable.

### Les avis

Airbnb et Booking **n'exposent aucune API publique de lecture des avis** — c'est une limite
de leur côté, pas du site. Les avis sont donc tenus dans `config/villa.json`, avec leur
plateforme, leur note, leur date et l'échelle employée (Booking note sur 10). Chacun porte
sa source à l'écran. La fonction `avis.mjs` reste en place pour ceux de Google, qui sont
récupérables en direct.

## Les images

### Ce qui a été corrigé

La version précédente comptait cinq vues aériennes, prises à des altitudes, des heures et
des latitudes différentes : on voyait des lieux distincts. La galerie de la villa n'en
compte plus **qu'une seule** — une image tirée du plan même du hero, donc littéralement la
même propriété. Les autres sont parties sur la page de l'île, où montrer des lieux
différents est ce qu'on attend.

L'équilibre est revenu vers l'intérieur : sur 23 vues, **19 sont des pièces ou des détails**,
3 la terrasse et le bassin, 1 la vue du ciel.

### La cohérence

1. **Une propriété pour le cœur du site.** Onze vues — séjour sous quatre angles, cuisine,
   chambre, bureau, terrasses — viennent d'un même reportage, publié en un seul envoi par
   un même photographe.
2. **Les pièces manquantes, choisies sur le raccord.** Aucune salle de bain ni seconde
   chambre dans ce lot. Elles viennent de deux autres séries, retenues non pour leur lieu
   mais parce que la lumière, les matières et la palette s'accordent — l'une porte au mur
   le même disque solaire tressé que le séjour.
3. **Un étalonnage unique, intégré aux fichiers.** Deux étapes, dans `src/etalonnage.py` :
   un **alignement colorimétrique statistique** de chaque image vers la série de référence,
   à force partielle et variable selon la source, puis une **courbe commune** — légère
   désaturation, courbe en S, noirs relevés en mat, hautes lumières réchauffées.

L'alignement est ce qui manquait à un simple filtre : des sources qui ne partent pas du même
point ne se raccordent pas avec une même courbe. Les images de l'île sont ramenées moins
fort (0,30 contre 0,55) — ce sont des lieux, pas des pièces de la maison.

La correction est **dans les fichiers**, pas en CSS : le rendu ne dépend pas du navigateur
et il n'y a pas de double correction.

## Refabriquer

```bash
python3 src/telecharger.py   # récupère les originaux listés dans src/sources.tsv
python3 src/traiter.py       # étalonne et décline en AVIF + WebP, deux largeurs
python3 src/hero.py          # extrait et étalonne les deux séquences du hero
python3 construire.py        # régénère les blocs des pages
python3 src/lisibilite.py    # contrôle le contraste sur toutes les images du hero
```

Trois outils de mesure, qui ont servi à trancher plutôt qu'à justifier après coup :

| Outil | Répond à |
|---|---|
| `src/mouvement.py <video> <début> <durée>` | À quelle cadence échantillonner pour que ce soit fluide ? |
| `src/typemouvement.py <video> <début> <durée>` | Ce plan recule-t-il vraiment, ou est-ce un travelling ? |
| `src/lisibilite.py` | Le texte du hero tient-il le contraste sur toutes les images ? |

`src/orig/` (environ 400 Mo d'originaux et de vidéos) n'est ni versionné ni déployé : tout
est refabricable depuis `src/sources.tsv`, qui liste la provenance, l'auteur et la licence
de chaque fichier.

## Qui édite, et qui est fictif

Le site présente une villa **fictive** mais il est édité par quelqu'un de **réel**. Les deux
identités ne se confondent nulle part :

| | La Villa Alizéa | Studio Mathys Bocage |
|---|---|---|
| Existence | inventée pour la maquette | réelle, éditeur du site |
| Coordonnées | fictives, en `.example` | dans le pied de page et les mentions |
| Formulaire | présenté comme celui de la villa | **les messages arrivent au studio** |

Une ligne discrète en pied de chaque page renvoie au studio : c'est par là qu'un
propriétaire séduit par la démonstration prend contact. Les mentions légales portent
l'identité complète de l'éditeur, comme la loi l'exige d'un support commercial.

## Mettre en ligne

```bash
bash outils-publier.sh     # assemble _site/ : 14 Mo, exactement ce qui doit partir
```

**Le script refuse d'assembler tant que le SIREN de l'éditeur est vide** dans
`config/villa.json`. Ce n'est pas un avertissement mais un blocage : un site commercial
dont les mentions légales sont incomplètes ne doit pas partir. Renseignez le champ,
relancez `python3 construire.py`, puis le script.

**Netlify n'a pas d'équivalent de `.vercelignore`** : tout le dossier publié est déployé.
Sans ce tri, `src/orig` — près de quatre cents mégaoctets de vidéos sources — partirait sur
le serveur, avec les scripts de fabrication et la page d'essai des replis.
`netlify.toml` appelle donc le script et publie `_site`.

`construire.py` génère aussi `robots.txt` et `sitemap.xml` à partir de la liste des pages,
et injecte dans chaque `<head>` le lien canonique et les balises Open Graph, dérivés du
`<title>` et de la description déjà présents. **L'adresse du site se règle à un seul
endroit** : `config/villa.json`, bloc `site`.

## Décliner ce site pour un autre client

Tout ce qui se répète ou se chiffre est dans **`config/villa.json`** : marque, coordonnées,
caractéristiques du bien, saisons, tarifs, taxe de séjour, numéro de déclaration, les six
lieux de l'île avec leurs distances, et les avis.

```bash
python3 construire.py
```

régénère l'en-tête et le menu des huit pages, les fiches de pièces, la galerie, les lieux
de l'île, les tarifs, le tableau des conditions, les avis, les crédits photo et le pied de
page, plus `js/credits.js`.

**Un prix ne s'écrit qu'à un seul endroit.** `python3 construire.py --verifie` contrôle sans
rien écrire, et le générateur s'arrête net si un repère a disparu d'une page plutôt que
d'écrire à côté.

## Ce qu'une relecture complète a trouvé

Passage sur les dix pages, aux trois largeurs (375, 768, 1280), plus les parcours
interactifs. Quatre défauts réels, tous corrigés :

**1. Les versions de fichiers dérivaient.** Le `?v=` de chaque CSS et JS était écrit à la
main, page par page. Après une retouche de `css/style.css`, `index.html` était passé à
`v=19` pendant que les neuf autres pages restaient à `v=11` : un visiteur qui revenait
recevait l'ancienne feuille sur tout le site sauf l'accueil. `construire.py` calcule
désormais la version comme **empreinte du contenu** — elle change quand le fichier change,
et elle est la même partout. La classe de bug entière disparaît.

**2. Le calendrier ouvrait des impasses.** Une date d'arrivée était proposée dès lors
qu'elle était libre, sans vérifier qu'un séjour valide pouvait y commencer. La veille d'une
réservation était donc cliquable, et le visiteur découvrait le refus « séjour minimum de
5 nuits » après avoir choisi ses deux dates. La règle de durée minimale est maintenant
exportée par `js/tarifs.mjs` — le même fichier que le prix — et le calendrier s'en sert pour
n'ouvrir que ce qu'il acceptera. En octobre, 6 dates d'arrivée au lieu de 16, et plus aucun
cul-de-sac. Un test verrouille la règle.

**3. Le focus n'entrait ni dans la visionneuse ni dans le menu.** Les deux appelaient
`.focus()` trop tôt : la feuille de style garde ces blocs en `visibility:hidden` tant que
l'attribut d'ouverture n'est pas posé, et la transition ne bascule la visibilité qu'à la
trame **suivante**. Un navigateur refusant le focus sur un élément invisible, la demande
partait dans le vide sans la moindre erreur, et la tabulation continuait derrière la boîte
ouverte. Diagnostiqué en traçant la valeur calculée de `visibility` trame par trame ; corrigé
par une seconde `requestAnimationFrame`.

**4. Quatre méta-descriptions hors plage.** Celle de l'accueil faisait 204 caractères — donc
tronquée dans les résultats de recherche — et trois pages secondaires en avaient moins de 35.
Toutes sont maintenant entre 90 et 170.

Contrôlé et conforme par ailleurs : aucun débordement horizontal sur 10 pages × 3 largeurs,
un seul `<h1>` par page, aucune image sans `alt`, aucun lien ni bouton vide, aucune ancre
morte, aucun fichier référencé manquant, `sitemap.xml` et `robots.txt` cohérents avec les
pages non indexées, et les trois routes d'API répondent — y compris le parcours de
réservation complet jusqu'au détail du prix.

## Accessibilité

- Contenu essentiel — description, coordonnées, tarifs, conditions, distances, avis,
  formulaire — **entièrement lisible sans JavaScript**. Les vignettes de la galerie sont
  alors de simples liens vers la photo en grand.
- Galerie parcourable au clavier (flèches, Début, Fin, Échap, tabulation piégée dans la
  visionneuse) et au doigt (glissement horizontal pour changer, vertical pour fermer). La
  navigation se limite au filtre actif.
- Calendrier navigable aux flèches, avec changement de mois automatique en bord de grille.
- Un seul `h1` par page, aucun saut de niveau, tous les `alt` renseignés, tous les champs
  étiquetés, lien d'évitement, contours de focus visibles.
- `prefers-reduced-motion` neutralise apparitions, fondus, compteurs et séquence du hero.

## Points à savoir

- Les tarifs, la taxe de séjour, les avis et le numéro de déclaration sont **fictifs**. Le
  taux de la taxe de séjour est fixé par la Collectivité de Saint-Martin et révisé
  périodiquement : il doit être vérifié auprès d'elle avant toute mise en ligne.
- Le droit de rétractation de 14 jours **ne s'applique pas** aux hébergements à date
  déterminée ; les conditions d'annulation du loueur doivent être acceptées avant paiement.
- Les feuilles de style et scripts portent un `?v=`. **Incrémentez-le** après chaque
  modification de `css/` ou `js/`, sinon les navigateurs serviront l'ancienne version.
- Airbnb, Booking.com, Google et Stripe sont des marques de leurs propriétaires. Elles ne
  sont citées que pour indiquer la provenance des avis et le prestataire de paiement.

## Structure

```
├── config/villa.json           ← tout ce qui change d'un client à l'autre
├── construire.py               générateur des blocs répétés
├── .env.exemple                les variables à renseigner pour passer en réel
├── outils-publier.sh           assemble _site/ ; refuse si le SIREN manque
├── index.html … mentions.html  10 pages publiées
├── css/polices.css             Marcellus et Jost, hébergées ici
├── css/style.css               feuille commune, palette et animations
├── css/reserver.css            calendrier, récapitulatif, confirmation
├── js/hero.js                  la caméra pilotée au défilement
├── js/main.js                  animations communes, compteurs, menu, formulaires
├── js/galerie.js               filtres et visionneuse
├── js/reserver.js              calendrier des disponibilités
├── js/tarifs.mjs               calcul du prix — PARTAGÉ avec le serveur
├── js/credits.js               GÉNÉRÉ — crédits de la visionneuse
├── netlify/functions/          iCal, Stripe, avis Google, courriel
├── assets/fonts/               8 fichiers woff2, sous-ensembles latin
├── assets/img/                 29 photos étalonnées, AVIF + WebP, deux largeurs
├── assets/hero/                315 images de séquence + affiches de repli
├── assets/video/               Baie Longue, deux définitions
└── src/                        sources, scripts de fabrication, serveur local
    ├── animation.py            sépare mouvement de caméra et mouvement propre
    ├── hero.py                 la séquence du hero
    └── lisibilite.py           contrôle de contraste, image par image
```
