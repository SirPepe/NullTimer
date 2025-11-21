import "./progress-ring.js";
import {
  WakeLockManager,
  component,
  timeStream,
  interleaveRaf,
  load,
  store,
  remove,
} from "./lib.js";

const screenLock = new WakeLockManager();

// Re-acquire after loss of document visibility
document.addEventListener("visibilitychange", async () => {
  if (!screenLock.locked && document.visibilityState === "visible") {
    screenLock.acquire();
  }
});

function updateScreenLockState() {
  for (const className of document.body.classList) {
    if (className.startsWith("screen-lock-status")) {
      document.body.classList.remove(className);
    }
  }
  if (screenLock.status === "ERROR") {
    return document.body.classList.add("screen-lock-status-error");
  }
  if (screenLock.status === "LOCKED") {
    return document.body.classList.add("screen-lock-status-locked");
  }
  return document.body.classList.add("screen-lock-status-released");
}

screenLock.addEventListener("acquire", updateScreenLockState);
screenLock.addEventListener("release", updateScreenLockState);
screenLock.addEventListener("error", updateScreenLockState);

const startInput = document.querySelector("input[name=start]");
const endInput = document.querySelector("input[name=end]");
const timeInput = document.querySelector("input[name=time]");

const initAt = Temporal.Now.plainDateTimeISO().round("seconds");

// potentially running timers
let prevStart = null;
let prevEnd = null;
const storedStart = load("start", Temporal.PlainDateTime.from);
const storedEnd = load("end", Temporal.PlainDateTime.from);
if (
  storedStart &&
  storedEnd &&
  Temporal.PlainDateTime.compare(storedEnd, initAt) === 1
) {
  prevStart = storedStart.round("seconds");
  prevEnd = storedEnd.round("seconds");
  // Start if a scheduled timer happens to be running
  run(prevStart, prevEnd);
} else {
  prevStart = initAt.round("seconds");
  prevEnd = initAt.round("seconds").add({ minutes: 45 });
}

// last entered time
const prevTime = load("time", Temporal.PlainTime.from) ?? "00:45:00";

startInput.value = prevStart;
endInput.value = prevEnd;
timeInput.value = prevTime;

function validateScheduledInputs() {
  const from = Temporal.PlainDateTime.from(startInput.value);
  const to = Temporal.PlainDateTime.from(endInput.value);
  if (Temporal.PlainDateTime.compare(to, from) !== 1) {
    endInput.setCustomValidity("End time must be AFTER start time");
  } else {
    endInput.setCustomValidity("");
  }
}

validateScheduledInputs(); // on page load

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

async function run(startAt, endAt) {
  const initAt = Temporal.Now.plainDateTimeISO().round("seconds");
  // If the current timer is over from the start, exit immediately. This should
  // actually never happen, but just to be sure...
  if (Temporal.PlainDateTime.compare(endAt, initAt) !== 1) {
    return;
  }
  // Commit the timer to storage
  store("start", startAt);
  store("end", endAt);
  // Show timer UI
  document.querySelector("dialog").showModal();
  // Lock screen when a timer is running
  screenLock.acquire();
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
  remove("start");
  remove("end");
}

component(document, ({ on, $$ }) => {
  // Ensure that one of the details elements is always open
  on("toggle", (evt) => {
    const details = $$("details");
    if (!details.some((element) => element.open)) {
      details.filter((element) => element !== evt.target).at(0).open = true;
    }
  });

  // Validate inputs
  on("input", "input[name=start], input[name=end]", validateScheduledInputs);

  // Save last entered instant timer
  on("input", "input[name=time]", (evt) => store("time", evt.target.value));

  // Handle timer start
  on("submit", (evt) => {
    // Dialog close = complete reset
    if (evt.target.method === "dialog") {
      screenLock.release();
      document.body.className = "";
      remove("start");
      remove("end");
      return;
    }
    // Timer form
    evt.preventDefault();
    let start;
    let end;
    const data = new FormData(evt.target);
    if (data.has("time")) {
      start = Temporal.Now.plainDateTimeISO();
      end = start.add(Temporal.PlainTime.from("00").until(data.get("time")));
    } else {
      start = Temporal.PlainDateTime.from(data.get("start"));
      end = Temporal.PlainDateTime.from(data.get("end"));
    }
    store("start", start);
    store("end", end);
    run(start, end);
  });
});
