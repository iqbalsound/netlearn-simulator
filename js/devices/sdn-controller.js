/* sdn-controller.js - SDN Controller. Behaviour comes from meta flags (bridge/forwarding/radio) + shared protocol modules. */
(function (NL) {
  class SdnController extends NL.Device {}
  NL.registerDevice('sdn-controller', SdnController, { label: 'SDN Controller', short: 'Faucet', glyph: 'SDN', color: '#ff8fd0', prefix: 'eth', first: 0, ports: 1, forwarding: !!0, bridge: !!0, radio: !!0, os: 'Linux 5.x', services: [{proto:'tcp',port:22,name:'ssh'},{proto:'tcp',port:80,name:'http'}] });
  NL.SdnController = SdnController;
})(window.NL = window.NL || {});
