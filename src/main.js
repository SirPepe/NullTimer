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
