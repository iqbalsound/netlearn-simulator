/* about-modal.js - About dialog + footer credit. Details are the exact values requested. */
(function (NL) {
  NL.ABOUT = {
    project: 'NetLearn Simulator - by Iqbal',
    author: 'Iqbal Uddin Khan',
    role: 'Assistant Professor, DIT',
    org: 'Hamdard University',
    bio: 'Cloud Computing and CyberSec enthusiast | Assistant Professor | Mentor | Academic Facilitator | Program Coordinator (BS/AD Programs), HU-NN Block F Site',
    email: 'iqbalsound@yahoo.com',
    linkedin: 'https://www.linkedin.com/in/iqbaluddinkhan/',
    version: '0.2',
    license: 'License: to be decided by the author (placeholder).',
    disclaimer: 'This is an educational simulation with simplified behavior. It does not run real vendor firmware.'
  };

  NL.initAbout = function (dialog, openBtn) {
    const a = NL.ABOUT;
    dialog.innerHTML =
      '<form method="dialog" class="about">' +
      '<h2>' + a.project + '</h2><p class="ver">Version ' + a.version + '</p>' +
      '<dl><dt>Author</dt><dd>' + a.author + '</dd><dt>Role</dt><dd>' + a.role + '</dd><dt>Organization</dt><dd>' + a.org + '</dd>' +
      '<dt>Bio</dt><dd>' + a.bio + '</dd>' +
      '<dt>Email</dt><dd><a href="mailto:' + a.email + '">' + a.email + '</a></dd>' +
      '<dt>LinkedIn</dt><dd><a href="' + a.linkedin + '" target="_blank" rel="noopener">' + a.linkedin + '</a></dd>' +
      '<dt>License</dt><dd>' + a.license + '</dd></dl>' +
      '<p class="disclaimer">' + a.disclaimer + '</p>' +
      '<button class="primary">Close</button></form>';
    openBtn.addEventListener('click', () => dialog.showModal());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    const f = document.getElementById('footer-credit');
    if (f) f.innerHTML = a.project + ' · v' + a.version + ' · ' + a.author + ', ' + a.role + ', ' + a.org + ' · <a href="mailto:' + a.email + '">' + a.email + '</a> · <a href="' + a.linkedin + '" target="_blank" rel="noopener">LinkedIn</a>';
  };
})(window.NL = window.NL || {});
