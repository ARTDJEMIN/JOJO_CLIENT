# Règles métier

Chaque règle porte un identifiant stable (RM-xxx) à citer dans les tickets et les tests. La colonne **Paramètre** nomme la clé de `04-configuration/pricing-config.json` qui la pilote : aucune valeur n'est codée en dur dans l'app.

## Adresses et escale (Transport, Déménagement)

| ID | Règle | Paramètre |
| --- | --- | --- |
| RM-ADR-01 | Départ et arrivée obligatoires, sélectionnés via l'autocomplétion Google Places. | — |
| RM-ADR-02 | Saisie libre possible si l'adresse est introuvable ; elle est géocodée, sinon la demande est marquée « à vérifier ». | — |
| RM-ADR-03 | Distance = itinéraire routier Google départ → escales → arrivée, à 0,1 km près, non modifiable à la main. | — |
| RM-ADR-04 | Durée de trajet = durée Google hors circulation (ex. 26,1 km → 43 min). | — |
| RM-ADR-05 | Escale facultative, 1 au maximum. | `booking_policy.stopover_max_count` |
| RM-ADR-06 | Temps sur place à l'escale : 30, 60 ou 90 min, ajoutés à la durée ; renfort de Gros Bras possible. | `booking_policy.stopover_durations_min` |
| RM-ADR-07 | Adresse dans une zone à stationnement réglementé (codes postaux 75xxx) : place réservée obligatoire. | `parking_policy.mandatory_zones_postcode_prefixes` |

## Mission et lieu (Gros bras)

| ID | Règle | Paramètre |
| --- | --- | --- |
| RM-GB-01 | Le client choisit une mission : charger un véhicule, décharger, monter ou descendre, déplacer sur place. | — |
| RM-GB-02 | Un lieu obligatoire, un deuxième lieu facultatif ; 10 km inclus entre les lieux. | `formulas[GROS_BRAS].tiers[].km_included` |
| RM-GB-03 | Sans camion : aucune question de stationnement. | — |
| RM-GB-04 | Nombre de Gros Bras de 1 à 3 ; prix de la grille Gros Bras multiplié par le nombre de Gros Bras. | `price_modifiers.gros_bras_price_per_helper` |
| RM-GB-05 | Jusqu'à 3 missions le même jour dans une réservation, chacune avec son lieu et son heure. | `booking_policy.max_missions_per_booking` |
| RM-GB-06 | Montage de meuble et débarras proposés en option, confirmés sur devis sous 2 h. | `flat_services` |

## Vos affaires et volume

| ID | Règle | Paramètre |
| --- | --- | --- |
| RM-AFF-01 | Catalogue de 100 objets par catégorie ; chaque objet a un volume et des attributs (volumineux, plus de 80 kg, spécifique). | `catalog-sample.json` |
| RM-AFF-02 | Dès que la liste est renseignée, elle détermine seule le volume : V = Σ quantité × volume unitaire. | `volume_policy.list_overrides_surface` |
| RM-AFF-03 | Sans liste : V = surface × 2 m ÷ 4 (70 m² → 35 m³), ou surface type du logement (Studio 25, T2 45, T3 65, T4+ 85 m²). | `volume_policy.*` |
| RM-AFF-04 | Photos facultatives : un emplacement par unité déclarée, qui suit la quantité. | — |
| RM-AFF-05 | « Qui charge ? » : moi-même (0 Gros Bras) ou 1 à 3 Gros Bras. | `selection_matrix` |
| RM-AFF-06 | Question obligatoire « un objet de plus de 80 kg ? » ; si oui, l'objet et son poids, et 2 Gros Bras conseillés. | `labor.heavy_item_threshold_kg` |
| RM-AFF-07 | Au-delà de 20 m³ : sortie en devis (plusieurs camions ou clé en main). | `volume_policy.quote_above_m3` |

## Accès

