/* lab-engine.js - Loads a lab into the simulator, applies the model solution, and auto-checks the student's work.
 * A lab is plain data (see labs-*.js). Config "specs" use the same Device API the GUI and terminals use,
 * so what the checker verifies is exactly what a student can configure by hand. */
(function (NL) {
  NL.LABS = [];
  NL.addLab = lab => NL.LABS.push(lab);

  /** Apply a config spec to one device. Keys are documented in labs-core.js. */
  function applyCfg(d, s) {
    if (!s) return;
    if (s.hostname) d.name = s.hostname;
    Object.entries(s.ifaces || {}).forEach(([n, v]) => { if (v === 'dhcp') d.setDhcp(n, true); else if (Array.isArray(v)) v.forEach(a => d.setAddr(n, a)); else d.setAddr(n, v); });
    if (s.ip) { const n = d.ifaces.find(i => i.kind === 'eth').name; d.setAddr(n, s.ip); }
    if (s.ip6) { const n = d.ifaces.find(i => i.kind === 'eth').name; d.setAddr(n, s.ip6); }
    if (s.dhcp) d.setDhcp(d.ifaces.find(i => i.kind === 'eth').name, true);
    if (s.wifiDhcp) d.setDhcp('wlan0', true);
    if (s.gw !== undefined) d.cfg.gateway = s.gw; if (s.gw6) d.cfg.gateway6 = s.gw6;
    if (s.dns) { d.cfg.dns = s.dns; d.cfg.dnsStatic = true; }
    if (s.hosts) Object.assign(d.cfg.hosts, s.hosts);
    (s.dhcpClient || []).forEach(n => d.setDhcp(n, true));
    (s.routes || []).forEach(r => d.addRoute(r[0], r[1], r[2]));
    (s.vlanIfs || []).forEach(v => { d.addVlanIf(v[0], v[1], v[2]); if (v[3]) d.setAddr(v[0], v[3]); });
    (s.svis || []).forEach(v => d.addSvi(v[0], v[1]));
    Object.entries(s.ports || {}).forEach(([n, l2]) => d.setPortL2(n, l2));
    if (s.rip) d.enableRip(s.rip);
    if (s.ospf) { Object.assign(d.cfg.ospf, { enabled: true }, s.ospf); d.cfg.ospf.networks = (s.ospf.networks || []).map(n => typeof n === 'string' ? { network: n, area: '0.0.0.0' } : n); d.restart(); }
    (s.dhcpServer || []).forEach(p => d.cfg.dhcpServers.push(p));
    (s.relay || []).forEach(r => d.cfg.dhcpRelays.push(r));
    (s.nat || []).forEach(n => d.addMasquerade(n));
    (s.firewall || []).forEach(r => d.cfg.firewall.push(Object.assign({ chain: 'forward', action: 'accept', protocol: 'any', hits: 0 }, r)));
    (s.tunnels || []).forEach(t => d.addTunnel(t.name, t));
    if (s.records) { Object.assign(d.cfg.dnsRecords, s.records); d.cfg.dnsServer = true; }
    if (s.services) d.cfg.services = s.services;
    if (s.internet) { d.cfg.internet = true; }
    if (s.wifi) { const w = d.iface('wlan0'); if (w && w.wifi) Object.assign(w.wifi, s.wifi); }
    if (s.ap) Object.assign(d.cfg, s.ap);
    if (s.noForward) d.cfg.forwarding = false;
    if (s.forward) d.cfg.forwarding = true;
    d.restart(true);
  }
  NL.applyCfg = applyCfg;

  /** Build the topology for a lab (cabling + device names). 'start' config is applied, solution is not. */
  NL.LabEngine = {
    current: null,
    load(topo, lab) {
      topo.engine.reset(); topo.clear(); this.current = lab;
      lab.devices.forEach(([name, type, x, y, o]) => topo.addDevice(type, x, y, Object.assign({ id: name, name }, o || {})));
      lab.links.forEach(([a, pa, b, pb, o]) => topo.connect(a, pa, b, pb, o));
      Object.entries(lab.start || {}).forEach(([n, s]) => applyCfg(topo.byName(n), s));
      topo.refreshWifi(); topo.devices.forEach(d => d.restart(true));
    },
    solve(topo, lab) { Object.entries(lab.solution || {}).forEach(([n, s]) => applyCfg(topo.byName(n), s)); topo.changed(); topo.devices.forEach(d => d.restart(true)); if (lab.postSolve) { topo.engine.advance(20000); lab.postSolve(topo); topo.devices.forEach(d => d.restart()); } },
    /** Run every check. Routing protocols need time to converge first (simulated, so instant). */
    check(topo, lab) {
      const eng = topo.engine; eng.advance(lab.settle || 90000);
      return (lab.checks || []).map(c => {
        const [kind, a, b, c2] = c.t; const src = topo.byName(a); let ok = false, note = '';
        try {
          if (kind === 'ping' || kind === 'noping') {
            let done = false, res = null; src.ping(b, { count: 2, timeout: 1500 }, r => { res = res || r; if (r.ok) res = r; }, () => { done = true; });
            eng.runUntil(() => done, 20000); ok = kind === 'ping' ? !!(res && res.ok) : !(res && res.ok); note = res ? (res.ok ? 'reply from ' + res.from : res.err || res.type || 'no reply') : 'no reply';
          } else if (kind === 'http' || kind === 'nohttp') {
            let done = false, res = null; src.httpGet(b, r => { res = r; done = true; }); eng.runUntil(() => done, 15000);
            ok = kind === 'http' ? !!(res && res.ok) : !(res && res.ok); note = res && res.ok ? 'HTTP ' + res.status : (res && res.err) || '';
          } else if (kind === 'route') { const r = src.lookup(b); ok = !!r && (!c2 || r.proto === c2); note = r ? r.proto + ' via ' + (r.via || r.iface) : 'no route'; }
          else if (kind === 'hasip') { const i = src.iface(b); ok = !!(i && i.ip); note = i && i.ip || 'no address'; }
          else if (kind === 'ospf') { const n = [...src.ospfSt[4].nbrs.values()].filter(x => x.state === 'Full').length; ok = n >= b; note = n + ' Full neighbour(s)'; }
          else if (kind === 'lease') { ok = src.leases.size >= b; note = src.leases.size + ' lease(s)'; }
          else if (kind === 'vlan') { const p = src.iface(b); ok = p.l2.mode === c2.mode && (c2.vlan === undefined || p.l2.vlan === c2.vlan); note = p.l2.mode + ' vlan ' + p.l2.vlan; }
          else if (kind === 'ipsec') { const t = src.ifaces.find(i => i.kind === 'tunnel' && i.tunnel.ipsec); ok = !!t && t.tunnel.ipsec.state === 'up'; note = t ? t.tunnel.ipsec.state : 'none'; }
        } catch (e) { note = e.message; }
        return { desc: c.d, pass: ok, note };
      });
    }
  };
})(window.NL = window.NL || {});
/* tiny helpers so lab files stay short: device spec = [name, type, x, y, options] */
(function (NL) {
  const m = t => (n, x, y, o) => [n, t, x, y, o];
  NL.mk = { pc: m('host'), srv: m('server'), sw: m('switch'), rt: m('router'), l3: m('l3switch'), fw: m('firewall'), cloud: m('cloud'), ap: m('wireless-ap'), sdn: m('sdn-controller') };
  /** "Cloud-NAT": an Internet node that hands out 192.168.122.x by DHCP and answers for every public address. */
  NL.cloudNat = { internet: true, ifaces: { eth0: '192.168.122.1/24' }, dhcpServer: [{ name: 'nat', network: '192.168.122.0/24', from: '192.168.122.2', to: '192.168.122.254', gateway: '192.168.122.1', dns: ['8.8.8.8'] }] };
})(window.NL = window.NL || {});
