import { attr, define, init, int, number, reactive } from "@sirpepe/ornament";

@define("progress-ring")
export class ProgressRing extends HTMLElement {
  #shadow = this.attachShadow({ mode: "open" });
  #internals = this.attachInternals();
  @attr(int({ min: 0n })) accessor radius = 100n;
  @attr(int({ min: 0n })) accessor width = 1n;
  @attr(number({ min: 0 })) accessor max = 0;
  @attr(number({ min: 0 })) accessor value = 0;

  constructor() {
    super();
    this.#shadow.innerHTML = `<svg><circle fill="transparent" /></svg>`;
    this.#shadow.adoptedStyleSheets.push(new CSSStyleSheet());
    this.#internals.role = "progressbar";
    this.#internals.ariaValueMin = 0;
  }

  @init()
  @reactive({ keys: ["max, value"] })
  #updateAria() {
    this.#internals.ariaValueMax = this.max;
    this.#internals.ariaValueNow = this.value;
  }

  @init()
  @reactive({ keys: ["radius"] })
  #updateViewBox() {
    this.#shadow.firstChild.setAttribute(
      "viewBox",
      `0 0 ${this.radius} ${this.radius}`
    );
  }

  @init()
  @reactive()
  render() {
    this.#shadow.adoptedStyleSheets[0].replaceSync(`:host {
  display: inline-block;
  width: ${this.radius}px;
  height: ${this.radius}px;
  overflow: hidden;
}
svg {
  width: 100%;
  height: 100%;
  --width: ${this.width}px;
  --value: ${this.value};
  --max: ${this.max};
  --circumference: calc((100% - var(--width) * 2) * pi);
  --percent: calc((100 / var(--max)) * var(--value));
}
circle {
  stroke: var(--ring-color, red);
  stroke-width: var(--width);
  stroke-dasharray: var(--circumference) var(--circumference);
  stroke-dashoffset: calc(var(--circumference) - (var(--percent) / 100) * var(--circumference));
  r: calc(50% - var(--width));
  cx: 50%;
  cy: 50%;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
}`);
  }
}
