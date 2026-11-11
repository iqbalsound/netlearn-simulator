/* services.js - UDP/TCP dispatch + DHCP (client/server/relay), DNS, HTTP, port scanning.
 * REAL: DORA (Discover/Offer/Request/Ack), relay agent giaddr, DNS A queries, TCP SYN/SYN-ACK/RST behaviour.
 * SIMPLIFIED: lease renewal/expiry, TCP data streams, DNS caching/recursion are not modelled. */
(function (NL) {
  const D = NL.Device.prototype, A = NL.Addr, B = NL.BCAST;
  let xid = 1, dnsId = 1, port = 40000;
  const INTERNET = { 'google.com': '142.250.80.46', 'www.google.com': '142.250.80.46', 'example.com': '93.184.216.34', 'github.com': '140.82.112.3', 'dns.google': '8.8.8.8', 'anthropic.com': '160.79.104.10' };
  NL.INTERNET_DNS = INTERNET;

  D.findService = function (proto, p) {
    if (this.cfg.internet && (p === 80 || p === 443 || p === 53)) return { name: p === 53 ? 'domain' : 'http', proto, port: p };
    return this.cfg.services.find(s => s.proto === proto && s.port === p && s.on !== false);
  };
  D.udpInput = function (pkt, iface, frame) {
    const u = pkt.payload, key = pkt.src + '|' + u.sport + '|' + u.dport, w = this.probeWait.get(key);
    if (w && u.scanReply) return w({ udp: true }, pkt);
    if (u.dhcp && (u.dport === 67 || u.dport === 68)) return u.dport === 67 ? this.dhcpServerInput(pkt, iface) : this.dhcpClientInput(pkt, iface);
    if (u.dns) return this.dnsInput(pkt, iface);
    if ((u.dport === 520 || u.dport === 521) && u.rip) return this.ripInput && this.ripInput(pkt, iface);
    if (u.ike) return this.ikeInput(pkt, iface);
    if (u.wg) return this.wgInput(pkt, iface);
    if (this.isMcast(pkt.dst)) return;
    const s = this.findService('udp', u.dport);
    if (s) this.ipOutput({ v: pkt.v, src: pkt.dst, dst: pkt.src, proto: 17, payload: { sport: u.dport, dport: u.sport, scanReply: true } });
    else this.icmpError(pkt, 'port-unreachable', iface);
  };
  D.tcpInput = function (pkt, iface) {
    const t = pkt.payload, w = this.probeWait.get(pkt.src + '|' + t.sport + '|' + t.dport);
    if (w && ['SYN-ACK', 'RST', 'DATA-RESP'].includes(t.flags)) return w(t, pkt);
    const reply = (flags, extra) => this.ipOutput({ v: pkt.v, src: pkt.dst, dst: pkt.src, proto: 6, payload: Object.assign({ sport: t.dport, dport: t.sport, flags }, extra || {}) });
    if (t.flags === 'SYN') reply(this.findService('tcp', t.dport) ? 'SYN-ACK' : 'RST');
    else if (t.flags === 'DATA') { const s = this.findService('tcp', t.dport); if (s) reply('DATA-RESP', { status: 200, body: s.page || ('<h1>It works! ' + this.name + '</h1>'), server: s.name }); }
  };
  /** Open a TCP connection attempt. cb('open'|'closed'|'filtered', pkt, port). */
  D.tcpProbe = function (dst, dport, cb, timeout) {
    const sport = ++port, key = dst + '|' + dport + '|' + sport; let done = false;
    const fin = (r, p) => { if (done) return; done = true; this.probeWait.delete(key); cb(r, p, sport); };
    this.probeWait.set(key, t => fin(t.flags === 'SYN-ACK' ? 'open' : 'closed'));
    const res = this.ipOutput({ dst, proto: 6, payload: { sport, dport, flags: 'SYN' } });
    if (res.err) return this.engine.schedule(0.2, () => fin('unreachable'));
    this.engine.schedule(timeout || 2000, () => fin('filtered'));
  };
  D.udpProbe = function (dst, dport, cb, timeout) {
    const sport = ++port, key = dst + '|' + dport + '|' + sport; let done = false;
    const fin = r => { if (done) return; done = true; this.probeWait.delete(key); cb(r); };
    this.probeWait.set(key, (t) => fin(t.icmp ? 'closed' : 'open'));
    this.ipOutput({ dst, proto: 17, payload: { sport, dport } });
    this.engine.schedule(timeout || 1500, () => fin('open|filtered'));
  };
  D.httpGet = function (url, cb) {
    const m = /^(?:https?:\/\/)?([^\/:]+)(?::(\d+))?(\/.*)?$/.exec(url); if (!m) return cb({ ok: false, err: 'bad URL' });
    this.resolve(m[1], (ip, err) => {
      if (!ip) return cb({ ok: false, err: err || 'could not resolve host' });
      this.tcpProbe(ip, +(m[2] || 80), (r, p, sport) => {
        if (r !== 'open') return cb({ ok: false, err: r === 'closed' ? 'connection refused' : r === 'filtered' ? 'connection timed out' : 'network unreachable', ip });
        const key = ip + '|' + (+(m[2] || 80)) + '|' + sport; let done = false;
        const fin = x => { if (done) return; done = true; this.probeWait.delete(key); cb(x); };
        this.probeWait.set(key, t => fin({ ok: true, status: t.status, body: t.body, ip }));
        this.ipOutput({ dst: ip, proto: 6, payload: { sport, dport: +(m[2] || 80), flags: 'DATA', data: 'GET ' + (m[3] || '/') } });
        this.engine.schedule(2000, () => fin({ ok: false, err: 'response timed out', ip }));
      });
    });
  };

  /* ---------------- DNS ---------------- */
  D.resolve = function (name, cb) {
    if (A.parse(name)) return cb(name);
    if (this.cfg.hosts[name]) return cb(this.cfg.hosts[name]);
    const srv = (this.cfg.dns || [])[0]; if (!srv) return cb(null, 'no DNS server configured');
    const id = ++dnsId; let done = false;
    const fin = (ip, err) => { if (done) return; done = true; this.dnsWait.delete(id); cb(ip, err); };
    this.dnsWait.set(id, a => fin(a.ip, a.ip ? null : 'NXDOMAIN: ' + name));
    const r = this.ipOutput({ dst: srv, proto: 17, payload: { sport: 33000 + id % 1000, dport: 53, dns: { id, qname: name } } });
    if (r.err) return this.engine.schedule(0.2, () => fin(null, 'DNS server unreachable'));
    this.engine.schedule(3000, () => fin(null, 'DNS timeout'));
  };
  D.dnsInput = function (pkt, iface) {
    const q = pkt.payload.dns;
    if (q.resp) { const w = this.dnsWait.get(q.id); if (w) w(q); return; }
    if (!this.cfg.internet && !Object.keys(this.cfg.dnsRecords).length && !this.cfg.dnsServer) return;
    const ip = this.cfg.dnsRecords[q.qname] || (this.cfg.internet ? INTERNET[q.qname] : null) || null;
    this.ipOutput({ v: pkt.v, src: pkt.dst, dst: pkt.src, proto: 17, payload: { sport: 53, dport: pkt.payload.sport, dns: { id: q.id, resp: true, qname: q.qname, ip } } });
  };

  /* ---------------- DHCP ---------------- */
  function bcastUdp(dev, i, src, sport, dport, dhcp) { dev.emit(i, B, { v: 4, src, dst: '255.255.255.255', ttl: 64, proto: 17, payload: { sport, dport, dhcp } }); }
  NL.onStart.push(d => d.ifaces.forEach(i => { if (i.dhcp && d.ifaceOperUp(i)) d.dhcpStart(i); }));
  D.dhcpStart = function (i) {
    if (i.dhcpState === 'bound') return; i.dhcpState = 'selecting'; i._xid = ++xid;
    const attempt = n => {
      if (i.dhcpState === 'bound' || !i.dhcp) return;
      if (n === 6) this.log('DHCP: still no answer on ' + i.name + ' (will keep trying)', 'warn');
      bcastUdp(this, i, '0.0.0.0', 68, 67, { op: 'discover', xid: i._xid, chaddr: i.mac, host: this.name }); this.after(n < 5 ? 3000 : 10000, () => attempt(n + 1));
    };
    this.after(10 + Math.random() * 50, () => attempt(1));
  };
  D.dhcpClientInput = function (pkt, iface) {
    const m = pkt.payload.dhcp, i = this.ifaces.find(x => x.mac === m.chaddr && x.dhcp && x._xid === m.xid); if (!i) return;
    if (m.op === 'offer' && i.dhcpState === 'selecting') { i.dhcpState = 'requesting'; bcastUdp(this, i, '0.0.0.0', 68, 67, { op: 'request', xid: m.xid, chaddr: i.mac, yiaddr: m.yiaddr, server: m.server, host: this.name }); }
    else if (m.op === 'ack' && i.dhcpState === 'requesting') {
      i.ip = m.yiaddr; i.plen = m.plen; i.dhcpAssigned = true; i.dhcpState = 'bound';
      if (m.gw) { if (this.cfg.forwarding) i.dhcpGw = m.gw; else { this.cfg.gateway = m.gw; this.cfg.gatewayDhcp = true; } }
      if (m.dns && m.dns.length && !(this.cfg.dnsStatic)) this.cfg.dns = m.dns.slice();
      this.log('DHCP: ' + i.name + ' bound to ' + i.ip + '/' + i.plen + (m.gw ? ' gw ' + m.gw : ''), 'ok');
      this.arp.clear();
    }
  };
  D.dhcpServerInput = function (pkt, iface) {
    const m = pkt.payload.dhcp, relay = this.cfg.dhcpRelays.find(r => r.iface === iface.name && !r.disabled);
    if (m.op === 'offer' || m.op === 'ack') {                       // answer coming back to a relay agent
      if (m.giaddr && this.ownsIp(m.giaddr)) { const i = this.ifaces.find(x => x.ip === m.giaddr); if (i) bcastUdp(this, i, i.ip, 67, 68, m); } return;
    }
    if (relay && !m.giaddr) { m.giaddr = iface.ip; this.ipOutput({ dst: relay.server, proto: 17, payload: { sport: 67, dport: 67, dhcp: m } }); return; }
    const ref = m.giaddr || iface.ip; if (!ref) return;
    const pool = this.cfg.dhcpServers.find(p => !p.disabled && A.inNet(ref, p.network.split('/')[0], +p.network.split('/')[1])); if (!pool) return;
    const [net, pl] = [pool.network.split('/')[0], +pool.network.split('/')[1]], n0 = A.parse(net).n;
    let lease = this.leases.get(m.chaddr);
    if (!lease || lease.pool !== pool.network) {
      const used = new Set([...this.leases.values()].map(l => l.ip)); this.ifaces.forEach(i => i.ip && used.add(i.ip)); if (pool.gateway) used.add(pool.gateway);
      const lo = pool.from ? A.parse(pool.from).n : n0 + 1n, hi = pool.to ? A.parse(pool.to).n : n0 + (1n << BigInt(32 - pl)) - 2n; let ip = null;
      for (let a = lo; a <= hi; a++) { const s = A.str(4, a); if (!used.has(s)) { ip = s; break; } }
      if (!ip) { this.log('DHCP pool ' + pool.network + ' exhausted', 'warn'); return; }
      lease = { ip, pool: pool.network, host: m.host, t: this.engine.time }; this.leases.set(m.chaddr, lease);
    }
    const rep = { op: m.op === 'discover' ? 'offer' : 'ack', xid: m.xid, chaddr: m.chaddr, yiaddr: lease.ip, plen: pl, gw: pool.gateway, dns: pool.dns || [], giaddr: m.giaddr, server: iface.ip || ref, lease: pool.lease || '1d' };
    if (m.op === 'request') lease.bound = true;
    if (m.giaddr) this.ipOutput({ dst: m.giaddr, proto: 17, payload: { sport: 67, dport: 67, dhcp: rep } });
    else bcastUdp(this, iface, iface.ip, 67, 68, rep);
  };
})(window.NL = window.NL || {});
