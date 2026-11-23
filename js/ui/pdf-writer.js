/* pdf-writer.js - Tiny dependency-free PDF writer (A4, Helvetica / Helvetica-Bold, text + rectangles + lines).
 * Written for the v0.3 completion report so it works offline by double-clicking index.html (no CDN, no library).
 * Coordinates are in points measured from the TOP-LEFT of the page (1 pt = 1/72 inch). Colours are [r,g,b] in 0..1. */
(function (NL) {
  const W = 595.28, H = 841.89;
  /* Helvetica advance widths (1/1000 em) for ASCII 32..126, used for wrapping/right-aligning. */
  const HW = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const MAP = { '\u2013': '-', '\u2014': '-', '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u2022': '*', '\u2026': '...', '\u00a0': ' ' };
  /** Make a string safe for the PDF's single-byte WinAnsi text. */
  const clean = s => String(s == null ? '' : s).replace(/[^\x20-\x7e\xa1-\xff]/g, c => MAP[c] || (c === '\n' || c === '\t' ? ' ' : '?'));
  const esc = s => clean(s).replace(/[\\()]/g, '\\$&');
  const num = n => (Math.round(n * 100) / 100).toString();
  const col = c => c.map(num).join(' ');

  class PDF {
    constructor(info) { this.pages = []; this.info = info || {}; this.cur = null; }
    addPage() { this.cur = []; this.pages.push(this.cur); return this; }
    /** Width of a string in points. */
    static width(s, size, bold) { let w = 0; clean(s).split('').forEach(c => { const k = c.charCodeAt(0); w += (k >= 32 && k <= 126 ? HW[k - 32] : 556); }); return w * size / 1000 * (bold ? 1.06 : 1); }
    /** Break a string into lines no wider than maxW (long words are hard-split). */
    static wrap(s, maxW, size, bold) {
      const out = []; let line = '';
      clean(s).split(/\s+/).filter(Boolean).forEach(word => {
        while (PDF.width(word, size, bold) > maxW) { let i = word.length - 1; while (i > 1 && PDF.width(word.slice(0, i), size, bold) > maxW) i--; if (line) { out.push(line); line = ''; } out.push(word.slice(0, i)); word = word.slice(i); }
        const t = line ? line + ' ' + word : word;
        if (PDF.width(t, size, bold) <= maxW) line = t; else { out.push(line); line = word; }
      });
      if (line || !out.length) out.push(line);
      return out;
    }
    /** Draw text with its baseline at y. opt: size, bold, color, align ('left'|'right'|'center', x is then the right edge / centre). */
    text(x, y, s, o) {
      o = o || {}; const size = o.size || 10, bold = !!o.bold; let px = x;
      if (o.align === 'right') px = x - PDF.width(s, size, bold); else if (o.align === 'center') px = x - PDF.width(s, size, bold) / 2;
      this.cur.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + num(size) + ' Tf ' + col(o.color || [0, 0, 0]) + ' rg ' + num(px) + ' ' + num(H - y) + ' Td (' + esc(s) + ') Tj ET');
      return this;
    }
    rect(x, y, w, h, o) {
      o = o || {}; const op = o.fill && o.stroke ? 'B' : o.stroke ? 'S' : 'f';
      this.cur.push((o.fill ? col(o.fill) + ' rg ' : '') + (o.stroke ? col(o.stroke) + ' RG ' + num(o.lineWidth || 0.5) + ' w ' : '') + num(x) + ' ' + num(H - y - h) + ' ' + num(w) + ' ' + num(h) + ' re ' + op);
      return this;
    }
    line(x1, y1, x2, y2, o) { o = o || {}; this.cur.push(col(o.color || [0, 0, 0]) + ' RG ' + num(o.width || 0.5) + ' w ' + num(x1) + ' ' + num(H - y1) + ' m ' + num(x2) + ' ' + num(H - y2) + ' l S'); return this; }
    /** Serialise to a Uint8Array. */
    build() {
      const objs = [], add = s => objs.push(s) && objs.length; // returns 1-based object number
      const cat = add(''), pagesObj = add(''), f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      const kids = this.pages.map(p => {
        const body = p.join('\n'), c = add('<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream');
        return add('<< /Type /Page /Parent ' + pagesObj + ' 0 R /MediaBox [0 0 ' + num(W) + ' ' + num(H) + '] /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> >> /Contents ' + c + ' 0 R >>');
      });
      objs[cat - 1] = '<< /Type /Catalog /Pages ' + pagesObj + ' 0 R >>';
      objs[pagesObj - 1] = '<< /Type /Pages /Count ' + kids.length + ' /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] >>';
      const i = this.info, d = i.date || new Date(), p2 = n => String(n).padStart(2, '0');
      const info = add('<< /Title (' + esc(i.title || '') + ') /Author (' + esc(i.author || '') + ') /Creator (NetLearn Simulator) /Producer (NetLearn Simulator PDF writer) /CreationDate (D:' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds()) + ') >>');
      let out = '%PDF-1.4\n', offs = [];
      objs.forEach((o, k) => { offs.push(out.length); out += (k + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
      const xref = out.length;
      out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + cat + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
      const u = new Uint8Array(out.length); for (let k = 0; k < out.length; k++) u[k] = out.charCodeAt(k) & 255; // all chars are single-byte after clean()
      return u;
    }
  }
  PDF.W = W; PDF.H = H;
  NL.PDF = PDF;
})(window.NL = window.NL || {});
