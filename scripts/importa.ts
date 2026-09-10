/**
 * Lancia l'import da Google Sheets → database.
 *   npx dotenv -e .env.local -- npx tsx scripts/importa.ts
 * (dotenv perché tsx non carica .env.local da solo; DATABASE_URL serve al client Neon,
 *  google-credentials.json nel root serve alla lettura del foglio.)
 */
import { importaDaSheets } from '../src/lib/db/importDaSheets';

importaDaSheets()
  .then((r) => { console.log('✅ Import completato:\n', JSON.stringify(r, null, 2)); process.exit(0); })
  .catch((e) => { console.error('❌ ERRORE:', e); process.exit(1); });
