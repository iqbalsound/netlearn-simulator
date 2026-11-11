/* router.js - Router. Behaviour comes from meta flags (bridge/forwarding/radio) + shared protocol modules. */
(function (NL) {
  class Router extends NL.Device {}
  NL.registerDevice('router', Router, { label: 'Router', short: 'Router', glyph: 'RT', color: '#f5b83d', prefix: 'ether', first: 1, ports: 4, forwarding: !!1, bridge: !!0, radio: !!0, os: 'MikroTik RouterOS 6.49', services: [{proto:'tcp',port:22,name:'ssh'},{proto:'tcp',port:23,name:'telnet'},{proto:'tcp',port:80,name:'http'},{proto:'tcp',port:8291,name:'winbox'},{proto:'udp',port:5678,name:'mndp'},{proto:'udp',port:20561,name:'mac-winbox'},{proto:'udp',port:161,name:'snmp'},{proto:'udp',port:53,name:'domain'}] });
  NL.Router = Router;
})(window.NL = window.NL || {});
