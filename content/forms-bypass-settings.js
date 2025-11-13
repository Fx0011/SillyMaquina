// This script runs in ISOLATED world and can access chrome.storage
// It injects settings into the page's localStorage for MAIN world to access

(async () => {
	try {
		const settings = await chrome.storage.local.get(null);
		console.log("🤖 SillyMaquina - Settings carregadas:", settings);

		// Inject into page's localStorage
		const script = document.createElement("script");
		script.textContent = `
			window.SILLY_MAQUINA_SETTINGS = ${JSON.stringify(settings)};
			console.log("🤖 SillyMaquina - Settings injetadas no MAIN world:", window.SILLY_MAQUINA_SETTINGS);
		`;
		(document.head || document.documentElement).appendChild(script);
		script.remove();

		console.log("🤖 SillyMaquina - Settings injetadas com sucesso");
	} catch (error) {
		console.error("🤖 SillyMaquina - Erro ao carregar settings:", error);
	}
})();
