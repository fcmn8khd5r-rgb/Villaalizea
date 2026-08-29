# Villa Alizéa — site vitrine de location saisonnière

Maquette de démonstration pour un **meublé de tourisme haut de gamme** aux Terres Basses,
à Saint-Martin. Site statique — HTML, CSS et JavaScript natifs, aucune dépendance,
aucune étape de compilation — avec quatre fonctions serveur pour les intégrations.

> **La Villa Alizéa n'existe pas.** Le nom, les textes, les tarifs, les avis, les
> coordonnées et le numéro de déclaration ont été inventés. Les photographies viennent
> de banques d'images libres de droits et représentent d'autres propriétés. Une mention
> le dit en pied de chaque page et le détail figure dans `mentions.html`.

## Lancer le site

```bash
node src/serveur-local.mjs 8150
```

Puis <http://localhost:8150>. Ce petit serveur sert les fichiers **et** route `/api/*`
vers les vraies fonctions, ce qu'un simple `python3 -m http.server` ne ferait pas :
sans lui, le calendrier et les avis tomberaient sur leur repli.

## Les pages

| Fichier | Contenu |
|---|---|
| `index.html` | Hero piloté au défilement, la maison pièce par pièce, galerie de 27 vues, l'île, avis Google, tarifs, formulaire |
| `reserver.html` | Calendrier synchronisé iCal, calcul du séjour, acompte en ligne |
| `confirmation.html` | Récapitulatif après paiement |
| `mentions.html` | Mentions légales, meublé de tourisme, RGPD, crédits photo |
| `essai-replis.html` | Outil de vérification des replis du hero — non déployé |

## Ce qui est réellement intégré

Les quatre fonctions sont écrites pour la production. **Il suffit de renseigner les
variables d'environnement** dans Netlify pour qu'elles passent du mode démonstration au
mode réel ; aucune ligne n'est à réécrire. Sans variables, chacune répond avec un jeu de
démonstration et le signale à l'écran.

| Fonction | Sert à | Variables à définir |
|---|---|---|
| `disponibilites.mjs` | Agrège les calendriers iCal d'Airbnb et Booking | `ICAL_AIRBNB`, `ICAL_BOOKING` |
| `avis.mjs` | Avis de la fiche Google (API Places New) | `GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACE_ID` |
| `acompte.mjs` | Session de paiement Stripe Checkout | `STRIPE_SECRET_KEY` |
| `demande.mjs` | Envoi du formulaire par courriel | `RESEND_API_KEY`, `COURRIEL_DESTINATION` |

### Trois règles tenues sur le paiement

1. **Le montant n'est jamais reçu du navigateur.** Il est recalculé côté serveur à partir
   des seules dates et du nombre de voyageurs. Un client qui envoie « acompte : 1 € » se
   voit facturer le vrai montant — c'est vérifié par un test.
2. **La disponibilité est revérifiée** avant d'ouvrir le paiement : on n'encaisse pas pour
   une semaine louée entre-temps sur une autre plateforme.
3. **Aucun numéro de carte ne transite par le site.** Stripe héberge la page de paiement,
   condition de la conformité PCI DSS.

Le calcul du prix vit dans **`js/tarifs.mjs`**, chargé des *deux* côtés : par le navigateur
pour l'affichage en direct, par la fonction d'acompte pour le montant facturé. Un seul jeu
de règles, donc aucune divergence possible entre ce que le visiteur lit et ce qu'il paie.

## Le hero piloté au défilement

Le visiteur pilote la caméra : le défilement — ou le doigt sur mobile — fait avancer un
survol de la villa.

**Ce n'est pas une vidéo.** Une vidéo « scrubbée » bloque sur Safari mobile, qui ne sait
chercher que les images clés ; tout encoder en images clés triplerait le poids. On sert
donc une **séquence d'images**, chargée par vagues : une image sur quatre d'abord, pour
que le pilotage réponde immédiatement, puis les intermédiaires en arrière-plan. Entre
deux images voisines, un fondu — c'est lui qui donne le continu avec seulement 16 vues.

Deux cadrages, choisis sur l'**orientation** et non sur la largeur, pour qu'une fenêtre
étroite mais paysage ne reçoive pas une image 3/4 rognée en haut et en bas.

| Profil | Dimensions | Images | 1ʳᵉ vague | Total |
|---|---|---|---|---|
| Large 16/9 | 1200 × 675 | 32 | 348 Ko | 1 384 Ko |
| Portrait 3/4 | 640 × 854 | 16 | 102 Ko | 404 Ko |

### Quatre replis, tous vérifiés

| Situation | Comportement | Octets de séquence |
|---|---|---|
| Pas de JavaScript | L'image d'affiche reste, en plein écran ; le hero fait une hauteur d'écran | 0 |
| `prefers-reduced-motion` | Idem, `data-repli="animations-reduites"` | **0** |
| Économiseur de données, 2G/3G | Idem, `data-repli="connexion-lente"` | **0** |
| Images inaccessibles | Idem, `data-repli="chargement-impossible"` | — |

`essai-replis.html?cas=sobre|lent|donnees|normal` rejoue chacun de ces cas.

## Budget de poids, tenu

Mesuré, pas estimé. Cible : rester utilisable en 4G aux Antilles.

| | Poids |
|---|---|
| **Bloquant avant le premier rendu** | **60 Ko** (HTML 8,8 + CSS 5,0 gzip + 1ʳᵉ image 46) |
| Scripts (différés) | 14,8 Ko gzip |
| Première visite, mobile | **0,42 Mo**, hero complet compris |
| Première visite, bureau | **1,38 Mo** |
| Galerie | 558 Ko pour 27 vignettes — **rien n'est chargé avant d'y arriver** |
| Une photo en plein écran | 86 Ko en moyenne |

