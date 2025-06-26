(async () => {
	if (window.sillyMaquinaInjected) {
		return;
	}

	const session = await chrome.runtime.sendMessage({ type: "IS_LOGGED_IN" });
	if (!session || !session.loggedIn) {
		return;
	}

	window.sillyMaquinaInjected = true;

	let floatingIcon = null;
	let originalTitle = document.title;
	let cooldownInterval = null;

	let isProcessing = false;
	let isOnCooldown = false;
	let shortcutConfig = null;

	let aiResponseForTitle = null;
	let aiResponseDisplayUntil = 0;

	window.addEventListener("load", () => {
		originalTitle = document.title;
	});

	function parseShortcut(shortcutString) {
		if (!shortcutString || typeof shortcutString !== "string") {
			shortcutString = "Alt+X";
		}
		const parts = shortcutString.split("+");
		const key = parts.pop().toUpperCase();
		const alt = parts.includes("Alt");
		const ctrl = parts.includes("Ctrl");
		const shift = parts.includes("Shift");
		return { alt, ctrl, shift, key };
	}

	async function loadShortcutConfig() {
		const { config } = await chrome.storage.sync.get("config");
		shortcutConfig = parseShortcut(config?.shortcut);
	}

	function injectCSS() {
		if (!document.querySelector('link[href*="fontawesome"]')) {
			const faLink = document.createElement("link");
			faLink.rel = "stylesheet";
			faLink.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css";
			faLink.integrity =
				"sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==";
			faLink.crossOrigin = "anonymous";
			faLink.referrerPolicy = "no-referrer";
			document.head.appendChild(faLink);
		}
		const customLink = document.createElement("link");
		customLink.href = chrome.runtime.getURL("content/content_style.css");
		customLink.type = "text/css";
		customLink.rel = "stylesheet";
		document.head.appendChild(customLink);
	}

	function handleIconVisibility(config) {
		const shouldHide = config?.appearance?.hideIcon;
		if (shouldHide) {
			if (floatingIcon) {
				floatingIcon.remove();
				floatingIcon = null;
			}
		} else {
			if (!floatingIcon && !document.getElementById("silly-maquina-float-icon")) {
				createFloatingIcon();
			}
		}
	}

	function createFloatingIcon() {
		chrome.storage.sync.get("config", ({ config }) => {
			if (chrome.runtime.lastError || config?.appearance?.hideIcon) {
				return;
			}
			if (document.getElementById("silly-maquina-float-icon")) return;

			floatingIcon = document.createElement("div");
			floatingIcon.id = "silly-maquina-float-icon";
			const iconElement = document.createElement("i");
			iconElement.className = config?.appearance?.iconClass || "fas fa-robot";
			floatingIcon.appendChild(iconElement);
			Object.assign(floatingIcon.style, {
				opacity: config?.appearance?.iconOpacity || "1",
				width: `${config?.appearance?.iconSize || 50}px`,
				height: `${config?.appearance?.iconSize || 50}px`,
				fontSize: `${(config?.appearance?.iconSize || 50) * 0.45}px`,
			});

			floatingIcon.addEventListener("click", initiateCapture);
			document.body.appendChild(floatingIcon);
		});
	}

	function initiateCapture() {
		if (isOnCooldown || isProcessing) {
			return;
		}
		isProcessing = true;
		isOnCooldown = true;
		originalTitle = document.title;
		aiResponseForTitle = null;
		aiResponseDisplayUntil = 0;

		if (floatingIcon) {
			floatingIcon.classList.add("processing");
		} else {
			document.title = "Analisando... | " + originalTitle;
		}

		startCooldown(35);

		chrome.runtime.sendMessage({
			type: "CAPTURE_SCREEN",
			payload: { mode: "inteira" },
		});
	}

	function startCooldown(durationInSeconds) {
		if (cooldownInterval) clearInterval(cooldownInterval);

		const cooldownStartTime = Date.now();

		const tick = () => {
			const elapsedMs = Date.now() - cooldownStartTime;
			const timeLeftSec = Math.ceil((durationInSeconds * 1000 - elapsedMs) / 1000);

			if (timeLeftSec <= 0) {
				clearInterval(cooldownInterval);
				cooldownInterval = null;
				isOnCooldown = false;
				document.title = originalTitle;
				if (floatingIcon) {
					floatingIcon.classList.remove("on-cooldown");
					const iconElement = floatingIcon.querySelector("i");
					chrome.storage.sync.get("config", ({ config }) => {
						if (chrome.runtime.lastError) return;
						iconElement.className = config?.appearance?.iconClass || "fas fa-robot";
						iconElement.textContent = "";
					});
				}
				return;
			}

			if (floatingIcon) {
				const iconElement = floatingIcon.querySelector("i");
				if (!floatingIcon.classList.contains("on-cooldown")) {
					floatingIcon.classList.add("on-cooldown");
				}
				iconElement.className = "cooldown-text";
				iconElement.textContent = `${timeLeftSec}s`;
			}

			chrome.storage.sync.get("config", ({ config }) => {
				if (!config?.appearance?.hideIcon) return;

				if (aiResponseForTitle && Date.now() < aiResponseDisplayUntil) {
					document.title = aiResponseForTitle;
				} else {
					if (isProcessing) {
						document.title = "Analisando... | " + originalTitle;
					} else if (config.appearance.cooldownInTitle) {
						document.title = `[${timeLeftSec}s] ${originalTitle}`;
					} else {
						if (document.title !== originalTitle) {
							document.title = originalTitle;
						}
					}
				}
			});
		};

		cooldownInterval = setInterval(tick, 1000);
		tick();
	}

	function displayResult(payload) {
		isProcessing = false;
		if (floatingIcon) {
			floatingIcon.classList.remove("processing");
		}

		if (!payload || !payload.text) {
			return;
		}

		saveToHistory(payload);

		chrome.storage.sync.get("config", ({ config }) => {
			const displayMode = config?.displayMode || "popup";
			const revertDelay = (config?.titleRevertDelay || 5) * 1000;

			if (config?.appearance?.hideIcon) {
				aiResponseForTitle = payload.text;
				aiResponseDisplayUntil = Date.now() + revertDelay;
			} else {
				if (displayMode === "titulo") {
					document.title = payload.text;
					if (revertDelay > 0) {
						setTimeout(() => {
							if (!isOnCooldown) {
								document.title = originalTitle;
							}
						}, revertDelay);
					}
				} else {
					let resultPopup = document.getElementById("silly-maquina-result-popup");
					if (resultPopup) resultPopup.remove();

					resultPopup = document.createElement("div");
					resultPopup.id = "silly-maquina-result-popup";
					resultPopup.style.opacity = config?.appearance?.popupOpacity || "1";

					const textContent = document.createElement("span");
					textContent.className = "popup-text-content";
					textContent.textContent = payload.text;

					const copyButton = document.createElement("button");
					copyButton.className = "popup-copy-button";
					copyButton.innerHTML = '<i class="far fa-copy"></i>';
					copyButton.addEventListener("click", (e) => {
						e.stopPropagation();
						navigator.clipboard.writeText(payload.text).then(() => {
							copyButton.innerHTML = '<i class="fas fa-check"></i>';
							setTimeout(() => (copyButton.innerHTML = '<i class="far fa-copy"></i>'), 1500);
						});
					});

					resultPopup.appendChild(textContent);
					resultPopup.appendChild(copyButton);

					resultPopup.addEventListener("click", () => resultPopup.remove());
					document.body.appendChild(resultPopup);
				}
			}
		});
	}

	document.addEventListener("keydown", (e) => {
		if (!shortcutConfig) return;
		if (
			e.altKey === shortcutConfig.alt &&
			e.ctrlKey === shortcutConfig.ctrl &&
			e.shiftKey === shortcutConfig.shift &&
			e.key.toUpperCase() === shortcutConfig.key
		) {
			e.preventDefault();
			initiateCapture();
		}
	});

	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message.type === "DISPLAY_RESULT") {
			displayResult(message.payload);
		}
	});

	chrome.storage.onChanged.addListener((changes, namespace) => {
		if (namespace === "sync" && changes.config) {
			const newConfig = changes.config.newValue;
			shortcutConfig = parseShortcut(newConfig?.shortcut);
			handleIconVisibility(newConfig);
		}
	});

	async function saveToHistory(payload) {
		const { captureHistory = [] } = await chrome.storage.local.get("captureHistory");
		const { config } = await chrome.storage.sync.get("config");
		const historySize = config?.historySize || 50;
		const newEntry = {
			id: Date.now(),
			image: payload.image,
			text: payload.text,
			date: new Date().toISOString(),
			isFavorite: false,
			tags: [],
		};
		const newHistory = [newEntry, ...captureHistory].slice(0, historySize);
		await chrome.storage.local.set({ captureHistory: newHistory });
	}

	injectCSS();
	createFloatingIcon();
	loadShortcutConfig();
})();
