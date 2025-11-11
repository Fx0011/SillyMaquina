// Google Forms Bypass Script
// Based on xNasuni's Google Forms Unlocker
// Integrated into SillyMaquina extension

(function () {
	"use strict";

	const kAssessmentAssistantExtensionId = "gndmhdcefbhlchkhipcnnbkcmicncehk";
	const BlacklistedEvents = [
		"mozvisibilitychange",
		"webkitvisibilitychange",
		"msvisibilitychange",
		"visibilitychange",
		"pagehide",
	];

	let isEnabled = false;
	let fakeIsLocked = false;
	let oldSendMessage = null;
	let oldAddEventListener = null;

	function matchExtensionId(extensionId) {
		return extensionId === kAssessmentAssistantExtensionId;
	}

	function interceptCommand(payload, callback) {
		console.log("[SillyMaquina Forms Bypass] Intercepted command:", payload);

		switch (payload.command) {
			case "isLocked":
				callback({ locked: fakeIsLocked });
				return true;
			case "lock":
				fakeIsLocked = false; // Always pretend we're unlocked
				callback({ locked: fakeIsLocked });
				return true;
			case "unlock":
				fakeIsLocked = false;
				callback({ locked: fakeIsLocked });
				return true;
		}

		return false;
	}

	function setupBypass() {
		// Store original functions
		if (!oldSendMessage && window.chrome && window.chrome.runtime) {
			oldSendMessage = window.chrome.runtime.sendMessage;
		}
		if (!oldAddEventListener) {
			oldAddEventListener = document.addEventListener;
		}

		// Intercept chrome.runtime.sendMessage
		if (window.chrome && window.chrome.runtime) {
			window.chrome.runtime.sendMessage = function () {
				const extensionId = arguments[0];
				const payload = arguments[1];
				const callback = arguments[2];

				if (matchExtensionId(extensionId)) {
					const intercepted = interceptCommand(payload, callback);
					if (intercepted) {
						console.log("[SillyMaquina Forms Bypass] Command intercepted and handled");
						return null;
					}
				}

				// Call original sendMessage for non-intercepted calls
				if (oldSendMessage) {
					return oldSendMessage(extensionId, payload, function () {
						if (window.chrome.runtime.lastError) {
							console.warn("[SillyMaquina Forms Bypass] Runtime error:", window.chrome.runtime.lastError);
						}
						if (callback) {
							callback.apply(this, arguments);
						}
					});
				}
			};
		}

		// Override document visibility properties
		try {
			Object.defineProperty(document, "hidden", {
				value: false,
				writable: false,
				configurable: true,
			});
			Object.defineProperty(document, "visibilityState", {
				value: "visible",
				writable: false,
				configurable: true,
			});
			Object.defineProperty(document, "webkitVisibilityState", {
				value: "visible",
				writable: false,
				configurable: true,
			});
			Object.defineProperty(document, "mozVisibilityState", {
				value: "visible",
				writable: false,
				configurable: true,
			});
			Object.defineProperty(document, "msVisibilityState", {
				value: "visible",
				writable: false,
				configurable: true,
			});
		} catch (e) {
			console.warn("[SillyMaquina Forms Bypass] Could not override visibility properties:", e);
		}

		// Block visibility change event listeners
		document.addEventListener = function () {
			const eventType = arguments[0];
			const method = arguments[1];
			const options = arguments[2];

			if (BlacklistedEvents.indexOf(eventType) !== -1) {
				console.log(`[SillyMaquina Forms Bypass] Blocked ${eventType} event from being registered`);
				return;
			}

			return oldAddEventListener.apply(this, arguments);
		};

		console.log("[SillyMaquina Forms Bypass] Bypass activated for Google Forms locked mode");
	}

	function disableBypass() {
		// Restore original functions if they were saved
		if (oldSendMessage && window.chrome && window.chrome.runtime) {
			window.chrome.runtime.sendMessage = oldSendMessage;
		}
		if (oldAddEventListener) {
			document.addEventListener = oldAddEventListener;
		}

		console.log("[SillyMaquina Forms Bypass] Bypass disabled");
	}

	// Check if we're on a Google Forms page
	function isGoogleFormsPage() {
		return window.location.hostname === "docs.google.com" && window.location.pathname.includes("/forms/");
	}

	// Initialize bypass based on settings
	async function initializeBypass() {
		if (!isGoogleFormsPage()) {
			return;
		}

		try {
			const result = await chrome.storage.local.get("settings");
			const settings = result.settings || {};

			if (settings.formsLockedModeBypass === true) {
				isEnabled = true;
				setupBypass();
				console.log("[SillyMaquina Forms Bypass] Enabled on Google Forms page");
			} else {
				console.log("[SillyMaquina Forms Bypass] Disabled in settings");
			}
		} catch (error) {
			console.error("[SillyMaquina Forms Bypass] Error loading settings:", error);
		}
	}

	// Listen for settings changes
	chrome.storage.onChanged.addListener((changes, areaName) => {
		if (areaName === "local" && changes.settings) {
			const newSettings = changes.settings.newValue || {};
			const bypassEnabled = newSettings.formsLockedModeBypass === true;

			if (isGoogleFormsPage()) {
				if (bypassEnabled && !isEnabled) {
					isEnabled = true;
					setupBypass();
					console.log("[SillyMaquina Forms Bypass] Enabled via settings change");
				} else if (!bypassEnabled && isEnabled) {
					isEnabled = false;
					disableBypass();
				}
			}
		}
	});

	// Initialize when page loads
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initializeBypass);
	} else {
		initializeBypass();
	}
})();
