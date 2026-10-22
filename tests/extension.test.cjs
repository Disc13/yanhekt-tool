const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function surface() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    dispatchEvent(event) {
      for (const callback of listeners.get(event.type) || []) callback(event);
    },
  };
}

function page(body = { code: 0, data: [] }) {
  const requests = [], replies = [];
  const window = {
    ...surface(),
    fetch: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify(body), { status: 200 });
    },
    XMLHttpRequest: function () {},
    postMessage: message => replies.push(message),
  };
  const context = vm.createContext({
    window, document: {},
    localStorage: { getItem: () => null }, location: { origin: 'https://www.yanhekt.cn' },
    URL, Headers, Response, setTimeout, clearTimeout, console,
  });
  vm.runInContext(read('inject.js'), context);
  return { window, requests, replies, context };
}

test('MD5 agrees with the standard implementation, including the downloader path formula', () => {
  const source = read('inject.js');
  const md5 = source.slice(source.indexOf('  function md5('), source.indexOf('  const getToken'));
  const context = vm.createContext({});
  vm.runInContext(md5, context);
  for (const value of ['', 'abc', '1138b69dfef641d9d7ba49137d2d4875_100']) {
    assert.equal(vm.runInContext(`md5(${JSON.stringify(value)})`, context),
      crypto.createHash('md5').update(value).digest('hex'));
  }
});

test('disabled extension rejects RPC before issuing network requests', async () => {
  const app = page();
  app.window.dispatchEvent({ type: '__yhkt_config', detail: { enabled: false } });
  app.window.dispatchEvent({ type: 'message', source: app.window,
    data: { __yhkt_req: true, id: 1, method: 'courseList', args: {} } });
  await tick();
  assert.equal(app.requests.length, 0);
  assert.match(app.replies[0].error, /关闭/);
});

test('API business errors are preserved instead of becoming empty successful results', async () => {
  const app = page({ code: 403, message: 'fixture denied', data: null });
  await assert.rejects(app.window.__yhkt.sessions(123), /fixture denied/);
});

test('response adaptation never rewrites an upstream error into code zero', async () => {
  const app = page({ code: 403, message: 'fixture denied', data: null });
  const response = await app.window.fetch('https://cbiz.yanhekt.cn/v2/course/session/list?course_id=123');
  assert.equal((await response.json()).code, 403);
});

test('removed player and direct-link RPCs are unavailable and cannot make requests', async () => {
  const app = page();
  for (const method of ['play', 'directUrl']) {
    app.window.dispatchEvent({ type: 'message', source: app.window,
      data: { __yhkt_req: true, id: method, method, args: { videoId: 1 } } });
  }
  await tick();
  assert.equal(app.requests.length, 0);
  assert.equal(app.replies.length, 2);
  for (const reply of app.replies) assert.match(reply.error, /未知方法/);
});

test('a session opens the native site page without invoking extension playback', async () => {
  const elements = new Map(), tabs = [];
  function element() {
    return { children: [], classList: { toggle() {} }, value: '', checked: true,
      addEventListener() {}, appendChild(child) { this.children.push(child); } };
  }
  const context = vm.createContext({
    document: {
      createElement: element, querySelectorAll: () => [],
      getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }
    },
    chrome: {
      storage: { local: { get: async () => ({ __yhkt_unlock_enabled: true }) } },
      tabs: { query: async () => [], create: options => { tabs.push(options); } },
    },
    setTimeout, clearTimeout, console,
  });
  vm.runInContext(read('popup.js'), context);
  await tick();
  const card = context.sessionCard({ id: 42, title: 'fixture' });
  const actions = card.children[0];
  assert.equal(actions.children.length, 1);
  assert.equal(actions.children[0].textContent, '打开原站课时');
  actions.children[0].onclick();
  assert.equal(tabs[0].url, 'https://www.yanhekt.cn/session/42');
});

test('bridge installs once and sends configuration to window, including storage changes', async () => {
  const window = surface(), events = [], runtimeListeners = [], storageListeners = [];
  window.addEventListener('__yhkt_config', event => events.push(event.detail.enabled));
  const context = vm.createContext({ window, document: surface(),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    chrome: {
      storage: { local: { get: async () => ({ __yhkt_unlock_enabled: false }) },
        onChanged: { addListener: callback => storageListeners.push(callback) } },
      runtime: { onMessage: { addListener: callback => runtimeListeners.push(callback) } },
    }, setTimeout, clearTimeout, console });
  vm.runInContext(read('hook.js'), context);
  vm.runInContext(read('hook.js'), context);
  await tick();
  assert.equal(runtimeListeners.length, 1);
  assert.deepEqual(events, [false]);
  storageListeners[0]({ __yhkt_unlock_enabled: { newValue: true } }, 'local');
  assert.deepEqual(events, [false, true]);
});

test('extension update preserves an existing disabled preference', async () => {
  let installed, writes = [];
  const context = vm.createContext({ chrome: {
    runtime: { onInstalled: { addListener: callback => { installed = callback; } } },
    storage: { local: {
      get: async () => ({ __yhkt_unlock_enabled: false }),
      set: async value => writes.push(value),
    } },
  } });
  vm.runInContext(read('background.js'), context);
  await installed({ reason: 'update' });
  await tick();
  assert.equal(writes.length, 0);
});
