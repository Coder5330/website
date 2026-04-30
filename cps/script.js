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
                canvas.querySelector("p").textContent = "Done! " + (clickCount / DURATION).toFixed(2) + " CPS";
            }
        }, 10);
    }

    if (timer && (Date.now() - startTime) / 1000 < DURATION) {
        clickCount++;
        clicks.textContent = "Clicks: " + clickCount;
    }
});
