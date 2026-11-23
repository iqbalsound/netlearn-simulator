// Headless test of the v0.3 completion report: records real lab results, builds the PDF, checks the file structure.
// Run:  node tests/run-report.js [out.pdf]
global.window = global; const fs = require('fs'), vm = require('vm'), path = require('path');
const store = {}; global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
const js = f => path.join(__dirname, '..', 'js', f + '.js');
['engine/addr', 'engine/packet', 'engine/link', 'engine/engine', 'devices/device', 'protocols/l2', 'protocols/l3', 'protocols/services', 'protocols/filter', 'protocols/nat', 'protocols/routing-rip', 'protocols/routing-ospf', 'protocols/ipv6', 'protocols/tunnels', 'devices/host', 'devices/server', 'devices/switch', 'devices/l3switch', 'devices/router', 'devices/firewall', 'devices/cloud', 'devices/sdn-controller', 'devices/wireless-ap', 'engine/topology', 'labs/lab-engine', 'labs/labs-basics', 'labs/labs-services', 'labs/labs-advanced', 'ui/pdf-writer', 'ui/progress', 'ui/report']
  .forEach(f => vm.runInThisContext(fs.readFileSync(js(f), 'utf8'), { filename: f }));
const NL = window.NL; let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
ok(NL.LABS.length > 0, NL.LABS.length + ' labs loaded');
// 1) not-started report
let r = NL.Report.build({ id: 'T-001', name: 'Test Student' }, NL.LABS, NL.Progress, new Date());
ok(r.done === 0, 'fresh progress = 0 completed');
// 2) a failing check (nothing configured) must NOT complete a lab, but counts as an attempt
const lab0 = NL.LABS[0], t0 = new NL.Topology(); new NL.Engine(t0); NL.LabEngine.load(t0, lab0);
NL.Progress.record(lab0.id, NL.LabEngine.check(t0, lab0)); ok(!NL.Progress.isDone(lab0.id) && NL.Progress.get(lab0.id).attempts === 1, 'unsolved lab is In progress, not completed');
// 3) solved labs pass every check -> completed (stands in for a student who did the work)
NL.LABS.forEach((lab, i) => { if (i % 3 === 2) return; const t = new NL.Topology(); new NL.Engine(t); NL.LabEngine.load(t, lab); NL.LabEngine.solve(t, lab); NL.Progress.record(lab.id, NL.LabEngine.check(t, lab)); });
const done = NL.Progress.doneCount(); ok(done > 0 && done < NL.LABS.length, done + ' of ' + NL.LABS.length + ' labs recorded complete');
NL.Progress.setStudent('2023-DFCS-014', 'Ayesha Khan'); const st = NL.Progress.student(); ok(st.id === '2023-DFCS-014' && st.name === 'Ayesha Khan', 'student id/name stored');
r = NL.Report.build(st, NL.LABS, NL.Progress, new Date()); const txt = Buffer.from(r.bytes).toString('latin1');
ok(txt.startsWith('%PDF-1.4') && txt.trim().endsWith('%%EOF'), 'PDF header/trailer present');
const sx = +/startxref\n(\d+)/.exec(txt)[1]; ok(txt.slice(sx, sx + 4) === 'xref', 'startxref points at the xref table');
const offs = [...txt.matchAll(/(\d{10}) 00000 n/g)].map(m => +m[1]); ok(offs.every((o, i) => txt.slice(o).startsWith((i + 1) + ' 0 obj')), 'all ' + offs.length + ' xref offsets are correct');
ok(/Ayesha Khan/.test(txt) && /2023-DFCS-014/.test(txt), 'name and ID are in the PDF'); ok(r.done === done && /\/Count \d/.test(txt), 'summary count matches (' + r.done + '/' + r.total + '), code ' + r.code);
const out = process.argv[2] || '/tmp/netlearn-report-test.pdf'; fs.writeFileSync(out, r.bytes); console.log('wrote', out, r.bytes.length, 'bytes');
process.exit(bad ? 1 : 0);
