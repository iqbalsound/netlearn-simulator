/* report.js - v0.3 "Lab Completion Report" (PDF): student name + ID, every lab with status, checks passed and completion date. */
(function (NL) {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], p2 = n => String(n).padStart(2, '0');
  const fmt = (iso, withTime) => { if (!iso) return ''; const d = new Date(iso); return p2(d.getDate()) + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + (withTime === false ? '' : ', ' + p2(d.getHours()) + ':' + p2(d.getMinutes())); };
  const NAVY = [0.04, 0.055, 0.165], GREEN = [0.07, 0.56, 0.4], AMBER = [0.78, 0.5, 0], GREY = [0.45, 0.5, 0.56], INK = [0.08, 0.12, 0.17], LINE = [0.8, 0.84, 0.88], ALT = [0.945, 0.96, 0.975];

  /** Short code printed on the report: a checksum of name, ID and the completion dates (detects casual edits of the PDF text, not a security feature). */
  function reportCode(st, rows) {
    let h = 0x811c9dc5; const s = [st.id, st.name].concat(rows.map(r => r.lab.id + ':' + (r.e && r.e.completedAt || ''))).join('|');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).toUpperCase().padStart(8, '0');
  }

  /** Build the PDF. student = {id,name}; labs = NL.LABS; progress = NL.Progress-like {get(id)}. Returns {bytes, code, done, total}. */
  function build(student, labs, progress, now) {
    now = now || new Date();
    const rows = labs.map(l => ({ lab: l, e: progress.get(l.id) })), done = rows.filter(r => r.e && r.e.done).length, total = rows.length, code = reportCode(student, rows);
    const pdf = new NL.PDF({ title: 'NetLearn Simulator V0.3 - Lab Completion Report - ' + student.name + ' (' + student.id + ')', author: student.name, date: now }), PDF = NL.PDF;
    const L = 40, R = PDF.W - 40, cols = { n: L, lab: L + 24, chk: L + 262, st: L + 318, dt: L + 392 }, TOP = 40, BOT = PDF.H - 52;
    // ---- lay out rows into pages ----
    const items = []; let lastGroup = null;
    rows.forEach((r, i) => {
      if (r.lab.group !== lastGroup) { lastGroup = r.lab.group; items.push({ kind: 'group', text: lastGroup, h: 20 }); }
      const lines = PDF.wrap(r.lab.title, 232, 9, false); items.push({ kind: 'row', r, i, lines, h: Math.max(20, 9 + lines.length * 11) });
    });
    const pages = [[]]; let y = 0, first = true;
    const room = p => (p === 0 ? BOT - 330 : BOT - 80);       // page 1 carries the header block (about 330 pt)
    items.forEach(it => { const pi = pages.length - 1; if (y + it.h > room(pi) && pages[pi].length) { pages.push([]); y = 0; } pages[pages.length - 1].push(it); y += it.h; });
    // ---- draw ----
    pages.forEach((its, pi) => {
      pdf.addPage(); let cy;
      if (pi === 0) {
        pdf.rect(0, 0, PDF.W, 92, { fill: NAVY });
        pdf.rect(0, 92, PDF.W, 3, { fill: [0.49, 0.23, 0.93] });
        pdf.text(L, 42, 'NetLearn Simulator  V0.3', { size: 20, bold: true, color: [1, 1, 1] });
        pdf.text(L, 64, 'Lab Completion Report', { size: 13, color: [0.65, 0.55, 0.98] });
        pdf.text(R, 42, 'Generated', { size: 8, color: [0.7, 0.75, 0.85], align: 'right' });
        pdf.text(R, 56, fmt(now.toISOString()), { size: 10, bold: true, color: [1, 1, 1], align: 'right' });
        // student block
        pdf.rect(L, 112, R - L, 62, { fill: ALT, stroke: LINE });
        pdf.text(L + 14, 134, 'STUDENT NAME', { size: 7.5, bold: true, color: GREY }); pdf.text(L + 14, 152, student.name, { size: 14, bold: true, color: INK });
        pdf.text(L + 330, 134, 'STUDENT ID', { size: 7.5, bold: true, color: GREY }); pdf.text(L + 330, 152, student.id, { size: 14, bold: true, color: INK });
        // summary
        const pct = total ? Math.round(done * 100 / total) : 0;
        pdf.text(L, 204, 'Labs completed: ' + done + ' of ' + total + '  (' + pct + '%)', { size: 12, bold: true, color: INK });
        pdf.rect(L, 214, R - L, 9, { fill: [0.88, 0.9, 0.93] }); if (done) pdf.rect(L, 214, (R - L) * done / total, 9, { fill: GREEN });
        pdf.text(L, 242, 'A lab is marked Completed when "Check my work" passed every check and the model solution was not used. The date is the first time that happened.', { size: 7.5, color: GREY });
        cy = 262;
      } else cy = TOP + 10;
      // table header
      const hdr = () => { pdf.rect(L, cy, R - L, 20, { fill: NAVY }); const o = { size: 8.5, bold: true, color: [1, 1, 1] }; pdf.text(cols.n + 4, cy + 13.5, '#', o); pdf.text(cols.lab, cy + 13.5, 'Lab', o); pdf.text(cols.chk, cy + 13.5, 'Checks', o); pdf.text(cols.st, cy + 13.5, 'Status', o); pdf.text(cols.dt, cy + 13.5, 'Date of completion', o); cy += 20; };
      hdr();
      its.forEach(it => {
        if (it.kind === 'group') { pdf.rect(L, cy, R - L, it.h, { fill: [0.88, 0.85, 0.99] }); pdf.text(L + 6, cy + 13.5, it.text, { size: 9, bold: true, color: [0.3, 0.12, 0.6] }); cy += it.h; return; }
        const r = it.r, e = r.e, isDone = !!(e && e.done), st = isDone ? 'Completed' : (e && e.attempts ? 'In progress' : 'Not started'), sc = isDone ? GREEN : (e && e.attempts ? AMBER : GREY);
        if (it.i % 2) pdf.rect(L, cy, R - L, it.h, { fill: ALT });
        const base = cy + 13.5;
        pdf.text(cols.n + 4, base, String(it.i + 1), { size: 9, color: GREY });
        it.lines.forEach((ln, k) => pdf.text(cols.lab, base + k * 11, ln, { size: 9, color: INK }));
        pdf.text(cols.chk, base, e && e.attempts ? e.best + ' / ' + e.total : '-', { size: 9, color: INK });
        pdf.text(cols.st, base, st, { size: 9, bold: true, color: sc });
        pdf.text(cols.dt, base, isDone ? fmt(e.completedAt) : '-', { size: 9, color: INK });
        pdf.line(L, cy + it.h, R, cy + it.h, { color: LINE, width: 0.4 }); cy += it.h;
      });
      if (pi === pages.length - 1) { cy += 22; pdf.text(L, cy, 'Total: ' + done + ' of ' + total + ' labs completed.', { size: 10, bold: true, color: INK }); pdf.text(L, cy + 14, 'Report code: ' + code, { size: 8.5, color: GREY }); pdf.text(L, cy + 30, 'Progress is recorded by the simulator in the student\'s browser and checked automatically by the lab checks; it is not an official grade.', { size: 7.5, color: GREY }); }
      // footer
      pdf.line(L, PDF.H - 40, R, PDF.H - 40, { color: LINE, width: 0.5 });
      pdf.text(L, PDF.H - 26, 'NetLearn Simulator v0.3 - by Iqbal Uddin Khan, Hamdard University', { size: 7.5, color: GREY });
      pdf.text(R, PDF.H - 26, student.name + ' (' + student.id + ')  |  Page ' + (pi + 1) + ' of ' + pages.length, { size: 7.5, color: GREY, align: 'right' });
    });
    return { bytes: pdf.build(), code, done, total };
  }

  const safe = s => String(s).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'student';
  function download(bytes, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

  NL.Report = {
    build, fmt, reportCode,
    dialog: null,
    onChange: null,                                  // called after progress is cleared so the lab panel can refresh
    open() { if (!this.dialog) return; this.fill(); this.dialog.showModal(); },
    fill() {
      const d = this.dialog, st = NL.Progress.student(); d.querySelector('#rep-name').value = st.name; d.querySelector('#rep-id').value = st.id;
      const done = NL.Progress.doneCount(), total = NL.LABS.length;
      d.querySelector('#rep-sum').textContent = done + ' of ' + total + ' labs completed';
      d.querySelector('#rep-list').innerHTML = NL.LABS.map(l => { const e = NL.Progress.get(l.id), ok = e && e.done; return '<li class="' + (ok ? 'pass' : '') + '">' + (ok ? '✔ ' : '○ ') + l.title.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '<small>' + (ok ? fmt(e.completedAt) : '') + '</small></li>'; }).join('');
      d.querySelector('#rep-err').textContent = '';
    },
    generate() {
      const d = this.dialog, name = d.querySelector('#rep-name').value.trim(), id = d.querySelector('#rep-id').value.trim(), err = d.querySelector('#rep-err');
      if (!name || !id) { err.textContent = 'Please enter both the student name and the student ID.'; return; }
      NL.Progress.setStudent(id, name);
      const r = build({ id, name }, NL.LABS, NL.Progress, new Date()), n = new Date();
      download(r.bytes, 'NetLearn-Report_' + safe(id) + '_' + n.getFullYear() + p2(n.getMonth() + 1) + p2(n.getDate()) + '.pdf');
      err.textContent = ''; d.querySelector('#rep-note').textContent = 'PDF created (' + r.done + ' of ' + r.total + ' labs completed, code ' + r.code + '). Check your Downloads folder.';
    }
  };

  NL.initReport = function (dialog, openBtn) {
    NL.Report.dialog = dialog;
    dialog.innerHTML = '<form method="dialog" class="report"><h2>Lab Completion Report</h2><p class="ver">NetLearn Simulator V0.3 - PDF for your teacher</p>' +
      '<div class="row"><label>Student name<input id="rep-name" autocomplete="name" placeholder="e.g. Ayesha Khan"></label><label>Student ID<input id="rep-id" placeholder="e.g. 2023-DFCS-014"></label></div>' +
      '<h4 id="rep-sum"></h4><ul id="rep-list" class="checks replist"></ul><p id="rep-err" class="repmsg bad"></p><p id="rep-note" class="repmsg"></p>' +
      '<div class="actions"><button type="button" id="rep-clear" class="warn">Clear progress</button><button value="close">Close</button><button type="button" id="rep-go" class="primary">Generate PDF</button></div></form>';
    dialog.querySelector('#rep-go').onclick = () => NL.Report.generate();
    dialog.querySelector('#rep-clear').onclick = () => { if (confirm('Erase the completion record of ALL labs on this browser? (Use this on a shared lab PC before the next student starts.)')) { NL.Progress.clear(); NL.Report.fill(); NL.Report.onChange && NL.Report.onChange(); } };
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    if (openBtn) openBtn.addEventListener('click', () => NL.Report.open());
  };
})(window.NL = window.NL || {});
