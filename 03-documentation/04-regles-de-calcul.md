# Règles de calcul et moteur

Le moteur est une **fonction pure** : mêmes entrées + même version de paramètres = même estimation, avec le détail de chaque ligne. L'implémentation de référence est `05-moteur-de-calcul/js/pricing-engine.mjs` (16 tests au vert, dont les 52 paliers de la grille) ; `05-moteur-de-calcul/dart/` en est le portage pour Flutter.

## Pipeline

1. **Normaliser la demande** : adresses géocodées, distance D (km), durée de trajet, date et heure de début.
2. **Volume V** : liste des affaires ; sinon surface × 2 ÷ 4 ; sinon surface type du logement.
3. **Camion** : le plus petit qui couvre V (12 m³ puis 20 m³) ; aucun pour Gros bras ; au-delà de 20 m³ → devis.
4. **Nombre de Gros Bras N** : choix du client (0 à 3).
5. **Formule** : `selection_matrix[camion][N]` ; une case vide est refusée (`formula_unavailable`).
6. **Durée estimée T** (heures décimales).
7. **Palier P** : arrondi supérieur de T, borné par la formule, + temps réservé en plus (≤ 4 h).
8. **Prix de base** : grille[formule][P] (× N pour Gros bras).
9. **Lignes** : charge lourde, objet spécifique, km en plus, majoration horaire, objets volumineux, frais de dossier.
10. **Total** arrondi au centime, détail, alertes et version des paramètres.

## Matrice des formules (camion × Gros Bras)

| Gros Bras | Sans camion | 12 m³ | 20 m³ |
| --- | --- | --- | --- |
| 0 | — | DemSolo, dès 50 € | — |
| 1 | Gros Bras, dès 20 € | Moov, dès 60 € | Cargo, dès 80 € |
| 2 | — | Moov+2, dès 85 € | Cargo+2, dès 110 € |
| 3 | — | — | Cargo+3, dès 450 € |

## Grille (prix € · km inclus)

| Formule | 1 h | 2 h | 3 h | 4 h | 5 h | 6 h | 7 h | 8 h | Dépassement | Km en plus |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Gros Bras | 20 · 10 | 40 · 10 | 50 · 10 | 60 · 10 | 75 · 10 | 90 · 10 | 105 · 10 | — | 0,33 €/min | à définir |
| DemSolo | 50 · 15 | 85 · 20 | 120 · 30 | 160 · 40 | 200 · 50 | 240 · 60 | 280 · 70 | 320 · 80 | 0,83 €/min | 1,5 €/km |
| Moov | 60 · 10 | 110 · 20 | 150 · 30 | 200 · 40 | 250 · 45 | 300 · 50 | 335 · 55 | 375 · 60 | 1 €/min | 1,5 €/km |
| Moov+2 | 85 · 10 | 150 · 20 | 225 · 30 | 300 · 40 | 380 · 45 | 450 · 50 | 490 · 55 | 575 · 60 | 1,41 €/min | 1,5 €/km |
| Cargo | 80 · 15 | 130 · 20 | 195 · 30 | 260 · 40 | 325 · 45 | 390 · 50 | 430 · 55 | 470 · 60 | 1,16 €/min | 1,7 €/km |
| Cargo+2 | 110 · 15 | 200 · 20 | 290 · 30 | 380 · 40 | 470 · 45 | 560 · 50 | 610 · 55 | 680 · 60 | 1,66 €/min | 1,7 €/km |
| Cargo+3 | — | — | — | 450 · 40 | 550 · 45 | 650 · 50 | 740 · 55 | 820 · 60 | 2 €/min | 1,7 €/km |

**Temps sur place** : à partir de 5 h de prestation, 1 h de pause non facturée s'ajoute pour toutes les formules avec Gros Bras (5 h facturées = 6 h sur place). DemSolo n'a pas de pause.

## Durée estimée

```
T = T_trajet
  + Σ_adresses  T_manut(a) × (1 + M_étage(a) + M_portage(a))
  + T_escaliers
  + Σ_escales   T_escale
```

