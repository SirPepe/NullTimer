export function fail(message = "", ErrorCtor = Error, reason = undefined) {
  throw new ErrorCtor(message, { reason });
}

export function component(rootOrSelector, callback) {
  const rootNode =
    typeof rootOrSelector === "string"
      ? document.querySelector(rootOrSelector) ??
        fail(`Can't find root node matching '${rootOrSelector}'`)
      : rootOrSelector ?? fail(`${String(rootOrSelector)} is not a node`);

  function $(selector, mapFn = (x) => x) {
    return mapFn(rootNode.querySelector(selector));
  }

  function $$(selector, mapFn) {
    return Array.from(rootNode.querySelectorAll(selector), mapFn);
  }

  function on(events, selector, func, options) {
    if (typeof selector === "function") {
      [func, options] = [selector, func];
    }
    for (const eventName of events.split(/\s+/)) {
      rootNode.addEventListener(
        eventName,
        (evt) => {
          if (typeof selector !== "string" || evt.target.matches(selector)) {
            return func(evt);
          }
        },
        { capture: true, ...options }
      );
    }
  }

  callback({ $, $$, on }, rootNode);
}

export function* timeStream(startAt, endAt) {
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

export async function* interleaveRaf(source) {
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

const prefix = `0timer-`;

export function store(key, value, transform = String) {
  key = prefix + key;
  try {
    return window.localStorage.setItem(key, transform(value));
  } catch (cause) {
    console.warn(`Failed to write '${key}' to storage`, cause);
  }
}

export function load(key, transform = (x) => x) {
  key = prefix + key;
  try {
    return transform(window.localStorage.getItem(key));
  } catch (cause) {
    console.warn(`Failed to read '${key}' from storage`, cause);
  }
}

export function remove(key) {
  key = prefix + key;
  try {
    return window.localStorage.removeItem(key);
  } catch (cause) {
    console.warn(`Failed to delete '${key}' from storage`, cause);
  }
}

export class WakeLockManager extends EventTarget {
  #sentinel = null;
  #error = null;

  #onRelease = () => this.dispatchEvent(new Event("release"));

  async acquire() {
    if (this.#sentinel && !this.#sentinel.released) {
      return;
    }
    try {
      this.#sentinel = await navigator.wakeLock.request("screen");
      this.dispatchEvent(new Event("acquire"));
      this.#sentinel.addEventListener("release", this.#onRelease, {
        once: true,
      });
      this.#error = null;
    } catch (error) {
      this.#error = error;
      this.dispatchEvent(Object.assign(new Event("error"), { error }));
    }
  }

  async release() {
    try {
      if (this.#sentinel) {
        await this.#sentinel?.release();
        this.#sentinel.removeEventListener("release", this.#onRelease, {
          once: true,
        });
        this.#sentinel = null;
        this.#error = null;
      }
    } catch (error) {
      this.#error = error;
      this.dispatchEvent(Object.assign(new Event("error"), { error }));
    }
  }

  get locked() {
    return this.#sentinel && !this.#sentinel.released;
  }

  get status() {
    if (this.#error) {
      return "ERROR";
    }
    if (this.locked) {
      return "LOCKED";
    }
    return "RELEASED";
  }
}
