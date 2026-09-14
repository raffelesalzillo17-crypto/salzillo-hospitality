/* RIATTIVATO il 14/09/2026, per ora SOLO su tulipano.html (le altre 4 pagine restano senza
   modulo). Era stato scollegato il 10/09/2026 da tutte e 5 le pagine dopo una brutta esperienza
   con un'ospite reale (Serafina Posillipo, Stanza Rosa — le etichette dei campi restavano vuote
   per il secondo ospite aggiunto, sembrava rotto). Causa trovata e corretta (applyLang() non
   veniva richiamata sulle card aggiunte dopo la prima — vedi commento in aggiungiOspite() più
   sotto). Aggiunto anche un avviso Telegram immediato a Raffaele se un ospite resta bloccato
   perché il sistema non trova la sua prenotazione sul foglio (src/lib/cronAlert.ts,
   alertOspiteBloccato — chiamato da src/app/api/schedine/route.ts), così se succede ancora lo
   sa lo stesso giorno invece di scoprirlo dall'ospite. Prossimo passo, dopo un giro di verifica
   sul Tulipano: riattivare anche sulle altre 4 pagine.

   Gate di check-in — raccoglie i dati degli ospiti PRIMA di sbloccare la pagina informativa
   (WiFi, regole della casa...). Proposto da Raffaele (09/09/2026), poi allineato da lui stesso
   al vero tracciato di Alloggiati Web (sesso, tipo alloggiato, stato/comune di nascita,
   cittadinanza e documento come codici ufficiali, non testo libero), arricchito con lettura
   automatica del documento fotografato (Claude Vision, stesso motore già usato per il bot
   Telegram), e poi corretto su mobile dopo un test reale di Raffaele (bug di layout, upload
   foto troppo rigido, niente modo di rimuovere un ospite aggiunto per errore, contatto
   sbagliato). Vedi wiki/entita/salzillo-hospitality.md.

   Riusa /api/schedine (già esistente, usato anche da Motore Rafilu) — nessun nuovo modello
   dati oltre alle colonne aggiunte in coda il 09/09/2026 (vedi src/lib/schedine.ts). Le
   tabelle dei codici ufficiali (stati, tipi documento) vengono da /checkin/tabelle.json,
   generato da src/lib/alloggiatiTabelle.ts — scaricate DAVVERO dal servizio reale, non
   inventate. Se cambia src/lib/alloggiatiTabelle.ts, rigenerare anche quel JSON.

   Uso: <script src="/checkin/checkin-gate.js" data-stanza="Rosa"></script> — "data-stanza"
   deve combaciare esattamente col nome usato in DATABASE (vedi src/lib/strutture.ts). */

