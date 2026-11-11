/* wireless-ap.js - Wireless AP. Behaviour comes from meta flags (bridge/forwarding/radio) + shared protocol modules. */
(function (NL) {
  class WirelessAp extends NL.Device {}
  NL.registerDevice('wireless-ap', WirelessAp, { label: 'Wireless AP', short: 'AP', glyph: 'AP', color: '#e0a458', prefix: 'eth', first: 0, ports: 1, forwarding: !!0, bridge: !!1, radio: !!1, os: 'AP firmware', services: [] });
  NL.WirelessAp = WirelessAp;
})(window.NL = window.NL || {});
