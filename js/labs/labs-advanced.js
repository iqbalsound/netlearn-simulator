/* labs-advanced.js - Lab manual Labs 10-15 plus Wi-Fi and quick demos. */
(function (NL) {
  const { pc, srv, sw, rt, l3, fw, cloud, ap, sdn } = NL.mk;
  const pool = (name, net, gw) => ({ name, network: net, from: net.replace(/\.0\/24$/, '.2'), to: net.replace(/\.0\/24$/, '.253'), gateway: gw, dns: ['8.8.8.8', '8.8.4.4'], lease: '1d' });

  /* ---------- Lab 10: GRE + IPsec + OSPF (also reused by Lab 11) ---------- */
  const l10dev = [sw('Switch1', 150, 60), pc('TinyCoreA-1', 70, 190), pc('PC1', 220, 190), rt('Router01', 340, 90), rt('Router02', 600, 90), sw('Switch2', 760, 60), srv('DHCPServer', 880, 140), rt('RouterMain-ext', 470, 250), sw('Switch3', 470, 370), pc('TinyCoreB-1', 250, 370), cloud('Cloud-NAT', 330, 470), rt('RouterB1-ext', 700, 370), sw('Switch4', 820, 440), pc('TinyCoreC', 900, 340), pc('PC2', 900, 500)];
  const l10links = [['TinyCoreA-1', 'eth0', 'Switch1', 'e1'], ['PC1', 'eth0', 'Switch1', 'e2'], ['Switch1', 'e0', 'Router01', 'ether3'], ['Router01', 'ether2', 'Router02', 'ether3'], ['Router02', 'ether2', 'Switch2', 'e0'], ['Switch2', 'e1', 'DHCPServer', 'eth0'], ['Router01', 'ether1', 'RouterMain-ext', 'ether2'], ['Router02', 'ether1', 'RouterMain-ext', 'ether3'],
    ['RouterMain-ext', 'ether1', 'Switch3', 'e1'], ['TinyCoreB-1', 'eth0', 'Switch3', 'e3'], ['Switch3', 'e2', 'Cloud-NAT', 'eth0'], ['Switch3', 'e0', 'RouterB1-ext', 'ether1'], ['RouterB1-ext', 'ether2', 'Switch4', 'e1'], ['TinyCoreC', 'eth0', 'Switch4', 'e0'], ['PC2', 'eth0', 'Switch4', 'e2']];
  const guard = { chain: 'input', action: 'accept' };
  const edgeFw = [{ chain: 'input', action: 'accept', connState: 'established,related', comment: 'Accept established' }, { chain: 'input', action: 'accept', protocol: 'esp', comment: 'ESP - Protocol 50' }, { chain: 'input', action: 'accept', protocol: 'udp', dstPort: 500, comment: 'Permit ISAKMP' }, { chain: 'input', action: 'accept', protocol: 'udp', port: 68, comment: 'DHCP client' }, { chain: 'input', action: 'drop', inInterface: 'ether1', comment: 'Drop other inbound from public side' }];
  const l10sol = {
    Router01: { ifaces: { ether1: '10.10.5.1/30', ether2: '10.10.3.1/30', ether3: '10.10.1.254/24' }, ospf: { networks: ['10.10.5.0/30', '10.10.3.0/30', '10.10.1.0/24'] }, relay: [{ iface: 'ether3', server: '10.10.2.1' }], dns: ['8.8.8.8'] },
    Router02: { ifaces: { ether1: '10.10.4.1/30', ether2: '10.10.2.254/24', ether3: '10.10.3.2/30' }, ospf: { networks: ['10.10.4.0/30', '10.10.3.0/30', '10.10.2.0/24'] }, dns: ['8.8.8.8'] },
    'RouterMain-ext': { ifaces: { ether1: 'dhcp', ether2: '10.10.5.2/30', ether3: '10.10.4.2/30' }, ospf: { networks: ['10.10.5.0/30', '10.10.4.0/30', '10.10.7.0/30'], defaultOriginate: 'always' }, nat: ['ether1'], firewall: edgeFw, dns: ['8.8.8.8'] },
    'RouterB1-ext': { ifaces: { ether1: 'dhcp', ether2: '10.10.6.254/24' }, ospf: { networks: ['10.10.6.0/24', '10.10.7.0/30'] }, nat: ['ether1'], firewall: edgeFw, relay: [{ iface: 'ether2', server: '10.10.2.1' }], dns: ['8.8.8.8'] },
    DHCPServer: { ip: '10.10.2.1/24', gw: '10.10.2.254', dhcpServer: [pool('Net01', '10.10.1.0/24', '10.10.1.254'), pool('Net06', '10.10.6.0/24', '10.10.6.254')] },
    'TinyCoreA-1': { dhcp: true }, PC1: { dhcp: true }, TinyCoreC: { dhcp: true }, PC2: { dhcp: true }, 'TinyCoreB-1': { dhcp: true }
  };
  /** The tunnel endpoints are the DHCP-learned "public" addresses, so they can only be configured after DHCP finished. */
  function l10post(topo) {
    const M = topo.byName('RouterMain-ext'), B = topo.byName('RouterB1-ext'), mi = M.iface('ether1').ip, bi = B.iface('ether1').ip;
    if (!mi || !bi) return;
    M.addTunnel('gre-tunnel-B1', { mode: 'gre', local: mi, remote: bi, ip: '10.10.7.1/30', ipsecSecret: 'Test@123' });
    B.addTunnel('gre-tunnel-B1', { mode: 'gre', local: bi, remote: mi, ip: '10.10.7.2/30', ipsecSecret: 'Test@123' });
  }
  const l10checks = [{ t: ['hasip', 'RouterMain-ext', 'ether1'], d: 'RouterMain-ext got a "public" address by DHCP' }, { t: ['ping', 'RouterMain-ext', 'google.com'], d: 'RouterMain-ext pings google.com' }, { t: ['ipsec', 'RouterMain-ext'], d: 'IPsec SA established on the GRE tunnel' }, { t: ['ping', 'RouterMain-ext', '10.10.7.2'], d: 'Main pings the branch tunnel IP (through GRE)' },
    { t: ['ospf', 'Router01', 1], d: 'Router01 has an OSPF neighbour' }, { t: ['ping', 'Router01', 'google.com'], d: 'Router01 pings google.com (default via OSPF + NAT)' }, { t: ['ping', 'RouterB1-ext', '10.10.1.254'], d: 'Branch reaches Router01 Net01 via the tunnel' }, { t: ['hasip', 'TinyCoreA-1', 'eth0'], d: 'TinyCoreA-1 got DHCP (relay)' }, { t: ['hasip', 'TinyCoreC', 'eth0'], d: 'TinyCoreC (branch) got DHCP across the tunnel' }, { t: ['ping', 'TinyCoreA-1', '10.10.6.254'], d: 'TinyCoreA-1 reaches the branch LAN gateway through the tunnel' }];
  NL.addLab({
    id: 'lab10', group: 'Manual Labs', level: 'Advanced', title: 'Lab 10 - GRE tunnel with IPsec, OSPF and NAT',
    objective: 'Join a Main Office (OSPF) and a Remote Branch over an encrypted GRE tunnel across the "Internet", with NAT, DHCP relay and edge firewalls.',
    steps: ['Addressing plan: Net01 10.10.1.0/24, Net02 10.10.2.0/24, Net03 10.10.3.0/30, Net04 10.10.4.0/30, Net05 10.10.5.0/30, Net06 10.10.6.0/24, tunnel Net07 10.10.7.0/30.', 'RouterMain-ext and RouterB1-ext: ether1 = DHCP client from the Cloud-NAT; masquerade on ether1; DNS 8.8.8.8.', 'Read each router\'s ether1 address, then add a GRE tunnel interface on both (remote = the other router\'s ether1, secret Test@123) and give the tunnel 10.10.7.1/30 and 10.10.7.2/30.', 'OSPF: Router01, Router02, RouterMain-ext use backbone area for their private nets; RouterMain-ext originates the default route; RouterB1-ext runs OSPF on Net06 + the tunnel.', 'DHCPServer 10.10.2.1/24 (default route via Router02) with pools for Net01 and Net06; relays on Router01 ether3 and RouterB1-ext ether2.', 'Edge firewall on both public routers: accept ESP, accept UDP/500, accept established, drop the rest on ether1.', 'Verify: ping across the tunnel, ospf neighbors, both TinyCores reach google.com.'],
    hints: ['"Show Solution" configures everything for you: use it to compare.', 'GRE alone is not encrypted; the ipsec-secret turns on IPsec (watch UDP/500 then ESP frames with Control packets on).', 'OSPF over a tunnel interface works because the tunnel looks like a normal point-to-point link.'],
    devices: l10dev, links: l10links, start: { 'Cloud-NAT': NL.cloudNat }, solution: l10sol, postSolve: l10post, checks: l10checks, settle: 120000
  });

  /* ---------- Lab 11: scanning ---------- */
  NL.addLab({
    id: 'lab11', group: 'Manual Labs', level: 'Advanced', title: 'Lab 11 - Scan network devices with nmap',
    objective: 'From the BlackArch host, run host discovery, TCP/UDP port scans and OS detection against the routers and the deliberately weak VM. (Simulated scan engine - for learning.)',
    steps: ['Click "Show solution" first to get the Lab 10 network running (tunnel, OSPF), or build it yourself.', 'Open BlackArch > Terminal. Host discovery: nmap -sn 10.10.2.0/24 and nmap -sn 10.10.6.0/24.', 'TCP scan: nmap -sT 10.10.6.99 (WeakVM) and each router address. UDP scan: nmap -sU 10.10.6.99. OS detection: nmap -O 10.10.6.99.', 'Answer: which ports are open, how many closed/filtered, and which router services are exposed?', 'Defensive follow-up: add an input-chain firewall rule on a router and re-scan. Ports become "filtered" instead of "closed".'],
    hints: ['Open = a service answers SYN with SYN-ACK; closed = RST; filtered = no answer (a firewall dropped it).', 'Only scan systems you own or have permission to test: this lab network is yours.'],
    devices: l10dev.concat([srv('BlackArch', 940, 140, { name: 'BlackArch' }), pc('WeakVM', 840, 560)]).filter(d => d[0] !== 'DHCPServer' || true),
    links: l10links.concat([['BlackArch', 'eth0', 'Switch2', 'e2'], ['WeakVM', 'eth0', 'Switch4', 'e3']]),
    start: { 'Cloud-NAT': NL.cloudNat, WeakVM: { ip: '10.10.6.99/24', gw: '10.10.6.254', services: [{ proto: 'tcp', port: 21, name: 'ftp (vsftpd 2.3.4)' }, { proto: 'tcp', port: 22, name: 'ssh' }, { proto: 'tcp', port: 23, name: 'telnet' }, { proto: 'tcp', port: 80, name: 'http', page: '<h1>Old Apache 1.3</h1>' }, { proto: 'tcp', port: 445, name: 'microsoft-ds' }, { proto: 'tcp', port: 3306, name: 'mysql' }, { proto: 'udp', port: 53, name: 'domain' }, { proto: 'udp', port: 111, name: 'rpcbind' }, { proto: 'udp', port: 137, name: 'netbios-ns' }, { proto: 'udp', port: 161, name: 'snmp' }], os: 'Linux 2.6.x (outdated - vulnerable)' }, BlackArch: { ip: '10.10.2.50/24', gw: '10.10.2.254' } },
    solution: Object.assign({}, l10sol),
    postSolve: l10post,
    checks: [{ t: ['ping', 'BlackArch', '10.10.6.99'], d: 'BlackArch can reach WeakVM across the tunnel' }, { t: ['ping', 'BlackArch', '10.10.3.1'], d: 'BlackArch reaches Router01' }, { t: ['route', 'RouterB1-ext', '10.10.2.0'], d: 'Branch router knows the BlackArch network' }], settle: 120000
  });

  /* ---------- Lab 12: WireGuard ---------- */
  NL.addLab({
    id: 'lab12', group: 'Manual Labs', level: 'Advanced', title: 'Lab 12 - WireGuard VPN (server + two clients)',
    objective: 'Build a VPN overlay 200.111.111.0/24 over a LAN: clients reach the server and each other through the server.',
    steps: ['Underlay: VPNServer 192.168.56.10/24, VPNClient01 192.168.56.11/24, VPNClient02 192.168.56.12/24. Add /etc/hosts: vpnserver.lab12 -> 192.168.56.10 (Config > Hosts).', 'Server: wg0 interface 200.111.111.254/24, listen 51820, peers: client01 (allowed 200.111.111.1/32) and client02 (200.111.111.2/32). Enable IP forwarding.', 'Clients: wg0 200.111.111.1/24 (and .2), peer = server, allowed-ips 200.111.111.0/24, endpoint vpnserver.lab12:51820, keepalive 15.', 'Test: client01 ping 200.111.111.254, then client01 ping 200.111.111.2 (goes via the server). In the terminal run: wg show.'],
    hints: ['Allowed-ips is both a routing table and an access-control list.', 'The server learns each client\'s endpoint from the first (keepalive) packet.'],
    devices: [srv('VPNClient01', 160, 120), srv('VPNClient02', 160, 380), sw('Switch', 400, 250), srv('VPNServer', 680, 250)], links: [['VPNClient01', 'eth0', 'Switch', 'e1'], ['VPNClient02', 'eth0', 'Switch', 'e3'], ['VPNServer', 'eth0', 'Switch', 'e2']],
    start: { VPNServer: { ip: '192.168.56.10/24' }, VPNClient01: { ip: '192.168.56.11/24' }, VPNClient02: { ip: '192.168.56.12/24' } },
    solution: {
      VPNServer: { forward: true, tunnels: [{ name: 'wg0', mode: 'wireguard', ip: '200.111.111.254/24', publicKey: 'srv-pub', peers: [{ publicKey: 'c1-pub', allowed: ['200.111.111.1/32'] }, { publicKey: 'c2-pub', allowed: ['200.111.111.2/32'] }] }] },
      VPNClient01: { hosts: { 'vpnserver.lab12': '192.168.56.10' }, tunnels: [{ name: 'wg0', mode: 'wireguard', ip: '200.111.111.1/24', publicKey: 'c1-pub', peers: [{ publicKey: 'srv-pub', allowed: ['200.111.111.0/24'], endpoint: '192.168.56.10', keepalive: 15 }] }] },
      VPNClient02: { hosts: { 'vpnserver.lab12': '192.168.56.10' }, tunnels: [{ name: 'wg0', mode: 'wireguard', ip: '200.111.111.2/24', publicKey: 'c2-pub', peers: [{ publicKey: 'srv-pub', allowed: ['200.111.111.0/24'], endpoint: '192.168.56.10', keepalive: 15 }] }] }
    },
    checks: [{ t: ['ping', 'VPNClient01', 'vpnserver.lab12'], d: 'Client01 resolves vpnserver.lab12 and pings it' }, { t: ['ping', 'VPNClient01', '200.111.111.254'], d: 'Client01 reaches the server inside the tunnel' }, { t: ['ping', 'VPNClient02', '200.111.111.254'], d: 'Client02 reaches the server inside the tunnel' }, { t: ['ping', 'VPNClient01', '200.111.111.2'], d: 'Client01 reaches Client02 through the server' }], settle: 30000
  });

  /* ---------- Lab 13: IPv6 ---------- */
  const v6p = (n, i) => `2001:db8:1:${n}::${i}/64`;
  NL.addLab({
    id: 'lab13', group: 'Manual Labs', level: 'Advanced', title: 'Lab 13 - Dual-stack IPv4 + IPv6 with OSPF/OSPFv3',
    objective: 'Run IPv4 (OSPF, DHCP relay, NAT) and IPv6 (addresses, SLAAC, OSPFv3) side by side on two routers.',
    steps: ['IPv4 plan: Net1 10.1.1.0/24, Net2 10.1.2.0/24, Net3 10.1.3.0/24 (Router02 ether1), Net4 10.1.4.0/24 (Router02 ether2, DHCPServer .2), Net5 10.1.5.0/30. IPv6: 2001:db8:1:N::/64 for the same networks.', 'Router01 ether4 = DHCP client to Cloud-NAT + masquerade; OSPF advertises the default route.', 'Dual-stack addresses on every router interface (router = ::1). Routers send Router Advertisements: set PCs to "SLAAC" (they build an address from the prefix + MAC).', 'OSPF for IPv4 and OSPFv3 for IPv6 (add the /64 prefixes to the OSPF networks).', 'DHCPServer 10.1.4.2 serves Nets 1-4; relays on Router01 ether1/ether2 and Router02 ether1.', 'Test: PC1 pings PC4 by IPv4 and IPv6, and google.com over IPv4.'],
    hints: ['An IPv6 address = 64-bit prefix + 64-bit interface ID. SLAAC derives the ID from the MAC (EUI-64).', 'Without OSPFv3 the IPv6 ping from PC1 to PC4 fails with "no route".'],
    devices: [pc('PC1', 70, 190), sw('Switch1', 190, 190), rt('Router01', 380, 190), cloud('Cloud-NAT-1', 380, 50), sw('Switch2', 380, 330), pc('PC2', 380, 440), rt('Router02', 620, 190), sw('Switch3', 620, 330), pc('PC3', 620, 440), sw('Switch4', 800, 190), pc('PC4', 900, 100), srv('DHCPServer', 900, 300)],
    links: [['PC1', 'eth0', 'Switch1', 'e0'], ['Switch1', 'e1', 'Router01', 'ether1'], ['Router01', 'ether2', 'Switch2', 'e0'], ['Switch2', 'e1', 'PC2', 'eth0'], ['Router01', 'ether3', 'Router02', 'ether3'], ['Router01', 'ether4', 'Cloud-NAT-1', 'eth0'], ['Router02', 'ether1', 'Switch3', 'e0'], ['Switch3', 'e1', 'PC3', 'eth0'], ['Router02', 'ether2', 'Switch4', 'e0'], ['Switch4', 'e1', 'PC4', 'eth0'], ['Switch4', 'e2', 'DHCPServer', 'eth0']],
    start: { 'Cloud-NAT-1': NL.cloudNat },
    solution: {
      Router01: { ifaces: { ether1: ['10.1.1.1/24', v6p(1, 1)], ether2: ['10.1.2.1/24', v6p(2, 1)], ether3: ['10.1.5.1/30', v6p(5, 1)], ether4: 'dhcp' }, nat: ['ether4'], dns: ['8.8.8.8'], relay: [{ iface: 'ether1', server: '10.1.4.2' }, { iface: 'ether2', server: '10.1.4.2' }],
        ospf: { networks: ['10.1.1.0/24', '10.1.2.0/24', '10.1.5.0/30', '2001:db8:1:1::/64', '2001:db8:1:2::/64', '2001:db8:1:5::/64'], defaultOriginate: 'if-installed' } },
      Router02: { ifaces: { ether1: ['10.1.3.1/24', v6p(3, 1)], ether2: ['10.1.4.1/24', v6p(4, 1)], ether3: ['10.1.5.2/30', v6p(5, 2)] }, dns: ['8.8.8.8'], relay: [{ iface: 'ether1', server: '10.1.4.2' }],
        ospf: { networks: ['10.1.3.0/24', '10.1.4.0/24', '10.1.5.0/30', '2001:db8:1:3::/64', '2001:db8:1:4::/64', '2001:db8:1:5::/64'] } },
      DHCPServer: { ip: '10.1.4.2/24', gw: '10.1.4.1', dhcpServer: [pool('n1', '10.1.1.0/24', '10.1.1.1'), pool('n2', '10.1.2.0/24', '10.1.2.1'), pool('n3', '10.1.3.0/24', '10.1.3.1'), pool('n4', '10.1.4.0/24', '10.1.4.1')] },
      PC1: { dhcp: true }, PC2: { dhcp: true }, PC3: { dhcp: true }, PC4: { ip: '10.1.4.50/24', gw: '10.1.4.1', dns: ['8.8.8.8'], ip6: '2001:db8:1:4::50/64', gw6: '2001:db8:1:4::1' }
    },
    checks: [{ t: ['ping', 'Router01', 'google.com'], d: 'Router01 pings google.com (DHCP + NAT)' }, { t: ['ospf', 'Router01', 1], d: 'OSPF adjacency between the routers' }, { t: ['hasip', 'PC1', 'eth0'], d: 'PC1 got an IPv4 address through the relay' }, { t: ['ping', 'PC1', '10.1.4.50'], d: 'PC1 -> PC4 over IPv4' }, { t: ['ping', 'Router01', '2001:db8:1:4::50'], d: 'Router01 -> PC4 over IPv6 (OSPFv3 route)' }, { t: ['ping', 'Router02', '2001:db8:1:1::1'], d: 'Router02 -> Router01 LAN over IPv6' }, { t: ['ping', 'PC4', 'google.com'], d: 'PC4 reaches the Internet' }], settle: 120000
  });

  /* ---------- Lab 14: SDN (approximation) ---------- */
  const ovs = (n, x, y, ports) => l3(n, x, y, { ports });
  NL.addLab({
    id: 'lab14', group: 'Manual Labs', level: 'Advanced', title: 'Lab 14 - Software-defined network (OpenFlow switches + Faucet)',
    objective: 'Three Open vSwitch nodes controlled by Faucet: VLAN 100 for the webterms and DHCPServer, VLAN 200 for the Gateway, routed by the controller to the Internet. (Simplified: OVS acts as a VLAN-aware L3 switch; real OpenFlow tables arrive in Phase 8.)',
    steps: ['Management plane: eth0 of every OVS is out-of-band (not in br0). Faucet and Switch1 sit on 172.20.1.0/24 (cosmetic here).', 'Stage 2 (VLAN 100): put webterm-1/2/3 and DHCPServer-VM ports in access VLAN 100; make the OVS-to-OVS links trunks. DHCPServer-VM 10.20.30.1/24, pool .2-.253, gateway 10.20.30.254.', 'Stage 3 (VLAN 200): Gateway is in VLAN 200. The controller routes: give OpenvSwitch-3 interfaces vlan100 = 10.20.30.254/24 and vlan200 = 10.20.40.254/24.', 'Gateway: ether1 DHCP client from NAT1 + masquerade, ether2 10.20.40.1/24, route 10.20.30.0/24 via 10.20.40.254. OVS-3 default route via 10.20.40.1.', 'Verify webterms get DHCP, ping each other and google.com.'],
    hints: ['In Faucet a "stack" joins several switches into one datapath - here the trunk links do the same job.', 'OpenFlow port numbers start at 1; GNS3/eth numbers start at 0.'],
    devices: [pc('webterm-1', 90, 80), ovs('OpenvSwitch-1', 270, 80, ['eth0', 'eth1', 'eth13', 'eth14']), ovs('OpenvSwitch-2', 700, 80, ['eth0', 'eth1', 'eth14', 'eth15']), pc('webterm-2', 880, 80), ovs('OpenvSwitch-3', 480, 270, ['eth0', 'eth1', 'eth2', 'eth3', 'eth13', 'eth15']), srv('DHCPServer-VM', 140, 270), pc('webterm-3', 880, 270), sw('Switch1', 520, 440), sdn('faucet-faucet-1', 780, 440), rt('Gateway', 280, 440, { ports: ['ether1', 'ether2'] }), cloud('NAT1', 100, 470)],
    links: [['webterm-1', 'eth0', 'OpenvSwitch-1', 'eth1'], ['webterm-2', 'eth0', 'OpenvSwitch-2', 'eth1'], ['webterm-3', 'eth0', 'OpenvSwitch-3', 'eth1'], ['DHCPServer-VM', 'eth0', 'OpenvSwitch-3', 'eth2'], ['Gateway', 'ether2', 'OpenvSwitch-3', 'eth3'], ['Gateway', 'ether1', 'NAT1', 'eth0'],
      ['OpenvSwitch-1', 'eth14', 'OpenvSwitch-2', 'eth14'], ['OpenvSwitch-1', 'eth13', 'OpenvSwitch-3', 'eth13'], ['OpenvSwitch-2', 'eth15', 'OpenvSwitch-3', 'eth15'], ['OpenvSwitch-1', 'eth0', 'Switch1', 'e1'], ['OpenvSwitch-2', 'eth0', 'Switch1', 'e3'], ['OpenvSwitch-3', 'eth0', 'Switch1', 'e0'], ['faucet-faucet-1', 'eth0', 'Switch1', 'e2']],
    start: { NAT1: NL.cloudNat, 'OpenvSwitch-1': { ports: { eth0: { mode: 'none' } } }, 'OpenvSwitch-2': { ports: { eth0: { mode: 'none' } } }, 'OpenvSwitch-3': { ports: { eth0: { mode: 'none' } } }, 'webterm-1': { dhcp: true }, 'webterm-2': { dhcp: true }, 'webterm-3': { dhcp: true } },
    solution: {
      'OpenvSwitch-1': { ports: { eth1: { mode: 'access', vlan: 100 }, eth13: { mode: 'trunk' }, eth14: { mode: 'trunk' } } },
      'OpenvSwitch-2': { ports: { eth1: { mode: 'access', vlan: 100 }, eth14: { mode: 'trunk' }, eth15: { mode: 'trunk' } } },
      'OpenvSwitch-3': { ports: { eth1: { mode: 'access', vlan: 100 }, eth2: { mode: 'access', vlan: 100 }, eth3: { mode: 'access', vlan: 200 }, eth13: { mode: 'trunk' }, eth15: { mode: 'trunk' } }, svis: [[100, '10.20.30.254/24'], [200, '10.20.40.254/24']], routes: [['0.0.0.0/0', '10.20.40.1']] },
      'DHCPServer-VM': { ip: '10.20.30.1/24', gw: '10.20.30.254', dhcpServer: [{ name: 'vlan100', network: '10.20.30.0/24', from: '10.20.30.2', to: '10.20.30.253', gateway: '10.20.30.254', dns: ['8.8.8.8', '8.8.4.4'] }] },
      Gateway: { ifaces: { ether1: 'dhcp', ether2: '10.20.40.1/24' }, nat: ['ether1'], routes: [['10.20.30.0/24', '10.20.40.254']], dns: ['8.8.8.8'] }
    },
    checks: [{ t: ['hasip', 'webterm-1', 'eth0'], d: 'webterm-1 got DHCP in VLAN 100' }, { t: ['hasip', 'webterm-3', 'eth0'], d: 'webterm-3 got DHCP' }, { t: ['lease', 'DHCPServer-VM', 3], d: 'DHCPServer-VM holds 3 leases' }, { t: ['ping', 'webterm-1', '10.20.30.1'], d: 'webterm-1 reaches DHCPServer-VM (same VLAN across OVS-1 -> OVS-3)' }, { t: ['ping', 'webterm-2', 'google.com'], d: 'webterm-2 reaches google.com via controller routing + NAT' }], settle: 60000
  });

  /* ---------- Lab 15: IPv4 core + IPv6 + tunnel ---------- */
  const c = n => ({ ports: n });
  NL.addLab({
    id: 'lab15', group: 'Manual Labs', level: 'Advanced', title: 'Lab 15 - IPv4 OSPF core, IPv6 islands and a 6in4 tunnel',
    objective: 'Two IPv6 departments reach each other across an IPv4-only core using an IPv6-in-IPv4 tunnel between R2 and R4, with RIPng inside the islands.',
    steps: ['IPv4 core (OSPF area 0): R2 f0/1 192.168.10.1, R3 f0/1 192.168.10.2, R3 f0/0 192.168.20.2, R4 f0/0 192.168.20.1; R3 e1/0 172.23.10.254, e1/1 172.23.20.254, e1/2 172.23.30.3 (R6 .6), e1/3 172.23.0.3 (R7 .7).', 'IPv4 PCs: PC4 172.23.10.4, PC5 .5 (gw .254); PC6 172.23.20.6, PC7 .7 (gw 172.23.20.254).', 'IPv6 dept 1: R1 f0/0 1000::1/64 (manual: 1000:1:...:1158/112), f0/1 5000::10/64; R2 f0/0 1000::2/64. PC0 5000::1, PC1 5000::2 (gw 5000::10). Dept 2: R4 f0/1 3000::2/64, R5 f0/1 3000::1/64, f0/0 6000::10/64; PC2 6000::1, PC3 6000::2.', 'Tunnel: R2 tunnel0 2000::1/64 (source 192.168.10.1, destination 192.168.20.1, mode ipv6ip); R4 tunnel0 2000::2/64 (mirror).', 'RIPng on R1, R2, R4, R5 for their /64 networks incl. the tunnel. Ping every PC from every PC (IPv4 group and IPv6 group).'],
    hints: ['The tunnel outer header is IPv4 (protocol 41); the inner packet is IPv6.', 'The tunnel endpoints must be reachable over IPv4 first - that is what OSPF is for.'],
    devices: [pc('PC7', 90, 40), pc('PC6', 90, 130), sw('SW4', 250, 90), pc('PC5', 780, 40), pc('PC4', 780, 130), sw('SW3', 620, 90), rt('R3', 430, 230, c(['f0/0', 'f0/1', 'e1/0', 'e1/1', 'e1/2', 'e1/3'])), rt('R6', 120, 250, c(['f0/0'])), rt('R7', 800, 250, c(['f0/0'])), rt('R2', 250, 340, c(['f0/0', 'f0/1'])), rt('R4', 620, 340, c(['f0/0', 'f0/1'])), rt('R1', 250, 440, c(['f0/0', 'f0/1'])), rt('R5', 620, 440, c(['f0/0', 'f0/1'])), sw('SW1', 250, 535), sw('SW2', 620, 535), pc('PC0', 120, 560), pc('PC1', 380, 560), pc('PC2', 490, 560), pc('PC3', 760, 560)],
    links: [['PC7', 'eth0', 'SW4', 'e0'], ['PC6', 'eth0', 'SW4', 'e1'], ['SW4', 'e2', 'R3', 'e1/1'], ['PC5', 'eth0', 'SW3', 'e0'], ['PC4', 'eth0', 'SW3', 'e1'], ['SW3', 'e2', 'R3', 'e1/0'], ['R3', 'e1/2', 'R6', 'f0/0'], ['R3', 'e1/3', 'R7', 'f0/0'], ['R3', 'f0/1', 'R2', 'f0/1'], ['R3', 'f0/0', 'R4', 'f0/0'], ['R2', 'f0/0', 'R1', 'f0/0'], ['R4', 'f0/1', 'R5', 'f0/1'], ['R1', 'f0/1', 'SW1', 'e0'], ['R5', 'f0/0', 'SW2', 'e0'], ['PC0', 'eth0', 'SW1', 'e1'], ['PC1', 'eth0', 'SW1', 'e2'], ['PC2', 'eth0', 'SW2', 'e1'], ['PC3', 'eth0', 'SW2', 'e2']],
    solution: {
      R3: { ifaces: { 'f0/1': '192.168.10.2/24', 'f0/0': '192.168.20.2/24', 'e1/0': '172.23.10.254/24', 'e1/1': '172.23.20.254/24', 'e1/2': '172.23.30.3/24', 'e1/3': '172.23.0.3/24' }, ospf: { networks: ['192.168.10.0/24', '192.168.20.0/24', '172.23.10.0/24', '172.23.20.0/24', '172.23.30.0/24', '172.23.0.0/24'] } },
      R2: { ifaces: { 'f0/1': '192.168.10.1/24', 'f0/0': '1000::2/64' }, ospf: { networks: ['192.168.10.0/24'] }, tunnels: [{ name: 'tun0', mode: '6in4', local: '192.168.10.1', remote: '192.168.20.1', ip6: '2000::1/64' }], rip: { networks: ['1000::/64', '2000::/64'] } },
      R4: { ifaces: { 'f0/0': '192.168.20.1/24', 'f0/1': '3000::2/64' }, ospf: { networks: ['192.168.20.0/24'] }, tunnels: [{ name: 'tun0', mode: '6in4', local: '192.168.20.1', remote: '192.168.10.1', ip6: '2000::2/64' }], rip: { networks: ['2000::/64', '3000::/64'] } },
      R1: { ifaces: { 'f0/0': '1000::1/64', 'f0/1': '5000::10/64' }, rip: { networks: ['1000::/64', '5000::/64'], passive: ['f0/1'] } },
      R5: { ifaces: { 'f0/1': '3000::1/64', 'f0/0': '6000::10/64' }, rip: { networks: ['3000::/64', '6000::/64'], passive: ['f0/0'] } },
      R6: { ifaces: { 'f0/0': '172.23.30.6/24' }, ospf: { networks: ['172.23.30.0/24'] } }, R7: { ifaces: { 'f0/0': '172.23.0.7/24' }, ospf: { networks: ['172.23.0.0/24'] } },
      PC4: { ip: '172.23.10.4/24', gw: '172.23.10.254' }, PC5: { ip: '172.23.10.5/24', gw: '172.23.10.254' }, PC6: { ip: '172.23.20.6/24', gw: '172.23.20.254' }, PC7: { ip: '172.23.20.7/24', gw: '172.23.20.254' },
      PC0: { ip6: '5000::1/64', gw6: '5000::10' }, PC1: { ip6: '5000::2/64', gw6: '5000::10' }, PC2: { ip6: '6000::1/64', gw6: '6000::10' }, PC3: { ip6: '6000::2/64', gw6: '6000::10' }
    },
    checks: [{ t: ['ping', 'PC4', '172.23.20.7'], d: 'IPv4: PC4 -> PC7 through R3' }, { t: ['ping', 'R2', '192.168.20.1'], d: 'R2 reaches R4 over the OSPF core (tunnel underlay)' }, { t: ['ping', 'PC0', '5000::2'], d: 'IPv6: PC0 -> PC1 (same island)' }, { t: ['ping', 'PC0', '2000::2'], d: 'IPv6: PC0 -> R4 tunnel end' }, { t: ['ping', 'PC0', '6000::2'], d: 'IPv6: PC0 -> PC3 across the 6in4 tunnel' }, { t: ['ping', 'PC3', '5000::1'], d: 'IPv6: PC3 -> PC0 (return path)' }, { t: ['ping', 'PC4', '172.23.0.7'], d: 'IPv4: PC4 -> R7' }], settle: 120000
  });

  /* ---------- Extras: Wi-Fi and demos ---------- */
  NL.addLab({
    id: 'wifi1', group: 'Extra Labs', level: 'Beginner', title: 'Wi-Fi - Access point, SSID and DHCP',
    objective: 'Join laptops and a phone to a wireless network: SSID, WPA2 password, DHCP and routing to a wired server.',
    steps: ['The AP (SSID "ClassWiFi", password "learn1234") is wired to Router R1 (10.0.0.1/24 with DHCP). Check the AP settings in its Config tab.', 'Select Laptop1 > Config > Wi-Fi: SSID ClassWiFi, password learn1234, and set the wlan0 interface to DHCP.', 'Do the same for Laptop2 and the Phone; try a WRONG password on one and read the status ("authentication failed").', 'Ping the Server (10.0.1.10) from each wireless device. Watch the dashed Wi-Fi association lines on the canvas.', 'Change the AP password: devices with the old one are dropped.'],
    hints: ['Real Wi-Fi shares one radio channel (half-duplex); the simulator models each client as its own 54 Mbps / 2 ms link (simplified).'],
    devices: [pc('Laptop1', 120, 90, { wifi: true }), pc('Laptop2', 120, 400, { wifi: true }), pc('Phone', 320, 450, { wifi: true }), ap('AP1', 300, 250), rt('R1', 520, 250, { ports: ['ether1', 'ether2'] }), srv('Server', 760, 250)],
    links: [['AP1', 'eth0', 'R1', 'ether1'], ['R1', 'ether2', 'Server', 'eth0']],
    start: { AP1: { ap: { ssid: 'ClassWiFi', security: 'wpa2', password: 'learn1234' } }, R1: { ifaces: { ether1: '10.0.0.1/24', ether2: '10.0.1.1/24' }, dhcpServer: [{ name: 'wifi', network: '10.0.0.0/24', from: '10.0.0.10', to: '10.0.0.200', gateway: '10.0.0.1', dns: ['8.8.8.8'] }], rip: { networks: ['10.0.0.0/24', '10.0.1.0/24'] } }, Server: { ip: '10.0.1.10/24', gw: '10.0.1.1' } },
    solution: { Laptop1: { wifi: { ssid: 'ClassWiFi', password: 'learn1234' }, wifiDhcp: true }, Laptop2: { wifi: { ssid: 'ClassWiFi', password: 'learn1234' }, wifiDhcp: true }, Phone: { wifi: { ssid: 'ClassWiFi', password: 'learn1234' }, wifiDhcp: true } },
    checks: [{ t: ['hasip', 'Laptop1', 'wlan0'], d: 'Laptop1 joined and got an address' }, { t: ['hasip', 'Phone', 'wlan0'], d: 'Phone joined and got an address' }, { t: ['ping', 'Laptop1', '10.0.1.10'], d: 'Laptop1 reaches the wired server' }, { t: ['ping', 'Laptop2', 'Phone'.length ? '10.0.0.1' : ''], d: 'Laptop2 reaches the router' }], settle: 20000
  });
  NL.addLab({
    id: 'demo1', group: 'Extra Labs', level: 'Beginner', title: 'Demo - Two PCs and a switch (ARP + MAC learning)',
    objective: 'See ARP, flooding and MAC learning on a single LAN.',
    steps: ['PC1 10.0.0.1 and PC2 10.0.0.2 are preconfigured. Turn on animation and press Send ping.', 'Watch: ARP request (broadcast, flooded) -> ARP reply (unicast) -> ICMP echo -> echo reply.', 'Select SW1 and open Tables: the MAC table now holds both PCs.'],
    hints: ['Second ping is faster: ARP and the MAC table are already learned.'],
    devices: [pc('PC1', 200, 220), sw('SW1', 450, 220), pc('PC2', 700, 220)], links: [['PC1', 'eth0', 'SW1', 'e0'], ['SW1', 'e1', 'PC2', 'eth0']],
    start: { PC1: { ip: '10.0.0.1/24' }, PC2: { ip: '10.0.0.2/24' } }, solution: {}, checks: [{ t: ['ping', 'PC1', '10.0.0.2'], d: 'PC1 pings PC2' }]
  });
})(window.NL = window.NL || {});
