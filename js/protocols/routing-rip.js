/* routing-rip.js - RIP v2 (and RIPng for IPv6): a distance-vector protocol.
 * REAL: periodic updates every 'update' ms to the multicast group, hop-count metric (16 = unreachable),
 *       split horizon, route timeout + garbage collection, administrative distance 120.
 * SIMPLIFIED: no triggered updates, no poison reverse, no authentication. */
(function (NL) {
  const D = NL.Device.prototype, A = NL.Addr;
  NL.onReset.push(d => { d.ripRt = new Map(); });
  NL.onStart.push(d => {
    const r = d.cfg.rip; if (!r.enabled) return;
    d.after(500 + Math.random() * 400, () => d.ripSend());
    d.every(r.update, () => d.ripSend()); d.every(2000, () => d.ripExpire());
  });
  D.ripIfaces = function (v) {
    const nets = this.cfg.rip.networks.map(A.cidr).filter(c => c && c.v === v);
    return this.ifaces.filter(i => { const a = v === 4 ? i.ip : i.ip6, pl = v === 4 ? i.plen : i.plen6; return a && this.ifaceOperUp(i) && nets.some(n => A.inNet(a, n.ip, n.plen)); });
  };
  D.ripSend = function () {
    const r = this.cfg.rip; if (!r.enabled) return;
    [4, 6].forEach(v => this.ripIfaces(v).forEach(i => {
      if (r.passive.includes(i.name)) return;
      const entries = [];
      this.ifaces.forEach(j => { const a = v === 4 ? j.ip : j.ip6, pl = v === 4 ? j.plen : j.plen6; if (a && this.ifaceOperUp(j) && j !== i && (r.redistConn || this.ripIfaces(v).includes(j))) entries.push({ dst: A.netOf(a, pl), plen: pl, metric: 1 }); });
      this.ripRt.forEach(x => { if (x.v === v && x.iface !== i.name) entries.push({ dst: x.dst, plen: x.plen, metric: x.metric }); });   // split horizon
      if (r.defaultOriginate) { const dd = this.lookup(v === 4 ? '0.0.0.0' : '::'); if (dd && dd.proto !== 'R') entries.push({ dst: v === 4 ? '0.0.0.0' : '::', plen: 0, metric: 1 }); }
      if (!entries.length) return;
      this.sendMcast(i, { v, src: v === 4 ? i.ip : i.ip6, dst: v === 4 ? '224.0.0.9' : 'ff02::9', ttl: 1, proto: 17, payload: { sport: v === 4 ? 520 : 521, dport: v === 4 ? 520 : 521, rip: { entries } } }, true);
    }));
  };
  D.ripInput = function (pkt, iface) {
    if (!this.cfg.rip.enabled || !this.ripIfaces(pkt.v).includes(iface)) return;
    pkt.payload.rip.entries.forEach(e => {
      const m = Math.min(16, e.metric + 1), k = e.dst + '/' + e.plen, c = this.ripRt.get(k), now = this.engine.time;
      if (this.ifaces.some(i => (pkt.v === 4 ? i.ip : i.ip6) && A.netOf(pkt.v === 4 ? i.ip : i.ip6, pkt.v === 4 ? i.plen : i.plen6) === e.dst && (pkt.v === 4 ? i.plen : i.plen6) === e.plen)) return;
      if (!c) { if (m < 16) this.ripRt.set(k, { dst: e.dst, plen: e.plen, metric: m, via: pkt.src, iface: iface.name, t: now, v: pkt.v }); }
      else if (c.via === pkt.src) { c.metric = m; c.t = now; delete c.gc; }
      else if (m < c.metric) this.ripRt.set(k, { dst: e.dst, plen: e.plen, metric: m, via: pkt.src, iface: iface.name, t: now, v: pkt.v });
    });
  };
  D.ripExpire = function () {
    const r = this.cfg.rip, now = this.engine.time;
    this.ripRt.forEach((x, k) => {
      const dead = now - x.t > r.timeout || !this.ifaceOperUp(this.iface(x.iface));
      if (dead && x.metric < 16) { x.metric = 16; x.gc = now; }
      if (x.gc && now - x.gc > r.garbage) this.ripRt.delete(k);
    });
  };
  D.ripRoutes = function () { return [...this.ripRt.values()].filter(x => x.metric < 16).map(x => ({ dst: x.dst, plen: x.plen, via: x.via, iface: x.iface, ad: 120, metric: x.metric, proto: 'R', v: x.v })); };
  D.enableRip = function (o) { Object.assign(this.cfg.rip, { enabled: true }, o); this.restart(); };
})(window.NL = window.NL || {});
