try {
	importScripts("./common/api.js");
} catch (e) {
	console.error(e);
}

const DEFAULT_CONFIG = {
	captureMode: "inteira",
	displayMode: "popup",
	titleRevertDelay: 5,
	fixedCoords: null,
	historySize: 50,
	appearance: {
		iconClass: "",
		iconSize: 50,
		iconOpacity: 1.0,
		popupOpacity: 1.0,
	},
	shortcut: "Alt+X",
};

const showNotification = (title, message, type = "basic") => {
	chrome.notifications.create({
		type: type,
		iconUrl: "icons/icon128.png",
		title: title,
		message: message,
		priority: 2,
	});
};

const validPlanTypes = ["MENSAL", "ANUAL", "ADMIN"];

async function performLogin(userId, password) {
	try {
		const data = await api.loginUser(userId, password);

		if (data.user && validPlanTypes.includes(data.user.plan.type)) {
			if (data.user.extensionConfigs) {
				const localConfig = transformServerConfigToLocal(data.user.extensionConfigs);
				await chrome.storage.sync.set({ config: localConfig });
			}

			await chrome.storage.local.set({ token: data.token, user: data.user });
			await chrome.alarms.create("session-check", { periodInMinutes: 15 });
			return { success: true, user: data.user };
		} else {
			return { success: false, error: "Acesso negado. Sua conta não tem um plano ativo ou é inválida." };
		}
	} catch (error) {
		return { success: false, error: error.message || "Falha no login." };
	}
}

function transformServerConfigToLocal(serverConfigs) {
	const localConfig = { ...DEFAULT_CONFIG };

	if (!serverConfigs) return localConfig;

	if (serverConfigs.captureMode && serverConfigs.captureMode.type) {
		localConfig.captureMode = serverConfigs.captureMode.type;
	}

	if (serverConfigs.exhibitionMode && serverConfigs.exhibitionMode.type) {
		localConfig.displayMode = serverConfigs.exhibitionMode.type;
		if (serverConfigs.exhibitionMode.extraData && serverConfigs.exhibitionMode.extraData.length > 0) {
			localConfig.titleRevertDelay = serverConfigs.exhibitionMode.extraData[0];
		}
	}

	if (typeof serverConfigs.temperature !== "undefined") {
		localConfig.temperature = parseFloat(serverConfigs.temperature);
	}
	if (serverConfigs.historySize) {
		localConfig.historySize = serverConfigs.historySize;
	}

	if (serverConfigs.selectedModel) {
		localConfig.selectedModel = serverConfigs.selectedModel;
	}

	if (serverConfigs.appearance) {
		localConfig.appearance = { ...localConfig.appearance, ...serverConfigs.appearance };
	}

	if (serverConfigs.shortcut) {
		localConfig.shortcut = serverConfigs.shortcut;
	}

	return localConfig;
}

async function performLogout() {
	try {
		const { token } = await chrome.storage.local.get("token");
		if (token) {
			await api.logoutUser(token);
		}
	} catch (error) {
		console.warn("Server logout failed, clearing local data anyway.", error.message);
	} finally {
		await chrome.storage.local.clear();
		await chrome.alarms.clear("session-check");
		showNotification("Sessão Encerrada", "Você foi desconectado com sucesso.");
	}
}

async function checkSession() {
	const { token } = await chrome.storage.local.get("token");
	if (!token) {
		await chrome.alarms.clear("session-check");
		return;
	}
	try {
		const freshUserData = await api.fetchUserData(token);
		await chrome.storage.local.set({ user: freshUserData });
	} catch (error) {
		if (error.code === "TOKEN_EXPIRED" || error.message.includes("401") || error.message.includes("403")) {
			console.log("Session expired or invalid. Logging out.");
			await performLogout();
		}
	}
}

function blobToDataURL(blob) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

chrome.runtime.onInstalled.addListener(async (details) => {
	if (details.reason === "install") {
		await chrome.storage.sync.set({ config: DEFAULT_CONFIG });
		chrome.runtime.openOptionsPage();
	}
});

chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === "session-check") {
		checkSession();
	}
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	let isResponseAsync = true;

	switch (message.type) {
		case "LOGIN":
			performLogin(message.payload.userId, message.payload.password).then(sendResponse);
			break;

		case "VERSION_CHECK":
			api.versionCheck()
				.then((data) => sendResponse({ success: true, ...data }))
				.catch((error) => sendResponse({ success: false, error: error.message }));
			break;

		case "LOGOUT":
			performLogout().then(sendResponse);
			break;

		case "GET_SESSION":
			chrome.storage.local.get(["token", "user"]).then(sendResponse);
			break;

		case "IS_LOGGED_IN":
			chrome.storage.local.get("token").then(({ token }) => {
				sendResponse({ loggedIn: !!token });
			});
			break;

		case "GET_FRESH_USER_DATA":
			(async () => {
				const { token } = await chrome.storage.local.get("token");
				if (!token) {
					sendResponse({ success: false, error: "Not authenticated" });
					return;
				}
				try {
					const freshUser = await api.fetchUserData(token);
					await chrome.storage.local.set({ user: freshUser });
					sendResponse({ success: true, user: freshUser });
				} catch (error) {
					sendResponse({ success: false, error: error.message });
				}
			})();
			break;

			case "SAVE_USER_SETTINGS":
				(async () => {
					try {
						const { token } = await chrome.storage.local.get("token");
						if (!token) {
							return sendResponse({ success: false, error: "Usuário não autenticado." });
						}
	
						await api.saveUserSettings(token, message.payload.extensionConfigs);
	
						const freshUser = await api.fetchUserData(token);
	
						if (freshUser.extensionConfigs) {
							const localConfig = transformServerConfigToLocal(freshUser.extensionConfigs);
							await chrome.storage.sync.set({ config: localConfig });
						}
	
						await chrome.storage.local.set({ user: freshUser });
	
						sendResponse({ success: true });
					} catch (err) {
						console.error("Failed to save user settings:", err);
						sendResponse({ success: false, error: err.message });
					}
				})();
				break;
	

		case "CAPTURE_SCREEN":
			(async () => {
				try {
					const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
					const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });

					const { token } = await chrome.storage.local.get("token");
					if (!token) throw new Error("Usuário não autenticado.");

					let imageBlob;
					if (message.payload.mode === "fixo" || message.payload.mode === "selecao") {
						imageBlob = await cropImage(dataUrl, message.payload.coords);
					} else {
						const res = await fetch(dataUrl);
						imageBlob = await res.blob();
					}

					const [result, imageDataUrl] = await Promise.all([
						api.generateAiResponse(token, imageBlob),
						blobToDataURL(imageBlob),
					]);

					const freshUser = await api.fetchUserData(token);
					await chrome.storage.local.set({ user: freshUser });

					await chrome.tabs.sendMessage(tab.id, {
						type: "DISPLAY_RESULT",
						payload: {
							text: result.text,
							image: imageDataUrl,
						},
					});
					sendResponse({ success: true });
				} catch (error) {
					console.error("Capture/Process Error:", error);
					showNotification("Erro na IA", error.message);
					const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
					if (tab) {
						chrome.tabs
							.sendMessage(tab.id, { type: "DISPLAY_RESULT", payload: { text: "", image: null } })
							.catch(() => {});
					}
					sendResponse({ success: false, error: error.message });
				}
			})();
			break;

		default:
			isResponseAsync = false;
			break;
	}

	return isResponseAsync;
});
