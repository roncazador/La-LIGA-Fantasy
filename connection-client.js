(() => {
  'use strict';
  // Compatibility shim: login is now initiated by the single v2.13 interface.
  // No legacy panels, intervals or duplicate LIVE dashboard requests are created here.
  window.LALIGA_CONNECTION = window.LALIGA_CONNECTION || Object.freeze({ sync: async () => false });
  window.LALIGA_LEGACY_CONNECTION_DISABLED = true;
})();
