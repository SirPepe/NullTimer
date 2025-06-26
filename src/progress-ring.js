import { attr, define, init, int, number, reactive } from "@sirpepe/ornament";

@define("progress-ring")
export class ProgressRing extends HTMLElement {
  #shadow = this.attachShadow({ mode: "open" });
  @attr(int({ min: 0n })) accessor radius = 100n;
  @attr(int({ min: 0n })) accessor width = 1n;

  @attr(number({ min: 0 })) accessor max = 0;
  @attr(number({ min: 0 })) accessor value = 0;

  constructor() {
    super();
    this.#shadow.innerHTML = `<svg><circle fill="transparent" /></svg>`;
    this.#shadow.adoptedStyleSheets.push(new CSSStyleSheet());
  }

  @init()
  @reactive()
  render() {
    this.#shadow.adoptedStyleSheets[0].replaceSync(`:host {
  display: inline-block;
  width: ${this.radius}px;
  height: ${this.radius}px;
}
svg {
  width: 100%;
  height: 100%;
  --value: ${this.value};
  --max: ${this.max};
  --width: ${this.width}px;
  --circumference: calc((100% - var(--width) * 4) * pi);
  --percent: calc((100 / var(--max)) * var(--value));
}
circle {
  stroke: red;
  stroke-width: var(--width);
  stroke-dasharray: var(--circumference) var(--circumference);
  stroke-dashoffset: calc(var(--circumference) - (var(--percent) / 100) * var(--circumference));
  r: calc(50% - var(--width) * 2);
  cx: 50%;
  cy: 50%;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
}`);
  }
}
