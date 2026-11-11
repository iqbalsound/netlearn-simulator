/* app.js - Start-up and wiring. Plain <script> tags (no ES modules) so index.html works when double-clicked. */
(function (NL) {
  window.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const topology = new NL.Topology(), engine = new NL.Engine(topology), view = new NL.CanvasView($('canvas'), topology, engine);
    const inspector = new NL.Inspector($('props'), topology, view), term = new NL.TerminalUI($('terminal'), topology);
    NL.buildPalette($('palette'), view); NL.initAbout($('about-dialog'), $('btn-about'));
    const labs = new NL.LabsUI($('labpanel'), topology, view, () => { showTab('lab'); engine.log('Lab loaded - configure the devices, then press "Check my work".'); fitView(); });

    /* ----- tabs ----- */
    function showTab(t) { ['props', 'labpanel'].forEach(id => $(id).hidden = (id === 'props') !== (t === 'props')); document.querySelectorAll('[data-rtab]').forEach(b => b.classList.toggle('active', b.dataset.rtab === t)); }
    document.querySelectorAll('[data-rtab]').forEach(b => b.onclick = () => showTab(b.dataset.rtab));
    function showBottom(t) { ['log', 'terminal'].forEach(id => $(id).hidden = id !== t); document.querySelectorAll('[data-btab]').forEach(b => b.classList.toggle('active', b.dataset.btab === t)); }
    document.querySelectorAll('[data-btab]').forEach(b => b.onclick = () => showBottom(b.dataset.btab)); showBottom('log');
    function fitView() { topology.devices.forEach(d => { d.x = Math.min(d.x, view.w - 50); d.y = Math.min(d.y, view.h - 60); }); }

    /* ----- event log ----- */
    const logEl = $('log');
    engine.onLog(e => { const r = document.createElement('div'); r.className = 'log-' + e.level; r.textContent = (e.t / 1000).toFixed(2).padStart(8) + ' s  ' + e.msg; logEl.appendChild(r); logEl.scrollTop = logEl.scrollHeight; while (logEl.children.length > 400) logEl.removeChild(logEl.firstChild); });
    $('btn-clearlog').onclick = () => { logEl.innerHTML = ''; };

    /* ----- selection ----- */
    view.onSelect = sel => { inspector.render(sel); if (sel) { showTab('props'); if (sel.kind === 'device') term.attach(topology.devices.get(sel.id)); } };
    view.onModeChange = m => { $('btn-link').classList.toggle('active', m === 'link'); $('mode-hint').textContent = m === 'link' ? 'Cable mode: click two devices (Esc cancels)' : ''; };
    topology.onChange = () => refreshPing();

    /* ----- cabling dialog ----- */
    const dlg = $('link-dialog');
    view.onLinkRequest = (aId, bId) => {
      const A = topology.devices.get(aId), B = topology.devices.get(bId), o = d => d.freePorts().map(p => '<option>' + p.name + '</option>').join('');
      if (!A.freePorts().length || !B.freePorts().length) { alert('One of these devices has no free ports.'); return; }
      $('link-a-name').textContent = A.name; $('link-b-name').textContent = B.name; $('link-a-port').innerHTML = o(A); $('link-b-port').innerHTML = o(B); dlg.dataset.a = aId; dlg.dataset.b = bId; dlg.showModal();
    };
    $('link-ok').addEventListener('click', () => { try { const l = topology.connect(dlg.dataset.a, $('link-a-port').value, dlg.dataset.b, $('link-b-port').value); view.select({ kind: 'link', id: l.id }); } catch (e) { alert(e.message); } });

    /* ----- toolbar ----- */
    $('btn-select').onclick = () => view.setMode('select'); $('btn-link').onclick = () => view.setMode(view.mode === 'link' ? 'select' : 'link');
    const refreshPlay = () => { $('btn-play').textContent = engine.running ? 'Pause' : 'Play'; };
    $('btn-play').onclick = () => { engine.toggle(); refreshPlay(); }; $('btn-step').onclick = () => { engine.pause(); engine.step(); refreshPlay(); };
    $('btn-reset').onclick = () => { engine.reset(); refreshPlay(); };
    $('btn-conv').onclick = () => { engine.advance(60000); engine.log('Fast-forwarded 60 s', 'ok'); };
    $('speed').oninput = e => { engine.speed = parseFloat(e.target.value); $('speed-val').textContent = engine.speed + 'x'; };
    $('ctl').onchange = e => { engine.showControl = e.target.checked; };
    setInterval(() => { $('clock').textContent = 'sim ' + (engine.time / 1000).toFixed(2) + ' s · queued ' + engine.queue.length; }, 150);

    function refreshPing() {
      const hs = [...topology.devices.values()].filter(d => d.ifaces.some(i => i.kind !== 'tunnel') && !d.meta.bridge), html = hs.map(h => '<option value="' + h.id + '">' + h.name + '</option>').join('');
      const s = $('ping-src').value, t = $('ping-dst').value; $('ping-src').innerHTML = html; $('ping-dst').innerHTML = html;
      if (s) $('ping-src').value = s; if (t && t !== $('ping-src').value) $('ping-dst').value = t; else if (hs.length > 1) $('ping-dst').value = (hs.find(h => h.id !== $('ping-src').value) || hs[1]).id;
    }
    $('btn-ping').onclick = () => {
      const s = topology.devices.get($('ping-src').value), t = topology.devices.get($('ping-dst').value); if (!s || !t || s === t) { alert('Pick two different devices.'); return; }
      const ip = (t.ifaces.find(i => i.ip && i.up) || {}).ip || (t.ifaces.find(i => i.ip6) || {}).ip6; if (!ip) { alert(t.name + ' has no IP address yet. Configure it first.'); return; }
      engine.play(); refreshPlay(); engine.log(s.name + ' pings ' + t.name + ' (' + ip + ')');
      s.ping(ip, { count: 1, timeout: 5000 }, r => engine.log(r.ok ? 'Reply from ' + r.from + ' time=' + r.rtt.toFixed(1) + ' ms' : 'Ping failed: ' + (r.err || r.type + ' from ' + r.from), r.ok ? 'ok' : 'warn'));
    };

    /* ----- subnet calculator (Lab 02 / Lab 05) ----- */
    $('btn-calc').onclick = () => $('calc-dialog').showModal();
    $('calc-go').addEventListener('click', e => {
      e.preventDefault(); const c = NL.Addr.cidr($('calc-in').value.includes('/') ? $('calc-in').value : $('calc-in').value + '/' + $('calc-mask').value); const o = $('calc-out');
      if (!c || c.v !== 4) { o.textContent = 'Enter an IPv4 address like 172.22.32.12 and a mask (/19 or 255.255.224.0).'; return; }
      const m = $('calc-mask').value.trim(), pl = $('calc-in').value.includes('/') ? c.plen : NL.Addr.plen(m); const i = NL.Addr.subnetInfo(c.ip, pl);
      o.textContent = ['Network   ' + i.network + '/' + pl, 'Mask      ' + i.mask, 'First     ' + i.first, 'Last      ' + i.last, 'Broadcast ' + i.broadcast, 'Hosts     ' + i.hosts, 'Host bits ' + (32 - pl)].join('\n');
    });

    /* ----- save / load ----- */
    $('btn-save').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(topology.toJSON(), null, 1)], { type: 'application/json' })); a.download = 'netlearn-topology.json'; a.click(); URL.revokeObjectURL(a.href); };
    $('btn-load').onclick = () => $('file-load').click();
    $('file-load').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { engine.reset(); topology.fromJSON(JSON.parse(r.result)); view.select(null); } catch (x) { alert('Could not load: ' + x.message); } }; r.readAsText(f); e.target.value = ''; };
    $('btn-new').onclick = () => { if (!topology.devices.size || confirm('Clear the canvas?')) { engine.reset(); topology.clear(); view.select(null); } };

    /* ----- theme ----- */
    const saved = (() => { try { return localStorage.getItem('nl-theme'); } catch (e) { return null; } })(); document.documentElement.dataset.theme = saved || 'dark';
    $('btn-theme').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; try { localStorage.setItem('nl-theme', t); } catch (e) {} };

    refreshPing(); showTab('lab'); term.attach(null);
    engine.log('Welcome! Open the Lab tab and pick a lab from the Computer Networks manual, or drag devices from the left.');
    window.NLApp = { topology, engine, view, labs, term };
  });
})(window.NL = window.NL || {});
