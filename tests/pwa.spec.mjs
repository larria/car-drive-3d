import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function mockedPwa(page) {
  await page.route('**/pwa-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<footer><span>练习场</span></footer>' }));
  await page.goto('pwa-fixture.html');
  const source = readFileSync(new URL('../src/pwa.ts', import.meta.url), 'utf8')
    .replace("import { registerSW } from 'virtual:pwa-register';", 'const registerSW = window.mockRegisterSW;')
    .replaceAll('export ', '')
    .replaceAll('import.meta.env.PROD', 'true')
    .replaceAll('__APP_VERSION__', JSON.stringify('test'));
  await page.evaluate(() => {
    window.larria = { physics: { speed: 5 } };
    window.updateCalls = 0;
    window.mockRegisterSW = options => {
      window.pwaCallbacks = options;
      options.onRegisteredSW('sw.js', { waiting: {}, update: async () => {} });
      return async () => { window.updateCalls++; };
    };
  });
  await page.addScriptTag({ content: ts.transpile(source, { target: ts.ScriptTarget.ES2022 }) + '\ninitPwa(); initPwa();' });
}

test('updates require consent and stationary telemetry; external activation never auto reloads', async ({ page }) => {
  await mockedPwa(page);
  await expect(page.locator('#pwa-update')).toHaveCount(1);
  await page.evaluate(() => window.pwaCallbacks.onNeedRefresh());
  await expect(page.locator('#pwa-dialog')).not.toBeVisible();
  await page.locator('#pwa-update').click();
  await page.getByRole('button', { name: '停车后更新' }).click();
  expect(await page.evaluate(() => window.updateCalls)).toBe(0);
  await expect(page.locator('#pwa-dialog')).toContainText('仍在行驶');
  await page.evaluate(() => { window.larria.physics.speed = 0; });
  await page.getByRole('button', { name: '停车后更新' }).click();
  expect(await page.evaluate(() => window.updateCalls)).toBe(1);
  // The vehicle moves again while the new worker is activating.
  await page.evaluate(() => { window.larria.physics.speed = 3; window.pwaCallbacks.onNeedReload(); });
  await expect(page.locator('#pwa-dialog')).toContainText('页面尚未刷新');
  expect(page.url()).toContain('pwa-fixture.html');
  // Another tab's controller change without this tab's consent must not refresh it.
  await page.evaluate(() => { window.larria.physics.speed = 0; window.pwaCallbacks.onNeedReload(); });
  await expect(page.locator('#pwa-dialog')).toContainText('页面尚未刷新');
  expect(await page.evaluate(() => window.updateCalls)).toBe(1);
});

test('manual update errors and iOS installation fallback are clear', async ({ page }) => {
  await mockedPwa(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel' });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
  });
  await page.locator('#pwa-install').click();
  await expect(page.locator('#pwa-dialog')).toContainText('添加到主屏幕');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.evaluate(() => window.pwaCallbacks.onRegisteredSW('sw.js', {
    update: async () => { throw new Error('测试网络错误'); },
  }));
  await page.locator('#pwa-update').click();
  await expect(page.locator('#pwa-dialog')).toContainText('检查更新失败：测试网络错误');
});

test('manifest, installation UI, precached model and offline reload', async ({ page, context, request }) => {
  const manifest = await (await request.get('manifest.webmanifest')).json();
  expect(manifest.name).toBe('Larria的3d驾照考试练习场');
  expect(manifest.short_name).toBe('LARRIA');
  expect(manifest.scope).toBe('/car-drive-3d/');
  expect(manifest.icons.filter(icon => icon.purpose === 'maskable')).toHaveLength(2);
  await page.goto('./');
  await expect(page.locator('#pwa-install')).toBeAttached();
  await expect(page.locator('#pwa-update')).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(async () => {
    const cached = await caches.match('/car-drive-3d/models/ferrari.glb', { ignoreSearch: true });
    return Boolean(cached);
  })).toBe(true);
  await page.locator('#pwa-update').click();
  await expect(page.locator('#pwa-dialog')).toBeVisible();
  await expect(page.locator('#pwa-dialog')).toContainText('检查完成');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#pwa-update')).toBeVisible();
  const offlineResources = await page.evaluate(async () => {
    return Promise.all(['models/ferrari.glb', 'draco/draco_decoder.wasm', 'draco/draco_wasm_wrapper.js', 'draco/draco_decoder.js'].map(async path => {
      const response = await fetch(new URL(path, location.href));
      return { ok: response.ok, bytes: (await response.arrayBuffer()).byteLength };
    }));
  });
  expect(offlineResources.every(resource => resource.ok && resource.bytes > 1000)).toBe(true);
  await page.locator('#pwa-update').click();
  await expect(page.locator('#pwa-dialog')).toContainText('离线状态');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.waitForFunction(() => window.larria?.ready);
  await page.locator('[data-exam=select]').click();
  await page.locator('[data-exam=start]').click();
  await expect(page.locator('body')).toHaveAttribute('data-exam', 'running');
  await expect(page.locator('body')).toHaveAttribute('data-view', 'cockpit');
  await page.screenshot({path:'artifacts/exam-offline.png'});
});


test('running and paused exams block updates even at zero speed', async ({ page }) => {
  await mockedPwa(page);
  for (const state of ['running', 'paused']) {
    await page.evaluate(state => { document.body.dataset.exam = state; window.larria.physics.speed = 0; window.pwaCallbacks.onNeedRefresh(); window.pwaCallbacks.onNeedReload(); }, state);
    await expect(page.locator('#pwa-dialog')).not.toBeVisible();
    expect(await page.evaluate(() => isSafeToRefresh())).toBe(false);
    expect(page.url()).toContain('pwa-fixture.html');
  }
  await page.evaluate(() => { document.body.dataset.exam = 'projects'; });
  expect(await page.evaluate(() => isSafeToRefresh())).toBe(true);
});
