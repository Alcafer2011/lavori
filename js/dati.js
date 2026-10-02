/* Dati della galleria: due motori con gli stessi comandi.
   - Supabase (quello vero): se config.js ha indirizzo e chiave.
   - Prova: tutto nella memoria del browser (sparisce ricaricando), per provare la struttura.
   Chi guarda usa galleria(codice); solo il padrone di casa legge e scrive le tabelle. */
(function () {
  const C = window.CONFIG;
  const LATO_GRANDE = 1920, QUALITA_GRANDE = 0.8;   // copia leggera: nitida su telefono e PC (~350 KB)
  const LATO_MINI = 520, QUALITA_MINI = 0.72;       // miniatura per le griglie (~35 KB)

  // ---------- foto: copia leggera fatta nel telefono prima di caricarla ----------
  async function apriImmagine(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* si prova sotto */ }
    }
    return new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => ko(new Error('La foto "' + file.name + '" non si apre (formato non letto dal browser).'));
      img.src = URL.createObjectURL(file);
    });
  }
  function disegna(img, lato, qualita) {
    const w = img.width, h = img.height;
    const k = Math.min(1, lato / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    return new Promise(ok => c.toBlob(b => ok({ blob: b, w: c.width, h: c.height }), 'image/jpeg', qualita));
  }
  async function preparaFoto(file) {
    const img = await apriImmagine(file);
    const grande = await disegna(img, LATO_GRANDE, QUALITA_GRANDE);
    const mini = await disegna(img, LATO_MINI, QUALITA_MINI);
    if (img.close) img.close();
    let scattata = await dataScatto(file);
    if (!scattata && file.lastModified) scattata = new Date(file.lastModified).toISOString();
    return { grande, mini, scattata };
  }

  // Data di scatto scritta dentro la foto JPEG (EXIF DateTimeOriginal). Se non c'e': null.
  async function dataScatto(file) {
    try {
      const buf = await file.slice(0, 256 * 1024).arrayBuffer();
      const v = new DataView(buf);
      if (v.getUint16(0) !== 0xFFD8) return null;
      let p = 2;
      while (p + 4 < v.byteLength) {
        const marcatore = v.getUint16(p), lung = v.getUint16(p + 2);
        if (marcatore === 0xFFE1 && v.getUint32(p + 4) === 0x45786966) return leggiExif(v, p + 10);
        p += 2 + lung;
      }
    } catch (e) { /* niente data */ }
    return null;
  }
  function leggiExif(v, t) {
    const le = v.getUint16(t) === 0x4949;
    const u16 = o => v.getUint16(t + o, le), u32 = o => v.getUint32(t + o, le);
    const cerca = (ifd, tag) => {
      const n = u16(ifd);
      for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (u16(e) === tag) return e; }
      return -1;
    };
    const testo = e => { let s = ''; const o = u32(e + 8); for (let i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(t + o + i)); return s; };
    const ifd0 = u32(4);
    const ex = cerca(ifd0, 0x8769);
    let e = ex >= 0 ? cerca(u32(ex + 8), 0x9003) : -1;      // DateTimeOriginal
    if (e < 0) e = cerca(ifd0, 0x0132);                      // DateTime
    if (e < 0) return null;
    const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(testo(e));
    if (!m || m[1] === '0000') return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).toISOString();
  }

  function nuovoId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function estensione(file) {
    const m = /\.([a-z0-9]{2,5})$/i.exec(file.name || '');
    return m ? m[1].toLowerCase() : (file.type.split('/')[1] || 'jpg');
  }
  const impronta = file => (file.name || '') + '|' + (file.size || 0);

  function traduci(e) {
    const m = (e && e.message) || String(e);
    const t = [
      [/Invalid login credentials/i, 'Email o password sbagliate.'],
      [/Registrazione chiusa|Database error saving new user/i, 'La registrazione è chiusa: l\'account esiste già.'],
      [/already registered|already exists/i, 'Questa email è già registrata: usa "Entra".'],
      [/Password should be at least/i, 'La password deve avere almeno 8 caratteri.'],
      [/should be different from the old/i, 'La nuova password deve essere diversa da quella di prima.'],
      [/Email not confirmed/i, 'Email non ancora confermata.'],
      [/Auth session missing|JWT expired|invalid JWT/i, 'Il link è scaduto: chiedine uno nuovo.'],
      [/Unable to validate email|invalid format|email address .* is invalid/i, 'Email non valida.'],
      [/rate limit|too many/i, 'Troppi tentativi: riprova fra qualche minuto.'],
      [/Failed to fetch|NetworkError|Load failed|network/i, 'Connessione assente o debole: riprova.'],
      [/exceeded the maximum allowed size|Payload too large/i, 'Foto troppo grande (oltre 50 MB).'],
      [/row-level security|permission denied|Unauthorized|Permesso negato/i, 'Permesso negato.'],
      [/duplicate key/i, 'Esiste già un album con questo nome.']
    ];
    for (const [re, it] of t) if (re.test(m)) return new Error(it);
    return new Error(m);
  }

  // ======================= SUPABASE =======================
  function motoreSupabase() {
    // l'accesso resta ricordato nel telefono e si rinnova da solo
    const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const baseFoto = C.supabaseUrl.replace(/\/$/, '') + '/storage/v1/object/public/foto/';
    const ok = r => { if (r.error) throw traduci(r.error); return r.data; };
    async function riprova(fn, volte = 3) {
      for (let i = 1; ; i++) {
        try { return await fn(); } catch (e) {
          if (i >= volte || !/Connessione|fetch|network|timeout|50\d/i.test(e.message)) throw e;
          await new Promise(r => setTimeout(r, 1500 * i));
        }
      }
    }
    const carica = (bucket, percorso, blob, tipo) => riprova(async () =>
      ok(await sb.storage.from(bucket).upload(percorso, blob, { contentType: tipo, cacheControl: '31536000', upsert: true })));

    return {
      prova: false,
      urlFoto: p => p ? baseFoto + p : '',

      async ingresso() { return ok(await sb.rpc('ingresso')) || {}; },
      async galleria(codice) { return ok(await sb.rpc('galleria', { codice })); },
      async galleriaFoto(codice, album) { return ok(await sb.rpc('galleria_foto', { codice, album })) || []; },

      async utente() {
        const { data } = await sb.auth.getSession();
        const s = data.session;
        if (!s) return null;
        const a = await riprova(async () => ok(await sb.rpc('e_admin')));  // linea che cade: errore, non "uscita"
        return { id: s.user.id, email: s.user.email, admin: a === true };
      },
      async entra(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
      async registra(email, password) {
        const d = ok(await sb.auth.signUp({ email, password }));
        if (!d.session) ok(await sb.auth.signInWithPassword({ email, password }));
      },
      async esci() { await sb.auth.signOut(); },
      async passwordDimenticata(email) {
        ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
      },
      async nuovaPassword(password) { ok(await sb.auth.updateUser({ password })); },
      async statoRecupero() { return ok(await sb.rpc('stato_recupero')); },
      async creaCodiceRecupero() { return ok(await sb.rpc('nuovo_codice_recupero')); },
      async nuovoAccessoComando() { return ok(await sb.rpc('nuovo_accesso_comando')); },
      async recupera(codice, email, password) {
        const r = ok(await sb.rpc('recupera_accesso', { codice, nuova_email: email, nuova_password: password }));
        if (!r || !r.ok) throw new Error((r && r.errore) || 'Recupero non riuscito.');
        await this.entra(email, password);
      },

      async impostazioni() { return ok(await sb.from('impostazioni').select('*').eq('id', 1).single()); },
      async salvaImpostazioni(campi) { ok(await sb.from('impostazioni').update(campi).eq('id', 1)); },
      async nuovoCodice(album) { return ok(await sb.rpc('nuovo_codice', { album: album || null })); },
      async spazio() { return ok(await sb.rpc('spazio')); },

      async album() { return ok(await sb.rpc('miei_album')) || []; },
      async creaAlbum(nome, descrizione) {
        return ok(await sb.from('sezioni').insert({ nome, descrizione: descrizione || '' }).select().single());
      },
      async modificaAlbum(id, campi) { ok(await sb.from('sezioni').update(campi).eq('id', id)); },
      async cancellaAlbum(id) {
        const foto = await this.fotoAlbum(id);
        await this.cancellaFoto(foto);
        ok(await sb.from('sezioni').delete().eq('id', id));
      },
      async fotoAlbum(id) {
        const tutte = [];
        for (let da = 0; ; da += 1000) {
          const pezzo = ok(await sb.from('foto').select('*').eq('sezione_id', id)
            .order('scattata', { ascending: false, nullsFirst: false }).order('creato', { ascending: false })
            .range(da, da + 999));
          tutte.push(...pezzo);
          if (pezzo.length < 1000) break;
        }
        return tutte.map(f => ({ ...f, scattata: f.scattata || f.creato }));
      },
      async impronte() { return new Set(ok(await sb.rpc('impronte')) || []); },

      // Carica una foto: prima l'ORIGINALE (privato, aspetta il PC), poi copia leggera e miniatura.
      async caricaFoto(albumId, file, avanza) {
        avanza && avanza('prepara');
        const p = await preparaFoto(file);
        const id = nuovoId();
        const originale = albumId + '/' + id + '.' + estensione(file);
        avanza && avanza('originale');
        await carica('originali', originale, file, file.type || 'application/octet-stream');
        avanza && avanza('copia');
        const percorso = albumId + '/' + id + '.jpg', miniatura = albumId + '/' + id + '-m.jpg';
        try {
          await carica('foto', percorso, p.grande.blob, 'image/jpeg');
          await carica('foto', miniatura, p.mini.blob, 'image/jpeg');
          return ok(await sb.from('foto').insert({
            id, sezione_id: albumId, percorso, miniatura, larghezza: p.grande.w, altezza: p.grande.h,
            scattata: p.scattata, nome_file: file.name || '', peso_originale: file.size || 0, originale
          }).select().single());
        } catch (e) {
          await sb.storage.from('foto').remove([percorso, miniatura]).catch(() => {});
          await sb.storage.from('originali').remove([originale]).catch(() => {});
          throw e;
        }
      },
      async modificaFoto(id, campi) { ok(await sb.from('foto').update(campi).eq('id', id)); },
      async spostaFoto(ids, albumId) { ok(await sb.from('foto').update({ sezione_id: albumId }).in('id', ids)); },
      async cancellaFoto(lista) {
        if (!lista.length) return;
        for (let i = 0; i < lista.length; i += 100) {
          const pezzo = lista.slice(i, i + 100);
          const leggere = pezzo.flatMap(f => [f.percorso, f.miniatura]);
          const originali = pezzo.map(f => f.originale).filter(Boolean);
          ok(await sb.storage.from('foto').remove(leggere));
          if (originali.length) ok(await sb.storage.from('originali').remove(originali));
          ok(await sb.from('foto').delete().in('id', pezzo.map(f => f.id)));
        }
      }
    };
  }

  // ======================= PROVA (solo memoria) =======================
  function motoreProva() {
    const db = {
      imp: { titolo: 'I miei lavori', sottotitolo: 'Carpenteria metallica', codice_tutto: 'prova-tutto-0000000000', registrazione_aperta: true },
      sezioni: [], foto: [], utente: null, blob: new Map()
    };
    const url = new Map();
    const aspetta = ms => new Promise(r => setTimeout(r, ms));
    const copertina = s => {
      const fs = db.foto.filter(f => f.sezione_id === s.id);
      const c = fs.find(f => f.id === s.copertina) || fs.sort((a, b) => b.scattata.localeCompare(a.scattata))[0];
      return c ? c.miniatura : null;
    };
    const vista = s => {
      const fs = db.foto.filter(f => f.sezione_id === s.id);
      return {
        ...s, copertina_id: s.copertina, numero: fs.length, sul_pc: fs.filter(f => f.originale_sul_pc).length,
        copertina: copertina(s), ultima: fs.map(f => f.scattata).sort().pop() || null
      };
    };
    const visibili = codice => codice === db.imp.codice_tutto ? db.sezioni : db.sezioni.filter(s => s.codice === codice);
    const perNome = (a, b) => a.nome.localeCompare(b.nome, 'it');
    const fotoDi = id => db.foto.filter(f => f.sezione_id === id).sort((a, b) => b.scattata.localeCompare(a.scattata));

    const m = {
      prova: true,
      urlFoto: p => url.get(p) || '',
      async ingresso() { return { titolo: db.imp.titolo, sottotitolo: db.imp.sottotitolo, registrazione_aperta: db.imp.registrazione_aperta }; },
      async galleria(codice) {
        const v = visibili(codice);
        if (!v.length && codice !== db.imp.codice_tutto) return null;
        return { titolo: db.imp.titolo, sottotitolo: db.imp.sottotitolo, tutto: codice === db.imp.codice_tutto,
          album: v.map(vista).map(({ id, nome, descrizione, numero, copertina, ultima }) => ({ id, nome, descrizione, numero, copertina, ultima })).sort(perNome) };
      },
      async galleriaFoto(codice, album) {
        if (!visibili(codice).some(s => s.id === album)) return [];
        return fotoDi(album).map(({ id, percorso, miniatura, larghezza, altezza, scattata, nota }) => ({ id, percorso, miniatura, larghezza, altezza, scattata, nota }));
      },
      async utente() { return db.utente; },
      async entra(email) { db.utente = { id: 'u1', email, admin: true }; },
      async registra(email) { db.utente = { id: 'u1', email, admin: true }; db.imp.registrazione_aperta = false; },
      async esci() { db.utente = null; },
      async passwordDimenticata() { await aspetta(300); },
      async nuovaPassword() { await aspetta(200); },
      async statoRecupero() { return db.recupero || null; },
      async creaCodiceRecupero() { db.recupero = { creato: new Date().toISOString() }; return 'PROV-AAAA-BBBB-CCCC-DDDD'; },
      async nuovoAccessoComando() { return { email: 'comando.iphone@example.com', password: 'prova' + Math.random().toString(36).slice(2, 12) }; },
      async recupera(codice, email) {
        if (codice.replace(/[^A-Z0-9]/gi, '').toUpperCase() !== 'PROVAAAABBBBCCCCDDDD') throw new Error('Codice di recupero sbagliato.');
        db.utente = { id: 'u1', email, admin: true }; db.recupero = null;
      },
      async impostazioni() { return { ...db.imp }; },
      async salvaImpostazioni(c) { Object.assign(db.imp, c); },
      async nuovoCodice(album) {
        const c = 'prova-' + Math.random().toString(36).slice(2, 14) + '0000';
        if (album) db.sezioni.find(s => s.id === album).codice = c; else db.imp.codice_tutto = c;
        return c;
      },
      async spazio() {
        const kb = [...db.blob.values()].reduce((t, b) => t + b.size, 0) / 1024;
        return { mb_foto: Math.round(kb / 1024), mb_originali: 0, in_attesa: db.foto.filter(f => f.originale).length,
          sul_pc: db.foto.filter(f => f.originale_sul_pc).length, totale: db.foto.length, ultimo_pc: new Date().toISOString() };
      },
      async album() { return db.sezioni.map(vista).sort(perNome); },
      async creaAlbum(nome, descrizione) {
        if (db.sezioni.some(s => s.nome.toLowerCase() === nome.toLowerCase())) throw new Error('Esiste già un album con questo nome.');
        const s = { id: nuovoId(), nome, descrizione: descrizione || '', copertina: null, codice: 'prova-' + nuovoId().replace(/-/g, '') };
        db.sezioni.push(s); return s;
      },
      async modificaAlbum(id, c) { Object.assign(db.sezioni.find(s => s.id === id), c); },
      async cancellaAlbum(id) { db.foto = db.foto.filter(f => f.sezione_id !== id); db.sezioni = db.sezioni.filter(s => s.id !== id); },
      async fotoAlbum(id) { return fotoDi(id).map(f => ({ ...f })); },
      async impronte() { return new Set(db.foto.map(f => f.nome_file + '|' + f.peso_originale)); },
      async caricaFoto(albumId, file, avanza) {
        avanza && avanza('prepara');
        const p = await preparaFoto(file);
        avanza && avanza('originale'); await aspetta(120);
        avanza && avanza('copia'); await aspetta(80);
        const id = nuovoId();
        const f = { id, sezione_id: albumId, percorso: id + '.jpg', miniatura: id + '-m.jpg', larghezza: p.grande.w, altezza: p.grande.h,
          scattata: p.scattata || new Date().toISOString(), nota: '', nome_file: file.name || '', peso_originale: file.size || 0,
          originale: id + '.orig', originale_sul_pc: false };
        db.blob.set(f.percorso, p.grande.blob); db.blob.set(f.miniatura, p.mini.blob);
        url.set(f.percorso, URL.createObjectURL(p.grande.blob)); url.set(f.miniatura, URL.createObjectURL(p.mini.blob));
        db.foto.push(f);
        // finto PC di casa: prende l'originale dopo qualche secondo
        setTimeout(() => { f.originale = null; f.originale_sul_pc = true; }, 4000);
        return { ...f };
      },
      async modificaFoto(id, c) { Object.assign(db.foto.find(f => f.id === id), c); },
      async spostaFoto(ids, albumId) { db.foto.forEach(f => { if (ids.includes(f.id)) f.sezione_id = albumId; }); },
      async cancellaFoto(lista) { const via = new Set(lista.map(f => f.id)); db.foto = db.foto.filter(f => !via.has(f.id)); }
    };
    window.__provaDb = db;
    return m;
  }

  // arrivo dal link della mail "password dimenticata" (o link scaduto): lo si legge prima che Supabase pulisca l'indirizzo
  const h = new URLSearchParams(location.hash.slice(1));
  const daLink = { recupero: h.get('type') === 'recovery', errore: h.get('error_description') };
  const vero = C.supabaseUrl && C.supabaseKey && window.supabase;
  window.DATI = vero ? motoreSupabase() : motoreProva();
  window.DATI.impronta = impronta;
  window.DATI.daLink = daLink;
})();
