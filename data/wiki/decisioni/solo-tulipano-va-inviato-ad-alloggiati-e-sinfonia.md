---
titolo: Solo Tulipano (canali Airbnb/Booking/Diretto) va davvero inviato ad Alloggiati Web e Sinfonia
tipo: decisione
tag: [decisioni, salzillo-hospitality, alloggiati-web, sinfonia, compliance]
fonti:
  - "conversazione diretta in Claude Code, sessione 09/09/2026"
creato: 2026-09-09
aggiornato: 2026-09-09
---

# Solo Tulipano (canali Airbnb/Booking/Diretto) va davvero inviato ad Alloggiati Web e Sinfonia

**Decisione**: i documenti degli ospiti si raccolgono **da tutti**, per tutte e 5 le strutture (vedi [[salzillo-hospitality]], flusso di check-in con raccolta documenti) — ma solo un sottoinsieme va davvero trasmesso ai portali ufficiali:

- **Va inviato ad Alloggiati Web** solo se: struttura = **Tulipano** E canale della prenotazione ∈ {**Airbnb, Booking, Diretto**}.
- **Non va inviato** in tutti gli altri casi: prenotazioni Tulipano con canale **No Tax**, e **qualunque prenotazione delle altre strutture** (Rosa, Piano Terra, Primo Piano, Secondo Piano) — indipendentemente dal canale.
- **Sinfonia Turismo Smart eredita lo stesso filtro**: solo le schedine che risultano "da inviare davvero" ad Alloggiati Web entrano anche nel conteggio/file per Sinfonia. Nessuna logica di filtro separata da mantenere in sincrono a mano.

**Perché**: scelta operativa di Raffaele, "per ora" (non escluso che cambi in futuro se le altre strutture completano una registrazione formale equivalente a quella di Tulipano). Non spiegato nel dettaglio il motivo esatto nella fonte, ma coerente con quanto già noto: solo Tulipano ha SCIA/CIN pienamente documentati (vedi [[bb-il-tulipano]]); "No Tax" è presumibilmente un canale informale/diretto in contanti non tracciato sulle piattaforme ufficiali.

**Come si applica**:
- Il generatore del file mensile per Sinfonia (non ancora costruito, vedi [[salzillo-hospitality]]) deve filtrare le prenotazioni esattamente con questa regola prima di aggregarle — non tutte le prenotazioni del periodo.
- Se/quando si costruirà un indicatore visivo in `SchedineManager.tsx` o nel pannello Ospiti per distinguere "questa schedina va inviata davvero" da "solo raccolta per archivio", va derivato da questa stessa regola (stanza + canale della prenotazione collegata), mai da un campo duplicato da tenere aggiornato a mano.
- `Send()` per Alloggiati Web resta comunque deliberatamente non implementato (vedi [[salzillo-hospitality]]) — questa decisione riguarda *quali* schedine sarebbero da inviare quando/se si attiverà l'invio vero, non un cambiamento allo stato attuale (tutto manuale).
