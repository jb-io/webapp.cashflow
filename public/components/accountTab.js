/** Tab "Konto & Daten": Stammdaten und Datenpflege (Import/Export, Beispieldaten, Zurücksetzen).
 *  Der Planungszeitraum steht im Verlauf-Tab, wo er wirkt. */
import { exportJson, importJson } from '../../src/core/storage.js';
import { fetchDummyState } from './welcome.js';
import { escapeHtml } from './format.js';

export function renderAccountTab(root, ctx) {
  const { account } = ctx.state;

  root.innerHTML = `
    <div class="panel">
      <h2>Konto</h2>
      <div class="row">
        <div class="field"><label>Bezeichnung</label><input id="acc-name" value="${escapeHtml(account.name)}"></div>
        <div class="field"><label>Startkontostand (€)</label><input id="acc-balance" type="number" step="0.01" value="${account.startBalance}"></div>
        <div class="field"><label>Startdatum</label><input id="acc-start" type="date" value="${account.startDate}"></div>
      </div>
      <p class="hint">Vor dem Startdatum wird nichts gerechnet — der Startkontostand gilt an diesem Tag.</p>
    </div>

    <div class="panel">
      <h2>Daten</h2>
      <p class="hint">Gespeichert wird im Browser (localStorage). Für Backup oder Umzug den JSON-Export nutzen.</p>
      <div class="row">
        <button class="action" id="btn-export">JSON exportieren</button>
        <button class="action" id="btn-import">JSON importieren</button>
        <button class="action" id="btn-sample">Beispieldaten laden</button>
        <button class="action danger" id="btn-reset">Alles zurücksetzen</button>
      </div>
      <input type="file" id="file-input" accept="application/json,.json" hidden>
      <p id="data-msg" class="hint"></p>
    </div>
  `;

  const message = root.querySelector('#data-msg');
  const say = (text, isError = false) => {
    message.textContent = text;
    message.className = isError ? 'warn' : 'hint';
  };

  const bind = (id, event, handler) => root.querySelector(id).addEventListener(event, handler);

  bind('#acc-name', 'change', (e) => ctx.actions.update((s) => { s.account.name = e.target.value; }));
  bind('#acc-balance', 'change', (e) =>
    ctx.actions.update((s) => { s.account.startBalance = Number(e.target.value) || 0; }));
  bind('#acc-start', 'change', (e) => {
    if (e.target.value) ctx.actions.update((s) => { s.account.startDate = e.target.value; });
  });

  bind('#btn-export', 'click', () => {
    const blob = new Blob([exportJson(ctx.state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `webapp.cashflow-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    say('Export heruntergeladen.');
  });

  const fileInput = root.querySelector('#file-input');
  bind('#btn-import', 'click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!confirm('Import überschreibt die aktuell gespeicherten Daten. Fortfahren?')) {
      fileInput.value = '';
      return;
    }
    try {
      ctx.actions.replaceState(importJson(await file.text()));
      say(`Import aus "${file.name}" erfolgreich.`);
    } catch (err) {
      say(`Import fehlgeschlagen: ${err.message}`, true);
    }
    fileInput.value = '';
  });

  bind('#btn-sample', 'click', async () => {
    if (ctx.state.entries.length && !confirm('Beispieldaten ersetzen die aktuellen Daten. Fortfahren?')) return;
    try {
      ctx.actions.replaceState(await fetchDummyState());
      ctx.actions.selectTab('forecast');
    } catch (err) {
      say(`Beispieldaten konnten nicht geladen werden: ${err.message}`, true);
    }
  });

  bind('#btn-reset', 'click', () => {
    if (!confirm('Wirklich alle Daten löschen? Danach fragt der Startdialog erneut, womit es losgehen soll.')) return;
    ctx.actions.resetState();
  });
}
