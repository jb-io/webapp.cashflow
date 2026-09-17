/**
 * Hierarchische Kategorien: jede Kategorie kann eine Oberkategorie haben
 * (`parentId`). Die Liste bleibt flach gespeichert — der Baum wird bei Bedarf
 * berechnet, damit Import/Export und Referenzen einfach bleiben.
 *
 * Pur, ohne DOM: dieselben Funktionen nutzen UI und Tests.
 */
import type { Category, TreeNode } from './types.ts';

/** Index id -> Kategorie. */
export function indexById(categories: Category[]): Map<string, Category> {
  return new Map(categories.map((c) => [c.id, c]));
}

/**
 * Kette von der Wurzel bis zur Kategorie (inklusive).
 * Bricht bei defekten Daten (Zyklus) sauber ab, statt zu hängen.
 */
export function ancestryOf(categories: Category[], id: string | null): Category[] {
  const byId = indexById(categories);
  const chain: Category[] = [];
  const seen = new Set<string>();
  let current = id == null ? undefined : byId.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

/** "Wohnen / Nebenkosten" — voller Pfad als Text. */
export function pathOf(categories: Category[], id: string | null, separator = ' / '): string {
  return ancestryOf(categories, id).map((c) => c.name).join(separator);
}

/** Oberste Kategorie des Astes (für Auswertungen "nach Oberkategorie"). */
export function rootIdOf(categories: Category[], id: string | null): string | null {
  return ancestryOf(categories, id)[0]?.id ?? null;
}

/** Verschachtelungstiefe: 0 für eine Wurzelkategorie. */
export function depthOf(categories: Category[], id: string | null): number {
  return Math.max(0, ancestryOf(categories, id).length - 1);
}

/** Die Kategorie selbst und alle darunter liegenden. */
export function descendantIds(categories: Category[], id: string): Set<string> {
  const result = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const category of categories) {
      if (category.parentId && result.has(category.parentId) && !result.has(category.id)) {
        result.add(category.id);
        grew = true;
      }
    }
  }
  return result;
}

/**
 * Flache Liste in Baumreihenfolge — jede Kategorie mit ihrer Tiefe.
 * Reihenfolge innerhalb einer Ebene bleibt die Anlagereihenfolge.
 * Kategorien mit unbekanntem Elternteil werden als Wurzel behandelt,
 * damit nie ein Eintrag aus der Liste verschwindet.
 */
export function flattenTree(categories: Category[]): TreeNode[] {
  const byId = indexById(categories);
  const childrenOf = new Map<string | null, Category[]>();
  for (const category of categories) {
    const parent = category.parentId && byId.has(category.parentId) ? category.parentId : null;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent)!.push(category);
  }

  const out: TreeNode[] = [];
  const visited = new Set<string>();
  const walk = (parentId: string | null, depth: number): void => {
    for (const category of childrenOf.get(parentId) ?? []) {
      if (visited.has(category.id)) continue;   // Schutz gegen defekte Daten
      visited.add(category.id);
      out.push({ category, depth });
      walk(category.id, depth + 1);
    }
  };
  walk(null, 0);

  // Reste aus einem Zyklus hängen wir hinten an, statt sie zu verlieren
  for (const category of categories) {
    if (!visited.has(category.id)) out.push({ category, depth: 0 });
  }
  return out;
}

/**
 * Darf `id` unter `parentId` gehängt werden?
 * Verbietet Selbstbezug und das Einhängen in den eigenen Unterbaum.
 */
export function canReparent(categories: Category[], id: string, parentId: string | null): boolean {
  if (!parentId) return true;
  if (parentId === id) return false;
  return !descendantIds(categories, id).has(parentId);
}
