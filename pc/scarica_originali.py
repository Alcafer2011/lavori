"""Il PC di casa prende gli ORIGINALI delle foto dei lavori.

Ogni giro (Operazioni pianificate, ogni 10 minuti):
  1. chiede a Supabase le foto con l'originale ancora online;
  2. lo scarica in  C:\\Users\\infoa\\Carpenteria-foto\\<Album>\\<data>_<id>.<est>
     (prima in un file .parziale, poi controlla il peso, poi lo rinomina);
  3. segna la foto "originale_sul_pc" (nel telefono compare il segno verde);
  4. solo dopo cancella l'originale da internet (online resta la copia leggera).
  Se un album cambia nome, rinomina anche la cartella. Le foto cancellate dall'app
  NON vengono cancellate dal PC: il PC e' la memoria.

Chiavi in C:\\Users\\infoa\\Chiavi\\.env (mai su git):
  CARPENTERIA_SUPABASE_URL=https://xxxx.supabase.co
  CARPENTERIA_SUPABASE_PUBLISHABLE=sb_publishable_...
  CARPENTERIA_PC_EMAIL / CARPENTERIA_PC_PASSWORD   (l'account "PC di casa", amministratore)
Ogni giro bussa a Supabase: finche' il PC e' acceso, il progetto gratuito non si addormenta.
Uso:  python scarica_originali.py          (un giro)
      python scarica_originali.py --prova  (dice cosa farebbe, non tocca niente)
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

CHIAVI = Path(r"C:\Users\infoa\Chiavi\.env")
CARTELLA = Path(os.environ.get("CARPENTERIA_FOTO", r"C:\Users\infoa\Carpenteria-foto"))
REGISTRO = CARTELLA / "registro.txt"
MAPPA = CARTELLA / ".album.json"   # id album -> nome cartella (per seguire i cambi di nome)
PROVA = "--prova" in sys.argv


def leggi_chiavi():
    v = {}
    for riga in CHIAVI.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", riga)
        if m:
            v[m.group(1)] = m.group(2).strip('"').strip("'")
    return v


V = leggi_chiavi()
URL, CHIAVE = V["CARPENTERIA_SUPABASE_URL"].rstrip("/"), V["CARPENTERIA_SUPABASE_PUBLISHABLE"]
INTESTAZIONI = {"apikey": CHIAVE}


def entra():
    """Il PC entra col suo account: il permesso dura un'ora, basta per un giro."""
    corpo = json.dumps({"email": V["CARPENTERIA_PC_EMAIL"], "password": V["CARPENTERIA_PC_PASSWORD"]}).encode()
    req = urllib.request.Request(URL + "/auth/v1/token?grant_type=password", data=corpo, method="POST",
                                 headers={"apikey": CHIAVE, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        INTESTAZIONI["Authorization"] = "Bearer " + json.loads(r.read())["access_token"]


def scrivi_registro(testo):
    riga = datetime.now().strftime("%Y-%m-%d %H:%M:%S") + "  " + testo
    print(riga)
    if not PROVA:
        CARTELLA.mkdir(parents=True, exist_ok=True)
        with REGISTRO.open("a", encoding="utf-8") as f:
            f.write(riga + "\n")


def chiama(metodo, percorso, corpo=None, intestazioni=None, tempo=60):
    dati = json.dumps(corpo).encode() if corpo is not None else None
    h = dict(INTESTAZIONI, **(intestazioni or {}))
    if dati is not None:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(URL + percorso, data=dati, method=metodo, headers=h)
    with urllib.request.urlopen(req, timeout=tempo) as r:
        testo = r.read()
    return json.loads(testo) if testo else None


def nome_sicuro(nome):
    """Nome di cartella valido su Windows."""
    n = re.sub(r'[<>:"/\\|?*\x00-\x1f]', " ", nome).strip().rstrip(".")
    n = re.sub(r"\s+", " ", n)
    return n[:80] or "Senza nome"


def cartelle_album(album):
    """Una cartella per album; se l'album ha cambiato nome, rinomina la cartella."""
    mappa = json.loads(MAPPA.read_text(encoding="utf-8")) if MAPPA.exists() else {}
    for a in album:
        voluto, vecchio = nome_sicuro(a["nome"]), mappa.get(a["id"])
        if vecchio == voluto:
            continue
        altri = {v for k, v in mappa.items() if k != a["id"]}
        n = 2
        base = voluto
        while voluto in altri:  # due album con lo stesso nome "pulito"
            voluto, n = f"{base} ({n})", n + 1
        if vecchio and (CARTELLA / vecchio).exists():
            if (CARTELLA / voluto).exists():
                continue  # la cartella col nome nuovo c'e' gia': si resta su quella vecchia
            if PROVA:
                print("rinominerei", vecchio, "->", voluto)
                continue
            (CARTELLA / vecchio).rename(CARTELLA / voluto)
            scrivi_registro(f"album rinominato: {vecchio} -> {voluto}")
        mappa[a["id"]] = voluto
    if not PROVA:
        CARTELLA.mkdir(parents=True, exist_ok=True)
        MAPPA.write_text(json.dumps(mappa, ensure_ascii=False, indent=1), encoding="utf-8")
    return mappa


def scarica(percorso_online, destinazione, peso_atteso):
    q = urllib.parse.quote(percorso_online)
    req = urllib.request.Request(URL + "/storage/v1/object/authenticated/originali/" + q, headers=INTESTAZIONI)
    parziale = destinazione.with_suffix(destinazione.suffix + ".parziale")
    with urllib.request.urlopen(req, timeout=300) as r, parziale.open("wb") as f:
        while True:
            pezzo = r.read(1 << 20)
            if not pezzo:
                break
            f.write(pezzo)
        f.flush()
        os.fsync(f.fileno())
    peso = parziale.stat().st_size
    if peso == 0 or (peso_atteso and peso != peso_atteso):
        parziale.unlink(missing_ok=True)
        raise RuntimeError(f"copia incompleta ({peso} byte invece di {peso_atteso})")
    parziale.replace(destinazione)
    return peso


def giro():
    entra()
    album = chiama("GET", "/rest/v1/sezioni?select=id,nome")
    cartelle = cartelle_album(album)
    attesa = chiama("GET", "/rest/v1/foto?select=id,sezione_id,originale,nome_file,peso_originale,scattata,creato"
                           "&originale=not.is.null&order=creato.asc&limit=200")
    fatte, errori = 0, []
    for f in attesa:
        try:
            gia_sul_pc = False
            est = Path(f["originale"]).suffix.lower() or ".jpg"
            quando = (f.get("scattata") or f["creato"])[:10]
            dest = CARTELLA / cartelle.get(f["sezione_id"], "Senza album") / f"{quando}_{f['id'][:8]}{est}"
            if PROVA:
                print("scaricherei", f["originale"], "->", dest)
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            if dest.exists() and dest.stat().st_size == f["peso_originale"]:
                gia_sul_pc = True  # giro precedente interrotto dopo la copia
            else:
                scarica(f["originale"], dest, f["peso_originale"])
            # 1) segno verde, 2) via da internet, 3) percorso online vuoto
            chiama("PATCH", "/rest/v1/foto?id=eq." + f["id"],
                   {"originale_sul_pc": True, "percorso_pc": str(dest)}, {"Prefer": "return=minimal"})
            try:
                chiama("DELETE", "/storage/v1/object/originali/" + urllib.parse.quote(f["originale"]))
            except urllib.error.HTTPError as e:
                if e.code != 404:
                    raise
            chiama("PATCH", "/rest/v1/foto?id=eq." + f["id"], {"originale": None}, {"Prefer": "return=minimal"})
            fatte += 1
            if not gia_sul_pc:
                scrivi_registro(f"copiata {f['nome_file'] or f['id']} -> {dest}")
        except Exception as e:  # una foto storta non ferma le altre
            errori.append(f"{f.get('nome_file') or f['id']}: {e}")
            scrivi_registro("ERRORE " + errori[-1])
    if not PROVA:
        chiama("POST", "/rest/v1/giri_pc", {"scaricate": fatte, "errori": "\n".join(errori)[:2000]},
               {"Prefer": "return=minimal"})
        # si tengono solo gli ultimi giri
        vecchi = chiama("GET", "/rest/v1/giri_pc?select=id&order=id.desc&offset=500&limit=1")
        if vecchi:
            chiama("DELETE", f"/rest/v1/giri_pc?id=lte.{vecchi[0]['id']}")
    return fatte, errori


if __name__ == "__main__":
    for tentativo in (1, 2, 3):
        try:
            fatte, errori = giro()
            if fatte or errori:
                print(f"fatte {fatte}, errori {len(errori)}")
            break
        except (urllib.error.URLError, TimeoutError) as e:
            if tentativo == 3:
                scrivi_registro(f"ERRORE di rete: {e}")
                sys.exit(1)
            time.sleep(20 * tentativo)
