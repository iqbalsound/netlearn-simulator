/* l2.js - Layer 2: MAC learning, VLANs (access/trunk 802.1Q), SVIs, flooding.
 * REAL: learning table per VLAN, unknown-unicast flooding, tagging on trunks.
 * SIMPLIFIED: no STP (a "seen frame" guard stops loops), no MAC aging, no EtherChannel yet. */
(function (NL) {
  const D = NL.Device.prototype, B = NL.BCAST;
  function allowed(l2, v) { if (l2.allowed === 'all' || !l2.allowed) return true; return String(l2.allowed).split(',').some(r => { const [a, b] = r.split('-').map(Number); return b ? v >= a && v <= b : v === a; }); }

  D.bridgeIn = function (frame, pn) {
    const p = this.port(pn); if (!p || !this.ifaceOperUp(p) || p.l2.mode === 'none') return;
    if (this.seen.has(frame.id)) return; this.seen.add(frame.id); if (this.seen.size > 4000) this.seen.clear();
    let vlan;
    if (p.kind === 'wlan' || p.l2.mode === 'access') { if (frame.vlan != null && frame.vlan !== p.l2.vlan) return; vlan = p.l2.vlan; }
    else { vlan = frame.vlan != null ? frame.vlan : p.l2.native; if (!allowed(p.l2, vlan)) return; }
    this.macTable.set(vlan + '|' + frame.src, { port: pn, vlan, t: this.engine.time });
    const f = frame; f.vlan = null;
    const svi = this.ifaces.find(i => i.kind === 'svi' && i.vlanId === vlan);
    if (svi && (f.dst === svi.mac || f.dst === B)) this.l3Frame(svi, f.clone());
    if (svi && f.dst === svi.mac) return;
    this.bridgeForward(vlan, f, pn);
  };
  D.bridgeForward = function (vlan, f, exceptPort) {
    const e = f.dst !== B && this.macTable.get(vlan + '|' + f.dst);
    if (e && e.port !== 'svi') { if (e.port !== exceptPort) this.bridgeEgress(this.port(e.port), vlan, f.clone()); return; }
    if (e) return;
    this.ifaces.forEach(p => { if ((p.kind === 'eth' || p.kind === 'wlan') && p.name !== exceptPort) this.bridgeEgress(p, vlan, f.clone()); });
  };
  D.bridgeEgress = function (p, vlan, f) {
    if (!p || !this.ifaceOperUp(p) || p.l2.mode === 'none') return;
    if (p.kind === 'wlan' || p.l2.mode === 'access') { if (p.l2.vlan !== vlan) return; f.vlan = null; }
    else { if (!allowed(p.l2, vlan)) return; f.vlan = vlan === p.l2.native ? null : vlan; }
    this.engine.send(this, p.name, f);
  };
  /** A frame the switch's own IP interface (SVI) wants to send into its VLAN. */
  D.bridgeFromSvi = function (svi, f) { this.macTable.set(svi.vlanId + '|' + svi.mac, { port: 'svi' }); f.src = svi.mac; this.bridgeForward(svi.vlanId, f, null); };
  D.macRows = function () { return [...this.macTable.entries()].map(([k, v]) => ({ vlan: v.vlan ?? k.split('|')[0], mac: k.split('|')[1], port: v.port })); };
})(window.NL = window.NL || {});
