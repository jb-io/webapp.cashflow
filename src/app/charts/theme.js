/**
 * Diagrammfarben kommen aus denselben CSS-Variablen wie der Rest der
 * Oberfläche — heller und dunkler Modus sind dort getrennt gesetzt, nicht
 * gespiegelt. `useThemeTick` zeichnet neu, wenn das System umschaltet.
 */
import { useEffect, useState } from 'react';

export function chartTheme() {
  const css = getComputedStyle(document.documentElement);
  const read = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);
  return {
    text: read('--text', '#101828'),
    muted: read('--text-muted', '#5c6b84'),
    faint: read('--text-faint', '#8695ab'),
    grid: read('--border', '#dfe5ee'),
    surface: read('--surface', '#ffffff'),
    accent: read('--accent', '#2a78d6'),
    pos: read('--pos', '#087443'),
    neg: read('--neg', '#bc2f2c'),
  };
}

/** Zählt bei jedem Wechsel des Farbschemas hoch. */
export function useThemeTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const bump = () => setTick((n) => n + 1);
    query.addEventListener('change', bump);
    return () => query.removeEventListener('change', bump);
  }, []);
  return tick;
}

/** Deckkraft auf einen Hex-Farbwert legen, ohne Farbbibliothek. */
export function withAlpha(hex, alpha) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const n = Number.parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
