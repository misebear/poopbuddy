const { chromium } = require('playwright-core');

const AAB = 'C:\\development\\PoopBuddy\\android\\app\\build\\outputs\\bundle\\release\\app-release.aab';
const APP_ID = '4973346914745048166';
const BASE = `https://play.google.com/console/u/0/developers/5047399025850753041/app/${APP_ID}`;

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  const page = pages[0] || await context.newPage();
  page.setDefaultTimeout(45000);

  await page.goto(`${BASE}/tracks/production`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  const pageTitle = await page.title();
  const titleText = await page.locator('body').innerText({ timeout: 20000 });
  if (!page.url().includes(`/app/${APP_ID}/`) || !pageTitle.includes('PoopBuddy')) {
    console.error('Current URL:', page.url());
    console.error('Current title:', pageTitle);
    console.error('Body head:', titleText.slice(0, 1000));
    await page.screenshot({ path: 'C:\\development\\PoopBuddy\\runs\\play_global_v24_20260629\\play-console-identity-failed.png', fullPage: true });
    throw new Error('PoopBuddy app identity was not visible before upload.');
  }

  await page.getByRole('button', { name: /새 버전 만들기/ }).click();
  await page.waitForLoadState('networkidle').catch(() => {});

  const uploadButton = page.getByRole('button', { name: /^업로드$/ });
  await uploadButton.waitFor();
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
  await uploadButton.click();
  const chooser = await chooserPromise;
  if (chooser) {
    await chooser.setFiles(AAB);
  } else {
    const fileInputs = await page.locator('input[type="file"]').count();
    if (fileInputs < 1) throw new Error('No file chooser or file input appeared after clicking upload.');
    await page.locator('input[type="file"]').first().setInputFiles(AAB);
  }

  await page.waitForTimeout(5000);
  await page.getByRole('textbox', { name: /출시명/ }).fill('PoopBuddy 2.4 global polish');
  const notes = [
    'ko-KR',
    'v2.4 글로벌 스토어 개선',
    '- 프리미엄 의료형 스토어 이미지 갱신',
    '- 한국어/영어/일본어 대표 등록정보 정리',
    '- 건강 점수, 캘린더, 수의사 공유 리포트 흐름 강화',
    '',
    'en-US',
    'v2.4 global polish',
    '- Premium medical-style store visuals',
    '- Korean, English, and Japanese listing sets',
    '- Stronger health score, calendar, and vet-report flow',
  ].join('\n');
  await page.getByRole('textbox', { name: /출시 노트/ }).fill(notes);

  await page.screenshot({ path: 'C:\\development\\PoopBuddy\\runs\\play_global_v24_20260629\\play-console-release-draft.png', fullPage: true });
  console.log('UPLOAD_DRAFT_READY');
  console.log(await page.title());
  await browser.close();
}

main().catch(err => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
