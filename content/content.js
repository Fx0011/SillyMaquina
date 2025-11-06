let settings = null;
let user = null;
let config = null;
let isProcessing = false;
let cooldownInterval = null;
let currentButton = null;
let originalTitle = "";
let titleTimeout = null;
let lastModelSwitchTime = 0;
let cooldownTitleInterval = null;
let titleState = "normal";
let titleLock = false;
let extensionContextValid = true;
let pageTitleStorage = {};

function checkExtensionContext() {
	try {
		if (!chrome.runtime?.id) {
			extensionContextValid = false;
			return false;
		}
		return true;
	} catch (error) {
		extensionContextValid = false;
		return false;
	}
}

async function safeSendMessage(message) {
	if (!checkExtensionContext()) {
		throw new Error("Extension foi atualizada. Por favor, recarregue a página.");
	}

	try {
		return await chrome.runtime.sendMessage(message);
	} catch (error) {
		if (error.message.includes("Extension context invalidated")) {
			extensionContextValid = false;
			throw new Error("Extension foi atualizada. Por favor, recarregue a página.");
		}
		throw error;
	}
}

function injectFontAwesome() {
	if (document.querySelector('link[href*="fontawesome"]')) {
		return;
	}

	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = chrome.runtime.getURL("lib/fontawesome-free-6.5.1-web/css/all.min.css");
	document.head.appendChild(link);
}

(async function init() {
	injectFontAwesome();
	await loadData();

	if (await isAuthenticated()) {
		createFloatingButton();
		setupKeybinds();
		setupSPANavigationListener();

		chrome.runtime.onMessage.addListener(handleMessage);

		window.sillyMaquinaSettings = settings;
	}

	removeFooterOnTargetSite();
})();

function setupSPANavigationListener() {
	let lastUrl = location.href;

	chrome.storage.local.get(["pageTitleStorage"]).then((result) => {
		if (result.pageTitleStorage) {
			pageTitleStorage = result.pageTitleStorage;
		} else {
			pageTitleStorage = {};
		}
	});

	const originalPushState = history.pushState;
	const originalReplaceState = history.replaceState;

	history.pushState = function (...args) {
		originalPushState.apply(this, args);
		handleUrlChange();
	};

	history.replaceState = function (...args) {
		originalReplaceState.apply(this, args);
		handleUrlChange();
	};

	window.addEventListener("popstate", handleUrlChange);

	setInterval(() => {
		if (location.href !== lastUrl) {
			lastUrl = location.href;
			handleUrlChange();
		}
	}, 300);

	const titleObserver = new MutationObserver(() => {
		if (titleState !== "normal" && !titleLock) {
			return;
		}

		if (titleState === "normal") {
			const newTitle = document.title;
			if (newTitle !== originalTitle) {
				originalTitle = newTitle;
			}
		}
	});

	const titleElement = document.querySelector("title");
	if (titleElement) {
		titleObserver.observe(titleElement, {
			childList: true,
			characterData: true,
			subtree: true,
		});
	}

	function handleUrlChange() {
		lastUrl = location.href;
		const domain = getUrlKey(location.href);

		if (titleState !== "normal" || titleLock) {
			if (titleTimeout) {
				clearTimeout(titleTimeout);
				titleTimeout = null;
			}

			if (cooldownTitleInterval) {
				clearInterval(cooldownTitleInterval);
				cooldownTitleInterval = null;
			}

			titleLock = false;
			titleState = "normal";

			const savedDomainTitle = pageTitleStorage[domain];
			if (savedDomainTitle) {
				document.title = savedDomainTitle;
				originalTitle = savedDomainTitle;
			} else {
				setTimeout(() => {
					const currentTitle = document.title;

					if (
						currentTitle &&
						!currentTitle.includes("⏳") &&
						!currentTitle.includes("Analisando") &&
						!currentTitle.includes("Resposta:") &&
						!currentTitle.includes("Inválida/Insolúvel") &&
						!currentTitle.includes("Erro:")
					) {
						originalTitle = currentTitle;
						pageTitleStorage[domain] = currentTitle;
						savePageTitleStorage();
					}
				}, 300);
			}
			return;
		}

		const savedDomainTitle = pageTitleStorage[domain];
		if (savedDomainTitle) {
			document.title = savedDomainTitle;
			originalTitle = savedDomainTitle;
		} else {
			setTimeout(() => {
				const currentTitle = document.title;
				if (
					currentTitle &&
					!currentTitle.includes("⏳") &&
					!currentTitle.includes("Analisando") &&
					!currentTitle.includes("Resposta:") &&
					!currentTitle.includes("Inválida/Insolúvel") &&
					!currentTitle.includes("Erro:")
				) {
					originalTitle = currentTitle;
					pageTitleStorage[domain] = currentTitle;
					savePageTitleStorage();
				}
			}, 200);
		}
	}
}

