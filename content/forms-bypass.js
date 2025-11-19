// Identifier for the Google Assessment Assistant extension
const kAssessmentAssistantExtensionId = "gndmhdcefbhlchkhipcnnbkcmicncehk";
const ERROR_USER_AGENT = "_useragenterror";

// 1. USE LOCALSTORAGE INSTEAD OF HASH
// Google Forms removes hashes (#gfu) on load, causing the bypass to fail after reload.
// LocalStorage persists correctly.
var shouldSpoof = localStorage.getItem("gfu_active") === "true";

// Keep a reference to the original sender
window.chrome = window.chrome || {};
window.chrome.runtime = window.chrome.runtime || {};

// Save the original function immediately
const oldSendMessage = window.chrome.runtime.sendMessage;

// 2. OVERRIDE SENDMESSAGE
// We wrap this to intercept calls specifically to the Assessment Assistant
window.chrome.runtime.sendMessage = function () {
	const args = arguments;
	const extId = args[0];

	// If the first argument is NOT the target extension ID, pass it through immediately.
	// This fixes the "Not intercepting {action: 'checkAuth'}" error.
	if (typeof extId !== "string" || extId !== kAssessmentAssistantExtensionId) {
		return oldSendMessage.apply(this, args);
	}

	const payload = args[1];
	const callback = args[2];

	// Logic to spoof the Chromebook environment
	if (payload && payload.command) {
		// console.log("[GFU] Intercepting command:", payload.command);

		switch (payload.command) {
			case "isLocked":
				// If we are spoofing, we tell Google Forms "Yes, we are locked" (on a chromebook)
				if (callback) callback({ locked: shouldSpoof });
				return; // Stop execution here, don't send to real extension

			case "lock":
				// Google tries to lock the screen. We ignore it if spoofing.
				if (shouldSpoof) {
					// We lie and say "Okay, locked" but we don't actually do anything.
					if (callback) callback({ locked: true });
					return;
				}
				break;

			case "unlock":
				// If Google tries to unlock, we update our state
				if (callback) callback({ locked: false });
				return;
		}
	}

	// Fallback for unhandled commands to the specific extension
	return oldSendMessage.apply(this, args);
};

// --- UI HELPER FUNCTIONS ---

function ButtonAction() {
	// Enable spoofing in storage
	localStorage.setItem("gfu_active", "true");
	// Reload to apply the spoof from the very start of the page load
	location.reload();
}

function ResetAction() {
	// Disable spoofing
	localStorage.removeItem("gfu_active");
	location.reload();
}

function GetGoogleForm() {
	// Try to find the form element
	const containers = document.querySelectorAll("div.RGiwf");
	for (const container of containers) {
		for (const child of container.childNodes) {
			if (child.nodeName === "FORM") return child;
		}
	}
	return undefined;
}

function PageIsErrored() {
	// Check if the "Locked Mode is on" error screen is visible
	const quizHeader = document.querySelector("div.mGzJpd");
	if (!quizHeader) return false;

	const childNodes = quizHeader.childNodes;
	// Checking specifically for the "Locked mode is on" text structure
	if (
		childNodes.length >= 5 &&
		childNodes[3]?.getAttribute("aria-live") === "assertive" &&
		childNodes[4]?.innerText.includes("Locked mode is on")
	) {
		return ERROR_USER_AGENT;
	}
	return false;
}

function MakeButton(Text, Callback, Color, id) {
	const form = GetGoogleForm();
	if (!form) return;

	// Find the button container (usually the 3rd child)
	const buttonHolder = form.childNodes[2];
	if (!buttonHolder) return;

	// Check if button already exists
	if (document.getElementById(id)) return;

	const button = document.createElement("div");
	button.id = id;
	button.classList.value = "uArJ5e UQuaGc Y5sE8d TIHcue QvWxOd";
	button.style.marginLeft = "10px";
	button.style.backgroundColor = Color;
	button.setAttribute("role", "button");
	button.setAttribute("mia-gfu-state", "custom-button");

	// Basic Google Material styling structure
	button.innerHTML = `
        <div class="Fvio9d MbhUzd" style="top: 21px; left: 9px; width: 110px; height: 110px;"></div>
        <span class="l4V7wb Fxmcue">
            <span class="NPEfkd RveJvd snByac">${Text}</span>
        </span>
    `;

	button.addEventListener("click", Callback);
	buttonHolder.appendChild(button);
}

function Initialize() {
	// If we are currently spoofing, the page should load normally (as if on Chromebook).
	// We might want to add a "Reset" button in case the user wants to stop spoofing.
	if (shouldSpoof) {
		const form = GetGoogleForm();
		if (form) {
			MakeButton("Sair do Modo GFU", ResetAction, "#667eea", "gfu-reset-btn");
		}
		return;
	}

	// If we are NOT spoofing, check if we are on the error page
	const errorType = PageIsErrored();

	if (errorType === ERROR_USER_AGENT) {
		// We are on the error screen. We need to inject the button into the header
		// because the form body is hidden.
		const quizHeader = document.querySelector("div.mGzJpd");
		if (quizHeader && !document.getElementById("gfu-bypass-link")) {
			const container = document.createElement("div");
			container.style.marginTop = "20px";
			container.style.textAlign = "center";

			const btn = document.createElement("button");
			btn.id = "gfu-bypass-link";
			btn.innerText = "Desbloquear (SillyMaquina)";
			btn.style.padding = "10px 20px";
			btn.style.backgroundColor = "#ff90bf";
			btn.style.border = "none";
			btn.style.borderRadius = "4px";
			btn.style.color = "white";
			btn.style.cursor = "pointer";
			btn.style.fontWeight = "bold";

			btn.onclick = ButtonAction;

			container.appendChild(btn);
			quizHeader.appendChild(container);
		}
		return;
	}

	// Normal form page (but maybe not locked yet, or user is not on chromebook)
	const form = GetGoogleForm();
	if (form) {
		// Grey out native buttons if not spoofing yet
		const buttonHolder = form.childNodes[2];
		if (buttonHolder) {
			for (const btn of buttonHolder.childNodes) {
				if (btn.getAttribute("mia-gfu-state") !== "custom-button") {
					// Optional: Visual indication that native buttons might not work
					// btn.style.opacity = "0.5";
				}
			}
		}
		MakeButton("Desbloquear", ButtonAction, "#ff90bf", "gfu-activate-btn");
	}
}

// Run initialization
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", Initialize);
} else {
	Initialize();
}

// Continuous check in case the DOM changes (common in Google Forms)
setInterval(Initialize, 1000);

// Prevent visibility detection
const BlacklistedEvents = [
	"mozvisibilitychange",
	"webkitvisibilitychange",
	"msvisibilitychange",
	"visibilitychange",
	"blur",
	"focus",
];
const oldAddEventListener = document.addEventListener;
document.addEventListener = function (type, listener, options) {
	if (BlacklistedEvents.includes(type)) {
		// console.log("[GFU] Blocked event listener:", type);
		return;
	}
	return oldAddEventListener.call(this, type, listener, options);
};
