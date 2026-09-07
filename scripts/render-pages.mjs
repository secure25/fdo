/**
 * Renders app pages to PNG for the visual acceptance gate.
 * Usage: node scripts/render-pages.mjs <sessionToken>
 * Marketing + auth pages render in an incognito context (logged-out view).
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const token = process.argv[2];
if (!token) {
  console.error("usage: node scripts/render-pages.mjs <dos_session token>");
  process.exit(1);
}

const BASE = "http://localhost:3000";
const OUT = new URL("../shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(OUT, { recursive: true });

const PUBLIC_PAGES = [
  ["landing", "/", 1600],
  ["login", "/login", 1440],
  ["signup", "/signup", 1440],
];

const AUTHED_PAGES = [
  ["onboarding", "/onboarding", 1440],
  ["overview", "/app", 1440],
  ["opportunities", "/app/opportunities", 1440],
  ["customers", "/app/customers", 1440],
  ["distribution", "/app/distribution", 1440],
  ["campaigns", "/app/campaigns", 1440],
  ["experiments", "/app/experiments", 1440],
  ["analytics", "/app/analytics", 1440],
  ["competitors", "/app/competitors", 1440],
  ["content", "/app/content", 1440],
  ["strategist", "/app/strategist", 1440],
  ["product", "/app/product", 1440],
  ["billing", "/app/billing", 1440],
  ["integrations", "/app/integrations", 1440],
  ["settings", "/app/settings", 1440],
];

async function render(page, name, path, width) {
  await page.setViewport({ width, height: 1000 });
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });
    console.log(`ok  ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}: ${err.message.split("\n")[0]}`);
  }
}

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--force-device-scale-factor=1"],
});

try {
  // Logged-out (incognito): marketing + auth pages
  const ctx = await browser.createBrowserContext();
  const pub = await ctx.newPage();
  for (const [n, p, w] of PUBLIC_PAGES) await render(pub, n, p, w);
  await render(pub, "landing-mobile", "/", 390);
  await ctx.close();

  // Logged-in: app surfaces
  const page = await browser.newPage();
  await page.setCookie({ name: "dos_session", value: token, domain: "localhost", path: "/", httpOnly: true });
  for (const [n, p, w] of AUTHED_PAGES) await render(page, n, p, w);
} finally {
  await browser.close();
}
