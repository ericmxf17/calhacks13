/** Read-only Browser probe. Pass inspectDesign and a selector list to tab.playwright.evaluate. */
export function inspectDesign(selectors) {
  const rgba = text => {
    const values = text.match(/[\d.]+/g)?.map(Number);
    if (!values || (!text.startsWith('rgb') && !text.startsWith('color(srgb '))) {
      throw new Error(`Unsupported computed color format: ${text}`);
    }
    const channels = text.startsWith('color(srgb ') ? values.slice(0, 3).map(value => value * 255) : values.slice(0, 3);
    return [...channels, values[3] ?? 1];
  };
  const blend = (front, back) => front.slice(0, 3).map((value, index) => value * front[3] + back[index] * (1 - front[3]));
  const background = element => {
    const ancestors = [];
    for (let parent = element; parent; parent = parent.parentElement) ancestors.unshift(parent);
    return ancestors.reduce((color, parent) => blend(rgba(getComputedStyle(parent).backgroundColor), color), [255, 255, 255]);
  };
  const luminance = color => color.map(value => value / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (a, b) => {
    const values = [luminance(a), luminance(b)].sort((x, y) => x - y);
    return (values[1] + 0.05) / (values[0] + 0.05);
  };
  return {
    url: location.href,
    viewport: { width: document.documentElement.clientWidth, height: window.innerHeight, contentWidth: document.documentElement.scrollWidth },
    fonts: document.fonts.status,
    elements: selectors.map(selector => {
      const element = document.querySelector(selector);
      if (!element) return { selector, missing: true };
      const style = getComputedStyle(element);
      const back = background(element);
      const front = blend(rgba(style.color), back);
      const bounds = element.getBoundingClientRect();
      return {
        selector, foreground: front, background: back,
        textContrast: contrast(front, back),
        borderContrast: contrast(blend(rgba(style.borderTopColor), back), back),
        fontSize: style.fontSize, fontFamily: style.fontFamily, minHeight: style.minHeight,
        outline: style.outline, boxShadow: style.boxShadow,
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      };
    }),
  };
}

export const overviewSelectors = [
  '.nav-link.is-active', '.nav-link:not(.is-active)', '.bill-summary', '.bill-source',
  '.analysis-meta', '.passage-caption', '.passage-stage', '.finding-list p', '.finding-caption',
  '.impact-number.positive', '.impact-number.negative', '.verdict-copy p', '.tradeoff',
  '.verdict-label', '.verdict-action a', '.disclosure-title',
];

export const strategySelectors = [
  '.detail-header p', '.strategy-link[aria-current="true"]', '.strategy-table td.text-right',
  '.status-ready', '.status-risk', '.scenario-control label', '.scenario-control [role="combobox"]',
  '.outcome-summary span', '.outcome-summary strong', '.outcome-warning', '.disclosure-title',
];
