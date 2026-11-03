(function () {
'use strict';

/* ============ DATA ============
   FUND_DATA (data.js) is derived from ../data/funds.json by build_data.py. */

const FUND_TABS = Object.keys(window.FUND_DATA);
const RANGES = ['All', '1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y'];
const RETURN_PERIODS = ['3M', 'YTD', '1Y'];
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const FUNDS = {};
for (const tab of FUND_TABS) {
  const raw = window.FUND_DATA[tab];
  const days = [raw.firstDay];
  for (const gap of raw.dayGaps) days.push(days[days.length - 1] + gap);

  // Total-return index: on each XD date, units *= 1 + dividend / NAV on that date (dividend reinvested at NAV).
  const dividendFactor = new Array(days.length).fill(1);
  for (const dividend of raw.dividends) {
    const xdIndex = days.findIndex(day => day >= dividend.xd);
    if (xdIndex < 0) throw new Error(`${raw.code}: XD date after the last NAV`);
    dividendFactor[xdIndex] *= 1 + dividend.value / raw.nav[xdIndex];
  }
  let units = 1;
  const totalReturnIndex = raw.nav.map((nav, i) => {
    units *= dividendFactor[i];
    return nav * units;
  });

  FUNDS[tab] = {
    tab,
    code: raw.code,
    nameTh: raw.nameTh,
    strategy: raw.strategy,
    paysDividend: raw.policy === 'จ่าย',
    days,
    nav: raw.nav,
    aumMillion: raw.aum.map(v => v / 1e6),
    totalReturnIndex,
  };
}

/* ============ STATE ============ */
const state = {
  fundTab: FUND_TABS.find(tab => window.FUND_DATA[tab].code === new URLSearchParams(location.search).get('fund')) || FUND_TABS[0],
  range: '1Y',             // prod's default landing range
  view: 'price',           // 'price' | 'aum'
  includeDividends: false, // persists across fund tabs
};

/* ============ FORMATTING ============ */
const dateOf = day => new Date(day * 86400000);
function thaiDate(day) {
  const d = dateOf(day);
  return `${d.getUTCDate()} ${THAI_MONTHS[d.getUTCMonth()]} ${String((d.getUTCFullYear() + 543) % 100).padStart(2, '0')}`;
}
function signed(value, decimals) {
  const text = Math.abs(value).toFixed(decimals);
  return (value < 0 && Number(text) !== 0 ? '-' : '+') + text;
}
const withCommas = (value, decimals) => value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const lastOf = list => list[list.length - 1];

/* ============ WINDOWS ============ */
// Index of the last data point on or before the cutoff day; -1 when the fund is younger than the window.
function lastIndexOnOrBefore(days, cutoff) {
  let low = 0, high = days.length - 1, answer = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (days[mid] <= cutoff) { answer = mid; low = mid + 1; } else high = mid - 1;
  }
  return answer;
}
function startIndexFor(fund, range) {
  const end = fund.days.length - 1;
  if (range === 'All') return 0;
  if (range === '1D') return end - 1;
  const endDate = dateOf(fund.days[end]);
  let cutoff;
  if (range === 'YTD') cutoff = Date.UTC(endDate.getUTCFullYear() - 1, 11, 31) / 86400000;
  else if (range === '1W') cutoff = fund.days[end] - 7;
  else {
    const amount = parseInt(range, 10);
    const months = range.endsWith('Y') ? amount * 12 : amount;
    cutoff = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - months, endDate.getUTCDate()) / 86400000;
  }
  return lastIndexOnOrBefore(fund.days, cutoff);
}
// A fund younger than the chosen range charts from its first NAV instead.
function currentWindow(fund) {
  return { start: Math.max(0, startIndexFor(fund, state.range)), end: fund.days.length - 1 };
}

