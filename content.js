// ======================
// 1. Question detection
// ======================

try {
    console.log("Testing chrome.runtime:", typeof chrome.runtime);
    console.log("Testing chrome.runtime.getURL:", typeof chrome.runtime?.getURL);
    console.log("Extension ID:", chrome.runtime?.id);
} catch (err) {
    console.error("chrome.runtime unavailable:", err);
}

// -------- Safe helper for getURL --------
function safeGetURL(file) {
    if (chrome?.runtime?.getURL) {
        return chrome.runtime.getURL(file);
    }
    console.warn('chrome.runtime.getURL unavailable, returning fallback URL');
    return file;
}

// -------- Safe helper for messaging --------
function safeSendMessage(message) {
    if (!chrome?.runtime?.id) {
        console.warn('Skipping message, extension context invalidated');
        return;
    }

    try {
        const result = chrome.runtime.sendMessage(message);

        // handle both promise and callback style
        if (result && typeof result.then === 'function') {
            result.catch((err) => {
                if (err?.message?.includes('Receiving end does not exist')) {
                    console.debug('No listener for message:', message.type);
                } else {
                    console.warn('Message delivery failed:', err.message || err);
                }
            });
        }
    } catch (err) {
        if (err?.message?.includes('Receiving end does not exist')) {
            console.debug('No listener for message:', message.type);
        } else {
            console.warn('chrome.runtime.sendMessage failed:', err);
        }
    }
}


// -------- Generic sound player --------
function playSound(file) {
    try {
        const path = safeGetURL(file);
        const audio = new Audio(path);
        audio.play().catch(() => console.log('Sound blocked by autoplay rules'));
    } catch (err) {
        console.error('chrome.runtime unavailable:', err);
    }
}

// -------- Play notification sounds --------
function playQuestionSound() {
    playSound('notify.wav');
}

function playDisconnectSound() {
    playSound('disconnect.wav');
}

let lastTrigger = 0;

// -------- Debounced notification trigger --------
function triggerNotification() {
    const now = Date.now();
    if (now - lastTrigger < 2000) return; // debounce
    lastTrigger = now;

    playQuestionSound();
    safeSendMessage({ type: 'question_detected' });
}

// -------- Observe DOM for new question or idle changes --------
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

// -------- Check every minute for idle state --------
setInterval(() => {
    if (Date.now() - lastPing > 300000) { // >5 minutes with no ping
        playDisconnectSound();
        console.warn('iClicker appears idle or disconnected');
        safeSendMessage({ type: 'session_idle' });
    }
}, 60000);

// -------- Hook into fetch to monitor heartbeat --------
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
