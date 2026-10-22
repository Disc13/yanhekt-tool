/*
 * popup.js
 * 所有网络请求委托给页面内 inject.js（MAIN world），避免 chrome-extension:// Origin 被 403。
 */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

let curPage = 1;
let siteTabId = null;
let sessionLoadToken = 0;
let courseLoadToken = 0;

function setStatus(t, cls) {
  $('status').textContent = t;
  $('status').className = cls || '';
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + name));
}

/* ---------------- 站点标签页 / RPC ---------------- */
async function findSiteTab() {
  const tabs = await chrome.tabs.query({ url: 'https://www.yanhekt.cn/*' });
  if (!tabs.length) return null;
  // 优先当前窗口里激活的站点页；popup 自身不是标签页，不受影响
  return tabs.find((t) => t.active) || tabs[0];
}

async function ensureSiteTab() {
  let tab = await findSiteTab();
  if (tab) return tab;
  tab = await chrome.tabs.create({ url: 'https://www.yanhekt.cn/home', active: false });
  await new Promise((r) => setTimeout(r, 3500));
  return tab;
}

async function ensureReady() {
  const tab = await ensureSiteTab();
  siteTabId = tab.id;
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { type: 'yhkt:ping' });
    if (r && r.ok) return tab.id;
  } catch (e) {}
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['inject.js'], world: 'MAIN' });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['hook.js'], world: 'ISOLATED' });
  } catch (e) {}
  await new Promise((r) => setTimeout(r, 800));
  const r2 = await chrome.tabs.sendMessage(tab.id, { type: 'yhkt:ping' }).catch(() => null);
  if (r2 && r2.ok) return tab.id;
  throw new Error('页面脚本未就绪，请刷新 www.yanhekt.cn 后重试');
}

async function call(method, args) {
  const tabId = await ensureReady();
  const res = await chrome.tabs.sendMessage(tabId, { type: 'yhkt:call', method, args: args || {} });
  if (!res) throw new Error('页面无响应');
  if (!res.ok) throw new Error(res.error || '未知错误');
  return res.result;
}

/* ---------------- 自绘下拉 ---------------- */
function buildDropdown(rootId, btnId, labelId, listId, items, onPick) {
  const list = $(listId), btn = $(btnId), label = $(labelId);
  list.innerHTML = '';
  items.forEach((it) => {
    const d = document.createElement('div');
    d.className = 'dd-item' + (it.selected ? ' sel' : '');
    d.textContent = it.label;
    d.onclick = (e) => {
      e.stopPropagation();
      if (btn.disabled) return;
      label.textContent = it.label;
      list.classList.remove('open');
      list.querySelectorAll('.dd-item').forEach((x) => x.classList.remove('sel'));
      d.classList.add('sel');
      onPick(it.value, it.label);
    };
    list.appendChild(d);
  });
  btn.onclick = (e) => {
    e.stopPropagation();
    const willOpen = !list.classList.contains('open');
    document.querySelectorAll('.dd-list').forEach((x) => x.classList.remove('open'));
    if (willOpen) list.classList.add('open');
  };
}

document.addEventListener('click', () => {
  document.querySelectorAll('.dd-list').forEach((x) => x.classList.remove('open'));
});

/* ---------------- 学期数据 ---------------- */
const SEMESTERS = [
  { id: '', label: '全部学期（含往年）' },
  { id: 85, label: '2021-2022 第1学期' },
  { id: 86, label: '2021-2022 第2学期' },
  { id: 89, label: '2022-2023 第1学期' },
  { id: 91, label: '2022-2023 第2学期' },
  { id: 92, label: '2023-2024 第1学期' },
  { id: 94, label: '2023-2024 第2学期' },
  { id: 95, label: '2024-2025 第1学期' },
  { id: 96, label: '2024-2025 第2学期' },
  { id: 100, label: '2025-2026 第1学期' },
  { id: 107, label: '2025-2026 第2学期' },
  { id: 110, label: '2026-2027 第1学期' }
];

let selectedSemester = '';

function initSemesterDropdown() {
  buildDropdown('dd-sem', 'dd-sem-btn', 'dd-sem-label', 'dd-sem-list',
    SEMESTERS.map((s) => ({ value: s.id, label: s.label, selected: String(s.id) === String(selectedSemester) })),
    (v) => { selectedSemester = v; loadCourses(1); });
  const cur = SEMESTERS.find((s) => String(s.id) === String(selectedSemester));
  $('dd-sem-label').textContent = cur ? cur.label : '全部学期（含往年）';
}

