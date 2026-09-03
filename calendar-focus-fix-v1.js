(()=>{'use strict';
/* Compatibility bridge kept public for old cached clients. Runtime behaviour now lives in calendar-focus-v1.js. */
const core=()=>window.LALIGA_CALENDAR_FOCUS_V1||null;
window.LALIGA_CALENDAR_FOCUS_FIX_V1=Object.freeze({refreshStandings:()=>core()?.refreshStandings?.()||Promise.resolve(false),logoFor:team=>core()?.logoFor?.(team)||''});
})();