/* ============ SERIES ============ */
// What the chart draws, plus the per-point numbers the tooltip shows.
function buildSeries(fund, win, includeDividends) {
  const { start, end } = win;
  const days = fund.days.slice(start, end + 1);
  const realNav = fund.nav.slice(start, end + 1);
  const navStart = fund.nav[start], trStart = fund.totalReturnIndex[start];
  const trPercent = i => (fund.totalReturnIndex[start + i] / trStart - 1) * 100;

  if (state.view === 'aum') {
    const kept = [];
    for (let i = 0; i < days.length; i++) if (fund.aumMillion[start + i] > 0) kept.push(i);
    const aumStart = fund.aumMillion[start + kept[0]];
    return {
      days: kept.map(i => days[i]),
      lineValues: kept.map(i => fund.aumMillion[start + i]),
      bigValues: kept.map(i => fund.aumMillion[start + i]),
      percents: kept.map(i => (fund.aumMillion[start + i] / aumStart - 1) * 100),
      isAum: true,
    };
  }
  if (includeDividends) {
    return {
      days,
      lineValues: days.map((_, i) => navStart * fund.totalReturnIndex[start + i] / trStart), // TradingView ADJ style, in baht
      bigValues: realNav,
      percents: days.map((_, i) => trPercent(i)),
      isAum: false,
    };
  }
  return {
    days,
    lineValues: realNav,
    bigValues: realNav,
    percents: realNav.map(nav => (nav / navStart - 1) * 100),
    isAum: false,
  };
}

function returnForPeriod(fund, period, includeDividends) {
  const start = startIndexFor(fund, period), end = fund.days.length - 1;
  if (start < 0) return null;
  const series = includeDividends ? fund.totalReturnIndex : fund.nav;
  return (series[end] / series[start] - 1) * 100;
}

/* ============ CHART ============ */
const chartEl = document.getElementById('chart');
const PLOT_TOP = 20, X_LABEL_SPACE = 40, ACCENT_WIDTH = 5;   // same plot box as the prod chart
let chartModel = null;   // what is on screen, for hover
let hoverIndex = null;

// Same tick spacing rule as d3.ticks (what the prod chart uses), aiming for about 5 ticks.
function tickStep(low, high, count) {
  const raw = (high - low) / count;
  const power = Math.floor(Math.log10(raw));
  const error = raw / Math.pow(10, power);
  const factor = error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1;
  return factor * Math.pow(10, power);
}
const monthYear = day => `${THAI_MONTHS[dateOf(day).getUTCMonth()]} ${dateOf(day).getUTCFullYear() + 543}`;

function drawChart(series) {
  const width = chartEl.clientWidth, height = chartEl.clientHeight;
  const plotBottom = height - X_LABEL_SPACE;
  const values = series.lineValues;
  let min = Infinity, max = -Infinity;
  for (const v of values) { if (v < min) min = v; if (v > max) max = v; }
  const span = (max - min) || Math.abs(max) * 0.02 || 1;
  const domainMin = min - span * 0.16, domainMax = max + span * 0.1;

  const x0 = series.days[0], x1 = lastOf(series.days);
  const xOf = day => x1 === x0 ? width / 2 : (day - x0) / (x1 - x0) * width;
  const yOf = v => plotBottom - (v - domainMin) / (domainMax - domainMin) * (plotBottom - PLOT_TOP);

  const step = tickStep(domainMin, domainMax, 5);
  let gridLines = '', gridLabels = '';
  for (let tick = Math.ceil(domainMin / step) * step; tick <= domainMax; tick += step) {
    const y = yOf(tick).toFixed(1);
    const label = series.isAum ? withCommas(tick, 0) : tick.toFixed(step < 0.01 ? 4 : 2);
    gridLines += `<line x1="0" x2="${width}" y1="${y}" y2="${y}"/>`;
    gridLabels += `<text class="axis-label" x="20" y="${(yOf(tick) + 10).toFixed(1)}" dominant-baseline="central">${label}</text>`;
  }

  const points = series.days.map((day, i) => [xOf(day), yOf(values[i])]);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const area = `${line}L${lastOf(points)[0].toFixed(1)},${plotBottom}L${points[0][0].toFixed(1)},${plotBottom}Z`;

  chartEl.innerHTML =
    `<div class="chart-watermark"></div>`
    + `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">`
    + `<g class="chart-grid">${gridLines}</g>`
    + `<path d="${area}" fill="var(--chart-area)" fill-opacity=".2"/>`
    + `<path d="${line}" fill="none" stroke="var(--chart-line)" stroke-width="1.5"/>`
    + `<rect x="0" y="${PLOT_TOP}" width="${ACCENT_WIDTH}" height="${plotBottom - PLOT_TOP}" fill="var(--chart-accent)"/>`
    + gridLabels
    + `<text class="axis-label" x="4" y="${height - 14}" dominant-baseline="central">${monthYear(x0)}</text>`
    + `<text class="axis-label" x="${width - 3}" y="${height - 14}" dominant-baseline="central" text-anchor="end">${monthYear(x1)}</text>`
    + `<g id="crosshair" visibility="hidden"><line y1="${PLOT_TOP}" y2="${plotBottom}" stroke="#e1e3e6" stroke-width="1.5"/>`
    + `<circle r="6.5" fill="var(--chart-line)" stroke="#fff" stroke-width="2"/></g>`
    + `</svg>`
    + `<div class="chart-tooltip" id="chart-tooltip"><span class="tip-date"></span><span class="tip-value"></span><span class="tip-percent"></span></div>`;
  chartEl.setAttribute('aria-label', series.isAum ? 'กราฟมูลค่าทรัพย์สิน' : 'กราฟราคา');

  chartModel = { series, points, width, height };
  hoverIndex = null;
}

