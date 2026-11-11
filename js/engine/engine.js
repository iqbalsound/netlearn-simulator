/* engine.js - Discrete-event simulation engine (clock + sorted event queue).
 * Play = clock follows real time x speed. Step = jump to next event.
 * runUntil/advance = run instantly (used by terminals, "Converge" and lab checkers). */
(function (NL) {
  class Engine {
    constructor(topology) {
      this.topology = topology; topology.engine = this;
      this.time = 0; this.queue = []; this.inflight = []; this.running = false; this.speed = 0.1;
      this.showControl = false;  // draw routing-protocol/ARP-less control frames?
      this.listeners = []; this.capture = [];
    }
    onLog(fn) { this.listeners.push(fn); }
    log(msg, level) { this.listeners.forEach(f => f({ t: this.time, msg, level: level || 'info' })); }
    schedule(delay, fn) {
      const ev = { t: this.time + delay, fn }; let i = this.queue.length;
      while (i > 0 && this.queue[i - 1].t > ev.t) i--; this.queue.splice(i, 0, ev);
    }
    /** Put a frame on whatever is attached to (device, port): a cable, or all Wi-Fi clients of an AP radio. */
    send(device, portName, frame) {
      const port = device.port(portName); if (!port) return;
      if (port.wifiLinks) {
        port.wifiLinks.forEach(id => { const l = this.topology.links.get(id); if (l && (frame.dst === NL.BCAST || frame.dst === l.clientMac)) this._tx(device, l, frame.clone()); });
        return;
      }
      const link = port.linkId && this.topology.links.get(port.linkId);
      if (!link) return;               // unplugged: silently lost, like a real NIC with no cable
      this._tx(device, link, frame);
    }
    _tx(device, link, frame) {
      if (!link.up) return;
      if (link.drops()) { this.log('Link ' + link.id + ' lost a frame (' + link.loss + '% loss)', 'warn'); return; }
      const delay = link.delayFor(frame.size), far = link.other(device.id);
      const vis = !frame.ctl || this.showControl;
      const fl = { frame, link, fromDev: device.id, t0: this.time, t1: this.time + delay };
      if (vis) this.inflight.push(fl);
      if (this.onFrame) this.onFrame(device, link, frame);
      this.schedule(delay, () => {
        if (vis) this.inflight = this.inflight.filter(f => f !== fl);
        const t = this.topology.devices.get(far.dev); if (t) t.receive(frame, far.port, this);
      });
    }
    play() { this.running = true; } pause() { this.running = false; } toggle() { this.running = !this.running; }
    runDue() { while (this.queue.length && this.queue[0].t <= this.time) this.queue.shift().fn(); }
    tick(dt) { if (!this.running) return; this.time += dt * this.speed; this.runDue(); }
    step() { if (!this.queue.length) return; this.time = Math.max(this.time, this.queue[0].t); this.runDue(); }
    /** Run events instantly until pred() is true or maxMs of simulated time passes. */
    runUntil(pred, maxMs) {
      const end = this.time + maxMs;
      while (!pred() && this.queue.length && this.queue[0].t <= end) { const ev = this.queue.shift(); this.time = Math.max(this.time, ev.t); ev.fn(); }
      if (!pred() && this.time < end) this.time = end; return pred();
    }
    advance(ms) { this.runUntil(() => false, ms); this.inflight = []; }
    reset() { this.time = 0; this.queue = []; this.inflight = []; this.running = false; this.topology.devices.forEach(d => d.restart(true)); }
  }
  NL.Engine = Engine;
})(window.NL = window.NL || {});
