const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('C:/Users/yanxi/Documents/OKRManage/.codex-runtime/manual-tools/node_modules/playwright');

const APP_BASE = 'http://127.0.0.1:5173';
const API_BASE = 'http://127.0.0.1:3000/api';
const OUT_DIR = 'C:/Users/yanxi/Documents/OKRManage/tmp/q1-real-flow-shots';
const PASSWORD = 'Admin123!';

const ACCOUNTS = {
  employee: { loginName: '20203176', password: PASSWORD },
  sectionLeader: { loginName: '1100299', password: PASSWORD },
  groupLeader: { loginName: '20203486', password: PASSWORD },
  sysadmin: { loginName: 'sysadmin.local', password: PASSWORD }
};

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function loginAndGetCookie({ loginName, password }) {
  const response = await fetch(`${API_BASE}/auth/manual-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginName, password })
  });

  const setCookie = response.headers.get('set-cookie');
  const match = setCookie && /okr_sid=([^;]+)/.exec(setCookie);

  if (!response.ok || !match) {
    throw new Error(`login failed for ${loginName}`);
  }

  return match[1];
}

async function newAuthedPage(browser, account) {
  const sessionId = await loginAndGetCookie(account);
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    locale: 'zh-CN'
  });
  await context.addCookies([{ name: 'okr_sid', value: sessionId, domain: '127.0.0.1', path: '/' }]);
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.error(`[console:${account.loginName}] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    console.error(`[pageerror:${account.loginName}] ${error.message}`);
  });
  return { context, page };
}

async function waitForApp(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
}

async function captureEmployeePage(browser) {
  const { context, page } = await newAuthedPage(browser, ACCOUNTS.employee);
  try {
    await waitForApp(page, `${APP_BASE}/employee/okr`);
    const expandButtons = page.getByRole('button', { name: /展开|查看详情|上传材料/ });
    const expandCount = await expandButtons.count();
    if (expandCount > 0) {
      await expandButtons.first().click().catch(() => {});
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: path.join(OUT_DIR, 'employee-q1.png'), fullPage: true });
    const bodyText = (await page.locator('body').innerText()).slice(0, 1500);
    return { url: page.url(), bodyText };
  } finally {
    await context.close();
  }
}

async function captureSectionLeaderSubjective(browser) {
  const { context, page } = await newAuthedPage(browser, ACCOUNTS.sectionLeader);
  try {
    await waitForApp(page, `${APP_BASE}/leader/workbench/subjective`);
    await page.screenshot({ path: path.join(OUT_DIR, 'subjective-section-leader.png'), fullPage: true });
    const bodyText = (await page.locator('body').innerText()).slice(0, 2000);
    return { url: page.url(), bodyText };
  } finally {
    await context.close();
  }
}

async function captureGroupLeaderSubjective(browser) {
  const { context, page } = await newAuthedPage(browser, ACCOUNTS.groupLeader);
  try {
    await waitForApp(page, `${APP_BASE}/leader/workbench/subjective`);
    await page.screenshot({ path: path.join(OUT_DIR, 'subjective-group-leader.png'), fullPage: true });
    const bodyText = (await page.locator('body').innerText()).slice(0, 1200);
    return { url: page.url(), bodyText };
  } finally {
    await context.close();
  }
}

async function captureRankingPage(browser) {
  const { context, page } = await newAuthedPage(browser, ACCOUNTS.sysadmin);
  try {
    await waitForApp(page, `${APP_BASE}/leader/ranking`);
    await page.screenshot({ path: path.join(OUT_DIR, 'ranking-q1.png'), fullPage: true });
    const bodyText = (await page.locator('body').innerText()).slice(0, 2500);
    return { url: page.url(), bodyText };
  } finally {
    await context.close();
  }
}

async function capturePreviewPage(browser, name, targetUrl) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    locale: 'zh-CN'
  });
  const page = await context.newPage();
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true });
    const bodyText = (await page.locator('body').innerText()).slice(0, 2000);
    return { url: page.url(), bodyText };
  } finally {
    await context.close();
  }
}

async function main() {
  await ensureDir(OUT_DIR);
  const results = JSON.parse(
    await fs.readFile('C:/Users/yanxi/Documents/OKRManage/tmp/q1-real-flow-results.json', 'utf8')
  );
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  });

  try {
    const docPreview = results.previewChecks.find((entry) => entry.extension === '.docx');
    const xlsPreview = results.previewChecks.find((entry) => entry.extension === '.xls');

    const output = {
      employeePage: await captureEmployeePage(browser),
      sectionLeaderSubjective: await captureSectionLeaderSubjective(browser),
      groupLeaderSubjective: await captureGroupLeaderSubjective(browser),
      rankingPage: await captureRankingPage(browser),
      previewDocx: docPreview ? await capturePreviewPage(browser, 'preview-docx.png', docPreview.targetUrl) : null,
      previewXls: xlsPreview ? await capturePreviewPage(browser, 'preview-xls.png', xlsPreview.targetUrl) : null
    };

    await fs.writeFile(path.join(OUT_DIR, 'summary.json'), JSON.stringify(output, null, 2), 'utf8');
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
