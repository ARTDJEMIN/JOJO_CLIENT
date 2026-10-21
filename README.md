# Jojo Client — dossier projet

Application mobile Flutter de commande de services (Transport, Déménagement, Gros bras, Groupage, Remorquage). Ce dossier réunit les maquettes, le prototype cliquable, la documentation fonctionnelle et technique, les paramètres tarifaires et le moteur de calcul testé.

## Contenu

| Dossier | Contenu |
| --- | --- |
| `01-maquettes-source/` | Les 32 écrans au format du canevas Design (`.dc.html`) et `canvas.json` (pages et ordre). |
| `02-prototype-html/` | Parcours client cliquable hors ligne : `index.html` (galerie), `screens/` (32 écrans), `captures/` (32 PNG 390 × 844). |
| `03-documentation/` | 01 Architecture fonctionnelle · 02 Architecture de navigation · 03 Règles métier · 04 Règles de calcul · 05 Architecture technique · 06 Points ouverts. |
| `04-configuration/` | `pricing-config.json` (grille paramétrable), `request-states.json` (statuts et transitions), `catalog-sample.json` (objets). |
| `05-moteur-de-calcul/` | `js/` moteur de référence et 16 tests ; `dart/` portage pour Flutter (non exécuté). |
| `06-api/` | `openapi.yaml` (contrat REST, 12 chemins). |
| `07-design-system/` | `tokens.json` (couleurs, typographie, rayons, espacements). |

## Ouvrir le prototype

Ouvrir `02-prototype-html/index.html` dans un navigateur, puis « Lancer le prototype depuis l'accueil ». Chaque écran s'ouvre aussi seul ; certains acceptent des paramètres d'URL, par exemple `screens/Main.html?hasRequest=true`.

## Lancer les tests du moteur

```bash
cd 05-moteur-de-calcul/js
node --test pricing-engine.test.mjs      # Node 18 ou plus

cd ../dart
dart pub get && dart test                # portage Dart, à valider
```

## Ordre de lecture conseillé

1. `03-documentation/01-architecture-fonctionnelle.md`
2. `03-documentation/02-architecture-navigation.md` avec le prototype ouvert
3. `03-documentation/03-regles-metier.md` puis `04-regles-de-calcul.md`
4. `04-configuration/pricing-config.json` et `05-moteur-de-calcul/`
5. `03-documentation/05-architecture-technique.md`, `06-api/openapi.yaml`
6. `03-documentation/06-points-ouverts.md` : décisions attendues

## Conventions

- Les règles métier portent un identifiant `RM-xxx` à citer dans les tickets et les tests.
- Aucune valeur tarifaire n'est codée en dur : tout passe par `pricing-config.json`, versionné par date d'effet.
- Le prix faisant foi est celui calculé par le serveur ; chaque estimation enregistre `configVersion`.
