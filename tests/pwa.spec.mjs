import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function mockedPwa(page) {
  await page.route('**/pwa-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<footer><span>练习场</span></footer><button id="toast" role="status" hidden></button>' }));
  await page.goto('pwa-fixture.html');
  // Exercise the shipping stylesheet rather than a mocked layout.
  await page.addStyleTag({ content: readFileSync(new URL('../src/style.css', import.meta.url), 'utf8') });
  const source = readFileSync(new URL('../src/pwa.ts', import.meta.url), 'utf8')
    .replace("import { registerSW } from 'virtual:pwa-register';", 'const registerSW = window.mockRegisterSW;')
    .replace("import { createBusy } from './busy';", readFileSync(new URL('../src/busy.ts', import.meta.url), 'utf8'))
    .replaceAll('export ', '')
    .replaceAll('import.meta.env.PROD', 'true')
    .replaceAll('__APP_VERSION__', JSON.stringify('test'));
  await page.evaluate(() => {
    window.larria = { physics: { speed: 5 } };
    window.updateCalls = 0;
    window.mockRegisterSW = options => {
      window.pwaCallbacks = options;
      options.onRegisteredSW('sw.js', { waiting: {}, update: async () => {} });
      return async () => { window.updateCalls++; if (window.activationError) throw new Error(window.activationError); };
    };
  });
  await page.addScriptTag({ content: ts.transpile(source, { target: ts.ScriptTarget.ES2022 }) + `\nconst notify = text => {const toast = document.querySelector('#toast'); toast.hidden = false; toast.classList.add('show'); toast.textContent = text; toast.onclick = () => { toast.hidden = true; toast.classList.remove('show'); };}; initPwa(notify); initPwa(notify);` });
}

