/* progress.js - Remembers, per browser, which labs the student has completed (v0.3).
 * A lab counts as COMPLETED only when "Check my work" passes every check AND the model solution was not applied
 * in that attempt. The first completion date/time is kept. Stored in localStorage (falls back to memory if blocked). */
(function (NL) {
  const KEY = 'nl-progress-v1', SKEY = 'nl-student-v1';
  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  let data = read(KEY) || {}, student = read(SKEY) || { id: '', name: '' };

  NL.Progress = {
    /** Entry for a lab: { attempts, best, total, done, completedAt, lastAt } or undefined. */
    get(labId) { return data[labId]; },
    isDone(labId) { return !!(data[labId] && data[labId].done); },
    doneCount() { return NL.LABS.filter(l => this.isDone(l.id)).length; },
    /** Record the outcome of one "Check my work" run. results = array from LabEngine.check. */
    record(labId, results) {
      const pass = results.filter(r => r.pass).length, total = results.length, now = new Date().toISOString();
      const e = data[labId] || (data[labId] = { attempts: 0, best: 0, total, done: false });
      e.attempts++; e.total = total; e.lastAt = now; if (pass >= e.best) e.best = pass;
      if (total > 0 && pass === total && !e.done) { e.done = true; e.completedAt = now; }
      write(KEY, data); return e;
    },
    clear() { data = {}; write(KEY, data); },
    student() { return { id: student.id || '', name: student.name || '' }; },
    setStudent(id, name) { student = { id: String(id).trim(), name: String(name).trim() }; write(SKEY, student); },
    snapshot() { return JSON.parse(JSON.stringify(data)); }
  };
})(window.NL = window.NL || {});
