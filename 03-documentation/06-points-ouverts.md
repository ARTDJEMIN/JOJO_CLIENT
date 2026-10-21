# Points ouverts et hypothèses

Les hypothèses ci-dessous sont implémentées dans le moteur et dans `pricing-config.json` pour qu'il fonctionne de bout en bout. Chacune doit être confirmée ou corrigée par Jojo ; une correction se fait en changeant un paramètre, rarement le code.

| # | Sujet | Hypothèse retenue | À décider |
| --- | --- | --- | --- |
| 1 | Part main-d'œuvre d'une formule | N × 20 €/h, utilisée pour les majorations de nuit et la charge lourde. | Taux réel par formule ? |
| 2 | Objet spécifique (40 €/h par personne) | S'ajoute au prix de la grille, personnes = Gros Bras + Jogger. | Remplace-t-il la part main-d'œuvre ? |
| 3 | Prix Gros bras | Grille Gros Bras × nombre de Gros Bras. | La grille est-elle par personne ou par équipe ? |
| 4 | Km en plus Gros bras | Non défini dans la grille (10 km inclus). | Tarif au km, ou forfait déplacement ? |
| 5 | Temps de manutention | Fourni en entrée (`handlingHours`) ; seul le minimum camion plein est appliqué. | Modèle par objet ou par m³ et par Gros Bras. |
| 6 | « Les amis aident » | La grille indique à la fois que l'aide annule la majoration d'étage et qu'elle n'est pas prise en compte. Retenu : annule la majoration seulement si une personne est à chaque palier. | Confirmer. |
| 7 | Portage | + 10 % par tranche **complète** de 20 m. | Tranche entamée comptée ? |
| 8 | Pause | 1 h à partir de 5 h pour les formules avec Gros Bras ; pas de pause pour DemSolo. | Confirmer pour DemSolo. |
| 9 | Écran Proposition Transport | Les tarifs affichés sont ceux de la maquette ; l'option 20 m³ sans Gros Bras n'existe pas dans la matrice. | Aligner l'écran sur le moteur (prochaine itération). |
| 10 | Au-delà de 20 m³ | Sortie en devis. | Plusieurs camions calculés automatiquement ? |
| 11 | Remorquage, Groupage | Absents de la grille ; parcours non conçus. | Grille et parcours à fournir. |
| 12 | Arrondis | Au centime, à la fin du calcul ; palier à l'heure supérieure. | Arrondi à l'euro ? Demi-heures ? |
| 13 | Classement des offres | Poids prix 0,3, note 0,3, ponctualité 0,4 (reproduit l'ordre de la maquette). | Poids définitifs, ajout de la distance ? |
| 14 | Statut « Terminée » | Ajouté pour clore le cycle (notation). | Confirmer et concevoir l'écran. |
| 15 | Profil | Onglet non conçu. | Contenu Particulier / Professionnel. |

## Limites de cette livraison

- Le portage Dart du moteur n'a pas pu être exécuté (pas de SDK Dart dans l'environnement de production) : il reprend la logique JS testée, à valider avec `dart test`.
- Les captures PNG utilisent une police de remplacement : le prototype HTML charge Inter en ligne.
- Sur l'écran G5 Proposition, le montant « 40 € » de la ligne charge lourde peut passer à la ligne sur petit écran (à corriger avec `white-space: nowrap`).
