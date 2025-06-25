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

	let shortcutConfig = null;

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

	function createFloatingIcon() {
		if (document.getElementById("silly-maquina-float-icon")) return;

		floatingIcon = document.createElement("div");
		floatingIcon.id = "silly-maquina-float-icon";

		const iconElement = document.createElement("i");
		iconElement.className = "fas fa-robot";
		floatingIcon.appendChild(iconElement);

		chrome.storage.sync.get("config", ({ config }) => {
			if (chrome.runtime.lastError) {
				console.log("Context invalidated while creating icon. Aborting style apply.");
				return;
			}

			if (config && config.appearance) {
				iconElement.className = config.appearance.iconClass || "fas fa-robot";
				floatingIcon.style.opacity = config.appearance.iconOpacity || "1";
				floatingIcon.style.width = `${config.appearance.iconSize || 50}px`;
				floatingIcon.style.height = `${config.appearance.iconSize || 50}px`;
				floatingIcon.style.fontSize = `${(config.appearance.iconSize || 50) * 0.45}px`;
			}
		});

		floatingIcon.addEventListener("click", initiateCapture);
		document.body.appendChild(floatingIcon);
	}

	function initiateCapture() {
		if (floatingIcon.classList.contains("on-cooldown") || floatingIcon.classList.contains("processing")) {
			return;
		}
		floatingIcon.classList.add("processing");
		originalTitle = document.title;
		document.title = "Analisando... | " + originalTitle;

		chrome.storage.sync.get("config", ({ config }) => {
			if (chrome.runtime.lastError) {
				console.log("Context invalidated while initiating capture. Aborting.");
				return;
			}

			const captureMode = config?.captureMode || "inteira";
			switch (captureMode) {
				case "inteira":
					chrome.runtime.sendMessage({
						type: "CAPTURE_SCREEN",
						payload: { mode: "inteira" },
					});
					break;
				default:
					chrome.runtime.sendMessage({
						type: "CAPTURE_SCREEN",
						payload: { mode: "inteira" },
					});
					break;
			}
		});
	}

	function startCooldown(durationInSeconds) {
		if (cooldownInterval) return;

		let timeLeft = durationInSeconds;
		floatingIcon.classList.add("on-cooldown");
		const iconElement = floatingIcon.querySelector("i");
		const originalIconClass = iconElement.className;

		const updateTimer = () => {
			if (timeLeft > 0) {
				iconElement.className = "cooldown-text";
				iconElement.textContent = `${timeLeft}s`;
				timeLeft--;
			} else {
				clearInterval(cooldownInterval);
				cooldownInterval = null;
				floatingIcon.classList.remove("on-cooldown");
				iconElement.className = originalIconClass;
				iconElement.textContent = "";
			}
		};

		updateTimer();
		cooldownInterval = setInterval(updateTimer, 1000);
	}

	function enterSelectionMode(onSelectionComplete) {
		if (document.getElementById("silly-maquina-selection-overlay")) return;
		if (floatingIcon) floatingIcon.style.display = "none";

		const overlay = document.createElement("div");
		overlay.id = "silly-maquina-selection-overlay";
		document.body.appendChild(overlay);

		const selectionBox = document.createElement("div");
		selectionBox.id = "silly-maquina-selection-box";

		let startX,
			startY,
			isDrawing = false;

		const onMouseDown = (e) => {
			e.preventDefault();
			isDrawing = true;
			startX = e.clientX;
			startY = e.clientY;
			selectionBox.style.left = `${startX}px`;
			selectionBox.style.top = `${startY}px`;
			selectionBox.style.width = "0px";
			selectionBox.style.height = "0px";
			overlay.appendChild(selectionBox);
		};

		const onMouseMove = (e) => {
			if (!isDrawing) return;
			const width = Math.abs(e.clientX - startX);
			const height = Math.abs(e.clientY - startY);
			const newX = Math.min(e.clientX, startX);
			const newY = Math.min(e.clientY, startY);
			selectionBox.style.left = `${newX}px`;
			selectionBox.style.top = `${newY}px`;
			selectionBox.style.width = `${width}px`;
			selectionBox.style.height = `${height}px`;
		};

		const onMouseUp = (e) => {
			if (!isDrawing) return;
			isDrawing = false;
			document.body.removeChild(overlay);
			if (floatingIcon) floatingIcon.style.display = "flex";

			const rect = selectionBox.getBoundingClientRect();
			if (rect.width > 10 && rect.height > 10) {
				if (typeof onSelectionComplete === "function") {
					onSelectionComplete({
						x: Math.round(rect.left),
						y: Math.round(rect.top),
						width: Math.round(rect.width),
						height: Math.round(rect.height),
					});
				}
			} else {
				if (floatingIcon) floatingIcon.classList.remove("processing");
			}
		};

		overlay.addEventListener("mousedown", onMouseDown);
		overlay.addEventListener("mousemove", onMouseMove);
		overlay.addEventListener("mouseup", onMouseUp);
	}

	function displayResult(payload) {
		floatingIcon.classList.remove("processing");
		if (document.title.startsWith("Analisando...")) {
			document.title = originalTitle;
		}

		if (!payload || !payload.text) {
			startCooldown(30);
			return;
		}

		saveToHistory(payload);

		chrome.storage.sync.get("config", ({ config }) => {
			const displayMode = config?.displayMode || "popup";
			const revertDelay = (config?.titleRevertDelay || 0) * 1000;
			const text = payload.text;

			if (displayMode === "titulo") {
				originalTitle = document.title;
				document.title = text;
				if (revertDelay > 0) {
					setTimeout(() => {
						document.title = originalTitle;
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
				textContent.textContent = text;

				const copyButton = document.createElement("button");
				copyButton.className = "popup-copy-button";
				copyButton.innerHTML = '<i class="far fa-copy"></i>';
				copyButton.title = "Copiar para a área de transferência";

				copyButton.addEventListener("click", (e) => {
					e.stopPropagation();
					navigator.clipboard.writeText(text).then(() => {
						copyButton.innerHTML = '<i class="fas fa-check"></i>';
						setTimeout(() => {
							copyButton.innerHTML = '<i class="far fa-copy"></i>';
						}, 1500);
					});
				});

				resultPopup.appendChild(textContent);
				resultPopup.appendChild(copyButton);

				resultPopup.addEventListener("click", () => resultPopup.remove());
				document.body.appendChild(resultPopup);
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
		} else if (message.type === "ENTER_FIXED_POS_MODE") {
			const setFixedPosCallback = (coords) => {
				chrome.runtime.sendMessage({
					type: "FIXED_POS_DEFINED",
					payload: { coords: coords },
				});
			};
			enterSelectionMode(setFixedPosCallback);
		}
	});

	chrome.storage.onChanged.addListener((changes, namespace) => {
		if (namespace === "sync" && changes.config) {
			shortcutConfig = parseShortcut(changes.config.newValue?.shortcut);
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
