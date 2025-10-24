// Watch for new question elements
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

// Observe DOM for new question elements
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    // detect addition of question containers
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

    // detect when "You're checked in!" view disappears
    if (m.removedNodes.length > 0) {
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
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true
});


// Observe both child and attribute changes
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true
});


observer.observe(document.body, { childList: true, subtree: true });
console.log('iClicker Notifier active');
