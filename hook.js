/*
 * hook.js — ISOLATED world
 *
 * 职责：
 *  1) 把扩展开关同步给页面内的 inject.js（MAIN world）
 *  2) 作为 popup 与 inject.js 的 RPC 桥：
 *     popup 发 chrome.runtime.message → 这里 → window.postMessage → inject.js
 *     inject.js 结果 → window.postMessage → 这里 → sendResponse 回 popup
 *
 * 这样所有网络请求都在页面上下文（Origin = https://www.yanhekt.cn）发出，
 * 避免从 chrome-extension:// 直接请求被服务端 403。
 */
(function () {
  const KEY = '__yhkt_unlock_enabled';
  const pending = new Map();
  let seq = 0;

  /* ---------- 1) 开关同步 ---------- */
  async function getEnabled() {
    try {
      const r = await chrome.storage.local.get(KEY);
      return r[KEY] !== false;
    } catch (e) {
      return true;
    }
  }

  getEnabled().then((enabled) => {
    document.dispatchEvent(new CustomEvent('__yhkt_config', { detail: { enabled } }));
  });

  /* ---------- 2) 接收 inject.js 的响应 ---------- */
  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.__yhkt_res !== true) return;
    const cb = pending.get(d.id);
    if (!cb) return;
    pending.delete(d.id);
    if (d.error) cb.reject(new Error(d.error));
    else cb.resolve(d.result);
  });

  /* 向页面 MAIN world 调用方法 */
  function callPage(method, args, timeoutMs) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error('页面响应超时（' + method + '）。请确认已登录并刷新页面。'));
        }
      }, timeoutMs || 20000);

      pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); }
      });

      window.postMessage({ __yhkt_req: true, id, method, args }, '*');
    });
  }

  /* ---------- 3) popup / background 的调用入口 ---------- */
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;

    if (msg.type === 'yhkt:set-enabled') {
      try { chrome.storage.local.set({ [KEY]: msg.enabled }); } catch (e) {}
      document.dispatchEvent(new CustomEvent('__yhkt_config', { detail: { enabled: msg.enabled } }));
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'yhkt:call') {
      callPage(msg.method, msg.args)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
      return true; // 异步响应
    }

    if (msg.type === 'yhkt:ping') {
      sendResponse({ ok: true, ready: true });
      return true;
    }
  });
})();
