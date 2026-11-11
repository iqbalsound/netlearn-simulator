/* l3.js - Layer 3: ARP/ND, IPv4+IPv6 forwarding, routing table, ICMP (ping, traceroute).
 * REAL: longest-prefix match, administrative distance, TTL, ARP before sending, ICMP errors.
 * SIMPLIFIED: IPv6 reuses the same code (NDP == ARP with v6 addresses); no fragmentation/MTU. */
(function (NL) {
  const D = NL.Device.prototype, A = NL.Addr, B = NL.BCAST;
  const MC = ['224.0.0.5', '224.0.0.9', '255.255.255.255', 'ff02::1', 'ff02::5', 'ff02::9', 'ff02::2'];
  let icmpId = 100;
  D.isMcast = ip => MC.includes(ip);
  D.ifaceOperUp = function (i) {
    if (!i.up) return false;
    if (i.kind === 'wlan') return !!(i.wifiLinks || i.linkId);
    if (i.kind === 'eth') { const l = i.linkId && this.topo.links.get(i.linkId); return !!(l && l.up); }
    if (i.kind === 'vlan') { const p = this.iface(i.parent); return !!p && this.ifaceOperUp(p); }
    return true;
  };
  D.ownsIp = function (ip) { return this.ifaces.some(i => i.up && (i.ip === ip || i.ip6 === ip)); };
  D.ifaceFor = function (ip) {
    let best = null;
    this.ifaces.forEach(i => { if (!this.ifaceOperUp(i)) return; const v6 = ip.includes(':'), a = v6 ? i.ip6 : i.ip, pl = v6 ? i.plen6 : i.plen; if (a && A.inNet(ip, a, pl) && (!best || pl > best.pl)) best = { i, pl }; });
    return best && best.i;
  };
  D.anyIp = function (v) { const i = this.ifaces.find(x => (v === 4 ? x.ip : x.ip6) && x.up); return i && (v === 4 ? i.ip : i.ip6); };

  /** Build the routing table (RIB) from connected, static, DHCP and dynamic routes. */
  D.routeTable = function () {
    const t = [];
    this.ifaces.forEach(i => {
      if (!this.ifaceOperUp(i)) return;
      [4, 6].forEach(v => { const ip = v === 4 ? i.ip : i.ip6, pl = v === 4 ? i.plen : i.plen6; if (ip) t.push({ dst: A.netOf(ip, pl), plen: pl, via: null, iface: i.name, ad: 0, metric: 0, proto: 'C', v }); });
      if (i.dhcpGw) t.push({ dst: '0.0.0.0', plen: 0, via: i.dhcpGw, iface: i.name, ad: 1, metric: 0, proto: 'D', v: 4 });
    });
    this.cfg.routes.forEach(r => {
      const v = A.parse(r.dst).v, i = r.iface ? this.iface(r.iface) : (r.via && this.ifaceFor(r.via));
      if (i && this.ifaceOperUp(i)) t.push({ dst: r.dst, plen: r.plen, via: r.via || null, iface: i.name, ad: r.ad || 1, metric: 0, proto: 'S', v });
    });
    [[this.cfg.gateway, '0.0.0.0', 4], [this.cfg.gateway6, '::', 6]].forEach(([g, d, v]) => { if (g) { const i = this.ifaceFor(g); if (i) t.push({ dst: d, plen: 0, via: g, iface: i.name, ad: 1, metric: 0, proto: 'S', v }); } });
    if (this.ripRoutes) t.push(...this.ripRoutes());
    if (this.ospfRoutes) t.push(...this.ospfRoutes());
    return t;
  };
  D.lookup = function (dst) {
    const a = A.parse(dst); if (!a) return null; let best = null;
    this.routeTable().forEach(r => { if (r.v !== a.v || !A.inNet(dst, r.dst, r.plen)) return; if (!best || r.plen > best.plen || (r.plen === best.plen && (r.ad < best.ad || (r.ad === best.ad && r.metric < best.metric)))) best = r; });
    return best;
  };

  /* ---------- sending ---------- */
  D.emit = function (iface, dstMac, pkt, ctl) { this.txFrame(iface, new NL.Frame({ src: iface.mac, dst: dstMac, etype: 'ip', ip: pkt, ctl: !!ctl })); };
  D.txFrame = function (i, f) {
    if (i.kind === 'vlan') { f.vlan = i.vlanId; this.engine.send(this, i.parent, f); }
    else if (i.kind === 'svi') this.bridgeFromSvi(i, f);
    else this.engine.send(this, i.name, f);
  };
  D.sendMcast = function (i, pkt, ctl) { if (i.kind === 'tunnel') this.tunnelSend(i, pkt); else this.emit(i, B, pkt, ctl); };
  /** Originate a packet from this device (ping, DHCP unicast, RIP...). Returns {err} if it cannot be sent. */
  D.ipOutput = function (pkt) {
    pkt.v = pkt.v || (pkt.dst.includes(':') ? 6 : 4); pkt.ttl = pkt.ttl || 64;
    if (this.ownsIp(pkt.dst)) { pkt.src = pkt.src || pkt.dst; this.engine.schedule(0.1, () => this.ipLocal(pkt, this.ifaceFor(pkt.dst) || this.ifaces[0], null)); return {}; }
    const r = this.lookup(pkt.dst); if (!r) return { err: 'Network is unreachable' };
    const i = this.iface(r.iface);
    if (!pkt.src) pkt.src = (pkt.v === 4 ? i.ip : i.ip6) || this.anyIp(pkt.v);
    if (this.filter('output', pkt, null, i) === 'drop') return { err: 'blocked by firewall' };
    this.l3Send(i, r.via || pkt.dst, pkt, false); return {};
  };
  D.l3Send = function (out, nh, pkt, fwd) {
    this.natPost(pkt, out);
    if (out.kind === 'tunnel') return this.tunnelSend(out, pkt);
    this.arpResolve(out, nh, mac => { if (mac) this.emit(out, mac, pkt); else if (fwd) this.log('host unreachable ' + pkt.dst, 'warn'); });
  };

  /* ---------- ARP / NDP ---------- */
  D.arpResolve = function (iface, ip, cb) {
    const e = this.arp.get(ip); if (e && e.iface === iface.name) return cb(e.mac);
    let p = this.pending.get(ip); if (p) { p.cbs.push(cb); return; }
    p = { cbs: [cb], tries: 0 }; this.pending.set(ip, p); this._arpReq(iface, ip, p);
  };
  D._arpReq = function (iface, ip, p) {
    p.tries++; const v6 = ip.includes(':'), spa = v6 ? iface.ip6 : iface.ip;
    if (!spa) { this.pending.delete(ip); p.cbs.forEach(c => c(null)); return; }
    this.txFrame(iface, new NL.Frame({ src: iface.mac, dst: B, etype: 'arp', arp: { op: 1, sha: iface.mac, spa, tha: '00:00:00:00:00:00', tpa: ip, v6 } }));
    this.after(1000, () => { if (this.pending.get(ip) !== p) return; if (p.tries < 2) this._arpReq(iface, ip, p); else { this.pending.delete(ip); p.cbs.forEach(c => c(null)); } });
  };
  D.arpInput = function (iface, f) {
    const a = f.arp;
    if (a.spa && a.spa !== '0.0.0.0') { this.arp.set(a.spa, { mac: a.sha, iface: iface.name }); const p = this.pending.get(a.spa); if (p) { this.pending.delete(a.spa); p.cbs.forEach(c => c(a.sha)); } }
    if (a.op === 1 && (iface.ip === a.tpa || iface.ip6 === a.tpa) && iface.up)
      this.txFrame(iface, new NL.Frame({ src: iface.mac, dst: a.sha, etype: 'arp', arp: { op: 2, sha: iface.mac, spa: a.tpa, tha: a.sha, tpa: a.spa, v6: a.v6 } }));
  };

  /* ---------- receiving ---------- */
  D.l3Receive = function (frame, pn) {
    const p = this.port(pn); if (!p || !this.ifaceOperUp(p)) return;
    let i = p;
    if (frame.vlan != null) { i = this.ifaces.find(x => x.kind === 'vlan' && x.parent === pn && x.vlanId === frame.vlan); if (!i) return; }
    this.l3Frame(i, frame);
  };
  D.l3Frame = function (i, f) {
    if (!i.up || (f.dst !== B && f.dst !== i.mac)) return;
    if (f.etype === 'arp') return this.arpInput(i, f);
    if (f.etype === 'ip') this.ipInput(i, f.ip, f);
  };
  D.ipInput = function (iface, pkt, frame) {
    this.natPre(pkt, iface);
    const own = this.ownsIp(pkt.dst), mc = this.isMcast(pkt.dst) || (pkt.v === 4 && iface.ip && pkt.dst === A.bcast(iface.ip, iface.plen));
    if (own || mc) return this.ipLocal(pkt, iface, frame);
    if (this.cfg.internet && pkt.v === 4 && A.isPublic4(pkt.dst)) { pkt.spoof = true; return this.ipLocal(pkt, iface, frame); }
    if (this.cfg.forwarding) this.forward(pkt, iface);
  };
  D.forward = function (pkt, inI) {
    if (--pkt.ttl <= 0) return this.icmpError(pkt, 'time-exceeded', inI);
    const r = this.lookup(pkt.dst); if (!r) return this.icmpError(pkt, 'net-unreachable', inI);
    const out = this.iface(r.iface); if (this.filter('forward', pkt, inI, out) === 'drop') return;
    this.l3Send(out, r.via || pkt.dst, pkt, true);
  };
  D.ipLocal = function (pkt, iface, frame) {
    if (this.filter('input', pkt, iface, null) === 'drop') return;
    switch (pkt.proto) {
      case 1: return this.icmpInput(pkt, iface);
      case 17: return this.udpInput(pkt, iface, frame);
      case 6: return this.tcpInput(pkt, iface);
      case 4: case 41: case 47: case 50: return this.tunnelInput(pkt, iface);
      case 89: return this.ospfInput && this.ospfInput(pkt, iface);
    }
  };

  /* ---------- ICMP ---------- */
  D.icmpError = function (pkt, kind, inI) {
    if (pkt.proto === 1 && pkt.payload.type !== 'echo-request' && pkt.payload.type !== 'echo-reply') return;
    const src = pkt.v === 4 ? inI.ip : inI.ip6; if (!src || this.isMcast(pkt.src)) return;
    const p = pkt.payload;
    this.ipOutput({ v: pkt.v, src, dst: pkt.src, proto: 1, payload: { type: kind, orig: { src: pkt.src, dst: pkt.dst, proto: pkt.proto, id: p.id, seq: p.seq, sport: p.sport, dport: p.dport } } });
  };
  D.icmpInput = function (pkt, iface) {
    const p = pkt.payload;
    if (p.type === 'echo-request') { if (this.isMcast(pkt.dst)) return; this.ipOutput({ v: pkt.v, src: (this.ownsIp(pkt.dst) || pkt.spoof) ? pkt.dst : undefined, dst: pkt.src, proto: 1, payload: { type: 'echo-reply', id: p.id, seq: p.seq } }); return; }
    if (p.type === 'ra') return this.raInput && this.raInput(pkt, iface);
    const o = p.orig, key = p.type === 'echo-reply' ? p.id + ':' + p.seq : (o && o.proto === 1 ? o.id + ':' + o.seq : null);
    if (key && this.pingWait.has(key)) { const w = this.pingWait.get(key); w({ ok: p.type === 'echo-reply', type: p.type, from: pkt.src, ttl: pkt.ttl }); return; }
    if (o && o.proto === 17) { const w = this.probeWait.get(o.dst + '|' + o.dport + '|' + o.sport); if (w) w({ icmp: p.type }, pkt); }
  };
  /** One echo request. cb({ok,from,rtt,err,type}) */
  D.pingOnce = function (dst, o, cb) {
    o = o || {}; const id = ++icmpId, seq = o.seq || 1, key = id + ':' + seq, t0 = this.engine.time; let done = false;
    const fin = r => { if (done) return; done = true; this.pingWait.delete(key); r.rtt = this.engine.time - t0; cb(r); };
    this.pingWait.set(key, fin);
    const res = this.ipOutput({ v: dst.includes(':') ? 6 : 4, src: o.src, dst, ttl: o.ttl || 64, proto: 1, payload: { type: 'echo-request', id, seq } });
    if (res.err) return this.engine.schedule(0.2, () => fin({ ok: false, err: res.err }));
    this.engine.schedule(o.timeout || 2000, () => fin({ ok: false, err: 'Request timed out' }));
  };
  /** ping name-or-ip, count times; onEach(result) per reply, onDone(summary). */
  D.ping = function (target, o, onEach, onDone) {
    o = o || {}; const n = o.count || 4, res = [];
    this.resolve(target, (ip, err) => {
      if (!ip) { onEach({ ok: false, err: err || 'unknown host ' + target }); return onDone && onDone([]); }
      const go = k => this.pingOnce(ip, { seq: k, ttl: o.ttl, timeout: o.timeout, src: o.src }, r => { r.ip = ip; r.seq = k; res.push(r); onEach(r); if (k < n) this.engine.schedule(o.gap || 500, () => go(k + 1)); else onDone && onDone(res); });
      go(1);
    });
  };
  D.traceroute = function (target, onHop, onDone) {
    this.resolve(target, (ip, err) => {
      if (!ip) { onDone && onDone(err || 'unknown host'); return; }
      const hop = ttl => this.pingOnce(ip, { ttl, seq: ttl, timeout: 1500 }, r => { onHop(ttl, r); if ((r.ok && r.type === 'echo-reply') || ttl >= 16 || (r.type && !['time-exceeded', 'echo-reply'].includes(r.type))) onDone && onDone(); else hop(ttl + 1); });
      hop(1);
    });
  };
})(window.NL = window.NL || {});
