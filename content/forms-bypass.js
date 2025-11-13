// Google Forms Bypass Script
// Based on xNasuni's Google Forms Unlocker v1.7
// Integrated into SillyMaquina extension

(function () {
	"use strict";

	const kAssessmentAssistantExtensionId = "gndmhdcefbhlchkhipcnnbkcmicncehk";
	const BlacklistedEvents = [
		"mozvisibilitychange",
		"webkitvisibilitychange",
		"msvisibilitychange",
		"visibilitychange",
	];

	let bypassEnabled = false;
	// Use URL hash to persist shouldSpoof across reloads (like original script)
	let shouldSpoof = location.hash === "#sillymaquina-bypass";
	let oldSendMessage = window.chrome?.runtime?.sendMessage;
	const oldAddEventListener = document.addEventListener;

	// Check if bypass is enabled in settings
	async function checkBypassSettings() {
		try {
			const result = await chrome.storage.local.get("settings");
			const settings = result.settings || {};
			return settings.formsLockedModeBypass === true;
		} catch (error) {
			console.error("[SillyMaquina Forms Bypass] Error loading settings:", error);
			return false;
		}
	}

	function MatchExtensionId(ExtensionId) {
		return ExtensionId === kAssessmentAssistantExtensionId;
	}

	function GetGoogleForm() {
		const Containers = document.querySelectorAll("div.RGiwf");
		let Form;

		for (const Container of Containers) {
			for (const Child of Container.childNodes) {
				if (Child.nodeName === "FORM") {
					Form = Child;
				}
			}
		}

		return Form;
	}

	function ButtonAction() {
		// Set hash and reload (persists shouldSpoof across reload)
		location.hash = "sillymaquina-bypass";
		console.log("[SillyMaquina Forms Bypass] Bypass button clicked, reloading with bypass active");
		location.reload();
	}

	function MakeButton(Text, Callback, Color) {
		const Form = GetGoogleForm();
		if (Form === undefined) {
			return false;
		}

		const ButtonHolder = Form.childNodes[2];

		const Button = document.createElement("div");
		Button.classList.value = "uArJ5e UQuaGc Y5sE8d TIHcue QvWxOd";
		Button.style.marginLeft = "10px";
		Button.style.backgroundColor = Color;
		Button.setAttribute("role", "button");
		Button.setAttribute("tabindex", ButtonHolder.childNodes.length);
		Button.setAttribute("sillymaquina-bypass-button", "true");
		ButtonHolder.appendChild(Button);

		const Glow = document.createElement("div");
		Glow.classList.value = "Fvio9d MbhUzd";
		Glow.style.top = "21px";
		Glow.style.left = "9px";
		Glow.style.width = "110px";
		Glow.style.height = "110px";
		Button.appendChild(Glow);

		const TextContainer = document.createElement("span");
		TextContainer.classList.value = "l4V7wb Fxmcue";
		Button.appendChild(TextContainer);

		const TextSpan = document.createElement("span");
		TextSpan.classList.value = "NPEfkd RveJvd snByac";
		TextSpan.innerText = Text;
		TextContainer.appendChild(TextSpan);

		Button.addEventListener("click", Callback);

		console.log("[SillyMaquina Forms Bypass] Bypass button added to form");
		return {
			destroy: function () {
				Button.remove();
			},
		};
	}

	async function Initialize() {
		console.log("[SillyMaquina Forms Bypass] Initializing...");

		const Form = GetGoogleForm();
		if (Form === undefined) {
			console.log("[SillyMaquina Forms Bypass] Form not found yet, will retry");
			return false;
		}

		// Only add button if bypass is not yet active (no hash)
		if (!shouldSpoof) {
			MakeButton("Desbloquear", ButtonAction, "#667eea");
		} else {
			console.log("[SillyMaquina Forms Bypass] Bypass already active via hash, skipping button");
		}

		return true;
	}

	// fakeIsLocked starts as shouldSpoof value
	var fakeIsLocked = shouldSpoof;
	function InterceptCommand(Payload, Callback) {
		console.log("[SillyMaquina Forms Bypass] Intercepted:", Payload.command);

		switch (Payload.command) {
			case "isLocked":
				Callback({ locked: fakeIsLocked });
				return true;
			case "lock":
				if (shouldSpoof) {
					return false;
				}
				fakeIsLocked = false;
				Callback({ locked: fakeIsLocked });
				return true;
			case "unlock":
				fakeIsLocked = false;
				Callback({ locked: fakeIsLocked });
				return true;
		}

		return false;
	}

	// Set up continuous interception (this is the key to making it work)
	function setupContinuousInterception() {
		setInterval(() => {
			window.chrome.runtime.sendMessage = function () {
				const ExtensionId = arguments[0];
				const Payload = arguments[1];
				const Callback = arguments[2];

				if (MatchExtensionId(ExtensionId)) {
					const Intercepted = InterceptCommand(Payload, Callback);
					if (Intercepted) {
						return null;
					}
				}

				return oldSendMessage(ExtensionId, Payload, function () {
					if (window.chrome.runtime.lastError) {
						console.warn("[SillyMaquina Forms Bypass] Runtime error:", window.chrome.runtime.lastError);
						return;
					}
					if (Callback) {
						Callback.apply(this, arguments);
					}
				});
			};
		}, 0);

		console.log("[SillyMaquina Forms Bypass] Continuous interception activated");
	}

	// Set up visibility property overrides
	Object.defineProperty(document, "hidden", {
		value: false,
		writable: false,
	});
	Object.defineProperty(document, "visibilityState", {
		value: "visible",
		writable: false,
	});
	Object.defineProperty(document, "webkitVisibilityState", {
		value: "visible",
		writable: false,
	});
	Object.defineProperty(document, "mozVisibilityState", {
		value: "visible",
		writable: false,
	});
	Object.defineProperty(document, "msVisibilityState", {
		value: "visible",
		writable: false,
	});

	// Block visibility change event listeners
	document.addEventListener = function () {
		const EventType = arguments[0];
		const Method = arguments[1];
		const Options = arguments[2];

		if (BlacklistedEvents.indexOf(EventType) !== -1) {
			console.log(`[SillyMaquina Forms Bypass] Blocked ${EventType} event from being registered`);
			return;
		}

		return oldAddEventListener.apply(this, arguments);
	};

	// Initialize bypass when DOM is ready
	async function initializeBypass() {
		bypassEnabled = await checkBypassSettings();

		if (!bypassEnabled) {
			console.log("[SillyMaquina Forms Bypass] Disabled in settings");
			return;
		}

		console.log("[SillyMaquina Forms Bypass] Enabled in settings");
		
		// Log if bypass is active via hash
		if (shouldSpoof) {
			console.log("[SillyMaquina Forms Bypass] Bypass active via URL hash");
		}

		// Wait 1 second for slow Chromebooks
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// ALWAYS set up the interception (whether button clicked or not)
		setupContinuousInterception();

		// Try to add button, retry if form not ready
		let attempts = 0;
		const maxAttempts = 30;

		const tryInitialize = async () => {
			attempts++;
			const success = await Initialize();

			if (!success && attempts < maxAttempts) {
				console.log(`[SillyMaquina Forms Bypass] Retry attempt ${attempts}/${maxAttempts}`);
				setTimeout(tryInitialize, 1000);
			} else if (success) {
				console.log("[SillyMaquina Forms Bypass] Initialization complete");
			} else {
				console.log("[SillyMaquina Forms Bypass] Max attempts reached");
			}
		};

		tryInitialize();
	}

	// Listen for settings changes
	chrome.storage.onChanged.addListener((changes, areaName) => {
		if (areaName === "local" && changes.settings) {
			const newSettings = changes.settings.newValue || {};
			const newBypassEnabled = newSettings.formsLockedModeBypass === true;

			if (newBypassEnabled !== bypassEnabled) {
				console.log(
					`[SillyMaquina Forms Bypass] Settings changed, bypass is now ${
						newBypassEnabled ? "enabled" : "disabled"
					}`
				);
				location.reload();
			}
		}
	});

	// Start initialization
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initializeBypass);
	} else {
		initializeBypass();
	}
})();
