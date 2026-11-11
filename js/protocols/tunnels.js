/* tunnels.js - GRE, IP-in-IP, 6in4 (IPv6 over IPv4), IPsec (concept) and WireGuard (concept).
 * REAL: the inner packet is wrapped in a new outer IPv4 packet (protocol 47 / 4 / 41), routed by the underlay.
 * SIMPLIFIED: IPsec = one IKE request/response then ESP wrapping (no real crypto, one shared secret);
 *             WireGuard = UDP/51820 with peers and allowed-ips (no real key exchange, keys are labels). */
(function (NL) {
  const D = NL.Device.prototype, A = NL.Addr, PROTO = { gre: 47, ipip: 4, '6in4': 41 };
  NL.onStart.push(d => d.ifaces.forEach(i => {
    if (i.kind !== 'tunnel') return;
    if (i.tunnel.ipsec && i.up) d.ikeStart(i);
    if (i.tunnel.mode === 'wireguard') i.tunnel.peers.forEach(p => { if (p.endpoint && p.keepalive) { const ka = () => d.ipOutput({ dst: p.endpoint, proto: 17, payload: { sport: i.tunnel.port, dport: p.port || 51820, wg: { from: i.tunnel.publicKey, inner: null } } }); d.after(1000, ka); d.every(p.keepalive * 1000, ka); } });
  }));

  NL.onReset.push(d => d.ifaces.forEach(i => { if (i.tunnel && i.tunnel.ipsec) { i.tunnel.ipsec.busy = false; i.tunnel.ipsec.state = 'down'; } }));
  /** o: {mode:'gre'|'ipip'|'6in4'|'wireguard', local, remote, ip, ip6, ipsecSecret, peers, port} */
  D.addTunnel = function (name, o) {
    const t = { mode: o.mode || 'gre', local: o.local || '', remote: o.remote || '', ipsec: o.ipsecSecret ? { secret: o.ipsecSecret, state: 'down' } : null };
    if (t.mode === 'wireguard') Object.assign(t, { port: o.port || 51820, publicKey: o.publicKey || 'pub-' + this.name, peers: o.peers || [] });
    const i = this.addIface(name, 'tunnel', { tunnel: t }); if (o.ip) this.setAddr(name, o.ip); if (o.ip6) this.setAddr(name, o.ip6); this.restart(); return i;
  };
  D.tunnelSend = function (i, pkt) {
    const t = i.tunnel;
    if (t.mode === 'wireguard') {
      const peer = t.peers.find(p => (p.allowed || []).some(c => { const x = A.cidr(c); return x && A.inNet(pkt.dst, x.ip, x.plen); }));
      if (!peer || !peer.endpoint) return this.log('WireGuard: no peer/endpoint for ' + pkt.dst, 'warn');
      peer.handshake = peer.handshake || this.engine.time;
      this.ipOutput({ dst: peer.endpoint, proto: 17, payload: { sport: t.port, dport: peer.port || 51820, wg: { from: t.publicKey, inner: pkt } } }); return;
    }
    if (!t.remote) return;
    const local = t.local || (this.ifaceFor(t.remote) && this.ifaceFor(t.remote).ip) || (this.lookup(t.remote) && this.iface(this.lookup(t.remote).iface).ip);
    let outer = { v: 4, src: local, dst: t.remote, ttl: 64, proto: PROTO[t.mode], payload: { inner: pkt } };
    if (t.ipsec) {
      if (t.ipsec.state !== 'up') { this.log('IPsec SA not established with ' + t.remote + ' - dropped', 'warn'); this.ikeStart(i); return; }
      outer = { v: 4, src: local, dst: t.remote, ttl: 64, proto: 50, payload: { esp: true, spi: 0x1001, inner: outer } };
    }
    this.ipOutput(outer);
  };
  D.tunnelInput = function (pkt, iface) {
    let outer = pkt, viaEsp = false;
    if (pkt.proto === 50) { outer = pkt.payload.inner; viaEsp = true; }
    const ti = this.ifaces.find(x => x.kind === 'tunnel' && x.up && x.tunnel.remote === pkt.src && PROTO[x.tunnel.mode] === outer.proto);
    if (!ti) return; if (!!ti.tunnel.ipsec !== viaEsp) return;                  // encrypted tunnel only accepts ESP
    if (viaEsp && ti.tunnel.ipsec.state !== 'up') return;
    this.ipInput(ti, outer.payload.inner, null);
  };
  /* ---- IPsec: IKE negotiation (UDP 500) ---- */
  D.ikeStart = function (i) {
    const s = i.tunnel.ipsec; if (!s || s.state === 'up' || s.busy) return; s.busy = true;
    const go = n => { if (s.state === 'up' || n > 6) { s.busy = false; return; } this.ipOutput({ dst: i.tunnel.remote, src: i.tunnel.local || undefined, proto: 17, payload: { sport: 500, dport: 500, ike: { op: 'init', secret: s.secret } } }); s.state = 'ike'; this.after(4000, () => go(n + 1)); };
    this.after(1500, () => go(1));
  };
  D.ikeInput = function (pkt) {
    const m = pkt.payload.ike, i = this.ifaces.find(x => x.kind === 'tunnel' && x.tunnel.ipsec && x.tunnel.remote === pkt.src); if (!i) return;
    if (m.secret !== i.tunnel.ipsec.secret) return this.log('IKE: pre-shared key mismatch with ' + pkt.src, 'warn');
    if (m.op === 'init') this.ipOutput({ src: pkt.dst, dst: pkt.src, proto: 17, payload: { sport: 500, dport: 500, ike: { op: 'resp', secret: m.secret } } });
    if (i.tunnel.ipsec.state !== 'up') { i.tunnel.ipsec.state = 'up'; this.log('IPsec SA established with ' + pkt.src, 'ok'); }
  };
  /* ---- WireGuard ---- */
  D.wgInput = function (pkt) {
    const w = pkt.payload.wg, i = this.ifaces.find(x => x.kind === 'tunnel' && x.tunnel.mode === 'wireguard' && x.tunnel.port === pkt.payload.dport); if (!i) return;
    const peer = i.tunnel.peers.find(p => p.publicKey === w.from); if (!peer) return this.log('WireGuard: unknown peer key ' + w.from, 'warn');
    peer.endpoint = pkt.src; peer.port = pkt.payload.sport; peer.handshake = this.engine.time;
    if (!w.inner) return;
    this.ipInput(i, w.inner, null);
  };
})(window.NL = window.NL || {});
