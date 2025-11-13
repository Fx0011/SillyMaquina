// This script runs in ISOLATED world
// It reads settings from chrome.storage and writes to localStorage
// The MAIN world script can read localStorage (same origin)

(async function initializeFormsBypassSettings() {
	try {
		// Get settings from chrome.storage (accessible in isolated world)
		const result = await chrome.storage.local.get("settings");
		const settings = result.settings || {};
		const bypassEnabled = settings.formsLockedModeBypass === true;

		// Write to localStorage - MAIN world can read this
		localStorage.setItem("gfu-bypass-enabled", bypassEnabled ? "true" : "false");
		console.log("Google Forms Unlocker - Settings saved to localStorage:", bypassEnabled);
	} catch (error) {
		console.error("Google Forms Unlocker - Failed to load settings:", error);
		localStorage.setItem("gfu-bypass-enabled", "false");
	}
})();
