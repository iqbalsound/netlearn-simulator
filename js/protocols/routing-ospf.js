/* routing-ospf.js - OSPF (v2 for IPv4, "v3" for IPv6): a link-state protocol.
 * REAL: Hello packets -> neighbours -> adjacency; routers flood LSAs; every router runs Dijkstra (SPF) on the same database;
 *       administrative distance 110; default-route origination.
 * SIMPLIFIED: neighbour states are Down/Init/Full (no ExStart/Exchange/Loading), no DR/BDR election,
 *       areas are tagged but all routers share one flat database (single-area behaviour). */
(function (NL) {
  const D = NL.Device.prototype, A = NL.Addr;
  const mk = () => ({ nbrs: new Map(), lsdb: new Map(), seq: 0, routes: [], last: '' });
  NL.onReset.push(d => { d.ospfSt = { 4: mk(), 6: mk() }; });
  NL.onStart.push(d => {
    const o = d.cfg.ospf; if (!o.enabled) return;
    d.after(300, () => { d.ospfHello(); d.ospfOriginate(true); });
    d.every(o.hello, () => { d.ospfDead(); d.ospfHello(); d.ospfOriginate(false); });
  });
  D.ospfRid = function () {
    if (this.cfg.ospf.routerId) return this.cfg.ospf.routerId;
    const ips = this.ifaces.map(i => i.ip).filter(Boolean).sort((a, b) => (A.parse(b).n > A.parse(a).n ? 1 : -1));
    return ips[0] || '10.255.255.' + (1 + (parseInt(this.id.replace(/\D/g, '') || '1', 10) % 250));
  };
  D.ospfNetFor = function (i, v) { const a = v === 4 ? i.ip : i.ip6; if (!a) return null; return this.cfg.ospf.networks.map(n => ({ c: A.cidr(n.network), area: n.area || '0.0.0.0' })).find(n => n.c && n.c.v === v && A.inNet(a, n.c.ip, n.c.plen)); };
  D.ospfIfaces = function (v) { return this.ifaces.filter(i => this.ifaceOperUp(i) && this.ospfNetFor(i, v)); };
  D.ospfHello = function () {
    [4, 6].forEach(v => this.ospfIfaces(v).forEach(i => {
      const seen = [...this.ospfSt[v].nbrs.values()].filter(n => n.iface === i.name).map(n => n.rid);
      this.sendMcast(i, { v, src: v === 4 ? i.ip : i.ip6, dst: v === 4 ? '224.0.0.5' : 'ff02::5', ttl: 1, proto: 89, payload: { ospf: { t: 'hello', rid: this.ospfRid(), area: this.ospfNetFor(i, v).area, seen } } }, true);
    }));
  };
  D.ospfSend = function (i, v, lsas) { this.sendMcast(i, { v, src: v === 4 ? i.ip : i.ip6, dst: v === 4 ? '224.0.0.5' : 'ff02::5', ttl: 1, proto: 89, payload: { ospf: { t: 'lsu', rid: this.ospfRid(), lsas } } }, true); };
  D.ospfInput = function (pkt, iface) {
    const v = pkt.v, o = pkt.payload.ospf, S = this.ospfSt[v], my = this.ospfRid(); if (!this.cfg.ospf.enabled) return;
    const net = this.ospfNetFor(iface, v); if (!net || o.rid === my) return;
    if (o.t === 'hello') {
      if (o.area !== net.area) return;
      let n = S.nbrs.get(o.rid); if (!n) { n = { rid: o.rid, ip: pkt.src, iface: iface.name, state: 'Init', area: o.area }; S.nbrs.set(o.rid, n); }
      n.t = this.engine.time;
      if (o.seen.includes(my)) { if (n.state !== 'Full') { n.state = 'Full'; this.log('OSPF' + (v === 6 ? 'v3' : '') + ' adjacency Full with ' + o.rid + ' on ' + iface.name, 'ok'); this.ospfSend(iface, v, [...S.lsdb.values()]); this.ospfOriginate(true); } } else n.state = 'Init';
    } else if (o.t === 'lsu') {
      const fresh = []; o.lsas.forEach(l => { const c = S.lsdb.get(l.rid); if (!c || l.seq > c.seq) { S.lsdb.set(l.rid, JSON.parse(JSON.stringify(l))); fresh.push(l); } });
      if (fresh.length) { this.ospfIfaces(v).forEach(i => { if (i !== iface) this.ospfSend(i, v, fresh); }); this.ospfSpf(v); }
    }
  };
  D.ospfDead = function () {
    [4, 6].forEach(v => { const S = this.ospfSt[v]; S.nbrs.forEach((n, k) => { const i = this.iface(n.iface); if (this.engine.time - n.t > this.cfg.ospf.dead || !this.ifaceOperUp(i)) { S.nbrs.delete(k); this.log('OSPF neighbour ' + k + ' down', 'warn'); } }); });
  };
  D.ospfOriginate = function (force) {
    [4, 6].forEach(v => {
      const S = this.ospfSt[v], links = [];
      this.ospfIfaces(v).forEach(i => { const a = v === 4 ? i.ip : i.ip6, pl = v === 4 ? i.plen : i.plen6, nb = [...S.nbrs.values()].filter(n => n.iface === i.name && n.state === 'Full').map(n => n.rid); links.push({ type: nb.length ? 'transit' : 'stub', dst: A.netOf(a, pl), plen: pl, cost: i.cost || 1, addr: a }); });
      const od = this.cfg.ospf.defaultOriginate, dd = this.lookup(v === 4 ? '0.0.0.0' : '::');
      if (links.length && (od === 'always' || (od === 'if-installed' && dd && dd.proto !== 'O'))) links.push({ type: 'stub', dst: v === 4 ? '0.0.0.0' : '::', plen: 0, cost: 1, addr: null });
      const sig = JSON.stringify(links);
      if (force || sig !== S.last) { S.last = sig; S.seq++; const l = { rid: this.ospfRid(), seq: S.seq, links }; S.lsdb.set(l.rid, l); this.ospfIfaces(v).forEach(i => this.ospfSend(i, v, [l])); this.ospfSpf(v); }
    });
  };
  /** Dijkstra over a bipartite graph: routers <-> prefixes. First hop = neighbour address on the shared prefix. */
  D.ospfSpf = function (v) {
    const S = this.ospfSt[v], me = this.ospfRid(), dist = new Map(), hop = new Map(), todo = new Set(['r:' + me]); dist.set('r:' + me, 0); hop.set('r:' + me, null);
    const edges = n => {
      const out = [];
      if (n[0] === 'r') { const l = S.lsdb.get(n.slice(2)); if (l) l.links.forEach(k => out.push({ to: 'p:' + k.dst + '/' + k.plen, c: k.cost })); }
      else S.lsdb.forEach(l => l.links.forEach(k => { if (k.type === 'transit' && 'p:' + k.dst + '/' + k.plen === n) out.push({ to: 'r:' + l.rid, c: 0, via: k.addr }); }));
      return out;
    };
    const done = new Set();
    while (todo.size) {
      let u = null; todo.forEach(x => { if (u === null || dist.get(x) < dist.get(u)) u = x; }); todo.delete(u); done.add(u);
      edges(u).forEach(e => {
        const nd = dist.get(u) + e.c; if (done.has(e.to) || (dist.has(e.to) && dist.get(e.to) <= nd)) return;
        let h = hop.get(u);
        if (u[0] === 'p' && hop.get(u) === 'direct' ) h = { via: e.via, iface: this.ospfLocalIface(u.slice(2), v) };
        if (u === 'r:' + me) h = 'direct';
        dist.set(e.to, nd); hop.set(e.to, h); todo.add(e.to);
      });
    }
    S.routes = [];
    dist.forEach((d, n) => {
      if (n[0] !== 'p') return; const h = hop.get(n); if (!h || h === 'direct') return;
      const [dst, pl] = n.slice(2).split('/'); S.routes.push({ dst, plen: +pl, via: h.via, iface: h.iface, ad: 110, metric: d, proto: 'O', v });
    });
  };
  D.ospfLocalIface = function (prefix, v) { const [d, p] = prefix.split('/'); const i = this.ospfIfaces(v).find(x => A.netOf(v === 4 ? x.ip : x.ip6, +p) === d); return i && i.name; };
  D.ospfRoutes = function () { return [...this.ospfSt[4].routes, ...this.ospfSt[6].routes].filter(r => r.iface); };
})(window.NL = window.NL || {});
