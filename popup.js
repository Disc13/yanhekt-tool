/*
 * popup.js
 *
 * 所有网络请求都委托给页面内的 inject.js（MAIN world）执行，
 * 因为从 chrome-extension:// 直接请求 cbiz.yanhekt.cn 会被服务端 403。
 * 本文件只负责界面与调用转发。
 */

let curPage = 1;
let siteTabId = null;

/* ---------------- 工具 ---------------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

function setStatus(t, isErr) {
  const el = $('status');
  el.textContent = t;
  el.className = isErr ? 'err' : '';
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + name));
}

/* ---------------- 站点标签页 ---------------- */
async function findSiteTab() {
  const tabs = await chrome.tabs.query({ url: 'https://www.yanhekt.cn/*' });
  if (!tabs.length) return null;
  const active = tabs.find((t) => t.active);
  return active || tabs[0];
}

async function ensureSiteTab() {
  let tab = await findSiteTab();
  if (tab) return tab;
  // 没有站点标签页就打开一个
  tab = await chrome.tabs.create({ url: 'https://www.yanhekt.cn/home', active: false });
  await new Promise((r) => setTimeout(r, 3500));
  return tab;
}

/* 确保页面里的 inject.js 已就绪，返回 tabId */
async function ensureReady() {
  const tab = await ensureSiteTab();
  siteTabId = tab.id;

  // 探活
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { type: 'yhkt:ping' });
    if (r && r.ok) return tab.id;
  } catch (e) { /* content script 未注入 */ }

  // 尝试主动注入 content scripts（覆盖扩展刚安装、页面未刷新的情况）
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['inject.js'],
      world: 'MAIN'
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['hook.js'],
      world: 'ISOLATED'
    });
  } catch (e) { /* 已存在或不支持 */ }

  await new Promise((r) => setTimeout(r, 800));
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { type: 'yhkt:ping' });
    if (r && r.ok) return tab.id;
  } catch (e) {}

  throw new Error('页面脚本未就绪，请刷新 www.yanhekt.cn 页面后重试');
}

/* 调用页面内方法 */
async function call(method, args) {
  if (!$('toggle').checked) throw new Error('扩展已关闭，请先启用');
  const tabId = await ensureReady();
  const res = await chrome.tabs.sendMessage(tabId, { type: 'yhkt:call', method, args: args || {} });
  if (!res) throw new Error('页面无响应');
  if (!res.ok) throw new Error(res.error || '未知错误');
  return res.result;
}

/* ---------------- 课程列表 ---------------- */
function courseCard(c) {
  const el = document.createElement('div');
  el.className = 'course';
  const name = c.name_zh || c.name_en || ('课程 ' + c.id);
  const profs = (c.professor_names || []).join('、');
  el.innerHTML =
    '<div class="name">' + esc(name) + '<span class="tag">' + esc(c.code || '') + '</span></div>' +
    '<div class="meta">' + esc(c.college_name || '') +
      (profs ? ' · ' + esc(profs) : '') +
      ' · ID ' + c.id + '</div>';
  const act = document.createElement('div');
  act.className = 'actions';
  const b1 = document.createElement('button');
  b1.className = 'primary';
  b1.textContent = '解锁节次';
  b1.onclick = () => loadSessions(c.id, name);
  const b2 = document.createElement('button');
  b2.textContent = '打开课程页';
  b2.onclick = () => chrome.tabs.create({ url: 'https://www.yanhekt.cn/course/' + c.id });
  act.appendChild(b1);
  act.appendChild(b2);
  el.appendChild(act);
  return el;
}

async function loadCourses(page) {
  curPage = page;
  setStatus('加载课程第 ' + page + ' 页…');
  $('courses').innerHTML = '';
  try {
    const r = await call('courseList', { page, keyword: $('kw').value.trim() });
    $('pageInfo').textContent = '共 ' + r.total + ' 门 / ' + r.lastPage + ' 页';
    if (!r.list.length) $('courses').innerHTML = '<div class="hint">没有结果</div>';
    r.list.forEach((c) => $('courses').appendChild(courseCard(c)));
    setStatus('已载入 ' + r.list.length + ' 门课程');
  } catch (e) {
    setStatus('课程列表加载失败：' + e.message, true);
  }
}