/* ---------------- 课程搜索 ---------------- */
function courseCard(c) {
  const el = document.createElement('div');
  el.className = 'course';
  const name = c.name_zh || c.name_en || c.name || ('课程 ' + c.id);
  const profs = (c.professor_names || []).join('、');
  // 缓存项用 year 字段，服务端项用 school_year
  const yearVal = c.school_year || c.year || '';
  const semVal = c.semester !== undefined ? c.semester : '';
  const year = yearVal ? `<span class="tag year">${esc(yearVal)}-${esc(semVal)}</span>` : '';
  const fromCache = c._fromCache ? '<span class="tag hidden">本地</span>' : '';
  const hiddenTag = c._fromCache && c.visibility === 2 ? '<span class="tag hidden">已隐藏</span>' : '';
  el.innerHTML =
    `<div class="name">${esc(name)}<span class="tag">${esc(c.code || c.id || '')}</span>${year}${fromCache}${hiddenTag}</div>` +
    `<div class="meta">${esc(c.college_name || c.college || '')}${profs ? ' · ' + esc(profs) : ''} · ID ${c.id}</div>`;
  const acts = document.createElement('div');
  acts.className = 'acts';
  const b1 = document.createElement('button');
  b1.className = 'primary';
  b1.textContent = '查看节次';
  b1.onclick = (e) => { e.stopPropagation(); loadSessions(c.id, name); };
  const b2 = document.createElement('button');
  b2.textContent = '打开课程页';
  b2.onclick = (e) => { e.stopPropagation(); chrome.tabs.create({ url: 'https://www.yanhekt.cn/course/' + c.id }); };
  acts.appendChild(b1); acts.appendChild(b2);
  el.appendChild(acts);
  return el;
}

async function loadCourses(page) {
  const myToken = ++courseLoadToken;
  curPage = page;
  const kw = $('kw').value.trim();
  const semester = selectedSemester;
  $('courses').innerHTML = '';
  setStatus('加载中…');

  // 1) 先查本地扫描缓存（合并所有已扫学年），能搜到隐藏课程
  let cacheRows = [];
  let cacheYears = [];
  {
    const cache = await loadAllScanCache();
    cacheYears = cache.years;
    if (cache.items.length && kw) {
      cacheRows = matchCache(cache.items, kw);
      if (semester) {
        const sem = SEMESTERS.find((s) => String(s.id) === String(semester));
        const m = sem && sem.label.match(/(\d{4}-\d{4}) 第(\d)学期/);
        cacheRows = m ? cacheRows.filter((c) => c.year === m[1] && String(c.semester) === m[2]) : [];
      }
    }
  }

  // 2) 服务端搜索
  let srvList = [], srvTotal = 0, srvLast = 1, srvErr = null;
  try {
    const r = await call('courseList', { page, keyword: kw, semesterId: semester });
    srvList = r.list || [];
    srvTotal = r.total || 0;
    srvLast = r.lastPage || 1;
  } catch (e) {
    srvErr = e.message;
  }
  if (myToken !== courseLoadToken) return;

  // 3) 合并：缓存命中排前面，服务端结果去重后追加
  const seen = new Set();
  const merged = [];
  cacheRows.slice(0, 200).forEach((c) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    merged.push(c);
  });
  srvList.forEach((c) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    merged.push(c);
  });

  $('pageInfo').textContent = srvErr
    ? ''
    : `服务端 ${srvTotal} 门 / ${srvLast} 页` + (cacheRows.length ? ` · 本地命中 ${cacheRows.length}` : '');

  // 缓存状态提示
  const cacheHint = $('cacheHint');
  if (cacheHint) {
    if (cacheYears.length) {
      const parts = cacheYears.map((y) => `${y.year}(${y.count}${y.partial ? '，未扫完' : ''})`).join(' ');
      cacheHint.textContent = `本地已缓存：${parts}`;
    } else {
      cacheHint.textContent = '本地暂无扫描缓存，去「年份扫描」扫一遍才能搜到隐藏课程';
    }
  }

  if (!merged.length) {
    $('courses').innerHTML = srvErr
      ? `<div class="hint err">加载失败：${esc(srvErr)}</div>`
      : '<div class="hint">没有结果</div>';
    setStatus(srvErr ? '服务端加载失败' : '没有结果', srvErr ? 'err' : '');
    return;
  }

  merged.forEach((c) => $('courses').appendChild(courseCard(c)));
  setStatus(`已载入 ${merged.length} 门` + (cacheRows.length ? `（本地命中 ${cacheRows.length}，最多展示 200）` : '') +
    (srvErr ? `；服务端失败：${srvErr}` : ''), srvErr ? 'err' : 'ok');
}

