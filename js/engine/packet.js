/* packet.js - A "Frame" is what travels on a cable: Ethernet header + (ARP or IP packet).
 * REAL: separate L2 (MAC, VLAN tag) and L3 (IP) headers, TTL, protocol numbers.
 * SIMPLIFIED: TCP is reduced to a few flag messages; payloads are small JS objects. */
(function (NL) {
  let fid = 1, mac = 0x100;
  NL.BCAST = 'FF:FF:FF:FF:FF:FF';
  NL.newMac = () => { const n = ++mac, h = x => (x & 255).toString(16).toUpperCase().padStart(2, '0'); return ['02', '4E', '4C', h(n >> 16), h(n >> 8), h(n)].join(':'); };
  const COL = { arp: '#b48cff', req: '#f5b83d', rep: '#3dd6a3', err: '#ff6b6b', udp: '#4fc3f7', tcp: '#7aa7ff', tun: '#ffa07a', ctl: '#ff8fd0' };

  class Frame {
    constructor(o) { this.id = fid++; this.size = 64; this.vlan = null; this.ctl = false; Object.assign(this, o); }
    clone() { const f = Object.assign(Object.create(Frame.prototype), this); if (this.ip) f.ip = JSON.parse(JSON.stringify(this.ip)); if (this.arp) f.arp = Object.assign({}, this.arp); return f; }
    /** Colour on the canvas, chosen from what the frame carries. */
    get color() {
      if (this.etype === 'arp') return COL.arp;
      const p = this.ip; if (!p) return '#ccc';
      if (p.proto === 1) { const t = p.payload.type; return t === 'echo-request' ? COL.req : t === 'echo-reply' ? COL.rep : (t === 'ra' ? COL.ctl : COL.err); }
      if (p.proto === 89 || (p.proto === 17 && (p.payload.dport === 520 || p.payload.dport === 521))) return COL.ctl;
      if (p.proto === 47 || p.proto === 50 || p.proto === 41 || p.proto === 4) return COL.tun;
      return p.proto === 6 ? COL.tcp : COL.udp;
    }
    get label() {
      if (this.etype === 'arp') return this.arp.op === 1 ? 'ARP who-has ' + this.arp.tpa : 'ARP reply';
      const p = this.ip, n = { 1: 'ICMP', 6: 'TCP', 17: 'UDP', 47: 'GRE', 50: 'ESP', 41: '6in4', 4: 'IPIP', 89: 'OSPF' }[p.proto] || p.proto;
      return n + ' ' + p.src + ' > ' + p.dst;
    }
  }
  NL.Frame = Frame;
})(window.NL = window.NL || {});
