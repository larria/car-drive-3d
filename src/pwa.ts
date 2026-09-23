import { registerSW } from 'virtual:pwa-register';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
type DrivingWindow = Window & {
  apex?: { physics?: { speed?: number } };
  larria?: { physics?: { speed?: number } };
};

// Missing telemetry is treated conservatively: never refresh an uninitialised scene.
export function isSafeToRefresh(): boolean {
  if (['running', 'paused'].includes(document.body.dataset.exam ?? '')) return false;
  const host = window as DrivingWindow;
  const speeds = [host.larria?.physics?.speed, host.apex?.physics?.speed]
    .filter((speed): speed is number => speed !== undefined);
  return speeds.length > 0 && speeds.every(speed => Number.isFinite(speed) && Math.abs(speed) < 0.05);
}

let initialized = false;
/** Call once after rendering the existing footer. Production builds require HTTPS (or localhost). */
export function initPwa(): void {
  if (initialized) return;
  const footer = document.querySelector('footer');
  if (!footer) throw new Error('initPwa() 必须在 footer 渲染完成后调用。');
  initialized = true;
  const container = footer.lastElementChild ?? footer;
  const install = document.createElement('button');
  install.type = 'button';
  install.id = 'pwa-install';
  install.textContent = '安装应用';
  const check = document.createElement('button');
  check.type = 'button';
  check.id = 'pwa-update';
  check.textContent = '检查更新';
  check.title = `当前版本 ${__APP_VERSION__}`;
  container.append(install, check);

  const dialog = document.createElement('dialog');
  dialog.id = 'pwa-dialog';
  dialog.setAttribute('aria-labelledby', 'pwa-dialog-title');
  const heading = document.createElement('h2');
  heading.id = 'pwa-dialog-title';
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.textContent = '停车后更新';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '关闭';
  close.onclick = () => dialog.close();
  dialog.append(heading, message, confirm, close);
  document.body.append(dialog);
  function tell(text: string, update = false, modal = true) {
    heading.textContent = update ? '发现应用更新' : '应用状态';
    message.textContent = text;
    confirm.hidden = !update;
    check.title = text;
    if (modal && !['running','paused'].includes(document.body.dataset.exam ?? '') && !dialog.open) dialog.showModal();
  }
  function errorText(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  let deferredInstall: InstallPrompt | undefined;
  const standalone = () => matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const syncInstall = () => { install.hidden = standalone(); };
  syncInstall();
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstall = event as InstallPrompt;
    syncInstall();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = undefined;
    install.hidden = true;
    tell('应用已安装。');
  });
  install.onclick = async () => {
    if (standalone()) { tell('应用已在独立窗口中运行。'); return; }
    if (!deferredInstall) {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      tell(ios ? '请在 Safari 中打开，轻点“分享”→“添加到主屏幕”。' :
        '暂时无法自动安装。请使用支持安装的浏览器，等待首次离线缓存完成后重试，或在浏览器菜单中选择“安装应用”。');
      return;
    }
    const prompt = deferredInstall;
    deferredInstall = undefined;
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      tell(outcome === 'accepted' ? '已接受安装，请按浏览器提示完成。' : '已取消安装，可稍后重试。');
    } catch (error) { tell(`安装失败：${errorText(error)}`); }
  };

  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) {
    check.onclick = () => tell('离线功能仅在生产构建的 HTTPS 或 localhost 环境中可用。');
    return;
  }
  let registration: ServiceWorkerRegistration | undefined;
  let registrationError = '';
  let waiting = false;
  let reloadPending = false;
  let consent = false;
  let reloading = false;
  let activating = false;
  let activationTimer: ReturnType<typeof setTimeout> | undefined;
  const updateMessage = '新版本已准备好。请先退出考试并停车，再点击“停车后更新”。更新会重新加载页面。';

  function reloadWithConsent() {
    // onNeedReload overrides the plugin's unconditional reload, including updates from other tabs.
    if (reloading) return;
    if (consent && isSafeToRefresh() && !document.hidden) {
      reloading = true;
      window.location.reload();
    } else {
      consent = false;
      tell('新版本已激活，但页面尚未刷新。请停车后确认更新。', true, !document.hidden && isSafeToRefresh());
    }
  }
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      waiting = true;
      check.textContent = '更新可用';
      tell(updateMessage, true, !document.hidden && isSafeToRefresh());
    },
    onNeedReload() {
      clearTimeout(activationTimer);
      activating = false;
      confirm.disabled = false;
      waiting = false;
      reloadPending = true;
      reloadWithConsent();
    },
    onOfflineReady() { check.title = '离线资源已缓存，下次可以离线练习。'; },
    onRegisteredSW(_url, value) {
      registration = value;
      registrationError = value ? '' : '浏览器未返回 Service Worker 注册信息。';
    },
    onRegisterError(error) {
      registrationError = errorText(error);
      tell(`离线服务注册失败：${registrationError}`, false, isSafeToRefresh());
    },
  });
  confirm.onclick = async () => {
    if (activating) return;
    if (!isSafeToRefresh()) { message.textContent = '车辆仍在行驶或驾驶状态未就绪。请完全停车后重试。'; return; }
    consent = true;
    if (reloadPending) { reloadWithConsent(); return; }
    if (!registration?.waiting) {
      consent = false;
      tell('暂时没有待激活版本，请重新检查更新。');
      return;
    }
    activating = true;
    confirm.disabled = true;
    message.textContent = '正在激活更新，请保持停车…';
    activationTimer = setTimeout(() => {
      consent = false;
      activating = false;
      confirm.disabled = false;
      tell('更新激活超时，页面未刷新。请检查连接后重试。', true);
    }, 15000);
    try { await updateSW(); } catch (error) {
      clearTimeout(activationTimer);
      activating = false;
      consent = false;
      confirm.disabled = false;
      tell(`更新失败：${errorText(error)}`, true);
    }
  };

  let checking = false;
  async function checkForUpdate(manual: boolean) {
    if (checking) return;
    if (!navigator.onLine) { if (manual) tell('当前处于离线状态，已缓存的练习仍可使用。联网后再检查更新。'); return; }
    if (!registration) {
      if (manual) tell(registrationError ? `离线服务不可用：${registrationError}` : '离线服务正在初始化，请稍后重试。');
      return;
    }
    if (reloadPending) { if (manual) tell('新版本已激活，请停车后确认刷新。', true); return; }
    checking = true;
    check.disabled = true;
    try {
      await registration.update();
      const worker = registration.installing;
      if (worker) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => { cleanup(); reject(new Error('下载更新超时，请稍后重试。')); }, 45000);
          const cleanup = () => { clearTimeout(timer); worker.removeEventListener('statechange', changed); };
          const changed = () => {
            if (worker.state === 'redundant') { cleanup(); reject(new Error('更新安装失败，原版本仍可使用。')); }
            else if (worker.state === 'installed' || worker.state === 'activated') { cleanup(); resolve(); }
          };
          worker.addEventListener('statechange', changed);
          changed();
        });
      }
      waiting = Boolean(registration.waiting);
      if (manual) tell(waiting ? updateMessage : `检查完成，当前已是最新版本（${__APP_VERSION__}）。`, waiting);
    } catch (error) {
      tell(`检查更新失败：${errorText(error)}`, false, manual);
    } finally {
      checking = false;
      check.disabled = false;
      check.textContent = waiting || reloadPending ? '更新可用' : '检查更新';
    }
  }
  check.onclick = () => { void checkForUpdate(true); };
  window.setInterval(() => { if (!document.hidden) void checkForUpdate(false); }, 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void checkForUpdate(false); });
}
