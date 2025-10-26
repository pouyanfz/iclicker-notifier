// Keepalive alarm to prevent Chrome from unloading the iClicker tab
chrome.alarms.create('keepalive', { periodInMinutes: 3 });

chrome.alarms.onAlarm.addListener(() => {
  chrome.tabs.query({ url: '*://*.iclicker.com/*' }, (tabs) => {
    for (const tab of tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // lightweight activity signal
          console.log('Keepalive ping', new Date().toISOString());
          window.dispatchEvent(new Event('mousemove'));
        },
      });
    }
  });
});

// Handle notifications from content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'question_detected') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'iClicker Question',
      message: 'A new question appeared!',
      requireInteraction: true,
    });
  } else if (msg.type === 'session_idle') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'iClicker Disconnected',
      message: 'No heartbeat detected for 5 minutes. You may need to refresh.',
      requireInteraction: true,
    });
  }
});

