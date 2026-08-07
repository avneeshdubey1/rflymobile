import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

async function runAudit() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  console.log('Launching browser...');
  const browser = await chromium.launch({ executablePath: edgePath, headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to local frontend...');
  const response = await page.goto('http://127.0.0.1:18080', { waitUntil: 'networkidle' });
  
  console.log(`Status: ${response.status()}`);
  assert.equal(response.status(), 200, 'Frontend should load with status 200');
  
  const title = await page.title();
  console.log(`Page title: ${title}`);
  
  // Basic sanity check, wait for a root element
  await page.waitForSelector('#root', { timeout: 10000 });
  console.log('Root element is present.');
  
  await browser.close();
  console.log('Browser audit passed successfully!');
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
