/**
 * Persistenz im Browser: localStorage als Ablage, JSON-Datei als
 * Backup-/Transportformat. Bewusst kein Server-Storage im Prototyp
 * (siehe Architecture.md) — Import/Export hält die Daten trotzdem portabel.
 */
import {
  STORAGE_KEY, LEGACY_STORAGE_KEYS, SCHEMA_VERSION, emptyState, normalizeState,
} from './model.ts';
import type { CashflowDoc } from './types.ts';

/**
 * Gespeicherter Zustand oder ein leeres Dokument.
 *
 * Ein migriertes Dokument wird sofort zurückgeschrieben, damit die Ablage
 * nicht bis zur nächsten Änderung im alten Schema verharrt.
 */
export function loadState(): CashflowDoc {
  try {
    const found = readRaw();
    if (!found) return emptyState();
    const parsed = JSON.parse(found.raw);
    const state = normalizeState(parsed);
    // Migriertes Schema oder Altablage: sofort unter dem aktuellen Schlüssel sichern
    if (found.legacy || parsed.version !== SCHEMA_VERSION) saveState(state);
    if (found.legacy) globalThis.localStorage?.removeItem(found.key);
    return state;
  } catch (err) {
    console.warn('Gespeicherte Daten unlesbar, starte leer:', err);
    return emptyState();
  }
}

/**
 * Liest die aktuelle Ablage, ersatzweise eine Ablage unter einem früheren
 * Projektnamen — damit eine Umbenennung keine vorhandenen Daten verliert.
 */
function readRaw(): { raw: string; key: string; legacy: boolean } | null {
  const current = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (current) return { raw: current, key: STORAGE_KEY, legacy: false };
  for (const key of LEGACY_STORAGE_KEYS) {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw) return { raw, key, legacy: true };
  }
  return null;
}

export function saveState(state: CashflowDoc): boolean {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('Speichern fehlgeschlagen:', err);
    return false;
  }
}

/**
 * Liegen überhaupt Daten vor? Unterscheidet „noch nie benutzt" von
 * „bewusst leer" — nur im ersten Fall zeigt die App den Startdialog.
 */
export function hasStoredState(): boolean {
  return readRaw() != null;
}

export function clearState(): void {
  globalThis.localStorage?.removeItem(STORAGE_KEY);
}

/** Zustand als formatiertes JSON (für den Datei-Export). */
export function exportJson(state: CashflowDoc): string {
  return JSON.stringify(state, null, 2);
}

/** Import mit Validierung — wirft bei ungültiger Datei. */
export function importJson(text: string): CashflowDoc {
  return normalizeState(JSON.parse(text));
}
