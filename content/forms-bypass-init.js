// This script runs in ISOLATED world and communicates with MAIN world
// It reads settings from chrome.storage and exposes them via window object

(async function initializeFormsBypassSettings() {
	try {
		// Get settings from chrome.storage (accessible in isolated world)
		const result = await chrome.storage.local.get("settings");
		const settings = result.settings || {};

		// Expose settings to page context via window object
		// MAIN world scripts can access this
		window.__gfuSettings = {
			enabled: settings.formsLockedModeBypass === true,
			fullSettings: settings
		};

		console.log("Google Forms Unlocker - Settings initialized:", window.__gfuSettings);
	} catch (error) {
		console.error("Google Forms Unlocker - Failed to load settings:", error);
		// Set defaults if something goes wrong
		window.__gfuSettings = {
			enabled: false,
			fullSettings: {}
		};
	}
})();
