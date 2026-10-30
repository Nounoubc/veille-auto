# Benchmark CG Cars — plateforme de veille prix

Site statique (HTML / CSS / JavaScript, sans dépendance) qui compare les prix de CG Cars à ceux de
Raïs Cars, CHM Automotive, Nesrat Auto et China Car Go, avec historique, graphiques, publicités Meta
et saisie des prix CG Cars.

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html`, `styles.css`, `app.js` | La plateforme |
| `config.js` | Où lire les données et quel dépôt GitHub utiliser |
| `data/benchmark.json` | Prix des concurrents + publicités (mis à jour chaque matin par l'agent) |
| `data/cg_prices.json` | Grille CG Cars + historique de vos prix (modifié depuis l'onglet « Nos prix ») |
| `scripts/update_benchmark.py` | Script utilisé par l'agent pour ajouter les relevés du jour sans rien effacer |

## Hébergement

1. **Sur GitHub Pages (le plus simple)** : dans le dépôt, Settings → Pages → Source « Deploy from a branch »,
   branche `main`, dossier `/ (root)`. Laisser `DATA_URL: "./data/"` dans `config.js`.
2. **Sur ton propre hébergement** : copie `index.html`, `styles.css`, `app.js`, `config.js` sur ton serveur et
   mets dans `config.js` :
   `DATA_URL: "https://raw.githubusercontent.com/Nounoubc/veille-auto/main/data/"`.
   Les données restent ainsi à jour chaque matin sans redéployer ton site.

> Pour tester en local, ouvre le dossier avec un petit serveur (`python -m http.server`) : les navigateurs
> bloquent la lecture des fichiers JSON quand on ouvre `index.html` en double-cliquant.

## Saisir les prix CG Cars (onglet « Nos prix »)

1. Crée un jeton GitHub : github.com → Settings → Developer settings → Personal access tokens →
   **Fine-grained tokens** → *Generate new token* → *Only select repositories* : ce dépôt →
   Permissions → **Contents : Read and write**.
2. Dans l'onglet « Nos prix », colle le jeton, modifie les prix, clique sur **Enregistrer**.
   Chaque prix modifié est daté et ajouté à l'historique : les courbes CG Cars évoluent.
3. Le jeton n'est envoyé qu'à api.github.com. Coche « Mémoriser » seulement sur ton propre ordinateur.

Colonne « Modèle comparé » : relie une ligne de ta grille à un modèle suivi chez les concurrents
(ex. « MT, -3 ans » ↔ « Geely Coolray MT / Manuel »). Seules les lignes reliées entrent dans le comparatif.

## Règles de comparaison

- Unité : millions de centimes (M) ; 1 M = 10 000 DA.
- Par défaut, on ne compare que les prix « tous frais compris / TTC » (les prix « hors douane », « port d'Alger »
  ou « carte grise » restent visibles dans l'Historique).
- Les dates des posts Facebook sont estimées à partir de l'ancienneté affichée (« 2 j », « 1 sem. »).
- Publicités : Meta Ad Library, pays Algérie.
