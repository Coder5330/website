// Bot detection and CAPTCHA verification
let clickTimes = [];
let isBotSuspected = false;
let isCaptchaVerified = false;

const BOT_CONFIG = {
  MAX_CLICKS_PER_SEC: 15,        // Realistic human max
  MIN_CLICK_INTERVAL: 30,         // ms between clicks for bot detection
  MAX_REGULAR_VARIANCE: 10,       // variance threshold for regular pattern detection
  HISTORY_WINDOW: 2000            // ms to analyze click patterns
};

function recordClick() {
  const now = Date.now();
  clickTimes.push(now);

  // Keep only recent clicks
  clickTimes = clickTimes.filter(t => now - t < BOT_CONFIG.HISTORY_WINDOW);

  return analyzeClickPattern();
}

function analyzeClickPattern() {
  if (clickTimes.length < 5) return false; // Not enough data

  const now = Date.now();

  // Check 1: Clicks per second
  const recentClicks = clickTimes.filter(t => now - t < 1000).length;
  if (recentClicks > BOT_CONFIG.MAX_CLICKS_PER_SEC) {
    flagBot();
    return true;
  }

  // Check 2: Minimum interval between clicks (bots often have <30ms)
  for (let i = 1; i < clickTimes.length; i++) {
    const interval = clickTimes[i] - clickTimes[i-1];
    if (interval < BOT_CONFIG.MIN_CLICK_INTERVAL) {
      flagBot();
      return true;
    }
  }

  // Check 3: Too regular spacing (bot pattern)
  if (clickTimes.length >= 10) {
    const intervals = [];
    for (let i = 1; i < clickTimes.length; i++) {
      intervals.push(clickTimes[i] - clickTimes[i-1]);
    }

    const avgInterval = intervals.reduce((a,b) => a+b) / intervals.length;
    const variance = intervals.reduce((a,b) => a + Math.pow(b - avgInterval, 2)) / intervals.length;

    if (variance < BOT_CONFIG.MAX_REGULAR_VARIANCE) {
      flagBot();
      return true;
    }
  }

  return false;
}

function flagBot() {
  if (isBotSuspected) return; // Already flagged, don't re-show modal
  isBotSuspected = true;
  showCaptchaModal();
}

function showCaptchaModal() {
  const modal = document.createElement('div');
  modal.id = 'captcha-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  modal.innerHTML = `
    <div style="background: #0f172a; padding: 2rem; border-radius: 12px; max-width: 400px; text-align: center;">
      <div style="font-size: 24px; margin-bottom: 1rem;">🤖</div>
      <h2 style="color: #e2e8f0; margin-bottom: 0.5rem;">Bot Detection</h2>
      <p style="color: #94a3b8; margin-bottom: 2rem;">We detected unusual clicking patterns. Please verify you're human.</p>
      <button id="captcha-verify-btn" style="background: #00f5ff; color: #0f172a; padding: 10px 24px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px;">I'm Human</button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('captcha-verify-btn').onclick = () => {
    isCaptchaVerified = true;
    modal.remove();
    // Reset bot detection after verification
    clickTimes = [];
    isBotSuspected = false;
  };
}

function canSaveScore() {
  if (isBotSuspected && !isCaptchaVerified) {
    showCaptchaModal();
    return false;
  }
  return true;
}

function resetBotDetection() {
  clickTimes = [];
  isBotSuspected = false;
  isCaptchaVerified = false;
}
