(() => {
  'use strict';
  const label = document.getElementById('pwa-version');
  const show = text => { if (label) label.textContent = text; };
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    show('PWA: HTTPSで利用できます');
    return;
  }
  let reloading = false;
  const hadController = !!navigator.serviceWorker.controller;
  function readVersion(worker) {
    if (!worker) return;
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close(); show('Ver. 更新準備中'); }, 5000);
    channel.port1.onmessage = event => {
      clearTimeout(timeout);
      if (event.data?.type === 'VERSION' && typeof event.data.version === 'string') {
        show('Ver. ' + event.data.version);
      }
      channel.port1.close();
    };
    worker.postMessage({type: 'GET_VERSION'}, [channel.port2]);
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloading) {
      reloading = true;
      location.reload();
      return;
    }
    readVersion(navigator.serviceWorker.controller);
  });
  navigator.serviceWorker.register('./sw.js', {scope:'./', updateViaCache:'none'})
    .then(async registration => {
      const ready = await navigator.serviceWorker.ready;
      readVersion(navigator.serviceWorker.controller || ready.active);
      const activateOnTitle = () => {
        const title = document.getElementById('opening-screen');
        if (registration.waiting && title && !title.hidden && getComputedStyle(title).display !== 'none') {
          registration.waiting.postMessage({type:'ACTIVATE_IF_SINGLE_CLIENT'});
        }
      };
      activateOnTitle();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') activateOnTitle();
        });
      });
    }).catch(() => show('Ver. 取得できません'));
})();
