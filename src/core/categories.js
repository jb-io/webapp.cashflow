/**
 * Hierarchische Kategorien: jede Kategorie kann eine Oberkategorie haben
 * (`parentId`). Die Liste bleibt flach gespeichert — der Baum wird bei Bedarf
 * berechnet, damit Import/Export und Referenzen einfach bleiben.
 *
 * Pur, ohne DOM: dieselben Funktionen nutzen UI und Tests.
 */

/** Index id -> Kategorie. */
export function indexById(categories) {
  return new Map(categories.map((c) => [c.id, c]));
}

/**
 * Kette von der Wurzel bis zur Kategorie (inklusive).
 * Bricht bei defekten Daten (Zyklus) sauber ab, statt zu hängen.
 */
export function ancestryOf(categories, id) {
  const byId = indexById(categories);
  const chain = [];
  const seen = new Set();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  return chain;
}

/** "Wohnen / Nebenkosten" — voller Pfad als Text. */
export function pathOf(categories, id, separator = ' / ') {
  return ancestryOf(categories, id).map((c) => c.name).join(separator);
}

/** Oberste Kategorie des Astes (für Auswertungen "nach Oberkategorie"). */
export function rootIdOf(categories, id) {
  return ancestryOf(categories, id)[0]?.id ?? null;
}

/** Verschachtelungstiefe: 0 für eine Wurzelkategorie. */
export function depthOf(categories, id) {
  return Math.max(0, ancestryOf(categories, id).length - 1);
}

/** Die Kategorie selbst und alle darunter liegenden. */
export function descendantIds(categories, id) {
  const result = new Set([id]);
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
 * @returns {{category: object, depth: number}[]}
 */
export function flattenTree(categories) {
  const byId = indexById(categories);
  const childrenOf = new Map();
  for (const category of categories) {
    const parent = category.parentId && byId.has(category.parentId) ? category.parentId : null;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(category);
  }

  const out = [];
  const visited = new Set();
  const walk = (parentId, depth) => {
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
export function canReparent(categories, id, parentId) {
  if (!parentId) return true;
  if (parentId === id) return false;
  return !descendantIds(categories, id).has(parentId);
}
