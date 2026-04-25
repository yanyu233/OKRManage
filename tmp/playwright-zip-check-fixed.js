const { chromium } = require('C:/Users/yanxi/Documents/OKRManage/.codex-runtime/manual-tools/node_modules/playwright');

async function loginAndGetCookie() {
  const response = await fetch('http://127.0.0.1:3000/api/auth/manual-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginName: '20203486', password: 'Moutai123.' })
  });
  const setCookie = response.headers.get('set-cookie');
  const match = setCookie && /okr_sid=([^;]+)/.exec(setCookie);
  if (!response.ok || !match) throw new Error('login failed');
  return match[1];
}

(async () => {
  const sessionId = await loginAndGetCookie();
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1400 } });
  await context.addCookies([{ name: 'okr_sid', value: sessionId, domain: '127.0.0.1', path: '/' }]);
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/employee/goal/cmo6x60zo0048iji83r7nseyx', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.getByRole('heading', { name: 'KR1 2' }).click();
  await page.waitForTimeout(1200);

  const zipLink = page.getByRole('link', { name: '2026040200004961550.zip' }).first();
  console.log('ZIP_LINK_HREF', await zipLink.getAttribute('href'));

  const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
  await zipLink.click();
  const popup = await popupPromise;
  await page.waitForTimeout(1500);
  console.log('CURRENT_URL', page.url());

  if (!popup) {
    console.log('NO_POPUP');
    await page.screenshot({ path: 'C:/Users/yanxi/Documents/OKRManage/tmp/zip-no-popup.png', fullPage: true });
    process.exit(2);
  }

  await popup.waitForLoadState('networkidle').catch(() => {});
  await popup.waitForTimeout(2000);
  console.log('POPUP_URL', popup.url());
  console.log('POPUP_TEXT', (await popup.locator('body').innerText()).slice(0, 1200));
  await popup.screenshot({ path: 'C:/Users/yanxi/Documents/OKRManage/tmp/zip-popup-fixed.png', fullPage: true });
  await browser.close();
})();