/* ---------------- 节次 ---------------- */
async function loadSessions(courseId, name) {
  switchTab('sessions');
  $('sessTitle').textContent = `${name || '课程 ' + courseId}（ID ${courseId}）`;
  $('sessions').innerHTML = '<div class="hint">加载中…</div>';
  const myToken = ++sessionLoadToken;
  try {
    const list = await call('sessions', { courseId });
    if (myToken !== sessionLoadToken) return;  // 已被更新的请求覆盖
    $('sessions').innerHTML = '';
    if (!list.length) {
      $('sessions').innerHTML = '<div class="hint">该课程没有节次记录</div>';
      setStatus('该课程暂无节次');
      return;
    }
    list.forEach((s) => $('sessions').appendChild(sessionCard(s)));
    setStatus(`已载入 ${list.length} 个节次`, 'ok');
  } catch (e) {
    if (myToken !== sessionLoadToken) return;
    setStatus('节次加载失败：' + e.message, 'err');
  }
}

function sessionCard(s) {
  const el = document.createElement('div');
  el.className = 'session';
  el.innerHTML =
    `<div class="t">${esc(s.title || '节次 ' + s.id)}</div>` +
    `<div class="m">${esc(s.started_at || '')}${s.videoId ? ' · 视频 ' + s.videoId : ' · 无视频'}</div>`;
  const acts = document.createElement('div');
  acts.className = 'acts';
  if (s.videoId) {
    const p = document.createElement('button');
    p.className = 'primary';
    p.textContent = '▶ 播放';
    p.onclick = () => playSession(s.id, s.videoId, s.title);
    acts.appendChild(p);
  }
  const o = document.createElement('button');
  o.textContent = '打开原站课时';
  o.onclick = () => chrome.tabs.create({ url: 'https://www.yanhekt.cn/session/' + s.id });
  acts.appendChild(o);
  el.appendChild(acts);
  return el;
}

async function playSession(sessionId, videoId, title) {
  setStatus('正在页面内播放…');
  try {
    // 播放必须回到延河课堂页面执行（Origin 与 hls.js 都在那边）
    const tabId = await ensureReady();
    await chrome.scripting.executeScript({ target: { tabId }, files: ['vendor/hls.min.js'], world: 'MAIN' });
    const res = await chrome.tabs.sendMessage(tabId, {
      type: 'yhkt:call', method: 'play', args: { videoId, title: title || '' }
    });
    if (!res || !res.ok) throw new Error((res && res.error) || '页面无响应');
    // 激活其他标签页会关闭工具栏弹窗，因此必须在播放请求完成后再切换。
    await chrome.tabs.update(tabId, { active: true });
    setStatus('已打开页面内单画面播放器；是否可播以实际画面为准', 'ok');
  } catch (e) {
    setStatus('播放失败：' + e.message, 'err');
  }
}

/* ---------------- 搜台扫描 ---------------- */
const YEAR_RANGES = [
  { label: '2025-2026', year: '2025-2026', start: 59159, end: 66085 },
  { label: '2024-2025', year: '2024-2025', start: 48677, end: 59158 },
  { label: '2023-2024', year: '2023-2024', start: 39661, end: 48095 },
  { label: '2022-2023', year: '2022-2023', start: 30433, end: 39047 },
  { label: '2021-2022', year: '2021-2022', start: 20991, end: 30193 }
];

let scanTarget = YEAR_RANGES[0];
let scanning = false;
let scanAbort = false;
let scanHits = [];

let scanBatchSize = 100;
const SCAN_DELAY = 150;

