# Architecture de navigation

L'app tient en 5 onglets. Le bouton central (+) et les pastilles de l'Accueil ouvrent le parcours de commande du service choisi ; la demande envoyée apparaît dans l'onglet Demandes ; une offre acceptée ouvre une discussion dans l'onglet Messages.

## Menu du bas

| Onglet | Écran racine | Rôle |
| --- | --- | --- |
| Accueil | 1 Accueil | Carte centrée sur la position du client (si aucune demande en cours), pastilles des 5 services |
| Demandes | 11 Mes demandes | Liste filtrable par statut |
| (+) | 2 Choix du service | Démarrer une nouvelle demande |
| Messages | 16 Messages | Discussions des demandes acceptées |
| Profil | À concevoir | Compte, profil, préférences |

## Carte de navigation

```mermaid
flowchart LR
    subgraph Onglets
      A[Accueil] --- DEM[Demandes] --- PLUS((+)) --- MSG[Messages] --- PRO[Profil]
    end
    A -->|pastille Transport| T3
    A -->|pastille Déménagement| D3
    A -->|pastille Gros bras| G1
    PLUS --> CS[2 Choix du service]
    CS -->|Transport| T3
    CS -->|Déménagement| D3
    CS -->|Gros bras| G1

    subgraph Transport
      T3[3 Adresses] --> T4[4 Vos affaires] --> T5[5 Accès départ] --> T6[6 Accès arrivée] --> T7[7 Date] --> T8[8 Proposition] --> T9[9 Récapitulatif] --> T10[10 Demande envoyée]
    end
    subgraph Déménagement
      D3[D3 Adresses] --> D4[D4 Affaires liste ou surface] --> D5[D5 Accès départ] --> D6[D6 Accès arrivée] --> D7[D7 Date] --> D8[D8 Proposition] --> D9[D9 Récapitulatif] --> D10[D10 Demande envoyée]
    end
    subgraph Gros_bras
      G1[G1 Mission et lieu] --> G2[G2 Affaires et charge lourde] --> G3[G3 Accès] --> G4[G4 Quand ?] --> G5[G5 Proposition] --> G6[G6 Récapitulatif] --> G7[G7 Demande envoyée]
    end

    T10 & D10 & G7 -->|Suivre ma demande| R12
    DEM --> L11[11 Mes demandes]
    L11 --> R12[12 Détail · Recherche en cours + offres]
    L11 --> R13[13 Détail · En attente de validation]
    L11 --> R14[14 Détail · Acceptée]
    L11 --> R15[15 Détail · Annulée]
    R12 -->|accepter une offre| C17
    R13 -->|valider le montant| C17
    R14 -->|Discuter| C17
    R15 -->|Refaire| CS
    MSG --> M16[16 Messages] --> C17[17 Discussion avec le Jogger]
```

## Inventaire des écrans

| # | Écran | Fichier | Ouvert depuis | Mène vers |
| --- | --- | --- | --- | --- |
| 1 | Accueil | `Main` | onglet Accueil | parcours du service, Demandes, Messages |
| 2 | Choix du service | `NouvelleDemande` | bouton (+) | 3, D3 ou G1 |
| 3 | Les adresses (+ escale) | `Adresses` | 1, 2 | 4 |
| 4 | Vos affaires | `Affaires` | 3 | 5 |
| 5 | Accès au départ | `AccesDepart` | 4 | 6 |
| 6 | Accès à l'arrivée | `AccesArrivee` | 5 | 7 |
| 7 | La date | `Date` | 6 | 8 |
| 8 | Votre proposition | `Proposition` | 7 | 9 |
| 9 | Récapitulatif | `Recap` | 8 | 10 |
| 10 | Demande envoyée | `Confirmation` | 9 | 12, Accueil |
| D3–D10 | Parcours Déménagement | `Dem*` | 1, 2 | idem Transport |
| G1–G7 | Parcours Gros bras | `GB*` | 1, 2 | G2 → G7, puis 12 |
| 11 | Mes demandes | `Demandes` | onglet Demandes | 12 à 15 |
| 12 | Détail · Recherche en cours (offres) | `DetailRecherche` | 11, 10 | 17 après acceptation |
| 13 | Détail · En attente de validation | `DetailAttente` | 11 | 17 après validation |
| 14 | Détail · Acceptée | `DetailAcceptee` | 11 | 17 |
| 15 | Détail · Annulée | `DetailAnnulee` | 11 | 2 |
| 16 | Messages | `Messages` | onglet Messages | 17 |
| 17 | Discussion avec le Jogger | `Conversation` | 16, 14 | 14 |

## Conventions de navigation

- **Parcours de commande** : plein écran, sans menu du bas ; flèche retour en haut à gauche, croix pour quitter (retour à l'Accueil, brouillon conservé), bouton d'action fixé en bas.
- **Progression** : barre en 5 segments et libellé « Étape X sur 5 · <étape> » ; des puces récapitulent les choix déjà faits (service, distance, volume, équipe).
- **Écrans longs** : le contenu défile, l'en-tête et le bouton d'action restent fixes.
- **Liens profonds proposés** : `jojo://request/{id}`, `jojo://request/{id}/offers`, `jojo://conversation/{id}` (notifications d'offre reçue, d'acceptation et de message).

## Routes Flutter suggérées (go_router)

| Route | Écran |
| --- | --- |
| `/` | Accueil (ShellRoute avec menu du bas) |
| `/requests`, `/requests/:id` | Mes demandes, détail selon le statut |
| `/messages`, `/messages/:conversationId` | Messages, discussion |
| `/profile` | Profil |
| `/new` | Choix du service |
| `/new/:service/:step` | Étapes du parcours (`transport`, `demenagement`, `gros_bras`) |
| `/new/:service/summary`, `/new/:service/sent/:id` | Récapitulatif, demande envoyée |
