(() => {
  'use strict';
  function bootBridge() {
    const app = window.FANTASY_APP_V28;
    if (app?.loadFixtures) return app.loadFixtures();
    window.setTimeout(bootBridge, 50);
    return null;
  }
  window.reloadUnifiedCalendar = bootBridge;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootBridge, { once:true });
  else bootBridge();
})();