function initScanBatchDropdown(saved) {
  scanBatchSize = Number(saved) === 200 ? 200 : 100;
  buildDropdown('dd-scan-batch', 'dd-scan-batch-btn', 'dd-scan-batch-label', 'dd-scan-batch-list',
    [100, 200].map((n) => ({ value: n, label: n + ' 条 / 批', selected: n === scanBatchSize })),
    (value) => {
      if (scanning) return;
      scanBatchSize = value;
      chrome.storage.local.set({ scan_batch_size: value }).catch((e) => setStatus('批次设置未保存：' + e.message, 'err'));
    });
  $('dd-scan-batch-label').textContent = scanBatchSize + ' 条 / 批';
}

function scanCacheKey(year) { return 'scan_cache_' + year; }

async function loadScanCache(year) {
  const r = await chrome.storage.local.get([scanCacheKey(year)]);
  return r[scanCacheKey(year)] || null;
}

async function saveScanCache(year, data) {
  await chrome.storage.local.set({ [scanCacheKey(year)]: data });
}

/*
 * 扫描进度持久化：
 *  完整扫完 → scan_cache_<year>
 *  中途停止/出错 → scan_cache_<year>__partial（含已扫到的游标，支持续扫）
 */
async function persistProgress(year, items, lastId, start, end, isComplete) {
  const payload = {
    start,
    end,
    lastId,
    items,
    ts: Date.now(),
    complete: !!isComplete
  };
  if (isComplete) {
    await saveScanCache(year, payload);
    // 清掉旧的 partial
    await chrome.storage.local.remove([scanCacheKey(year + '__partial')]);
  } else {
    await saveScanCache(year + '__partial', payload);
  }
}

/* 读取所有已扫描学年的缓存并合并（含中途停止的部分结果） */
async function loadAllScanCache() {
  const keys = [];
  YEAR_RANGES.forEach((y) => {
    keys.push(scanCacheKey(y.year));
    keys.push(scanCacheKey(y.year + '__partial'));
  });
  let all = {};
  try {
    all = await chrome.storage.local.get(keys);
  } catch (e) {
    return { items: [], years: [] };
  }

  const seen = new Set();
  const items = [];
  const years = [];

  YEAR_RANGES.forEach((y) => {
    const full = all[scanCacheKey(y.year)];
    const part = all[scanCacheKey(y.year + '__partial')];
    // 完整缓存优先，partial 只补完整缓存没有的
    const srcs = [];
    if (full && full.items && full.items.length) srcs.push(full);
    if (part && part.items && part.items.length) srcs.push(part);

    let count = 0;
    srcs.forEach((c) => {
      c.items.forEach((it) => {
        const k = y.year + ':' + it.id;
        if (seen.has(k)) return;
        seen.add(k);
        items.push({ ...it, _fromCache: true });
        count++;
      });
    });
    if (count) {
      years.push({
        year: y.year,
        count,
        partial: !(full && full.complete)
      });
    }
  });
  return { items, years };
}

/* 缓存记录不含教师和课程号；按课程名 / 学院 / 学年 / ID 匹配。 */
function matchCache(items, keyword) {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return items;
  return items.filter((c) => {
    const hay = [
      c.name || '',
      c.college || '',
      c.year || '',
      String(c.id || '')
    ].join(' ').toLowerCase();
    return hay.indexOf(kw) > -1;
  });
}

function initScanDropdown() {
  buildDropdown('dd-scan-year', 'dd-scan-year-btn', 'dd-scan-year-label', 'dd-scan-year-list',
    YEAR_RANGES.map((s, i) => ({ value: i, label: s.label, selected: i === 0 })),
    (v) => {
      if (scanning) return;
      scanTarget = YEAR_RANGES[v];
      $('dd-scan-year-label').textContent = scanTarget.label;
      $('scan-result').innerHTML = '';
      resetScanUI();
    });
  // 默认选中第一项
  $('dd-scan-year-label').textContent = YEAR_RANGES[0].label;
}

function resetScanUI() {
  $('scan-bar').style.width = '0%';
  $('scan-done').textContent = '0';
  $('scan-hit').textContent = '0';
  $('radar').textContent = '等待扫描…';
}

function radarLog(text) {
  const el = $('radar');
  const lines = el.textContent === '等待扫描…' ? [] : el.textContent.split('\n');
  lines.push(text);
  while (lines.length > 5) lines.shift();
  el.textContent = lines.join('\n');
}

async function scanWithTimeout(args) {
  let timer;
  try {
    return await Promise.race([
      call('scanBatch', args),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('单批请求超时（15s），请稍后重试')), 15000);
      })
    ]);
  } finally { clearTimeout(timer); }
}

