/* device.js - ONE device class that can act as a host, switch, router, L3 switch, AP, firewall or cloud.
 * What it does depends on its type's "meta": bridge (switches), forwarding (routers), etc.
 * Protocol behaviour is added to Device.prototype by files in js/protocols/ (L2, L3, RIP, OSPF, NAT...). */
(function (NL) {
  NL.deviceTypes = {}; NL.onStart = []; NL.onReset = [];
  let nextId = 1;
  NL.registerDevice = (type, cls, meta) => { NL.deviceTypes[type] = Object.assign({ cls }, meta); cls.prototype.type = type; };
  const clone = o => JSON.parse(JSON.stringify(o));

  class Device {
    constructor(id, name, x, y, opts) {
      opts = opts || {};
      this.id = id || 'D' + (nextId++); this.name = name; this.x = x; this.y = y;
      const m = this.meta = NL.deviceTypes[this.type];
      this.ifaces = [];
      this.cfg = {
        gateway: null, gateway6: null, dns: [], routes: [], firewall: [], nat: [], dhcpServers: [], dhcpRelays: [], dnsRecords: {}, hosts: {},
        services: clone(m.services || []), forwarding: !!m.forwarding, slaac: true, internet: false,
        rip: { enabled: false, networks: [], passive: [], redistConn: false, defaultOriginate: false, update: 15000, timeout: 30000, garbage: 30000 },
        ospf: { enabled: false, routerId: '', networks: [], defaultOriginate: 'never', hello: 10000, dead: 40000 },
        ssid: 'NetLearn-WiFi', security: 'wpa2', password: 'learn1234', os: m.os || 'Generic'
      };
      const names = opts.ports || Array.from({ length: m.ports }, (_, i) => m.prefix + ((m.first || 0) + i));
      names.forEach(n => this.addIface(n, 'eth'));
      if (m.radio || opts.wifi) this.addIface('wlan0', 'wlan');
      if (m.mgmtNone) this.ifaces[0].l2.mode = 'none';
      this.resetState(true);
    }
    get engine() { return this.topo && this.topo.engine; }

    /** Create an interface (NIC / switch port / virtual interface). */
    addIface(name, kind, extra) {
      const i = Object.assign({
        name, kind, mac: NL.newMac(), up: true, linkId: null,
        ip: null, plen: 24, ip6: null, plen6: 64, dhcp: false,
        l2: { mode: 'access', vlan: 1, allowed: 'all', native: 1 }
      }, extra || {});
      if (kind === 'wlan') { if (this.type === 'wireless-ap') i.wifiLinks = []; else i.wifi = { ssid: '', password: '', state: 'idle' }; }
      this.ifaces.push(i); return i;
    }
    iface(n) { return this.ifaces.find(i => i.name === n); }
    port(n) { return this.iface(n); }
    freePorts() { return this.ifaces.filter(i => i.kind === 'eth' && !i.linkId); }
    log(msg, lvl) { if (this.engine) this.engine.log(this.name + ': ' + msg, lvl); }
    after(ms, fn) { const e = this._epoch; this.engine.schedule(ms, () => { if (e === this._epoch) fn(); }); }
    every(ms, fn) { const e = this._epoch, eng = this.engine; const loop = () => { if (e !== this._epoch) return; fn(); eng.schedule(ms, loop); }; eng.schedule(ms, loop); }

    resetState(hard) {
      this._epoch = (this._epoch || 0) + 1;
      this.arp = new Map(); this.pending = new Map(); this.macTable = new Map(); this.seen = new Set();
      this.pingWait = new Map(); this.probeWait = new Map(); this.dnsWait = new Map(); this.ct = new Map();
      this.natOut = new Map(); this.natIn = new Map();
      if (hard || !this.leases) this.leases = new Map();
      NL.onReset.forEach(f => f(this, hard));
      this.ifaces.forEach(i => { if (i.dhcp) { i.dhcpState = 'init'; if (hard || i.dhcpAssigned) { i.ip = null; i.dhcpAssigned = false; } } if (i.ip6auto) { i.ip6 = null; i.ip6auto = false; } });
      if (hard) this.cfg.gatewayDhcp && (this.cfg.gateway = null);
    }
    /** Re-apply configuration: clears learned state and restarts protocol timers. */
    restart(hard) { this.resetState(hard); if (this.engine) NL.onStart.forEach(f => f(this)); }

    receive(frame, portName) { if (this.meta.bridge) this.bridgeIn(frame, portName); else this.l3Receive(frame, portName); }

    /* ----- configuration API (used by GUI, terminals and labs) ----- */
    setAddr(ifn, s) {
      const i = this.iface(ifn); if (!i) throw new Error('No such interface: ' + ifn);
      if (!s) { i.ip = null; i.ip6 = null; this.restart(); return; }
      const c = NL.Addr.cidr(s); if (!c) throw new Error('Invalid address: ' + s);
      if (c.v === 4) { i.ip = c.ip; i.plen = c.plen; i.dhcp = false; } else { i.ip6 = c.ip; i.plen6 = c.plen; i.ip6auto = false; }
      this.restart();
    }
    setDhcp(ifn, on) { const i = this.iface(ifn); i.dhcp = !!on; if (on) { i.ip = null; } this.restart(); }
    addRoute(dst, via, extra) {
      const c = NL.Addr.cidr(dst); if (!c) throw new Error('Invalid destination: ' + dst);
      this.cfg.routes.push(Object.assign({ dst: NL.Addr.netOf(c.ip, c.plen), plen: c.plen, via: via || null }, extra || {})); this.restart();
    }
    removeRoute(n) { this.cfg.routes.splice(n, 1); this.restart(); }
    setPortL2(ifn, o) { Object.assign(this.iface(ifn).l2, o); this.restart(); }
    /** 802.1Q sub-interface on a router (MikroTik "interface vlan add"). */
    addVlanIf(name, vid, parent) { if (this.iface(name)) throw new Error('Interface exists: ' + name); const p = this.iface(parent); this.addIface(name, 'vlan', { vlanId: +vid, parent, mac: p.mac }); this.restart(); }
    /** Switch Virtual Interface: gives a bridge/L3 switch an IP address inside one VLAN. */
    addSvi(vid, ip) { const n = 'vlan' + vid; if (!this.iface(n)) this.addIface(n, 'svi', { vlanId: +vid }); if (ip) this.setAddr(n, ip); else this.restart(); }
    removeIface(name) { const n = this.ifaces.findIndex(i => i.name === name); if (n >= 0 && !['eth', 'wlan'].includes(this.ifaces[n].kind)) { this.ifaces.splice(n, 1); this.restart(); } }

    toJSON() {
      return {
        id: this.id, type: this.type, name: this.name, x: Math.round(this.x), y: Math.round(this.y), cfg: this.cfg,
        ifaces: this.ifaces.map(i => { const o = {}; ['name', 'kind', 'mac', 'ip', 'plen', 'ip6', 'plen6', 'up', 'dhcp', 'l2', 'vlanId', 'parent', 'tunnel', 'wifi', 'cost'].forEach(k => { if (i[k] !== undefined && !(k === 'ip' && i.dhcpAssigned) && !(k === 'ip6' && i.ip6auto)) o[k] = i[k]; }); return clone(o); })
      };
    }
    load(o) {
      this.cfg = Object.assign(this.cfg, clone(o.cfg || {}));
      this.ifaces = (o.ifaces || []).map(s => { const i = Object.assign({ linkId: null, ip: null, ip6: null, plen: 24, plen6: 64, dhcp: false, l2: { mode: 'access', vlan: 1, allowed: 'all', native: 1 } }, clone(s)); if (i.kind === 'wlan' && this.type === 'wireless-ap') i.wifiLinks = []; return i; });
      NL.Device.bumpId(this.id);
    }
    static bumpId(id) { const n = parseInt(String(id).replace(/\D/g, '') || '0', 10); if (n >= nextId) nextId = n + 1; }
  }
  NL.Device = Device;
})(window.NL = window.NL || {});
