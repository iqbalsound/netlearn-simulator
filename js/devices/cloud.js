/* cloud.js - Cloud/Internet. Behaviour comes from meta flags (bridge/forwarding/radio) + shared protocol modules. */
(function (NL) {
  class Cloud extends NL.Device {}
  NL.registerDevice('cloud', Cloud, { label: 'Cloud/Internet', short: 'Cloud', glyph: 'NET', color: '#c7d2e0', prefix: 'eth', first: 0, ports: 2, forwarding: !!1, bridge: !!0, radio: !!0, os: 'Internet', services: [] });
  NL.Cloud = Cloud;
})(window.NL = window.NL || {});
