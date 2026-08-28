(() => {
  'use strict';
  // Compatibility shim: the v2.13 official UI is the only active dashboard controller.
  // Keeping this file loaded preserves the old HTML contract without issuing duplicate requests.
  window.FANTASY_LEGACY_DASHBOARD_DISABLED = true;
})();
