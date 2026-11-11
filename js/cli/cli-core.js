/* cli-core.js - A small command interpreter shared by every device terminal.
 * It accepts a mix of VPCS / Linux / MikroTik-style commands so students can use the syntax from the lab manual.
 * SIMPLIFIED: this is NOT a full vendor CLI (that is Phase 3). Commands run instantly (no animation) using the same
 * engine, so results reflect the real simulated network state. */
(function (NL) {
  const A = NL.Addr, pad = (s, n) => String(s).padEnd(n);
  const TCP = [21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 993, 995, 3306, 3389, 5900, 8080, 8291];
  const UDP = [53, 67, 69, 111, 123, 137, 161, 500, 1900, 5678, 20561];
  const SVC = { 21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'domain', 67: 'dhcps', 69: 'tftp', 80: 'http', 110: 'pop3', 111: 'rpcbind', 123: 'ntp', 135: 'msrpc', 137: 'netbios-ns', 139: 'netbios-ssn', 143: 'imap', 161: 'snmp', 443: 'https', 445: 'microsoft-ds', 500: 'isakmp', 993: 'imaps', 995: 'pop3s', 1900: 'upnp', 3306: 'mysql', 3389: 'rdp', 5678: 'mndp', 5900: 'vnc', 8080: 'http-proxy', 8291: 'winbox', 20561: 'mac-winbox' };

  function sync(dev, start, max) { let done = false; start(() => { done = true; }); dev.engine.runUntil(() => done, max || 30000); }
  function kv(args) { const o = {}; args.forEach(a => { const m = /^([\w-]+)=(.*)$/.exec(a); if (m) o[m[1]] = m[2].replace(/^"|"$/g, ''); }); return o; }
  function ifaceTable(d) {
    return d.ifaces.filter(i => i.kind !== 'wlan' || true).map(i => {
      const st = d.ifaceOperUp(i) ? 'UP' : 'DOWN', a4 = i.ip ? i.ip + '/' + i.plen : '-', a6 = i.ip6 ? i.ip6 + '/' + i.plen6 : '';
      const l2 = d.meta.bridge && i.kind === 'eth' ? (i.l2.mode === 'access' ? 'access v' + i.l2.vlan : i.l2.mode === 'trunk' ? 'trunk' : 'off') : '';
      return pad(i.name, 14) + pad(st, 6) + pad(a4, 20) + pad(a6, 28) + pad(i.mac, 19) + l2 + (i.dhcp ? ' [dhcp:' + (i.dhcpState || '') + ']' : '');
    });
  }
  function routeTable(d) {
    return d.routeTable().sort((a, b) => a.proto.localeCompare(b.proto) || a.dst.localeCompare(b.dst)).map(r => pad(r.proto, 3) + pad(r.dst + '/' + r.plen, 34) + pad(r.via || 'directly connected', 24) + pad(r.iface, 12) + '[' + r.ad + '/' + r.metric + ']');
  }

  const CMDS = [];
  const cmd = (re, fn, help) => CMDS.push({ re, fn, help });

  cmd(/^(help|\?)$/, (d, a, out) => { out(['Commands (VPCS / Linux / MikroTik style):', '  ping <host> [-c n]      trace <host>           show ip / ip a / ip address print', '  show route / ip route / ip route print          arp / ip neigh        show mac / show vlan', '  ip <addr/len> [gw]      ip dhcp                ip address add address=A/n interface=X', '  ip route add dst-address=N/n gateway=G         system identity set name=X', '  nslookup <name>         curl <url>             nmap [-sn|-sT|-sU|-O] <target>', '  routing rip route print / routing ospf neighbor print / ip dhcp-server lease print', '  ip firewall filter print / ip firewall nat print / show nat / wg show / clear']); });
  cmd(/^clear$/, (d, a, out, ui) => ui && ui.clear());
  cmd(/^(show ip|ip a|ip addr|ip address print|ifconfig|ipconfig|interface print|show interfaces)$/, (d, a, out) => { out([d.name + '  (OS: ' + d.cfg.os + ')', pad('IFACE', 14) + pad('STATE', 6) + pad('IPv4', 20) + pad('IPv6', 28) + pad('MAC', 19) + 'L2'].concat(ifaceTable(d))); if (d.cfg.gateway) out('IPv4 gateway: ' + d.cfg.gateway); if (d.cfg.gateway6) out('IPv6 gateway: ' + d.cfg.gateway6); if (d.cfg.dns.length) out('DNS: ' + d.cfg.dns.join(', ')); });
  cmd(/^(show route|show ip route|ip route|ip route print|route print|route -n|netstat -r)$/, (d, a, out) => out(['Codes: C connected, S static, R RIP, O OSPF, D DHCP   [AD/metric]'].concat(routeTable(d))));
  cmd(/^(arp|arp -a|ip neigh|show arp|ip arp print)$/, (d, a, out) => out(d.arp.size ? [...d.arp.entries()].map(([ip, e]) => pad(ip, 40) + pad(e.mac, 20) + e.iface) : ['(ARP/ND cache is empty)']));
  cmd(/^(show mac|show mac address-table|mac-table|bridge host print)$/, (d, a, out) => out(d.meta.bridge ? ['VLAN  MAC                PORT'].concat(d.macRows().map(r => pad(r.vlan, 6) + pad(r.mac, 19) + r.port)) : ['not a switch']));
  cmd(/^(show vlan|show vlan brief)$/, (d, a, out) => out(d.meta.bridge ? d.ifaces.filter(i => i.kind === 'eth' || i.kind === 'wlan').map(i => pad(i.name, 10) + (i.l2.mode === 'access' ? 'access  vlan ' + i.l2.vlan : i.l2.mode === 'trunk' ? 'trunk   allowed ' + i.l2.allowed + ' native ' + i.l2.native : 'out-of-band (no bridging)')) : ['not a switch']));
  cmd(/^ip (dhcp)$/, (d, a, out) => { const i = d.ifaces.find(x => x.kind === 'eth' || x.kind === 'wlan'); d.setDhcp(i.name, true); sync(d, done => d.after(100, function w() { if (i.dhcpState === 'bound') done(); else d.after(200, w); }), 20000); out(i.dhcpState === 'bound' ? 'DORA IP ' + i.ip + '/' + i.plen + (d.cfg.gateway ? ' GW ' + d.cfg.gateway : '') : "Can't find dhcp server"); });
  cmd(/^ip ([0-9a-fA-F:.]+(?:\/\d+)?)(?: ([0-9a-fA-F:.]+))?$/, (d, a, out) => { const i = d.ifaces.find(x => x.kind === 'eth' || x.kind === 'wlan'); let addr = a[1]; if (a[2] && A.parse(a[2]) && addr.includes('.') && !addr.includes('/')) { /* ip A.B.C.D mask */ } try { d.setAddr(i.name, addr); if (a[2]) { if (A.parse(a[2]).v === 6) d.cfg.gateway6 = a[2]; else d.cfg.gateway = a[2]; } d.restart(); out('Set ' + i.name + ' ' + addr + (a[2] ? ' gateway ' + a[2] : '')); } catch (e) { out(e.message); } });
  cmd(/^(?:\/)?ip address add (.+)$/, (d, a, out) => { const o = kv(a[1].split(/\s+/)); try { d.setAddr(o.interface, o.address); out('added ' + o.address + ' on ' + o.interface); } catch (e) { out('failure: ' + e.message); } });
  cmd(/^(?:\/)?ip route add (.+)$/, (d, a, out) => { const o = kv(a[1].split(/\s+/)); try { d.addRoute(o['dst-address'], o.gateway); out('route added'); } catch (e) { out('failure: ' + e.message); } });
  cmd(/^(?:\/)?system identity set name=(\S+)$/, (d, a, out) => { d.name = a[1]; out('identity set: ' + a[1]); });
  cmd(/^(?:\/)?(?:ip dns set servers=(\S+))$/, (d, a, out) => { d.cfg.dns = a[1].split(','); d.cfg.dnsStatic = true; out('dns servers: ' + d.cfg.dns.join(', ')); });
  cmd(/^(?:ping|ping6|ping -6) (\S+)(?: -c (\d+))?$/, (d, a, out) => {
    const n = +(a[2] || 4); let ok = 0, sent = 0;
    sync(d, done => d.ping(a[1], { count: n, timeout: 2000 }, r => { sent++; if (r.ok) { ok++; out(`${n && ''}${r.bytes || 64} bytes from ${r.from}: icmp_seq=${r.seq} ttl=${r.ttl} time=${r.rtt.toFixed(1)} ms`); } else out(r.type ? `From ${r.from}: icmp_seq=${r.seq} ${r.type.replace(/-/g, ' ')}` : `icmp_seq=${r.seq || sent} ${r.err}`); }, done), 30000);
    out(`--- ${a[1]} ping statistics: ${sent} sent, ${ok} received, ${sent ? Math.round(100 - ok * 100 / sent) : 100}% loss`);
  });
  cmd(/^(?:trace|traceroute|tracert|tracepath|mtr) (\S+)$/, (d, a, out) => {
    sync(d, done => d.traceroute(a[1], (ttl, r) => out(pad(ttl, 3) + (r.from ? r.from + '  ' + r.rtt.toFixed(1) + ' ms' + (r.type === 'time-exceeded' || r.ok ? '' : '  (' + r.type + ')') : '*  ' + (r.err || ''))), done), 60000);
  });
  cmd(/^(?:nslookup|dig|host) (\S+)$/, (d, a, out) => { sync(d, done => d.resolve(a[1], (ip, err) => { out(ip ? `Name: ${a[1]}\nAddress: ${ip}` : '** ' + err); done(); }), 8000); });
  cmd(/^(?:curl|wget|http|browse) (\S+)$/, (d, a, out) => { sync(d, done => d.httpGet(a[1], r => { out(r.ok ? ['HTTP/1.1 ' + r.status + ' OK', r.body] : 'curl: ' + r.err); done(); }), 15000); });
  cmd(/^(?:\/)?routing rip route print$/, (d, a, out) => out(['DST-ADDRESS         GATEWAY        IFACE    METRIC'].concat([...d.ripRt.values()].map(r => pad(r.dst + '/' + r.plen, 20) + pad(r.via, 15) + pad(r.iface, 9) + r.metric + (r.metric >= 16 ? ' (invalid)' : '')))));
  cmd(/^(?:\/)?routing ospf neighbor print$/, (d, a, out) => out(['ROUTER-ID        ADDRESS       INTERFACE  STATE'].concat([4, 6].flatMap(v => [...d.ospfSt[v].nbrs.values()].map(n => pad(n.rid, 17) + pad(n.ip, 14) + pad(n.iface, 11) + n.state + (v === 6 ? ' (v3)' : ''))))));
  cmd(/^(?:\/)?ip dhcp-server lease print$/, (d, a, out) => out(d.leases.size ? ['ADDRESS         MAC                HOST'].concat([...d.leases.entries()].map(([m, l]) => pad(l.ip, 16) + pad(m, 19) + (l.host || ''))) : ['no leases']));
  cmd(/^(?:\/)?ip firewall filter print$/, (d, a, out) => out(d.cfg.firewall.length ? d.cfg.firewall.map((r, i) => `${i} ${r.chain} ${r.action} ${r.protocol || 'any'}${r.srcAddress ? ' src=' + r.srcAddress : ''}${r.dstAddress ? ' dst=' + r.dstAddress : ''}${r.port ? ' port=' + r.port : ''}${r.dstPort ? ' dst-port=' + r.dstPort : ''}${r.connState ? ' state=' + r.connState : ''}${r.inInterface ? ' in=' + r.inInterface : ''} hits=${r.hits || 0}${r.comment ? '  ;;; ' + r.comment : ''}`) : ['no rules (all traffic accepted)']));
  cmd(/^(?:\/)?(?:ip firewall nat print|show nat|show ip nat translations)$/, (d, a, out) => { const rows = d.natRows(); out(rows.length ? ['PROTO  INSIDE               OUTSIDE              REMOTE'].concat(rows.map(r => pad(r.proto, 7) + pad(r.inside, 21) + pad(r.outside, 21) + r.remote)) : ['(NAT table empty)']); });
  cmd(/^(?:sudo )?wg(?: show)?$/, (d, a, out) => { const w = d.ifaces.filter(i => i.kind === 'tunnel' && i.tunnel.mode === 'wireguard'); out(w.length ? w.flatMap(i => ['interface: ' + i.name, '  public key: ' + i.tunnel.publicKey, '  listening port: ' + i.tunnel.port].concat(i.tunnel.peers.flatMap(p => ['', 'peer: ' + p.publicKey, '  endpoint: ' + (p.endpoint ? p.endpoint + ':' + (p.port || 51820) : '(none)'), '  allowed ips: ' + p.allowed.join(', '), '  latest handshake: ' + (p.handshake ? 'at ' + (p.handshake / 1000).toFixed(1) + ' s' : 'never')]))) : ['no WireGuard interface']); });
  cmd(/^(?:sudo )?nmap (.+)$/, (d, a, out) => nmap(d, a[1].split(/\s+/), out));

  function targets(t) { const c = A.cidr(t); if (!c) return [t]; if (c.v === 6 || !t.includes('/')) return [c.ip]; const info = A.subnetInfo(c.ip, c.plen), base = A.parse(info.first).n, list = []; if (info.hosts > 1024) return null; for (let i = 0n; i < BigInt(info.hosts); i++) list.push(A.str(4, base + i)); return list; }
  function nmap(d, args, out) {
    const flags = args.filter(x => x.startsWith('-')), t = args.filter(x => !x.startsWith('-')).pop(); const tp = (args.join(' ').match(/--top-ports[= ](\d+)/) || [])[1];
    if (!t) return out('usage: nmap [-sn|-sT|-sS|-sU|-O] <ip|cidr>');
    const list = targets(t); if (!list) return out('target range too large (max /22 in this simulator)');
    out('Starting Nmap (simulated) at sim-time ' + (d.engine.time / 1000).toFixed(1) + ' s');
    if (flags.includes('-sn')) {
      let up = 0, n = list.length, left = n;
      sync(d, done => list.forEach(ip => d.pingOnce(ip, { timeout: 1500 }, r => { if (r.ok) { up++; const dev = d.topo.findByIp(ip); out('Nmap scan report for ' + (dev ? dev.name + ' (' + ip + ')' : ip) + '\nHost is up (' + (r.rtt / 1000).toFixed(4) + 's latency).'); } if (--left === 0) done(); })), 20000);
      return out(`Nmap done: ${n} IP address(es) (${up} host(s) up)`);
    }
    const udp = flags.includes('-sU'), ports = udp ? UDP : (tp ? TCP.slice(0, +tp) : TCP);
    list.forEach(ip => {
      const res = []; let left = ports.length;
      sync(d, done => ports.forEach(p => (udp ? d.udpProbe : d.tcpProbe).call(d, ip, p, r => { res.push([p, r]); if (--left === 0) done(); }, 1500)), 30000);
      res.sort((x, y) => x[0] - y[0]); const dev = d.topo.findByIp(ip);
      out('Nmap scan report for ' + (dev ? dev.name + ' (' + ip + ')' : ip));
      const shown = res.filter(r => r[1] === 'open' || (udp && r[1] === 'open|filtered' && false));
      const hidden = {}; res.filter(r => r[1] !== 'open').forEach(r => hidden[r[1]] = (hidden[r[1]] || 0) + 1);
      if (Object.keys(hidden).length) out('Not shown: ' + Object.entries(hidden).map(([k, v]) => v + ' ' + k + ' ports').join(', '));
      if (shown.length) out(['PORT           STATE  SERVICE' + (flags.includes('-sV') || udp ? '  VERSION' : '')].concat(shown.map(r => { const s = dev && (dev.cfg.services.find(x => x.port === r[0] && x.proto === (udp ? 'udp' : 'tcp')) || {}).name; return pad(r[0] + '/' + (udp ? 'udp' : 'tcp'), 15) + pad('open', 7) + (s || SVC[r[0]] || 'unknown'); })));
      else out('All scanned ports are closed/filtered');
      if (flags.includes('-O')) out('OS details: ' + (dev ? dev.cfg.os : 'unknown (no open+closed port fingerprint)') + '   [simulated fingerprint]');
    });
    out('Nmap done.');
  }

  NL.Cli = {
    names: ['ping', 'trace', 'traceroute', 'show ip', 'show route', 'ip address print', 'ip route print', 'arp', 'nslookup', 'curl', 'nmap', 'wg show', 'help', 'clear', 'routing rip route print', 'routing ospf neighbor print', 'ip dhcp-server lease print', 'ip firewall filter print', 'ip firewall nat print', 'show mac', 'show vlan'],
    prompt(d) { return d.meta.forwarding ? '[admin@' + d.name + '] > ' : d.meta.bridge ? d.name + '# ' : d.name + '> '; },
    run(d, line, out, ui) {
      line = line.trim().replace(/^\//, '').replace(/\s+/g, ' '); if (!line) return;
      for (const c of CMDS) { const m = c.re.exec(line); if (m) { try { c.fn(d, m, t => out(Array.isArray(t) ? t.join('\n') : t), ui); } catch (e) { out('error: ' + e.message); } return; } }
      out(`bad command name ${line.split(' ')[0]} (line 1 column 1) - type "help"`);
    },
    complete(frag) { return NL.Cli.names.filter(n => n.startsWith(frag.trim())); }
  };
})(window.NL = window.NL || {});
