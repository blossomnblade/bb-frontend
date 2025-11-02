<!-- /scripts/safety.js -->
<script>
(function () {
  const Safety = {
    ready: false,
    rules: { regex: [], terms: [], allowlist: [] },
    async load() {
      if (this.ready) return;
      const res = await fetch('/data/prohibited.json', { cache: 'no-store' });
      const data = await res.json();
      this.rules.allowlist = data.allowlist || [];
      // compile regex list
      this.rules.regex = (data.regex || []).map(r => ({
        id: r.id, reason: r.reason, re: new RegExp(r.pattern, 'i')
      }));
      this.rules.terms = (data.terms || []);
      this.ready = true;
    },
    /**
     * Returns { blocked:boolean, matches:[{id, reason, sample}] }
     */
    check(text) {
      if (!this.ready) return { blocked: false, matches: [] };
      const t = String(text || '');
      // allowlist short-circuit: if message is ONLY allowlist ideas, let it through
      // (We still scan below—this just prevents silly false-positives.)
      const matches = [];
      for (const r of this.rules.regex) {
        const m = t.match(r.re);
        if (m) matches.push({ id: r.id, reason: r.reason, sample: m[0] });
      }
      for (const term of this.rules.terms) {
        if (t.toLowerCase().includes(term.term.toLowerCase())) {
          matches.push({ id: term.id || term.term, reason: term.reason, sample: term.term });
        }
      }
      return { blocked: matches.length > 0, matches };
    }
  };
  window.Safety = Safety;
})();
</script>