function loadPageTitleStorage() {
	chrome.storage.local
		.get(["pageTitleStorage"])
		.then((result) => {
			if (result.pageTitleStorage) {
				pageTitleStorage = result.pageTitleStorage;
			} else {
				pageTitleStorage = {};
			}
		})
		.catch((error) => {
			console.error("Failed to load page title storage:", error);
			pageTitleStorage = {};
		});
}

function savePageTitleStorage() {
	const keys = Object.keys(pageTitleStorage);
	if (keys.length > 50) {
		const toRemove = keys.slice(0, keys.length - 50);
		toRemove.forEach((key) => delete pageTitleStorage[key]);
	}

	chrome.storage.local
		.set({ pageTitleStorage })
		.then(() => {
			console.log("Saved domain title storage to chrome.storage");
		})
		.catch((error) => {
			console.error("Failed to save domain title storage:", error);
		});
}

function getUrlKey(url) {
	try {
		const urlObj = new URL(url);
		return urlObj.origin;
	} catch {
		return url;
	}
}

function saveCurrentPageTitle() {
	const domain = getUrlKey(location.href);
	const currentTitle = document.title;

	if (!currentTitle.includes("⏳") && !currentTitle.includes("Analisando") && titleState === "normal") {
		pageTitleStorage[domain] = currentTitle;
		originalTitle = currentTitle;
		savePageTitleStorage();
		console.log("Saved domain title:", currentTitle, "for", domain);
	}
}

function removeFooterOnTargetSite() {
	if (window.location.href.startsWith("https://exams-sesi-avaliacao-2022.didatti.net.br/")) {
		const removeFooter = () => {
			try {
				const footer = document.querySelector(".footer");
				if (footer) {
					footer.remove();
				}
			} catch (error) {
				console.error("Error removing footer:", error);
			}
		};

		removeFooter();

		const observer = new MutationObserver(() => {
			const footer = document.querySelector(".footer");
			if (footer) {
				removeFooter();
			}
		});

		if (document.body) {
			observer.observe(document.body, {
				childList: true,
				subtree: true,
			});
		} else {
			document.addEventListener("DOMContentLoaded", () => {
				removeFooter();
				observer.observe(document.body, {
					childList: true,
					subtree: true,
				});
			});
		}
	}
}

async function loadData() {
	const data = await chrome.storage.local.get(["settings", "user", "config"]);

	if (data.user && data.user.configurationSettings) {
		settings = mergeWithDefaults(data.user.configurationSettings);
	} else if (data.settings) {
		settings = mergeWithDefaults(data.settings);
	} else {
		settings = getDefaultSettings();
	}

	user = data.user;
	config = data.config;

	if (!user || !config) {
		console.warn("User or config not loaded yet");
	}

	await chrome.storage.local.set({ settings });

	if (typeof window !== "undefined") {
		window.sillyMaquinaSettings = settings;
	}

	console.log("Settings loaded:", {
		keybindProEnabled: settings.keybindProEnabled,
		keybindPro: settings.keybindPro,
		keybindSimple: settings.keybindSimple,
	});
}

function mergeWithDefaults(userSettings) {
	const defaults = getDefaultSettings();
	const merged = { ...defaults, ...userSettings };

	return merged;
}

async function isAuthenticated() {
	try {
		const response = await safeSendMessage({ action: "checkAuth" });
		return response.isAuthenticated;
	} catch (error) {
		console.error("Auth check failed:", error);
		return false;
	}
}

function handleMessage(message, sender, sendResponse) {
	switch (message.action) {
		case "triggerCapture":
			captureAndProcess();
			break;
		case "switchModel":
			switchModel();
			break;
		case "captureFullPage":
			captureFullPage().then(sendResponse);
			return true;
		case "reloadSettings":
			loadData().then(() => {
				if (currentButton) {
					createFloatingButton();
				}
				setupKeybinds();
			});
			break;
		case "forceLogout":
			if (currentButton) {
				currentButton.remove();
				currentButton = null;
			}
			displayError("Sessão expirada. Recarregue a página e faça login novamente.");
			break;
	}
}

