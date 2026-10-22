/* Shared directory: data only, explicit import/update, independent of personal scan storage. */
(() => {
  'use strict';
  const ROOT = 'https://raw.githubusercontent.com/Disc13/yanhekt-catalog/main/';
  const ORIGIN = 'https://raw.githubusercontent.com/*';
  const COLUMNS = ['id', 'name', 'code', 'year', 'semester', 'college', 'visibility', 'state', 'listed'];
  const MAX_BYTES = 25 * 1024 * 1024;
  function normalize(input) {
    if (!input || !input.metadata || !Array.isArray(input.courses) ||
        input.courses.length < 1 || input.courses.length > 150000 ||
        input.metadata.recordCount !== input.courses.length) throw new Error('目录条数或格式不正确');
    const compact = input.schemaVersion === 1;
    if (input.schemaVersion !== undefined && !compact) throw new Error('不支持的目录版本');
    if (compact && JSON.stringify(input.columns) !== JSON.stringify(COLUMNS)) throw new Error('目录字段不匹配');
    const seen = new Set();
    const courses = input.courses.map(row => {
      if (compact && (!Array.isArray(row) || row.length !== 9)) throw new Error('目录行格式不正确');
      const c = compact ? Object.fromEntries(COLUMNS.map((key, i) => [key, row[i]])) : row;
      if (!c || !Number.isSafeInteger(c.id) || c.id < 1 || seen.has(c.id)) throw new Error('课程 ID 无效或重复');
      seen.add(c.id);
      for (const key of ['name', 'code', 'year', 'college']) {
        if (typeof c[key] !== 'string' || c[key].length > 1000) throw new Error('课程文本字段无效');
      }
      for (const key of ['semester', 'visibility', 'state']) {
        if (c[key] !== null && !Number.isSafeInteger(c[key])) throw new Error('课程数值字段无效');
      }
      if (![true, false, 0, 1].includes(c.listed)) throw new Error('列表标记无效');
      return { id: c.id, name: c.name, code: c.code, year: c.year, semester: c.semester,
        college: c.college, visibility: c.visibility, state: c.state, listed: !!c.listed };
    });
    const date = input.metadata.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('目录日期无效');
    return { metadata: { date, recordCount: courses.length }, courses };
  }
  async function db() {
    if (typeof indexedDB === 'undefined') throw new Error('当前环境不支持目录存储');
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('yanhekt-shared-catalog', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('snapshots');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('目录存储被占用，请关闭其他目录管理页后重试'));
    });
  }
  async function transaction(mode, action) {
    const database = await db();
    try {
      return await new Promise((resolve, reject) => {
        const tx = database.transaction('snapshots', mode);
        const req = action(tx.objectStore('snapshots'));
        tx.oncomplete = () => resolve(req.result || null);
        tx.onabort = tx.onerror = () => reject(tx.error || new Error('目录保存失败'));
      });
    } finally { database.close(); }
  }
  const load = () => transaction('readonly', store => store.get('current'));
  const save = input => { const value = normalize(input); return transaction('readwrite', store => store.put(value, 'current')); };
  const remove = () => transaction('readwrite', store => store.delete('current'));
  function merge(shared, personal) {
    const byId = new Map((shared ? shared.courses : []).map(c => [c.id, { ...c, _fromShared: true }]));
    personal.forEach(c => { const old = byId.get(c.id); byId.set(c.id, { ...old, ...c,
      code: c.code || (old && old.code) || '', _fromCache: true }); });
    return [...byId.values()].sort((a, b) => b.id - a.id);
  }
  function search(items, keyword, year, semester) {
    const words = String(keyword || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter(c => (!year || c.year === year) && (!semester || String(c.semester) === String(semester)) &&
      words.every(w => [c.id, c.name, c.code, c.year, c.college].join(' ').toLowerCase().includes(w)));
  }
  async function download(path, limit) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(ROOT + path, { signal: controller.signal, credentials: 'omit',
        referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error' });
      if (!response.ok) throw new Error('GitHub 下载失败：HTTP ' + response.status);
      const reader = response.body.getReader();
      const chunks = []; let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); throw new Error('目录文件过大'); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      chunks.forEach(c => { bytes.set(c, offset); offset += c.byteLength; });
      return bytes;
    } finally { clearTimeout(timer); }
  }
  async function update() {
    const decoder = new TextDecoder();
    const manifest = JSON.parse(decoder.decode(await download('catalog-manifest.json', 16384)));
    if (manifest.schemaVersion !== 1 || manifest.dataPath !== 'data/catalog.json' ||
        !Number.isSafeInteger(manifest.byteLength) || manifest.byteLength < 1 || manifest.byteLength > MAX_BYTES ||
        typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sha256)) throw new Error('更新清单无效');
    const bytes = await download('data/catalog.json', MAX_BYTES);
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
    if (bytes.length !== manifest.byteLength || digest !== manifest.sha256) throw new Error('目录完整性校验失败，请稍后重试');
    const value = normalize(JSON.parse(decoder.decode(bytes)));
    if (value.metadata.recordCount !== manifest.recordCount || value.metadata.date !== manifest.date) throw new Error('目录与更新清单不一致');
    await save(value);
    return value;
  }
  globalThis.YhktCatalog = { normalize, load, save, remove, merge, search, update, MAX_BYTES, ORIGIN };
})();
