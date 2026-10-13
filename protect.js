/* Light deterrents against casual copying of our photos and videos. Anyone determined can still
   capture what a browser shows, so this only stops the easy routes: right-click save, drag-out and
   the video download or picture-in-picture buttons. Forms and links keep working normally. */
(function () {
  var st = document.createElement('style');
  st.textContent = 'img, video, svg { -webkit-user-drag: none; user-drag: none; } img { -webkit-touch-callout: none; } .jc-stage img, .wh-photo, .jf-topphoto, .jf-planimg { user-select: none; -webkit-user-select: none; }';
  document.head.appendChild(st);
  function isMedia(t) { return t && t.closest && t.closest('img, video, picture, .jc-stage, .wh-win, .jf-plane, .jf-bg, .wh-bg, .sp-item'); }
  function isField(t) { return t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]'); }
  document.addEventListener('contextmenu', function (e) { if (isMedia(e.target) && !isField(e.target)) e.preventDefault(); });
  document.addEventListener('dragstart', function (e) { if (isMedia(e.target)) e.preventDefault(); });
  function harden() {
    [].forEach.call(document.querySelectorAll('video'), function (v) {
      v.setAttribute('controlslist', 'nodownload noremoteplayback nofullscreen');
      v.setAttribute('disablepictureinpicture', '');
      v.setAttribute('disableremoteplayback', '');
    });
    [].forEach.call(document.querySelectorAll('img'), function (i) { i.setAttribute('draggable', 'false'); });
  }
  harden();
  if (window.MutationObserver) new MutationObserver(harden).observe(document.documentElement, { childList: true, subtree: true });
})();
