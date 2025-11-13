(async function initializeFormsBypassSettings() {
	try {
		const result = await chrome.storage.local.get("settings");
		const settings = result.settings || {};
		const bypassEnabled = settings.formsLockedModeBypass === true;

		localStorage.setItem("gfu-bypass-enabled", bypassEnabled ? "true" : "false");
		console.log("Google Forms Unlocker - Settings saved to localStorage:", bypassEnabled);
	} catch (error) {
		console.error("Google Forms Unlocker - Failed to load settings:", error);
		localStorage.setItem("gfu-bypass-enabled", "false");
	}
})();
