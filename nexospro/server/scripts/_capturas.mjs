import { chromium } from "playwright";

const base = "https://app.filanex.es";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(`${base}/login`);
await page.fill('input[type="email"]', "fbarroso@filatecnica.com");
await page.fill('input[type="password"]', "Barroso@159000");
await page.click('button[type="submit"]');
await page.waitForURL(/\/(?!login)/, { timeout: 30000 });
await page.waitForTimeout(2500);

await page.goto(`${base}/certificado`);
await page.waitForTimeout(2500);
await page.screenshot({ path: "_p1-certificado.png" });

await page.goto(`${base}/ventas`);
await page.waitForTimeout(3000);
await page.screenshot({ path: "_p2-ventas.png" });

await b.close();
