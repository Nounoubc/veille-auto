"""Mise à jour quotidienne de data/benchmark.json (utilisé par l'agent de veille).

python scripts/update_benchmark.py --obs nouveaux_prix.json --ads pubs.json
  nouveaux_prix.json : [{"date":"AAAA-MM-JJ","acteur":"Raïs Cars","cle":"coolray_mt"|"","modele":"…","version":"…",
                         "prix":318,"base":"Tous frais compris","notes":"","source":"Post Facebook"}]
  pubs.json          : {"Raïs Cars":[{"id":"…","status":"Active","start":"AAAA-MM-JJ","end":"","format":"Image",
                         "cta":"Appeler","modele":"…","prix":318,"base":"…","accroche":"…","resume":"…"}], …}
L'historique n'est jamais supprimé : les prix s'ajoutent (dédoublonnés) ; une pub déjà connue qui
n'apparaît plus est passée en « Inactive » et conservée.
"""
import argparse, json, datetime as dt, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
BENCH = ROOT / "data" / "benchmark.json"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--obs"); ap.add_argument("--ads")
    ap.add_argument("--statut", default="ok", help="ok, partiel ou échec")
    ap.add_argument("--details", default="")
    ap.add_argument("--journal-seul", action="store_true", help="n'écrit que le journal (échec de collecte)")
    a = ap.parse_args()
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    JOURNAL = ROOT / "data" / "journal.json"
    j = json.loads(JOURNAL.read_text(encoding="utf-8")) if JOURNAL.exists() else {"executions": []}
    if a.journal_seul:
        j.update(derniere_execution=now, statut=a.statut, details=a.details)
        j["executions"] = ([{"date": now, "statut": a.statut, "details": a.details, "nouveaux_prix": 0}] + j["executions"])[:60]
        JOURNAL.write_text(json.dumps(j, ensure_ascii=False, indent=1), encoding="utf-8")
        print("journal écrit :", a.statut); return
    b = json.loads(BENCH.read_text(encoding="utf-8"))
    before = len(b["observations"])
    if a.obs:
        seen = {(o["date"], o["acteur"], o["modele"], o.get("version", ""), float(o["prix"]), o.get("base", "")) for o in b["observations"]}
        for o in json.loads(pathlib.Path(a.obs).read_text(encoding="utf-8")):
            o["prix"] = float(o["prix"]); o.setdefault("cle", ""); o.setdefault("notes", ""); o.setdefault("source", "Post Facebook")
            k = (o["date"], o["acteur"], o["modele"], o.get("version", ""), o["prix"], o.get("base", ""))
            if k not in seen:
                seen.add(k); b["observations"].append(o)
        b["observations"].sort(key=lambda x: (x["date"], x["acteur"]), reverse=True)
    if a.ads:
        new = json.loads(pathlib.Path(a.ads).read_text(encoding="utf-8"))
        for acteur, L in new.items():
            old = {x["id"]: x for x in b["publicites"].get(acteur, [])}
            ids = set()
            for ad in L:
                ad["url"] = f"https://www.facebook.com/ads/library/?id={ad['id']}"
                old[ad["id"]] = {**old.get(ad["id"], {}), **ad}; ids.add(ad["id"])
            for i, x in old.items():
                if i not in ids and x.get("status") == "Active":
                    x["status"] = "Inactive"; x.setdefault("end", dt.date.today().isoformat())
            b["publicites"][acteur] = sorted(old.values(), key=lambda x: x.get("start", ""), reverse=True)
    b["maj"] = now
    assert len(b["observations"]) >= before, "l'historique a diminué : arrêt"
    BENCH.write_text(json.dumps(b, ensure_ascii=False, indent=1), encoding="utf-8")
    added = len(b["observations"]) - before
    j.update(derniere_execution=now, statut=a.statut, details=a.details)
    j["executions"] = ([{"date": now, "statut": a.statut, "details": a.details, "nouveaux_prix": added}] + j["executions"])[:60]
    JOURNAL.write_text(json.dumps(j, ensure_ascii=False, indent=1), encoding="utf-8")
    DEM = ROOT / "data" / "demande.json"
    if DEM.exists():
        d = json.loads(DEM.read_text(encoding="utf-8"))
        if d.get("statut") == "en attente":
            d.update(statut="traitée", traitee_le=now, resultat=f"{added} nouveaux prix")
            DEM.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"ok : {before} → {len(b['observations'])} prix ; pubs : " + ", ".join(f"{k} {len(v)}" for k, v in b["publicites"].items()))

if __name__ == "__main__":
    main()
