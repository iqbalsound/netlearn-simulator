/* labs-services.js - Lab manual Labs 06-09: DHCP, VLANs, DHCP relay + firewall, NAT/Internet. */
(function (NL) {
  const { pc, srv, sw, rt, cloud } = NL.mk;
  const pool = (name, net, gw) => ({ name, network: net, from: net.replace(/\.0\/24$/, '.1'), to: net.replace(/\.0\/24$/, '.253'), gateway: gw, dns: ['8.8.8.8', '8.8.4.4'], lease: '24h' });

  NL.addLab({
    id: 'lab06', group: 'Manual Labs', level: 'Intermediate', title: 'Lab 06 - DHCP server on two routers',
    objective: 'Router1 and Router2 each serve DHCP to their own LAN while RIP connects the networks.',
    steps: ['Plan: Net01 10.0.1.0/24 (Router1 ether1 .254), Net02 10.0.2.0/24 (Router2 ether1 .254), Net03 10.0.3.0/30 (Router1 .1, Router2 .2).', 'Configure interface addresses, then RIP on ether2 (backbone) and passive on ether1.', 'On each router create a pool (.1-.253), a DHCP server on ether1 and network info (gateway .254, DNS 8.8.8.8).', 'Set all PCs and TinyCore-1 to DHCP. In the terminal: ip dhcp, show ip. On the router: ip dhcp-server lease print.', 'Ping PC1 -> PC4 and PC1 -> TinyCore-1.'],
    hints: ['Turn on "Control packets" in the toolbar to watch Discover/Offer/Request/Ack frames.', 'The DHCP pool must not contain the router address (.254).'],
    devices: [pc('PC1', 90, 80), pc('PC2', 60, 250), pc('PC3', 130, 420), sw('Switch1', 250, 250), rt('Router1', 410, 250), rt('Router2', 600, 250), sw('Switch2', 760, 250), pc('TinyCore-1', 760, 70), pc('PC4', 760, 430), pc('PC5', 920, 250)],
    links: [['PC1', 'eth0', 'Switch1', 'e1'], ['PC2', 'eth0', 'Switch1', 'e0'], ['PC3', 'eth0', 'Switch1', 'e3'], ['Switch1', 'e2', 'Router1', 'ether1'], ['Router1', 'ether2', 'Router2', 'ether2'], ['Router2', 'ether1', 'Switch2', 'e1'], ['TinyCore-1', 'eth0', 'Switch2', 'e3'], ['PC4', 'eth0', 'Switch2', 'e2'], ['PC5', 'eth0', 'Switch2', 'e0']],
    solution: {
      Router1: { ifaces: { ether1: '10.0.1.254/24', ether2: '10.0.3.1/30' }, rip: { networks: ['10.0.1.0/24', '10.0.3.0/30'], passive: ['ether1'] }, dhcpServer: [pool('Dev1', '10.0.1.0/24', '10.0.1.254')] },
      Router2: { ifaces: { ether1: '10.0.2.254/24', ether2: '10.0.3.2/30' }, rip: { networks: ['10.0.2.0/24', '10.0.3.0/30'], passive: ['ether1'] }, dhcpServer: [pool('Dev2', '10.0.2.0/24', '10.0.2.254')] },
      PC1: { dhcp: true }, PC2: { dhcp: true }, PC3: { dhcp: true }, PC4: { dhcp: true }, PC5: { dhcp: true }, 'TinyCore-1': { dhcp: true }
    },
    checks: [{ t: ['hasip', 'PC1', 'eth0'], d: 'PC1 obtained an address' }, { t: ['hasip', 'PC4', 'eth0'], d: 'PC4 obtained an address' }, { t: ['lease', 'Router1', 3], d: 'Router1 holds 3 leases' }, { t: ['ping', 'PC1', '10.0.2.1'], d: 'PC1 reaches Net02' }, { t: ['ping', 'PC4', '10.0.1.1'], d: 'PC4 reaches Net01' }], settle: 60000
  });

  const v7 = { eth: 'ether1' };
  NL.addLab({
    id: 'lab07', group: 'Manual Labs', level: 'Intermediate', title: 'Lab 07 - VLANs, 802.1Q trunks and inter-VLAN routing',
    objective: 'Put PCs into VLAN 10 and VLAN 20 across two switches, trunk to Router1 (router-on-a-stick) and serve DHCP per VLAN.',
    steps: ['VLAN 10 = PC1, PC2, PC5. VLAN 20 = PC3, PC4, PC6, PC7, TinyCore-1. PC8 stays in the default VLAN behind Switch3.', 'Select Switch1 and Switch2: set each host port to Access with the right VLAN; set the inter-switch ports and the port to Router1 to Trunk (802.1Q).', 'Router1: add VLAN interfaces vlan10 and vlan20 on ether1 (172.20.10.254/24 and 172.20.20.254/24) and ether2 172.20.1.254/24.', 'Add DHCP servers on vlan10, vlan20 and ether2. Set all hosts to DHCP.', 'Ping across VLANs (routed). Then ping an unused address from TinyCore-1 and look where the ARP broadcasts go (turn on frame labels / capture): only VLAN 20 ports see them.'],
    hints: ['A trunk carries many VLANs with 802.1Q tags; an access port carries one VLAN untagged.', 'The router sees each VLAN as its own interface: interface vlan add name=vlan10 vlan-id=10 interface=ether1.'],
    devices: [pc('PC1', 80, 120), pc('PC2', 80, 230), sw('Switch1', 260, 200), rt('Router1', 460, 80), sw('Switch2', 460, 300), pc('PC3', 260, 420), pc('PC4', 380, 460), pc('PC5', 500, 470), pc('PC6', 620, 460), pc('PC7', 740, 420), pc('TinyCore-1', 640, 330), sw('Switch3', 760, 80), pc('PC8', 860, 180)],
    links: [['PC1', 'eth0', 'Switch1', 'e2'], ['PC2', 'eth0', 'Switch1', 'e3'], ['Switch1', 'e6', 'Router1', 'ether1'], ['Switch1', 'e7', 'Switch2', 'e7'], ['PC3', 'eth0', 'Switch2', 'e0'], ['PC4', 'eth0', 'Switch2', 'e1'], ['PC5', 'eth0', 'Switch2', 'e2'], ['PC6', 'eth0', 'Switch2', 'e3'], ['PC7', 'eth0', 'Switch2', 'e4'], ['TinyCore-1', 'eth0', 'Switch2', 'e5'], ['Router1', 'ether2', 'Switch3', 'e0'], ['Switch3', 'e1', 'PC8', 'eth0']],
    start: { PC1: { dhcp: true }, PC2: { dhcp: true }, PC3: { dhcp: true }, PC4: { dhcp: true }, PC5: { dhcp: true }, PC6: { dhcp: true }, PC7: { dhcp: true }, PC8: { dhcp: true }, 'TinyCore-1': { dhcp: true } },
    solution: {
      Switch1: { ports: { e2: { mode: 'access', vlan: 10 }, e3: { mode: 'access', vlan: 10 }, e6: { mode: 'trunk' }, e7: { mode: 'trunk' } } },
      Switch2: { ports: { e0: { mode: 'access', vlan: 20 }, e1: { mode: 'access', vlan: 20 }, e2: { mode: 'access', vlan: 10 }, e3: { mode: 'access', vlan: 20 }, e4: { mode: 'access', vlan: 20 }, e5: { mode: 'access', vlan: 20 }, e7: { mode: 'trunk' } } },
      Router1: { vlanIfs: [['vlan10', 10, 'ether1', '172.20.10.254/24'], ['vlan20', 20, 'ether1', '172.20.20.254/24']], ifaces: { ether2: '172.20.1.254/24' },
        dhcpServer: [pool('v10', '172.20.10.0/24', '172.20.10.254'), pool('v20', '172.20.20.0/24', '172.20.20.254'), pool('def', '172.20.1.0/24', '172.20.1.254')] }
    },
    checks: [{ t: ['vlan', 'Switch1', 'e2', { mode: 'access', vlan: 10 }], d: 'Switch1 e2 (PC1) is access VLAN 10' }, { t: ['vlan', 'Switch2', 'e0', { mode: 'access', vlan: 20 }], d: 'Switch2 e0 (PC3) is access VLAN 20' }, { t: ['vlan', 'Switch1', 'e7', { mode: 'trunk' }], d: 'Switch1-Switch2 link is a trunk' },
      { t: ['hasip', 'PC1', 'eth0'], d: 'PC1 (VLAN 10) got a VLAN-10 address' }, { t: ['hasip', 'TinyCore-1', 'eth0'], d: 'TinyCore-1 (VLAN 20) got an address' }, { t: ['hasip', 'PC8', 'eth0'], d: 'PC8 (default VLAN) got an address' },
      { t: ['ping', 'TinyCore-1', '172.20.10.254'], d: 'TinyCore-1 reaches its VLAN gateway interface' }, { t: ['ping', 'PC8', '172.20.20.254'], d: 'PC8 reaches the VLAN 20 router interface' }], settle: 40000
  });

  NL.addLab({
    id: 'lab08', group: 'Manual Labs', level: 'Advanced', title: 'Lab 08 - DHCP relay and a stateful firewall',
    objective: 'Serve Network05 from a DHCP server in Network02 through a relay, then lock Router1 down with forward-chain rules (order matters!).',
    steps: ['Addresses: Network01 10.0.20.0/24 (Webserver .1), Network02 10.0.30.0/24 (DHCPServer .1), Network03 192.168.0.0/30, Network04 172.16.0.0/24, Network05 10.0.40.0/24; routers use .254 on LANs.', 'RIP between Router1/2 (client LANs passive). TinyCoreA-1 172.16.0.1 and PC1 172.16.0.2 static; TinyCoreB-1 and PC2 DHCP.', 'Router2: DHCP relay on ether1 -> 10.0.30.1. DHCPServer-1: pool for 10.0.40.0/24 and default route via 10.0.30.254.', 'Test before the firewall: TinyCoreA-1 pings the web server, opens http://10.0.20.1.', 'Router1 firewall (forward chain): 1) allow tcp/80 new from 172.16.0.0/24 to 10.0.20.1, 2) DHCP relay rules (udp/67), 3) accept established,related, 4) drop everything else. Rule ORDER decides - drag the DHCP rules above the drop!', 'After the firewall: web works, http://10.0.30.1 fails, PC2 still gets DHCP.'],
    hints: ['If you add the DHCP rules after the default deny they never match: "ip firewall filter move".', 'Rules in the Config tab show hit counters - watch which rule matches.'],
    devices: [srv('RockyWebserver-1', 150, 70), sw('Switch1', 320, 70), rt('Router01', 500, 160), sw('Switch3', 680, 70), srv('DHCPServer-1', 840, 70), pc('TinyCoreA-1', 100, 300), pc('PC1', 100, 420), sw('Switch2', 280, 340), rt('Router02', 700, 300), sw('Switch4', 860, 340), pc('TinyCoreB-1', 880, 220), pc('PC2', 880, 460)],
    links: [['RockyWebserver-1', 'eth0', 'Switch1', 'e0'], ['Switch1', 'e1', 'Router01', 'ether1'], ['Router01', 'ether3', 'Switch3', 'e0'], ['Switch3', 'e1', 'DHCPServer-1', 'eth0'], ['Router01', 'ether2', 'Switch2', 'e2'], ['TinyCoreA-1', 'eth0', 'Switch2', 'e1'], ['PC1', 'eth0', 'Switch2', 'e0'], ['Router01', 'ether4', 'Router02', 'ether4'], ['Router02', 'ether1', 'Switch4', 'e1'], ['TinyCoreB-1', 'eth0', 'Switch4', 'e3'], ['PC2', 'eth0', 'Switch4', 'e0']],
    start: { 'TinyCoreB-1': { dhcp: true }, PC2: { dhcp: true } },
    solution: {
      Router01: { ifaces: { ether1: '10.0.20.254/24', ether2: '172.16.0.254/24', ether3: '10.0.30.254/24', ether4: '192.168.0.1/30' }, rip: { networks: ['10.0.20.0/24', '10.0.30.0/24', '172.16.0.0/24', '192.168.0.0/30'], passive: ['ether1', 'ether2', 'ether3'] },
        firewall: [{ chain: 'forward', action: 'accept', protocol: 'udp', port: 67, connState: 'new', srcAddress: '192.168.0.0/30', dstAddress: '10.0.30.1', comment: 'Permit DHCP Relay' }, { chain: 'forward', action: 'accept', protocol: 'udp', port: 67, connState: 'new', srcAddress: '10.0.30.1', dstAddress: '10.0.40.0/24', comment: 'Permit DHCP Response' },
          { chain: 'forward', action: 'accept', protocol: 'tcp', port: 80, connState: 'new', srcAddress: '172.16.0.0/24', dstAddress: '10.0.20.1', comment: 'Network 04 to Webserver' }, { chain: 'forward', action: 'accept', connState: 'established,related', comment: 'Accept established connections' }, { chain: 'forward', action: 'drop', comment: 'Default deny' }] },
      Router02: { ifaces: { ether1: '10.0.40.254/24', ether4: '192.168.0.2/30' }, rip: { networks: ['10.0.40.0/24', '192.168.0.0/30'], passive: ['ether1'] }, relay: [{ iface: 'ether1', server: '10.0.30.1' }] },
      'RockyWebserver-1': { ip: '10.0.20.1/24', gw: '10.0.20.254' },
      'DHCPServer-1': { ip: '10.0.30.1/24', gw: '10.0.30.254', dhcpServer: [{ name: 'Net05', network: '10.0.40.0/24', from: '10.0.40.2', to: '10.0.40.253', gateway: '10.0.40.254', dns: ['8.8.8.8'] }] },
      'TinyCoreA-1': { ip: '172.16.0.1/24', gw: '172.16.0.254' }, PC1: { ip: '172.16.0.2/24', gw: '172.16.0.254' }
    },
    checks: [{ t: ['http', 'TinyCoreA-1', 'http://10.0.20.1'], d: 'TinyCoreA-1 can load the web server (rule 1 + established)' }, { t: ['nohttp', 'TinyCoreA-1', 'http://10.0.30.1'], d: 'DHCPServer web access is blocked (default deny)' }, { t: ['noping', 'TinyCoreA-1', '10.0.20.1'], d: 'Ping to the web server is blocked (only HTTP allowed)' }, { t: ['hasip', 'PC2', 'eth0'], d: 'PC2 got an address through the relay' }, { t: ['hasip', 'TinyCoreB-1', 'eth0'], d: 'TinyCoreB-1 got an address through the relay' }], settle: 90000
  });

  NL.addLab({
    id: 'lab09', group: 'Manual Labs', level: 'Intermediate', title: 'Lab 09 - NAT / masquerade and Internet access',
    objective: 'Give every LAN Internet access by running RIP default-route distribution and masquerade (PAT) on Router1; browse by name using DNS.',
    steps: ['Reuse Lab 06 addressing and DHCP (Router1 Net01 10.0.1.0/24, Router2 Net02 10.0.2.0/24, link 10.0.3.0/30).', 'Router1 ether3 faces the Cloud-NAT: set it to DHCP client (it receives 192.168.122.x and a default route).', 'Router1: RIP "distribute default" so Router2 learns 0.0.0.0/0. Add masquerade out ether3.', 'Set DNS 8.8.8.8 on both routers; set hosts to DHCP.', 'Ping google.com from a PC, Router1 and Router2. Then open the Tables tab on Router1 and read the NAT translation table.'],
    hints: ['Without masquerade the Internet cannot reply to 10.x private addresses.', 'Router2 has no default route until Router1 advertises one through RIP.'],
    devices: [pc('PC1', 70, 100), pc('PC2', 50, 230), pc('PC3', 100, 380), sw('Switch1', 230, 240), rt('Router1', 400, 240), rt('Router2', 620, 240), sw('Switch2', 780, 240), pc('TinyCore-1', 780, 80), pc('PC4', 780, 410), pc('PC5', 930, 240), sw('Switch3', 400, 90), cloud('Cloud-NAT', 560, 70)],
    links: [['PC1', 'eth0', 'Switch1', 'e1'], ['PC2', 'eth0', 'Switch1', 'e0'], ['PC3', 'eth0', 'Switch1', 'e3'], ['Switch1', 'e2', 'Router1', 'ether1'], ['Router1', 'ether2', 'Router2', 'ether2'], ['Router2', 'ether1', 'Switch2', 'e1'], ['TinyCore-1', 'eth0', 'Switch2', 'e3'], ['PC4', 'eth0', 'Switch2', 'e2'], ['PC5', 'eth0', 'Switch2', 'e0'], ['Router1', 'ether3', 'Switch3', 'e1'], ['Switch3', 'e0', 'Cloud-NAT', 'eth0']],
    start: { 'Cloud-NAT': NL.cloudNat, PC1: { dhcp: true }, PC2: { dhcp: true }, PC3: { dhcp: true }, PC4: { dhcp: true }, PC5: { dhcp: true }, 'TinyCore-1': { dhcp: true } },
    solution: {
      Router1: { ifaces: { ether1: '10.0.1.254/24', ether2: '10.0.3.1/30', ether3: 'dhcp' }, rip: { networks: ['10.0.1.0/24', '10.0.3.0/30'], passive: ['ether1'], defaultOriginate: true }, dhcpServer: [pool('Dev1', '10.0.1.0/24', '10.0.1.254')], nat: ['ether3'], dns: ['8.8.8.8', '8.8.4.4'] },
      Router2: { ifaces: { ether1: '10.0.2.254/24', ether2: '10.0.3.2/30' }, rip: { networks: ['10.0.2.0/24', '10.0.3.0/30'], passive: ['ether1'] }, dhcpServer: [pool('Dev2', '10.0.2.0/24', '10.0.2.254')], dns: ['8.8.8.8', '8.8.4.4'] }
    },
    checks: [{ t: ['hasip', 'Router1', 'ether3'], d: 'Router1 got an address from the Cloud-NAT by DHCP' }, { t: ['ping', 'Router1', 'google.com'], d: 'Router1 pings google.com' }, { t: ['ping', 'Router2', 'google.com'], d: 'Router2 pings google.com (default route via RIP)' }, { t: ['ping', 'PC1', 'google.com'], d: 'PC1 pings google.com (NAT + DNS)' }, { t: ['ping', 'PC4', 'google.com'], d: 'PC4 pings google.com through two routers' }], settle: 90000
  });
})(window.NL = window.NL || {});
