// This script runs in ISOLATED world and can access chrome.storage
// It communicates with the MAIN world script via custom events

// Listen for settings requests from MAIN world
window.addEventListener("SILLY_MAQUINA_REQUEST_SETTINGS", async () => {
	try {
		const settings = await chrome.storage.local.get(["formsLockedModeBypass"]);

		// Send settings to MAIN world
		window.dispatchEvent(
			new CustomEvent("SILLY_MAQUINA_SETTINGS", {
				detail: {
					formsLockedModeBypass: settings.formsLockedModeBypass || false,
				},
			})
		);
	} catch (error) {
		console.error("🤖 SillyMaquina - Erro ao obter configurações:", error);
		// Send default settings on error
		window.dispatchEvent(
			new CustomEvent("SILLY_MAQUINA_SETTINGS", {
				detail: {
					formsLockedModeBypass: false,
				},
			})
		);
	}
});

// Request settings on page load
window.dispatchEvent(new CustomEvent("SILLY_MAQUINA_REQUEST_SETTINGS"));
