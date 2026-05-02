const time = document.getElementById("timer");
const cps = document.getElementById("cps");
const clicks = document.getElementById("clicks");
const canvas = document.getElementById("canvas");

let timer = null;
let startTime = null;
let clickCount = 0;
let DURATION = 10;

const buttons = [1, 2, 5, 10, 30, 60, 100].map(n => document.getElementById("s" + n));

buttons.forEach(btn => {
    btn.addEventListener("click", () => {
        buttons.forEach(b => b.classList.remove("chosen"));
        btn.classList.add("chosen");
        DURATION = parseInt(btn.id.replace("s", ""));

        // reset game when new duration picked
        clearInterval(timer);
        timer = null;
        startTime = null;
        clickCount = 0;
        clicks.textContent = "Clicks: 0";
        cps.textContent = "CPS: 0";
        time.textContent = "Timer: " + DURATION;
        canvas.querySelector("p").textContent = "Start clicking to start test...";
    });
});

async function saveCpsScore(cpsValue, duration) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const status = document.getElementById('save-status');
  status.textContent = '⬤ saving...';
  status.className = 'saving';
  const { data: saved, error } = await sb.rpc('save_cps_score', {
    p_player_id: session.user.id,
    p_duration: duration,
    p_cps: parseFloat(cpsValue.toFixed(2))
  });
  if (error) { console.error('save error:', error); status.textContent = '⬤ error'; status.className = ''; return; }
  if (saved === false) { alert('STTTOPPP CHEATTTING'); status.textContent = '⛔ cheater'; status.className = ''; return; }
  status.textContent = '⬤ saved';
  status.className = 'saved';
}

canvas.addEventListener("click", () => {
    if (timer === null) {
        startTime = Date.now();
        canvas.querySelector("p").textContent = "";

        timer = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            const remaining = Math.max(0, DURATION - elapsed).toFixed(1);
            time.textContent = "Timer: " + remaining;
            cps.textContent = "CPS: " + (clickCount / elapsed).toFixed(2);

            if (elapsed >= DURATION) {
                clearInterval(timer);
                const finalCps = clickCount / DURATION;
                canvas.querySelector("p").textContent = "Done! " + finalCps.toFixed(2) + " CPS";
                saveCpsScore(finalCps, DURATION);
            }
        }, 10);
    }

    if (timer && (Date.now() - startTime) / 1000 < DURATION) {
        clickCount++;
        clicks.textContent = "Clicks: " + clickCount;
    }
});
