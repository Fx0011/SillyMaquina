const API_BASE_URL = "https://sillymaquina.vercel.app/api/v1";

chrome.runtime.onInstalled.addListener((details) => {
	console.log("Extension installed/updated:", details.reason);

	if (details.reason === "install") {
		chrome.storage.local.clear();
	}
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	handleMessage(message, sender, sendResponse);
	return true;
});

async function handleMessage(message, sender, sendResponse) {
	try {
		switch (message.action) {
			case "captureScreen":
				await handleCaptureScreen(message, sender, sendResponse);
				break;

			case "captureVisibleTab":
				try {
					const screenshot = await chrome.tabs.captureVisibleTab(null, {
						format: "png",
						quality: 100,
					});
					sendResponse({ success: true, screenshot });
				} catch (error) {
					console.error("Capture visible tab error:", error);
					sendResponse({ success: false, error: error.message });
				}
				break;

			case "processImage":
				await handleProcessImage(message, sendResponse);
				break;

			case "checkAuth":
				const token = await getStorageItem("token");
				sendResponse({ success: true, isAuthenticated: !!token });
				break;

			case "getCooldownStatus":
				const cooldown = await getCooldownStatus();
				sendResponse({ success: true, cooldown });
				break;

			default:
				sendResponse({ success: false, error: "Ação desconhecida" });
		}
	} catch (error) {
		console.error("Error in background:", error);
		sendResponse({ success: false, error: error.message });
	}
}

async function handleCaptureScreen(message, sender, sendResponse) {
	try {
		const settings = (await getStorageItem("settings")) || getDefaultSettings();
		const captureMode = settings.screenCaptureMode || "padrão";

		if (captureMode === "padrão") {
			const screenshot = await chrome.tabs.captureVisibleTab(null, {
				format: "png",
				quality: 100,
			});

			sendResponse({
				success: true,
				screenshot,
				mode: "padrão",
			});
		} else {
			chrome.tabs.sendMessage(
				sender.tab.id,
				{
					action: "captureFullPage",
				},
				(response) => {
					sendResponse(response);
				}
			);
		}
	} catch (error) {
		console.error("Capture error:", error);
		sendResponse({ success: false, error: error.message });
	}
}

async function handleProcessImage(message, sendResponse) {
	try {
		const { imageData, modelId } = message;
		const token = await getStorageItem("token");
		const settings = (await getStorageItem("settings")) || getDefaultSettings();

		if (!token) {
			throw new Error("Não autenticado");
		}

		const user = await getStorageItem("user");
		const lastRequest = await getStorageItem("lastRequest");
		const cooldownSeconds = user?.rateLimiter?.cooldownSeconds || 70;

		if (lastRequest) {
			const timeSince = (Date.now() - lastRequest) / 1000;
			if (timeSince < cooldownSeconds) {
				const waitTime = Math.ceil(cooldownSeconds - timeSince);
				throw new Error(`Aguarde ${waitTime} segundos antes de fazer outra requisição`);
			}
		}

		const base64Data = imageData.split(",")[1];
		const byteCharacters = atob(base64Data);
		const byteArrays = [];

		for (let i = 0; i < byteCharacters.length; i++) {
			byteArrays.push(byteCharacters.charCodeAt(i));
		}

		const blob = new Blob([new Uint8Array(byteArrays)], { type: "image/png" });

		const formData = new FormData();
		formData.append("questionImage", blob, "screenshot.png");
		formData.append("modelId", modelId);

		if (settings.temperature !== undefined) {
			formData.append("temperature", settings.temperature);
		}

		const response = await fetch(`${API_BASE_URL}/ai/process-image`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
			},
			body: formData,
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error?.message || "Erro ao processar imagem");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let result = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			result += decoder.decode(value, { stream: true });
		}

		await setStorageItem("lastRequest", Date.now());

		await addToHistory({
			image: imageData,
			response: result,
			modelId,
			timestamp: Date.now(),
		});

		sendResponse({ success: true, result });
	} catch (error) {
		console.error("Process image error:", error);
		sendResponse({ success: false, error: error.message });
	}
}

async function getCooldownStatus() {
	const user = await getStorageItem("user");
	const lastRequest = await getStorageItem("lastRequest");
	const cooldownSeconds = user?.rateLimiter?.cooldownSeconds || 70;

	if (!lastRequest) {
		return { canRequest: true, waitTime: 0 };
	}

	const timeSince = (Date.now() - lastRequest) / 1000;
	const waitTime = Math.max(0, Math.ceil(cooldownSeconds - timeSince));

	return {
		canRequest: waitTime === 0,
		waitTime,
		cooldownSeconds,
	};
}

async function getStorageItem(key) {
	const result = await chrome.storage.local.get(key);
	return result[key];
}

async function setStorageItem(key, value) {
	return chrome.storage.local.set({ [key]: value });
}

async function addToHistory(item) {
	const settings = (await getStorageItem("settings")) || getDefaultSettings();
	const limit = settings.historyLimit || 100;

	if (limit === 0) return;

	const history = (await getStorageItem("history")) || [];
	history.unshift(item);

	const trimmed = history.slice(0, limit);
	await setStorageItem("history", trimmed);
}

function getDefaultSettings() {
	return {
		selectedModel: "gemini-2.5-flash-lite",
		temperature: 0.9,
		screenCaptureMode: "padrão",
		keybindSimple: "Alt+X",
		keybindPro: null,
		keybindProEnabled: false,
		keybindModelSwitch: "Alt+M",
		answerExhibitionMode: "pageTitle",
		popupSize: 300,
		popupOpacity: 0.95,
		popupDuration: 10,
		titleCooldownDisplay: true,
		titleAnswerDuration: 15,
		titleShowAnalyzing: true,
		buttonPosition: "bottomRight",
		buttonSize: 50,
		buttonOpacity: 0.9,
		buttonIcon: "fa-robot",
		buttonSingleClick: true,
		buttonDoubleClick: true,
		buttonTooltip: true,
		historyLimit: 100,
	};
}