function createFloatingButton() {
	if (!settings || settings.buttonPosition === "hidden") return;

	const existing = document.getElementById("sillymaquina-button");
	if (existing) existing.remove();

	const button = document.createElement("div");
	button.id = "sillymaquina-button";
	button.className = "sillymaquina-button idle";
	button.innerHTML = `<i class="${settings.buttonIcon || "fa-solid fa-robot"}"></i>`;

	button.style.width = `${settings.buttonSize}px`;
	button.style.height = `${settings.buttonSize}px`;
	button.style.fontSize = `${settings.buttonSize * 0.5}px`;
	button.style.opacity = settings.buttonOpacity;

	if (settings.buttonPosition === "bottomRight") {
		button.style.bottom = "20px";
		button.style.right = "20px";
	} else if (settings.buttonPosition === "bottomLeft") {
		button.style.bottom = "20px";
		button.style.left = "20px";
	}

	let clickTimer = null;
	let clickCount = 0;

	button.addEventListener("click", async () => {
		clickCount++;

		if (clickCount === 1) {
			clickTimer = setTimeout(async () => {
				if (settings.buttonSingleClick && clickCount === 1) {
					if (isProcessing || titleLock || titleState === "answer" || titleState === "analyzing") {
						return;
					}

					try {
						const response = await safeSendMessage({ action: "getCooldownStatus" });
						if (response && response.success) {
							const { canRequest, waitTime } = response.cooldown;
							if (!canRequest && waitTime > 0) {
								return;
							}
						}
					} catch (error) {
						console.error("Failed to check cooldown on button click:", error);
					}

					captureAndProcess();
				}
				clickCount = 0;
			}, 300);
		} else if (clickCount === 2) {
			clearTimeout(clickTimer);
			if (settings.buttonDoubleClick) {
				switchModel();
			}
			clickCount = 0;
		}
	});

	if (settings.buttonTooltip) {
		let tooltipTimeout;

		button.addEventListener("mouseenter", () => {
			tooltipTimeout = setTimeout(() => {
				showTooltip(button);
			}, 500);
		});

		button.addEventListener("mouseleave", () => {
			clearTimeout(tooltipTimeout);
			hideTooltip();
		});
	}

	document.body.appendChild(button);
	currentButton = button;

	updateButtonState();
}

function updateButtonState() {
	if (!currentButton) return;

	if (!checkExtensionContext()) {
		if (currentButton) {
			currentButton.className = "sillymaquina-button error";
			currentButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
			currentButton.title = "Extension precisa ser recarregada";
		}
		return;
	}

	safeSendMessage({ action: "getCooldownStatus" })
		.then((response) => {
			if (response && response.success) {
				const { canRequest, waitTime } = response.cooldown;

				if (isProcessing) {
					currentButton.className = "sillymaquina-button processing";
					currentButton.innerHTML = '<i class="fas fa-spinner"></i>';

					if (
						titleState === "cooldown" ||
						titleState === "analyzing" ||
						titleState === "answer" ||
						titleLock
					) {
						if (cooldownInterval) {
							clearInterval(cooldownInterval);
							cooldownInterval = null;
						}
					}
				} else if (!canRequest && waitTime > 0) {
					currentButton.className = "sillymaquina-button cooldown";
					currentButton.textContent = waitTime;

					if (
						settings.answerExhibitionMode === "pageTitle" &&
						settings.titleCooldownDisplay &&
						titleState !== "answer" &&
						titleState !== "analyzing" &&
						!titleLock
					) {
						showCooldownInTitle(waitTime);
					}

					if (cooldownInterval) clearInterval(cooldownInterval);
					cooldownInterval = setInterval(() => {
						updateButtonState();
					}, 1000);
				} else {
					if (titleState !== "answer" && titleState !== "analyzing" && !titleLock) {
						currentButton.className = "sillymaquina-button idle";
						currentButton.innerHTML = `<i class="${settings.buttonIcon || "fa-solid fa-robot"}"></i>`;

						if (titleState === "cooldown") {
							restoreOriginalTitle();
						}

						if (cooldownInterval) {
							clearInterval(cooldownInterval);
							cooldownInterval = null;
						}
					} else {
						if (!cooldownInterval) {
							cooldownInterval = setInterval(() => {
								updateButtonState();
							}, 1000);
						}
					}
				}
			}
		})
		.catch((error) => {
			console.error("Failed to get cooldown status:", error);
		});
}

function showCooldownInTitle(initialWaitTime) {
	if (titleState === "answer" || titleLock) {
		return;
	}

	if (!originalTitle || titleState === "normal") {
		const key = getUrlKey(location.href);
		originalTitle = pageTitleStorage[key] || document.title;
	}

	if (cooldownTitleInterval) {
		clearInterval(cooldownTitleInterval);
	}

	titleState = "cooldown";
	let remainingTime = initialWaitTime;

	document.title = `⏳ ${remainingTime}s | ${originalTitle}`;

	cooldownTitleInterval = setInterval(() => {
		remainingTime--;
		if (remainingTime > 0 && !titleLock) {
			document.title = `⏳ ${remainingTime}s | ${originalTitle}`;
		} else {
			clearInterval(cooldownTitleInterval);
			cooldownTitleInterval = null;
			if (!titleLock) {
				restoreOriginalTitle();
			}
		}
	}, 1000);
}

