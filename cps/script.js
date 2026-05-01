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
  const { data } = await sb.from('scores')
    .select('payload')
    .eq('player_id', session.user.id)
    .eq('game', 'cps')
    .maybeSingle();
  const existing = data?.payload || {};
  const key = 'd' + duration;
  if (existing[key] && cpsValue <= existing[key]) return;
  existing[key] = parseFloat(cpsValue.toFixed(2));
  const status = document.getElementById('save-status');
  status.textContent = '⬤ saving...';
  status.className = 'saving';
  const { error } = await sb.from('scores').upsert({
    player_id: session.user.id,
    game: 'cps',
    payload: existing
  }, { onConflict: 'player_id,game' });
  if (error) { console.error('save error:', error); status.textContent = '⬤ error'; status.className = ''; return; }
  status.textContent = '⬤ new best!';
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