function nearestIndex(x) {
  const pts = chartModel.points;
  let low = 0, high = pts.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (pts[mid][0] < x) low = mid + 1; else high = mid;
  }
  return low > 0 && Math.abs(pts[low - 1][0] - x) <= Math.abs(pts[low][0] - x) ? low - 1 : low;
}

function showHover(index) {
  const { series, points, width } = chartModel;
  hoverIndex = index;
  const [px, py] = points[index];
  const crosshair = chartEl.querySelector('#crosshair');
  crosshair.setAttribute('visibility', 'visible');
  crosshair.querySelector('line').setAttribute('x1', px);
  crosshair.querySelector('line').setAttribute('x2', px);
  crosshair.querySelector('circle').setAttribute('cx', px);
  crosshair.querySelector('circle').setAttribute('cy', py);

  const tooltip = chartEl.querySelector('#chart-tooltip');
  tooltip.querySelector('.tip-date').textContent = thaiDate(series.days[index]);
  tooltip.querySelector('.tip-value').textContent = series.isAum
    ? `${withCommas(series.bigValues[index], 2)} ล้านบาท`
    : series.bigValues[index].toFixed(4);
  const percent = series.percents[index];
  const percentEl = tooltip.querySelector('.tip-percent');
  percentEl.textContent = `${signed(percent, 2)}%`;
  percentEl.classList.toggle('is-negative', percent < 0);
  tooltip.classList.add('is-visible');
  const tipWidth = tooltip.offsetWidth;
  const left = px + 16 + tipWidth > width ? px - 16 - tipWidth : px + 16;
  tooltip.style.left = `${Math.max(0, left)}px`;
  tooltip.style.top = `${PLOT_TOP + 16}px`;
}

function hideHover() {
  hoverIndex = null;
  const crosshair = chartEl.querySelector('#crosshair');
  if (crosshair) crosshair.setAttribute('visibility', 'hidden');
  const tooltip = chartEl.querySelector('#chart-tooltip');
  if (tooltip) tooltip.classList.remove('is-visible');
}

function onPointer(event) {
  if (!chartModel) return;
  const rect = chartEl.getBoundingClientRect();
  showHover(nearestIndex(event.clientX - rect.left));
}
chartEl.addEventListener('pointermove', onPointer);
chartEl.addEventListener('pointerdown', onPointer);
chartEl.addEventListener('pointerleave', hideHover);
chartEl.addEventListener('pointercancel', hideHover);
chartEl.addEventListener('blur', hideHover);
chartEl.addEventListener('keydown', event => {
  if (!chartModel) return;
  const last = chartModel.points.length - 1;
  if (event.key === 'ArrowLeft') showHover(hoverIndex === null ? last : Math.max(0, hoverIndex - 1));
  else if (event.key === 'ArrowRight') showHover(hoverIndex === null ? last : Math.min(last, hoverIndex + 1));
  else if (event.key === 'Escape') hideHover();
  else return;
  event.preventDefault();
});

