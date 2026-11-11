/* link.js - A cable (or Wi-Fi association) with bandwidth, latency, jitter, loss, up/down.
 * REAL: delay = latency +/- jitter + serialization (bits / bandwidth).
 * SIMPLIFIED: no queues, duplex or error model. */
(function (NL) {
  let nextId = 1;
  class Link {
    constructor(a, b, o) {
      o = o || {}; this.id = o.id || 'L' + (nextId++); this.a = a; this.b = b; this.kind = o.kind || 'cable';
      this.bandwidth = o.bandwidth ?? 100; this.latency = o.latency ?? 10; this.jitter = o.jitter ?? 0; this.loss = o.loss ?? 0; this.up = o.up ?? true;
    }
    other(devId) { return this.a.dev === devId ? this.b : this.a; }
    delayFor(bytes) { const ser = (bytes * 8) / (this.bandwidth * 1000); const j = this.jitter ? (Math.random() * 2 - 1) * this.jitter : 0; return Math.max(0.1, this.latency + j + ser); }
    drops() { return this.loss > 0 && Math.random() * 100 < this.loss; }
    toJSON() { return { id: this.id, a: this.a, b: this.b, bandwidth: this.bandwidth, latency: this.latency, jitter: this.jitter, loss: this.loss, up: this.up }; }
    static bumpId(n) { if (n >= nextId) nextId = n + 1; }
  }
  NL.Link = Link;
})(window.NL = window.NL || {});
