"""Il PC di casa prende gli ORIGINALI delle foto dei lavori.

Ogni giro (Operazioni pianificate, ogni 10 minuti):
  1. chiede a Supabase le foto con l'originale ancora online;
  2. lo scarica in  C:\\Users\\infoa\\Carpenteria-foto\\<Album>\\<data>_<id>.<est>
     (prima in un file .parziale, poi controlla il peso, poi lo rinomina);
  3. segna la foto "originale_sul_pc" (nel telefono compare il segno verde);
  4. solo dopo cancella l'originale da internet (online resta la copia leggera).
  Le foto del Comando Rapido dell'iPhone arrivano SOLO come originale: qui si fanno copia
  leggera e miniatura, si legge la data dalla foto e si scartano i doppioni (stessa impronta).
  Una prenotazione del comando rimasta senza foto per 2 ore viene tolta.
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
import hashlib
import io
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

import pillow_heif
from PIL import Image, ImageOps

pillow_heif.register_heif_opener()  # le foto HEIC dell'iPhone

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
    with urllib.request.urlopen(req, timeout=300) as r, destinazione.open("wb") as f:
        while True:
            pezzo = r.read(1 << 20)
            if not pezzo:
                break
            f.write(pezzo)
        f.flush()
        os.fsync(f.fileno())
    peso = destinazione.stat().st_size
    if peso == 0 or (peso_atteso and peso != peso_atteso):
        destinazione.unlink(missing_ok=True)
        raise RuntimeError(f"copia incompleta ({peso} byte invece di {peso_atteso})")
    return peso


def tipo_file(p):
    """Estensione giusta guardando i primi byte (il Comando Rapido manda il file senza nome)."""
    t = p.open("rb").read(16)
    if t[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if t[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if t[4:8] == b"ftyp":
        marca = t[8:12]
        if marca in (b"heic", b"heix", b"hevc", b"heim", b"heis", b"mif1", b"msf1"):
            return ".heic"
        return {b"avif": ".avif", b"qt  ": ".mov"}.get(marca, ".mp4")
    return ""


def impronta_di(p):
    h = hashlib.sha256()
    with p.open("rb") as f:
        for pezzo in iter(lambda: f.read(1 << 20), b""):
            h.update(pezzo)
    return h.hexdigest()


def data_dallo_scatto(im):
    try:
        ex = im.getexif()
        v = ex.get_ifd(0x8769).get(0x9003) or ex.get(0x0132)
        if v:
            d = datetime.strptime(str(v).strip("\x00 ")[:19], "%Y:%m:%d %H:%M:%S")
            return d.astimezone().isoformat()  # ora del telefono = ora italiana del PC
    except Exception:
        pass
    return None


def copie_leggere(p):
    """Copia leggera (lato lungo 1920) e miniatura (520), JPEG senza dati nascosti (niente posizione GPS)."""
    with Image.open(p) as im:
        data = data_dallo_scatto(im)
        im = ImageOps.exif_transpose(im).convert("RGB")
        uscite = []
        for lato, qualita in ((1920, 80), (520, 72)):
            c = im.copy()
            c.thumbnail((lato, lato), Image.LANCZOS)
            b = io.BytesIO()
            c.save(b, "JPEG", quality=qualita, optimize=True, progressive=True)
            uscite.append((b.getvalue(), c.size))
    return uscite[0], uscite[1], data


def invia_foto(percorso, dati):
    h = dict(INTESTAZIONI, **{"Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000"})
    req = urllib.request.Request(URL + "/storage/v1/object/foto/" + urllib.parse.quote(percorso), data=dati, method="POST", headers=h)
    with urllib.request.urlopen(req, timeout=120) as r:
        r.read()


def togli_online(bucket, percorsi):
    percorsi = [x for x in percorsi if x]
    if percorsi:
        chiama("DELETE", f"/storage/v1/object/{bucket}", {"prefixes": percorsi})


def aggiorna(id_foto, campi):
    chiama("PATCH", "/rest/v1/foto?id=eq." + id_foto, campi, {"Prefer": "return=minimal"})


def eta_ore(iso):
    return (datetime.now().astimezone() - datetime.fromisoformat(iso.replace("Z", "+00:00"))).total_seconds() / 3600


def una_foto(f, cartelle):
    """Ritorna una parola per il registro: copiata / gia / doppione / vuota / aspetta."""
    cartella = CARTELLA / cartelle.get(f["sezione_id"], "Senza album")
    if PROVA:
        print("lavorerei", f["originale"], "->", cartella)
        return "prova"
    gia = sorted(cartella.glob(f"*_{f['id'][:8]}.*"))
    cartella.mkdir(parents=True, exist_ok=True)
    tmp = CARTELLA / ".in-arrivo"
    tmp.mkdir(exist_ok=True)
    tmp = tmp / (f["id"] + ".parziale")
    try:
        scarica(f["originale"], tmp, 0 if f["dal_comando"] else f["peso_originale"])
    except urllib.error.HTTPError as e:
        if e.code not in (400, 404):
            raise
        if gia and f["pronta"]:  # gia' copiata in un giro interrotto: si finisce il lavoro
            aggiorna(f["id"], {"originale": None, "originale_sul_pc": True, "percorso_pc": str(gia[0])})
            return "gia"
        if not f["pronta"] and eta_ore(f["creato"]) > 2:  # il Comando Rapido non l'ha mai mandata
            chiama("DELETE", "/rest/v1/foto?id=eq." + f["id"])
            return "vuota"
        return "aspetta"
    est = tipo_file(tmp) or Path(f["originale"]).suffix.lower() or ".jpg"
    impronta = impronta_di(tmp)
    doppia = chiama("GET", f"/rest/v1/foto?select=id&impronta=eq.{impronta}&id=neq.{f['id']}&limit=1")
    if doppia:  # stessa foto gia' in archivio: si scarta questa
        togli_online("originali", [f["originale"]])
        togli_online("foto", [f["percorso"], f["miniatura"]])
        chiama("DELETE", "/rest/v1/foto?id=eq." + f["id"])
        tmp.unlink(missing_ok=True)
        return "doppione"
    campi = {"impronta": impronta, "peso_originale": tmp.stat().st_size}
    scattata = f.get("scattata")
    if not f["pronta"] or not f["percorso"]:
        (grande, (w, h)), (mini, _), data = copie_leggere(tmp)
        nome = f["originale"].split("/")[-1]
        base = f["originale"].rsplit(".", 1)[0] if "." in nome else f["originale"]
        invia_foto(base + ".jpg", grande)
        invia_foto(base + "-m.jpg", mini)
        scattata = data or scattata or f["creato"]
        campi.update({"percorso": base + ".jpg", "miniatura": base + "-m.jpg", "larghezza": w, "altezza": h,
                      "scattata": scattata, "pronta": True})
    dest = cartella / f"{(scattata or f['creato'])[:10]}_{f['id'][:8]}{est}"
    tmp.replace(dest)
    # 1) foto pronta e segno verde, 2) via da internet, 3) percorso online vuoto
    campi.update({"originale_sul_pc": True, "percorso_pc": str(dest)})
    aggiorna(f["id"], campi)
    try:
        chiama("DELETE", "/storage/v1/object/originali/" + urllib.parse.quote(f["originale"]))
    except urllib.error.HTTPError as e:
        if e.code not in (400, 404):
            raise
    aggiorna(f["id"], {"originale": None})
    chi = f["nome_file"] or ("dal Comando Rapido" if f["dal_comando"] else f["id"])
    scrivi_registro(f"copiata {chi} -> {dest}")
    return "copiata"


def giro():
    entra()
    album = chiama("GET", "/rest/v1/sezioni?select=id,nome")
    cartelle = cartelle_album(album)
    attesa = chiama("GET", "/rest/v1/foto?select=id,sezione_id,originale,nome_file,peso_originale,scattata,creato,"
                           "pronta,dal_comando,percorso,miniatura&originale=not.is.null&order=creato.asc&limit=200")
    fatte, errori, conta = 0, [], {}
    for f in attesa:
        try:
            esito = una_foto(f, cartelle)
            conta[esito] = conta.get(esito, 0) + 1
            fatte += esito in ("copiata", "gia")
            if esito in ("doppione", "vuota"):
                scrivi_registro(f"{esito}: {f['id']} tolta")
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
    return fatte, errori, conta


if __name__ == "__main__":
    for tentativo in (1, 2, 3):
        try:
            fatte, errori, conta = giro()
            if conta or errori:
                print("esiti", conta, "errori", len(errori))
            break
        except (urllib.error.URLError, TimeoutError) as e:
            if tentativo == 3:
                scrivi_registro(f"ERRORE di rete: {e}")
                sys.exit(1)
            time.sleep(20 * tentativo)