/* ============ PAGE ============ */
const el = id => document.getElementById(id);
const rangeTabsEl = el('range-tabs');
const switchEl = el('dividend-switch');
let casePanel;

function buildControls() {
  casePanel = window.casePanel.mount(el('case-panel'), {
    cases: FUND_TABS.map(tab => ({ tab, code: FUNDS[tab].code })),
    activeTab: state.fundTab,
    onChange(tab) {
      state.fundTab = tab;
      render();
    },
  });
  rangeTabsEl.innerHTML = RANGES.map(range =>
    `<button class="range-tab" type="button" data-range="${range}">${range}</button>`).join('')
    + `<span class="range-tab range-tab-custom"><i class="fa-regular" aria-hidden="true">&#xf133;</i><span>กำหนดเอง</span></span>`;
}

function renderHeader(fund) {
  el('fund-code').textContent = fund.code;
  el('fund-name').textContent = fund.nameTh;
  el('fund-price').textContent = lastOf(fund.nav).toFixed(4);
  el('fund-price-date').textContent = thaiDate(lastOf(fund.days));
  el('strategy-text').textContent = fund.strategy;
  window.realSections.render(fund.code);
  window.investmentView.render(fund.code, casePanel.config());
}

function renderControls(fund, win) {
  for (const button of rangeTabsEl.children) {
    const active = button.dataset.range === state.range;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  for (const button of document.querySelectorAll('.view-option')) {
    const active = button.dataset.view === state.view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  }
  // The switch keeps its space when it is not available, so nothing moves.
  const switchAvailable = fund.paysDividend && state.view === 'price';
  switchEl.classList.toggle('is-unavailable', !switchAvailable);
  switchEl.setAttribute('aria-checked', String(state.includeDividends));
}

function headlineText(series) {
  const first = series.lineValues[0], last = lastOf(series.lineValues);
  const change = last - first, percent = change / first * 100;
  const text = series.isAum
    ? `${signed(change, 2)} ล้านบาท (${signed(percent, 2)}%)`
    : `${signed(change, 4)} (${signed(percent, 2)}%)`;
  return { text, negative: change < 0 };
}

function renderHeadline(series) {
  const { text, negative } = headlineText(series);
  const headline = el('headline');
  headline.textContent = text;
  headline.classList.toggle('is-negative', negative);
}

function renderReturns(fund, includeDividends) {
  el('returns-stats').innerHTML = RETURN_PERIODS.map(period => {
    const percent = returnForPeriod(fund, period, includeDividends);
    const value = percent === null ? '-' : `${signed(percent, 2)}%`;
    const negative = percent !== null && percent < 0;
    return `<div class="return-stat"><p class="return-value${negative ? ' is-negative' : ''}">${value}</p><p class="return-label">${period}</p></div>`;
  }).join('');
}

function render() {
  const fund = FUNDS[state.fundTab];
  const win = currentWindow(fund);
  const switchAvailable = fund.paysDividend && state.view === 'price';
  const includeDividends = switchAvailable && state.includeDividends;
  const series = buildSeries(fund, win, includeDividends);

  renderHeader(fund);
  renderControls(fund, win);
  el('range-dates').textContent = `${thaiDate(fund.days[win.start])} - ${thaiDate(fund.days[win.end])}`;
  renderHeadline(series);
  renderReturns(fund, includeDividends);
  drawChart(series);
}

/* ============ EVENTS ============ */
rangeTabsEl.addEventListener('click', event => {
  const button = event.target.closest('[data-range]');
  if (!button) return;
  state.range = button.dataset.range;
  render();
});
switchEl.addEventListener('click', () => {
  state.includeDividends = !state.includeDividends;
  render();
});
document.querySelector('.view-toggle').addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  state.view = button.dataset.view;
  render();
});
new ResizeObserver(() => {
  if (chartModel && (chartEl.clientWidth !== chartModel.width || chartEl.clientHeight !== chartModel.height)) {
    render();
  }
}).observe(chartEl);
document.fonts.ready.then(render);

buildControls();
render();
})();

