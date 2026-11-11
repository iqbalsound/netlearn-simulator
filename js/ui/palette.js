/* palette.js - Left-hand device list. Drag onto the canvas, or double-click to add. */
(function (NL) {
  NL.buildPalette = function (container, canvasView) {
    container.innerHTML = '';
    Object.keys(NL.deviceTypes).forEach(type => {
      const m = NL.deviceTypes[type];
      const item = document.createElement('div');
      item.className = 'pal-item'; item.draggable = true; item.tabIndex = 0;
      item.title = 'Drag to canvas (or double-click / Enter)';
      item.innerHTML = '<span class="pal-glyph" style="color:' + m.color + ';border-color:' + m.color + '">' + m.glyph + '</span><span>' + m.label + '</span>';
      item.addEventListener('dragstart', e => { e.dataTransfer.setData('text/netlearn-device', type); e.dataTransfer.effectAllowed = 'copy'; });
      const add = () => canvasView.addAt(type, 120 + Math.random() * (canvasView.w - 240), 100 + Math.random() * (canvasView.h - 200));
      item.addEventListener('dblclick', add);
      item.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
      container.appendChild(item);
    });
  };
})(window.NL = window.NL || {});
