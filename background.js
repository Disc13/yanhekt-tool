/* background.js */
chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get('__yhkt_unlock_enabled');
  if (current.__yhkt_unlock_enabled === undefined) {
    await chrome.storage.local.set({ __yhkt_unlock_enabled: true });
  }
});
