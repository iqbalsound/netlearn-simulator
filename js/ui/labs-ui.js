/* labs-ui.js - Lab library panel: objective, steps, hints, auto-check, model solution. */
(function (NL) {
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  NL.LabsUI = class {
    constructor(el, topo, view, onLoad) {
      this.el = el; this.topo = topo; this.view = view; this.onLoad = onLoad; this.lab = null; this.render();
      el.addEventListener('click', e => { const a = e.target.dataset.lab; if (a) this[a](); });
      el.addEventListener('change', e => { if (e.target.id === 'lab-sel' && e.target.value) this.open(e.target.value); });
    }
    render(res) {
      const groups = {}; NL.LABS.forEach(l => (groups[l.group] = groups[l.group] || []).push(l));
      let h = '<select id="lab-sel"><option value="">Choose a lab…</option>' + Object.entries(groups).map(([g, ls]) => '<optgroup label="' + g + '">' + ls.map(l => '<option value="' + l.id + '"' + (this.lab && this.lab.id === l.id ? ' selected' : '') + '>' + esc(l.title) + '</option>').join('') + '</optgroup>').join('') + '</select>';
      const L = this.lab;
      if (L) {
        h += '<h3>' + esc(L.title) + '</h3><span class="badge">' + L.level + '</span><p>' + esc(L.objective) + '</p><ol>' + L.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol>' +
          '<details><summary>Hints</summary><ul>' + L.hints.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul></details>' +
          '<div class="btns"><button class="primary" data-lab="check">Check my work</button><button data-lab="converge">Converge +60 s</button><button data-lab="reset">Reset lab</button><button data-lab="solve" class="warn">Show solution</button></div>';
        if (res) h += '<h4>' + res.filter(r => r.pass).length + ' / ' + res.length + ' checks passed</h4><ul class="checks">' + res.map(r => '<li class="' + (r.pass ? 'pass' : 'fail') + '">' + (r.pass ? '✔ ' : '✘ ') + esc(r.desc) + '<small> ' + esc(r.note) + '</small></li>').join('') + '</ul>';
      } else h += '<p class="hint">Pick a lab from the Computer Networks lab manual (Labs 01-15) or an extra lab. The topology is cabled for you; you configure the devices.</p>';
      this.el.innerHTML = h;
    }
    open(id) { this.lab = NL.LABS.find(l => l.id === id); NL.LabEngine.load(this.topo, this.lab); this.view.select(null); this.onLoad && this.onLoad(this.lab); this.render(); }
    reset() { this.open(this.lab.id); }
    check() { const eng = this.topo.engine, save = eng.running; this.render(NL.LabEngine.check(this.topo, this.lab)); }
    converge() { this.topo.engine.advance(60000); this.topo.engine.log('Fast-forwarded 60 s of simulated time (routing protocols converged)', 'ok'); }
    solve() { if (!confirm('Apply the model solution? It overwrites your configuration (teachers: use it to compare).')) return; NL.LabEngine.solve(this.topo, this.lab); this.topo.engine.advance(30000); this.view.select(this.view.selected); this.topo.onChange(); this.render(); }
  };
})(window.NL = window.NL || {});
