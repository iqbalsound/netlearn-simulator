/* terminal-ui.js - Per-device terminal in the bottom panel (history with arrow keys, Tab completion, "?" help). */
(function (NL) {
  NL.TerminalUI = class {
    constructor(el, topo) {
      this.el = el; this.topo = topo; this.dev = null; this.hist = []; this.hi = 0;
      el.innerHTML = '<div class="term-out" id="term-out"></div><div class="term-in"><span id="term-prompt"></span><input id="term-input" autocomplete="off" spellcheck="false" placeholder="type a command - help or ? to list"></div>';
      this.out = el.querySelector('#term-out'); this.inp = el.querySelector('#term-input'); this.pr = el.querySelector('#term-prompt');
      this.inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') this.exec(this.inp.value);
        else if (e.key === 'ArrowUp') { this.hi = Math.max(0, this.hi - 1); this.inp.value = this.hist[this.hi] || ''; e.preventDefault(); }
        else if (e.key === 'ArrowDown') { this.hi = Math.min(this.hist.length, this.hi + 1); this.inp.value = this.hist[this.hi] || ''; e.preventDefault(); }
        else if (e.key === 'Tab') { const m = NL.Cli.complete(this.inp.value); if (m.length === 1) this.inp.value = m[0] + ' '; else if (m.length) this.print(m.join('   ')); e.preventDefault(); }
        else if (e.key === '?') { const m = NL.Cli.complete(this.inp.value); this.print((this.inp.value ? this.inp.value + '? -> ' : '') + (m.length ? m.join('   ') : NL.Cli.names.join('   '))); e.preventDefault(); }
      });
    }
    attach(dev) { this.dev = dev; this.pr.textContent = dev ? NL.Cli.prompt(dev) : ''; if (!dev) this.print('Select a device on the canvas to open its terminal.'); }
    print(t) { const d = document.createElement('div'); d.textContent = t; this.out.appendChild(d); this.out.scrollTop = this.out.scrollHeight; }
    clear() { this.out.innerHTML = ''; }
    exec(line) {
      if (!this.dev || !this.topo.devices.has(this.dev.id)) { this.print('No device selected.'); return; }
      this.print(NL.Cli.prompt(this.dev) + line); if (line.trim()) { this.hist.push(line); this.hi = this.hist.length; } this.inp.value = '';
      NL.Cli.run(this.dev, line, t => this.print(t), this); this.pr.textContent = NL.Cli.prompt(this.dev); this.topo.onChange();
    }
  };
})(window.NL = window.NL || {});
