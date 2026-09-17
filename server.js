/**
 * Reiner Static-Server. Der Prototyp hält alle Daten im Browser
 * (localStorage + JSON-Import/-Export), deshalb gibt es bewusst keine API.
 * `src/core` wird mit ausgeliefert, damit Browser und Tests dieselben
 * ES-Module nutzen — ohne Build-Schritt.
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(root, 'public')));
app.use('/src', express.static(path.join(root, 'src')));

app.listen(port, () => {
  console.log(`webapp.cashflow: http://localhost:${port}`);
});