function restoreOriginalTitle() {
	if (titleState === "answer" || titleState === "analyzing" || titleLock) {
		return;
	}

	if (cooldownTitleInterval) {
		clearInterval(cooldownTitleInterval);
		cooldownTitleInterval = null;
	}

	if (titleTimeout) {
		clearTimeout(titleTimeout);
		titleTimeout = null;
	}

	const key = getUrlKey(location.href);
	const storedTitle = pageTitleStorage[key] || originalTitle;

	if (storedTitle && document.title !== storedTitle) {
		document.title = storedTitle;
		originalTitle = storedTitle;
		titleState = "normal";
	}
}

function showTooltip(button) {
	hideTooltip();

	chrome.storage.local.get(["user", "config", "settings"], (data) => {
		const freshUser = data.user;
		const freshConfig = data.config;
		const freshSettings = data.settings || settings;

		if (!freshUser || !freshConfig) return;

		const tooltip = document.createElement("div");
		tooltip.id = "sillymaquina-tooltip";
		tooltip.className = "sillymaquina-tooltip";

		const planConfig = freshConfig.plans[freshUser.plan.id];
		if (!planConfig) return;

		const remaining = freshUser.tokens.remaining;
		const total = planConfig.weeklyTokenAllocation;
		const percentage = (remaining / total) * 100;

		const modelConfig = freshConfig.models[freshSettings.selectedModel];
		if (!modelConfig) return;

		tooltip.innerHTML = `
	    <div class="tooltip-label">Tokens Restantes</div>
	    <div class="tooltip-value">${formatNumber(remaining)} / ${formatNumber(total)}</div>
	    <div class="tokens-bar-mini">
	      <div class="tokens-progress-mini" style="width: ${percentage}%"></div>
	    </div>
	    <div class="model-info">
	      <div>
	        <div class="tooltip-label">Modelo Atual</div>
	        <div class="tooltip-value">${modelConfig.name}</div>
	      </div>
	      <div class="model-cost">
	        <i class="fas fa-coins"></i> ${formatNumber(modelConfig.tokenCost)}
	      </div>
	    </div>
	  `;

		document.body.appendChild(tooltip);

		function updateTooltipPosition() {
			const rect = button.getBoundingClientRect();
			const buttonPos = settings.buttonPosition;
			const tooltipHeight = tooltip.offsetHeight;
			const spaceAbove = rect.top;

			if (buttonPos === "bottomRight") {
				tooltip.style.right = `${window.innerWidth - rect.right}px`;
				if (spaceAbove > tooltipHeight + 10) {
					tooltip.style.bottom = `${window.innerHeight - rect.top + 10}px`;
					tooltip.style.top = "auto";
				} else {
					tooltip.style.top = `${rect.bottom + 10}px`;
					tooltip.style.bottom = "auto";
				}
			} else if (buttonPos === "bottomLeft") {
				tooltip.style.left = `${rect.left}px`;
				if (spaceAbove > tooltipHeight + 10) {
					tooltip.style.bottom = `${window.innerHeight - rect.top + 10}px`;
					tooltip.style.top = "auto";
				} else {
					tooltip.style.top = `${rect.bottom + 10}px`;
					tooltip.style.bottom = "auto";
				}
			}
		}

		tooltip._updatePosition = updateTooltipPosition;
		updateTooltipPosition();

		window.addEventListener("scroll", updateTooltipPosition, { passive: true });
		window.addEventListener("resize", updateTooltipPosition, { passive: true });

		setTimeout(() => {
			tooltip.classList.add("show");
		}, 10);
	});
}

function hideTooltip() {
	const tooltip = document.getElementById("sillymaquina-tooltip");
	if (tooltip) {
		if (tooltip._updatePosition) {
			window.removeEventListener("scroll", tooltip._updatePosition);
			window.removeEventListener("resize", tooltip._updatePosition);
		}
		tooltip.remove();
	}
}

