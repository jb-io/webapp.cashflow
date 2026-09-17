/**
 * Erzeugt die Bildschirmfotos für die README aus den mitgelieferten
 * Beispieldaten — damit die Anleitung zeigt, was der Anwender wirklich sieht.
 *
 *   npm run build && npm run preview     # in einem zweiten Terminal
 *   npm run screenshots
 *
 * Die Daten werden über den Startdialog geladen, nicht eingeschleust: so
 * prüft der Lauf nebenbei, dass der Einstieg funktioniert.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = new URL('../docs/bilder/', import.meta.url).pathname;

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });

/** Neuer Kontext mit leerer Ablage. */
async function open({ viewport, colorScheme = 'light', scale = 1 }) {
  const context = await browser.newContext({
    viewport, colorScheme, locale: 'de-DE', deviceScaleFactor: scale,
    isMobile: viewport === MOBILE, hasTouch: viewport === MOBILE,
  });
  const page = await context.newPage();
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  return { context, page };
}

/** Beispieldaten über den Startdialog laden. */
async function loadSample(page) {
  await page.getByRole('button', { name: /Beispieldaten laden/ }).click();
  await page.waitForFunction(() => localStorage.getItem('webapp.cashflow.v1') !== null);
  await page.waitForTimeout(900);   // Diagramme zeichnen lassen
}

async function shot(page, name) {
  // Zeiger wegnehmen, sonst hebt der Hover eine beliebige Zeile hervor
  await page.mouse.move(0, 0);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('geschrieben:', `docs/bilder/${name}.png`);
}

/** Zur Route wechseln und warten, bis die Seite steht. */
async function route(page, hash, heading) {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.getByRole('heading', { name: heading, level: 1 }).waitFor();
  await page.waitForTimeout(700);
}

// ------------------------------------------------------------------ Desktop
{
  const { context, page } = await open({ viewport: DESKTOP });
  await page.getByRole('dialog').waitFor();
  await shot(page, '01-start');

  await loadSample(page);
  await shot(page, '02-verlauf');

  // zweiter Ausschnitt: Monatssaldo und Buchungsliste
  await page.evaluate(() => {
    const karten = [...document.querySelectorAll('.card')];
    const ziel = karten.find((k) => k.textContent?.includes('Monatssaldo nach Kategorie'));
    ziel?.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(600);
  await shot(page, '03-monatssaldo');

  await route(page, '#/buchungen', 'Buchungen');
  await shot(page, '04-buchungen');

  // Rhythmus-Editor einer Zeile öffnen
  const zeile = page.locator('.entry-row').filter({ hasText: 'Stromabschlag' });
  await zeile.locator('[data-token="rule"]').click();
  await page.locator('.sheet').waitFor();
  await page.waitForTimeout(400);
  await shot(page, '05-rhythmus-bearbeiten');
  await page.keyboard.press('Escape');

  // Betrags-Editor mit Phasenliste
  const gehalt = page.locator('.entry-row').filter({ hasText: 'Gehalt 1' });
  await gehalt.locator('[data-token="amount"]').click();
  await page.locator('.sheet').waitFor();
  await page.waitForTimeout(400);
  await shot(page, '06-betrag-bearbeiten');
  await page.keyboard.press('Escape');

  await route(page, '#/kategorien', 'Kategorien');
  await shot(page, '07-kategorien');

  await route(page, '#/konto', 'Konto');
  await shot(page, '08-konto');

  await context.close();
}

// -------------------------------------------------------------- Dunkelmodus
{
  const { context, page } = await open({ viewport: DESKTOP, colorScheme: 'dark' });
  await loadSample(page);
  await shot(page, '09-verlauf-dunkel');
  await context.close();
}

// ------------------------------------------------------------------- Mobil
{
  const { context, page } = await open({ viewport: MOBILE, scale: 2 });
  await loadSample(page);
  await shot(page, '10-mobil-verlauf');

  await route(page, '#/buchungen', 'Buchungen');
  await shot(page, '11-mobil-buchungen');

  const zeile = page.locator('.entry-row').filter({ hasText: 'Wocheneinkauf' });
  await zeile.locator('[data-token="rule"]').click();
  await page.locator('.sheet').waitFor();
  await page.waitForTimeout(400);
  await shot(page, '12-mobil-editor');

  await context.close();
}

await browser.close();
console.log('fertig.');
