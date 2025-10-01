function* timeStream(startAt, endAt) {
  while (true) {
    const nowAt = Temporal.Now.plainDateTimeISO();
    const isOver = Temporal.PlainDateTime.compare(nowAt, endAt) === 1;
    if (isOver) {
      return;
    }
    if (Temporal.PlainDateTime.compare(nowAt, startAt) === 1) {
      yield endAt.until(nowAt);
    } else {
      yield nowAt.until(startAt);
    }
  }
}

async function* interleaveRaf(source) {
  let frameId;
  try {
    while (true) {
      const { value, done } = source.next();
      if (done) {
        return;
      }
      yield value;
      const { resolve, promise } = Promise.withResolvers();
      frameId = globalThis.requestAnimationFrame(resolve);
      await promise;
    }
  } finally {
    globalThis.cancelAnimationFrame(frameId);
  }
}

function progressUpdater(initAt, startAt, endAt) {
  const progress = document.querySelector("progress-ring");
  const toStart = initAt.until(startAt);
  const toEnd = startAt.until(endAt);
  return function updateProgress(duration) {
    if (duration.blank) {
      progress.max = progress.value = 0;
    } else if (duration.sign === 1) {
      progress.max = toStart.total("seconds");
      progress.value = duration.total("seconds");
    } else if (duration.sign === -1) {
      progress.max = toEnd.total("seconds");
      progress.value = toEnd.add(duration).total("seconds");
    }
  };
}

function countdownUpdater() {
  const countdown = document.querySelector(".countdown");
  const formatter = new Intl.DurationFormat("en-US", {
    style: "digital",
    hours: "2-digit",
    hoursDisplay: "auto",
  });
  return function updateCountdown(duration) {
    const value = formatter.format(duration.round("seconds").abs());
    const hasHours = value.split(":").length === 3;
    document.body.classList.toggle("hasHours", hasHours);
    countdown.innerHTML = value;
  };
}

function noticeUpdater(startAt, endAt) {
  const notice = document.querySelector(".notice");
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour12: false,
  });
  const startTime = timeFormatter.format(startAt.toPlainTime());
  const endTime = timeFormatter.format(endAt.toPlainTime());
  const totalDuration = new Intl.DurationFormat("en-US", {
    style: "digital",
    hours: "2-digit",
  }).format(startAt.until(endAt));
  return function updateNotice(duration) {
    if (!duration) {
      notice.innerHTML = `<b class="over">Time's up!</b>`;
    } else if (duration.sign === 1) {
      notice.innerHTML = `a <time>${totalDuration}</time> timer starts <time>${startTime}</time>`;
    } else if (duration.sign === -1) {
      notice.innerHTML = `<time>${totalDuration}</time> timer ends <time>${endTime}</time>`;
    }
  };
}

const initAt = Temporal.Now.plainDateTimeISO().round("seconds");

const startDateTimeInput = document.querySelector("[name=start]");
const endDateTimeInput = document.querySelector("[name=end]");

let prevStart = null;
let prevEnd = null;

try {
  const storedStartAt = Temporal.PlainDateTime.from(
    window.localStorage.getItem("0timer-start")
  );
  const storedEndAt = Temporal.PlainDateTime.from(
    window.localStorage.getItem("0timer-end")
  );
  if (Temporal.PlainDateTime.compare(storedEndAt, initAt) === 1) {
    prevStart = storedStartAt;
    prevEnd = storedEndAt;
  }
} catch {}

startDateTimeInput.value = prevStart ?? initAt;
endDateTimeInput.value = prevEnd ?? initAt;

function validateInputs() {
  const from = Temporal.PlainDateTime.from(startDateTimeInput.value);
  const to = Temporal.PlainDateTime.from(endDateTimeInput.value);
  if (Temporal.PlainDateTime.compare(to, from) !== 1) {
    endDateTimeInput.setCustomValidity("End time must be AFTER start time");
  } else {
    endDateTimeInput.setCustomValidity("");
  }
}

document.addEventListener("input", validateInputs);
validateInputs(); // on page load

let wakeLock = null;

async function lockScreen() {
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch (err) {
    console.error(`Failed to request wake lock: ${err.name}, ${err.message}`);
  }
}

async function unlockScreen() {
  await wakeLock?.release();
  wakeLock = null;
}

// Release the wake lock and clear the storage when the running timer is closed
document.addEventListener(
  "close",
  () => {
    try {
      unlockScreen();
      window.localStorage.removeItem("0timer-start");
      window.localStorage.removeItem("0timer-end");
      startDateTimeInput.value = endDateTimeInput.value =
        Temporal.Now.plainDateTimeISO().round("seconds");
    } catch {}
  },
  { capture: true }
);

async function run(startAt, endAt) {
  const initAt = Temporal.Now.plainDateTimeISO().round("seconds");
  // If the current timer is over from the start, exit immediately. This should
  // actually never happen, but just to be sure...
  if (Temporal.PlainDateTime.compare(endAt, initAt) !== 1) {
    return;
  }
  // Commit the timer to storage
  window.localStorage.setItem("0timer-start", startAt.toString());
  window.localStorage.setItem("0timer-end", endAt.toString());
  // Show timer UI
  document.querySelector("dialog").showModal();
  // Lock screen when a timer is running
  await lockScreen();
  // Initialize the updater functions
  const updateCountdown = countdownUpdater();
  const updateProgress = progressUpdater(initAt, startAt, endAt);
  const updateNotice = noticeUpdater(startAt, endAt);
  // Sync the UI for each moment for each frame
  for await (const value of interleaveRaf(timeStream(startAt, endAt))) {
    updateCountdown(value);
    updateProgress(value);
    updateNotice(value);
    document.body.classList.toggle("isCountingUp", value.sign === 1);
    document.body.classList.toggle("isCountingDown", value.sign === -1);
  }
  // Change into "it's over" mode, clear storage
  document.body.classList.remove("isCountingUp", "isCountingDown");
  document.body.classList.add("isOver");
  updateNotice(null);
  updateProgress(new Temporal.Duration());
  window.localStorage.removeItem("0timer-start");
  window.localStorage.removeItem("0timer-end");
}

document.addEventListener("submit", async (evt) => {
  // Timer form (not the form for closing the dialog)
  if (evt.target.method !== "dialog") {
    evt.preventDefault();
    const startAt = Temporal.PlainDateTime.from(startDateTimeInput.value);
    const endAt = Temporal.PlainDateTime.from(endDateTimeInput.value);
    run(startAt, endAt);
  }
});

if (prevStart && prevEnd) {
  run(prevStart, prevEnd);
}
