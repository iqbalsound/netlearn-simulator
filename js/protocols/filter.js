/* filter.js - Stateful firewall (MikroTik-style chains: input / forward / output).
 * REAL: rules checked top-to-bottom, first match wins, default accept, connection tracking (new vs established).
 * SIMPLIFIED: tracking has no timeouts or per-protocol state machines; 'related' = any ICMP error. */
(function (NL) {
  const D = NL.Device.prototype, A = NL.Addr, PN = { icmp: 1, tcp: 6, udp: 17, gre: 47, esp: 50, ospf: 89, ipsec: 50 };
  function ports(p) { const x = p.payload || {}; return p.proto === 1 ? [x.id, x.id] : [x.sport, x.dport]; }
  function key(p) { const [s, d] = ports(p), a = p.src + ':' + s, b = p.dst + ':' + d; return p.proto + '|' + (a < b ? a + '|' + b : b + '|' + a); }
  function inCidr(ip, c) { if (!c) return true; const x = A.cidr(c); return !!x && A.inNet(ip, x.ip, x.plen); }
  D.filter = function (chain, pkt, inI, outI) {
    if (!this.cfg.firewall.length) return 'accept';
    const k = key(pkt), pl = pkt.payload || {}; let state = this.ct.has(k) ? 'established' : 'new';
    if (pkt.proto === 1 && !['echo-request', 'echo-reply'].includes(pl.type)) state = 'related';
    const [sp, dp] = ports(pkt);
    for (const r of this.cfg.firewall) {
      if (r.disabled || r.chain !== chain) continue;
      if (r.protocol && r.protocol !== 'any' && (PN[r.protocol] || +r.protocol) !== pkt.proto) continue;
      if (!inCidr(pkt.src, r.srcAddress) || !inCidr(pkt.dst, r.dstAddress)) continue;
      if (r.port && +r.port !== sp && +r.port !== dp) continue;
      if (r.dstPort && +r.dstPort !== dp) continue;
      if (r.connState && !String(r.connState).split(',').includes(state)) continue;
      if (r.inInterface && (!inI || r.inInterface !== inI.name)) continue;
      if (r.outInterface && (!outI || r.outInterface !== outI.name)) continue;
      r.hits = (r.hits || 0) + 1;
      if (r.action === 'accept') { if (state === 'new') this.ct.set(k, this.engine.time); return 'accept'; }
      if (r.action === 'drop' || r.action === 'reject') { this.log('firewall ' + r.action + ' (' + chain + ') ' + pkt.src + ' > ' + pkt.dst + (r.comment ? '  [' + r.comment + ']' : ''), 'warn'); return 'drop'; }
    }
    if (state === 'new') this.ct.set(k, this.engine.time); return 'accept';
  };
  D.addFilterRule = function (r) { this.cfg.firewall.push(Object.assign({ chain: 'forward', action: 'accept', protocol: 'any', hits: 0 }, r)); this.restart(); };
  D.moveRule = function (from, to) { const [r] = this.cfg.firewall.splice(from, 1); this.cfg.firewall.splice(to, 0, r); this.restart(); };
})(window.NL = window.NL || {});