async function startScan() {
  if (scanning) return;
  scanning = true;
  scanAbort = false;
  const { start, end, year } = scanTarget;
  const batchSize = scanBatchSize;
  const total = end - start + 1;
  let cursor = start, scanned = 0, loaded = false;
  scanHits = [];
  $('btn-scan').disabled = true;
  $('btn-scan-stop').disabled = false;
  $('dd-scan-year-btn').disabled = true;
  $('dd-scan-batch-btn').disabled = true;
  $('dd-scan-year-list').classList.remove('open');
  $('dd-scan-batch-list').classList.remove('open');
  $('btn-clear-cache').disabled = true;
  $('scan-result').innerHTML = '';
  resetScanUI();

  try {
    const cached = await loadScanCache(year);
    const partial = await loadScanCache(year + '__partial');
    loaded = true;
    if (cached && cached.complete && cached.start === start && cached.end === end && Array.isArray(cached.items)) {
      scanHits = cached.items;
      renderScanResult(year, total);
      setStatus(`已读取完整缓存：${scanHits.length} 门；未重新请求课程目录`, 'ok');
      return;
    }
    if (partial && Array.isArray(partial.items) && partial.start === start && partial.end === end &&
        Number.isInteger(partial.lastId) && partial.lastId >= start - 1 && partial.lastId <= end) {
      scanHits = partial.items.slice();
      cursor = partial.lastId + 1;
      scanned = cursor - start;
    }
    setStatus(`扫描 ${year}，从 ID ${cursor} 开始；可停止后续扫`);

    while (cursor <= end && !scanAbort) {
      const batchEnd = Math.min(cursor + batchSize - 1, end);
      const r = await scanWithTimeout({ start: cursor, end: batchEnd, limit: batchSize });
      if (!r || !Array.isArray(r.items) || !Number.isInteger(r.next) ||
          r.next <= cursor || r.next > batchEnd + 1 || r.scanned !== r.next - cursor) {
        throw new Error('扫描响应格式异常，未推进断点');
      }
      r.items.forEach((it) => { if (it.year === year) scanHits.push(it); });
      cursor = r.next;
      scanned = cursor - start;
      // 每批保存；写盘失败必须提示，不能声称数据已保存。
      await persistProgress(year, scanHits, cursor - 1, start, end, false);
      $('scan-bar').style.width = Math.round(scanned / total * 100) + '%';
      $('scan-done').textContent = scanned;
      $('scan-hit').textContent = scanHits.length;
      setStatus(`扫描中 ${scanned}/${total} · 命中 ${scanHits.length}`);
      radarLog(`ID ${cursor - 1} · 已保存断点`);
      if (!scanAbort && cursor <= end) await new Promise((resolve) => setTimeout(resolve, SCAN_DELAY));
    }

    const complete = cursor > end;
    await persistProgress(year, scanHits, cursor - 1, start, end, complete);
    renderScanResult(year, scanned);
    setStatus(complete
      ? `扫描完成并已缓存 ${scanHits.length} 门，可在课程搜索中检索`
      : `已停止于 ID ${cursor - 1}，已保存 ${scanHits.length} 门，下次继续`, 'ok');
  } catch (e) {
    let saved = false;
    if (loaded) {
      try {
        await persistProgress(year, scanHits, cursor - 1, start, end, false);
        saved = true;
      } catch (_) {}
    }
    renderScanResult(year, scanned);
    setStatus(`扫描未完成：${e.message}（${saved ? '当前断点已保存，可重试' : '未能保存新进度，请勿关闭弹窗'}）`, 'err');
  } finally {
    scanning = false;
    $('btn-scan').disabled = false;
    $('btn-scan-stop').disabled = true;
    $('dd-scan-year-btn').disabled = false;
    $('dd-scan-batch-btn').disabled = false;
    $('btn-clear-cache').disabled = false;
  }
}

