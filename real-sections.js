// PROTOTYPE: the sections around Investment View, rebuilt from the live fund page so the layout can be judged in context.
(function () {
'use strict';

const DATA = window.REAL_SECTIONS;
const root = document.getElementById('real-sections');
const escapeHtml = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const articleLink = (href, inner) => href ? `<a href="${href}" target="_blank" rel="noopener">${inner}</a>` : inner;

function detailRowHtml(row) {
  const isDocument = row.label === 'หนังสือชี้ชวน';
  let value = escapeHtml(row.value);
  if (isDocument && row.href) value = `<a class="document-link" href="${row.href}" target="_blank" rel="noopener"><i class="fa-regular" aria-hidden="true">&#xf15c;</i>${value}</a>`;
  else if (row.href) value = `<a class="detail-link" href="${row.href}" target="_blank" rel="noopener">${value}</a>`;
  else if (row.logo) value = `<span class="detail-amc"><img src="${row.logo}" alt="">${value}</span>`;
  return `<div class="detail-row"><span class="detail-label">${escapeHtml(row.label)}</span><span class="detail-value">${value}</span></div>`;
}

function detailsHtml(fund) {
  const left = fund.detail.filter(row => row.left).map(detailRowHtml).join('');
  const right = fund.detail.filter(row => !row.left).map(detailRowHtml).join('');
  return `<section class="real-section"><h2 class="section-title">รายละเอียดกองทุน</h2>
    <div class="detail-grid"><div class="detail-column">${left}</div><div class="detail-column">${right}</div></div>
    <p class="detail-note">${escapeHtml(fund.note)}</p></section>`;
}

function articlesHtml(fund) {
  const { lead, side } = fund;
  const items = side.map(item => `<li class="article-item">${articleLink(item.href, `<img src="${item.img}" alt=""><h3 class="article-title">${escapeHtml(item.title)}</h3>`)}</li>`).join('');
  return `<section class="real-section"><h2 class="section-title">บทความที่เกี่ยวข้องล่าสุด</h2>
    <div class="article-grid">
      <article class="article-lead">${articleLink(lead.href, `<img class="article-cover" src="${lead.img}" alt=""><h3 class="article-title">${escapeHtml(lead.title)}</h3>`)}
        <p class="article-desc">${escapeHtml(lead.desc)}</p>
        <div class="article-meta"><span class="article-author"><img src="${lead.authorImg}" alt="">${escapeHtml(lead.author)}</span><time>${escapeHtml(lead.date)}</time><span><i class="fa-regular" aria-hidden="true">&#xf06e;</i> ${escapeHtml(lead.views)}</span></div>
      </article>
      <ul class="article-list">${items}</ul>
    </div></section>`;
}

function diagramHtml(fund, code) {
  const pill = item => `<p class="diagram-label">${escapeHtml(item.label)}</p><span class="value-pill ${item.tone}">${escapeHtml(item.value)}</span>`;
  const [past, drawdown, risk] = fund.pills;
  return `<section class="real-section diagram"><p class="section-title">Finnomena 3D Diagram</p><h2 class="diagram-code">${escapeHtml(code)}</h2>
    <div class="diagram-layout">
      <div class="diagram-side">${pill(past)}</div>
      <div class="diagram-center"><p class="diagram-label">เส้นประ คือ ค่าเฉลี่ย</p>${fund.svg.replace('<g ', '<defs><linearGradient id="diagram-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17508f"/><stop offset="1" stop-color="#a9c8e6"/></linearGradient></defs><g ')}<div class="diagram-bottom">${pill(drawdown)}</div></div>
      <div class="diagram-side">${pill(risk)}</div>
    </div></section>`;
}

function relatedHtml(fund) {
  const items = fund.related.map(item => `<div class="related-item"><img src="${item.logo}" alt=""><p>${escapeHtml(item.code)}</p></div>`).join('');
  return `<section class="real-section"><h2 class="related-title">กองทุนในหมวดหมู่เดียวกัน</h2><div class="related-list">${items}</div></section>`;
}

window.realSections = {
  render(code) {
    if (root.dataset.code === code) return;
    root.dataset.code = code;
    const fund = DATA.funds[code];
    root.innerHTML = detailsHtml(fund) + articlesHtml(fund)
      + `<section class="real-section"><img class="real-banner" src="${DATA.banner}" alt=""></section>`
      + diagramHtml(fund, code) + relatedHtml(fund);
  },
};
})();

