/* server.js - Server. Behaviour comes from meta flags (bridge/forwarding/radio) + shared protocol modules. */
(function (NL) {
  class Server extends NL.Device {}
  NL.registerDevice('server', Server, { label: 'Server', short: 'Server', glyph: 'SRV', color: '#9b8cff', prefix: 'eth', first: 0, ports: 1, forwarding: !!0, bridge: !!0, radio: !!0, os: 'Linux 5.x', services: [{proto:'tcp',port:22,name:'ssh'},{proto:'tcp',port:80,name:'http'}] });
  NL.Server = Server;
})(window.NL = window.NL || {});
