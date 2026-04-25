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
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  await context.addCookies([{ name: 'okr_sid', value: sessionId, domain: '127.0.0.1', path: '/' }]);
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/employee/goal/cmo6x60zo0048iji83r7nseyx', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log('URL', page.url());
  console.log('BODY', (await page.locator('body').innerText()).slice(0, 3000));
  await page.screenshot({ path: 'C:/Users/yanxi/Documents/OKRManage/tmp/goal-page.png', fullPage: true });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
