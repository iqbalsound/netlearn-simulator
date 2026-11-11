/* firewall.js - Firewall. Behaviour comes from meta flags (bridge/forwarding/radio) + shared protocol modules. */
(function (NL) {
  class Firewall extends NL.Device {}
  NL.registerDevice('firewall', Firewall, { label: 'Firewall', short: 'Firewall', glyph: 'FW', color: '#ff6b6b', prefix: 'eth', first: 0, ports: 3, forwarding: !!1, bridge: !!0, radio: !!0, os: 'Linux (iptables)', services: [{proto:'tcp',port:22,name:'ssh'},{proto:'tcp',port:23,name:'telnet'},{proto:'tcp',port:80,name:'http'},{proto:'tcp',port:8291,name:'winbox'},{proto:'udp',port:5678,name:'mndp'},{proto:'udp',port:20561,name:'mac-winbox'},{proto:'udp',port:161,name:'snmp'},{proto:'udp',port:53,name:'domain'}] });
  NL.Firewall = Firewall;
})(window.NL = window.NL || {});
