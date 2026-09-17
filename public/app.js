/**
 * Einstiegspunkt des Prototyps: hält den Zustand, rechnet nach jeder Änderung
 * neu und rendert die vier Tabs. Bewusst ohne Framework — die Rechenlogik
 * liegt vollständig in /src/core und bleibt beim späteren React-Umstieg gültig.
 */
import { loadState, saveState, hasStoredState, clearState } from '../src/core/storage.js';
import { emptyState, viewOf, windowOf, normalizeView } from '../src/core/model.js';
import { buildForecast, aggregateByMonth } from '../src/core/forecast.js';
import { computeStats } from '../src/core/stats.js';
import { money } from './components/format.js';

import { renderForecastTab } from './components/forecastTab.js';
import { renderEntriesTab } from './components/entriesTab.js';
import { renderCategoriesTab } from './components/categoriesTab.js';
import { renderAccountTab } from './components/accountTab.js';
import { openWelcomeDialog } from './components/welcome.js';
import { repositionPopover } from './components/popover.js';

const TABS = {
  forecast: renderForecastTab,
  entries: renderEntriesTab,
  categories: renderCategoriesTab,
  account: renderAccountTab,
};

let state = loadState();
let activeTab = 'forecast';

/**
 * Zustand ändern: mutieren, speichern, neu rendern.
 * @param {(draft: object) => void} mutate
 */
function update(mutate) {
  mutate(state);
  saveState(state);
  render();
}

/**
 * Wie `update`, aber **ohne** Neurendern — für Änderungen aus einem Feld
 * heraus, in dem der Cursor noch steht.
 *
 * Ein Vollrender würde die Tabelle mitten in der Eingabe austauschen: der
 * Klick, der die Übernahme ausgelöst hat, landet dann auf dem neuen DOM und
 * damit womöglich in einer anderen Zeile. Die betroffene Sicht aktualisiert
 * ihre abgeleiteten Stellen stattdessen selbst (siehe Architecture.md, A16).
 */
function updateInline(mutate) {
  mutate(state);
  saveState(state);
  refreshSummary();
}

/** Ersetzt den kompletten Zustand (Import, Beispieldaten, Startdialog). */
function replaceState(next) {
  state = next;
  saveState(state);
  render();
}

/**
 * Setzt alles zurück: Ablage löschen und wieder fragen, womit es losgehen soll.
 * Bewusst **ohne** Speichern — die App ist danach im selben Zustand wie beim
 * allerersten Aufruf, nicht in einer leeren, aber bereits angelegten Ablage.
 */
function resetState() {
  clearState();
  state = emptyState();
  render();
  askForStart();
}

/** Startdialog zeigen und die getroffene Wahl übernehmen. */
function askForStart() {
  openWelcomeDialog((chosen) => {
    replaceState(chosen);
    selectTab(chosen.entries.length === 0 ? 'account' : 'forecast');
  });
}

/**
 * Setzt den Zeitraum aller Sichten. Immer ein Monatsbereich — Tagesgrenzen
 * gibt es in der Oberfläche bewusst nicht (siehe Architecture.md, A14).
 */
function setView(view) {
  update((draft) => { draft.settings.view = normalizeView(view); });
}

function selectTab(name) {
  activeTab = name;
  render();
}

/** Kopfzeile — die einzige Stelle außerhalb der Tabs, die vom Zustand abhängt. */
function refreshSummary() {
  document.getElementById('account-summary').textContent =
    `${state.account.name} · Start ${money(state.account.startBalance)} · ${state.entries.length} Einträge`;
}

function render() {
  const view = viewOf(state);
  const window_ = windowOf(view);
  const forecast = buildForecast(state, window_.from, window_.to);
  const ctx = {
    state,
    forecast,
    months: aggregateByMonth(forecast),
    stats: computeStats(forecast),
    view,
    window: window_,
    actions: { update, updateInline, replaceState, resetState, setView, selectTab, render },
  };

  refreshSummary();

  for (const [name, renderTab] of Object.entries(TABS)) {
    const section = document.getElementById(`tab-${name}`);
    section.classList.toggle('active', name === activeTab);
    // nur der sichtbare Tab wird gerendert — spart insbesondere das Chart-Neuzeichnen
    if (name === activeTab) renderTab(section, ctx);
  }
  for (const button of document.querySelectorAll('nav button')) {
    button.classList.toggle('active', button.dataset.tab === activeTab);
  }

  // Ein offenes Token-Popover hängt am <body> und überlebt das Neurendern;
  // sein Anker ist danach ein neues Element und muss neu gesucht werden.
  repositionPopover();
}

document.querySelector('nav').addEventListener('click', (event) => {
  const tab = event.target.closest('button')?.dataset.tab;
  if (tab) selectTab(tab);
});

render();

// Erster Aufruf ohne jede Ablage: Startdialog. Eine leere, aber vorhandene
// Ablage ist eine bewusste Entscheidung und wird nicht erneut erfragt.
if (!hasStoredState()) askForStart();