function setupKeybinds() {
	if (window._keybindHandler) {
		document.removeEventListener("keydown", window._keybindHandler);
	}
	if (window._mouseClickHandler) {
		document.removeEventListener("mousedown", window._mouseClickHandler, true);
	}
	if (window._auxClickHandler) {
		document.removeEventListener("auxclick", window._auxClickHandler, true);
	}

	window._keybindHandler = (e) => {
		let captureKeybind = settings.keybindProEnabled ? settings.keybindPro : settings.keybindSimple;

		if (checkKeybind(e, captureKeybind)) {
			e.preventDefault();
			captureAndProcess();
		}

		if (settings.keybindModelSwitch && checkKeybind(e, settings.keybindModelSwitch)) {
			const now = Date.now();
			if (now - lastModelSwitchTime >= 1000) {
				e.preventDefault();
				switchModel();
				lastModelSwitchTime = now;
			}
		}

		if (settings.keybindCaptureModeSwitch && checkKeybind(e, settings.keybindCaptureModeSwitch)) {
			e.preventDefault();
			switchCaptureMode();
		}
	};

	window._mouseClickHandler = (e) => {
		if (settings?.keybindProEnabled && settings.keybindPro === "MiddleMouse") {
			return;
		}
	};

	document.addEventListener("keydown", window._keybindHandler);

	document.addEventListener("mousedown", window._mouseClickHandler, true);

	if (window._auxClickHandler) {
		document.removeEventListener("auxclick", window._auxClickHandler, true);
	}
	window._auxClickHandler = (e) => {
		if (e.button === 1) {
			if (settings && settings.keybindProEnabled && settings.keybindPro === "MiddleMouse") {
				e.preventDefault();
				e.stopPropagation();
				captureAndProcess();
				return false;
			} else {
				console.log("Middle mouse clicked but not configured for capture");
			}
		}
	};
	document.addEventListener("auxclick", window._auxClickHandler, true);
}

function checkKeybind(event, keybind) {
	if (!keybind) return false;

	if (keybind.includes("+")) {
		const parts = keybind.split("+");
		const modifiers = parts.slice(0, -1);
		const key = parts[parts.length - 1];

		let modifiersMatch = true;

		if (modifiers.includes("Ctrl") && !event.ctrlKey) modifiersMatch = false;
		if (modifiers.includes("Alt") && !event.altKey) modifiersMatch = false;
		if (modifiers.includes("Shift") && !event.shiftKey) modifiersMatch = false;

		let eventKey = event.key;
		if (eventKey === " ") eventKey = "Space";
		if (eventKey.length === 1) eventKey = eventKey.toUpperCase();

		return modifiersMatch && eventKey.toLowerCase() === key.toLowerCase();
	} else {
		if (settings.keybindProEnabled) {
			const specialKeys = [
				"ArrowUp",
				"ArrowDown",
				"ArrowLeft",
				"ArrowRight",
				"F1",
				"F2",
				"F3",
				"F4",
				"F5",
				"F6",
				"F7",
				"F8",
				"F9",
				"F10",
				"F11",
				"F12",
				"Enter",
				"Space",
				"Tab",
				"Escape",
				"Backspace",
				"Delete",
				"Home",
				"End",
				"PageUp",
				"PageDown",
				"Insert",
				"Pause",
				"Print",
			];

			if (specialKeys.includes(event.key)) {
				return event.key === keybind && !event.ctrlKey && !event.altKey && !event.shiftKey;
			}

			return (
				event.key.toLowerCase() === keybind.toLowerCase() && !event.ctrlKey && !event.altKey && !event.shiftKey
			);
		}

		return event.key.toLowerCase() === keybind.toLowerCase() && !event.ctrlKey && !event.altKey && !event.shiftKey;
	}
}

async function captureAndProcess() {
	if (isProcessing) {
		console.log("Already processing, blocking request");
		return;
	}

	if (titleLock || titleState === "answer" || titleState === "analyzing") {
		console.log("Still showing answer or analyzing, blocking request");
		return;
	}

	if (!checkExtensionContext()) {
		displayError("Extension foi atualizada. Por favor, recarregue a página.");
		return;
	}

	try {
		const maintenanceResponse = await safeSendMessage({ action: "checkMaintenance" });
		if (maintenanceResponse && maintenanceResponse.isUnderMaintenance) {
			const message = maintenanceResponse.active?.title || "Sistema em manutenção";
			displayError(`${message}. Tente novamente mais tarde.`);
			return;
		}
	} catch (error) {
		console.error("Failed to check maintenance status:", error);
	}

	try {
		const cooldownResponse = await safeSendMessage({ action: "getCooldownStatus" });
		if (cooldownResponse && cooldownResponse.success) {
			const { canRequest, waitTime, cooldownSeconds } = cooldownResponse.cooldown;

			if (!canRequest && waitTime > 0) {
				console.warn(`Still in cooldown: ${waitTime}s remaining (total: ${cooldownSeconds}s)`);
				console.warn(`Blocking request in content.js BEFORE sending to background.js`);
				displayError(`⏳ Aguarde ${waitTime}s antes de fazer nova solicitação`);
				return;
			}

			console.log(`Cooldown passed, proceeding with request`);
		}
	} catch (error) {
		console.error("Failed to check cooldown status:", error);
	}

	isProcessing = true;
	updateButtonState();

	saveCurrentPageTitle();

	if (settings.answerExhibitionMode === "pageTitle" && settings.titleShowAnalyzing) {
		setPageTitle("Analisando...", null, "analyzing");
	}

	try {
		const captureResponse = await safeSendMessage({
			action: "captureScreen",
		});

		if (!captureResponse.success) {
			throw new Error(captureResponse.error);
		}

		const processResponse = await safeSendMessage({
			action: "processImage",
			imageData: captureResponse.screenshot,
			modelId: settings.selectedModel,
		});

		if (!processResponse.success) {
			throw new Error(processResponse.error);
		}

		console.log("API request successful, about to load data and display answer");
		await loadData();

		displayAnswer(processResponse.result);

		if (currentButton) {
			currentButton.className = "sillymaquina-button success";
			setTimeout(() => {
				updateButtonState();
			}, 1000);
		}

		// Reset processing flag on success
		isProcessing = false;
	} catch (error) {
		console.error("Capture/Process error:", error);

		isProcessing = false;
		updateButtonState();

		let errorMessage = error.message;
		if (
			error.message &&
			(error.message.includes("Limite de requisições excedido") ||
				(error.message.includes("Aguarde") && error.message.includes("segundos")))
		) {
			const waitMatch = error.message.match(/(\d+)\s*segundo/);
			const waitTime = waitMatch ? waitMatch[1] : "120";
			errorMessage = `⏳ Aguarde ${waitTime}s antes de fazer nova solicitação`;
			console.warn(`Rate limited by server: ${waitTime}s`);
		}

		displayError(errorMessage);

		if (currentButton) {
			currentButton.className = "sillymaquina-button error";
			setTimeout(() => {
				updateButtonState();
			}, 1000);
		}
	}
}