| ID | Règle | Paramètre |
| --- | --- | --- |
| RM-ACC-01 | Pour chaque adresse : étage, ascenseur (et le mobilier y passe), distance de portage, informations d'accès. | — |
| RM-ACC-02 | Client qui charge seul : affaires prises au niveau de la rue, les accès ne changent pas la durée. | `duration_modifiers.self_loading_ignores_access` |
| RM-ACC-03 | Place de stationnement pour le ou les camions : question obligatoire à chaque adresse (Transport, Déménagement). | — |
| RM-ACC-04 | Réponse « Oui » à l'arrivée : téléversement du certificat de stationnement (PDF, JPG, PNG). | `parking_policy.certificate_formats` |
| RM-ACC-05 | Réponse « Non » en zone réglementée : rappel de la demande d'autorisation à la mairie, environ 14 jours avant. | `parking_policy.permit_lead_days` |
| RM-ACC-06 | « Mêmes conditions qu'au départ » recopie étage, ascenseur et portage. | — |
| RM-ACC-07 | Tranches de portage proposées par pas de 20 m (0–20, 20–40, 40–60, 60 m +), alignées sur la règle de calcul. | `duration_modifiers.carry_distance.step_m` |

## Date, durée, réservation

| ID | Règle | Paramètre |
| --- | --- | --- |
| RM-DAT-01 | Service 24 h/24, 7 j/7, réservation au moins 2 h à l'avance. | `booking_policy.min_lead_hours` |
| RM-DAT-02 | Créneaux majorés affichés sur la grille horaire : 21 h 30–23 h (+ 30 %), 23 h–7 h (+ 50 %). | `price_modifiers.time_slots` |
| RM-DUR-01 | Jojo propose la durée estimée ; le client peut réserver jusqu'à 4 h de plus, ou moins avec un avertissement de dépassement. | `duration_policy.max_extra_hours_over_estimate` |
| RM-DUR-02 | Le palier reste dans les bornes de la formule (Gros Bras 1–7 h, Cargo+3 4–8 h, autres 1–8 h). | `formulas[].min_hours / max_hours` |
| RM-RES-01 | Réservation gratuite dans l'app et sur le site ; 10 € de frais de dossier par téléphone. | `price_modifiers.phone_booking_fee` |
| RM-RES-02 | Acceptation des conditions générales obligatoire à l'envoi. | — |

## Offres et messagerie

| ID | Règle | Paramètre |
| --- | --- | --- |
| RM-OFF-01 | Une demande en recherche peut recevoir plusieurs offres, une par Jogger. | `offers_policy.one_offer_per_jogger` |
| RM-OFF-02 | Offres classées de la meilleure à la moins bonne par un score : prix 30 %, note 30 %, respect de l'heure 40 %. | `offers_policy.ranking_weights` |
| RM-OFF-03 | Chaque offre : rang, Jogger, note et avis, prix, camion, heure d'arrivée ; le détail ajoute formule, km inclus, dépassement, prestations réalisées, message. | — |
| RM-OFF-04 | Rejeter une offre la retire de la liste ; le classement se recalcule. | — |
| RM-OFF-05 | Accepter une offre passe la demande en « Acceptée » ; les autres offres sont clôturées et ne sont plus consultables. | `offers_policy.close_others_on_accept` |
| RM-OFF-06 | Montant ajusté par le Jogger : statut « En attente de validation » jusqu'à la décision du client. | — |
| RM-MSG-01 | La discussion s'ouvre à l'acceptation et apparaît dans l'onglet Messages ; aucune discussion avant. | — |
| RM-MSG-02 | Demande annulée : la discussion reste consultable en lecture seule. | — |

## Annulation, attente, dépassement

| ID | Règle | Paramètre |
| --- | --- | --- |
| RM-ANN-01 | Annulation gratuite jusqu'à 2 h avant le début. | `cancellation_policy.free_until_hours_before` |
| RM-ANN-02 | Moins de 2 h avant : 50 % du tarif minimum de la formule de l'offre. | `cancellation_policy.late_cancel_ratio_of_min_price` |
| RM-ANN-03 | Client absent sur place : 100 % du tarif minimum. | `cancellation_policy.no_show_ratio_of_min_price` |
| RM-ATT-01 | 10 min d'attente offertes, puis facturées au tarif de dépassement de la formule. | `cancellation_policy.waiting_free_minutes` |
| RM-DEP-01 | Temps au-delà du palier réservé facturé à la minute (tarif de la formule). | `formulas[].overtime_per_min` |
| RM-DEP-02 | Km au-delà de l'inclus facturés au km (tarif de la formule). | `formulas[].extra_km_rate` |
| RM-DEP-03 | Stationnement et péages au réel. | — |
