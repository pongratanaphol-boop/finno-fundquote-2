// Review tool removed in this copy: always shows the fund's real data.
window.casePanel = {
  mount(_el, { cases, activeTab }) {
    let tab = activeTab;
    return {
      config() {
        const code = cases.find(c => c.tab === tab).code;
        return window.investmentView.defaultConfig(code);
      },
    };
  },
};
