/**
 * Ein Editor für genau einen Aspekt — auf kleinen Schirmen als Blatt von
 * unten, ab Tablet als an das Token angedocktes Popover.
 *
 * Der Inhalt hängt in einem Portal am `<body>`, nicht in der Liste. Deshalb
 * darf die Liste beim Bearbeiten frei neu zeichnen, ohne dem Anwender das
 * Eingabefeld zu entziehen (Architecture.md, A16/A20). Der Anker wird über
 * einen Selektor gesucht, weil das alte Element nach einem Neuzeichnen weg ist.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface SheetProps {
  /** Selektor auf das Token, an dem das Popover andockt */
  anchorSelector: string;
  onClose: () => void;
  children: ReactNode;
}

interface Position { top: number; left: number; }

const ANCHORED_FROM = 760;
const MARGIN = 10;
const GAP = 7;

export default function Sheet({ anchorSelector, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [anchored, setAnchored] = useState(() => window.innerWidth >= ANCHORED_FROM);
  const [pos, setPos] = useState<Position | null>(null);

  /**
   * Position neu bestimmen. Setzt den Zustand nur, wenn sich wirklich etwas
   * ändert — sonst löst das Messen ein Neuzeichnen aus, das wieder misst.
   */
  const place = useCallback(() => {
    const wide = window.innerWidth >= ANCHORED_FROM;
    setAnchored((was) => (was === wide ? was : wide));

    if (!wide) { setPos((was) => (was === null ? was : null)); return; }

    const element = ref.current;
    const anchor = anchorSelector && document.querySelector(anchorSelector);
    if (!element || !anchor) return;

    const a = anchor.getBoundingClientRect();
    const box = element.getBoundingClientRect();

    const left = Math.round(Math.max(MARGIN, Math.min(a.left, window.innerWidth - box.width - MARGIN)));
    let top = a.bottom + GAP;
    if (top + box.height > window.innerHeight - MARGIN) {
      const above = a.top - box.height - GAP;
      top = above >= MARGIN ? above : Math.max(MARGIN, window.innerHeight - box.height - MARGIN);
    }
    top = Math.round(top);

    setPos((was) => (was && was.top === top && was.left === left ? was : { top, left }));
  }, [anchorSelector]);

  useLayoutEffect(() => {
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    // Inhalt wechselt die Höhe (anderer Regeltyp, Phase mehr) -> neu ausrichten
    const observer = new ResizeObserver(place);
    if (ref.current) observer.observe(ref.current);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      observer.disconnect();
    };
  }, [place]);

  /**
   * Angedockt gibt es bewusst keine klickfangende Abdeckung: sonst bräuchte
   * der Wechsel zum nächsten Token zwei Klicks — einen zum Schließen, einen
   * zum Öffnen. Stattdessen schließt ein Mausdruck außerhalb, und der Klick
   * läuft normal auf das Element darunter durch. Klicks auf den Anker selbst
   * behandelt dessen eigener Auf-/Zu-Schalter.
   */
  useEffect(() => {
    if (!anchored) return undefined;
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ref.current?.contains(target)) return;
      if (anchorSelector && target?.closest?.(anchorSelector)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [anchored, anchorSelector, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
      document.querySelector<HTMLElement>(anchorSelector)?.focus();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [anchorSelector, onClose]);

  const style: React.CSSProperties | undefined = anchored
    ? { top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }
    : undefined;

  return createPortal(
    <>
      {!anchored && <div className="scrim" onMouseDown={onClose} />}
      <div className="sheet" role="dialog" ref={ref} style={style}>
        <div className="sheet-grip" />
        {children}
      </div>
    </>,
    document.body,
  );
}
