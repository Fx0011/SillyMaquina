// This script runs in ISOLATED world and can access chrome.storage
// It shares settings with MAIN world via sessionStorage

(async () => {
	try {
		const result = await chrome.storage.local.get("formsLockedModeBypass");
		const enabled = result.formsLockedModeBypass === true;

		console.log("🤖 SillyMaquina - formsLockedModeBypass:", enabled);

		// Store in sessionStorage (accessible from MAIN world)
		sessionStorage.setItem("SILLY_MAQUINA_BYPASS_ENABLED", enabled);

		console.log("🤖 SillyMaquina - Setting salva em sessionStorage");
	} catch (error) {
		console.error("🤖 SillyMaquina - Erro ao carregar settings:", error);
		sessionStorage.setItem("SILLY_MAQUINA_BYPASS_ENABLED", "false");
	}
})();