async function captureFullPage() {
	return new Promise(async (resolve) => {
		try {
			//const hiddenElements = hidePageHeaders();

			const fullPageCanvas = await html2canvas(document.documentElement, {
				allowTaint: true,
				useCORS: true,
				backgroundColor: "#ffffff",
				scale: 1,
				logging: false,
				imageTimeout: 5000,
			});

			//restorePageHeaders(hiddenElements);

			const stitchedScreenshot = fullPageCanvas.toDataURL("image/png");

			resolve({
				success: true,
				screenshot: stitchedScreenshot,
				mode: "total",
			});
		} catch (error) {
			console.error("Full page capture error:", error);
			resolve({
				success: false,
				error: error.message,
			});
		}
	});
}

function hidePageHeaders() {
	const hiddenElements = [];

	const headerSelectors = [
		"header",
		".header",
		"#header",
		".navbar",
		".nav",
		"nav",
		".top-bar",
		".topbar",
		"[role='banner']",
		"[role='navigation']",
	];

	const allElements = document.querySelectorAll("*");

	for (const selector of headerSelectors) {
		const elements = document.querySelectorAll(selector);
		elements.forEach((el) => {
			const rect = el.getBoundingClientRect();
			const style = window.getComputedStyle(el);

			if (
				(style.position === "fixed" || style.position === "sticky") &&
				rect.top < 200 &&
				el.offsetHeight > 0 &&
				(style.display !== "none" || style.visibility !== "hidden")
			) {
				hiddenElements.push({
					element: el,
					display: el.style.display,
					visibility: el.style.visibility,
				});
				el.style.display = "none";
				console.log(`Hiding header element: ${el.tagName}.${el.className}`);
			}
		});
	}

	allElements.forEach((el) => {
		const classStr = el.className.toString().toLowerCase();
		const idStr = el.id.toString().toLowerCase();

		if ((classStr.includes("header") || idStr.includes("header")) && el.offsetHeight > 0) {
			const rect = el.getBoundingClientRect();

			if (rect.top < 300) {
				const style = window.getComputedStyle(el);

				if (
					(style.position === "fixed" || style.position === "sticky") &&
					(style.display !== "none" || style.visibility !== "hidden")
				) {
					hiddenElements.push({
						element: el,
						display: el.style.display,
						visibility: el.style.visibility,
					});
					el.style.display = "none";
					console.log(`Hiding header element: ${el.tagName}#${el.id}.${el.className}`);
				}
			}
		}
	});

	return hiddenElements;
}

function restorePageHeaders(hiddenElements) {
	hiddenElements.forEach(({ element, display, visibility }) => {
		element.style.display = display;
		element.style.visibility = visibility;
		console.log(`Restored header element: ${element.tagName}`);
	});
}

function displayAnswer(answer) {
	if (settings.answerExhibitionMode === "smallPopup") {
		showPopupAnswer(answer);
	} else {
		showTitleAnswer(answer);
	}
}

