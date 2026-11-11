// Headless regression test: loads every lab, applies the model solution and runs its auto-checks.
// Run:  node tests/run-labs.js [labId]      (exit code 1 if any lab fails)
global.window = global; const fs = require('fs'), vm = require('vm'), path = require('path');
const js = f => path.join(__dirname, '..', 'js', f + '.js');
['engine/addr', 'engine/packet', 'engine/link', 'engine/engine', 'devices/device', 'protocols/l2', 'protocols/l3', 'protocols/services', 'protocols/filter', 'protocols/nat', 'protocols/routing-rip', 'protocols/routing-ospf', 'protocols/ipv6', 'protocols/tunnels', 'devices/host', 'devices/server', 'devices/switch', 'devices/l3switch', 'devices/router', 'devices/firewall', 'devices/cloud', 'devices/sdn-controller', 'devices/wireless-ap', 'engine/topology', 'labs/lab-engine', 'labs/labs-basics', 'labs/labs-services', 'labs/labs-advanced']
  .forEach(f => vm.runInThisContext(fs.readFileSync(js(f), 'utf8'), { filename: f }));
const NL = window.NL, only = process.argv[2]; let bad = 0;
for (const lab of NL.LABS) {
  if (only && lab.id !== only) continue;
  const t = new NL.Topology(); new NL.Engine(t);
  try { NL.LabEngine.load(t, lab); NL.LabEngine.solve(t, lab); const r = NL.LabEngine.check(t, lab), p = r.filter(x => x.pass).length;
    console.log((p === r.length ? 'PASS ' : 'FAIL ') + lab.id + ' ' + p + '/' + r.length); r.filter(x => !x.pass).forEach(x => console.log('   x', x.desc, '|', x.note)); if (p !== r.length) bad++;
  } catch (e) { console.log('ERROR ' + lab.id + ' ' + e.message); bad++; }
}
process.exit(bad ? 1 : 0);
