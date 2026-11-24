export const CSS = `
:root{ --bg:#FAF7F3; --surface:#fff; --ink:#1C1C1E; --ink-muted:#6E6E73; --line:#EFEAE3;
  --coral:#FF5A5F; --coral-soft:#FFE7E4; }
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --bg:#161513; --surface:#211F1C; --ink:#F2EEE8; --ink-muted:#A8A29A; --line:#332F2A; --coral:#FF7A73; --coral-soft:#3A2420; } }
:root[data-theme="dark"]{ --bg:#161513; --surface:#211F1C; --ink:#F2EEE8; --ink-muted:#A8A29A; --line:#332F2A; --coral:#FF7A73; --coral-soft:#3A2420; }
*{box-sizing:border-box}
/* <body> del layout ha le classi Tailwind "flex flex-col": .wrap, suo figlio diretto, è quindi
   un flex item e senza min-width:0 non si restringe mai sotto il min-content del contenuto —
   da qui il "blowout" su schermi stretti (vedi anche .card/.grid sotto). */
.wrap{min-height:100vh;width:100%;min-width:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:20px;max-width:1200px;margin:0 auto;}
.gate{display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;min-height:100vh;
  background:radial-gradient(60% 50% at 12% 15%,var(--coral-soft) 0%,transparent 60%),
    radial-gradient(50% 45% at 92% 10%,var(--coral-soft) 0%,transparent 55%),var(--bg);}
.gate::before,.gate::after{content:'';position:absolute;border-radius:50%;filter:blur(60px);pointer-events:none;}
.gate::before{width:320px;height:320px;background:var(--coral);opacity:.3;top:-100px;left:-100px;animation:gateblob1 12s ease-in-out infinite;}
.gate::after{width:260px;height:260px;background:var(--coral);opacity:.22;bottom:-90px;right:-70px;animation:gateblob2 14s ease-in-out infinite;}
@keyframes gateblob1{0%,100%{transform:translate(0,0)}50%{transform:translate(26px,32px)}}
@keyframes gateblob2{0%,100%{transform:translate(0,0)}50%{transform:translate(-22px,-28px)}}
@keyframes gaterise{from{opacity:0;transform:translateY(16px) scale(.98);}to{opacity:1;transform:translateY(0) scale(1);}}
@keyframes gatefloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}
@media (prefers-reduced-motion:reduce){.gate::before,.gate::after,.gatecard,.gatemark{animation:none!important;}}
.gatecard{max-width:360px;width:100%;text-align:center;position:relative;z-index:1;padding:36px 28px 30px;
  border-radius:22px;box-shadow:0 26px 60px -22px rgba(0,0,0,.3),0 2px 10px rgba(0,0,0,.05);
  animation:gaterise .5s cubic-bezier(.2,.8,.2,1);}
.gatetema{position:absolute;top:16px;right:16px;}
.gatemark{width:56px;height:56px;margin:0 auto 14px;border-radius:16px;
  background:linear-gradient(150deg,var(--coral),#FF8F86);display:flex;align-items:center;justify-content:center;
  font-family:var(--font-jakarta),sans-serif;font-weight:800;font-size:24px;color:#fff;
  box-shadow:0 12px 26px -10px rgba(255,90,95,.6);animation:gatefloat 5s ease-in-out infinite;}
.gatecard h1{font-family:var(--font-jakarta),-apple-system,sans-serif;font-size:26px;font-weight:800;margin:3px 0 6px;letter-spacing:-.01em;}
.gatecard .field{position:relative;margin:12px 0;}
.gatecard .field .fic{position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:15px;opacity:.55;pointer-events:none;}
.gatecard input{width:100%;padding:12px 14px 12px 40px;font-size:16px;border:1.5px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);transition:border-color .15s,box-shadow .15s;}
.gatecard input:focus{outline:none;border-color:var(--coral);box-shadow:0 0 0 4px var(--coral-soft);}
.gatecard button,.gatecard input{font-family:inherit}
.gatecard button[type="submit"]{width:100%;margin-top:6px;padding:13px 16px;border:none;border-radius:12px;
  background:linear-gradient(135deg,var(--coral),#FF7A73);color:#fff;font-size:15px;font-weight:800;letter-spacing:.01em;
  box-shadow:0 12px 24px -10px rgba(255,90,95,.6);transition:transform .15s,box-shadow .15s;}
.gatecard button[type="submit"]:hover{transform:translateY(-1px);box-shadow:0 16px 28px -10px rgba(255,90,95,.7);}
.gatecard button[type="submit"]:active{transform:translateY(0);}
button{cursor:pointer;font-family:inherit}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin-bottom:16px;min-width:0;}
/* .grid è display:grid e .card un suo figlio: senza min-width:0 un figlio grid/flex non si
   restringe mai sotto il min-content del contenuto interno (es. una tabella larga) — anche se
   quella tabella ha già il suo .tablescroll con overflow-x:auto — e "gonfia" tutta la pagina. */
.grid{min-width:0;}
.card h2{font-family:var(--font-jakarta),-apple-system,sans-serif;font-size:17px;font-weight:800;margin:0 0 14px;letter-spacing:-.01em;display:flex;align-items:center;gap:9px;color:var(--ink);}
.card h2 small,h3 small{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12px;font-weight:500;text-transform:none;letter-spacing:0;color:var(--ink-muted);margin-left:2px;}
.ic{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9px;font-size:14px;font-style:normal;flex:none;}
.ic-arrivi{background:var(--coral-soft);}
.ic-partenze{background:#1D6DF022;}
.ic-mese{background:#1FAA6E22;}
.ic-occ{background:#8C7BD822;}
.ic-manca{background:#FFB23822;}
.topbar{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:8px;margin-bottom:16px;}
.eyebrow{font-size:11px;font-weight:800;color:var(--coral);text-transform:uppercase;letter-spacing:.1em;}
.topbar h1{font-size:24px;margin:2px 0 0;}
.bottomnav{display:none;}
.beta{font-size:11px;font-weight:700;background:var(--coral-soft);color:var(--coral);padding:3px 8px;border-radius:100px;vertical-align:middle;}
.hint{font-size:12px;color:var(--ink-muted);}
.topright{display:flex;flex-direction:column;align-items:flex-end;gap:6px;}
.sync{font-size:12px;font-weight:700;padding:6px 12px;border-radius:100px;border:1px solid var(--coral);background:var(--coral-soft);color:var(--coral);}
.sync:disabled{opacity:.6;}
.tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;}
.tabs button{padding:8px 14px;border:1px solid var(--line);background:var(--surface);color:var(--ink-muted);border-radius:100px;font-size:13px;font-weight:600;}
.tabs button.on{background:var(--coral);color:#fff;border-color:var(--coral);}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;}
.row{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line);font-size:14px;cursor:pointer;flex-wrap:wrap;}
.row:first-of-type{border-top:none;}
.row small{color:var(--ink-muted);}
.chip{font-size:11px;font-weight:700;padding:2px 8px;border-radius:100px;}
.chip-oggi{font-size:11px;font-weight:800;padding:2px 10px;border-radius:100px;background:var(--coral);color:#fff;letter-spacing:.03em;}
.empty,.sub{color:var(--ink-muted);font-size:13px;}
.big{font-size:28px;font-weight:800;margin:4px 0 12px;}
.big small{font-size:13px;font-weight:400;color:var(--ink-muted);}
.tbl{width:100%;border-collapse:collapse;font-size:13px;}
.tbl td,.tbl th{padding:7px 6px;border-top:1px solid var(--line);text-align:left;}
.tbl thead th{border-top:none;color:var(--ink-muted);font-weight:700;font-size:11px;text-transform:uppercase;}
.tbl .num{text-align:right;font-variant-numeric:tabular-nums;}
.tbl .strong{font-weight:800;}
.tbl tr.tot td{border-top:2px solid var(--ink);font-weight:800;}
.tbl.full tbody tr{cursor:pointer;}
.tbl.full tbody tr:hover{background:var(--coral-soft);}
.tbl td small{color:var(--ink-muted);}
.tablescroll{overflow-x:auto;}
.imm{margin-top:12px;}
.imm h3{font-size:13px;margin:0 0 6px;}
/* calendario */
.calhead{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
.calhead h2{margin:0;text-transform:capitalize;}
.calhead button{width:32px;height:32px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:16px;}
.calhead button.oggi{width:auto;padding:0 12px;font-size:12px;font-weight:700;}
.calhead{flex-wrap:wrap;}
.calvista{margin-left:auto;display:flex;gap:4px;}
.calhead .calvista button{width:auto;padding:0 12px;font-size:12px;font-weight:700;}
.calhead .calvista button.on{background:var(--coral-soft);color:var(--coral);border-color:var(--coral);}
.cal-scorri{flex:1 1 0;min-width:0;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;}
.cal-day.mon,.cal-cell.mon{border-left:2px solid var(--ink-muted);}
.cal-avviso{background:#E5484D14;border:1px solid #E5484D66;color:var(--ink);border-radius:10px;padding:8px 12px;margin-bottom:10px;font-size:13px;}
.cal-hint{position:absolute;left:6px;top:-1px;z-index:6;background:var(--coral);color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:0 0 8px 8px;white-space:nowrap;}
.cal-hint button{background:#fff3;border:none;color:#fff;border-radius:6px;padding:1px 6px;margin-left:4px;font-size:11px;}
.cal-anteprima{position:fixed;z-index:50;width:260px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 12px;box-shadow:0 8px 28px #0004;font-size:12.5px;display:flex;flex-direction:column;gap:4px;}
@media (max-width:640px){.cal-fixed .cal-room{font-size:10.5px;padding:0 4px;}.calhead h2{font-size:15px;}}
.cal2col{display:flex;align-items:flex-start;min-width:0;}
.cal-fixed{flex:none;width:160px;}
.cal{display:grid;position:relative;font-size:12px;}
.cal-corner{height:38px;background:var(--surface);border-bottom:1px solid var(--line);border-right:1px solid var(--line);}
.cal-day{text-align:center;padding:4px 0;height:38px;box-sizing:border-box;border-bottom:1px solid var(--line);border-left:1px solid var(--line);display:flex;flex-direction:column;justify-content:center;line-height:1.1;}
.cal-day.we{background:var(--coral-soft);}
.cal-day.today{background:var(--coral);color:#fff;font-weight:800;border-radius:6px 6px 0 0;}
.cal-day small{font-size:10px;font-weight:700;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.02em;}
.cal-day.today small{color:#fff;}
.cal-room{background:var(--surface);font-weight:700;font-size:12px;padding:0 8px;display:flex;align-items:center;border-bottom:1px solid var(--line);border-right:1px solid var(--line);height:46px;}
.cal-track{position:relative;height:46px;border-bottom:1px solid var(--line);display:flex;}
.cal-cell{border-left:1px solid var(--line);height:100%;flex:none;position:relative;}
.cal-cell.selectable{cursor:pointer;}
.cal-cell.selectable:hover{background:var(--coral-soft);}
.cal-cell.selecting{background:var(--coral);opacity:.35;}
.cal-bar.blocco{background:repeating-linear-gradient(135deg,#7d7d7d,#7d7d7d 6px,#969696 6px,#969696 12px);cursor:pointer;}
.cal-bar:disabled{cursor:default;}
.cal-bar{position:absolute;top:7px;height:32px;border-radius:8px;border:none;color:#fff;font-size:11px;font-weight:700;padding:0 8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:flex;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,.2);}
.cal-bar span{overflow:hidden;text-overflow:ellipsis;}
.callegend{display:flex;gap:14px;margin-top:12px;font-size:12px;flex-wrap:wrap;}
.callegend span{display:flex;align-items:center;gap:5px;}
.callegend i{width:12px;height:12px;border-radius:3px;display:inline-block;}
/* modale */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:20px;z-index:50;}
.modal{max-width:420px;width:100%;position:relative;}
.modal .x{position:absolute;top:12px;right:14px;border:none;background:none;font-size:16px;color:var(--ink-muted);}
.modal h2{font-size:20px;text-transform:none;letter-spacing:0;margin:4px 0;}
.err{color:#E5484D;font-size:13px;}
.rendctl{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;}
.rendctl select{padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font-size:13px;font-family:inherit;}
.rendtot{display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding:14px 16px;background:var(--coral-soft);border-radius:12px;}
.rendtot span{font-weight:700;}
.rendtot b{font-size:22px;color:var(--coral);}
.cerca{width:100%;padding:10px 12px;margin:10px 0 4px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font-size:15px;font-family:inherit;}
.tbl tr.clic{cursor:pointer;}
.tbl tr.clic:hover td{background:var(--coral-soft);}
.vchip{padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;}
.v-Buono{background:#1FAA6E22;color:#1FAA6E;}
.v-Neutro{background:var(--line);color:var(--ink-muted);}
.v-Problematico{background:#E5484D22;color:#E5484D;}
.kpirow{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;}
.kpi{flex:1;min-width:130px;padding:12px 14px;background:var(--surface-2,rgba(0,0,0,.03));border-radius:12px;}
.kpi span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-muted);}
.kpi b{display:block;margin-top:4px;font-size:19px;}
.kpi.coral{background:var(--coral-soft);}
.kpi.coral b{color:var(--coral);}
.previsione{margin-top:16px;padding:12px 16px;background:var(--surface-2,rgba(0,0,0,.03));border-radius:12px;}
.previsione>span{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-muted);}
.previsione p{margin:4px 0 0;font-size:13px;}
.tree{font-size:13px;line-height:1.5;}
.tn{position:relative;}
.tn span{color:var(--ink-muted);font-weight:400;}
.tn1,.tn2,.tn3,.tn4{margin-left:16px;padding-left:14px;border-left:2px solid var(--line);margin-top:8px;}
.tn0{margin-top:4px;}
.tn4{margin-top:5px;font-size:12.5px;}
.guidalist{margin:0;padding-left:18px;font-size:13px;line-height:1.7;}
.guidalist li{margin-bottom:4px;}
.linklike{border:none;background:none;color:var(--coral);font-weight:600;cursor:pointer;padding:0;font-size:inherit;}
.cardhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;}
.cardhead h2{margin:0;}
.add{background:var(--coral);color:#fff;border:none;border-radius:100px;padding:8px 14px;font-size:13px;font-weight:700;}
.danger{background:none;border:1px solid #E5484D;color:#E5484D;border-radius:100px;padding:8px 12px;font-size:12px;font-weight:700;}
.form{display:flex;flex-direction:column;gap:10px;margin:12px 0;}
.form label{display:flex;flex-direction:column;font-size:12px;font-weight:600;color:var(--ink-muted);gap:4px;}
.form input,.form select,.form textarea{padding:9px 11px;font-size:16px;border:1.5px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font-family:inherit;}
.modalactions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;}
.modalactions button{padding:9px 16px;border-radius:100px;font-size:13px;font-weight:700;border:1px solid var(--line);background:var(--surface);color:var(--ink);}
.modal{max-height:90vh;overflow-y:auto;}
.tematoggle{font-size:12px;font-weight:700;padding:6px 12px;border-radius:100px;border:1px solid var(--line);background:var(--surface);color:var(--ink-muted);display:inline-flex;align-items:center;gap:5px;}
.subtabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
.subtabs button{padding:7px 13px;border:1px solid var(--line);background:var(--surface);color:var(--ink-muted);border-radius:9px;font-size:12.5px;font-weight:700;}
.subtabs button.on{background:var(--coral-soft);color:var(--coral);border-color:var(--coral);}
.azionirapide{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
.azionirapide .add{background:var(--surface);color:var(--ink);border:1px solid var(--line);}
.cal-day.hasev{background:var(--coral-soft);}
.cal-day.hasev.today{background:var(--coral);}
.cal-room.cal-prezzo{height:22px;font-size:11px;color:var(--ink-muted);}
.cal-prz{border-left:1px solid var(--line);height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--coral);}
.cal-przrow{position:absolute;top:1px;left:0;right:0;text-align:center;font-size:9px;font-weight:700;color:var(--ink-muted);opacity:.7;pointer-events:none;}
.cal-pulizia-wrap{position:absolute;top:2px;z-index:3;width:0;height:0;}
.cal-pulizia-badge{position:absolute;top:0;right:-8px;width:20px;height:20px;border-radius:50%;border:1.5px solid var(--surface);
  background:var(--coral);color:#fff;font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center;
  cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.35);padding:0;}
.cal-pulizia-badge.fatta{background:#1FAA6E;opacity:.75;}
.cal-pulizia-pop{position:absolute;top:24px;right:-8px;z-index:4;background:var(--surface);border:1px solid var(--line);
  border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:8px;display:flex;flex-direction:column;gap:6px;
  min-width:150px;font-size:12px;white-space:normal;}
.cal-pulizia-pop select{font-size:12px;padding:4px;}
.filtri{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0 4px;}
.filtri select,.filtri input{padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font-size:13px;font-family:inherit;}
.filtri .cerca{flex:1;min-width:160px;margin:0;}
.pill{font-size:11px;font-weight:700;padding:3px 9px;border-radius:100px;white-space:nowrap;}
.pill-Bozza{background:var(--line);color:var(--ink-muted);}
.pill-Inviato{background:#1D6DF022;color:#1D6DF0;}
.pill-Accettato{background:#1FAA6E22;color:#1FAA6E;}
.pill-Scaduto,.pill-Rifiutato{background:#E5484D22;color:#E5484D;}
.docgroup{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px;}
.docgroup>h3{margin:0 0 8px;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:8px;}
.docrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 0;border-top:1px solid var(--line);font-size:13px;}
.docrow:first-of-type{border-top:none;}
.docrow .azioni{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;}
.mini{font-size:12px;font-weight:700;padding:5px 10px;border-radius:100px;border:1px solid var(--line);background:var(--surface);color:var(--ink);text-decoration:none;}
.mini.coral{border-color:var(--coral);background:var(--coral-soft);color:var(--coral);}
@media (max-width:640px){
  .tabs{display:none;}
  .bottomnav{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:40;background:var(--surface);border-top:1px solid var(--line);padding:6px 4px calc(6px + env(safe-area-inset-bottom));}
  .bottomnav button{flex:1;border:none;background:none;color:var(--ink-muted);font-size:11px;font-weight:700;padding:6px 2px;}
  .bottomnav button.on{color:var(--coral);}
  .altromenu{position:fixed;left:8px;right:8px;bottom:64px;z-index:41;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px;display:flex;flex-wrap:wrap;gap:6px;}
  .altromenu button{padding:8px 12px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:100px;font-size:13px;font-weight:600;}
  .wrap{padding:12px 12px 84px;}
  .topbar h1{font-size:20px;}
  .tabs{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;scrollbar-width:none;}
  .tabs::-webkit-scrollbar{display:none;}
  .tabs button{flex:none;}
  .grid{grid-template-columns:1fr;}
  .card{padding:14px 15px;border-radius:14px;}
  .overlay{padding:0;align-items:flex-end;}
  .modal{max-width:100%;border-radius:16px 16px 0 0;max-height:94vh;}
  .topbar{align-items:stretch;}
  .topright{align-items:stretch;}
  .topright .hint{text-align:right;}
}

/* ── Stile "vetro liquido" (opzionale, anteprima): si accende dal pulsante 💧 in alto. Non cambia niente finché non lo scegli. ── */
html[data-stile="glass"]{
  --glass-fill:rgba(255,255,255,.52); --glass-fill-strong:rgba(255,255,255,.7); --glass-edge:rgba(255,255,255,.75); --glass-shadow:rgba(60,40,30,.18);
  --surface:var(--glass-fill); --line:rgba(120,100,90,.16); --coral-soft:rgba(255,90,95,.16); --surface-2:rgba(255,255,255,.4);
  background:radial-gradient(60% 50% at 10% 8%,#ffc3b4 0,transparent 60%),radial-gradient(55% 45% at 92% 18%,#b6d2ff 0,transparent 60%),radial-gradient(60% 55% at 55% 100%,#dcc3ff 0,transparent 62%),#f5f0ea;
  background-attachment:fixed;
}
html[data-stile="glass"][data-theme="dark"]{
  --glass-fill:rgba(255,255,255,.085); --glass-fill-strong:rgba(255,255,255,.16); --glass-edge:rgba(255,255,255,.3); --glass-shadow:rgba(0,0,0,.5);
  --line:rgba(255,255,255,.12); --surface-2:rgba(255,255,255,.08);
  background:radial-gradient(60% 50% at 10% 8%,#b3383e 0,transparent 60%),radial-gradient(55% 45% at 92% 18%,#2d5fc4 0,transparent 60%),radial-gradient(60% 55% at 55% 100%,#7a45c9 0,transparent 62%),#0f0d0c;
  background-attachment:fixed;
}
@media (prefers-color-scheme: dark){ html[data-stile="glass"]:not([data-theme="light"]){
  --glass-fill:rgba(255,255,255,.085); --glass-fill-strong:rgba(255,255,255,.16); --glass-edge:rgba(255,255,255,.3); --glass-shadow:rgba(0,0,0,.5);
  --line:rgba(255,255,255,.12); --surface-2:rgba(255,255,255,.08);
  background:radial-gradient(60% 50% at 10% 8%,#b3383e 0,transparent 60%),radial-gradient(55% 45% at 92% 18%,#2d5fc4 0,transparent 60%),radial-gradient(60% 55% at 55% 100%,#7a45c9 0,transparent 62%),#0f0d0c;
  background-attachment:fixed; } }
html[data-stile="glass"] body,html[data-stile="glass"] .wrap{background:transparent !important;}
html[data-stile="glass"] .card,
html[data-stile="glass"] .cal-anteprima,
html[data-stile="glass"] .altromenu,
html[data-stile="glass"] .kpi{
  background:var(--glass-fill);
  -webkit-backdrop-filter:blur(26px) saturate(170%);backdrop-filter:blur(26px) saturate(170%);
  border:1px solid var(--glass-edge);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 -1px 0 rgba(255,255,255,.08),0 14px 38px -16px var(--glass-shadow);
  border-radius:24px;
}
html[data-stile="glass"] .kpi{border-radius:18px;}
html[data-stile="glass"] .overlay{background:rgba(20,16,14,.28);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);}
html[data-stile="glass"] .modal{background:var(--glass-fill-strong);-webkit-backdrop-filter:blur(34px) saturate(180%);backdrop-filter:blur(34px) saturate(180%);border:1px solid var(--glass-edge);border-radius:28px;box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 30px 70px -20px var(--glass-shadow);}
html[data-stile="glass"] .tabs button,
html[data-stile="glass"] .subtabs button,
html[data-stile="glass"] .mini,
html[data-stile="glass"] .sync,
html[data-stile="glass"] .tematoggle,
html[data-stile="glass"] .stiletoggle{
  background:var(--glass-fill);-webkit-backdrop-filter:blur(16px) saturate(160%);backdrop-filter:blur(16px) saturate(160%);
  border:1px solid var(--glass-edge);box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 6px 16px -10px var(--glass-shadow);color:var(--ink);
}
html[data-stile="glass"] .tabs button.on,
html[data-stile="glass"] .subtabs button.on{
  background:linear-gradient(135deg,rgba(255,90,95,.85),rgba(255,140,120,.75));color:#fff;border-color:rgba(255,255,255,.6);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 10px 24px -10px rgba(255,90,95,.7);
}
html[data-stile="glass"] .add{
  background:linear-gradient(135deg,rgba(255,90,95,.92),rgba(255,138,118,.82));border:1px solid rgba(255,255,255,.55);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 10px 22px -10px rgba(255,90,95,.75);
}
html[data-stile="glass"] .mini.coral{background:rgba(255,90,95,.2);border-color:rgba(255,90,95,.5);color:var(--coral);}
html[data-stile="glass"] input,html[data-stile="glass"] select,html[data-stile="glass"] textarea{
  background:var(--glass-fill);border:1px solid var(--glass-edge);border-radius:14px;color:var(--ink);
  -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:inset 0 1px 2px rgba(0,0,0,.05);
}
html[data-stile="glass"] .tbl thead th{background:transparent;}
html[data-stile="glass"] .tbl.full tbody tr:hover{background:rgba(255,255,255,.35);}
html[data-stile="glass"] .chip{-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.35);}
html[data-stile="glass"] .cal-bar{box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 6px 14px -8px rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.35);}
html[data-stile="glass"] details.guidavoce{border-top-color:var(--line);}
@media (max-width:640px){
  html[data-stile="glass"] .bottomnav{
    left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));border-radius:26px;border:1px solid var(--glass-edge);
    background:var(--glass-fill-strong);-webkit-backdrop-filter:blur(30px) saturate(180%);backdrop-filter:blur(30px) saturate(180%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 18px 40px -14px var(--glass-shadow);padding:8px 6px;
  }
  html[data-stile="glass"] .altromenu{bottom:84px;}
}
.stiletoggle{font-size:12px;font-weight:700;padding:6px 12px;border-radius:100px;border:1px solid var(--line);background:var(--surface);color:var(--ink);}

/* ── Mobile (24/11/2026): da 360 px in su. Tabelle a schede, moduli grandi, pannelli dal basso, safe area. ── */
.wrap{padding-left:max(20px,env(safe-area-inset-left));padding-right:max(20px,env(safe-area-inset-right));padding-top:max(20px,env(safe-area-inset-top));}
.tbl td,.tbl th{overflow-wrap:anywhere;}
.tbl td.num,.tbl th.num,.tbl .strong{white-space:nowrap;overflow-wrap:normal;}
.btnfiltri{display:none;}
.velo{display:none;}
@media (max-width:640px){
  html{-webkit-text-size-adjust:100%;}
  .wrap{padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) calc(96px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));overflow-x:hidden;}
  .card{padding:14px;}
  .topbar h1{font-size:20px;}
  /* tabelle: a schede (fino a 9 colonne) oppure a scorrimento con la prima colonna fissa (di più) */
  .tablescroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .tablescroll:has(.tbl.stack){overflow-x:visible;}
  .tbl.stack.full,.tbl.stack{display:block;width:100%;}
  .tbl.stack thead{display:none;}
  .tbl.stack tbody{display:block;}
  .tbl.stack tr{display:block;border:1px solid var(--line);border-radius:14px;padding:6px 12px;margin-bottom:10px;background:var(--surface-2,rgba(0,0,0,.03));}
  .tbl.stack td{display:flex;justify-content:space-between;align-items:baseline;gap:14px;width:auto;border-top:1px dashed var(--line);padding:7px 0;text-align:right;font-size:14px;}
  .tbl.stack td:first-child{border-top:none;font-weight:700;}
  .tbl.stack td::before{content:attr(data-label);flex:none;max-width:46%;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--ink-muted);}
  .tbl.stack td[data-label=""]::before,.tbl.stack td:not([data-label])::before{content:none;}
  .tbl.stack td[colspan]{display:block;text-align:left;}
  .tbl.stack tr.tot{background:var(--coral-soft);}
  .tbl.stack tr.tot td{border-top:none;}
  .tbl.wide{min-width:640px;}
  .tbl.wide th:first-child,.tbl.wide td:first-child{position:sticky;left:0;z-index:1;background:var(--surface);}
  .tbl.wide td:first-child{box-shadow:2px 0 0 var(--line);}
  .tablescroll:has(.tbl.wide){overflow-x:auto;-webkit-overflow-scrolling:touch;}
  /* moduli: una colonna, campi alti almeno 48 px, 16 px per evitare lo zoom automatico di iOS */
  .form{gap:14px;}
  .form label{font-size:13px;}
  .form input,.form select,.form textarea,.filtri select,.filtri input{min-height:48px;font-size:16px;padding:12px 14px;border-radius:12px;width:100%;}
  .form textarea{min-height:120px;}
  .form input[type="checkbox"],.filtri input[type="checkbox"]{min-height:26px;width:26px;height:26px;}
  button,.mini,.add,.sync,.danger{min-height:44px;}
  .mini{padding:10px 14px;}
  .azioni{gap:8px;}
  /* finestre: pannello dal basso, azioni sempre visibili sopra la tastiera */
  .overlay{align-items:flex-end;padding:0;overscroll-behavior:contain;}
  .modal{max-width:none;width:100%;max-height:92dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;border-radius:22px 22px 0 0;padding-bottom:0;margin:0;}
  .modal .x{top:10px;right:12px;width:44px;height:44px;font-size:20px;}
  .modalactions{position:sticky;bottom:0;z-index:2;background:var(--surface);margin:12px -14px 0;padding:12px 14px calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--line);}
  .modalactions button{flex:1;min-height:48px;}
  /* filtri: la ricerca resta, gli altri si aprono col pulsante */
  .btnfiltri{display:inline-flex;align-items:center;gap:6px;}
  .filtri{flex-direction:column;align-items:stretch;}
  .filtri.chiuso>*:not(.cerca){display:none;}
  /* "Altro": pannello dal basso con velo */
  .velo{display:block;position:fixed;inset:0;z-index:39;background:rgba(0,0,0,.32);}
  .altromenu{left:8px;right:8px;bottom:calc(76px + env(safe-area-inset-bottom));max-height:62dvh;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;}
  .altromenu button{min-height:48px;text-align:left;border-radius:14px;}
  .bottomnav{padding:6px 4px calc(6px + env(safe-area-inset-bottom));}
  .bottomnav button{min-height:52px;font-size:12px;}
  /* testi e importi senza tagli */
  .kpi b{font-size:18px;overflow-wrap:anywhere;}
  .chip,.pill{white-space:normal;}
  .cardhead{flex-wrap:wrap;gap:8px;}
  .cardhead .add,.cardhead .mini{flex:none;}
  h2{overflow-wrap:anywhere;}
}
html[data-stile="glass"] .modal{border-radius:26px 26px 0 0;}
@media (min-width:641px){ html[data-stile="glass"] .modal{border-radius:28px;} }

/* ── Menu laterale di vetro (24/11/2026): su telefono al posto della barra in basso ── */
.hamb{display:none;}
.drawer{position:fixed;top:0;left:0;bottom:0;z-index:60;width:min(86vw,330px);display:flex;flex-direction:column;
  padding:max(16px,env(safe-area-inset-top)) 14px max(16px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));
  background:var(--surface);border-right:1px solid var(--line);box-shadow:24px 0 60px -24px rgba(0,0,0,.55);
  transform:translateX(-105%);visibility:hidden;transition:transform .3s cubic-bezier(.2,.8,.2,1),visibility .3s;}
.drawer.aperto{transform:none;visibility:visible;}
.velo{position:fixed;inset:0;z-index:59;display:block;background:rgba(0,0,0,.38);opacity:0;pointer-events:none;transition:opacity .25s;}
.velo.aperto{opacity:1;pointer-events:auto;}
.drawerhead{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:4px 6px 12px;}
.drawertitolo{font-family:var(--font-jakarta),sans-serif;font-size:22px;font-weight:800;letter-spacing:-.01em;margin-top:2px;}
.drawerx{width:44px;height:44px;border:1px solid var(--line);background:transparent;border-radius:14px;font-size:18px;color:var(--ink);}
.drawer nav{flex:1;overflow-y:auto;overscroll-behavior:contain;padding-right:2px;}
.drawergruppo{margin:6px 0 12px;}
.drawergruppo>span{display:block;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted);padding:6px 12px;}
.drawergruppo button{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;padding:0 12px;border:none;background:transparent;border-radius:16px;color:var(--ink);font-size:15px;font-weight:600;text-align:left;}
.drawergruppo button i{font-style:normal;font-size:19px;width:26px;text-align:center;}
.drawergruppo button.on{background:linear-gradient(135deg,rgba(255,90,95,.92),rgba(255,138,118,.82));color:#fff;box-shadow:0 10px 22px -12px rgba(255,90,95,.8);}
.drawerfoot{border-top:1px solid var(--line);padding-top:12px;display:flex;flex-direction:column;gap:10px;}
.drawerlink,.drawertoggle{display:flex;gap:8px;flex-wrap:wrap;}
html[data-stile="glass"] .drawer{background:var(--glass-fill-strong);-webkit-backdrop-filter:blur(36px) saturate(185%);backdrop-filter:blur(36px) saturate(185%);
  border-right:1px solid var(--glass-edge);border-radius:0 30px 30px 0;box-shadow:inset 0 1px 0 rgba(255,255,255,.55),24px 0 70px -24px var(--glass-shadow);}
html[data-stile="glass"] .velo{-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}
html[data-stile="glass"] .drawerx{background:var(--glass-fill);border-color:var(--glass-edge);}
@media (max-width:640px){
  .tabs,.bottomnav,.altromenu{display:none !important;}
  .hamb{display:inline-flex;flex:none;align-items:center;justify-content:center;width:46px;height:46px;border-radius:15px;border:1px solid var(--line);background:var(--surface);font-size:20px;color:var(--ink);}
  html[data-stile="glass"] .hamb{background:var(--glass-fill);border-color:var(--glass-edge);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:inset 0 1px 0 rgba(255,255,255,.5);}
  .topbar{position:sticky;top:0;z-index:30;flex-wrap:nowrap;justify-content:flex-start;align-items:center;gap:12px;
    margin:-12px -12px 12px;padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 10px max(12px,env(safe-area-inset-left));
    background:color-mix(in srgb,var(--bg) 78%,transparent);-webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);}
  html[data-stile="glass"] .topbar{background:transparent;}
  .topbar .topright{display:none;}
  .topbar .eyebrow{display:none;}
  .topbar h1{margin:0;font-size:20px;}
  .tbl.stack{min-width:0 !important;}
  a.mini,a.add,a.sync{display:inline-flex;align-items:center;justify-content:center;min-height:44px;}
  .cal-bar span{font-size:11px;}
  .wrap{padding-bottom:calc(28px + env(safe-area-inset-bottom));}
  .azionirapide{gap:8px;}
  .card select,.card input[type="date"],.card input[type="month"]{min-height:44px;font-size:16px;}
}

/* ── Rifiniture telefono (24/11/2026) ── */
@media (max-width:640px){
  .subtabs{flex-wrap:nowrap;overflow-x:auto;gap:6px;margin-bottom:8px;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
  .subtabs::-webkit-scrollbar{display:none;}
  .subtabs button{flex:none;min-height:40px;padding:6px 12px;}
  .calhead{display:flex;flex-wrap:wrap;align-items:center;gap:6px;}
  .calhead h2{order:-1;flex:1 1 100%;margin:0 0 2px;font-size:15px;text-align:center;justify-content:center;}
  .calhead>button{min-height:40px;min-width:40px;}
  .calvista{margin-left:auto;display:flex;gap:6px;}
  .calvista button{min-height:40px;}
  /* schede delle prenotazioni: prima l'ospite, poi date, alloggio, importo e stato; canale e utile restano nei dettagli */
  .tbl.stack.pren tr{display:flex;flex-direction:column;}
  .tbl.stack.pren td:nth-child(3){order:-1;font-size:16px;font-weight:800;border-top:none;padding-top:4px;justify-content:flex-start;text-align:left;flex-wrap:wrap;}
  .tbl.stack.pren td:nth-child(3)::before{content:none;}
  .tbl.stack.pren td:nth-child(1){border-top:1px dashed var(--line);font-weight:400;}
  .tbl.stack.pren td:nth-child(5),.tbl.stack.pren td:nth-child(7){display:none;}
  .nota-modulo{display:none;}
  .tbl.stack td:empty{display:none;}
  .wrap input:not([type="checkbox"]):not([type="radio"]),.wrap select,.wrap textarea{min-height:44px;font-size:16px;}
}

/* modali di vetro più opachi: il testo della pagina sotto non deve trasparire dietro ai campi */
html[data-stile="glass"]{--glass-modal:rgba(255,255,255,.9);}
html[data-stile="glass"][data-theme="dark"]{--glass-modal:rgba(30,26,25,.9);}
@media (prefers-color-scheme: dark){ html[data-stile="glass"]:not([data-theme="light"]){--glass-modal:rgba(30,26,25,.9);} }
html[data-stile="glass"] .modal{background:var(--glass-modal);}

/* Moduli su telefono: il messaggio d'errore sta sempre visibile sopra i pulsanti (prima finiva sotto la barra fissa e non si vedeva) */
@media (max-width:640px){
  .modal{display:flex;flex-direction:column;}
  .modal .err{order:97;position:sticky;bottom:calc(76px + env(safe-area-inset-bottom));z-index:3;margin:8px -14px 0;padding:12px 14px;border-radius:0;
    background:color-mix(in srgb,#E5484D 18%,var(--glass-modal,var(--surface)));border-top:1px solid rgba(229,72,77,.5);font-weight:700;}
  .modalactions{order:98;}
  .modal .nota-modulo{order:99;}
}

/* Anteprima della prenotazione nel calendario: su telefono è un pannello dal basso, leggibile e con un pulsante grande (prima era un riquadro piccolo che usciva dallo schermo) */
.cal-veil,.cal-chiudi{display:none;}
@media (max-width:640px){
  .cal-veil{display:block;position:fixed;inset:0;z-index:69;background:rgba(0,0,0,.35);}
  .cal-anteprima,html[data-stile="glass"] .cal-anteprima{left:0 !important;right:0;top:auto !important;bottom:0;width:auto;max-height:72dvh;overflow-y:auto;z-index:70;
    padding:26px 18px calc(20px + env(safe-area-inset-bottom));gap:12px;font-size:15px;line-height:1.35;border-radius:26px 26px 0 0;border-width:1px 0 0;
    background:var(--glass-modal,var(--surface));-webkit-backdrop-filter:blur(30px) saturate(170%);backdrop-filter:blur(30px) saturate(170%);box-shadow:0 -18px 50px -20px rgba(0,0,0,.55);}
  .cal-anteprima::before{content:'';position:absolute;top:9px;left:50%;width:44px;height:5px;margin-left:-22px;border-radius:3px;background:var(--line);}
  .cal-ap-nome{font-size:20px;font-weight:800;padding-right:48px;}
  .cal-chiudi{display:inline-flex;align-items:center;justify-content:center;position:absolute;top:12px;right:12px;width:44px;height:44px;border:none;border-radius:14px;background:var(--surface-2,rgba(0,0,0,.06));font-size:18px;color:var(--ink);}
  .cal-ap-apri{min-height:52px;width:100%;font-size:16px;margin-top:4px;}
}
`;
