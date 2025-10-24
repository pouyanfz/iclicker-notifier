chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'question_detected') {
    const audio = new Audio(chrome.runtime.getURL('notify.wav'));
    audio.play().catch(e => console.warn('Background sound blocked', e));

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'iClicker question',
      message: 'A new question just appeared!',
      requireInteraction: true
    });
  }
});
