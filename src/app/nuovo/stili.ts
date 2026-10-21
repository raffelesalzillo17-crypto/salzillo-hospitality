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
  .wrap{padding:12px;}
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
`;
