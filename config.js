// Configuration de la plateforme Benchmark CG Cars
// -------------------------------------------------
// DATA_URL : où la plateforme lit ses données.
//   - "./data/" si tu héberges la plateforme dans le même dépôt GitHub (GitHub Pages) ;
//   - sinon l'URL brute du dépôt, par ex. "https://raw.githubusercontent.com/<compte>/<depot>/main/data/"
//     (les données restent à jour sans redéployer ton site).
// GITHUB_* : dépôt où l'agent quotidien publie le benchmark et où la page Admin enregistre les prix CG Cars.
window.BENCH_CONFIG = {
  DATA_URL: "./data/",
  GITHUB_OWNER: "Nounoubc",
  GITHUB_REPO: "veille-auto",
  GITHUB_BRANCH: "main",
  CG_PRICES_PATH: "data/cg_prices.json"
};
