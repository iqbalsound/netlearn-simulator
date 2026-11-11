/* canvas.js - Draws the topology, handles dragging, cabling and animation. */
(function (NL) {
  const BOX = 30; // half-size of a device icon in px

  class CanvasView {
    constructor(el, topology, engine) {
      this.el = el; this.ctx = el.getContext('2d');
      this.topology = topology; this.engine = engine;
      this.mode = 'select';           // 'select' | 'link'
      this.selected = null;           // {kind:'device'|'link', id}
      this.linkStart = null;          // device id while cabling
      this.mouse = { x: 0, y: 0 };
      this.drag = null;
      this.onSelect = () => {}; this.onLinkRequest = () => {}; this.onModeChange = () => {};
      this.resize(); window.addEventListener('resize', () => this.resize());
      this.bind();
      this.last = performance.now();
      requestAnimationFrame(t => this.frame(t));
    }

    resize() {
      const r = this.el.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      this.w = r.width; this.h = r.height;
      this.el.width = r.width * dpr; this.el.height = r.height * dpr;
      this.el.style.width = r.width + 'px'; this.el.style.height = r.height + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    setMode(m) { this.mode = m; this.linkStart = null; this.el.style.cursor = m === 'link' ? 'crosshair' : 'default'; this.onModeChange(m); }
    select(sel) { this.selected = sel; this.onSelect(sel); }

    /* ---------- hit testing ---------- */
    deviceAt(x, y) {
      const list = [...this.topology.devices.values()].reverse();
      return list.find(d => Math.abs(x - d.x) <= BOX && Math.abs(y - d.y) <= BOX) || null;
    }
    linkAt(x, y) {
      for (const l of this.topology.links.values()) {
        const a = this.topology.devices.get(l.a.dev), b = this.topology.devices.get(l.b.dev);
        if (!a || !b) continue;
        if (distToSegment(x, y, a.x, a.y, b.x, b.y) < 7) return l;
      }
      return null;
    }

    /* ---------- input ---------- */
    bind() {
      const el = this.el;
      const pos = e => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      el.addEventListener('mousedown', e => {
        const p = pos(e), d = this.deviceAt(p.x, p.y);
        if (this.mode === 'link') {
          if (!d) { this.linkStart = null; return; }
          if (!this.linkStart) { this.linkStart = d.id; }
          else if (this.linkStart !== d.id) { const a = this.linkStart; this.linkStart = null; this.onLinkRequest(a, d.id); }
          return;
        }
        if (d) { this.select({ kind: 'device', id: d.id }); this.drag = { id: d.id, dx: p.x - d.x, dy: p.y - d.y }; }
        else { const l = this.linkAt(p.x, p.y); this.select(l ? { kind: 'link', id: l.id } : null); }
      });
      el.addEventListener('mousemove', e => {
        this.mouse = pos(e);
        if (this.drag) { const d = this.topology.devices.get(this.drag.id); d.x = clamp(this.mouse.x - this.drag.dx, BOX, this.w - BOX); d.y = clamp(this.mouse.y - this.drag.dy, BOX, this.h - BOX); }
      });
      window.addEventListener('mouseup', () => { this.drag = null; });
      el.addEventListener('dragover', e => e.preventDefault());
      el.addEventListener('drop', e => {          // drop from the palette
        e.preventDefault();
        const type = e.dataTransfer.getData('text/netlearn-device'); if (!type) return;
        const p = pos(e); this.addAt(type, p.x, p.y);
      });
      window.addEventListener('keydown', e => {
        if (e.target.matches('input,select,textarea')) return;
        if (e.key === 'Escape') this.setMode('select');
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) this.deleteSelected();
      });
    }
    addAt(type, x, y) { const d = this.topology.addDevice(type, x, y); this.select({ kind: 'device', id: d.id }); return d; }
    deleteSelected() {
      if (!this.selected) return;
      if (this.selected.kind === 'device') this.topology.removeDevice(this.selected.id); else this.topology.removeLink(this.selected.id);
      this.select(null);
    }

    /* ---------- drawing ---------- */
    frame(now) {
      const dt = Math.min(50, now - this.last); this.last = now;
      this.engine.tick(dt);
      this.draw();
      requestAnimationFrame(t => this.frame(t));
    }

    draw() {
      const c = this.ctx, css = getComputedStyle(document.documentElement);
      const v = n => css.getPropertyValue(n).trim();
      c.clearRect(0, 0, this.w, this.h);
      drawGrid(c, this.w, this.h, v('--grid'));

      // links
      for (const l of this.topology.links.values()) {
        const a = this.topology.devices.get(l.a.dev), b = this.topology.devices.get(l.b.dev);
        const sel = this.selected && this.selected.kind === 'link' && this.selected.id === l.id;
        const wifi = l.kind === 'wifi';
        c.lineWidth = sel ? 4 : (wifi ? 1.6 : 2.5);
        c.strokeStyle = l.up ? (sel ? v('--accent') : (wifi ? v('--ok') : v('--link'))) : v('--bad');
        c.setLineDash(l.up ? (wifi ? [3, 5] : []) : [7, 6]);
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]);
        c.font = '11px ' + v('--mono'); c.textAlign = 'center'; c.fillStyle = v('--muted');
        if (!wifi) { c.fillText(l.bandwidth + 'M / ' + l.latency + 'ms', (a.x + b.x) / 2, (a.y + b.y) / 2 - 8); this.portLabel(c, a, b, l.a.port, v('--muted')); this.portLabel(c, b, a, l.b.port, v('--muted')); }
      }
      // rubber-band line while cabling
      if (this.linkStart) {
        const s = this.topology.devices.get(this.linkStart);
        c.strokeStyle = v('--accent'); c.setLineDash([5, 5]); c.lineWidth = 2;
        c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(this.mouse.x, this.mouse.y); c.stroke(); c.setLineDash([]);
      }
      // devices
      for (const d of this.topology.devices.values()) this.drawDevice(c, d, v);
      // packets in flight
      for (const f of this.engine.inflight) {
        const a = this.topology.devices.get(f.fromDev), b = this.topology.devices.get(f.link.other(f.fromDev).dev);
        if (!a || !b) continue; f.packet = f.frame;
        const t = clamp((this.engine.time - f.t0) / Math.max(0.0001, f.t1 - f.t0), 0, 1);
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        c.fillStyle = f.frame.color; c.strokeStyle = v('--bg'); c.lineWidth = 2;
        c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); c.stroke();
      }
      if (!this.topology.devices.size) {
        c.fillStyle = v('--muted'); c.font = '15px ' + v('--sans'); c.textAlign = 'center';
        c.fillText('Drag a device from the left, or open Sample labs.', this.w / 2, this.h / 2);
      }
    }

    portLabel(c, from, to, name, color) {
      const ang = Math.atan2(to.y - from.y, to.x - from.x), r = BOX + 14;
      c.font = '10px ' + getComputedStyle(document.documentElement).getPropertyValue('--mono');
      c.fillStyle = color; c.textAlign = 'center';
      const p = from.iface(name); let t = name;
      if (from.meta.bridge && p && p.l2) t += p.l2.mode === 'trunk' ? ' T' : p.l2.mode === 'access' && p.l2.vlan !== 1 ? ' V' + p.l2.vlan : p.l2.mode === 'none' ? ' x' : '';
      c.fillText(t, from.x + Math.cos(ang) * r, from.y + Math.sin(ang) * r + 3);
    }

    drawDevice(c, d, v) {
      const meta = NL.deviceTypes[d.type];
      const sel = this.selected && this.selected.kind === 'device' && this.selected.id === d.id;
      const start = this.linkStart === d.id;
      c.fillStyle = v('--panel'); c.strokeStyle = sel || start ? v('--accent') : meta.color; c.lineWidth = sel || start ? 3 : 2;
      roundRect(c, d.x - BOX, d.y - BOX, BOX * 2, BOX * 2, 10); c.fill(); c.stroke();
      c.fillStyle = meta.color; c.font = '700 17px ' + v('--mono'); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(meta.glyph, d.x, d.y); c.textBaseline = 'alphabetic';
      c.fillStyle = v('--text'); c.font = '600 12px ' + v('--sans');
      c.fillText(d.name, d.x, d.y + BOX + 28);
      const ip = (d.ifaces.find(i => i.ip) || {}).ip; if (ip) { c.fillStyle = v('--muted'); c.font = '10px ' + v('--mono'); c.fillText(ip, d.x, d.y + BOX + 41); }
      if (d.type === 'wireless-ap') { c.strokeStyle = meta.color; c.lineWidth = 1.5; [8, 14].forEach(r => { c.beginPath(); c.arc(d.x, d.y - 24, r, -2.2, -0.94); c.stroke(); }); }
      if (d.ifaces.some(i => i.kind === 'wlan' && i.wifi && i.wifi.state === 'connected')) { c.fillStyle = v('--ok'); c.font = '700 11px ' + v('--mono'); c.fillText('WiFi', d.x + 18, d.y - BOX + 12); }
    }
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0; t = clamp(t, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function drawGrid(c, w, h, color) { c.fillStyle = color; for (let x = 20; x < w; x += 28) for (let y = 20; y < h; y += 28) c.fillRect(x, y, 1.5, 1.5); }

  NL.CanvasView = CanvasView;
})(window.NL = window.NL || {});