test('updates require consent and stationary telemetry; external activation never auto reloads', async ({ page }) => {
  await mockedPwa(page);
  await expect(page.locator('#pwa-update')).toHaveCount(1);
  await page.evaluate(() => window.pwaCallbacks.onNeedRefresh());
  await expect(page.locator('#pwa-dialog')).not.toBeVisible();
  await page.locator('#pwa-update').click();
  await expect(page.locator('#pwa-dialog')).not.toBeVisible();
  await page.evaluate(() => { window.larria.physics.speed = 0; document.body.dataset.exam = 'projects'; });
  await page.locator('#pwa-update').click();
  await page.evaluate(() => { window.larria.physics.speed = 5; });
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

for (const width of [320, 390, 1024]) test(`real CSS update actions and loading stay stable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 360 });
  await mockedPwa(page);
  await page.evaluate(() => { window.larria.physics.speed = 0; window.pwaCallbacks.onNeedRefresh(); });
  const actions = page.locator('.pwa-actions');
  const before = await actions.boundingBox();
  const buttons = await page.locator('.pwa-controls button').all();
  const first = await buttons[0].boundingBox();
  const second = await buttons[1].boundingBox();
  expect(first.y).toBe(second.y);
  expect(first.x + first.width).toBeLessThanOrEqual(second.x);
  await buttons[0].click();
  await expect(page.locator('.pwa-controls')).toBeHidden();
  await expect(actions.locator('.busy-status')).toBeVisible();
  await expect(page.locator('#pwa-dialog')).toHaveAttribute('aria-busy', 'true');
  const after = await actions.boundingBox();
  expect(after).toEqual(before);
  expect(after.y + after.height).toBeLessThanOrEqual(360);
  await page.evaluate(() => document.querySelector('.pwa-controls button').click());
  expect(await page.evaluate(() => window.updateCalls)).toBe(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await actions.locator('.busy-ring').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('activation errors and original timeout restore same-height controls', async ({ page }) => {
  await page.clock.install();
  await mockedPwa(page);
  await page.evaluate(() => { window.larria.physics.speed = 0; window.pwaCallbacks.onNeedRefresh(); });
  await page.getByRole('button', { name: '停车后更新' }).click();
  await page.clock.fastForward(15000);
  await expect(page.locator('#pwa-dialog')).toHaveAttribute('data-update-state', 'error');
  await expect(page.locator('#pwa-dialog')).toContainText('激活超时');
  await expect(page.getByRole('button', { name: '停车后更新' })).toBeEnabled();
  await page.evaluate(() => { window.activationError = '测试激活错误'; });
  await page.getByRole('button', { name: '停车后更新' }).click();
  await expect(page.locator('#pwa-dialog')).toContainText('更新失败：测试激活错误');
  await expect(page.getByRole('button', { name: '停车后更新' })).toBeEnabled();
});

test('hidden page blocks consent and activated waiting state remains escapable', async ({ page }) => {
  await mockedPwa(page);
  await page.evaluate(() => { window.larria.physics.speed = 0; window.pwaCallbacks.onNeedRefresh(); Object.defineProperty(document, 'hidden', { configurable: true, value: true }); });
  await page.getByRole('button', { name: '停车后更新' }).click();
  expect(await page.evaluate(() => window.updateCalls)).toBe(0);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });
  await page.getByRole('button', { name: '停车后更新' }).click();
  await page.evaluate(() => { document.body.dataset.exam = 'paused'; window.pwaCallbacks.onNeedReload(); });
  await expect(page.locator('.pwa-controls')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#pwa-dialog')).toBeHidden();
  await page.evaluate(() => { document.body.dataset.exam = 'projects'; });
  await page.locator('#pwa-update').click();
  await expect(page.getByRole('button', { name: '停车后更新' })).toBeVisible();
  expect(await page.evaluate(() => window.updateCalls)).toBe(1);
});

test('activation completed while hidden restores safe confirmation on visibility return without reload', async ({ page }) => {
  await mockedPwa(page);
  await page.evaluate(() => { window.larria.physics.speed = 0; window.pwaCallbacks.onNeedRefresh(); });
  await page.getByRole('button', { name: '停车后更新' }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    window.pwaCallbacks.onNeedReload();
  });
  await expect(page.locator('.pwa-controls')).toBeHidden();
  await expect(page.locator('#pwa-dialog')).toContainText('页面尚未刷新');
  await page.evaluate(() => {
    document.body.dataset.exam = 'paused';
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.pwa-controls')).toBeHidden();
  await page.evaluate(() => {
    document.body.dataset.exam = 'projects';
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#pwa-dialog')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('button', { name: '停车后更新' })).toBeVisible();
  await expect(page.locator('#pwa-dialog')).toContainText('请确认');
  expect(page.url()).toContain('pwa-fixture.html');
  expect(await page.evaluate(() => window.updateCalls)).toBe(1);
});

test('manual update errors and iOS installation fallback are clear', async ({ page }) => {
  await mockedPwa(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel' });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
  });
  await page.locator('#pwa-install').click();
  await expect(page.locator('#toast')).toContainText('添加到主屏幕');
  await expect(page.locator('#pwa-dialog')).not.toBeVisible();
  await page.locator('#toast').click();await expect(page.locator('#toast')).toBeHidden();
  await page.evaluate(() => window.pwaCallbacks.onRegisteredSW('sw.js', {
    update: async () => { throw new Error('测试网络错误'); },
  }));
  await page.locator('#pwa-update').click();
  await expect(page.locator('#toast')).toContainText('检查更新失败：测试网络错误');
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
  await expect(page.locator('#toast')).toContainText('检查完成');
  await expect(page.locator('#pwa-dialog')).not.toBeVisible();
  await page.locator('#toast').click();await expect(page.locator('#toast')).not.toHaveClass(/show/);
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
  await expect(page.locator('#toast')).toContainText('离线状态');
  await page.locator('#toast').click();await expect(page.locator('#toast')).not.toHaveClass(/show/);
  await page.waitForFunction(() => window.larria?.ready);
  await page.locator('[data-exam="select:practice"]').click();
  await page.locator('[data-exam=start]').click();
  await expect(page.locator('body')).toHaveAttribute('data-exam', 'running');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'practice');
  await expect(page.locator('body')).toHaveAttribute('data-view', 'cockpit');
  await page.screenshot({path:'artifacts/practice-offline.png'});
  await page.locator('[data-exam="exit"]:visible').click();
  await page.locator('[data-exam="select:s-curve"]').click();
  await expect(page.locator('.briefing-page h1')).toHaveText('曲线行驶');
  await page.locator('[data-exam="start"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-view','cockpit');
  expect(await page.evaluate(()=>window.larria.session.rules.course.boundaries.length)).toBe(196);
  await page.screenshot({path:'artifacts/s-offline.png'});
});


test('running and paused exams and practice block updates even at zero speed', async ({ page }) => {
  await mockedPwa(page);
  for (const mode of ['exam','practice']) for (const state of ['running', 'paused']) {
    await page.evaluate(({state,mode}) => { document.body.dataset.mode=mode;document.body.dataset.exam = state; window.larria.physics.speed = 0; window.pwaCallbacks.onNeedRefresh(); window.pwaCallbacks.onNeedReload(); }, {state,mode});
    await expect(page.locator('#pwa-dialog')).not.toBeVisible();
    expect(await page.evaluate(() => isSafeToRefresh())).toBe(false);
    expect(page.url()).toContain('pwa-fixture.html');
  }
  await page.evaluate(() => { document.body.dataset.exam = 'projects'; });
  expect(await page.evaluate(() => isSafeToRefresh())).toBe(true);
});
