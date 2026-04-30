function randint(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const content = document.getElementById("content");
const timeEl = document.getElementById("time");
const wpmEl = document.getElementById("wpm");
const accEl = document.getElementById("accuracy");

const sentences = [
    "Typing is a skill that improves with patience and consistency. At first, it may feel slow and frustrating, but over time your fingers begin to remember where each key is located. Instead of looking at the keyboard, you learn to trust your muscle memory. The key is to focus on accuracy before speed, because speed naturally increases when mistakes are reduced.",
    "In a world full of distractions, maintaining focus has become more valuable than ever. Typing practice is not just about speed, but also about training your mind to stay engaged on a single task. When you concentrate fully, your typing becomes smoother and more consistent. This same focus can be applied to studying, working, and solving problems more effectively.",
    "The rhythm of typing depends on coordination, timing, and attention to detail. A single mistake can interrupt your flow, forcing you to pause and correct yourself. Skilled typists develop a balance between speed and precision, allowing them to move quickly without losing control. Building this ability takes time, but the results are rewarding and noticeable.",
    "I once tried to type an entire paragraph while eating snacks, and it turned into complete chaos. Crumbs were everywhere, my fingers missed half the keys, and somehow I ended up typing words that do not even exist. It was a reminder that typing quickly is one thing, but typing carefully is a completely different challenge.",
    "You are entering a high stakes typing challenge where every second counts. The screen in front of you is your battlefield, and your keyboard is your only weapon. Each correct word pushes you forward, while every mistake slows you down. Stay calm, keep your rhythm steady, and aim for the highest score possible before time runs out.",
    "Version updates, deadlines, and constant notifications can easily overwhelm anyone trying to stay productive. However, building small habits like daily typing practice can improve both speed and focus over time. Whether you are writing emails, coding, or taking notes, the ability to type efficiently is a valuable skill that saves time and reduces effort.",
    "In 2026, I decided to track my daily habits for 30 days, starting on 01/01/2026 at exactly 07:30 in the morning. On day 1, I managed to type 45 words per minute with 98 percent accuracy, but by day 7, my speed increased to 62 words per minute. By day 15, I reached 75 words per minute, although my accuracy dropped slightly to 94 percent. I noticed that practicing for just 20 minutes each day, instead of 60 minutes once a week, made a huge difference. By the end of the 30-day challenge, I hit 88 words per minute with 97 percent accuracy, proving that small, consistent efforts over 10, 20, or even 30 days can lead to measurable improvement."
];

let choice = sentences[randint(0, sentences.length - 1)];
let correct = 0;
let total = 0;
let index = 0;

let startTime = null;
let timer;

// render text
content.innerHTML = "";
choice.split("").forEach(char => {
  const span = document.createElement("span");
  span.textContent = char;
  content.appendChild(span);
});

const spans = content.querySelectorAll("span");
spans[0].classList.add("current");

content.focus();

document.getElementById("restart").addEventListener("click", () => {
  location.reload();
});

function startTimer() {
  timer = setInterval(() => {
    let elapsed = (Date.now() - startTime) / 1000;
    timeEl.textContent = elapsed.toFixed(1);

    let minutes = elapsed / 60;
    let wpm = Math.round((correct / 5) / minutes || 0);
    let accuracy = Math.round((correct / total) * 100 || 100);

    wpmEl.textContent = wpm;
    accEl.textContent = accuracy;
  }, 100);
}

content.addEventListener("keydown", (e) => {
  if (!startTime) {
    startTime = Date.now();
    startTimer();
  }

  if (e.key.length > 1) return;

  total++;

  if (e.key === spans[index].textContent) {
    spans[index].classList.add("correct");
    correct++;
  } else {
    spans[index].classList.add("wrong");
  }

  spans[index].classList.remove("current");
  index++;

  if (index < spans.length) {
    spans[index].classList.add("current");

    // 🔥 SCROLLING LOGIC
    const currentSpan = spans[index];
    const offset = currentSpan.offsetTop;

    content.style.transform = `translateY(-${offset - 40}px)`;
  }

  if (index === spans.length) {
    clearInterval(timer);
    alert("Finished!");
  }
});