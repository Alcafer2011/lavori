/* I miei lavori — l'app.
   Tre porte:
   - ?v=<codice>   chi ha il link: guarda e basta (tutti gli album o uno solo);
   - senza codice, entrato con la password: il padrone di casa carica, ordina, condivide;
   - senza codice e senza account: la pagina d'ingresso.
   Indirizzi dentro la pagina (#): a=<album>  f=<foto>, cosi' il tasto Indietro del telefono funziona. */
(function () {
  const D = window.DATI;
  const app = document.getElementById('app');
  const CODICE = new URLSearchParams(location.search).get('v');
  const S = { modo: null, galleria: null, album: [], foto: new Map(), imp: null, spazio: null, utente: null,
    scegliendo: false, scelte: new Set(), caricando: false, ultimoDisegno: '' };

  // ---------- attrezzi ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IC = {
    cancello: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 52V22M52 52V22M12 27h40M12 47h40M20 47V18M26 47V15M32 47V13M38 47V15M44 47V18"/></svg>',
    indietro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    avanti: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    chiudi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    piu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    carica: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
    condividi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
    ingranaggio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    matita: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    spunta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    orologio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    occhio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    occhioNo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.6a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3z"/></svg>',
    chiave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2"/></svg>',
    scegli: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>'
  };
  const marchio = '<img class="marchio" src="img/icona.svg" alt="">';
  const mesi = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });
  const giorno = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const breve = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' });
  const ora = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
  const fotoParola = n => n === 1 ? '1 foto' : n + ' foto';
  function quando(iso) {
    if (!iso) return 'mai';
    const d = new Date(iso), oggi = new Date();
    if (d.toDateString() === oggi.toDateString()) return 'oggi alle ' + ora.format(d);
    const ieri = new Date(oggi); ieri.setDate(oggi.getDate() - 1);
    if (d.toDateString() === ieri.toDateString()) return 'ieri alle ' + ora.format(d);
    return giorno.format(d) + ' alle ' + ora.format(d);
  }
  function minutiFa(iso) { return iso ? (Date.now() - new Date(iso).getTime()) / 60000 : Infinity; }

  let tempoAvviso;
  function avvisa(testo, male) {
    const a = document.getElementById('avviso');
    a.textContent = testo; a.className = 'avviso' + (male ? ' male' : ''); a.hidden = false;
    clearTimeout(tempoAvviso); tempoAvviso = setTimeout(() => { a.hidden = true; }, male ? 6000 : 3200);
  }
  document.addEventListener('load', e => { if (e.target.tagName === 'IMG') e.target.classList.add('pronta'); }, true);

  // ---------- indirizzi ----------
  const leggiHash = () => { const p = new URLSearchParams(location.hash.slice(1)); return { a: p.get('a'), f: p.get('f') }; };
  function vai(a, f) {
    const p = new URLSearchParams(); if (a) p.set('a', a); if (f) p.set('f', f);
    const h = p.toString();
    if (h !== location.hash.slice(1)) location.hash = h; else disegna();
  }
  let passiInterni = 0;
  window.addEventListener('hashchange', () => { passiInterni++; disegna(); });
  function torna(a) { if (passiInterni > 0) history.back(); else { history.replaceState(null, '', location.pathname + location.search + (a ? '#a=' + a : '')); disegna(); } }

  // ---------- fogli ----------
  function foglio(html, opz = {}) {
    const velo = document.createElement('div');
    velo.className = 'velo';
    velo.innerHTML = '<div class="foglio" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(velo);
    const f = velo.firstChild;
    const chiudi = () => { if (opz.bloccato && opz.bloccato()) return; velo.remove(); document.removeEventListener('keydown', tasti); opz.chiuso && opz.chiuso(); };
    const tasti = e => { if (e.key === 'Escape') chiudi(); };
    velo.addEventListener('click', e => { if (e.target === velo) chiudi(); });
    document.addEventListener('keydown', tasti);
    f.querySelectorAll('[data-chiudi]').forEach(b => b.addEventListener('click', chiudi));
    const primo = f.querySelector('input, textarea'); if (primo && !opz.senzaFuoco) setTimeout(() => primo.focus(), 50);
    return { f, chiudi, velo };
  }
  function chiedi(titolo, testo, si, pericolo) {
    return new Promise(ok => {
      const { f, chiudi } = foglio('<h2>' + esc(titolo) + '</h2><p class="spiega">' + testo + '</p><div class="tasti-riga fine">' +
        '<button class="tasto" data-chiudi>Annulla</button><button class="tasto ' + (pericolo ? 'pericolo' : 'pieno') + '" data-si>' + esc(si) + '</button></div>',
        { chiuso: () => ok(false) });
      f.querySelector('[data-si]').addEventListener('click', () => { ok(true); chiudi(); });
    });
  }
  async function conAttesa(bottone, fn) {
    const prima = bottone.innerHTML; bottone.disabled = true; bottone.innerHTML = '<span class="scintilla-gira" style="width:18px;height:18px;border-width:2px"></span>';
    try { return await fn(); } finally { bottone.disabled = false; bottone.innerHTML = prima; }
  }

  // campo password con l'occhio per vederla mentre la si scrive
  function campoPassword(nome, etichetta, completa) {
    return '<label class="campo"><span>' + esc(etichetta) + '</span><div class="pw"><input name="' + nome + '" type="password" autocomplete="' + completa +
      '" minlength="8" required autocapitalize="off" spellcheck="false"><button type="button" class="pw-occhio" data-occhio aria-label="Mostra la password" aria-pressed="false">' +
      IC.occhio + '</button></div></label>';
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-occhio]'); if (!b) return;
    e.preventDefault();
    const i = b.parentNode.querySelector('input'), vedi = i.type === 'password';
    i.type = vedi ? 'text' : 'password';
    b.innerHTML = vedi ? IC.occhioNo : IC.occhio;
    b.setAttribute('aria-pressed', String(vedi)); b.setAttribute('aria-label', vedi ? 'Nascondi la password' : 'Mostra la password');
  });
  const scriviErrore = (form, msg) => { const er = form.querySelector('.errore'); er.textContent = msg; er.hidden = false; };

  // ---------- pezzi di pagina ----------
  function testata(titolo, sottotitolo, tasti) {
    return '<header class="testata"><div class="testata-riga">' + marchio +
      '<div class="testata-testi"><h1 class="titolo-grande">' + esc(titolo) + '</h1>' +
      (sottotitolo ? '<p class="sottotitolo">' + esc(sottotitolo) + '</p>' : '') + '</div>' +
      (tasti ? '<div class="testata-tasti">' + tasti + '</div>' : '') + '</div><div class="cordone"></div></header>';
  }
  function piede(t) { return '<footer class="piede"><div class="cordone"></div>' + esc(t || 'Fatto a mano, saldato con cura') + '</footer>'; }

  function lastra(a, padrone) {
    const foto = a.copertina ? '<img src="' + esc(D.urlFoto(a.copertina)) + '" alt="" loading="lazy" decoding="async">' : '<div class="lastra-vuota">' + IC.cancello + '</div>';
    let pc = '';
    if (padrone && a.numero) pc = a.sul_pc >= a.numero ? '<span class="pc">✓ tutte sul PC</span>' : '<span class="pc attesa">' + (a.numero - a.sul_pc) + ' in attesa</span>';
    return '<a class="lastra" href="#a=' + esc(a.id) + '" data-album="' + esc(a.id) + '">' +
      '<div class="lastra-foto">' + foto + '</div><div class="lastra-targhetta"><h2 class="lastra-nome">' + esc(a.nome) + '</h2>' +
      '<div class="lastra-dati"><span>' + fotoParola(a.numero || 0) + '</span>' + (a.ultima ? '<span>' + esc(breve.format(new Date(a.ultima))) + '</span>' : '') + pc + '</div></div></a>';
  }

  function provino(foto, padrone) {
    if (!foto.length) return '';
    let html = '', mese = '';
    const conta = {};
    foto.forEach(f => { const k = f.scattata.slice(0, 7); conta[k] = (conta[k] || 0) + 1; });
    foto.forEach((f, i) => {
      const k = f.scattata.slice(0, 7);
      if (k !== mese) {
        if (mese) html += '</div>';
        mese = k;
        html += '<h3 class="quota">' + esc(mesi.format(new Date(f.scattata))) + ' <span>· ' + conta[k] + '</span></h3><div class="provino">';
      }
      let segno = '';
      if (padrone) segno = f.originale_sul_pc ? '<span class="segno" title="Originale al sicuro sul PC">' + IC.spunta + '</span>'
        : '<span class="segno attesa" title="Originale in attesa del PC">' + IC.orologio + '</span>';
      const scelta = S.scegliendo && S.scelte.has(f.id);
      html += '<button class="scatto' + (scelta ? ' scelta' : '') + '" data-foto="' + i + '" aria-label="Foto ' + (i + 1) + '">' +
        (S.scegliendo ? '<span class="spunta"></span>' : '') +
        '<img src="' + esc(D.urlFoto(f.miniatura)) + '" alt="" loading="lazy" decoding="async">' + segno + '</button>';
    });
    return html + '</div>';
  }

  function targaPC(sp, perAlbum) {
    if (!sp) return '';
    const fermo = minutiFa(sp.ultimo_pc) > 45;
    if (perAlbum) {
      const { numero, sul_pc } = perAlbum;
      if (!numero) return '';
      if (sul_pc >= numero) return '<div class="targa"><b>Tutte le ' + fotoParola(numero) + ' di questo album sono al sicuro sul PC.</b> Puoi cancellarle dal telefono.</div>';
      return '<div class="targa ' + (fermo ? 'allarme' : 'attesa') + '"><b>' + (numero - sul_pc) + ' di ' + numero + ' foto aspettano il PC.</b> ' +
        'Quelle con l\'orologio arancione NON cancellarle ancora dal telefono: aspetta il segno verde.</div>';
    }
    if (!sp.totale) return '';
    const spazioUsato = (sp.mb_foto || 0) + (sp.mb_originali || 0);
    const pieno = spazioUsato > 850 ? '<small>Attenzione: spazio online quasi pieno (' + spazioUsato + ' MB su 1000).</small>' : '';
    const ultimo = '<small>Ultimo passaggio del PC: ' + esc(quando(sp.ultimo_pc)) + '</small>';
    if (!sp.in_attesa) return '<div class="targa"><b>Tutte le ' + fotoParola(sp.totale) + ' sono al sicuro sul PC di casa.</b> ' +
      'Le foto col segno verde puoi cancellarle dal telefono.' + ultimo + pieno + '</div>';
    if (fermo) return '<div class="targa allarme"><b>Il PC di casa non si fa sentire.</b> ' + fotoParola(sp.in_attesa) +
      ' aspettano di essere copiate: NON cancellarle dal telefono finché non vedi il segno verde. Il PC è acceso?' + ultimo + pieno + '</div>';
    return '<div class="targa attesa"><b>' + fotoParola(sp.in_attesa) + ' aspettano il PC</b> (passa ogni 10 minuti). ' +
      'Finché non hanno il segno verde, NON cancellarle dal telefono.' + ultimo + pieno + '</div>';
  }

  // ======================= DISEGNO =======================
  async function disegna() {
    const h = leggiHash();
    try {
      if (S.modo === 'ospite') return await disegnaOspite(h);
      if (S.modo === 'padrone') return await disegnaPadrone(h);
      return disegnaIngresso();
    } catch (e) {
      console.error(e);
      app.innerHTML = '<div class="pagina"><div class="vuoto">' + IC.cancello + '<h2>Qualcosa non va</h2><p>' + esc(e.message) +
        '</p><button class="tasto pieno" onclick="location.reload()">Riprova</button></div></div>';
    }
  }

  // ---------- chi guarda col link ----------
  async function disegnaOspite(h) {
    const g = S.galleria;
    if (!g) {
      app.innerHTML = '<div class="ingresso"><div class="ingresso-lastra">' + marchio + '<h1 class="titolo-grande">Link non valido</h1>' +
        '<p>Questo link non funziona più: forse è stato cambiato. Chiedi a chi te l\'ha mandato quello nuovo.</p></div></div>';
      return;
    }
    const soloUno = !g.tutto && g.album.length === 1;
    const id = soloUno ? g.album[0].id : h.a;
    if (!id) {
      chiudiVisore();
      document.title = g.titolo;
      app.innerHTML = '<div class="pagina">' + testata(g.titolo, g.sottotitolo) +
        (g.album.length ? '<div class="album-griglia">' + g.album.map(a => lastra(a)).join('') + '</div>'
          : '<div class="vuoto">' + IC.cancello + '<h2>Ancora vuota</h2><p>Qui non ci sono ancora lavori da vedere.</p></div>') +
        piede(g.sottotitolo) + '</div>';
      return;
    }
    const a = g.album.find(x => x.id === id);
    if (!a) return vai();
    if (!S.foto.has(id)) {
      if (S.ultimoDisegno !== 'album:' + id) app.innerHTML = '<div class="partenza"><span class="scintilla-gira"></span></div>';
      S.foto.set(id, await D.galleriaFoto(CODICE, id));
    }
    const foto = S.foto.get(id);
    if (S.ultimoDisegno !== 'album:' + id) {
      document.title = a.nome + ' — ' + g.titolo;
      app.innerHTML = '<div class="pagina">' +
        (soloUno ? '' : '<button class="indietro" data-torna>' + IC.indietro + 'Tutti i lavori</button>') +
        (soloUno ? testata(a.nome, g.titolo + (g.sottotitolo ? ' · ' + g.sottotitolo : ''))
          : '<div class="album-testata"><h1 class="titolo-grande">' + esc(a.nome) + '</h1><div class="cordone"></div></div>') +
        (a.descrizione ? '<p class="album-descrizione">' + esc(a.descrizione) + '</p>' : '') +
        '<div class="album-dati">' + fotoParola(foto.length) + '</div>' +
        (foto.length ? provino(foto, false) : '<div class="vuoto">' + IC.cancello + '<h2>Ancora vuoto</h2></div>') + piede(g.sottotitolo) + '</div>';
      const t = app.querySelector('[data-torna]'); if (t) t.onclick = () => torna();
      app.querySelectorAll('[data-foto]').forEach(b => b.onclick = () => vai(id, foto[+b.dataset.foto].id));
      S.ultimoDisegno = 'album:' + id;
      if (!h.f) window.scrollTo(0, 0);
    }
    if (h.f) apriVisore(foto, h.f, id, false); else chiudiVisore();
  }

  // ---------- ingresso ----------
  async function disegnaIngresso(registra) {
    chiudiVisore();
    S.ultimoDisegno = 'ingresso';
    const ing = await D.ingresso().catch(() => ({}));
    const aperta = ing.registrazione_aperta;
    const nuovo = registra && aperta;
    app.innerHTML = '<div class="ingresso"><form class="ingresso-lastra" novalidate>' + marchio +
      '<h1 class="titolo-grande">' + esc(ing.titolo || 'I miei lavori') + '</h1>' +
      (nuovo ? '<p>Crea il tuo account. Sarai l\'unico a poter caricare e modificare: dopo di te la porta si chiude.</p>'
        : '<p>Questa galleria è privata. Per guardarla serve il link che ti è stato mandato. Se sei il proprietario, entra.</p>') +
      '<label class="campo"><span>Email</span><input name="email" type="email" autocomplete="username" required></label>' +
      campoPassword('password', 'Password', nuovo ? 'new-password' : 'current-password') +
      '<p class="errore" hidden></p>' +
      '<button class="tasto pieno" type="submit">' + (nuovo ? 'Crea account' : 'Entra') + '</button>' +
      (aperta ? '<button class="collegamento" type="button" data-cambia>' + (nuovo ? 'Ho già un account: entra' : 'Prima volta? Crea il tuo account') + '</button>' : '') +
      (nuovo ? '' : '<div class="aiuto-accesso"><button class="collegamento" type="button" data-dimenticata>Password dimenticata?</button>' +
        '<button class="collegamento" type="button" data-perso>Ho perso email e password</button></div>') +
      '</form></div>';
    const form = app.querySelector('form'), err = form.querySelector('.errore');
    const c = form.querySelector('[data-cambia]'); if (c) c.onclick = () => disegnaIngresso(!nuovo);
    const di = form.querySelector('[data-dimenticata]'); if (di) di.onclick = () => apriPasswordDimenticata(form.email.value.trim());
    const pe = form.querySelector('[data-perso]'); if (pe) pe.onclick = () => apriRecuperoCodice();
    form.onsubmit = async e => {
      e.preventDefault(); err.hidden = true;
      const email = form.email.value.trim(), pw = form.password.value;
      if (!email || pw.length < 8) { err.textContent = 'Scrivi l\'email e una password di almeno 8 caratteri.'; err.hidden = false; return; }
      try {
        await conAttesa(form.querySelector('[type=submit]'), () => nuovo ? D.registra(email, pw) : D.entra(email, pw));
        await partenza();
      } catch (x) { err.textContent = x.message; err.hidden = false; }
    };
  }

  // ---------- recupero dell'accesso ----------
  function apriPasswordDimenticata(email) {
    const { f } = foglio('<h2>Password dimenticata</h2><p class="spiega">Scrivi l\'email con cui sei entrato: ti arriva un link per scegliere una password nuova.</p>' +
      '<form><label class="campo"><span>Email</span><input name="email" type="email" autocomplete="username" value="' + esc(email) + '" required></label>' +
      '<p class="errore" hidden></p><div class="tasti-riga fine"><button type="button" class="tasto" data-chiudi>Annulla</button>' +
      '<button class="tasto pieno" type="submit">Mandami il link</button></div></form>');
    const form = f.querySelector('form');
    form.onsubmit = async e => {
      e.preventDefault();
      const em = form.email.value.trim(); if (!em) return;
      try {
        await conAttesa(form.querySelector('[type=submit]'), () => D.passwordDimenticata(em));
        form.outerHTML = '<div class="esito"><p><b>Fatto.</b> Se ' + esc(em) + ' è l\'email giusta, fra poco ti arriva una mail: apri il link e scegli la password nuova.</p>' +
          '<p>Non arriva? Guarda nella posta indesiderata. Non ricordi nemmeno l\'email? Usa il <b>codice di recupero</b>.</p></div>' +
          '<div class="tasti-riga fine"><button class="tasto" data-chiudi>Chiudi</button></div>';
        f.querySelector('[data-chiudi]').onclick = () => f.parentNode.remove();
      } catch (x) { scriviErrore(form, x.message); }
    };
  }
  function apriRecuperoCodice() {
    const { f, chiudi } = foglio('<h2>Recupera l\'accesso</h2><p class="spiega">Hai perso email e password? Con il <b>codice di recupero</b> (quello di 20 lettere e numeri che hai salvato) ' +
      'scegli una email e una password nuove. Gli accessi vecchi, per esempio su un telefono perso, vengono chiusi.</p><form>' +
      '<label class="campo"><span>Codice di recupero</span><input name="codice" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" required></label>' +
      '<label class="campo"><span>Email nuova (anche la stessa di prima)</span><input name="email" type="email" autocomplete="username" required></label>' +
      campoPassword('password', 'Password nuova (almeno 8 caratteri)', 'new-password') +
      '<p class="errore" hidden></p><div class="tasti-riga fine"><button type="button" class="tasto" data-chiudi>Annulla</button>' +
      '<button class="tasto pieno" type="submit">Recupera</button></div></form>' +
      '<p class="spiega" style="margin-top:16px">Hai perso anche il codice? Il PC di casa può rimetterti dentro: chiedi a chi ti ha fatto l\'app.</p>');
    const form = f.querySelector('form');
    form.onsubmit = async e => {
      e.preventDefault();
      const codice = form.codice.value.trim(), em = form.email.value.trim(), pw = form.password.value;
      if (!codice || !em || pw.length < 8) return scriviErrore(form, 'Scrivi il codice, l\'email e una password di almeno 8 caratteri.');
      try {
        await conAttesa(form.querySelector('[type=submit]'), () => D.recupera(codice, em, pw));
        chiudi(); await partenza();
        avvisa('Sei di nuovo dentro. Ora crea un codice di recupero nuovo: quello vecchio non vale più.');
      } catch (x) { scriviErrore(form, x.message); }
    };
  }
  function apriNuovaPassword(obbligata) {
    const { f, chiudi } = foglio('<h2>' + (obbligata ? 'Scegli la password nuova' : 'Cambia password') + '</h2>' +
      '<p class="spiega">Almeno 8 caratteri. Tocca l\'occhio per vedere cosa scrivi.</p><form>' +
      campoPassword('password', 'Password nuova', 'new-password') +
      '<p class="errore" hidden></p><div class="tasti-riga fine">' + (obbligata ? '' : '<button type="button" class="tasto" data-chiudi>Annulla</button>') +
      '<button class="tasto pieno" type="submit">Salva password</button></div></form>', { bloccato: () => obbligata });
    const form = f.querySelector('form');
    form.onsubmit = async e => {
      e.preventDefault();
      const pw = form.password.value;
      if (pw.length < 8) return scriviErrore(form, 'Almeno 8 caratteri.');
      try {
        await conAttesa(form.querySelector('[type=submit]'), () => D.nuovaPassword(pw));
        obbligata = false; chiudi(); avvisa('Password cambiata.');
      } catch (x) { scriviErrore(form, x.message); }
    };
  }
  async function apriCodiceRecupero() {
    if (S.recupero && !await chiedi('Fare un codice nuovo?', 'Il codice di recupero che hai già smette di valere: dovrai salvare quello nuovo.', 'Fai codice nuovo')) return;
    let codice;
    try { codice = await D.creaCodiceRecupero(); } catch (e) { return avvisa(e.message, true); }
    S.recupero = { creato: new Date().toISOString() };
    const msg = 'Codice di recupero di "' + S.imp.titolo + '" (serve se perdo email e password):\n' + codice + '\n' + location.origin + location.pathname;
    const { f } = foglio('<h2>Codice di recupero</h2><p class="spiega">Se un giorno perdi <b>email e password</b>, con questo codice rientri e ne scegli di nuove. ' +
      'Salvalo <b>fuori dal telefono</b>: mandalo a te stesso su WhatsApp, oppure scrivilo su un foglio. <b>Non darlo a nessuno</b>: chi lo ha può prendere il tuo account.</p>' +
      '<div class="codice-recupero">' + esc(codice) + '</div>' +
      '<div class="tasti-riga"><a class="tasto whatsapp" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(msg) + '">' + IC.whatsapp + 'Mandalo a me</a>' +
      '<button class="tasto" data-copia>Copia</button></div>' +
      '<p class="spiega" style="margin-top:14px">Dopo che chiudi questa finestra il codice non si può più rivedere (nel database c\'è solo la sua impronta). Puoi sempre farne uno nuovo.</p>' +
      '<div class="tasti-riga fine"><button class="tasto pieno" data-chiudi>L\'ho salvato</button></div>', { senzaFuoco: true, chiuso: () => { S.ultimoDisegno = ''; disegna(); } });
    f.querySelector('[data-copia]').onclick = async () => {
      try { await navigator.clipboard.writeText(codice); avvisa('Codice copiato.'); } catch { avvisa('Tieni premuto sul codice per copiarlo.'); }
    };
  }

  // ---------- il padrone di casa ----------
  async function aggiornaPadrone(soloStato) {
    const [album, sp, rec] = await Promise.all([soloStato ? S.album : D.album(), D.spazio().catch(() => null),
      D.statoRecupero().catch(() => S.recupero)]);
    S.album = album; S.spazio = sp; S.recupero = rec;
  }

  async function disegnaPadrone(h) {
    if (!h.a) {
      chiudiVisore(); esciScelta(true);
      S.ultimoDisegno = 'home';
      document.title = S.imp.titolo;
      app.innerHTML = '<div class="pagina">' +
        testata(S.imp.titolo, S.imp.sottotitolo, '<button class="tasto tondo" data-condividi title="Condividi tutto" aria-label="Condividi tutto">' + IC.condividi + '</button>' +
          '<button class="tasto tondo" data-impostazioni title="Impostazioni" aria-label="Impostazioni">' + IC.ingranaggio + '</button>') +
        (S.recupero ? '' : '<div class="targa allarme"><b>Manca il codice di recupero.</b> Se un giorno perdi email e password, senza codice non potresti più entrare. ' +
          'Crealo ora, ci vuole un minuto.<div class="tasti-riga" style="margin-top:10px"><button class="tasto piccolo" data-recupero>' + IC.chiave + 'Crea il codice</button></div></div>') +
        '<div class="tasti-riga invita"><a class="tasto whatsapp" target="_blank" rel="noopener" href="' + esc(linkWhatsApp(null)) + '">' + IC.whatsapp + 'Invita su WhatsApp</a>' +
        '<button class="tasto" data-condividi2>' + IC.condividi + 'Altri modi</button></div>' +
        targaPC(S.spazio) +
        '<div class="album-griglia">' + S.album.map(a => lastra(a, true)).join('') +
        '<button class="lastra nuova" data-nuovo>' + IC.piu + 'Nuovo album</button></div>' +
        (S.album.length ? '' : '<div class="vuoto"><h2>Si comincia</h2><p>Crea il primo album (per esempio "Cancello carraio"), poi carica le foto dal telefono.</p></div>') +
        piede(S.imp.sottotitolo) + '</div>' +
        '<button class="tasto pieno galleggia" data-carica>' + IC.carica + 'Carica foto</button>';
      app.querySelector('[data-nuovo]').onclick = () => apriNuovoAlbum();
      app.querySelector('[data-carica]').onclick = () => apriCarica();
      app.querySelector('[data-condividi]').onclick = () => apriCondividi(null);
      app.querySelector('[data-condividi2]').onclick = () => apriCondividi(null);
      const rc = app.querySelector('[data-recupero]'); if (rc) rc.onclick = () => apriCodiceRecupero();
      app.querySelector('[data-impostazioni]').onclick = () => apriImpostazioni();
      return;
    }
    const a = S.album.find(x => x.id === h.a);
    if (!a) return vai();
    if (!S.foto.has(a.id)) {
      if (S.ultimoDisegno !== 'album:' + a.id) app.innerHTML = '<div class="partenza"><span class="scintilla-gira"></span></div>';
      S.foto.set(a.id, await D.fotoAlbum(a.id));
    }
    const foto = S.foto.get(a.id);
    if (S.ultimoDisegno !== 'album:' + a.id) disegnaAlbumPadrone(a, foto, true);
    if (h.f) apriVisore(foto, h.f, a.id, true); else chiudiVisore();
  }

  function disegnaAlbumPadrone(a, foto, inCima) {
    document.title = a.nome + ' — ' + S.imp.titolo;
    const sopra = window.scrollY;
    app.innerHTML = '<div class="pagina"><button class="indietro" data-torna>' + IC.indietro + 'Tutti gli album</button>' +
      '<div class="album-testata"><h1 class="titolo-grande">' + esc(a.nome) + '</h1><div class="cordone"></div>' +
      (a.descrizione ? '<p class="album-descrizione">' + esc(a.descrizione) + '</p>' : '') +
      '<div class="album-dati">' + fotoParola(foto.length) + '</div>' +
      '<div class="tasti-riga album-tasti">' +
      '<a class="tasto whatsapp" target="_blank" rel="noopener" href="' + esc(linkWhatsApp(a)) + '">' + IC.whatsapp + 'Invita</a>' +
      '<button class="tasto" data-condividi>' + IC.condividi + 'Link</button>' +
      '<button class="tasto" data-modifica>' + IC.matita + 'Nome</button>' +
      (foto.length ? '<button class="tasto" data-scegli>' + IC.scegli + 'Seleziona</button>' : '') + '</div></div>' +
      targaPC(S.spazio, { numero: foto.length, sul_pc: foto.filter(f => f.originale_sul_pc).length }) +
      (foto.length ? provino(foto, true) : '<div class="vuoto">' + IC.cancello + '<h2>Album vuoto</h2><p>Tocca "Carica foto" per metterci le foto di questo lavoro.</p></div>') +
      piede(S.imp.sottotitolo) + '</div>' +
      (S.scegliendo ? barraScelta() : '<button class="tasto pieno galleggia" data-carica>' + IC.carica + 'Carica foto</button>');
    app.querySelector('[data-torna]').onclick = () => { esciScelta(true); torna(); };
    app.querySelector('[data-condividi]').onclick = () => apriCondividi(a);
    app.querySelector('[data-modifica]').onclick = () => apriModificaAlbum(a);
    const sc = app.querySelector('[data-scegli]'); if (sc) sc.onclick = () => { S.scegliendo = true; S.scelte.clear(); disegnaAlbumPadrone(a, foto); };
    const ca = app.querySelector('[data-carica]'); if (ca) ca.onclick = () => apriCarica(a.id);
    app.querySelectorAll('[data-foto]').forEach(b => b.onclick = () => {
      const f = foto[+b.dataset.foto];
      if (!S.scegliendo) return vai(a.id, f.id);
      if (S.scelte.has(f.id)) S.scelte.delete(f.id); else S.scelte.add(f.id);
      b.classList.toggle('scelta', S.scelte.has(f.id));
      aggiornaBarra();
    });
    if (S.scegliendo) collegaBarra(a, foto);
    S.ultimoDisegno = 'album:' + a.id;
    window.scrollTo(0, inCima && !S.scegliendo ? 0 : sopra);
  }

  // ---------- selezione di piu' foto ----------
  function barraScelta() {
    return '<div class="barra-scelta"><span class="conta" data-conta></span>' +
      '<button class="tasto piccolo" data-sposta>Sposta</button><button class="tasto piccolo" data-copertina>Copertina</button>' +
      '<button class="tasto piccolo pericolo" data-cancella>Cancella</button><button class="tasto piccolo" data-annulla>Fine</button></div>';
  }
  function aggiornaBarra() {
    const n = S.scelte.size, c = app.querySelector('[data-conta]');
    if (!c) return;
    c.textContent = n ? (n === 1 ? '1 foto scelta' : n + ' foto scelte') : 'Tocca le foto da scegliere';
    app.querySelector('[data-sposta]').disabled = !n;
    app.querySelector('[data-cancella]').disabled = !n;
    app.querySelector('[data-copertina]').disabled = n !== 1;
  }
  function esciScelta(senzaDisegno) { S.scegliendo = false; S.scelte.clear(); if (!senzaDisegno) disegna(); }
  function collegaBarra(a, foto) {
    aggiornaBarra();
    const scelte = () => foto.filter(f => S.scelte.has(f.id));
    app.querySelector('[data-annulla]').onclick = () => { S.scegliendo = false; S.scelte.clear(); disegnaAlbumPadrone(a, foto); };
    app.querySelector('[data-copertina]').onclick = async () => { await faiCopertina(a, scelte()[0]); S.scegliendo = false; disegnaAlbumPadrone(a, foto); };
    app.querySelector('[data-sposta]').onclick = () => apriSposta(a, scelte(), () => { S.scegliendo = false; S.scelte.clear(); });
    app.querySelector('[data-cancella]').onclick = () => cancellaFoto(a, scelte(), () => { S.scegliendo = false; S.scelte.clear(); });
  }

  async function faiCopertina(a, f) {
    try { await D.modificaAlbum(a.id, { copertina: f.id }); a.copertina_id = f.id; a.copertina = f.miniatura; avvisa('Copertina dell\'album cambiata.'); }
    catch (e) { avvisa(e.message, true); }
  }
  async function cancellaFoto(a, lista, dopo) {
    const n = lista.length, sulPc = lista.filter(f => f.originale_sul_pc).length;
    const testo = 'Spariscono dalla galleria online' + (sulPc ? ' (gli originali già copiati restano nella cartella del PC di casa)' : '') + '.' +
      (sulPc < n ? ' <b>Attenzione: ' + (n - sulPc) + ' non sono ancora sul PC</b>: se le hai già tolte dal telefono, le perdi.' : '');
    if (!await chiedi(n === 1 ? 'Cancellare la foto?' : 'Cancellare ' + n + ' foto?', testo, 'Cancella', true)) return;
    try {
      await D.cancellaFoto(lista);
      S.foto.delete(a.id); dopo && dopo(); S.ultimoDisegno = '';
      await aggiornaPadrone();
      avvisa(n === 1 ? 'Foto cancellata.' : n + ' foto cancellate.');
      vai(a.id);
    } catch (e) { avvisa(e.message, true); }
  }
  function apriSposta(a, lista, dopo) {
    const altri = S.album.filter(x => x.id !== a.id);
    const { f, chiudi } = foglio('<h2>Sposta ' + fotoParola(lista.length) + '</h2><p class="spiega">In quale album?</p><div class="scelte">' +
      altri.map(x => '<button class="scelta-album" data-in="' + esc(x.id) + '">' + esc(x.nome) + '</button>').join('') +
      '</div>' + (altri.length ? '' : '<p class="spiega">Non ci sono altri album: creane uno prima.</p>') +
      '<div class="tasti-riga fine"><button class="tasto" data-chiudi>Annulla</button></div>', { senzaFuoco: true });
    f.querySelectorAll('[data-in]').forEach(b => b.onclick = async () => {
      try {
        await D.spostaFoto(lista.map(x => x.id), b.dataset.in);
        S.foto.delete(a.id); S.foto.delete(b.dataset.in); dopo && dopo(); S.ultimoDisegno = '';
        await aggiornaPadrone(); chiudi();
        avvisa(fotoParola(lista.length) + ' spostate in "' + b.textContent + '".');
        vai(a.id);
      } catch (e) { avvisa(e.message, true); }
    });
  }

  // ---------- album: nuovo, nome, cancella ----------
  function apriNuovoAlbum(dopo) {
    const { f, chiudi } = foglio('<h2>Nuovo album</h2><p class="spiega">Un album per ogni tipo di lavoro: "Cancello carraio", "Cancello scorrevole", "Ringhiere", "Scale"…</p>' +
      '<form><label class="campo"><span>Nome</span><input name="nome" maxlength="80" required></label>' +
      '<label class="campo"><span>Due parole (facoltativo)</span><textarea name="descrizione" maxlength="600"></textarea></label><p class="errore" hidden></p>' +
      '<div class="tasti-riga fine"><button type="button" class="tasto" data-chiudi>Annulla</button><button class="tasto pieno" type="submit">Crea album</button></div></form>');
    const form = f.querySelector('form');
    form.onsubmit = async e => {
      e.preventDefault();
      const nome = form.nome.value.trim();
      if (!nome) return;
      try {
        const nuovo = await conAttesa(form.querySelector('[type=submit]'), () => D.creaAlbum(nome, form.descrizione.value.trim()));
        await aggiornaPadrone(); chiudi();
        if (dopo) dopo(nuovo); else vai(nuovo.id);
      } catch (x) { const er = form.querySelector('.errore'); er.textContent = x.message; er.hidden = false; }
    };
  }
  function apriModificaAlbum(a) {
    const { f, chiudi } = foglio('<h2>Album</h2><form><label class="campo"><span>Nome</span><input name="nome" maxlength="80" value="' + esc(a.nome) + '" required></label>' +
      '<label class="campo"><span>Due parole (facoltativo)</span><textarea name="descrizione" maxlength="600">' + esc(a.descrizione) + '</textarea></label>' +
      '<p class="errore" hidden></p><div class="tasti-riga"><button type="button" class="tasto pericolo" data-via>Cancella album</button><span style="flex:1"></span>' +
      '<button type="button" class="tasto" data-chiudi>Annulla</button><button class="tasto pieno" type="submit">Salva</button></div></form>');
    const form = f.querySelector('form');
    form.onsubmit = async e => {
      e.preventDefault();
      const nome = form.nome.value.trim(); if (!nome) return;
      try {
        await conAttesa(form.querySelector('[type=submit]'), () => D.modificaAlbum(a.id, { nome, descrizione: form.descrizione.value.trim() }));
        await aggiornaPadrone(); chiudi(); S.ultimoDisegno = ''; disegna();
      } catch (x) { const er = form.querySelector('.errore'); er.textContent = x.message; er.hidden = false; }
    };
    f.querySelector('[data-via]').onclick = async () => {
      chiudi();
      const foto = S.foto.get(a.id) || await D.fotoAlbum(a.id);
      const manca = foto.filter(x => !x.originale_sul_pc).length;
      if (!await chiedi('Cancellare "' + a.nome + '"?', 'Spariscono l\'album e ' + fotoParola(foto.length) + ' dalla galleria online. ' +
        'Gli originali già copiati restano nella cartella del PC.' + (manca ? ' <b>' + manca + ' foto non sono ancora sul PC.</b>' : ''), 'Cancella album', true)) return;
      try { await D.cancellaAlbum(a.id); S.foto.delete(a.id); await aggiornaPadrone(); avvisa('Album cancellato.'); vai(); }
      catch (x) { avvisa(x.message, true); }
    };
  }

  // ---------- condividi ----------
  function linkDi(codice) { return location.origin + location.pathname + '?v=' + codice; }
  function messaggioInvito(a) {
    const link = linkDi(a ? a.codice : S.imp.codice_tutto);
    return a ? 'Ciao! Qui puoi vedere le foto dei miei lavori: ' + a.nome + '\n' + link
      : 'Ciao! Qui puoi vedere le foto dei miei lavori:\n' + link;
  }
  const linkWhatsApp = a => 'https://wa.me/?text=' + encodeURIComponent(messaggioInvito(a));
  function apriCondividi(a) {
    const codice = a ? a.codice : S.imp.codice_tutto;
    const link = linkDi(codice);
    const cosa = a ? 'solo l\'album <b>' + esc(a.nome) + '</b>' : '<b>tutti gli album</b>';
    const testo = (a ? a.nome + ' — ' : '') + S.imp.titolo;
    const { f, chiudi } = foglio('<h2>Condividi</h2><p class="spiega">Chi riceve questo link vede ' + cosa + ' e non può cambiare niente. Non serve nessun account.</p>' +
      '<div class="link-box">' + esc(link) + '</div><div class="tasti-riga">' +
      '<a class="tasto whatsapp" target="_blank" rel="noopener" href="' + esc(linkWhatsApp(a)) + '">' + IC.whatsapp + 'Manda su WhatsApp</a>' +
      (navigator.share ? '<button class="tasto" data-invia>' + IC.condividi + 'Altre app…</button>' : '') +
      '<button class="tasto" data-copia>Copia link</button><a class="tasto" target="_blank" rel="noopener" href="' + esc(link) + '">Guarda come gli altri</a></div>' +
      '<p class="spiega" style="margin-top:22px">Hai mandato il link a qualcuno che non deve più vedere? Cambialo: quello vecchio smette di funzionare.</p>' +
      '<div class="tasti-riga"><button class="tasto pericolo piccolo" data-cambia>Cambia link</button><span style="flex:1"></span><button class="tasto" data-chiudi>Chiudi</button></div>', { senzaFuoco: true });
    const inv = f.querySelector('[data-invia]');
    if (inv) inv.onclick = () => navigator.share({ title: testo, text: messaggioInvito(a).split('\n')[0], url: link }).catch(() => {});
    f.querySelector('[data-copia]').onclick = async () => {
      try { await navigator.clipboard.writeText(link); avvisa('Link copiato.'); } catch { avvisa('Tieni premuto sul link per copiarlo.'); }
    };
    f.querySelector('[data-cambia]').onclick = async () => {
      chiudi();
      if (!await chiedi('Cambiare il link?', 'Chi ha il link vecchio non vedrà più ' + cosa + '. Dovrai mandare quello nuovo.', 'Cambia link', true)) return;
      try {
        const nuovo = await D.nuovoCodice(a ? a.id : null);
        if (a) a.codice = nuovo; else S.imp.codice_tutto = nuovo;
        apriCondividi(a); avvisa('Link cambiato.');
      } catch (e) { avvisa(e.message, true); }
    };
  }

  // ---------- impostazioni ----------
  function apriImpostazioni() {
    const sp = S.spazio || {};
    const { f, chiudi } = foglio('<h2>Impostazioni</h2><form>' +
      '<label class="campo"><span>Titolo</span><input name="titolo" maxlength="60" value="' + esc(S.imp.titolo) + '"></label>' +
      '<label class="campo"><span>Sotto il titolo</span><input name="sottotitolo" maxlength="80" value="' + esc(S.imp.sottotitolo) + '"></label>' +
      '<div class="tasti-riga fine"><button class="tasto pieno" type="submit">Salva</button></div></form>' +
      '<p class="spiega" style="margin-top:20px">Spazio online: <b>' + ((sp.mb_foto || 0) + (sp.mb_originali || 0)) + ' MB su 1000</b> (circa 380 KB per foto). ' +
      'Foto in tutto: ' + (sp.totale || 0) + ', sul PC: ' + (sp.sul_pc || 0) + '.<br>Ultimo passaggio del PC: ' + esc(quando(sp.ultimo_pc)) + '.</p>' +
      '<h3 class="sotto-titolo">Il tuo accesso</h3>' +
      '<p class="spiega">Email: <b>' + esc(S.utente.email) + '</b><br>Il telefono ricorda l\'accesso: non serve rientrare ogni volta.<br>' +
      'Codice di recupero: ' + (S.recupero ? '<b>creato ' + esc(quando(S.recupero.creato)) + '</b>' : '<b style="color:var(--rosso)">non ancora creato</b>') + '</p>' +
      '<div class="tasti-riga"><button class="tasto" data-cambia-pw>' + IC.chiave + 'Cambia password</button>' +
      '<button class="tasto" data-recupero>' + IC.chiave + (S.recupero ? 'Codice di recupero nuovo' : 'Crea codice di recupero') + '</button></div>' +
      '<div class="tasti-riga" style="margin-top:22px"><button class="tasto" data-esci>Esci</button><span style="flex:1"></span><button class="tasto" data-chiudi>Chiudi</button></div>', { senzaFuoco: true });
    f.querySelector('[data-cambia-pw]').onclick = () => { chiudi(); apriNuovaPassword(false); };
    f.querySelector('[data-recupero]').onclick = () => { chiudi(); apriCodiceRecupero(); };
    const form = f.querySelector('form');
    form.onsubmit = async e => {
      e.preventDefault();
      const c = { titolo: form.titolo.value.trim() || 'I miei lavori', sottotitolo: form.sottotitolo.value.trim() };
      try { await D.salvaImpostazioni(c); Object.assign(S.imp, c); chiudi(); S.ultimoDisegno = ''; disegna(); avvisa('Salvato.'); }
      catch (x) { avvisa(x.message, true); }
    };
    f.querySelector('[data-esci]').onclick = async () => { await D.esci(); chiudi(); location.hash = ''; partenza(); };
  }

  // ---------- caricare le foto ----------
  function apriCarica(albumScelto) {
    let scelto = albumScelto || (S.album.length === 1 ? S.album[0].id : null);
    let blocco = null;
    const { f, chiudi } = foglio('<h2>Carica foto</h2><div data-passo1><p class="spiega">In quale album?</p><div class="scelte" data-scelte></div>' +
      '<label class="tasto pieno" style="width:100%;margin-top:18px" data-prendi>' + IC.carica + 'Scegli le foto dal telefono' +
      '<input type="file" accept="image/*" multiple hidden></label>' +
      '<p class="spiega" style="margin-top:12px">Puoi sceglierne quante vuoi. Quelle già caricate vengono saltate da sole.</p></div>' +
      '<div data-passo2 hidden></div><div class="tasti-riga fine"><button class="tasto" data-chiudi>Chiudi</button></div>',
      { senzaFuoco: true, bloccato: () => S.caricando && !confirm('Il caricamento è in corso. Interrompere?'), chiuso: () => { blocco = 'fermo'; } });
    const scelte = f.querySelector('[data-scelte]'), prendi = f.querySelector('[data-prendi]'), input = prendi.querySelector('input');
    function disegnaScelte() {
      scelte.innerHTML = S.album.map(x => '<button class="scelta-album" aria-pressed="' + (x.id === scelto) + '" data-id="' + esc(x.id) + '">' + esc(x.nome) + '</button>').join('') +
        '<button class="scelta-album" data-nuovo>+ Nuovo album</button>';
      scelte.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { scelto = b.dataset.id; disegnaScelte(); });
      scelte.querySelector('[data-nuovo]').onclick = () => apriNuovoAlbum(n => { scelto = n.id; disegnaScelte(); });
      prendi.toggleAttribute('disabled', !scelto);
      prendi.style.opacity = scelto ? '' : '.45';
      prendi.style.pointerEvents = scelto ? '' : 'none';
    }
    disegnaScelte();
    input.onchange = () => {
      const files = [...input.files];
      if (!files.length || !scelto) return;
      f.querySelector('[data-passo1]').hidden = true;
      carica(files, scelto, f.querySelector('[data-passo2]'), () => blocco === 'fermo');
    };
  }

  async function carica(files, albumId, box, fermato) {
    const album = S.album.find(x => x.id === albumId);
    box.hidden = false;
    box.innerHTML = '<p class="spiega">Nell\'album <b>' + esc(album ? album.nome : '') + '</b>. Tieni aperta questa pagina finché non finisce.</p>' +
      '<div class="avanza"><div class="avanza-barra"><i></i></div><div class="avanza-testo"></div></div><div data-esito></div>';
    const barra = box.querySelector('.avanza-barra i'), testo = box.querySelector('.avanza-testo');
    S.caricando = true;
    let sveglia = null;
    try { sveglia = await navigator.wakeLock?.request('screen'); } catch (e) { /* non tutti i telefoni */ }
    const lascia = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', lascia);
    let impronte;
    try { impronte = await D.impronte(); } catch (e) { impronte = new Set(); }
    const r = { fatte: 0, gia: 0, errori: [] };
    let prossima = 0, finite = 0;
    const scrivi = (nome, fase) => {
      barra.style.width = Math.round(finite / files.length * 100) + '%';
      testo.textContent = finite + ' di ' + files.length + (nome ? ' · ' + nome + (fase ? ' (' + fase + ')' : '') : '');
    };
    const FASI = { prepara: 'preparo', originale: 'invio l\'originale', copia: 'invio la copia' };
    async function operaio() {
      while (prossima < files.length && !fermato()) {
        const file = files[prossima++];
        if (impronte.has(D.impronta(file))) { r.gia++; finite++; scrivi(); continue; }
        try {
          await D.caricaFoto(albumId, file, fase => scrivi(file.name, FASI[fase]));
          impronte.add(D.impronta(file)); r.fatte++;
        } catch (e) { r.errori.push({ file, msg: e.message }); }
        finite++; scrivi();
      }
    }
    scrivi();
    await Promise.all([operaio(), operaio()]);
    S.caricando = false;
    window.removeEventListener('beforeunload', lascia);
    if (sveglia) sveglia.release().catch(() => {});
    barra.style.width = '100%';
    S.foto.delete(albumId);
    await aggiornaPadrone().catch(() => {});
    if (leggiHash().a === albumId || !leggiHash().a) { S.ultimoDisegno = ''; disegna(); }
    const male = r.errori.length > 0;
    const es = box.querySelector('[data-esito]');
    es.innerHTML = '<div class="esito' + (male ? ' male' : '') + '"><p><b>' + (r.fatte === 1 ? '1 foto caricata' : r.fatte + ' foto caricate') + '.</b>' +
      (r.gia ? ' ' + r.gia + ' erano già caricate e le ho saltate.' : '') + '</p>' +
      (male ? '<p>' + r.errori.length + ' non sono andate: ' + esc(r.errori[0].msg) + '</p><button class="tasto piccolo" data-riprova>Riprova quelle</button>' : '') +
      (r.fatte ? '<p>Il PC di casa copia gli originali entro 10 minuti. Quando nell\'album vedi il <b>segno verde</b> sulle foto, puoi cancellarle dal telefono.</p>' : '') + '</div>';
    const rp = es.querySelector('[data-riprova]');
    if (rp) rp.onclick = () => carica(r.errori.map(x => x.file), albumId, box, fermato);
  }

  // ======================= VISORE =======================
  let V = null;
  function chiudiVisore() { if (V) { V.el.remove(); document.removeEventListener('keydown', V.tasti); document.body.style.overflow = ''; V = null; } }
  function apriVisore(foto, fotoId, albumId, padrone) {
    let i = foto.findIndex(x => x.id === fotoId);
    if (i < 0) return torna(albumId);
    if (V && V.albumId === albumId) { V.mostra(i); return; }
    chiudiVisore();
    const el = document.createElement('div');
    el.className = 'visore';
    el.innerHTML = '<div class="visore-palco"><div class="visore-sopra"><span class="conta"></span>' +
      '<button class="visore-tasto" data-chiudi aria-label="Chiudi">' + IC.chiudi + '</button></div>' +
      '<button class="visore-tasto visore-freccia sx" data-prima aria-label="Foto precedente">' + IC.indietro + '</button>' +
      '<img alt=""><button class="visore-tasto visore-freccia dx" data-dopo aria-label="Foto seguente">' + IC.avanti + '</button></div>' +
      '<div class="visore-sotto"><div class="visore-data"></div><div class="visore-nota"></div>' +
      (padrone ? '<div class="tasti-riga"><button class="tasto piccolo" data-nota>' + IC.matita + 'Nota</button><button class="tasto piccolo" data-copertina>Copertina</button>' +
        '<button class="tasto piccolo" data-sposta>Sposta</button><button class="tasto piccolo pericolo" data-cancella>Cancella</button></div>' : '') + '</div>';
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    const img = el.querySelector('img'), palco = el.querySelector('.visore-palco');
    const album = () => (padrone ? S.album : (S.galleria ? S.galleria.album : [])).find(x => x.id === albumId);
    let zoom = 1, px = 0, py = 0;
    function trasforma(dx) { img.style.transform = 'translate(' + (px + (dx || 0)) + 'px,' + py + 'px) scale(' + zoom + ')'; }
    function mostra(n) {
      i = n; zoom = 1; px = 0; py = 0; trasforma();
      const f = foto[i];
      img.src = D.urlFoto(f.miniatura);
      const grande = new Image(); grande.src = D.urlFoto(f.percorso);
      grande.onload = () => { if (foto[i] === f) img.src = grande.src; };
      [i - 1, i + 1].forEach(k => { if (foto[k]) new Image().src = D.urlFoto(foto[k].percorso); });
      el.querySelector('.conta').textContent = (i + 1) + ' / ' + foto.length;
      el.querySelector('.visore-data').textContent = giorno.format(new Date(f.scattata));
      el.querySelector('.visore-nota').textContent = f.nota || '';
      el.querySelector('[data-prima]').style.visibility = i > 0 ? '' : 'hidden';
      el.querySelector('[data-dopo]').style.visibility = i < foto.length - 1 ? '' : 'hidden';
    }
    const passa = d => { const n = i + d; if (n >= 0 && n < foto.length) history.replaceState(null, '', '#a=' + albumId + '&f=' + foto[n].id), mostra(n); };
    el.querySelector('[data-chiudi]').onclick = () => torna(albumId);
    el.querySelector('[data-prima]').onclick = () => passa(-1);
    el.querySelector('[data-dopo]').onclick = () => passa(1);
    const tasti = e => {
      if (document.querySelector('.velo')) return;
      if (e.key === 'ArrowLeft') passa(-1); else if (e.key === 'ArrowRight') passa(1); else if (e.key === 'Escape') torna(albumId);
    };
    document.addEventListener('keydown', tasti);

    // dita: scorri per cambiare foto, giu' per chiudere, doppio tocco per ingrandire
    let inizio = null, ultimoTocco = 0, mosso = false;
    palco.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      inizio = { x: e.clientX, y: e.clientY, px, py }; mosso = false; img.classList.add('tira');
      palco.setPointerCapture(e.pointerId);
    });
    palco.addEventListener('pointermove', e => {
      if (!inizio) return;
      const dx = e.clientX - inizio.x, dy = e.clientY - inizio.y;
      if (Math.abs(dx) + Math.abs(dy) > 8) mosso = true;
      if (zoom > 1) { px = inizio.px + dx; py = inizio.py + dy; trasforma(); }
      else if (Math.abs(dx) > Math.abs(dy)) trasforma(dx);
      else if (dy > 0) { img.style.transform = 'translateY(' + dy + 'px) scale(' + Math.max(.8, 1 - dy / 1200) + ')'; }
    });
    const fine = e => {
      if (!inizio) return;
      img.classList.remove('tira');
      const dx = e.clientX - inizio.x, dy = e.clientY - inizio.y;
      inizio = null;
      if (zoom > 1) return;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { passa(dx < 0 ? 1 : -1); trasforma(); return; }
      if (dy > 110 && dy > Math.abs(dx)) { torna(albumId); return; }
      trasforma();
      if (!mosso) {
        const t = Date.now();
        if (t - ultimoTocco < 320) {
          if (zoom > 1) { zoom = 1; px = 0; py = 0; }
          else { const r = img.getBoundingClientRect(); zoom = 2.5; px = (r.left + r.width / 2 - e.clientX) * 1.5; py = (r.top + r.height / 2 - e.clientY) * 1.5; }
          trasforma(); ultimoTocco = 0;
        } else ultimoTocco = t;
      }
    };
    palco.addEventListener('pointerup', fine);
    palco.addEventListener('pointercancel', fine);
    palco.addEventListener('wheel', e => { if (zoom === 1 && Math.abs(e.deltaY) > 30) passa(e.deltaY > 0 ? 1 : -1); }, { passive: true });

    if (padrone) {
      el.querySelector('[data-nota]').onclick = () => {
        const f = foto[i];
        const { f: fg, chiudi } = foglio('<h2>Nota</h2><p class="spiega">Dove, per chi, che materiale… La vede anche chi ha il link.</p><form>' +
          '<label class="campo"><span>Nota</span><textarea name="nota" maxlength="500">' + esc(f.nota) + '</textarea></label>' +
          '<div class="tasti-riga fine"><button type="button" class="tasto" data-chiudi>Annulla</button><button class="tasto pieno">Salva</button></div></form>');
        fg.querySelector('form').onsubmit = async e => {
          e.preventDefault();
          try { const nota = fg.querySelector('textarea').value.trim(); await D.modificaFoto(f.id, { nota }); f.nota = nota; chiudi(); mostra(i); }
          catch (x) { avvisa(x.message, true); }
        };
      };
      el.querySelector('[data-copertina]').onclick = () => faiCopertina(album(), foto[i]);
      el.querySelector('[data-sposta]').onclick = () => apriSposta(album(), [foto[i]]);
      el.querySelector('[data-cancella]').onclick = () => cancellaFoto(album(), [foto[i]]);
    }
    V = { el, tasti, albumId, mostra };
    mostra(i);
  }

  // ======================= PARTENZA =======================
  async function partenza() {
    S.ultimoDisegno = '';
    if (D.prova && !document.querySelector('.prova-nastro')) {
      const n = document.createElement('div'); n.className = 'prova-nastro';
      n.textContent = 'MODALITÀ PROVA — le foto restano solo in questo browser'; document.body.appendChild(n);
    }
    try {
      if (CODICE) {
        S.modo = 'ospite';
        S.galleria = await D.galleria(CODICE);
      } else {
        S.utente = await D.utente();
        if (S.utente && S.utente.admin) {
          S.modo = 'padrone';
          S.imp = await D.impostazioni();
          await aggiornaPadrone();
        } else {
          if (S.utente) { await D.esci(); S.utente = null; }
          S.modo = 'ingresso';
        }
      }
    } catch (e) {
      app.innerHTML = '<div class="ingresso"><div class="ingresso-lastra">' + marchio + '<h1 class="titolo-grande">Non si collega</h1><p>' + esc(e.message) +
        '</p><button class="tasto pieno" onclick="location.reload()">Riprova</button></div></div>';
      return;
    }
    await disegna();
    if (D.daLink.errore && !D.daLink.mostrato) { D.daLink.mostrato = true; avvisa('Il link della mail non vale più (scaduto o già usato): chiedine uno nuovo.', true); }
    if (D.daLink.recupero && S.modo === 'padrone' && !D.daLink.mostrato) { D.daLink.mostrato = true; apriNuovaPassword(true); }
    if (/access_token|error_description/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  }

  // il padrone vede arrivare il segno verde senza ricaricare
  setInterval(async () => {
    if (S.modo !== 'padrone' || S.caricando || S.scegliendo || document.hidden || document.querySelector('.velo') || V) return;
    const attese = (S.spazio && S.spazio.in_attesa) || 0;
    if (!attese) return;
    try {
      await aggiornaPadrone();
      const a = leggiHash().a;
      if (a) S.foto.set(a, await D.fotoAlbum(a));
      S.ultimoDisegno = ''; const y = window.scrollY; await disegna(); window.scrollTo(0, y);
    } catch (e) { /* riprova al giro dopo */ }
  }, 60000);

  window.__app = { S, partenza };
  partenza();
})();
