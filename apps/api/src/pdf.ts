import type { Browser } from 'puppeteer';

/**
 * PDF generation for the calculation sheet (§4).
 *
 * Puppeteer renders the very same markup the screen renders, through the same print
 * stylesheet, so the PDF and the screen cannot drift apart. One browser instance is
 * reused across requests and closed on shutdown; each request gets its own page.
 */

let browserPromise: Promise<Browser> | null = null;
let unavailableReason: string | null = null;

async function launch(): Promise<Browser> {
  const puppeteer = (await import('puppeteer')).default;
  return puppeteer.launch({
    headless: true,
    // The container runs as an unprivileged user with no sandbox namespaces available.
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
  });
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launch().catch((err: unknown) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

export class PdfUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfUnavailable';
  }
}

export interface PdfMeta {
  /** Shown in the running footer, e.g. "MTK-2026-0001 rev 1". */
  title: string;
}

/**
 * Render a print-stylesheet HTML document to an A4 PDF.
 *
 * Throws PdfUnavailable when no Chromium can be launched, so the caller can fall back
 * to serving the HTML rather than failing the request outright.
 */
export async function renderPdf(html: string, meta: PdfMeta): Promise<Uint8Array> {
  if (unavailableReason) throw new PdfUnavailable(unavailableReason);

  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    unavailableReason =
      err instanceof Error ? err.message : 'Chromium could not be launched on this host.';
    throw new PdfUnavailable(unavailableReason);
  }

  const page = await browser.newPage();
  try {
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="width:100%;padding:0 12mm;font:9px -apple-system,system-ui,sans-serif;
                    color:#828D9A;display:flex;justify-content:space-between;">
          <span>${escapeHtml(meta.title)}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
    });
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function closePdfRenderer(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  browserPromise = null;
  await browser?.close().catch(() => undefined);
}

const escapeHtml = (v: string): string =>
  v.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
