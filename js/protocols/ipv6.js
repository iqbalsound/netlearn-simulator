/* ipv6.js - IPv6 helpers: Router Advertisements and SLAAC.
 * REAL: routers advertise a /64 prefix; hosts build their address from prefix + EUI-64 (from the MAC) and use the router as gateway.
 * SIMPLIFIED: no link-local addresses, no DAD, no RA lifetimes; NDP shares the ARP code path. */
(function (NL) {
  const D = NL.Device.prototype, A = NL.Addr;
  NL.onStart.push(d => {
    if (!d.cfg.forwarding || d.cfg.ra === false) return;
    const send = () => d.ifaces.forEach(i => { if (i.ip6 && i.kind !== 'tunnel' && d.ifaceOperUp(i) && i.ra !== false) d.emit(i, NL.BCAST, { v: 6, src: i.ip6, dst: 'ff02::1', ttl: 255, proto: 1, payload: { type: 'ra', prefix: A.netOf(i.ip6, i.plen6), plen: i.plen6, router: i.ip6 } }, true); });
    d.after(800, send); d.every(30000, send);
  });
  D.raInput = function (pkt, iface) {
    if (this.cfg.forwarding || !this.cfg.slaac || (iface.ip6 && !iface.ip6auto)) return;
    const p = pkt.payload; if (iface.ip6 && iface.ip6auto) return;
    iface.ip6 = A.eui64(p.prefix, iface.mac); iface.plen6 = p.plen; iface.ip6auto = true;
    if (!this.cfg.gateway6) { this.cfg.gateway6 = p.router; this.cfg.gateway6Auto = true; }
    this.log('SLAAC: ' + iface.name + ' = ' + iface.ip6 + '/' + p.plen, 'ok');
  };
})(window.NL = window.NL || {});
