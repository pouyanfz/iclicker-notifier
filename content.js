// ======================
// 1. Question detection
// ======================

// Generic sound player
function playSound(file) {
    try {
        const audio = new Audio(chrome.runtime.getURL(file));
        audio.play().catch(() => console.log('Sound blocked by autoplay rules'));
    } catch (err) {
        console.error('chrome.runtime unavailable:', err);
    }
}

// Play notification sound
function playQuestionSound() {
    playSound('notify.wav');
}

// Play disconnect sound
function playDisconnectSound() {
    playSound('disconnect.wav');
}

let lastTrigger = 0;
function triggerNotification() {
    const now = Date.now();
    if (now - lastTrigger < 2000) return; // debounce
    lastTrigger = now;
    playQuestionSound();
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
        playDisconnectSound();
        console.warn('iClicker appears idle or disconnected');
        chrome.runtime.sendMessage({ type: 'session_idle' });
    }
}, 60000);

// Hook into fetch to monitor iClicker heartbeat requests
const oldFetch = window.fetch;
window.fetch = async (...args) => {
    try {
        if (typeof args[0] === 'string') {
            const url = args[0];
            if (
                url.includes('/student/course/status') ||
                url.includes('/reactions/status')
            ) {
                lastPing = Date.now();
                console.log('Heartbeat detected from', url, 'at', new Date().toISOString());
            }
        }
    } catch (err) {
        console.error('Fetch monitor error', err);
    }
    return oldFetch(...args);
};