(function () {
  var STANZA = document.currentScript.getAttribute('data-stanza');
  if (!STANZA) { console.error('[checkin-gate] manca data-stanza sul tag script'); return; }

  var STORAGE_KEY = 'checkin_ok_' + STANZA.toLowerCase().replace(/\s+/g, '-');
  if (localStorage.getItem(STORAGE_KEY) === '1') return; // già fatto su questo dispositivo, niente gate

  var TIPO_ALLOGGIATO = { OSPITE_SINGOLO: '16', CAPO_FAMIGLIA: '17', CAPO_GRUPPO: '18', FAMILIARE: '19', MEMBRO_GRUPPO: '20' };
  var TABELLE = null; // caricate al volo da /checkin/tabelle.json

  // Numero WhatsApp "Salzillo Hospitality" (non quello di Lella, che è la referente solo per
  // le questioni pratiche in loco — vedi rosa.html ecc.) — per problemi col check-in online.
  var WHATSAPP_HOSPITALITY = 'https://wa.me/393522203806';

  var T = {
    it: {
      titolo: 'Prima di iniziare', sub: 'Per legge dobbiamo registrare i tuoi documenti in Questura entro 24 ore dal check-in. Compila i dati qui sotto (o carica una foto del documento e proviamo a leggerli per te): appena confermati, la pagina si sblocca subito.',
      dataArrivo: 'Data del tuo check-in', ospite: 'Ospite', rimuovi: '✕ Rimuovi', cognome: 'Cognome', nome: 'Nome', sesso: 'Sesso', seleziona: 'Seleziona…', maschio: 'Maschio', femmina: 'Femmina',
      dataNascita: 'Data di nascita', luogoNascita: 'Comune/città di nascita', statoNascita: 'Stato di nascita', cittadinanza: 'Cittadinanza',
      tipoDocumento: 'Tipo documento', numeroDocumento: 'Numero documento', luogoRilascio: 'Luogo di rilascio del documento',
      caricaFoto: '📷 Documento (foto o file)', leggendo: 'Leggo il documento…', lettoOk: '✓ Dati letti — controllali prima di inviare',
      lettoErrore: 'Non sono riuscito a leggere la foto, compila a mano.',
      tipoGruppo: 'Siete un gruppo?', gruppoFamiglia: 'Famiglia', gruppoAmici: 'Amici/colleghi',
      aggiungi: '+ Aggiungi un altro ospite', invia: 'Invia e continua', invio: 'Invio in corso…',
      erroreCampi: 'Compila tutti i campi obbligatori (sesso, cittadinanza e stato di nascita compresi).', erroreGenerico: 'Qualcosa non ha funzionato.',
      contatta: 'Problemi? Contatta Salzillo Hospitality su WhatsApp', fatto: 'Fatto, un attimo…',
    },
    en: {
      titolo: 'Before you start', sub: "By law we must register your documents with the local police within 24 hours of check-in. Fill in the details below (or upload a photo of your document and we'll try to read it for you): as soon as they're confirmed, the page unlocks right away.",
      dataArrivo: 'Your check-in date', ospite: 'Guest', rimuovi: '✕ Remove', cognome: 'Last name', nome: 'First name', sesso: 'Sex', seleziona: 'Select…', maschio: 'Male', femmina: 'Female',
      dataNascita: 'Date of birth', luogoNascita: 'Town/city of birth', statoNascita: 'Country of birth', cittadinanza: 'Nationality',
      tipoDocumento: 'Document type', numeroDocumento: 'Document number', luogoRilascio: 'Place document was issued',
      caricaFoto: '📷 Document (photo or file)', leggendo: 'Reading document…', lettoOk: '✓ Data read — please check before sending',
      lettoErrore: "Couldn't read the photo, please fill in by hand.",
      tipoGruppo: 'Are you a group?', gruppoFamiglia: 'Family', gruppoAmici: 'Friends/colleagues',
      aggiungi: '+ Add another guest', invia: 'Send and continue', invio: 'Sending…',
      erroreCampi: 'Fill in every required field (including sex, nationality and country of birth).', erroreGenerico: 'Something went wrong.',
      contatta: 'Problems? Contact Salzillo Hospitality on WhatsApp', fatto: 'Done, one moment…',
    },
  };
  var lang = 'it';

  function isoToIt(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '';
  }

  var style = document.createElement('style');
  style.textContent = '#checkin-gate-overlay, #checkin-gate-overlay * { box-sizing: border-box; }' +
    '#checkin-gate-overlay input, #checkin-gate-overlay select { max-width: 100%; }';
  document.head.appendChild(style);

  var overlay = document.createElement('div');
  overlay.id = 'checkin-gate-overlay';
  // overflow-x:hidden esplicito — senza, il solo overflow-y:auto fa calcolare overflow-x ad
  // "auto" (regola CSS: se uno dei due assi scrolla e l'altro è "visible", quello visible
  // diventa "auto"), quindi un pixel di overflow orizzontale qualsiasi rende la pagina
  // scorrevole/spostabile lateralmente sul dito — probabile secondo contributo al "si muove
  // a destra e sinistra" segnalato da Raffaele il 09/09/2026, oltre alla causa vera trovata
  // lo stesso giorno: tutti i campi input/select del gate erano a font-size 15px invece di
  // 16px come nel resto del sito (vedi campoTesto/campoData/campoStato/campoSesso/
  // campoDocumento sotto) — su iOS Safari un campo sotto i 16px fa zoomare la pagina al
  // focus, e dopo lo zoom la pagina resta "storta"/spostabile finché non si torna a mano
  // al livello di zoom originale. Corretto portando tutti a 16px.
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg,#FAF7F3);overflow-y:auto;overflow-x:hidden;font-family:var(--font-body,Inter,sans-serif);color:var(--ink,#1C1C1E);';
  overlay.innerHTML =
    // Piccola barra superiore in stile "hero" — stessa identità visiva della pagina che si
    // sbloccherà dopo, invece di un modulo grigio scollegato dal resto.
    '<div style="background:linear-gradient(155deg, var(--coral,#FF5A5F) 0%, #C93E86 130%);padding:18px 20px;">' +
      '<div style="max-width:560px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="color:#fff;font-family:var(--font-display,inherit);font-weight:800;font-size:13px;letter-spacing:.08em;text-transform:uppercase;">Salzillo Hospitality</span>' +
        '<div id="cg-lang" style="display:flex;gap:2px;background:rgba(255,255,255,.22);border-radius:100px;padding:3px;">' +
          '<button type="button" data-l="it" style="border:none;background:#fff;color:var(--coral,#FF5A5F);font-weight:700;font-size:11.5px;padding:6px 11px;border-radius:100px;cursor:pointer;">IT</button>' +
          '<button type="button" data-l="en" style="border:none;background:transparent;color:#fff;opacity:.8;font-weight:700;font-size:11.5px;padding:6px 11px;border-radius:100px;cursor:pointer;">EN</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div style="max-width:560px;margin:0 auto;padding:24px 20px 60px;">' +
      '<h1 id="cg-titolo" style="font-family:var(--font-display,inherit);font-weight:800;font-size:26px;margin:0 0 8px;"></h1>' +
      '<p id="cg-sub" style="font-size:14.5px;line-height:1.55;color:var(--ink-muted,#6E6E73);margin:0 0 22px;"></p>' +
      '<label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;" id="cg-label-data"></label>' +
      '<input type="date" id="cg-data-arrivo" style="display:block;width:100%;padding:12px 14px;font-size:16px;background:var(--surface,#fff);border:1.5px solid var(--line,#EFEAE3);border-radius:10px;margin-bottom:20px;">' +
      '<div id="cg-gruppo" style="display:none;margin-bottom:16px;">' +
        '<label style="display:block;font-size:12.5px;font-weight:500;margin-bottom:5px;" id="cg-label-gruppo"></label>' +
        '<select id="cg-tipo-gruppo" style="display:block;width:100%;padding:11px 12px;font-size:16px;background:var(--surface,#fff);border:1.5px solid var(--line,#EFEAE3);border-radius:10px;">' +
          '<option value="famiglia" id="cg-opt-famiglia"></option>' +
          '<option value="amici" id="cg-opt-amici"></option>' +
        '</select>' +
      '</div>' +
      '<div id="cg-ospiti"></div>' +
      '<button type="button" id="cg-aggiungi" style="display:block;width:100%;background:none;border:1.5px dashed var(--ink-faint,#AEABA4);color:var(--ink-muted,#6E6E73);border-radius:14px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:20px;"></button>' +
      '<div id="cg-errore" style="display:none;background:#FBE0E1;border:1px solid #F5C2C4;border-radius:10px;padding:10px 14px;font-size:13.5px;color:#E5484D;margin-bottom:16px;"></div>' +
      '<button type="button" id="cg-invia" style="display:block;width:100%;height:52px;background:var(--coral,#FF5A5F);color:#fff;border:none;border-radius:14px;font-family:var(--font-display,inherit);font-size:16px;font-weight:700;cursor:pointer;"></button>' +
      '<p style="text-align:center;margin-top:16px;"><a id="cg-contatta" href="' + WHATSAPP_HOSPITALITY + '" target="_blank" rel="noopener" style="color:var(--ink-faint,#AEABA4);font-size:13px;text-decoration:underline;"></a></p>' +
    '</div>';
  document.documentElement.appendChild(overlay);
  document.body.style.overflow = 'hidden'; // niente scroll della pagina sotto finché il gate è aperto

  var ospitiBox = overlay.querySelector('#cg-ospiti');
  var cardsAttive = []; // prefissi ("cg-o3-") delle card ancora presenti, nell'ordine in cui vanno inviate
  var contatoreId = 0;  // sempre crescente, mai riusato — anche dopo una rimozione

  // Ogni campo torna avvolto in un <div> — necessario perché più campi vengono messi fianco a
  // fianco in una grid a 2 colonne: senza il wrapper, la grid metteva la label di un campo e
  // l'input del campo SUCCESSIVO sulla stessa riga (bug di layout trovato da Raffaele il
  // 09/09/2026 testando su mobile — "si muove nello spazio").
  function campoTesto(id, label) {
    return '<div><label style="display:block;font-size:12.5px;font-weight:500;margin-bottom:5px;" data-tt="' + label + '">' + label + '</label>' +
      '<input id="' + id + '" type="text" style="display:block;width:100%;padding:11px 12px;font-size:16px;background:var(--surface,#fff);border:1.5px solid var(--line,#EFEAE3);border-radius:10px;margin-bottom:14px;"></div>';
  }
  function campoData(id, label) {
    return '<div><label style="display:block;font-size:12.5px;font-weight:500;margin-bottom:5px;" data-tt="' + label + '">' + label + '</label>' +
      '<input id="' + id + '" type="date" style="display:block;width:100%;padding:11px 12px;font-size:16px;background:var(--surface,#fff);border:1.5px solid var(--line,#EFEAE3);border-radius:10px;margin-bottom:14px;"></div>';
  }
  // Select nativa (non più campo-di-testo-con-suggerimenti): stesso approccio usato da Speedy
  // Host per Nazionalità/Paese di nascita — su mobile un vero <select> è molto più stabile di
  // un datalist, che su alcuni browser (soprattutto iOS Safari) apre un suggerimento che sposta
  // il layout in modo imprevedibile — probabile causa reale del "si muove nello schermo"
  // segnalato da Raffaele il 09/09/2026 anche dopo il primo giro di correzioni.
  function campoStato(id, label) {
    if (!TABELLE) return '<div></div>';
    var t = T[lang];
    var opts = '<option value="">' + t.seleziona + '</option>' + TABELLE.stati.map(function (s) {
      var leggibile = s.nome.charAt(0) + s.nome.slice(1).toLowerCase();
      return '<option value="' + s.nome + '">' + leggibile + '</option>';
    }).join('');
    return '<div><label style="display:block;font-size:12.5px;font-weight:500;margin-bottom:5px;" data-tt="' + label + '">' + label + '</label>' +
      '<select id="' + id + '" data-campo-stato style="display:block;width:100%;padding:11px 12px;font-size:16px;background:var(--surface,#fff);border:1.5px solid var(--line,#EFEAE3);border-radius:10px;margin-bottom:14px;">' + opts + '</select></div>';
  }
  function campoSesso(id, label) {
    var t = T[lang];
    return '<div><label style="display:block;font-size:12.5px;font-weight:500;margin-bottom:5px;" data-tt="' + label + '">' + label + '</label>' +
      '<select id="' + id + '" style="display:block;width:100%;padding:11px 12px;font-size:16px;background:var(--surface,#fff);border:1.5px solid var(--line,#EFEAE3);border-radius:10px;margin-bottom:14px;">' +
      '<option value="">' + t.seleziona + '</option><option value="M">' + t.maschio + '</option><option value="F">' + t.femmina + '</option></select></div>';
  }
  function campoDocumento(id, label) {
    if (!TABELLE) return '<div></div>';
    var opts = TABELLE.tipiDocumento.map(function (d) { return '<option value="' + d.nome + '">' + d.nome + '</option>'; }).join('');
    return '<div><label style="display:block;font-size:12.5px;font-weight:500;margin-bottom:5px;" data-tt="' + label + '">' + label + '</label>' +
      '<select id="' + id + '" style="display:block;width:100%;padding:11px 12px;font-size:16px;background:var(--surface,#fff);border:1.5px solid var(--line,#EFEAE3);border-radius:10px;margin-bottom:14px;">' + opts + '</select></div>';
  }

  function aggiungiOspite() {
    var p = 'cg-o' + (contatoreId++) + '-';
    cardsAttive.push(p);
    var card = document.createElement('div');
    card.className = 'cg-ospite-card';
    card.id = p + 'card';
    card.style.cssText = 'background:var(--surface,#fff);border:1.5px solid var(--line,#EFEAE3);border-radius:16px;padding:16px;margin-bottom:14px;';
    card.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
        '<p style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--coral,#FF5A5F);margin:0;" data-tt-prefix="Ospite"></p>' +
        '<button type="button" class="cg-rimuovi" style="display:none;border:none;background:none;color:var(--ink-faint,#AEABA4);font-size:12.5px;font-weight:600;cursor:pointer;padding:2px 4px;" data-tt="✕ Rimuovi"></button>' +
      '</div>' +
      '<label style="display:inline-block;background:var(--surface-soft,#F5F0EA);color:var(--ink,#1C1C1E);border-radius:10px;padding:9px 12px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:14px;">' +
        '<span data-tt="📷 Documento (foto o file)"></span>' +
        '<input type="file" accept="image/*" id="' + p + 'foto" style="display:none;">' +
      '</label>' +
      '<p id="' + p + 'foto-stato" style="font-size:12.5px;color:var(--ink-muted,#6E6E73);margin:-8px 0 12px;display:none;"></p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px;">' +
        campoTesto(p + 'cognome', 'Cognome') + campoTesto(p + 'nome', 'Nome') +
        campoSesso(p + 'sesso', 'Sesso') + campoData(p + 'dataNascita', 'Data di nascita') +
      '</div>' +
      campoTesto(p + 'luogoNascita', 'Comune/città di nascita') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px;">' +
        campoStato(p + 'statoNascita', 'Stato di nascita') + campoStato(p + 'cittadinanza', 'Cittadinanza') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px;">' +
        campoDocumento(p + 'tipoDocumento', 'Tipo documento') + campoTesto(p + 'numeroDocumento', 'Numero documento') +
      '</div>' +
      campoTesto(p + 'luogoRilascio', 'Luogo di rilascio del documento');
    ospitiBox.appendChild(card);

    var fotoInput = card.querySelector('#' + p + 'foto');
    var fotoStato = card.querySelector('#' + p + 'foto-stato');
    fotoInput.addEventListener('change', function () {
      var file = fotoInput.files[0];
      if (!file) return;
      var t = T[lang];
      fotoStato.style.display = 'block';
      fotoStato.textContent = t.leggendo;
      var reader = new FileReader();
      reader.onload = function () {
        var base64 = reader.result.split(',')[1];
        fetch('/api/checkin-ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mediaType: file.type || 'image/jpeg' }),
        })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (!res.ok) { fotoStato.textContent = t.lettoErrore; return; }
            var d = res.dati;
            var setIfEmpty = function (campo, val) {
              var el = document.getElementById(p + campo);
              if (el && val && !el.value) el.value = val;
            };
            setIfEmpty('cognome', d.cognome);
            setIfEmpty('nome', d.nome);
            if (d.sesso) document.getElementById(p + 'sesso').value = d.sesso;
            if (d.dataNascita) {
              var parts = d.dataNascita.split('/');
              if (parts.length === 3) document.getElementById(p + 'dataNascita').value = parts[2] + '-' + parts[1] + '-' + parts[0];
            }
            setIfEmpty('luogoNascita', d.luogoNascita);
            // Le select Stato/Cittadinanza hanno come value il nome in MAIUSCOLO (vedi
            // campoStato) — se il valore letto dalla foto non combacia con nessuna opzione
            // della select, semplicemente non viene preselezionato nulla (l'ospite sceglie a
            // mano), non genera un errore.
            if (d.statoNascita) document.getElementById(p + 'statoNascita').value = d.statoNascita.toUpperCase();
            if (d.cittadinanza) document.getElementById(p + 'cittadinanza').value = d.cittadinanza.toUpperCase();
            if (d.tipoDocumento) document.getElementById(p + 'tipoDocumento').value = d.tipoDocumento;
            setIfEmpty('numeroDocumento', d.numeroDocumento);
            setIfEmpty('luogoRilascio', d.luogoRilascioDocumento);
            fotoStato.textContent = t.lettoOk;
          })
          .catch(function () { fotoStato.textContent = t.lettoErrore; });
      };
      reader.readAsDataURL(file);
    });

    card.querySelector('.cg-rimuovi').addEventListener('click', function () {
      var idx = cardsAttive.indexOf(p);
      if (idx !== -1) cardsAttive.splice(idx, 1);
      card.remove();
      rinumeraOspiti();
    });

    // Fondamentale: senza questa chiamata, i testi di una card aggiunta DOPO il primo
    // caricamento (label, bottone foto, ecc.) restano vuoti — venivano tradotti solo una
    // volta all'avvio. Bug reale trovato da Raffaele il 09/09/2026 ("per il secondo ospite
    // continua a non funzionare il caricamento dei documenti" — il bottone c'era, ma senza
    // testo visibile sembrava non funzionare).
    applyLang();
  }

  // Rietichetta "Ospite 1/2/3" nell'ordine attuale delle card rimaste, mostra/nasconde il
  // pulsante "Rimuovi" (mai sulla card 1 se è l'unica) e il toggle famiglia/amici.
  function rinumeraOspiti() {
    var t = T[lang];
    cardsAttive.forEach(function (p, i) {
      var card = document.getElementById(p + 'card');
      if (!card) return;
      card.querySelector('[data-tt-prefix]').textContent = t.ospite + ' ' + (i + 1);
      card.querySelector('.cg-rimuovi').style.display = cardsAttive.length > 1 ? 'inline-block' : 'none';
    });
    overlay.querySelector('#cg-gruppo').style.display = cardsAttive.length > 1 ? 'block' : 'none';
  }

  overlay.querySelector('#cg-aggiungi').addEventListener('click', aggiungiOspite);

  function trovaCodiceStato(nomeLeggibile) {
    if (!TABELLE || !nomeLeggibile) return '';
    var norm = nomeLeggibile.trim().toUpperCase();
    var trovato = TABELLE.stati.find(function (s) { return s.nome === norm; });
    return trovato ? trovato.codice : '';
  }
  function trovaCodiceDocumento(nomeLeggibile) {
    if (!TABELLE || !nomeLeggibile) return '';
    var trovato = TABELLE.tipiDocumento.find(function (d) { return d.nome === nomeLeggibile; });
    return trovato ? trovato.codice : '';
  }

  function applyLang() {
    var t = T[lang];
    overlay.querySelector('#cg-titolo').textContent = t.titolo;
    overlay.querySelector('#cg-sub').textContent = t.sub;
    overlay.querySelector('#cg-label-data').textContent = t.dataArrivo;
    overlay.querySelector('#cg-label-gruppo').textContent = t.tipoGruppo;
    overlay.querySelector('#cg-opt-famiglia').textContent = t.gruppoFamiglia;
    overlay.querySelector('#cg-opt-amici').textContent = t.gruppoAmici;
    overlay.querySelector('#cg-aggiungi').textContent = t.aggiungi;
    overlay.querySelector('#cg-invia').textContent = t.invia;
    overlay.querySelector('#cg-contatta').textContent = t.contatta;
    var map = {
      Cognome: t.cognome, Nome: t.nome, Sesso: t.sesso, 'Data di nascita': t.dataNascita,
      'Comune/città di nascita': t.luogoNascita, 'Stato di nascita': t.statoNascita, Cittadinanza: t.cittadinanza,
      'Tipo documento': t.tipoDocumento, 'Numero documento': t.numeroDocumento, 'Luogo di rilascio del documento': t.luogoRilascio,
      '📷 Documento (foto o file)': t.caricaFoto, '✕ Rimuovi': t.rimuovi,
    };
    overlay.querySelectorAll('[data-tt]').forEach(function (el) {
      var orig = el.getAttribute('data-tt');
      if (map[orig] != null) el.textContent = map[orig];
    });
    overlay.querySelectorAll('#cg-lang button').forEach(function (btn) {
      var active = btn.getAttribute('data-l') === lang;
      btn.style.background = active ? '#fff' : 'transparent';
      btn.style.color = active ? 'var(--coral,#FF5A5F)' : '#fff';
      btn.style.opacity = active ? '1' : '.8';
    });
    // rigenera i <select> Sesso (le opzioni sono tradotte) senza perdere il valore scelto
    overlay.querySelectorAll('select[id$="-sesso"]').forEach(function (sel) {
      var val = sel.value;
      sel.innerHTML = '<option value="">' + t.seleziona + '</option><option value="M">' + t.maschio + '</option><option value="F">' + t.femmina + '</option>';
      sel.value = val;
    });
    // stessa cosa per le select Stato di nascita/Cittadinanza — solo la voce "Seleziona…"
    // cambia lingua, i 232 nomi di stato restano identici in entrambe le lingue.
    overlay.querySelectorAll('select[data-campo-stato]').forEach(function (sel) {
      var opt0 = sel.querySelector('option[value=""]');
      if (opt0) opt0.textContent = t.seleziona;
    });
    rinumeraOspiti();
  }
  overlay.querySelectorAll('#cg-lang button').forEach(function (btn) {
    btn.addEventListener('click', function () { lang = btn.getAttribute('data-l'); applyLang(); });
  });

  function mostraErrore(msg) {
    var box = overlay.querySelector('#cg-errore');
    box.textContent = msg;
    box.style.display = 'block';
  }

  overlay.querySelector('#cg-invia').addEventListener('click', function () {
    var t = T[lang];
    var btn = overlay.querySelector('#cg-invia');
    var erroreBox = overlay.querySelector('#cg-errore');
    erroreBox.style.display = 'none';

    var dataArrivoIso = overlay.querySelector('#cg-data-arrivo').value;
    var dataArrivo = isoToIt(dataArrivoIso);
    if (!dataArrivo) { mostraErrore(t.erroreCampi); return; }

    var tipoGruppo = cardsAttive.length > 1 ? overlay.querySelector('#cg-tipo-gruppo').value : null;

    var ospiti = [];
    for (var i = 0; i < cardsAttive.length; i++) {
      var p = cardsAttive[i];
      var cognome = document.getElementById(p + 'cognome').value.trim();
      var nome = document.getElementById(p + 'nome').value.trim();
      var sesso = document.getElementById(p + 'sesso').value;
      var dataNascita = isoToIt(document.getElementById(p + 'dataNascita').value);
      var luogoNascita = document.getElementById(p + 'luogoNascita').value.trim();
      var statoNascitaTesto = document.getElementById(p + 'statoNascita').value.trim();
      var cittadinanzaTesto = document.getElementById(p + 'cittadinanza').value.trim();
      var tipoDocumentoTesto = document.getElementById(p + 'tipoDocumento').value;
      var numeroDocumento = document.getElementById(p + 'numeroDocumento').value.trim();
      var luogoRilascio = document.getElementById(p + 'luogoRilascio').value.trim();

      var statoNascitaCodice = trovaCodiceStato(statoNascitaTesto);
      var cittadinanzaCodice = trovaCodiceStato(cittadinanzaTesto);
      var tipoDocumentoCodice = trovaCodiceDocumento(tipoDocumentoTesto);

      if (!cognome || !nome || !sesso || !dataNascita || !luogoNascita || !statoNascitaCodice || !cittadinanzaCodice || !numeroDocumento) {
        mostraErrore(t.erroreCampi);
        return;
      }

      var tipoAlloggiatoCodice;
      var rapporto;
      if (cardsAttive.length === 1) {
        tipoAlloggiatoCodice = TIPO_ALLOGGIATO.OSPITE_SINGOLO;
        rapporto = 'Capofamiglia';
      } else if (i === 0) {
        tipoAlloggiatoCodice = tipoGruppo === 'amici' ? TIPO_ALLOGGIATO.CAPO_GRUPPO : TIPO_ALLOGGIATO.CAPO_FAMIGLIA;
        rapporto = 'Capofamiglia';
      } else {
        tipoAlloggiatoCodice = tipoGruppo === 'amici' ? TIPO_ALLOGGIATO.MEMBRO_GRUPPO : TIPO_ALLOGGIATO.FAMILIARE;
        rapporto = 'Familiare/Ospite';
      }

      ospiti.push({
        dataArrivo: dataArrivo, notti: '', stanza: STANZA,
        cognome: cognome, nome: nome, dataNascita: dataNascita, luogoNascita: luogoNascita,
        cittadinanza: cittadinanzaTesto, tipoDocumento: tipoDocumentoTesto, numeroDocumento: numeroDocumento,
        rapporto: rapporto,
        sesso: sesso, tipoAlloggiatoCodice: tipoAlloggiatoCodice,
        comuneNascitaCodice: '', provinciaNascita: '',
        statoNascitaCodice: statoNascitaCodice, cittadinanzaCodice: cittadinanzaCodice,
        tipoDocumentoCodice: tipoDocumentoCodice, luogoRilascioDocumento: luogoRilascio,
      });
    }

    btn.disabled = true;
    btn.textContent = t.invio;

    // Invio in sequenza (non in parallelo): se la prenotazione non viene trovata, meglio
    // fermarsi al primo errore piuttosto che spammare N tentativi falliti.
    var invia = function (idx) {
      if (idx >= ospiti.length) {
        localStorage.setItem(STORAGE_KEY, '1');
        btn.textContent = t.fatto;
        document.body.style.overflow = '';
        overlay.remove();
        return;
      }
      fetch('/api/schedine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ospiti[idx]),
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.d && res.d.error ? res.d.error : t.erroreGenerico);
          invia(idx + 1);
        })
        .catch(function (e) {
          mostraErrore(e.message || t.erroreGenerico);
          btn.disabled = false;
          btn.textContent = t.invia;
        });
    };
    invia(0);
  });

  // Carica le tabelle codici, poi mostra il primo ospite e traduce tutto.
  fetch('/checkin/tabelle.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      TABELLE = data;
      aggiungiOspite();
      applyLang();
    })
    .catch(function () {
      // Anche senza tabelle il form resta usabile (i campi stato/cittadinanza/documento
      // restano semplici campi di testo, senza suggerimenti) — meglio raccogliere dati
      // imperfetti che bloccare del tutto il check-in per un JSON non raggiungibile.
      TABELLE = { stati: [], tipiDocumento: [{ nome: "Carta d'identità", codice: 'IDENT' }, { nome: 'Passaporto', codice: 'PASOR' }, { nome: 'Patente', codice: 'PATEN' }] };
      aggiungiOspite();
      applyLang();
    });
})();
