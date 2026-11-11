/* labs-basics.js - Lab manual Labs 01-05: routers, IPv4/VLSM, static routes, RIP, custom subnets. */
(function (NL) {
  const { pc, srv, sw, rt, cloud } = NL.mk;
  const cisco = n => ({ ports: n });
  NL.addLab({
    id: 'lab01', group: 'Manual Labs', level: 'Beginner', title: 'Lab 01 - Introduction to Routers and IOS',
    objective: 'Meet a Cisco-style router, set an IP address on an interface, enable RIP and test with ping.',
    steps: ['Select R1 (Router) and open the Config tab. Rename the hostname to R1.', 'Give interface Fa0/0 the address 10.0.0.1/24 and make sure it is "up" (Cisco: ip address 10.0.0.1 255.255.255.0 + no shutdown).', 'Enable RIP version 2 with network 10.0.0.0 (Cisco: router rip / version 2 / no auto-summary / network 10.0.0.0).', 'Open the Terminal tab and run: ping 10.0.0.1 - expect 5/5 success like the manual (!!!!!).', 'From PC1 ping the router. Then run show ip route on the router.'],
    hints: ['The PC is already configured as 10.0.0.2/24 with gateway 10.0.0.1.', 'A port is only usable when the cable is connected AND the interface is up.'],
    devices: [pc('PC1', 160, 220), rt('R1', 420, 220, cisco(['Fa0/0', 'Fa0/1', 'Fa0/2']))], links: [['PC1', 'eth0', 'R1', 'Fa0/0']],
    start: { PC1: { ip: '10.0.0.2/24', gw: '10.0.0.1' } },
    solution: { R1: { ifaces: { 'Fa0/0': '10.0.0.1/24' }, rip: { networks: ['10.0.0.0/24'] } } },
    checks: [{ t: ['hasip', 'R1', 'Fa0/0'], d: 'R1 Fa0/0 has an IP address' }, { t: ['ping', 'R1', '10.0.0.1'], d: 'R1 pings its own Fa0/0' }, { t: ['ping', 'PC1', '10.0.0.1'], d: 'PC1 pings R1' }]
  });
  NL.addLab({
    id: 'lab02a', group: 'Manual Labs', level: 'Beginner', title: 'Lab 02A - Static IPs on a router-to-router link',
    objective: 'Address a point-to-point (serial-style) link between two routers using a /30 and verify with ping.',
    steps: ['Choose 10.10.10.0/30. Give R1 Fa0/0 = 10.10.10.1 and R2 Fa0/0 = 10.10.10.2.', 'Bring both interfaces up.', 'Ping R2 from R1 and R1 from R2. Why is a /30 perfect for this link? (2 usable hosts)'],
    hints: ['In the real lab this is a serial cable; here the link is an Ethernet cable (simplified).'],
    devices: [rt('R1', 220, 220, cisco(['Fa0/0', 'Fa0/1'])), rt('R2', 600, 220, cisco(['Fa0/0', 'Fa0/1']))], links: [['R1', 'Fa0/0', 'R2', 'Fa0/0', { bandwidth: 2, latency: 20 }]],
    solution: { R1: { ifaces: { 'Fa0/0': '10.10.10.1/30' } }, R2: { ifaces: { 'Fa0/0': '10.10.10.2/30' } } },
    checks: [{ t: ['ping', 'R1', '10.10.10.2'], d: 'R1 pings R2' }, { t: ['ping', 'R2', '10.10.10.1'], d: 'R2 pings R1' }]
  });
  NL.addLab({
    id: 'lab02b', group: 'Manual Labs', level: 'Beginner', title: 'Lab 02B - DHCP on a router',
    objective: 'Configure Router_1 as a DHCP server for two LANs (10.0.1.0/24 and 10.0.2.0/24) and let both workstations get addresses.',
    steps: ['Router_1 Fa0/0 = 10.0.1.1/24, Fa0/1 = 10.0.2.1/24 (interfaces up).', 'Create two DHCP pools: 10.0.1.0/24 gateway 10.0.1.1 and 10.0.2.0/24 gateway 10.0.2.1 (Config > DHCP server).', 'Set both workstations to "DHCP" on eth0.', 'Ping Workstation_2 from Workstation_1 and back.'],
    hints: ['Router config: ip dhcp pool / network / default-router in Cisco; ip dhcp-server in MikroTik.', 'Watch the DORA packets (Discover, Offer, Request, Ack) with the Control packets toggle on.'],
    devices: [pc('Workstation_1', 100, 200), sw('Switch_1', 290, 200), rt('Router_1', 450, 200, cisco(['Fa0/0', 'Fa0/1'])), sw('Switch_2', 610, 200), pc('Workstation_2', 800, 200)],
    links: [['Workstation_1', 'eth0', 'Switch_1', 'e0'], ['Switch_1', 'e1', 'Router_1', 'Fa0/0'], ['Router_1', 'Fa0/1', 'Switch_2', 'e1'], ['Switch_2', 'e0', 'Workstation_2', 'eth0']],
    solution: { Router_1: { ifaces: { 'Fa0/0': '10.0.1.1/24', 'Fa0/1': '10.0.2.1/24' }, dhcpServer: [{ name: 'LAN1', network: '10.0.1.0/24', gateway: '10.0.1.1' }, { name: 'LAN2', network: '10.0.2.0/24', gateway: '10.0.2.1' }], rip: { networks: ['10.0.1.0/24', '10.0.2.0/24'] } }, Workstation_1: { dhcp: true }, Workstation_2: { dhcp: true } },
    checks: [{ t: ['hasip', 'Workstation_1', 'eth0'], d: 'Workstation_1 got an address by DHCP' }, { t: ['hasip', 'Workstation_2', 'eth0'], d: 'Workstation_2 got an address by DHCP' }, { t: ['ping', 'Workstation_1', '10.0.2.2'], d: 'Workstation_1 pings Workstation_2' }], settle: 20000
  });
  NL.addLab({
    id: 'lab02c', group: 'Manual Labs', level: 'Intermediate', title: 'Lab 02C - VLSM addressing scheme',
    objective: 'From 172.28.10.0/24 carve subnets for LANs of 60, 28, 12 and 12 hosts plus three router-to-router links - no wasted /24s.',
    steps: ['Sort needs: 60 hosts -> /26, 28 -> /27, 12 -> /28, 12 -> /28, links -> /30 each. Use the Subnet calculator (toolbar).', 'Router_2 LAN 172.28.10.0/26, Router_1 LAN 172.28.10.64/27, Router_3 LAN 172.28.10.96/28, Router_4 LAN 172.28.10.112/28.', 'Links: R1-R2 172.28.10.128/30, R1-R3 172.28.10.132/30, R1-R4 172.28.10.136/30.', 'Address every router interface (use the first usable address) and each PC; enable RIP on all routers.', 'Verify PC1 can ping PC4.'],
    hints: ['First usable host in 172.28.10.64/27 is .65.', 'Each router must advertise its networks in RIP (Config > Routing > RIP).'],
    devices: [rt('Router_1', 430, 120, cisco(['Fa0/0', 'Fa0/1', 'Fa0/2', 'Fa0/3'])), rt('Router_2', 160, 300, cisco(['Fa0/0', 'Fa0/1'])), rt('Router_3', 430, 330, cisco(['Fa0/0', 'Fa0/1'])), rt('Router_4', 700, 300, cisco(['Fa0/0', 'Fa0/1'])), pc('PC1', 560, 60), pc('PC2', 60, 420), pc('PC3', 430, 450), pc('PC4', 800, 420)],
    links: [['Router_1', 'Fa0/0', 'Router_2', 'Fa0/0'], ['Router_1', 'Fa0/1', 'Router_3', 'Fa0/0'], ['Router_1', 'Fa0/2', 'Router_4', 'Fa0/0'], ['Router_1', 'Fa0/3', 'PC1', 'eth0'], ['Router_2', 'Fa0/1', 'PC2', 'eth0'], ['Router_3', 'Fa0/1', 'PC3', 'eth0'], ['Router_4', 'Fa0/1', 'PC4', 'eth0']],
    solution: {
      Router_1: { ifaces: { 'Fa0/0': '172.28.10.129/30', 'Fa0/1': '172.28.10.133/30', 'Fa0/2': '172.28.10.137/30', 'Fa0/3': '172.28.10.65/27' }, rip: { networks: ['172.28.10.128/30', '172.28.10.132/30', '172.28.10.136/30', '172.28.10.64/27'], passive: ['Fa0/3'] } },
      Router_2: { ifaces: { 'Fa0/0': '172.28.10.130/30', 'Fa0/1': '172.28.10.1/26' }, rip: { networks: ['172.28.10.128/30', '172.28.10.0/26'], passive: ['Fa0/1'] } },
      Router_3: { ifaces: { 'Fa0/0': '172.28.10.134/30', 'Fa0/1': '172.28.10.97/28' }, rip: { networks: ['172.28.10.132/30', '172.28.10.96/28'], passive: ['Fa0/1'] } },
      Router_4: { ifaces: { 'Fa0/0': '172.28.10.138/30', 'Fa0/1': '172.28.10.113/28' }, rip: { networks: ['172.28.10.136/30', '172.28.10.112/28'], passive: ['Fa0/1'] } },
      PC1: { ip: '172.28.10.66/27', gw: '172.28.10.65' }, PC2: { ip: '172.28.10.2/26', gw: '172.28.10.1' }, PC3: { ip: '172.28.10.98/28', gw: '172.28.10.97' }, PC4: { ip: '172.28.10.114/28', gw: '172.28.10.113' }
    },
    checks: [{ t: ['ping', 'PC1', '172.28.10.114'], d: 'PC1 pings PC4' }, { t: ['ping', 'PC2', '172.28.10.98'], d: 'PC2 pings PC3' }, { t: ['route', 'Router_2', '172.28.10.112'], d: 'Router_2 learned the Router_4 LAN' }]
  });

  const lan = (n, x, y) => [pc('PC' + n, x, y)];
  NL.addLab({
    id: 'lab03', group: 'Manual Labs', level: 'Beginner', title: 'Lab 03 - Static routes (South and North routers)',
    objective: 'Configure subnets and static routes so every PC can reach every subnet across two routers.',
    steps: ['South: ether1 172.16.10.254/24, ether2 172.16.20.254/24, ether3 192.168.0.254/24. North: ether1 192.168.0.253/24, ether2 10.11.12.254/24, ether3 10.11.13.254/24.', 'Set PC addresses: PC1 172.16.10.1, PC2 172.16.20.1, PC3 10.11.12.1, PC4 10.11.13.1 (all /24) with the router as gateway.', 'Test same-subnet pings first. Then ping from PC1 to 192.168.0.253: it must FAIL. Why? (North has no return route.)', 'South: add routes 10.11.12.0/24 and 10.11.13.0/24 via 192.168.0.253. North: add 172.16.10.0/24 and 172.16.20.0/24 via 192.168.0.254.', 'Re-test PC1 -> PC3 and PC1 -> PC4. Use traceroute to list the hops.'],
    hints: ['MikroTik: ip route add dst-address=10.11.12.0/24 gateway=192.168.0.253', 'The next hop must be on a directly connected subnet.'],
    devices: [pc('PC1', 70, 170), sw('Switch1', 190, 170), rt('South', 340, 170), rt('North', 560, 170), sw('Switch4', 720, 170), pc('PC4', 850, 170), sw('Switch2', 340, 320), pc('PC2', 340, 440), sw('Switch3', 560, 320), pc('PC3', 560, 440)],
    links: [['PC1', 'eth0', 'Switch1', 'e0'], ['Switch1', 'e1', 'South', 'ether1'], ['South', 'ether2', 'Switch2', 'e0'], ['Switch2', 'e1', 'PC2', 'eth0'], ['South', 'ether3', 'North', 'ether1'], ['North', 'ether2', 'Switch3', 'e0'], ['Switch3', 'e1', 'PC3', 'eth0'], ['North', 'ether3', 'Switch4', 'e0'], ['Switch4', 'e1', 'PC4', 'eth0']],
    solution: {
      South: { ifaces: { ether1: '172.16.10.254/24', ether2: '172.16.20.254/24', ether3: '192.168.0.254/24' }, routes: [['10.11.12.0/24', '192.168.0.253'], ['10.11.13.0/24', '192.168.0.253']] },
      North: { ifaces: { ether1: '192.168.0.253/24', ether2: '10.11.12.254/24', ether3: '10.11.13.254/24' }, routes: [['172.16.10.0/24', '192.168.0.254'], ['172.16.20.0/24', '192.168.0.254']] },
      PC1: { ip: '172.16.10.1/24', gw: '172.16.10.254' }, PC2: { ip: '172.16.20.1/24', gw: '172.16.20.254' }, PC3: { ip: '10.11.12.1/24', gw: '10.11.12.254' }, PC4: { ip: '10.11.13.1/24', gw: '10.11.13.254' }
    },
    checks: [{ t: ['ping', 'PC1', '172.16.20.1'], d: 'PC1 -> PC2 (through South)' }, { t: ['ping', 'PC1', '192.168.0.253'], d: 'PC1 -> North ether1' }, { t: ['ping', 'PC1', '10.11.12.1'], d: 'PC1 -> PC3' }, { t: ['ping', 'PC1', '10.11.13.1'], d: 'PC1 -> PC4' }, { t: ['ping', 'PC4', '172.16.10.1'], d: 'PC4 -> PC1 (return path)' }]
  });

  const r4 = (id, lan, own, nets) => ({ ifaces: own, rip: { networks: nets, passive: ['ether1'] } });
  NL.addLab({
    id: 'lab04', group: 'Manual Labs', level: 'Intermediate', title: 'Lab 04 - Dynamic routing with RIP (4 routers)',
    objective: 'Run RIP on four routers with /22 LANs, see learned routes, then break a link and watch the network reconverge.',
    steps: ['Address every interface from the lab text (e.g. router1 ether1 10.20.3.254/22, ether2 192.168.0.1/24, ether3 192.168.1.1/24, ether4 192.168.5.1/24). PCs: 10.20.0.1, 10.30.0.1, 10.40.0.1, 10.50.0.1 (/22). RockyLinuxVM 10.30.0.2/22.', 'Before RIP, ping PC1 -> PC4: it fails with "Destination network unreachable".', 'Enable RIP on each router for its connected networks; make the client-facing ether1 passive; update 15s / timeout 30s.', 'Press "Converge" (toolbar) and run: routing rip route print on router1. Expect routes at metric 2 for neighbours.', 'On RockyLinuxVM run traceroute 10.40.0.1. Then delete the cable between router2 and router3 (Subnet E), Converge again and compare.'],
    hints: ['Networks: A=192.168.0.0/24 (R1-R3), B=.1.0 (R1-R2), C=.2.0 (R2-R4), D=.3.0 (R3-R4), E=.4.0 (R2-R3), F=.5.0 (R1-R4).', 'Hop count is the RIP metric; 16 means unreachable.'],
    devices: [pc('PC1', 70, 130), sw('Switch1', 190, 130), rt('router1', 340, 130), rt('router3', 700, 130), sw('Switch3', 840, 130), pc('PC3', 920, 130), pc('PC2', 70, 400), sw('Switch2', 190, 400), srv('RockyLinuxVM', 190, 500), rt('router2', 340, 400), rt('router4', 700, 400), sw('Switch4', 840, 400), pc('PC4', 920, 400)],
    links: [['PC1', 'eth0', 'Switch1', 'e0'], ['Switch1', 'e1', 'router1', 'ether1'], ['PC2', 'eth0', 'Switch2', 'e0'], ['RockyLinuxVM', 'eth0', 'Switch2', 'e2'], ['Switch2', 'e1', 'router2', 'ether1'], ['PC3', 'eth0', 'Switch3', 'e0'], ['Switch3', 'e1', 'router3', 'ether1'], ['PC4', 'eth0', 'Switch4', 'e0'], ['Switch4', 'e1', 'router4', 'ether1'],
      ['router1', 'ether2', 'router3', 'ether2'], ['router1', 'ether3', 'router2', 'ether3'], ['router1', 'ether4', 'router4', 'ether4'], ['router2', 'ether2', 'router4', 'ether2'], ['router3', 'ether3', 'router4', 'ether3'], ['router2', 'ether4', 'router3', 'ether4']],
    solution: {
      router1: { ifaces: { ether1: '10.20.3.254/22', ether2: '192.168.0.1/24', ether3: '192.168.1.1/24', ether4: '192.168.5.1/24' }, rip: { networks: ['10.20.0.0/22', '192.168.0.0/24', '192.168.1.0/24', '192.168.5.0/24'], passive: ['ether1'] } },
      router2: { ifaces: { ether1: '10.30.3.254/22', ether2: '192.168.2.1/24', ether3: '192.168.1.2/24', ether4: '192.168.4.1/24' }, rip: { networks: ['10.30.0.0/22', '192.168.2.0/24', '192.168.1.0/24', '192.168.4.0/24'], passive: ['ether1'] } },
      router3: { ifaces: { ether1: '10.40.3.254/22', ether2: '192.168.0.2/24', ether3: '192.168.3.1/24', ether4: '192.168.4.2/24' }, rip: { networks: ['10.40.0.0/22', '192.168.0.0/24', '192.168.3.0/24', '192.168.4.0/24'], passive: ['ether1'] } },
      router4: { ifaces: { ether1: '10.50.3.254/22', ether2: '192.168.2.2/24', ether3: '192.168.3.2/24', ether4: '192.168.5.2/24' }, rip: { networks: ['10.50.0.0/22', '192.168.2.0/24', '192.168.3.0/24', '192.168.5.0/24'], passive: ['ether1'] } },
      PC1: { ip: '10.20.0.1/22', gw: '10.20.3.254' }, PC2: { ip: '10.30.0.1/22', gw: '10.30.3.254' }, PC3: { ip: '10.40.0.1/22', gw: '10.40.3.254' }, PC4: { ip: '10.50.0.1/22', gw: '10.50.3.254' }, RockyLinuxVM: { ip: '10.30.0.2/22', gw: '10.30.3.254' }
    },
    checks: [{ t: ['ping', 'PC1', '10.50.0.1'], d: 'PC1 -> PC4' }, { t: ['ping', 'PC1', '10.30.0.1'], d: 'PC1 -> PC2' }, { t: ['ping', 'PC3', '10.30.0.1'], d: 'PC3 -> PC2' }, { t: ['route', 'router1', '10.30.0.1', 'R'], d: 'router1 learned PC2 LAN via RIP' }, { t: ['ping', 'RockyLinuxVM', '10.40.0.1'], d: 'RockyLinuxVM -> PC3' }]
  });

  NL.addLab({
    id: 'lab05', group: 'Manual Labs', level: 'Intermediate', title: 'Lab 05 - Create custom subnets',
    objective: 'Design your own addressing: Net01 /25, Net02 /25, Net03 /21, Net04 /30, then route between all seven PCs with RIP.',
    steps: ['Use the Subnet calculator to pick private ranges, e.g. Net01 192.168.10.0/25, Net02 192.168.10.128/25, Net03 10.10.0.0/21, Net04 172.16.0.0/30.', 'Gateways = lowest usable address of each subnet. Router01 ether1/Router02 ether1 form Net04.', 'Configure RIP on both routers (client LANs passive) and set PC addresses with gateways.', 'Check PC1 -> PC7 and PC7 -> PC2. Record "routing rip route print" for each router.'],
    hints: ['Net03 /21 has 2046 usable hosts - the switch tree is all one broadcast domain.', 'Router01: ether1=Net04, ether2=Net01. Router02: ether1=Net04, ether2=Net03, ether3=Net02.'],
    devices: [pc('PC1', 120, 70), sw('Switch1', 270, 70), rt('Router01', 480, 90), rt('Router02', 480, 240), pc('PC2', 120, 220), sw('Switch2', 270, 220), sw('Switch3', 480, 340), sw('Switch4', 260, 420), sw('Switch5', 480, 450), sw('Switch6', 700, 420), pc('PC3', 110, 450), pc('PC4', 330, 520), pc('PC5', 560, 520), pc('PC6', 780, 520), pc('PC7', 860, 420)],
    links: [['PC1', 'eth0', 'Switch1', 'e0'], ['Switch1', 'e1', 'Router01', 'ether2'], ['Router01', 'ether1', 'Router02', 'ether1'], ['PC2', 'eth0', 'Switch2', 'e0'], ['Switch2', 'e1', 'Router02', 'ether3'], ['Router02', 'ether2', 'Switch3', 'e0'], ['Switch3', 'e1', 'Switch4', 'e1'], ['Switch3', 'e2', 'Switch5', 'e1'], ['Switch3', 'e3', 'Switch6', 'e1'], ['PC3', 'eth0', 'Switch4', 'e0'], ['PC4', 'eth0', 'Switch5', 'e0'], ['PC5', 'eth0', 'Switch5', 'e2'], ['PC6', 'eth0', 'Switch6', 'e0'], ['PC7', 'eth0', 'Switch6', 'e2']],
    solution: {
      Router01: { ifaces: { ether1: '172.16.0.1/30', ether2: '192.168.10.1/25' }, rip: { networks: ['172.16.0.0/30', '192.168.10.0/25'], passive: ['ether2'] } },
      Router02: { ifaces: { ether1: '172.16.0.2/30', ether2: '10.10.0.1/21', ether3: '192.168.10.129/25' }, rip: { networks: ['172.16.0.0/30', '10.10.0.0/21', '192.168.10.128/25'], passive: ['ether2', 'ether3'] } },
      PC1: { ip: '192.168.10.2/25', gw: '192.168.10.1' }, PC2: { ip: '192.168.10.130/25', gw: '192.168.10.129' },
      PC3: { ip: '10.10.0.2/21', gw: '10.10.0.1' }, PC4: { ip: '10.10.0.3/21', gw: '10.10.0.1' }, PC5: { ip: '10.10.0.4/21', gw: '10.10.0.1' }, PC6: { ip: '10.10.0.5/21', gw: '10.10.0.1' }, PC7: { ip: '10.10.0.6/21', gw: '10.10.0.1' }
    },
    checks: [{ t: ['ping', 'PC1', '10.10.0.6'], d: 'PC1 -> PC7' }, { t: ['ping', 'PC7', '192.168.10.130'], d: 'PC7 -> PC2' }, { t: ['ping', 'PC3', '10.10.0.6'], d: 'PC3 -> PC7 (same /21, switch tree only)' }]
  });
})(window.NL = window.NL || {});
