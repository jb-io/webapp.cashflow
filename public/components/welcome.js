/**
 * Startdialog beim ersten Aufruf (noch keine Ablage vorhanden).
 *
 * Drei Wege hinein: eigene JSON-Datei, leer beginnen oder Beispieldaten.
 * Der Dialog lässt sich nicht wegdrücken — ohne Entscheidung stünde der
 * Anwender vor einer leeren App und wüsste nicht, warum.
 */
import { emptyState } from '../../src/core/model.js';
import { importJson } from '../../src/core/storage.js';

/** Ablageort der mitgelieferten Beispieldaten (Import/Export-Format). */
export const DUMMY_DATA_URL = 'data/dummy-data.json';

/** Lädt die mitgelieferten Beispieldaten und prüft sie wie einen Import. */
export async function fetchDummyState() {
  const response = await fetch(DUMMY_DATA_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Beispieldaten nicht erreichbar (HTTP ${response.status}).`);
  return importJson(await response.text());
}

/**
 * Zeigt den Startdialog. Läuft erst weiter, wenn eine Option gewählt wurde.
 * @param {(state: object) => void} onChoose
 */
export function openWelcomeDialog(onChoose) {
  const dialog = document.getElementById('welcome-dialog');

  dialog.innerHTML = `
    <div class="dialog-body">
      <h2>webapp.cashflow</h2>
      <p class="hint">Noch keine Daten vorhanden. Womit soll es losgehen?</p>

      <div class="welcome-options">
        <button class="welcome-option" data-choice="import">
          <strong>Aus JSON-Datei laden</strong>
          <span class="hint">Eine zuvor exportierte Datei einlesen.</span>
        </button>
        <button class="welcome-option" data-choice="empty">
          <strong>Leer starten</strong>
          <span class="hint">Konto, Kategorien und Bewegungen selbst anlegen.</span>
        </button>
        <button class="welcome-option" data-choice="dummy">
          <strong>Beispieldaten laden</strong>
          <span class="hint">Zwei Gehälter und je eine Ausgabe pro Kategorie — über alle Intervalle.</span>
        </button>
      </div>

      <input type="file" id="welcome-file" accept="application/json,.json" hidden>
      <p id="welcome-error" class="warn"></p>
    </div>
  `;

  const error = dialog.querySelector('#welcome-error');
  const fail = (message) => { error.textContent = message; };

  let chosen = false;
  const finish = (state) => { chosen = true; dialog.close(); onChoose(state); };

  // Der Dialog darf nicht ohne Entscheidung verschwinden — es gibt keinen
  // sinnvollen Standardfall. `cancel` abzubrechen reicht dafür nicht: ohne
  // vorherige Nutzerinteraktion liefert Chrome das Ereignis nicht abbrechbar
  // aus. Deshalb zusätzlich beim Schließen wieder öffnen.
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  dialog.addEventListener('close', () => { if (!chosen) dialog.showModal(); });

  const fileInput = dialog.querySelector('#welcome-file');
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      finish(importJson(await file.text()));
    } catch (err) {
      fail(`Datei konnte nicht gelesen werden: ${err.message}`);
      fileInput.value = '';
    }
  });

  dialog.querySelector('.welcome-options').addEventListener('click', async (event) => {
    const choice = event.target.closest('[data-choice]')?.dataset.choice;
    if (!choice) return;
    fail('');

    if (choice === 'import') { fileInput.click(); return; }
    if (choice === 'empty') { finish(emptyState()); return; }

    try {
      finish(await fetchDummyState());
    } catch (err) {
      fail(`Beispieldaten konnten nicht geladen werden: ${err.message}`);
    }
  });

  dialog.showModal();
}