function renderScanResult(year, scanned) {
  const hidden = scanHits.filter((c) => c.visibility === 2);
  const others = scanHits.filter((c) => c.visibility !== 2);
  const total = scanTarget.end - scanTarget.start + 1;
  $('scan-bar').style.width = Math.min(100, Math.round(scanned / total * 100)) + '%';
  $('scan-done').textContent = scanned;
  $('scan-hit').textContent = scanHits.length;
  const box = $('scan-result');
  box.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'hint';
  head.textContent = `${year} 目录结果（仅代表课程记录存在，不代表录像可播放）`;
  box.appendChild(head);
  hidden.slice(0, 200).forEach((c) => box.appendChild(scanCourseCard(c, true)));
  others.slice(0, 50).forEach((c) => box.appendChild(scanCourseCard(c, false)));
  if (hidden.length > 200 || others.length > 50) {
    const more = document.createElement('div');
    more.className = 'hint';
    more.textContent = '此处仅预览部分结果，完整缓存请在课程搜索中按关键词查找。';
    box.appendChild(more);
  }
}
function scanCourseCard(c, isHidden) {
  const el = document.createElement('div');
  el.className = 'course';
  const tags =
    `<span class="tag">${esc(c.id)}</span>` +
    (isHidden ? '<span class="tag hidden">已隐藏</span>' : '') +
    (c.state !== 1 ? '<span class="tag" style="background:#4a2f2f;color:#f0a0a0">下线</span>' : '');
  el.innerHTML =
    `<div class="name">${esc(c.name)}${tags}</div>` +
    `<div class="meta">${esc(c.college || '')} · ${esc(c.year)} 第${esc(c.semester)}学期</div>`;
  el.onclick = () => loadSessions(c.id, c.name);
  return el;
}

/* ---------------- 事件绑定 ---------------- */
document.querySelectorAll('.tab').forEach((t) => { t.onclick = () => switchTab(t.dataset.tab); });

$('btn-search').onclick = () => loadCourses(1);
$('kw').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadCourses(1); });
$('btn-prev').onclick = () => { if (curPage > 1) loadCourses(curPage - 1); };
$('btn-next').onclick = () => loadCourses(curPage + 1);
$('btn-scan').onclick = startScan;
$('btn-scan-stop').onclick = () => {
  scanAbort = true;
  $('btn-scan-stop').disabled = true;
  $('status').textContent = '正在停止（等待当前批次完成）…';
  // 每批已经保存；当前批结束后再落盘，避免旧快照覆盖新断点。
};

$('btn-clear-cache').onclick = async () => {
  if (scanning) return;
  const keys = [];
  YEAR_RANGES.forEach((y) => {
    keys.push(scanCacheKey(y.year));
    keys.push(scanCacheKey(y.year + '__partial'));
  });
  try {
    await chrome.storage.local.remove(keys);
    setStatus('本地扫描缓存已清空');
    loadCourses(1);
  } catch (e) { setStatus('缓存清理失败：' + e.message, 'err'); }
};

$('toggle').onchange = async (e) => {
  const on = e.target.checked;
  if (!on && scanning) scanAbort = true;
  await chrome.storage.local.set({ __yhkt_unlock_enabled: on });
  try {
    const tab = await findSiteTab();
    if (tab) await chrome.tabs.sendMessage(tab.id, { type: 'yhkt:set-enabled', enabled: on });
  } catch (err) {}
  setStatus(on ? '已启用' : '已关闭');
};

/* ---------------- 启动 ---------------- */
(async function init() {
  const st = await chrome.storage.local.get(['__yhkt_unlock_enabled', 'scan_batch_size']);
  $('toggle').checked = st.__yhkt_unlock_enabled !== false;

  initSemesterDropdown();
  initScanDropdown();
  initScanBatchDropdown(st.scan_batch_size);
  if (!$('toggle').checked) {
    setStatus('扩展已关闭');
    return;
  }

  // 识别当前课程页
  const tabs = await chrome.tabs.query({ url: 'https://www.yanhekt.cn/*' });
  const activeSite = tabs.find((t) => t.active);
  const scan = (tab) => {
    const m = (tab && tab.url || '').match(/yanhekt\.cn\/course\/(\d+)/);
    return m ? m[1] : null;
  };
  let cid = activeSite ? scan(activeSite) : null;
  if (!cid) {
    for (const t of tabs) { const x = scan(t); if (x) { cid = x; break; } }
  }

  if (!tabs.length) {
    setStatus('未找到延河课堂标签页，请先打开并登录 www.yanhekt.cn', 'err');
    return;
  }

  if (cid) {
    try {
      const c = await call('courseDetail', { courseId: cid });
      await loadSessions(cid, c.name_zh || ('课程 ' + cid));
      return;
    } catch (e) {}
  }
  loadCourses(1);
})();
