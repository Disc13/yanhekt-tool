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
      const value = typeof body === 'function' ? await body(url, options) : body;
      return value instanceof Response ? value : new Response(JSON.stringify(value), { status: 200 });
    },
    XMLHttpRequest: function () {},
    postMessage: message => replies.push(message),
  };
  const context = vm.createContext({
    window, document: {},
    localStorage: { getItem: () => null }, location: { origin: 'https://www.yanhekt.cn' },
    URL, URLSearchParams, Headers, Response, AbortController, setTimeout, clearTimeout, console,
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

test('unused direct-link and video-info RPCs cannot expose signed URLs', async () => {
  const app = page();
  for (const method of ['videoInfo', 'directUrl']) {
    app.window.dispatchEvent({ type: 'message', source: app.window,
      data: { __yhkt_req: true, id: method, method, args: { videoId: 1 } } });
  }
  await tick();
  assert.equal(app.requests.length, 0);
  assert.equal(app.replies.length, 2);
  for (const reply of app.replies) assert.match(reply.error, /未知方法/);
});

function popup(storage = {}) {
  const elements = new Map(), tabs = [];
  function element() {
    return { children: [], style: {}, textContent: '', classList: { toggle() {}, remove() {}, add() {}, contains() { return false; } },
      set innerHTML(value) { this.html = value; this.children = []; }, get innerHTML() { return this.html || ''; },
      value: '', checked: true, querySelectorAll: () => [],
      addEventListener() {}, appendChild(child) { this.children.push(child); } };
  }
  const context = vm.createContext({
    document: {
      createElement: element, querySelectorAll: () => [], addEventListener() {},
      getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }
    },
    chrome: {
      storage: { local: {
        get: async () => ({ __yhkt_unlock_enabled: true, ...storage }),
        set: async entries => Object.assign(storage, JSON.parse(JSON.stringify(entries))),
        remove: async keys => keys.forEach(key => delete storage[key]),
      } },
      tabs: { query: async () => [], create: options => { tabs.push(options); } },
    },
    setTimeout, clearTimeout, console,
  });
  vm.runInContext(read('catalog.js'), context);
  context.YhktCatalog.load = async () => null;
  vm.runInContext(read('popup.js'), context);
  return { context, elements, tabs, storage };
}

test('shared catalogue validates full and compact formats, strips extra fields and rejects duplicate IDs', () => {
  const context = vm.createContext({});
  vm.runInContext(read('catalog.js'), context);
  const c = context.YhktCatalog;
  const row = { id: 1, name: '数学', code: 'M1', year: '2025-2026', semester: 1, college: '学院', visibility: 2, state: 1, listed: false, token: 'never keep', courseUrl: 'https://evil.invalid' };
  const full = { metadata: { date: '2026-10-22', recordCount: 1 }, courses: [row] };
  assert.equal(c.normalize(full).courses[0].token, undefined);
  assert.equal(c.normalize(full).courses[0].courseUrl, undefined);
  const columns = ['id', 'name', 'code', 'year', 'semester', 'college', 'visibility', 'state', 'listed'];
  const compact = { ...full, schemaVersion: 1, columns, courses: [columns.map(k => k === 'listed' ? 0 : row[k])] };
  assert.equal(c.normalize(compact).courses[0].id, 1);
  assert.throws(() => c.normalize({ ...full, metadata: { ...full.metadata, recordCount: 2 }, courses: [row, row] }), /重复/);
  assert.throws(() => c.normalize({ ...full, metadata: { ...full.metadata, recordCount: 99 } }), /条数/);
  assert.throws(() => c.normalize({ ...compact, schemaVersion: 2 }), /版本/);
  assert.throws(() => c.normalize({ ...full, courses: [{ ...row, id: '<script>' }] }), /ID/);
});

test('shared baseline merges by ID without losing code or overwriting personal storage', async () => {
  const app = popup({ scan_cache_2025: 'fixture' });
  await tick();
  const c = app.context.YhktCatalog;
  const shared = { courses: [{ id: 1, name: '旧名', code: 'M1', year: '2025-2026' }, { id: 2, name: '物理' }] };
  const rows = c.merge(shared, [{ id: 1, name: '数学', year: '2025-2026', semester: 1 }]);
  assert.equal(rows.length, 2);
  assert.equal(rows.find(r => r.id === 1).code, 'M1');
  assert.equal(c.search(rows, '数学 M1', '2025-2026', '1').length, 1);
  assert.equal(app.storage.scan_cache_2025, 'fixture');
});

test('empty keyword shows all local matches in 50-row pages without a site tab or network', async () => {
  const app = popup(); await tick();
  app.context.YhktCatalog.load = async () => ({ metadata: { recordCount: 121, date: '2026-10-22' },
    courses: Array.from({ length: 121 }, (_, i) => ({ id: i + 1, name: '课程' + i })) });
  app.context.call = async () => { throw new Error('must remain offline'); };
  await app.context.loadCourses(1);
  assert.equal(app.elements.get('courses').children.length, 50);
  assert.match(app.elements.get('pageInfo').textContent, /121.*1\/3/);
  await app.context.loadCourses(3);
  assert.equal(app.elements.get('courses').children.length, 21);
  assert.equal(app.elements.get('btn-next').disabled, true);
});

test('catalogue update checks hashes before opening storage and never sends credentials', async () => {
  const requests = [];
  const payload = new TextEncoder().encode('{}');
  const manifest = { schemaVersion: 1, dataPath: 'data/catalog.json', sha256: '0'.repeat(64), byteLength: payload.length };
  const context = vm.createContext({ TextDecoder, AbortController, setTimeout, clearTimeout,
    crypto: crypto.webcrypto, fetch: async (url, options) => {
      requests.push({ url, options });
      return new Response(url.endsWith('catalog-manifest.json') ? JSON.stringify(manifest) : payload);
    } });
  vm.runInContext(read('catalog.js'), context);
  assert.equal(requests.length, 0);
  await assert.rejects(context.YhktCatalog.update(), /完整性/);
  assert.equal(requests.length, 2);
  for (const r of requests) { assert.equal(r.options.credentials, 'omit'); assert.equal(r.options.redirect, 'error'); assert.match(r.url, /^https:\/\/raw.githubusercontent.com\/Disc13\/yanhekt-catalog\/main\//); }
});

test('catalogue storage commits separately, abort preserves old snapshot, removal leaves personal cache', async () => {
  let snapshot = null, failWrite = false;
  const personal = { scan_cache_2025: ['keep'] };
  const indexedDB = { open(name) {
    assert.equal(name, 'yanhekt-shared-catalog');
    const open = {};
    open.result = { close() {}, transaction(store, mode) {
      assert.equal(store, 'snapshots');
      const tx = { objectStore() {
        return { get() { return { result: snapshot }; }, put(value) {
          const req = { result: 'current' };
          tx.pending = value; return req;
        }, delete() { tx.pending = null; return {}; } };
      } };
      setImmediate(() => {
        if (mode === 'readwrite' && failWrite) { tx.error = new Error('quota fixture'); tx.onabort(); }
        else { if (mode === 'readwrite') snapshot = tx.pending; tx.oncomplete(); }
      });
      return tx;
    } };
    setImmediate(() => open.onsuccess());
    return open;
  } };
  const context = vm.createContext({ indexedDB });
  vm.runInContext(read('catalog.js'), context);
  const c = context.YhktCatalog;
  const input = { metadata: { date: '2026-10-22', recordCount: 1 }, courses: [
    { id: 1, name: '数学', code: 'M', year: '2025-2026', semester: 1, college: '', visibility: 2, state: 1, listed: false }] };
  assert.equal(await c.load(), null);
  await c.save(input);
  assert.equal((await c.load()).courses[0].id, 1);
  failWrite = true;
  await assert.rejects(c.save({ ...input, courses: [{ ...input.courses[0], id: 2 }] }), /quota/);
  assert.equal((await c.load()).courses[0].id, 1);
  failWrite = false; await c.remove();
  assert.equal(await c.load(), null);
  assert.deepEqual(personal, { scan_cache_2025: ['keep'] });
});

test('declining optional GitHub permission never downloads data', async () => {
  const elements = new Map();
  let updates = 0;
  const context = vm.createContext({ document: { getElementById(id) {
    if (!elements.has(id)) elements.set(id, {}); return elements.get(id);
  } }, chrome: { permissions: { request: async () => false } },
  YhktCatalog: { ORIGIN: 'https://raw.githubusercontent.com/*', load: async () => null, update: async () => { updates++; } } });
  vm.runInContext(read('catalog-manager.js'), context);
  elements.get('update').onclick(); await tick();
  assert.equal(updates, 0);
  assert.match(elements.get('status').textContent, /未授予/);
});

test('native session entry remains available alongside optional single-stream playback', async () => {
  const { context, tabs } = popup();
  await tick();
  const card = context.sessionCard({ id: 42, videoId: 9, title: 'fixture' });
  const actions = card.children[0];
  assert.equal(actions.children.length, 2);
  assert.equal(actions.children[1].textContent, '打开原站课时');
  actions.children[1].onclick();
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

test('original site tags and course-list requests are not rewritten', async () => {
  const app = page();
  for (const endpoint of ['/v1/tag/list', '/v2/course/list?semesters[]=110&semesters[]=85']) {
    const url = 'https://cbiz.yanhekt.cn' + endpoint;
    await app.window.fetch(url);
    assert.equal(app.requests.at(-1).url, url);
  }
  assert.equal(app.requests.length, 2);
});

test('popup semester search uses the selected v1 tag', async () => {
  const app = page({ code: 0, data: { data: [], total: 0 } });
  app.window.dispatchEvent({ type: 'message', source: app.window,
    data: { __yhkt_req: true, id: 1, method: 'courseList', args: { semesterId: 85, keyword: 'fixture' } } });
  await tick();
  const url = new URL(app.requests[0].url);
  assert.equal(url.pathname, '/v1/course/list');
  assert.equal(url.searchParams.get('semesters[]'), '85');
  assert.equal(url.searchParams.get('keyword'), 'fixture');
});

test('disabled playback cannot fetch media credentials', async () => {
  const app = page();
  app.window.dispatchEvent({ type: '__yhkt_config', detail: { enabled: false } });
  app.window.dispatchEvent({ type: 'message', source: app.window,
    data: { __yhkt_req: true, id: 1, method: 'play', args: { videoId: 1 } } });
  await tick();
  assert.equal(app.requests.length, 0);
  assert.match(app.replies[0].error, /关闭/);
});

test('player returns confirmation rather than credential-bearing URL', async () => {
  const app = page();
  app.window.__yhkt.openPlayer = async () => ({ opened: true });
  app.window.dispatchEvent({ type: 'message', source: app.window,
    data: { __yhkt_req: true, id: 1, method: 'play', args: { videoId: 1 } } });
  await tick();
  assert.equal(app.replies[0].result.opened, true);
  assert.equal(app.replies[0].result.url, undefined);
  assert.doesNotMatch(read('inject.js'), /cdn\.jsdelivr|unpkg\.com|s\.textContent = code/);
  assert.match(read('popup.js'), /files: \['vendor\/hls.min.js'\]/);
});

test('scan batch is bounded and rejects HTTP errors instead of skipping IDs', async () => {
  const app = page();
  app.window.dispatchEvent({ type: 'message', source: app.window,
    data: { __yhkt_req: true, id: 1, method: 'scanBatch', args: { start: 1, end: 1000, limit: 200 } } });
  await tick();
  assert.equal(app.requests.length, 200);
  assert.equal(app.replies[0].result.next, 201);
  const denied = page({ code: 403, message: 'fixture denied' });
  denied.window.dispatchEvent({ type: 'message', source: denied.window,
    data: { __yhkt_req: true, id: 1, method: 'scanBatch', args: { start: 1, end: 2 } } });
  await tick();
  assert.match(denied.replies[0].error, /fixture denied/);
  assert.equal(denied.replies[0].result, undefined);
});

test('100 and 200 ID batches keep active requests bounded to 20', async () => {
  for (const limit of [100, 200, 1000]) {
    let active = 0, peak = 0;
    const app = page(async () => {
      peak = Math.max(peak, ++active);
      await tick();
      active--;
      return { code: 0, data: null };
    });
    app.window.dispatchEvent({ type: 'message', source: app.window,
      data: { __yhkt_req: true, id: 1, method: 'scanBatch', args: { start: 1, end: 1000, limit } } });
    for (let i = 0; i < 30 && !app.replies.length; i++) await tick();
    assert.equal(app.requests.length, Math.min(limit, 200));
    assert.equal(app.replies[0].result.scanned, Math.min(limit, 200));
    assert.ok(peak <= 20, 'must not launch 200 simultaneous requests');
  }
});

test('scan dropdown restores saved 200 ID batch without changing cache', async () => {
  const cached = { items: [{ id: 1 }], lastId: 1 };
  const app = popup({ scan_batch_size: 200, 'scan_cache_2025-2026__partial': cached });
  await tick();
  assert.equal(app.elements.get('dd-scan-batch-label').textContent, '200 条 / 批');
  assert.equal(vm.runInContext('scanBatchSize', app.context), 200);
  assert.equal(app.storage['scan_cache_2025-2026__partial'], cached);
});

function setScanTarget(context, end = 40) {
  vm.runInContext(`scanTarget = { year: 'fixture', start: 1, end: ${end} };`, context);
}

test('stopping preserves a partial checkpoint and does not display 100 percent', async () => {
  const app = popup();
  await tick();
  setScanTarget(app.context);
  app.context.call = async (method, args) => {
    assert.equal(method, 'scanBatch');
    app.elements.get('btn-scan-stop').onclick();
    return { items: [{ id: 1, year: 'fixture', name: 'fixture' }], scanned: 20, next: 21 };
  };
  await app.context.startScan();
  const checkpoint = app.storage.scan_cache_fixture__partial;
  assert.equal(checkpoint.lastId, 20);
  assert.equal(checkpoint.complete, false);
  assert.equal(app.elements.get('scan-bar').style.width, '50%');
  assert.match(app.elements.get('status').textContent, /已停止/);
  assert.equal(app.elements.get('dd-scan-year-btn').disabled, false);
});

test('scan resumes from a saved cursor and promotes only completed ranges', async () => {
  const app = popup({ scan_cache_fixture__partial: {
    start: 1, end: 2, lastId: 1, items: [{ id: 1, year: 'fixture' }], complete: false,
  } });
  await tick();
  setScanTarget(app.context, 2);
  app.context.call = async (_, args) => {
    assert.equal(args.start, 2);
    return { items: [{ id: 2, year: 'fixture' }], scanned: 1, next: 3 };
  };
  await app.context.startScan();
  assert.equal(app.storage.scan_cache_fixture.items.length, 2);
  assert.equal(app.storage.scan_cache_fixture.complete, true);
  assert.equal(app.storage.scan_cache_fixture__partial, undefined);
});

test('storage failure is visible and scanning controls are restored', async () => {
  const app = popup();
  await tick();
  setScanTarget(app.context, 1);
  app.context.chrome.storage.local.set = async () => { throw new Error('quota fixture'); };
  app.context.call = async () => ({ items: [], scanned: 1, next: 2 });
  await app.context.startScan();
  assert.match(app.elements.get('status').textContent, /未能保存新进度/);
  assert.equal(app.elements.get('status').className, 'err');
  assert.equal(app.elements.get('btn-scan').disabled, false);
});

test('failed scan batch keeps the previous cursor for retry', async () => {
  const app = popup({ scan_cache_fixture__partial: {
    start: 1, end: 2, lastId: 1, items: [{ id: 1, year: 'fixture' }], complete: false,
  } });
  await tick();
  setScanTarget(app.context, 2);
  app.context.call = async () => { throw new Error('HTTP 429 fixture'); };
  await app.context.startScan();
  assert.equal(app.storage.scan_cache_fixture__partial.lastId, 1);
  assert.equal(app.storage.scan_cache_fixture, undefined);
  assert.match(app.elements.get('status').textContent, /未完成/);
});

test('selected semester still searches matching local cached courses', async () => {
  const app = popup({ scan_cache_2025: {}, 'scan_cache_2025-2026__partial': {
    items: [
      { id: 1, name: 'fixture optics', year: '2025-2026', semester: 1 },
      { id: 2, name: 'fixture optics', year: '2025-2026', semester: 2 },
    ], complete: false,
  } });
  await tick();
  vm.runInContext('selectedSemester = 100;', app.context);
  app.elements.get('kw').value = 'optics';
  app.context.call = async () => ({ list: [], total: 0, lastPage: 1 });
  await app.context.loadCourses(1);
  const rows = app.elements.get('courses').children;
  assert.equal(rows.length, 1);
  assert.match(rows[0].innerHTML, /ID 1/);
});

test('bundled playback library has the pinned version and checksum', () => {
  const Hls = require('../vendor/hls.min.js');
  assert.equal(Hls.version, '1.5.13');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../vendor/hls.min.js'))).digest('hex');
  assert.equal(hash, 'e5753b10fc65eae35f21883e684d22c43ce66de968d35166792585b9b8a3f1a2');
});

test('single-stream player cleans up its engine and does not return its signed URL', async () => {
  const app = page();
  const created = [];
  let destroyed = 0;
  app.context.document.getElementById = () => null;
  app.context.document.createElement = tag => {
    const node = { tag, children: [], style: {}, appendChild(child) { this.children.push(child); },
      remove() {}, pause() {}, removeAttribute() {}, load() {}, play: async () => {} };
    created.push(node);
    return node;
  };
  app.context.document.body = { appendChild() {} };
  app.window.Hls = class {
    static isSupported() { return true; }
    static Events = { ERROR: 'error', MANIFEST_PARSED: 'parsed' };
    on() {} loadSource() {} attachMedia() {} destroy() { destroyed++; }
  };
  app.window.__yhkt.videoToken = async () => 'fixture-only-token';
  app.window.__yhkt.videoUrl = async () => 'https://cvideo.yanhekt.cn/fixture/Video1.m3u8';
  const result = await app.window.__yhkt.openPlayer(1, 'fixture');
  assert.equal(result.opened, true);
  assert.equal(result.url, undefined);
  created.find(node => node.tag === 'button').onclick();
  assert.equal(destroyed, 1);
});

test('play request is sent before changing the active tab can close the popup', async () => {
  const app = popup();
  await tick();
  const events = [];
  app.context.ensureReady = async () => 7;
  app.context.chrome.scripting = { executeScript: async () => events.push('inject-local') };
  app.context.chrome.tabs.sendMessage = async () => { events.push('play'); return { ok: true }; };
  app.context.chrome.tabs.update = async () => events.push('activate');
  await app.context.playSession(1, 2, 'fixture');
  assert.deepEqual(events, ['inject-local', 'play', 'activate']);
});
