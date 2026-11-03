// The Investment View section. Follows Market Info 2025 frame 12633:156356. Hidden when a fund has no data.
(function () {
'use strict';

const DATA = window.INVESTMENT_VIEW_DATA;
const CALLS = window.INVESTMENT_CALLS;
const PICK_REASONS = window.INVESTMENT_PICK_REASONS;
const PICK_IMAGE = 'https://scontent.finnomena.com/fund/pick.png';
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const CATEGORY_SIGNALS = {
  1: { label: 'ขาย', tone: 'sell' }, 2: { label: 'ทยอยขาย', tone: 'sell' }, 3: { label: 'ถือ', tone: 'hold' },
  4: { label: 'ทยอยซื้อ', tone: 'buy' }, 5: { label: 'ซื้อ', tone: 'buy' },
};
const CALL_SIGNALS = {
  BUY: { label: 'ซื้อ', tone: 'buy' }, HOLD: { label: 'ถือ', tone: 'hold' }, SELL: { label: 'ขาย', tone: 'sell' },
};

const root = document.getElementById('investment-view');
const pickRoot = document.getElementById('fund-pick');
const viewGroup = document.getElementById('group-view');

const escapeHtml = text => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const wordsHtml = text => text.split(' ').map(word => `<span class="iv-word">${escapeHtml(word)}</span>`).join(' ');

function thaiDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${THAI_MONTHS[month - 1]} ${String(year + 543).slice(-2)}`;
}

const allCalls = Object.values(CALLS).flat();
const firstKey = object => Object.keys(object)[0];

// What a fund really shows, in the shape the case panel can override.
function defaultConfig(code) {
  const fund = DATA.funds[code];
  return {
    gauge: fund.hasCategoryView ? DATA.categoryViews[fund.category].gauge : 0,
    pick: Boolean(DATA.fundPicks[code]),
    calls: (CALLS[code] || []).map(({ name, status }) => ({ name, status })),
  };
}

/* The category view and F Pick are independent: a fund can have either, both or neither.
   A case the fund has no text for borrows text from another fund. */
function investmentViewFor(code, config) {
  const fund = DATA.funds[code];
  const pickCode = DATA.fundPicks[code] ? code : firstKey(DATA.fundPicks);
  const sourceView = DATA.categoryViews[fund.category] || DATA.categoryViews[firstKey(DATA.categoryViews)];
  return {
    category: fund.category,
    categoryView: config.gauge ? { ...sourceView, gauge: config.gauge } : null,
    pick: config.pick ? { ...DATA.fundPicks[pickCode], reasons: PICK_REASONS[pickCode] } : null,
    calls: config.calls.map(({ name, status }) => {
      const source = (CALLS[code] || []).find(call => call.name === name) || allCalls.find(call => call.name === name);
      return { ...source, status };
    }),
  };
}

const signalNodeHtml = tone => `<span class="iv-node iv-node-${tone}"><span class="iv-node-icon" aria-hidden="true"></span></span>`;
const dateHtml = iso => `<p class="iv-date"><span class="iv-clock" aria-hidden="true"></span>${thaiDate(iso)}</p>`;

function categoryViewHtml(category, { gauge, view, updated }) {
  const { label, tone } = CATEGORY_SIGNALS[gauge];
  return `<h3 class="iv-label"><span>มุมมองต่อกองทุนประเภท</span><span>${escapeHtml(category)}</span></h3>
    <div class="iv-opinion">
      ${signalNodeHtml(tone)}
      <div class="iv-opinion-body">
        <div class="iv-opinion-text">
          <p class="iv-who"><span>Finnomena Funds</span><span>แนะนำ${label}</span></p>
          <p class="iv-text">${wordsHtml(view)}</p>
        </div>
        ${dateHtml(updated)}
      </div>
    </div>`;
}

function pickReasonsHtml({ reasons, updated }) {
  const items = reasons.map(text => `<li><span class="iv-check" aria-hidden="true"></span><span class="iv-text">${wordsHtml(text)}</span></li>`).join('');
  return `<h3 class="iv-label iv-pick-title">ทำไมเราถึงเลือกกองนี้เป็น<span class="iv-pick-badge"><img src="assets/f-pick-symbol.svg" alt="" width="8.526" height="10.667">PICK</span></h3>
    <div class="iv-pick-body"><ul class="iv-reasons">${items}</ul>${dateHtml(updated)}</div>`;
}

function callHtml(call) {
  const { label, tone } = CALL_SIGNALS[call.status];
  return `<article class="iv-call">
    <div class="iv-call-rail">${signalNodeHtml(tone)}</div>
    <div class="iv-call-content">
      <div class="iv-call-text">
        <p class="iv-who"><span>${escapeHtml(call.name)}</span><span>แนะนำ${label}</span></p>
        <p class="iv-call-summary">${wordsHtml(call.view)}</p>
      </div>
      <div class="iv-call-meta">
        ${dateHtml(call.updated)}
        <a class="iv-article-link" href="${call.articleUrl}" target="_blank" rel="noopener" aria-label="อ่านบทความของ ${escapeHtml(call.name)}"><span aria-hidden="true"></span></a>
      </div>
    </div>
  </article>`;
}

// Section 1 (fund information): the F PICK reasons.
function pickSectionHtml(pick) {
  return `<div class="iv-card">${pickReasonsHtml(pick)}</div>`;
}

// Section 2 (investment view): Investment view first, then Investment call.
function viewSectionHtml({ category, categoryView, calls }) {
  const latestCallsFirst = [...calls].sort((a, b) => b.updated.localeCompare(a.updated));
  const house = categoryView ? `<section class="iv-section">
      <h3 class="iv-owner"><span class="iv-title">Investment view</span><span class="iv-sub">มุมมองการลงทุนโดย Finnomena Funds</span></h3>
      <div class="iv-card">${categoryViewHtml(category, categoryView)}</div>
    </section>` : '';
  const callSection = calls.length ? `<section class="iv-section">
      <h3 class="iv-owner"><span class="iv-title">Investment call</span><span class="iv-sub">มุมมองจากผู้แนะนำการลงทุน</span></h3>
      <div class="iv-calls">${latestCallsFirst.map(callHtml).join('')}</div>
    </section>` : '';
  return house + callSection;
}

function renderBadges({ pick, calls }) {
  const callBadges = calls.map(call =>
    `<a class="call-badge" href="${call.articleUrl}" target="_blank" rel="noopener">${call.avatar ? `<img src="${call.avatar}" alt="">` : ''}<span>${call.name}</span></a>`).join('');
  const pickMark = pick ? `<img class="pick-mark" src="${PICK_IMAGE}" alt="F Pick">` : '';
  document.getElementById('fund-badges').innerHTML = callBadges + pickMark;
}

let renderedKey = null;
window.investmentView = {
  SIGNAL_OPTIONS: Object.entries(CALL_SIGNALS).map(([status, { label }]) => [status, label]),
  CALL_PEOPLE: [...new Set(allCalls.map(call => call.name))],
  defaultConfig,
  render(code, config) {
    // The page re-renders on every chart change; only a new fund or case redraws this section.
    const key = JSON.stringify([code, config]);
    if (key === renderedKey) return;
    renderedKey = key;
    const investmentView = investmentViewFor(code, config);
    renderBadges(investmentView);
    const { categoryView, pick, calls } = investmentView;
    pickRoot.hidden = !pick;
    pickRoot.innerHTML = pick ? pickSectionHtml(pick) : '';
    const hasView = Boolean(categoryView) || calls.length > 0;
    viewGroup.hidden = !hasView;
    root.innerHTML = hasView ? viewSectionHtml(investmentView) : '';
  },
};
})();
