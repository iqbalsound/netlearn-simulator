/* l3switch.js - L3 Switch. Behaviour comes from meta flags (bridge/forwarding/radio) + shared protocol modules. */
(function (NL) {
  class L3Switch extends NL.Device {}
  NL.registerDevice('l3switch', L3Switch, { label: 'L3 Switch', short: 'L3SW', glyph: 'L3', color: '#2bb8c9', prefix: 'Gi1/0/', first: 1, ports: 8, forwarding: !!1, bridge: !!1, radio: !!0, os: 'Switch', services: [] });
  NL.L3Switch = L3Switch;
})(window.NL = window.NL || {});