function showPopupAnswer(answer) {
	const popup = document.createElement("div");
	popup.className = "sillymaquina-popup";

	popup.style.width = `${settings.popupSize}px`;
	popup.style.opacity = settings.popupOpacity;

	if (settings.buttonPosition === "bottomRight") {
		popup.style.bottom = "80px";
		popup.style.right = "20px";
	} else if (settings.buttonPosition === "bottomLeft") {
		popup.style.bottom = "80px";
		popup.style.left = "20px";
	} else {
		popup.style.top = "20px";
		popup.style.right = "20px";
	}

	popup.innerHTML = `
    <div class="popup-header">
      <div class="popup-title">Resposta</div>
      <div class="popup-close"><i class="fas fa-times"></i></div>
    </div>
    <div class="popup-content">${answer}</div>
    <div class="popup-footer">Clique para fechar</div>
  `;

	popup.addEventListener("click", () => {
		if (popup.parentNode) {
			popup.remove();
			updateButtonState();
		}
	});

	const closeBtn = popup.querySelector(".popup-close");
	if (closeBtn) {
		closeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			if (popup.parentNode) {
				popup.remove();
				updateButtonState();
			}
		});
	}

	document.body.appendChild(popup);

	if (settings.popupDuration > 0) {
		setTimeout(() => {
			if (popup.parentNode) {
				popup.remove();
				updateButtonState();
			}
		}, settings.popupDuration * 1000);
	}
}

function showTitleAnswer(answer) {
	setPageTitle(answer, settings.titleAnswerDuration, "answer");
}

function setPageTitle(text, duration = null, state = "normal") {
	if (titleLock && state !== "answer") {
		return;
	}

	if (cooldownTitleInterval) {
		clearInterval(cooldownTitleInterval);
		cooldownTitleInterval = null;
	}

	if (titleTimeout) {
		clearTimeout(titleTimeout);
		titleTimeout = null;
	}

	if (!originalTitle || titleState === "normal") {
		originalTitle = document.title;

		const key = getUrlKey(location.href);
		if (!pageTitleStorage[key]) {
			pageTitleStorage[key] = originalTitle;
			savePageTitleStorage();
		}
	}

	titleState = state;
	titleLock = state === "answer";

	document.title = text;

	if (duration) {
		titleTimeout = setTimeout(async () => {
			titleLock = false;
			titleState = "normal";

			if (checkExtensionContext()) {
				try {
					const response = await safeSendMessage({ action: "getCooldownStatus" });
					if (response && response.success) {
						const { canRequest, waitTime } = response.cooldown;

						if (!canRequest && waitTime > 0 && settings.titleCooldownDisplay) {
							showCooldownInTitle(waitTime);
						} else {
							const key = getUrlKey(location.href);
							const storedTitle = pageTitleStorage[key] || originalTitle;
							if (storedTitle && document.title !== storedTitle) {
								document.title = storedTitle;
							}
							titleState = "normal";
						}
					} else {
						const key = getUrlKey(location.href);
						const storedTitle = pageTitleStorage[key] || originalTitle;
						if (storedTitle && document.title !== storedTitle) {
							document.title = storedTitle;
						}
						titleState = "normal";
					}
				} catch (error) {
					console.error("Failed to get cooldown status:", error);

					const key = getUrlKey(location.href);
					const storedTitle = pageTitleStorage[key] || originalTitle;
					if (storedTitle && document.title !== storedTitle) {
						document.title = storedTitle;
					}
					titleState = "normal";
				}
			} else {
				const key = getUrlKey(location.href);
				const storedTitle = pageTitleStorage[key] || originalTitle;
				if (storedTitle && document.title !== storedTitle) {
					document.title = storedTitle;
				}
				titleState = "normal";
			}
		}, duration * 1000);
	}
}

function displayError(error) {
	if (settings.answerExhibitionMode === "smallPopup") {
		showPopupAnswer(`Erro: ${error}`);
	} else {
		setPageTitle(`Erro: ${error}`, 5, "error");
	}
}

function showAnalyzingOverlay() {
	if (document.getElementById("sillymaquina-analyzing")) return;

	const overlay = document.createElement("div");
	overlay.id = "sillymaquina-analyzing";
	overlay.className = "sillymaquina-analyzing";
	overlay.innerHTML = '<i class="fas fa-spinner"></i> Analisando...';
	document.body.appendChild(overlay);
}

function hideAnalyzingOverlay() {
	const overlay = document.getElementById("sillymaquina-analyzing");
	if (overlay) overlay.remove();
}

