'use strict';
const el = id => document.getElementById(id);
let busy = false;
async function refresh() {
  const value = await YhktCatalog.load();
  el('current').textContent = value ? `本地共享目录：${value.metadata.recordCount.toLocaleString()} 条 · ${value.metadata.date}` : '尚未导入共享目录';
}
async function run(action) {
  if (busy) return;
  busy = true;
  ['update', 'file', 'remove'].forEach(id => { el(id).disabled = true; });
  el('status').textContent = '处理中，请保持本页打开…';
  try {
    await action(); await refresh();
    el('status').textContent = '操作完成。请重新打开插件弹窗查看；个人扫描缓存未改动。';
  } catch (e) { el('status').textContent = '操作失败：' + e.message + '。原有目录未被替换（如保存已完成但读取失败，请重新打开本页确认）。'; }
  finally { busy = false; ['update', 'file', 'remove'].forEach(id => { el(id).disabled = false; }); el('file').value = ''; }
}
el('update').onclick = () => {
  // Request synchronously in the user gesture; permission denial never starts a download.
  const permission = chrome.permissions.request({ origins: [YhktCatalog.ORIGIN] });
  run(async () => {
    if (!await permission) throw new Error('未授予 GitHub 访问权限，可改用 JSON 导入');
    await YhktCatalog.update();
  });
};
el('file').onchange = () => {
  const file = el('file').files[0];
  if (!file) return;
  run(async () => {
    if (file.size > YhktCatalog.MAX_BYTES) throw new Error('文件超过 25 MiB');
    await YhktCatalog.save(JSON.parse((await file.text()).replace(/^\uFEFF/, '')));
  });
};
el('remove').onclick = () => {
  if (confirm('移除本机的共享目录？之后可重新导入。个人扫描缓存不受影响。')) run(() => YhktCatalog.remove());
};
refresh().catch(e => { el('status').textContent = '读取失败：' + e.message; });
