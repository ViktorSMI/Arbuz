import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const gameUrl = pathToFileURL(path.resolve('index3d.html')).href;
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl'],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.goto(gameUrl, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForSelector('#btn-play', { state: 'visible', timeout: 30_000 });
  await page.waitForSelector('#loading-screen', { state: 'detached', timeout: 10_000 });

  const result = await page.evaluate(() => ({
    title: document.title,
    playText: document.getElementById('btn-play')?.textContent?.trim(),
    canvasCount: document.querySelectorAll('canvas').length,
    bootFailed: document.body.textContent?.includes('Мир не пророс') ?? false,
  }));

  if (pageErrors.length) {
    throw new Error(`Browser page errors:\n${pageErrors.join('\n')}`);
  }
  if (result.bootFailed) throw new Error('The local boot error screen is visible');
  if (!result.playText) throw new Error('The play button was not rendered');
  if (result.canvasCount < 1) throw new Error('The Three.js canvas was not created');

  console.log(`Local file smoke test passed: ${result.title}; ${result.canvasCount} canvas element(s)`);
} finally {
  await browser.close();
}