| Composant | Règle | Paramètre |
| --- | --- | --- |
| T_manut(a) | Temps de manutention à l'adresse a. **Modèle de base à définir** (par objet ou par m³) ; le moteur le reçoit en entrée. | entrée `handlingHours` |
| Minimum camion plein | Déménagement, ou camion rempli aux 2/3 : T_manut ≥ 1 h (12 m³) ou 1 h 30 (20 m³) de chaque côté. | `duration_modifiers.full_truck_minimum` |
| M_étage(a) | + 10 % par étage sans ascenseur à partir du 3e (3e = + 10 %, 4e = + 20 %) ; annulé si une personne est à chaque palier. | `duration_modifiers.floor_no_lift` |
| M_portage(a) | + 10 % par tranche complète de 20 m. | `duration_modifiers.carry_distance` |
| T_escaliers | 3 étages cumulés sans ascenseur ou plus sur l'ensemble des adresses : + 2 h. | `duration_modifiers.three_floors_total_no_lift` |
| Client seul (N = 0) | M_étage, M_portage et T_escaliers valent 0. | `duration_modifiers.self_loading_ignores_access` |

## Palier et prix

```
P_est = max(P_min(f), ⌈T⌉)
P     = clamp(P_choisi ou P_est + H_extra, P_min(f), min(P_max(f), P_est + 4))

Prix  = Grille(f, P) × (N si Gros bras)
      + Charge lourde
      + Objet spécifique
      + max(0, D − Km_inclus(f, P)) × Tarif_km(f)
      + Σ_créneaux  MO_horaire × heures_dans_créneau × taux
      + Objets volumineux
      + Frais de dossier
```

| Ligne | Calcul | Paramètre |
| --- | --- | --- |
| Charge lourde (formules avec camion) | (30 € − 20 €) × N × P | `labor.heavy_item_hourly_rate`, `labor.hourly_rate` |
| Charge lourde (Gros bras) | Prix de base × 50 % | `price_modifiers.gros_bras_heavy_multiplier` |
| Objet spécifique (piano, coffre-fort, frigo américain) | 40 € × personnes × P, personnes = N + le Jogger (hypothèse : s'ajoute à la grille) | `labor.special_item_hourly_rate_per_person` |
| Km en plus | (D − km inclus) × tarif au km de la formule | `formulas[].extra_km_rate` |
| Majoration horaire | MO_horaire = N × 20 €/h (30 € si charge lourde) ; Gros bras : prix ÷ P. × 30 % (21 h 30–23 h) ou 50 % (23 h–7 h) par heure passée dans le créneau | `price_modifiers.time_slots` |
| Objets volumineux | 5 € par objet et par adresse au 3e étage ou plus sans ascenseur | `price_modifiers.bulky_item_floor3_no_lift` |
| Frais de dossier | 10 € si réservation par téléphone | `price_modifiers.phone_booking_fee` |

## Exemples validés (tests automatisés)

| Cas | Entrées | Calcul | Total |
| --- | --- | --- | --- |
| A — Transport (maquette) | DemSolo, 1,5 m³, 31,7 km, P = 4 h, 9 h | 160 + km 0 (31,7 ≤ 40) | 160 € |
| B — Km en plus | Moov, P = 4 h, 45 km | 200 + 5 × 1,5 | 207,50 € |
| C — Soirée | Cargo+2, 4 h de 22 h à 2 h, 38 km | 380 + 1 h × 40 × 30 % + 3 h × 40 × 50 % | 452 € |
| D — Téléphone et piano | Moov+2, 3 h, 25 km, piano, téléphone | 225 + 3 × 3 × 40 + 10 | 595 € |
| E — Déménagement (maquette) | Cargo+2, 5 h, 31,7 km | 470 (45 km inclus) ; 6 h sur place | 470 € |
| F — Gros bras (maquette) | 2 Gros Bras × 2 h, lave-linge 89 kg | 40 × 2 = 80 + 50 % | 120 € |
| G — Gros bras (capture d'origine) | 1 Gros Bras × 1 h, objet 89 kg | 20 + 50 % | 30 € |
| H — Annulation tardive | DemSolo, 1 h avant | 50 % × 50 € | 25 € |
| I — Dépassement | DemSolo 4 h réservées, 4 h 30 réelles, 15 min d'attente | (30 + 5) × 0,83 | 29,05 € |

## Classement des offres

```
score = 0,3 × prix_normalisé + 0,3 × note/5 + 0,4 × à_l'heure
prix_normalisé = (prix_max − prix) / (prix_max − prix_min)
```

Avec les offres de la maquette (150 €·4,9·à l'heure ; 160 €·4,7·à l'heure ; 145 €·4,2·+1 h 30), l'ordre est Moussa K., Julien R., Aïcha B. : l'offre la moins chère n'est pas la mieux classée.

## Versionnement

- Chaque version de paramètres a une date d'effet et un statut (brouillon, publiée, archivée).
- Le moteur utilise la version active **à la date de la prestation** ; chaque estimation et chaque offre enregistrent `configVersion`.
- Avant publication, une nouvelle version rejoue les estimations des 30 derniers jours et liste les écarts.
