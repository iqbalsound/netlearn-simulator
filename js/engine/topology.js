/* topology.js - Holds devices and links; saves/loads JSON; manages Wi-Fi associations. */
(function (NL) {
  class Topology {
    constructor() { this.devices = new Map(); this.links = new Map(); this.onChange = () => {}; this.engine = null; }
    changed() { this.refreshWifi(); this.onChange(); }

    addDevice(type, x, y, opts) {
      const def = NL.deviceTypes[type]; if (!def) throw new Error('Unknown device type: ' + type);
      opts = opts || {};
      const count = [...this.devices.values()].filter(d => d.type === type).length + 1;
      const dev = new def.cls(opts.id, opts.name || def.short + count, x, y, opts);
      dev.topo = this; this.devices.set(dev.id, dev); this.changed();
      if (this.engine) dev.restart(true);
      return dev;
    }
    removeDevice(id) {
      const d = this.devices.get(id); if (!d) return;
      d.ifaces.forEach(p => { if (p.linkId) this.removeLink(p.linkId, true); (p.wifiLinks || []).slice().forEach(l => this.removeLink(l, true)); });
      this.devices.delete(id); this.changed();
    }
    byName(n) { return [...this.devices.values()].find(d => d.name === n || d.id === n); }
    findByIp(ip) { for (const d of this.devices.values()) if (d.ifaces.some(i => i.ip === ip || i.ip6 === ip)) return d; return null; }
    connect(a, pa, b, pb, opts) {
      if (a === b) throw new Error('A device cannot be cabled to itself.');
      const A = this.devices.get(a), B = this.devices.get(b); if (!A || !B) throw new Error('Unknown device');
      const ia = A.iface(pa), ib = B.iface(pb); if (!ia || !ib) throw new Error('Unknown port ' + (ia ? pb : pa));
      if (ia.linkId || ib.linkId) throw new Error('That port already has a cable. Pick a free port.');
      const l = new NL.Link({ dev: a, port: pa }, { dev: b, port: pb }, opts);
      this.links.set(l.id, l); ia.linkId = l.id; ib.linkId = l.id; this.changed();
      [A, B].forEach(d => d.engine && d.restart()); return l;
    }
    removeLink(id, silent) {
      const l = this.links.get(id); if (!l) return;
      [l.a, l.b].forEach(e => { const d = this.devices.get(e.dev); if (!d) return; const p = d.iface(e.port); if (!p) return; if (p.linkId === id) p.linkId = null; if (p.wifiLinks) p.wifiLinks = p.wifiLinks.filter(x => x !== id); });
      this.links.delete(id); if (!silent) this.changed();
    }
    clear() { this.devices.clear(); this.links.clear(); this.changed(); }

    /** Wi-Fi: each client NIC with an SSID joins the first AP broadcasting it (and password matches). Distance is ignored. */
    refreshWifi() {
      const aps = [...this.devices.values()].filter(d => d.type === 'wireless-ap');
      const want = new Map();
      this.devices.forEach(d => {
        if (d.type === 'wireless-ap') return;
        const w = d.ifaces.find(i => i.kind === 'wlan'); if (!w || !w.up || !w.wifi || !w.wifi.ssid) { if (w && w.wifi) w.wifi.state = 'idle'; return; }
        const ap = aps.find(a => a.cfg.ssid === w.wifi.ssid);
        if (!ap) { w.wifi.state = 'network not found'; return; }
        if (ap.cfg.security !== 'open' && ap.cfg.password !== w.wifi.password) { w.wifi.state = 'authentication failed'; return; }
        want.set(d.id, ap.id); w.wifi.state = 'connected';
      });
      [...this.links.values()].filter(l => l.kind === 'wifi').forEach(l => { if (want.get(l.a.dev) !== l.b.dev) this.removeLink(l.id, true); });
      want.forEach((apId, cid) => {
        const c = this.devices.get(cid), ap = this.devices.get(apId), cw = c.ifaces.find(i => i.kind === 'wlan'), aw = ap.ifaces.find(i => i.kind === 'wlan');
        if (cw.linkId && this.links.has(cw.linkId)) return;
        const l = new NL.Link({ dev: cid, port: cw.name }, { dev: apId, port: aw.name }, { id: 'W' + cid + apId, kind: 'wifi', bandwidth: 54, latency: 2 });
        l.clientMac = cw.mac; this.links.set(l.id, l); cw.linkId = l.id; aw.wifiLinks.push(l.id);
        if (this.engine) c.restart();
      });
    }

    toJSON() { return { app: 'NetLearn Simulator', version: 2, devices: [...this.devices.values()].map(d => d.toJSON()), links: [...this.links.values()].filter(l => l.kind !== 'wifi').map(l => l.toJSON()) }; }
    fromJSON(data) {
      if (!data || !Array.isArray(data.devices)) throw new Error('This file is not a NetLearn topology.');
      this.devices.clear(); this.links.clear();
      data.devices.forEach(o => {
        const def = NL.deviceTypes[o.type]; if (!def) return;
        const d = new def.cls(o.id, o.name, o.x, o.y, { ports: (o.ifaces || []).filter(i => i.kind === 'eth').map(i => i.name) });
        d.topo = this; d.load(o); this.devices.set(d.id, d);
      });
      (data.links || []).forEach(l => {
        const A = this.devices.get(l.a.dev), B = this.devices.get(l.b.dev); if (!A || !B) return;
        const ia = A.iface(l.a.port), ib = B.iface(l.b.port); if (!ia || !ib) return;
        ia.linkId = l.id; ib.linkId = l.id; this.links.set(l.id, new NL.Link(l.a, l.b, l)); NL.Link.bumpId(parseInt(String(l.id).replace(/\D/g, '') || '0', 10));
      });
      this.changed(); this.devices.forEach(d => d.engine && d.restart(true));
    }
  }
  NL.Topology = Topology;
})(window.NL = window.NL || {});
