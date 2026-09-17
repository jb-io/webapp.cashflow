/**
 * Kleines, an ein Element verankertes Popover — der Editor für ein einzelnes
 * Token der Listenansicht.
 *
 * Der Knackpunkt: das Popover hängt **nicht** im DOM der Liste, sondern direkt
 * am `<body>`. Dadurch darf die Liste jederzeit neu rendern, ohne dem Anwender
 * das Eingabefeld unter den Fingern wegzuziehen (vgl. Architecture.md, A16).
 * Den Anker findet es über einen Selektor wieder, nicht über eine Referenz —
 * nach einem Neurender ist das alte Element weg, der Selektor trifft aber das
 * neue. Verschwindet der Anker ganz (Eintrag gelöscht), schließt es sich.
 *
 * Es ist immer höchstens eines offen; `key` benennt das offene Token, damit ein
 * erneuter Klick darauf schließt statt neu zu öffnen.
 */

let active = null;

/**
 * @param {object} options
 * @param {string} options.key            Kennung des Tokens, z. B. "ent_1:amount"
 * @param {string} options.anchorSelector Selektor auf das Token-Element
 * @param {(body: HTMLElement, api: {close: Function, rebuild: Function}) => void} options.render
 */
export function openPopover({ key, anchorSelector, render }) {
  closePopover();

  const element = document.createElement('div');
  element.className = 'popover';
  element.setAttribute('role', 'dialog');
  document.body.appendChild(element);

  active = { key, anchorSelector, render, element };
  rebuild();

  document.addEventListener('mousedown', onDocumentDown, true);
  document.addEventListener('keydown', onDocumentKey, true);
  window.addEventListener('resize', repositionPopover);
  window.addEventListener('scroll', repositionPopover, true);

  element.querySelector('input, select, button')?.focus();
}

export function closePopover() {
  if (!active) return;
  active.element.remove();
  active = null;
  for (const marked of document.querySelectorAll('.tok-open')) marked.classList.remove('tok-open');
  document.removeEventListener('mousedown', onDocumentDown, true);
  document.removeEventListener('keydown', onDocumentKey, true);
  window.removeEventListener('resize', repositionPopover);
  window.removeEventListener('scroll', repositionPopover, true);
}

export function isPopoverOpen(key) {
  return active?.key === key;
}

/**
 * Nach jedem Neurender aufrufen: Anker neu suchen und Position nachziehen.
 * Ist der Anker verschwunden, schließt das Popover.
 */
export function repositionPopover() {
  if (!active) return;
  const anchor = document.querySelector(active.anchorSelector);
  if (!anchor) {
    closePopover();
    return;
  }
  anchor.classList.add('tok-open');

  const { element } = active;
  element.style.visibility = 'hidden';
  element.style.top = '0px';
  element.style.left = '0px';

  const rect = anchor.getBoundingClientRect();
  const box = element.getBoundingClientRect();
  const margin = 8;

  let left = rect.left;
  left = Math.min(left, window.innerWidth - box.width - margin);
  left = Math.max(margin, left);

  // bevorzugt darunter; wenn kein Platz ist, darüber
  let top = rect.bottom + 6;
  if (top + box.height > window.innerHeight - margin) {
    const above = rect.top - box.height - 6;
    top = above >= margin ? above : Math.max(margin, window.innerHeight - box.height - margin);
  }

  element.style.left = `${Math.round(left)}px`;
  element.style.top = `${Math.round(top)}px`;
  element.style.visibility = '';
}

function rebuild() {
  const { element, render } = active;
  element.innerHTML = '';
  render(element, {
    close: closePopover,
    rebuild: () => { rebuild(); repositionPopover(); },
  });
  repositionPopover();
}

function onDocumentDown(event) {
  if (!active) return;
  if (active.element.contains(event.target)) return;
  // Klicks auf den Anker behandelt dessen eigener Handler (Auf/Zu-Schalter)
  if (event.target.closest?.(active.anchorSelector)) return;
  closePopover();
}

function onDocumentKey(event) {
  if (!active || event.key !== 'Escape') return;
  event.stopPropagation();
  const anchor = document.querySelector(active.anchorSelector);
  closePopover();
  anchor?.focus();
}
