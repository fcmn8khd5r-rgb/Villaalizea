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

```bash
node src/serveur-local.mjs 8150
```

Puis <http://localhost:8150>. Ce petit serveur sert les fichiers **et** route `/api/*` vers
les vraies fonctions, ce qu'un simple serveur de fichiers ne ferait pas : sans lui, le
calendrier tomberait sur son repli.

## Les pages

| Fichier | Contenu |
|---|---|
| `index.html` | Hero piloté, le lieu et ses chiffres, aperçu de la galerie, l'île, avis, appel à réserver |
| `la-villa.html` | Les cinq pièces en détail, les six prestations |
| `galerie.html` | 23 vues, filtrables par pièce, visionneuse clavier et tactile |
| `l-ile.html` | Six lieux avec image, distance et temps de trajet ; vidéo de Baie Longue |
| `le-sejour.html` | Tarifs, conditions, six avis sourcés, formulaire de contact |
| `reserver.html` | Calendrier synchronisé iCal, calcul du séjour, acompte en ligne |
| `confirmation.html` | Récapitulatif après paiement |
| `mentions.html` | Mentions légales, meublé de tourisme, RGPD, crédits photo |
| `essai-replis.html` | Outil de vérification des replis du hero — non déployé |

## Le hero piloté au défilement

### Ce qui a été corrigé

La première version répartissait 32 images sur les 13 secondes du plan, soit **2,4 images
par seconde**. L'écart entre deux images voisines valait alors environ **cinq fois** l'écart
natif de la vidéo : l'œil voyait la succession, pas un mouvement.

La correction n'est pas d'ajouter des images sur la même distance — ce serait trop lourd —
mais de **resserrer le mouvement**. On garde donc un segment court, échantillonné dense :

| | |
|---|---|
| Segment retenu | **3,5 s** du plan (à partir de t = 3,8 s) |
| Cadence | **20 images par seconde** |
| Nombre d'images | **70** |
| Écart entre images voisines | **×1,37 le natif** (contre ×5 avant) |

Le facteur ×1,37 est mesuré, pas estimé : `src/mouvement.py` compare l'écart absolu moyen
entre images consécutives à celui de la vidéo à sa cadence native. Un fondu entre images
voisines achève de lisser.

### Le poids, et le temps d'affichage

| | Bureau 1280×720 | Mobile 640×854 |
|---|---|---|
| Séquence complète | **3,01 Mo** | **1,38 Mo** |
| Première vague (1 image sur 4) | 790 Ko | 361 Ko |
| Affiche fixe | 46 Ko | 80 Ko |
| **Page d'accueil, première visite** | **3,18 Mo** | **1,47 Mo** |

Temps mesurés sur les poids réels, à débit constant :

| Réseau | Affiche | 1ʳᵉ vague (mobile) | Séquence complète (mobile) |
|---|---|---|---|
| 4G moyenne, 10 Mb/s | < 0,1 s | **0,3 s** | 1,2 s |
| 4G faible, 5 Mb/s | < 0,1 s | 0,6 s | 2,3 s |

Le visiteur n'attend jamais devant un écran vide : **91 Ko** suffisent au premier rendu
(HTML + CSS + affiche), et la séquence arrive derrière, par vagues.

### La liaison d'entrée et de sortie

Une caméra ne démarre pas d'un coup. La course reçoit un **profil de vitesse trapézoïdal** —
accélération, plateau, décélération — dont la vitesse est **nulle aux deux extrémités** :

```
vitesse(p) = adoucie(p / A)        sur les A premiers pour cent
             1                     au milieu
             adoucie((1 - p) / A)  sur les A derniers        (A = 0,22)
```

La position affichée est l'intégrale normalisée de cette vitesse. Mesuré sur le rendu, par
pas de 5 % de la course :

```
1,2 → 2,6 → 4,0 → 4,3 → 3,5 → … plateau ~3,0 … → 3,4 → 2,8 → 1,8 → 0,5
└──── le mouvement naît ────┘                      └── et s'éteint ──┘
```

Pendant la mise en route, le titre se retire vers le haut en s'effaçant, le voile sombre
s'allège, et l'image se pose depuis un très léger rapprochement — **suivant la même courbe
adoucie**. Sans cela, le rapprochement variait le plus vite au tout début et l'entrée
bougeait plus que le milieu : l'inverse de l'effet recherché. À la sortie, un voile couleur
de page monte et le hero s'y dissout au lieu de la heurter.

### Quatre replis, tous vérifiés

| Situation | Comportement | Octets de séquence |
|---|---|---|
| Pas de JavaScript | L'affiche reste, en plein écran ; le hero fait une hauteur d'écran | 0 |
| `prefers-reduced-motion` | Idem, `data-repli="animations-reduites"` | **0** |
| Économiseur de données, 2G/3G | Idem, `data-repli="connexion-lente"` | **0** |
| Images inaccessibles | Idem, `data-repli="chargement-impossible"` | — |

`essai-replis.html?cas=sobre|lent|donnees|normal` rejoue chacun de ces cas.

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
| `demande.mjs` | Envoi du formulaire par courriel | `RESEND_API_KEY`, `COURRIEL_DESTINATION` |

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
```

`src/mouvement.py <video> <debut> <duree>` mesure l'écart entre images consécutives à
plusieurs cadences : c'est l'outil qui a servi à dimensionner la séquence.

`src/orig/` (environ 400 Mo d'originaux et de vidéos) n'est ni versionné ni déployé : tout
est refabricable depuis `src/sources.tsv`, qui liste la provenance, l'auteur et la licence
de chaque fichier.

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
├── index.html … mentions.html  8 pages publiées
├── css/style.css               feuille commune, palette et animations
├── css/reserver.css            calendrier, récapitulatif, confirmation
├── js/hero.js                  la caméra pilotée au défilement
├── js/main.js                  animations communes, compteurs, menu, formulaires
├── js/galerie.js               filtres et visionneuse
├── js/reserver.js              calendrier des disponibilités
├── js/tarifs.mjs               calcul du prix — PARTAGÉ avec le serveur
├── js/credits.js               GÉNÉRÉ — crédits de la visionneuse
├── netlify/functions/          iCal, Stripe, avis Google, courriel
├── assets/img/                 29 photos étalonnées, AVIF + WebP, deux largeurs
├── assets/hero/                140 images de séquence + affiches de repli
├── assets/video/               Baie Longue, deux définitions
└── src/                        sources, scripts de fabrication, serveur local
```
