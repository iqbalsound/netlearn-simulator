/* host.js - Host. Behaviour comes from meta flags (bridge/forwarding/radio) + shared protocol modules. */
(function (NL) {
  class Host extends NL.Device {}
  NL.registerDevice('host', Host, { label: 'Host', short: 'PC', glyph: 'PC', color: '#7aa7ff', prefix: 'eth', first: 0, ports: 1, forwarding: !!0, bridge: !!0, radio: !!0, os: 'Linux 5.x', services: [] });
  NL.Host = Host;
})(window.NL = window.NL || {});