Les images sont servies en **AVIF** avec repli **WebP**, à deux largeurs, chaque vignette
posée sur une miniature floue de quelques centaines d'octets encodée dans le HTML : le
cadre est occupé dès le premier rendu, sans saut de mise en page.

## La cohérence des photographies

C'est le point qui a demandé le plus de travail, et il n'existait pas de série toute faite.

1. **Une propriété pour le cœur du site.** Onze vues — séjour sous quatre angles, cuisine,
   chambre, bureau, terrasses — viennent d'un même reportage, publié en un seul envoi par
   un même photographe. C'est ce qui fait qu'on reconnaît la maison d'une photo à l'autre.
2. **Les pièces manquantes, choisies sur le raccord.** Aucune salle de bain ni seconde
   chambre dans ce lot. Elles viennent de deux autres séries, retenues non pour leur lieu
   mais parce que la lumière, les matières et la palette s'accordent — l'une d'elles porte
   au mur le même disque solaire tressé que le séjour.
3. **Un étalonnage unique, intégré aux fichiers.** Deux étapes, dans `src/etalonnage.py` :
   un **alignement colorimétrique statistique** de chaque image vers la série de référence,
   à force partielle et variable selon la source, puis une **courbe commune** — légère
   désaturation, courbe en S, noirs relevés en mat, hautes lumières réchauffées.

L'alignement est ce qui manquait à un simple filtre : des sources qui ne partent pas du
même point ne se raccordent pas avec une même courbe. Les vues aériennes sont ramenées
moins fort (0,34 contre 0,55) — leur turquoise est l'intérêt du plan, l'écraser vers le
crème le rendrait terne.

La correction est **dans les fichiers**, pas en CSS : le rendu ne dépend pas du navigateur
et il n'y a pas de double correction.

## Refabriquer les images

```bash
python3 src/telecharger.sh   # récupère les originaux listés dans src/sources.tsv
python3 src/traiter.py       # étalonne et décline en AVIF + WebP, 2 largeurs
python3 src/hero.py          # extrait et étalonne les deux séquences du hero
python3 construire.py        # régénère les blocs des pages
```

`src/orig/` (318 Mo) n'est ni versionné ni déployé : tout est refabricable depuis
`src/sources.tsv`, qui liste la provenance, l'auteur et la licence de chaque fichier.

## Décliner ce site pour un autre client

Tout ce qui se répète ou se chiffre est dans **`config/villa.json`** : marque, coordonnées,
caractéristiques du bien, saisons, tarifs, taxe de séjour, numéro de déclaration.

```bash
python3 construire.py
```

régénère les fiches de pièces, la grille tarifaire, le tableau des conditions, les crédits
photo et le pied de page des quatre pages, plus `js/credits.js`.

**Un prix ne s'écrit qu'à un seul endroit.** `python3 construire.py --verifie` contrôle
sans rien écrire, et le générateur s'arrête net si un repère a disparu d'une page plutôt
que d'écrire à côté.

## Accessibilité

- Contenu essentiel — description, coordonnées, tarifs, conditions, formulaire —
  **entièrement lisible sans JavaScript** ; les vignettes de la galerie sont alors de
  simples liens vers la photo en grand.
- Galerie parcourable au clavier (flèches, Début, Fin, Échap, tabulation piégée dans la
  visionneuse) et au doigt (glissement horizontal pour changer, vertical pour fermer).
- Calendrier navigable aux flèches, avec changement de mois automatique en bord de grille.
- Un seul `h1`, aucun saut de niveau de titre, tous les `alt` renseignés, tous les champs
  étiquetés, contrastes de 5,4 à 14 pour 1 (le niveau AA en demande 4,5).
- `prefers-reduced-motion` neutralise apparitions, fondus et séquence du hero.

## Points à savoir

- Les tarifs, la taxe de séjour et le numéro de déclaration sont **fictifs**. Le taux de la
  taxe de séjour est fixé par la Collectivité de Saint-Martin et révisé périodiquement : il
  doit être vérifié auprès d'elle avant toute mise en ligne.
- Le droit de rétractation de 14 jours **ne s'applique pas** aux hébergements à date
  déterminée ; les conditions d'annulation du loueur doivent être acceptées avant paiement.
- Les feuilles de style et scripts portent un `?v=`. **Incrémentez-le** après chaque
  modification de `css/` ou `js/`, sinon les navigateurs serviront l'ancienne version.
- La police est chargée depuis Google Fonts. Pour un site autonome, l'héberger localement.
- Cormorant Garamond a été écartée : son « é » place l'accent trop loin du « e » et le nom
  de la marque se lisait comme une coquille. EB Garamond le rend correctement.

## Structure

```
├── config/villa.json           ← tout ce qui change d'un client à l'autre
├── construire.py               générateur des blocs répétés
├── index.html … mentions.html  4 pages publiées
├── css/style.css               feuille commune
├── css/reserver.css            calendrier et récapitulatif
├── js/hero.js                  la caméra pilotée au défilement
├── js/galerie.js               visionneuse clavier et tactile
├── js/reserver.js              calendrier des disponibilités
├── js/tarifs.mjs               calcul du prix — PARTAGÉ avec le serveur
├── js/credits.js               GÉNÉRÉ — crédits de la visionneuse
├── netlify/functions/          iCal, avis Google, Stripe, courriel
├── assets/img/                 27 photos étalonnées, AVIF + WebP, 2 largeurs
├── assets/hero/                48 images de séquence + affiches de repli
└── src/                        sources, scripts de fabrication, serveur local
```
