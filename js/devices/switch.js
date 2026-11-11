/* switch.js - Switch (L2). Behaviour comes from meta flags (bridge/forwarding/radio) + shared protocol modules. */
(function (NL) {
  class Switch extends NL.Device {}
  NL.registerDevice('switch', Switch, { label: 'Switch (L2)', short: 'Switch', glyph: 'SW', color: '#3dd6a3', prefix: 'e', first: 0, ports: 8, forwarding: !!0, bridge: !!1, radio: !!0, os: 'Switch', services: [] });
  NL.Switch = Switch;
})(window.NL = window.NL || {});
