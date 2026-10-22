/* background.js */
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ __yhkt_unlock_enabled: true });
});