async function switchModel() {
	try {
		if (!user || !config) {
			console.error("User or config not loaded");
			displayError("Dados não carregados");
			return;
		}

		const planConfig = config.plans[user.plan.id];
		if (!planConfig) {
			console.error("Plan config not found");
			displayError("Configuração do plano não encontrada");
			return;
		}

		const availableModels = planConfig.modelsAllowed || Object.keys(config.models || {});

		if (!availableModels || availableModels.length === 0) {
			console.error("No models available for user plan");
			displayError("Nenhum modelo disponível para o seu plano");
			return;
		}

		let currentIndex = availableModels.indexOf(settings.selectedModel);

		if (currentIndex === -1) {
			currentIndex = 0;
		}

		const nextIndex = (currentIndex + 1) % availableModels.length;
		const nextModel = availableModels[nextIndex];

		if (!config.models[nextModel]) {
			console.error("Model not found in config:", nextModel);
			displayError("Erro ao trocar modelo");
			return;
		}

		settings.selectedModel = nextModel;
		await chrome.storage.local.set({ settings });

		if (user.configurationSettings) {
			user.configurationSettings.selectedModel = nextModel;
			await chrome.storage.local.set({ user });
		}

		try {
			const token = await chrome.storage.local.get("token");
			const response = await fetch("https://sillymaquina.vercel.app/api/v1/users/me/configuration", {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${token.token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ selectedModel: nextModel }),
			});

			if (!response.ok) {
				if (response.status === 401) {
					await chrome.storage.local.clear();
					displayError("Sessão expirada. Recarregue a página e faça login novamente.");
					if (currentButton) {
						currentButton.remove();
						currentButton = null;
					}
					return;
				}
				throw new Error("Failed to update model on server");
			}
		} catch (error) {
			console.error("Failed to update model on server:", error);
		}

		const modelConfig = config.models[nextModel];
		showModelSwitchNotification(modelConfig.name);

		if (currentButton) {
			createFloatingButton();
		}
	} catch (error) {
		console.error("Model switch error:", error);
		displayError("Erro ao trocar modelo");
	}
}

function showModelSwitchNotification(modelName) {
	if (document.querySelector(".sillymaquina-model-switch")) return;

	const notification = document.createElement("div");
	notification.className = "sillymaquina-model-switch";
	notification.innerHTML = `<i class="fas fa-exchange-alt"></i> Modelo: ${modelName}`;
	document.body.appendChild(notification);

	setTimeout(
		() => {
			if (notification.parentNode) {
				notification.remove();
			}
		},
		settings.answerExhibitionMode === "pageTitle" ? 500 : 2000
	);
}

async function switchCaptureMode() {
	try {
		if (!user || (user.plan.id !== "pro" && user.plan.id !== "admin")) {
			displayError("Trocar modo de captura está disponível apenas para usuários Pro");
			return;
		}

		const newMode = settings.screenCaptureMode === "padrão" ? "total" : "padrão";

		settings.screenCaptureMode = newMode;
		await chrome.storage.local.set({ settings });

		if (user.configurationSettings) {
			user.configurationSettings.screenCaptureMode = newMode;
			await chrome.storage.local.set({ user });
		}

		try {
			const token = await chrome.storage.local.get("token");
			const response = await fetch("https://sillymaquina.vercel.app/api/v1/users/me/configuration", {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${token.token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ screenCaptureMode: newMode }),
			});

			if (!response.ok) {
				if (response.status === 401) {
					await chrome.storage.local.clear();
					displayError("Sessão expirada. Recarregue a página e faça login novamente.");
					if (currentButton) {
						currentButton.remove();
						currentButton = null;
					}
					return;
				}
				throw new Error("Failed to update capture mode on server");
			}
		} catch (error) {
			console.error("Failed to update capture mode on server:", error);
		}

		showCaptureModeNotification(newMode);
	} catch (error) {
		console.error("Capture mode switch error:", error);
		displayError("Erro ao trocar modo de captura");
	}
}

function showCaptureModeNotification(modeName) {
	if (document.querySelector(".sillymaquina-capture-mode")) return;

	const notification = document.createElement("div");
	notification.className = "sillymaquina-capture-mode";
	notification.innerHTML = `<i class="fas fa-camera"></i> Modo: ${modeName === "total" ? "Total" : "Padrão"}`;
	document.body.appendChild(notification);

	setTimeout(
		() => {
			if (notification.parentNode) {
				notification.remove();
			}
		},
		settings.answerExhibitionMode === "pageTitle" ? 500 : 2000
	);
}

function formatNumber(num) {
	return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function getDefaultSettings() {
	return {
		selectedModel: "gemini-2.5-flash-lite",
		temperature: 0.9,
		screenCaptureMode: "padrão",
		keybindSimple: "Alt+X",
		keybindPro: null,
		keybindProEnabled: false,
		keybindModelSwitch: null,
		keybindCaptureModeSwitch: null,
		answerExhibitionMode: "pageTitle",
		popupSize: 300,
		popupOpacity: 0.95,
		popupDuration: 10,
		titleCooldownDisplay: true,
		titleAnswerDuration: 15,
		titleShowAnalyzing: true,
		buttonPosition: "oculto",
		buttonSize: 50,
		buttonOpacity: 0.9,
		buttonIcon: "fa-solid fa-robot",
		buttonSingleClick: true,
		buttonDoubleClick: true,
		buttonTooltip: true,
		historyLimit: 15,
	};
}
