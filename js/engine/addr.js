/* addr.js - IPv4 + IPv6 address helpers (BigInt based so one code path serves both).
 * Addresses travel through the simulator as STRINGS ("10.0.0.1", "2001:db8::1");
 * we parse them only when we need to compare or do prefix maths. */
(function (NL) {
  const cache = new Map();
  function parse4(s) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s); if (!m) return null;
    let n = 0n; for (let i = 1; i <= 4; i++) { const o = +m[i]; if (o > 255) return null; n = (n << 8n) | BigInt(o); }
    return { v: 4, n };
  }
  function parse6(s) {
    if (!/^[0-9a-fA-F:]+$/.test(s) || s.split('::').length > 2) return null;
    const parts = s.split('::'), hs = parts[0] ? parts[0].split(':') : [], ts = parts.length > 1 && parts[1] ? parts[1].split(':') : [];
    let g;
    if (parts.length > 1) { const fill = 8 - hs.length - ts.length; if (fill < 0) return null; g = hs.concat(Array(fill).fill('0'), ts); } else g = hs;
    if (g.length !== 8) return null;
    let n = 0n; for (const x of g) { if (!x || x.length > 4) return null; n = (n << 16n) | BigInt(parseInt(x, 16)); }
    return { v: 6, n };
  }
  const A = {
    parse(s) { if (typeof s !== 'string') return null; if (cache.has(s)) return cache.get(s); const r = s.includes(':') ? parse6(s) : parse4(s); cache.set(s, r); return r; },
    bits: v => (v === 4 ? 32 : 128),
    mask(v, plen) { const b = BigInt(A.bits(v)); if (plen <= 0) return 0n; return ((1n << b) - 1n) ^ ((1n << (b - BigInt(plen))) - 1n); },
    str(v, n) {
      if (v === 4) return [24n, 16n, 8n, 0n].map(s => ((n >> s) & 255n).toString()).join('.');
      const g = []; for (let i = 7; i >= 0; i--) g.push(Number((n >> BigInt(i * 16)) & 0xffffn));
      let bs = -1, bl = 0; for (let i = 0; i < 8;) { if (g[i] === 0) { let j = i; while (j < 8 && g[j] === 0) j++; if (j - i > bl && j - i > 1) { bs = i; bl = j - i; } i = j; } else i++; }
      const h = g.map(x => x.toString(16));
      return bs < 0 ? h.join(':') : h.slice(0, bs).join(':') + '::' + h.slice(bs + bl).join(':');
    },
    inNet(ip, net, plen) { const a = A.parse(ip), n = A.parse(net); if (!a || !n || a.v !== n.v) return false; const m = A.mask(a.v, plen); return (a.n & m) === (n.n & m); },
    netOf(ip, plen) { const a = A.parse(ip); return A.str(a.v, a.n & A.mask(a.v, plen)); },
    /** "10.0.0.0/24" -> {ip, v, plen}. A bare address gets a host prefix. */
    cidr(s) { if (typeof s !== 'string') return null; const [ip, p] = s.trim().split('/'); const a = A.parse(ip); if (!a) return null; const pl = p === undefined ? A.bits(a.v) : parseInt(p, 10); if (isNaN(pl) || pl < 0 || pl > A.bits(a.v)) return null; return { ip, v: a.v, plen: pl }; },
    bcast(ip, plen) { const a = A.parse(ip), m = A.mask(4, plen); return A.str(4, (a.n & m) | (~m & 0xffffffffn)); },
    maskStr: plen => A.str(4, A.mask(4, plen)),
    plenOfMask(s) { const a = A.parse(s); if (!a) return null; let c = 0; for (let i = 31; i >= 0; i--) if ((a.n >> BigInt(i)) & 1n) c++; return c; },
    /** Accepts "24", "/24" or "255.255.255.0". */
    plen(s) { s = String(s).replace('/', ''); return s.includes('.') ? A.plenOfMask(s) : parseInt(s, 10); },
    isPublic4(ip) { const a = A.parse(ip); if (!a || a.v !== 4) return false; return !['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16', '127.0.0.0/8', '224.0.0.0/4', '0.0.0.0/8', '255.255.255.255/32', '100.64.0.0/10'].some(c => { const x = A.cidr(c); return A.inNet(ip, x.ip, x.plen); }); },
    /** SLAAC: prefix + EUI-64 interface id built from the MAC address. */
    eui64(prefix, mac) {
      const b = mac.split(':').map(x => parseInt(x, 16)); b[0] ^= 2;
      const iid = [b[0], b[1], b[2], 0xff, 0xfe, b[3], b[4], b[5]].reduce((n, x) => (n << 8n) | BigInt(x), 0n);
      const p = A.parse(prefix); return A.str(6, (p.n & A.mask(6, 64)) | iid);
    },
    /** Subnet calculator used by Lab 02 / Lab 05. */
    subnetInfo(ip, plen) {
      const a = A.parse(ip); const size = 2 ** (32 - plen), net = A.netOf(ip, plen), n = A.parse(net).n;
      return { network: net, mask: A.maskStr(plen), plen, hosts: Math.max(0, size - 2), first: size > 2 ? A.str(4, n + 1n) : net, last: size > 2 ? A.str(4, n + BigInt(size) - 2n) : net, broadcast: A.bcast(ip, plen), size };
    }
  };
  NL.Addr = A;
})(window.NL = window.NL || {});
