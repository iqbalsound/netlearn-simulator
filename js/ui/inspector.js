/* inspector.js - Right-hand panel. Tabs: Config (edit the device/cable), Tables (live routing/ARP/MAC/NAT...). */
(function (NL) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const opt = (list, cur) => list.map(x => '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
  const lbl = (t, h) => '<label>' + t + h + '</label>';
  const inp = (act, val, extra) => '<input data-act="' + act + '" value="' + esc(val) + '" ' + (extra || '') + '>';
  const sec = (t, body, open) => '<details class="sec"' + (open === false ? '' : ' open') + '><summary>' + t + '</summary>' + body + '</details>';

  NL.Inspector = class {
    constructor(el, topology, view) { this.el = el; this.topo = topology; this.view = view; this.tab = 'config'; this.sel = null;
      el.addEventListener('change', e => this.onEvent(e)); el.addEventListener('click', e => { if (e.target.dataset.tab) { this.tab = e.target.dataset.tab; this.render(this.sel); } else if (e.target.matches('button[data-act]')) this.onEvent(e); });
      setInterval(() => { if (this.tab === 'tables' && this.sel && this.sel.kind === 'device') this.renderTables(); }, 700); }
    get dev() { return this.sel && this.sel.kind === 'device' ? this.topo.devices.get(this.sel.id) : null; }

    render(sel) {
      this.sel = sel; const d = this.dev;
      if (!sel) { this.el.innerHTML = '<p class="hint">Nothing selected.<br>Click a device or a cable to configure it.</p>'; return; }
      if (sel.kind === 'link') return this.renderLink(this.topo.links.get(sel.id));
      if (!d) return this.render(null);
      const tabs = ['config', 'tables'].map(t => '<button data-tab="' + t + '" class="' + (this.tab === t ? 'active' : '') + '">' + (t === 'config' ? 'Config' : 'Tables') + '</button>').join('');
      this.el.innerHTML = '<div class="tabs">' + tabs + '</div><div id="insp-body"></div>';
      this.tab === 'config' ? this.renderConfig(d) : this.renderTables();
    }
    body() { return this.el.querySelector('#insp-body'); }

    renderConfig(d) {
      const m = d.meta, c = d.cfg, ifs = d.ifaces, fwd = c.forwarding, br = m.bridge, isAp = d.type === 'wireless-ap';
      let h = '<h3>' + m.label + '</h3>' + lbl('Name', inp('name', d.name));
      // ---- interfaces
      const rows = ifs.map(i => {
        const cable = i.kind === 'eth' ? (i.linkId ? '<span class="ok">linked</span>' : '<span class="muted">free</span>') : i.kind === 'wlan' ? (isAp ? (i.wifiLinks.length + ' client(s)') : esc((i.wifi && i.wifi.state) || '')) : i.kind;
        let l2 = '';
        if (br && (i.kind === 'eth' || (isAp && i.kind === 'wlan'))) l2 = '<div class="l2"><select data-act="l2mode" data-i="' + i.name + '">' + ['access', 'trunk', 'none'].map(x => '<option' + (i.l2.mode === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select>' +
          (i.l2.mode === 'access' ? ' VLAN ' + inp('l2vlan', i.l2.vlan, 'data-i="' + i.name + '" type="number" min="1" max="4094" class="s"') : i.l2.mode === 'trunk' ? ' allowed ' + inp('l2allowed', i.l2.allowed, 'data-i="' + i.name + '" class="m" title="all or 10,20,30-40"') + ' native ' + inp('l2native', i.l2.native, 'data-i="' + i.name + '" type="number" class="s"') : '') + '</div>';
        let ip = '';
        if (!(br && (i.kind === 'eth' || i.kind === 'wlan')) || i.kind === 'svi') ip = '<div class="ipr">' + inp('ifIp', i.ip ? i.ip + '/' + i.plen : '', 'data-i="' + i.name + '" placeholder="IPv4 a.b.c.d/n"' + (i.dhcp ? ' disabled' : '')) +
          '<label class="chk"><input type="checkbox" data-act="ifDhcp" data-i="' + i.name + '"' + (i.dhcp ? ' checked' : '') + '>DHCP</label>' + inp('ifIp6', i.ip6 ? i.ip6 + '/' + i.plen6 : '', 'data-i="' + i.name + '" placeholder="IPv6 addr/64"') + (i.dhcp ? '<div class="hint">' + esc(i.dhcpState || '') + (i.ip ? ' → ' + i.ip + '/' + i.plen : '') + '</div>' : '') + (i.ip6auto ? '<div class="hint">SLAAC ' + i.ip6 + '</div>' : '') + '</div>';
        const wifi = (i.kind === 'wlan' && !isAp) ? '<div class="ipr">' + inp('wifiSsid', i.wifi.ssid, 'data-i="' + i.name + '" placeholder="SSID"') + inp('wifiPass', i.wifi.password, 'data-i="' + i.name + '" placeholder="password"') + '</div>' : '';
        return '<div class="ifc"><div class="ifh"><b>' + esc(i.name) + '</b> <label class="chk"><input type="checkbox" data-act="ifUp" data-i="' + i.name + '"' + (i.up ? ' checked' : '') + '>up</label><span class="muted">' + cable + '</span>' + (['vlan', 'svi', 'tunnel'].includes(i.kind) ? ' <button data-act="delIf" data-i="' + i.name + '" class="x">✕</button>' : '') + '</div>' + l2 + ip + wifi + '</div>';
      }).join('');
      h += sec('Interfaces', rows + (br ? '<div class="add">SVI (IP in a VLAN): ' + inp('svi_v', '', 'id="svi_v" class="s" placeholder="VLAN"') + '<button data-act="addSvi">+ SVI</button></div>' : '') +
        (!br && !isAp && d.type !== 'host' ? '<div class="add">VLAN sub-interface: <select id="vif_p">' + opt(ifs.filter(i => i.kind === 'eth').map(i => i.name)) + '</select>' + inp('vif_id', '', 'id="vif_id" class="s" placeholder="id"') + '<button data-act="addVlanIf">+ VLAN</button></div>' : ''));
      // ---- host settings
      if (!br || d.ifaces.some(i => i.kind === 'svi')) h += sec('IP settings', lbl('Default gateway (IPv4)', inp('gw', c.gateway || '')) + lbl('Default gateway (IPv6)', inp('gw6', c.gateway6 || '')) + lbl('DNS servers (comma)', inp('dns', c.dns.join(','))) + '<label class="chk"><input type="checkbox" data-act="slaac"' + (c.slaac ? ' checked' : '') + '>IPv6 SLAAC (learn prefix from Router Advertisements)</label>' + lbl('Hosts file (name=ip per line)', '<textarea data-act="hosts" rows="2">' + esc(Object.entries(c.hosts).map(([k, v]) => k + '=' + v).join('\n')) + '</textarea>'), !fwd);
      if (isAp) h += sec('Access point', lbl('SSID', inp('ssid', c.ssid)) + lbl('Security', '<select data-act="sec">' + opt(['open', 'wpa2'], c.security) + '</select>') + lbl('Password', inp('appass', c.password)) + '<p class="hint">Clients join by SSID + password. Range and channels are not simulated.</p>');
      if (d.type === 'cloud') h += '<label class="chk"><input type="checkbox" data-act="internet"' + (c.internet ? ' checked' : '') + '>Act as the Internet (answers every public IP, DNS: google.com …)</label>';
      // ---- routing
      if (fwd) {
        const routes = c.routes.map((r, n) => '<tr><td>' + r.dst + '/' + r.plen + '</td><td>' + esc(r.via || r.iface) + '</td><td><button data-act="delRoute" data-n="' + n + '" class="x">✕</button></td></tr>').join('');
        h += sec('Static routes', '<table class="mini">' + routes + '</table><div class="add">' + inp('rt_d', '', 'id="rt_d" placeholder="10.0.0.0/24 or 0.0.0.0/0"') + inp('rt_v', '', 'id="rt_v" placeholder="gateway"') + '<button data-act="addRoute">+ Add</button></div>');
        h += sec('RIP (v2 / RIPng)', '<label class="chk"><input type="checkbox" data-act="ripEn"' + (c.rip.enabled ? ' checked' : '') + '>Enable RIP</label>' + lbl('Networks (one CIDR per line, IPv4 or IPv6)', '<textarea data-act="ripNets" rows="3">' + esc(c.rip.networks.join('\n')) + '</textarea>') + lbl('Passive interfaces (comma)', inp('ripPas', c.rip.passive.join(','))) + '<label class="chk"><input type="checkbox" data-act="ripDef"' + (c.rip.defaultOriginate ? ' checked' : '') + '>Distribute default route</label><div class="ipr">update ' + inp('ripUp', c.rip.update / 1000, 'type="number" class="s"') + 's timeout ' + inp('ripTo', c.rip.timeout / 1000, 'type="number" class="s"') + 's</div>', false);
        h += sec('OSPF (v2 / v3)', '<label class="chk"><input type="checkbox" data-act="ospfEn"' + (c.ospf.enabled ? ' checked' : '') + '>Enable OSPF</label>' + lbl('Router ID (blank = auto)', inp('ospfRid', c.ospf.routerId)) + lbl('Networks (CIDR [area] per line)', '<textarea data-act="ospfNets" rows="3">' + esc(c.ospf.networks.map(n => n.network + (n.area !== '0.0.0.0' ? ' ' + n.area : '')).join('\n')) + '</textarea>') + lbl('Default route', '<select data-act="ospfDef">' + opt(['never', 'if-installed', 'always'], c.ospf.defaultOriginate) + '</select>'), false);
        h += sec('NAT (masquerade / PAT)', c.nat.map((n, i) => '<div>masquerade out <b>' + esc(n.outInterface) + '</b> <button data-act="delNat" data-n="' + i + '" class="x">✕</button></div>').join('') + '<div class="add"><select id="nat_i">' + opt(ifs.map(i => i.name)) + '</select><button data-act="addNat">+ Masquerade</button></div>', false);
        const rules = c.firewall.map((r, i) => '<div class="rule"><span>' + i + '</span> <b>' + r.chain + '</b> ' + r.action + ' ' + (r.protocol || 'any') + (r.srcAddress ? ' src ' + r.srcAddress : '') + (r.dstAddress ? ' dst ' + r.dstAddress : '') + (r.port ? ' port ' + r.port : '') + (r.dstPort ? ' dport ' + r.dstPort : '') + (r.connState ? ' state ' + r.connState : '') + (r.inInterface ? ' in ' + r.inInterface : '') + '<span class="muted"> hits ' + (r.hits || 0) + (r.comment ? ' · ' + esc(r.comment) : '') + '</span> <button data-act="ruleUp" data-n="' + i + '" class="x">↑</button><button data-act="ruleDn" data-n="' + i + '" class="x">↓</button><button data-act="ruleDel" data-n="' + i + '" class="x">✕</button></div>').join('');
        h += sec('Firewall (top → bottom, first match wins)', rules + '<div class="add grid"><select id="fw_ch">' + opt(['forward', 'input', 'output']) + '</select><select id="fw_ac">' + opt(['accept', 'drop']) + '</select><select id="fw_pr">' + opt(['any', 'icmp', 'tcp', 'udp', 'esp', 'gre', 'ospf']) + '</select>' + inp('fw_s', '', 'id="fw_s" placeholder="src cidr"') + inp('fw_d', '', 'id="fw_d" placeholder="dst cidr"') + inp('fw_p', '', 'id="fw_p" placeholder="port" class="s"') + inp('fw_st', '', 'id="fw_st" placeholder="state: new / established,related"') + inp('fw_c', '', 'id="fw_c" placeholder="comment"') + '<button data-act="addRule">+ Rule</button></div><p class="hint">No rule matches → accept. Put specific allows ABOVE the final drop.</p>', false);
      }
      // ---- services
      const pools = c.dhcpServers.map((p, i) => '<div>' + esc(p.network) + ' gw ' + esc(p.gateway || '-') + ' <button data-act="delPool" data-n="' + i + '" class="x">✕</button></div>').join('');
      const relays = c.dhcpRelays.map((r, i) => '<div>relay ' + r.iface + ' → ' + r.server + ' <button data-act="delRelay" data-n="' + i + '" class="x">✕</button></div>').join('');
      if (!br) h += sec('DHCP server / relay', pools + '<div class="add grid">' + inp('dp_n', '', 'id="dp_n" placeholder="network 10.0.1.0/24"') + inp('dp_g', '', 'id="dp_g" placeholder="gateway"') + inp('dp_f', '', 'id="dp_f" placeholder="from (opt)"') + inp('dp_t', '', 'id="dp_t" placeholder="to (opt)"') + inp('dp_dns', '8.8.8.8', 'id="dp_dns" placeholder="dns"') + '<button data-act="addPool">+ Pool</button></div>' + relays + '<div class="add"><select id="rl_i">' + opt(ifs.map(i => i.name)) + '</select>' + inp('rl_s', '', 'id="rl_s" placeholder="DHCP server IP"') + '<button data-act="addRelay">+ Relay</button></div>', false);
      if (!br) h += sec('DNS records & services', lbl('DNS records served (name=ip per line)', '<textarea data-act="records" rows="2">' + esc(Object.entries(c.dnsRecords).map(([k, v]) => k + '=' + v).join('\n')) + '</textarea>') + c.services.map((s, i) => '<label class="chk"><input type="checkbox" data-act="svcOn" data-n="' + i + '"' + (s.on !== false ? ' checked' : '') + '>' + s.proto + '/' + s.port + ' ' + esc(s.name) + '</label>').join('') + '<div class="add"><select id="sv_p">' + opt(['tcp', 'udp']) + '</select>' + inp('sv_n', '', 'id="sv_n" class="s" placeholder="port"') + inp('sv_s', '', 'id="sv_s" placeholder="name"') + '<button data-act="addSvc">+ Service</button></div>', false);
      if (!br) h += sec('Tunnels / VPN', '<div class="add grid"><select id="tn_m">' + opt(['gre', 'ipip', '6in4', 'wireguard']) + '</select>' + inp('tn_n', 'tun0', 'id="tn_n" placeholder="name"') + inp('tn_l', '', 'id="tn_l" placeholder="local ip"') + inp('tn_r', '', 'id="tn_r" placeholder="remote ip"') + inp('tn_a', '', 'id="tn_a" placeholder="tunnel ip/len (v4 or v6)"') + inp('tn_k', '', 'id="tn_k" placeholder="IPsec secret (opt)"') + '<button data-act="addTun">+ Tunnel</button></div><p class="hint">GRE/IPsec/6in4: concept-level (no real crypto). WireGuard peers: use Lab 12 as an example.</p>', false);
      this.body().innerHTML = h + '<button data-act="delDev" class="danger">Delete device</button>';
    }

    renderTables() {
      const d = this.dev; if (!d || !this.body()) return; const A = NL.Addr;
      const tbl = (t, head, rows) => '<h4>' + t + '</h4>' + (rows.length ? '<table class="mini"><tr>' + head.map(x => '<th>' + x + '</th>').join('') + '</tr>' + rows.map(r => '<tr>' + r.map(x => '<td>' + esc(x) + '</td>').join('') + '</tr>').join('') + '</table>' : '<p class="hint">empty</p>');
      let h = '<h3>' + esc(d.name) + ' <span class="muted">tables</span></h3>';
      h += tbl('Interfaces', ['name', 'state', 'address', 'mac'], d.ifaces.map(i => [i.name, d.ifaceOperUp(i) ? 'up' : 'down', (i.ip ? i.ip + '/' + i.plen : '') + (i.ip6 ? ' ' + i.ip6 : ''), i.mac]));
      if (!d.meta.bridge || d.ifaces.some(i => i.kind === 'svi')) { h += tbl('Routing table', ['', 'destination', 'via', 'iface', 'AD/m'], d.routeTable().map(r => [r.proto, r.dst + '/' + r.plen, r.via || '-', r.iface, r.ad + '/' + r.metric])); h += tbl('ARP / ND cache', ['ip', 'mac', 'iface'], [...d.arp.entries()].map(([ip, e]) => [ip, e.mac, e.iface])); }
      if (d.meta.bridge) h += tbl('MAC address table', ['vlan', 'mac', 'port'], d.macRows().map(r => [r.vlan, r.mac, r.port]));
      if (d.cfg.rip.enabled) h += tbl('RIP routes', ['dst', 'via', 'metric'], [...d.ripRt.values()].map(r => [r.dst + '/' + r.plen, r.via, r.metric]));
      if (d.cfg.ospf.enabled) h += tbl('OSPF neighbours', ['router-id', 'iface', 'state'], [4, 6].flatMap(v => [...d.ospfSt[v].nbrs.values()].map(n => [n.rid, n.iface, n.state + (v === 6 ? ' v3' : '')])));
      if (d.leases.size) h += tbl('DHCP leases', ['ip', 'mac', 'host'], [...d.leases.entries()].map(([m, l]) => [l.ip, m, l.host || '']));
      if (d.natOut.size) h += tbl('NAT translations', ['proto', 'inside', 'outside', 'remote'], d.natRows().map(r => [r.proto, r.inside, r.outside, r.remote]));
      if (d.cfg.firewall.length) h += '<h4>Connection tracking</h4><p class="hint">' + d.ct.size + ' tracked flow(s)</p>';
      const tun = d.ifaces.filter(i => i.kind === 'tunnel'); if (tun.length) h += tbl('Tunnels', ['name', 'mode', 'remote', 'IPsec'], tun.map(i => [i.name, i.tunnel.mode, i.tunnel.remote || i.tunnel.peers.map(p => p.endpoint || '?').join(','), i.tunnel.ipsec ? i.tunnel.ipsec.state : '-']));
      this.body().innerHTML = h;
    }

    renderLink(l) {
      if (!l) return this.render(null); const A = this.topo.devices.get(l.a.dev), B = this.topo.devices.get(l.b.dev), n = (k, t, v, mn, mx) => '<label>' + t + '<input data-act="lk" data-k="' + k + '" type="number" step="any" min="' + mn + '" max="' + mx + '" value="' + v + '"></label>';
      this.el.innerHTML = '<h3>' + (l.kind === 'wifi' ? 'Wi-Fi association' : 'Cable') + '</h3><p class="hint">' + esc(A.name) + ':' + l.a.port + ' ↔ ' + esc(B.name) + ':' + l.b.port + '</p>' + n('bandwidth', 'Bandwidth (Mbps)', l.bandwidth, 0.1, 100000) + n('latency', 'Latency (ms)', l.latency, 0, 5000) + n('jitter', 'Jitter (± ms)', l.jitter, 0, 5000) + n('loss', 'Packet loss (%)', l.loss, 0, 100) +
        '<label class="chk"><input type="checkbox" data-act="lkUp"' + (l.up ? ' checked' : '') + '> Link is up</label><p class="hint">Delay = latency ± jitter + size ÷ bandwidth. Real links also queue and corrupt frames (not modelled).</p>' + (l.kind === 'wifi' ? '' : '<button data-act="delLink" class="danger">Delete cable</button>');
    }

    onEvent(e) {
      const t = e.target, act = t.dataset.act; if (!act) return; const d = this.dev, v = t.type === 'checkbox' ? t.checked : t.value, $ = id => this.el.querySelector('#' + id), i = t.dataset.i, n = +t.dataset.n;
      const re = () => { this.render(this.sel); this.topo.onChange(); }, bad = ex => alert(ex.message || ex);
      try {
        if (act === 'lk') { const l = this.topo.links.get(this.sel.id), x = parseFloat(v); if (!isNaN(x)) l[t.dataset.k] = Math.max(+t.min, Math.min(+t.max, x)); return; }
        if (act === 'lkUp') { this.topo.links.get(this.sel.id).up = v; this.topo.devices.forEach(x => x.restart()); return; }
        if (act === 'delLink') return this.view.deleteSelected();
        if (!d) return; const c = d.cfg, cfgR = () => { d.restart(); };
        const A = {
          name: () => { d.name = v || d.name; this.topo.onChange(); },
          ifUp: () => { d.iface(i).up = v; cfgR(); }, ifIp: () => { d.setAddr(i, v.trim() || null); re(); }, ifIp6: () => { if (v.trim()) d.setAddr(i, v.trim()); else { d.iface(i).ip6 = null; cfgR(); } },
          ifDhcp: () => { d.setDhcp(i, v); re(); }, wifiSsid: () => { d.iface(i).wifi.ssid = v; this.topo.changed(); re(); }, wifiPass: () => { d.iface(i).wifi.password = v; this.topo.changed(); re(); },
          l2mode: () => { d.setPortL2(i, { mode: v }); re(); }, l2vlan: () => d.setPortL2(i, { vlan: +v }), l2allowed: () => d.setPortL2(i, { allowed: v || 'all' }), l2native: () => d.setPortL2(i, { native: +v }),
          gw: () => { c.gateway = v.trim() || null; c.gatewayDhcp = false; cfgR(); }, gw6: () => { c.gateway6 = v.trim() || null; cfgR(); }, dns: () => { c.dns = v.split(',').map(x => x.trim()).filter(Boolean); c.dnsStatic = true; },
          slaac: () => { c.slaac = v; cfgR(); }, hosts: () => { c.hosts = {}; v.split('\n').forEach(l => { const [a, b] = l.split('='); if (a && b) c.hosts[a.trim()] = b.trim(); }); },
          ssid: () => { c.ssid = v; this.topo.changed(); }, sec: () => { c.security = v; this.topo.changed(); }, appass: () => { c.password = v; this.topo.changed(); }, internet: () => { c.internet = v; cfgR(); },
          addRoute: () => { d.addRoute($('rt_d').value, $('rt_v').value.trim() || null); re(); }, delRoute: () => { d.removeRoute(n); re(); },
          ripEn: () => { c.rip.enabled = v; cfgR(); }, ripNets: () => { c.rip.networks = v.split('\n').map(x => x.trim()).filter(Boolean); cfgR(); }, ripPas: () => { c.rip.passive = v.split(',').map(x => x.trim()).filter(Boolean); cfgR(); }, ripDef: () => { c.rip.defaultOriginate = v; cfgR(); }, ripUp: () => { c.rip.update = +v * 1000; cfgR(); }, ripTo: () => { c.rip.timeout = +v * 1000; cfgR(); },
          ospfEn: () => { c.ospf.enabled = v; cfgR(); }, ospfRid: () => { c.ospf.routerId = v.trim(); cfgR(); }, ospfDef: () => { c.ospf.defaultOriginate = v; cfgR(); },
          ospfNets: () => { c.ospf.networks = v.split('\n').map(x => x.trim()).filter(Boolean).map(x => { const [net, area] = x.split(/\s+/); return { network: net, area: area || '0.0.0.0' }; }); cfgR(); },
          addNat: () => { d.addMasquerade($('nat_i').value); re(); }, delNat: () => { c.nat.splice(n, 1); cfgR(); re(); },
          addRule: () => { const r = { chain: $('fw_ch').value, action: $('fw_ac').value, protocol: $('fw_pr').value, srcAddress: $('fw_s').value.trim(), dstAddress: $('fw_d').value.trim(), port: $('fw_p').value.trim(), connState: $('fw_st').value.trim(), comment: $('fw_c').value.trim() }; Object.keys(r).forEach(k => { if (r[k] === '') delete r[k]; }); d.addFilterRule(r); re(); },
          ruleUp: () => { if (n > 0) d.moveRule(n, n - 1); re(); }, ruleDn: () => { if (n < c.firewall.length - 1) d.moveRule(n, n + 1); re(); }, ruleDel: () => { c.firewall.splice(n, 1); cfgR(); re(); },
          addPool: () => { c.dhcpServers.push({ name: 'pool' + (c.dhcpServers.length + 1), network: $('dp_n').value.trim(), gateway: $('dp_g').value.trim() || undefined, from: $('dp_f').value.trim() || undefined, to: $('dp_t').value.trim() || undefined, dns: $('dp_dns').value.split(',').map(x => x.trim()).filter(Boolean) }); cfgR(); re(); }, delPool: () => { c.dhcpServers.splice(n, 1); re(); },
          addRelay: () => { c.dhcpRelays.push({ iface: $('rl_i').value, server: $('rl_s').value.trim() }); re(); }, delRelay: () => { c.dhcpRelays.splice(n, 1); re(); },
          records: () => { c.dnsRecords = {}; v.split('\n').forEach(l => { const [a, b] = l.split('='); if (a && b) c.dnsRecords[a.trim()] = b.trim(); }); c.dnsServer = Object.keys(c.dnsRecords).length > 0; },
          svcOn: () => { c.services[n].on = v; }, addSvc: () => { c.services.push({ proto: $('sv_p').value, port: +$('sv_n').value, name: $('sv_s').value || 'custom' }); re(); },
          addSvi: () => { d.addSvi(+$('svi_v').value); re(); }, addVlanIf: () => { d.addVlanIf('vlan' + $('vif_id').value, $('vif_id').value, $('vif_p').value); re(); }, delIf: () => { d.removeIface(i); re(); },
          addTun: () => { const m = $('tn_m').value, a = $('tn_a').value.trim(); d.addTunnel($('tn_n').value, { mode: m, local: $('tn_l').value.trim(), remote: $('tn_r').value.trim(), ip: a && !a.includes(':') ? a : '', ip6: a.includes(':') ? a : '', ipsecSecret: $('tn_k').value || '' }); re(); },
          delDev: () => this.view.deleteSelected()
        };
        if (A[act]) A[act]();
      } catch (ex) { bad(ex); }
    }
  };
})(window.NL = window.NL || {});
