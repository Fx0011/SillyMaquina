// This script runs in ISOLATED world
// It reads settings from chrome.storage and injects a script into the page
// that sets a data attribute the MAIN world can check

(async function initializeFormsBypassSettings() {
	try {
		// Get settings from chrome.storage (accessible in isolated world)
		const result = await chrome.storage.local.get("settings");
		const settings = result.settings || {};
		const bypassEnabled = settings.formsLockedModeBypass === true;

		console.log("Google Forms Unlocker - Settings check:", bypassEnabled);

		// Inject a script into the page that sets a data attribute
		// The MAIN world script will be able to check document.documentElement.getAttribute()
		const script = document.createElement("script");
		script.textContent = `
			document.documentElement.setAttribute('data-gfu-enabled', '${bypassEnabled}');
			console.log('Google Forms Unlocker - Bypass enabled:', document.documentElement.getAttribute('data-gfu-enabled'));
		`;
		script.id = "gfu-settings-injector";

		// Inject before document loads
		if (document.documentElement) {
			document.documentElement.insertBefore(script, document.documentElement.firstChild);
		} else {
			document.addEventListener("DOMContentLoaded", () => {
				document.documentElement.insertBefore(script, document.documentElement.firstChild);
			});
		}
	} catch (error) {
		console.error("Google Forms Unlocker - Failed to load settings:", error);
		// Set default to false if something goes wrong
		const script = document.createElement("script");
		script.textContent = `document.documentElement.setAttribute('data-gfu-enabled', 'false');`;
		if (document.documentElement) {
			document.documentElement.insertBefore(script, document.documentElement.firstChild);
		}
	}
})();
