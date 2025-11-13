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
	let isBypassActive = false;
	let fakeIsLocked = false;
	let oldSendMessage = null;
	let oldAddEventListener = null;
	let setupAttempts = 0;
	const MAX_SETUP_ATTEMPTS = 30; // Try for up to 30 seconds

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

	// Check if the "Continuar" (Continue) or "Start quiz" button is visible
	function isContinueButtonVisible() {
		// Look for the continue/start button with the specific text
		const buttons = document.querySelectorAll("span.NPEfkd.RveJvd.snByac");
		for (const button of buttons) {
			const text = button.textContent.trim().toLowerCase();
			if (text === "continuar" || text === "start quiz" || text === "iniciar") {
				// Check if button is visible
				const rect = button.getBoundingClientRect();
				const isVisible =
					rect.width > 0 &&
					rect.height > 0 &&
					window.getComputedStyle(button).visibility !== "hidden" &&
					window.getComputedStyle(button).display !== "none";

				if (isVisible) {
					console.log("[SillyMaquina Forms Bypass] Continue button found and visible");
					return true;
				}
			}
		}
		return false;
	}

	// Track that bypass was activated for this form URL
	async function markFormAsProcessed() {
		const formUrl = window.location.href;
		try {
			const result = await chrome.storage.local.get("processedForms");
			const processedForms = result.processedForms || {};
			processedForms[formUrl] = {
				timestamp: Date.now(),
				activated: true,
			};
			await chrome.storage.local.set({ processedForms });
			console.log("[SillyMaquina Forms Bypass] Form marked as processed");
		} catch (error) {
			console.error("[SillyMaquina Forms Bypass] Error marking form as processed:", error);
		}
	}

	// Check if this form was already processed recently (within last hour)
	async function wasRecentlyProcessed() {
		const formUrl = window.location.href;
		try {
			const result = await chrome.storage.local.get("processedForms");
			const processedForms = result.processedForms || {};
			const formData = processedForms[formUrl];

			if (formData && formData.activated) {
				const hourAgo = Date.now() - 60 * 60 * 1000;
				if (formData.timestamp > hourAgo) {
					console.log("[SillyMaquina Forms Bypass] Form was recently processed, reactivating immediately");
					return true;
				}
			}
		} catch (error) {
			console.error("[SillyMaquina Forms Bypass] Error checking processed forms:", error);
		}
		return false;
	}
	function setupBypass() {
		if (isBypassActive) {
			console.log("[SillyMaquina Forms Bypass] Bypass already active, skipping setup");
			return;
		}

		// Store original functions
		if (!oldSendMessage && window.chrome && window.chrome.runtime) {
			oldSendMessage = window.chrome.runtime.sendMessage;
		}
		if (!oldAddEventListener) {
			oldAddEventListener = document.addEventListener;
		}

		// Use setInterval to continuously re-apply intercepts (like original script)
		// This ensures the interception stays active even if something tries to override it
		setInterval(() => {
			// Intercept chrome.runtime.sendMessage
			if (window.chrome && window.chrome.runtime) {
				window.chrome.runtime.sendMessage = function () {
					const extensionId = arguments[0];
					const payload = arguments[1];
					const callback = arguments[2];

					if (matchExtensionId(extensionId)) {
						const intercepted = interceptCommand(payload, callback);
						if (intercepted) {
							return null;
						}
					}

					// Call original sendMessage for non-intercepted calls
					if (oldSendMessage) {
						return oldSendMessage(extensionId, payload, function () {
							if (window.chrome.runtime.lastError) {
								console.warn(
									"[SillyMaquina Forms Bypass] Runtime error:",
									window.chrome.runtime.lastError
								);
							}
							if (callback) {
								callback.apply(this, arguments);
							}
						});
					}
				};
			}

			// Override document visibility properties continuously
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
				// Properties might already be defined, that's ok
			}

			// Block visibility change event listeners continuously
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
		}, 0); // Run immediately and continuously

		isBypassActive = true;
		markFormAsProcessed();
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

	// Wait for continue button and then activate bypass
	async function waitForContinueButtonAndActivate() {
		setupAttempts++;

		if (setupAttempts > MAX_SETUP_ATTEMPTS) {
			console.log("[SillyMaquina Forms Bypass] Max attempts reached, activating anyway");
			setupBypass();
			return;
		}

		// Check if button is visible or if form was recently processed
		const buttonVisible = isContinueButtonVisible();
		const recentlyProcessed = await wasRecentlyProcessed();

		if (buttonVisible || recentlyProcessed) {
			console.log(
				`[SillyMaquina Forms Bypass] ${
					buttonVisible ? "Continue button detected" : "Form recently processed"
				}, activating bypass`
			);
			setupBypass();
		} else {
			// Try again in 1 second (good for slow Chromebooks)
			console.log(
				`[SillyMaquina Forms Bypass] Continue button not visible yet, attempt ${setupAttempts}/${MAX_SETUP_ATTEMPTS}`
			);
			setTimeout(waitForContinueButtonAndActivate, 1000);
		}
	}

	// Initialize bypass based on settings
	async function initializeBypass() {
		if (!isGoogleFormsPage()) {
			return;
		}

		// Wait 1 second before doing anything (for slow Chromebooks)
		await new Promise((resolve) => setTimeout(resolve, 1000));

		try {
			const result = await chrome.storage.local.get("settings");
			const settings = result.settings || {};

			if (settings.formsLockedModeBypass === true) {
				isEnabled = true;
				console.log("[SillyMaquina Forms Bypass] Enabled in settings, waiting for form to be ready");
				waitForContinueButtonAndActivate();
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
				if (bypassEnabled && !isEnabled && !isBypassActive) {
					isEnabled = true;
					setupAttempts = 0;
					console.log("[SillyMaquina Forms Bypass] Enabled via settings change");
					waitForContinueButtonAndActivate();
				} else if (!bypassEnabled && isEnabled) {
					isEnabled = false;
					disableBypass();
				}
			}
		}
	});

	// Clean up old processed forms (older than 1 hour) on load
	async function cleanupOldProcessedForms() {
		try {
			const result = await chrome.storage.local.get("processedForms");
			const processedForms = result.processedForms || {};
			const hourAgo = Date.now() - 60 * 60 * 1000;
			let cleaned = false;

			for (const url in processedForms) {
				if (processedForms[url].timestamp < hourAgo) {
					delete processedForms[url];
					cleaned = true;
				}
			}

			if (cleaned) {
				await chrome.storage.local.set({ processedForms });
				console.log("[SillyMaquina Forms Bypass] Cleaned up old processed forms");
			}
		} catch (error) {
			console.error("[SillyMaquina Forms Bypass] Error cleaning up processed forms:", error);
		}
	}

	// Initialize when page loads
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			cleanupOldProcessedForms();
			initializeBypass();
		});
	} else {
		cleanupOldProcessedForms();
		initializeBypass();
	}
})();
