// ======================
// 1. Question detection
// ======================
function playSound() {
  const audio = new Audio(chrome.runtime.getURL('notify.wav'));
  audio.play().catch(() => console.log('Sound blocked by autoplay rules'));
}

let lastTrigger = 0;
function triggerNotification() {
  const now = Date.now();
  if (now - lastTrigger < 2000) return; // debounce
  lastTrigger = now;
  playSound();
  chrome.runtime.sendMessage({ type: 'question_detected' });
}

// Observe DOM for new question or idle screen changes
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (
          node.matches(
            '.question-container, .question-image-container, app-multiple-choice-question-result'
          ) ||
          node.querySelector?.(
            '.question-container, .question-image-container, app-multiple-choice-question-result'
          )
        ) {
          triggerNotification();
          return;
        }
      }
    }

    // detect when “checked in” view disappears
    for (const node of m.removedNodes) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        node.matches('.unified-home-container')
      ) {
        triggerNotification();
        return;
      }
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
});

console.log('iClicker Notifier active');

// ==============================
// 2. Heartbeat / idle detection
// ==============================
let lastPing = Date.now();

// Check every minute whether a heartbeat has occurred recently
setInterval(() => {
  if (Date.now() - lastPing > 300000) { // >5 minutes with no ping
    new Audio(chrome.runtime.getURL('disconnect.wav')).play();
    console.warn('iClicker appears idle or disconnected');
    chrome.runtime.sendMessage({ type: 'session_idle' });
  }
}, 60000);

// Hook into fetch to monitor iClicker heartbeat requests
const oldFetch = window.fetch;
window.fetch = async (...args) => {
  try {
    if (typeof args[0] === 'string' && args[0].includes('/student/course/status')) {
      lastPing = Date.now();
      console.log('Heartbeat detected at', new Date().toISOString());
    }
  } catch (err) {
    console.error('Fetch monitor error', err);
  }
  return oldFetch(...args);
};
