/* nat.js - Source NAT / masquerade with PAT (many inside hosts share one outside address).
 * REAL: translation table keyed by protocol + address + port/ICMP id, reverse translation of replies.
 * SIMPLIFIED: IPv4 only; no timeouts; ICMP error payloads are not rewritten; no destination NAT yet. */
(function (NL) {
  const D = NL.Device.prototype, A = NL.Addr; let nextPort = 20000;
  const ids = p => (p.proto === 1 ? [p.payload.id, p.payload.id] : [p.payload.sport, p.payload.dport]);
  D.natPost = function (pkt, out) {
    if (pkt.v !== 4 || ![1, 6, 17].includes(pkt.proto) || this.ownsIp(pkt.src)) return;
    const rule = this.cfg.nat.find(r => !r.disabled && r.chain === 'srcnat' && (r.action === 'masquerade' || r.action === 'src-nat') && (!r.outInterface || r.outInterface === out.name) && (!r.srcAddress || (c => A.inNet(pkt.src, c.ip, c.plen))(A.cidr(r.srcAddress))));
    if (!rule) return;
    const to = rule.action === 'masquerade' ? out.ip : rule.toAddress; if (!to) return;
    const [s, d] = ids(pkt), k = [pkt.proto, pkt.src, s, pkt.dst, d].join('|'); let e = this.natOut.get(k);
    if (!e) {
      const ext = pkt.proto === 1 ? ++nextPort : (this.natIn.has([pkt.proto, to, s].join('|')) ? ++nextPort : s);
      e = { proto: pkt.proto, inside: pkt.src, insideId: s, outside: to, outsideId: ext, remote: pkt.dst, t: this.engine.time }; this.natOut.set(k, e); this.natIn.set([pkt.proto, to, ext, pkt.dst].join('|'), e);
    }
    pkt.src = to; if (pkt.proto === 1) pkt.payload.id = e.outsideId; else pkt.payload.sport = e.outsideId;
  };
  D.natPre = function (pkt) {
    if (!this.natIn.size || pkt.v !== 4 || ![1, 6, 17].includes(pkt.proto)) return;
    const idv = pkt.proto === 1 ? pkt.payload.id : pkt.payload.dport, e = this.natIn.get([pkt.proto, pkt.dst, idv, pkt.src].join('|'));
    if (!e) return; pkt.dst = e.inside; if (pkt.proto === 1) pkt.payload.id = e.insideId; else pkt.payload.dport = e.insideId;
  };
  D.addMasquerade = function (outIface) { this.cfg.nat.push({ chain: 'srcnat', action: 'masquerade', outInterface: outIface }); this.restart(); };
  D.natRows = function () { return [...this.natOut.values()].map(e => ({ proto: { 1: 'icmp', 6: 'tcp', 17: 'udp' }[e.proto], inside: e.inside + ':' + e.insideId, outside: e.outside + ':' + e.outsideId, remote: e.remote })); };
})(window.NL = window.NL || {});
