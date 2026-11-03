# finno-fundquote-2

Copy of the investment-view fund page (K-GTECH only), regrouped per the team comment.

## Layout
1. **ข้อมูลกองทุน** (fund information): กลยุทธ์การลงทุน (Morningstar text), then the F PICK reasons.
2. **มุมมองการลงทุน** (investment view): Investment view (house category view), then Investment call (recommenders).

Static site, no build step: open `index.html` (serve over http for best results).

## Notes
- `data.js` and `real-sections-data.js` are trimmed to K-GTECH.
- The case-panel / spec-notes review tools are removed (`case-panel.js` is a small stub).
- `fonts/` is not included: add `fa-sharp-*.otf` and `FinnomenaTrek-*.otf` (see `styles.css`) for icons and the brand font.
- Header logo is a text placeholder; add `assets/logo.svg` if you want the original.