/* ---------------- 节次 ---------------- */
async function loadSessions(courseId, name) {
  switchTab('sessions');
  $('sessTitle').textContent = (name || ('课程 ' + courseId)) + '（课程 ' + courseId + '）';
  $('sessions').innerHTML = '<div class="hint">加载中…</div>';
  setStatus('读取节次…');
  try {
    const list = await call('sessions', { courseId });
    $('sessions').innerHTML = '';
    if (!list.length) {
      $('sessions').innerHTML = '<div class="hint">该课程没有节次记录</div>';
      setStatus('该课程暂无节次');
      return;
    }
    list.forEach((s) => $('sessions').appendChild(sessionCard(s)));
    setStatus('已解锁 ' + list.length + ' 个节次');
  } catch (e) {
    setStatus('节次加载失败：' + e.message, true);
  }
}

function sessionCard(s) {
  const el = document.createElement('div');
  el.className = 'session';
  el.innerHTML =
    '<div class="t">' + esc(s.title || ('节次 ' + s.id)) + '</div>' +
    '<div class="m">' + esc(s.started_at || '') + '</div>';
  const act = document.createElement('div');
  act.className = 'actions';
  if (s.id != null) {
    const open = document.createElement('button');
    open.className = 'primary';
    open.textContent = '打开原站课时';
    open.onclick = () => chrome.tabs.create({
      url: 'https://www.yanhekt.cn/session/' + encodeURIComponent(s.id)
    });
    act.appendChild(open);
  }
  el.appendChild(act);
  return el;
}

/* ---------------- 打开课程（从课程页进入时） ---------------- */
async function detectCurrentCourse() {
  try {
    // 先找当前激活的站点标签页（popup 作为独立窗口时即用户正在看的页面）
    const siteTabs = await chrome.tabs.query({ url: 'https://www.yanhekt.cn/*' });
    const activeSite = siteTabs.find((t) => t.active);
    const scan = (tab) => {
      const m = (tab.url || '').match(/yanhekt\.cn\/course\/(\d+)/);
      return m ? m[1] : null;
    };
    if (activeSite) {
      const id = scan(activeSite);
      if (id) return id;
    }
    // 退化：任一课程页标签
    for (const t of siteTabs) {
      const id = scan(t);
      if (id) return id;
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function openCourse(courseId) {
  setStatus('读取课程 ' + courseId + '…');
  try {
    const c = await call('courseDetail', { courseId });
    await loadSessions(courseId, c.name_zh || ('课程 ' + courseId));
  } catch (e) {
    setStatus('课程读取失败：' + e.message, true);
  }
}

/* ---------------- 事件绑定 ---------------- */
document.querySelectorAll('.tab').forEach((t) => { t.onclick = () => switchTab(t.dataset.tab); });
$('btn-search').onclick = () => loadCourses(1);
$('kw').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadCourses(1); });
$('btn-prev').onclick = () => { if (curPage > 1) loadCourses(curPage - 1); };
$('btn-next').onclick = () => loadCourses(curPage + 1);
$('btn-load').onclick = () => {
  const id = $('courseId').value.trim();
  if (id) openCourse(id);
};

$('toggle').onchange = async (e) => {
  const on = e.target.checked;
  await chrome.storage.local.set({ __yhkt_unlock_enabled: on });
  try {
    const tab = await findSiteTab();
    if (tab) await chrome.tabs.sendMessage(tab.id, { type: 'yhkt:set-enabled', enabled: on });
  } catch (err) {}
  setStatus(on ? '已启用' : '已关闭');
};

/* ---------------- 启动 ---------------- */
(async function init() {
  const st = await chrome.storage.local.get(['__yhkt_unlock_enabled']);
  $('toggle').checked = st.__yhkt_unlock_enabled !== false;
  if (!$('toggle').checked) {
    setStatus('扩展已关闭');
    return;
  }

  const tab = await findSiteTab();
  if (!tab) {
    setStatus('未找到延河课堂标签页，请先打开并登录 www.yanhekt.cn');
    return;
  }

  const cid = await detectCurrentCourse();
  if (cid) {
    $('courseId').value = cid;
    await openCourse(cid);
    return;
  }
  loadCourses(1);
})();
