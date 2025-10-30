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
        console.log("New question popped");
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
// 2. Heartbeat / idle detection (robust)
// ==============================

let lastPing = Date.now();
let idleTimer = null;
const IDLE_THRESHOLD_MS = 8 * 60 * 1000; // 8 minutes

function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        console.warn('No heartbeat detected for over 8 minutes — likely disconnected');
        playDisconnectSound();
        safeSendMessage({ type: 'session_idle' });
    }, IDLE_THRESHOLD_MS);
}

// Initialize once
resetIdleTimer();

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
                console.debug('Heartbeat detected:', new Date().toLocaleTimeString(), 'from', url);
                resetIdleTimer();
            }
        }
    } catch (err) {
        console.error('Fetch monitor error', err);
    }
    return oldFetch(...args);
};
