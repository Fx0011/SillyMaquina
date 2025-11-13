// Google Forms Locked Mode Bypass
// Based on https://github.com/xNasuni/google-forms-unlocker
// Runs in MAIN world via manifest.json "world": "MAIN"

console.log("Google Forms Unlocker - Running in MAIN world");

// Check if bypass is enabled via data attribute set by forms-bypass-init.js
const bypassEnabled = document.documentElement.getAttribute("data-gfu-enabled") === "true";
console.log("Google Forms Unlocker - Bypass enabled:", bypassEnabled);

if (!bypassEnabled) {
	console.log("Google Forms bypass is disabled in settings - exiting");
	throw new Error("Google Forms bypass disabled");
}

const kAssessmentAssistantExtensionId = "gndmhdcefbhlchkhipcnnbkcmicncehk";
const ERROR_USER_AGENT = "_useragenterror";
const ERROR_UNKNOWN = "_unknown";

var shouldSpoof = location.hash === "#gfu";

window.chrome = window.chrome || {};
window.chrome.runtime = window.chrome.runtime || {};
window.chrome.runtime.sendMessage =
	window.chrome.runtime.sendMessage ||
	function (extId, payload, callback) {
		window.chrome.runtime.lastError = 1;
		callback();
	};

const oldSendMessage = window.chrome.runtime.sendMessage;

const style = document.createElement("style");
style.textContent =
	".gfu-red { font-family: monospace; text-align: center; font-size: 11px; padding-top: 24px; color: red !important; } .EbMsme { transition: filter cubic-bezier(0.4, 0, 0.2, 1) 0.3s; filter: blur(8px) !important; } .EbMsme:hover { filter: blur(0px) !important; }";
if (document.head) {
	document.head.appendChild(style);
}

function ButtonAction() {
	location.hash = "gfu";
	location.reload();
}

function MatchExtensionId(ExtensionId) {
	return ExtensionId === kAssessmentAssistantExtensionId;
}

function GetGoogleForm() {
	const Containers = document.querySelectorAll("div.RGiwf");
	var Form;
	for (const Container of Containers) {
		for (const Child of Container.childNodes) {
			if (Child.nodeName == "FORM") {
				Form = Child;
			}
		}
	}
	return Form;
}

function GetQuizHeader() {
	return document.querySelector("div.mGzJpd");
}

function PageIsErrored() {
	const QuizHeader = GetQuizHeader();
	if (QuizHeader === null) {
		return false;
	}
	const ChildNodes = QuizHeader.childNodes;
	if (
		ChildNodes[3]?.getAttribute("aria-live") === "assertive" &&
		ChildNodes[4]?.getAttribute("aria-live") === "assertive"
	) {
		return { title: ChildNodes[3].innerText, description: ChildNodes[4].innerText };
	}
	return false;
}

function MatchErrorType(error) {
	if (
		error.title === "You can't access this quiz." &&
		error.description ===
			"Locked mode is on. Only respondents using managed Chromebooks can open this quiz. Learn more"
	) {
		return ERROR_USER_AGENT;
	}
	return ERROR_UNKNOWN;
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
	Button.setAttribute("mia-gfu-state", "custom-button");
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
	return {
		destroy: function () {
			Button.remove();
		},
	};
}

async function IsOnChromebook() {
	return new Promise((resolve, _reject) => {
		oldSendMessage(kAssessmentAssistantExtensionId, { command: "isLocked" }, function (_response) {
			if (window.chrome.runtime.lastError) {
				resolve(false);
			}
			resolve(true);
		});
	});
}

async function Initialize() {
	const Errored = PageIsErrored();
	if (Errored !== false) {
		switch (MatchErrorType(Errored)) {
			case ERROR_USER_AGENT:
				const QuizHeader = GetQuizHeader();
				const Error = document.createElement("div");
				Error.classList.value = "gfu-red";
				QuizHeader.appendChild(Error);
				const ErrorSpan = document.createElement("span");
				ErrorSpan.innerText = "Google Forms Unlocker - In order to continue, you need a User Agent Spoofer. ";
				Error.appendChild(ErrorSpan);
				const AnchorSpan = document.createElement("a");
				AnchorSpan.classList.value = "gfu-red";
				AnchorSpan.innerText = "Install one here.";
				AnchorSpan.target = "_blank";
				AnchorSpan.rel = "noopener";
				AnchorSpan.href =
					"https://github.com/xNasuni/google-forms-unlocker/blob/main/README.md#spoofing-your-user-agent";
				ErrorSpan.appendChild(AnchorSpan);
				break;
			default:
				console.warn("Unhandled error type: " + JSON.stringify(Errored));
		}
		return;
	}
	const Form = GetGoogleForm();
	if (Form === undefined) {
		return false;
	}
	const IsRealManagedChromebook = await IsOnChromebook();
	if (IsRealManagedChromebook === false) {
		const ButtonHolder = Form.childNodes[2];
		for (const Button of ButtonHolder.childNodes) {
			if (Button.getAttribute("mia-gfu-state") === "custom-button") {
				continue;
			}
			Button.style.backgroundColor = "#ccc";
			Button.setAttribute("jsaction", "");
		}
	}
	MakeButton("Bypass", ButtonAction, "#ff90bf");
}

var fakeIsLocked = shouldSpoof;
function InterceptCommand(Payload, Callback) {
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
				console.warn(
					"Google Forms Unlocker - Runtime error: " + JSON.stringify(window.chrome.runtime.lastError)
				);
				return;
			}
			Callback.apply(this, arguments);
		});
	};
});

document.addEventListener("DOMContentLoaded", () => {
	console.log("Google Forms Unlocker - Initialized");
	Initialize();
});

Object.defineProperty(document, "hidden", { value: false, writable: false, configurable: true });
Object.defineProperty(document, "visibilityState", { value: "visible", writable: false, configurable: true });
Object.defineProperty(document, "webkitVisibilityState", { value: "visible", writable: false, configurable: true });
Object.defineProperty(document, "mozVisibilityState", { value: "visible", writable: false, configurable: true });
Object.defineProperty(document, "msVisibilityState", { value: "visible", writable: false, configurable: true });

const BlacklistedEvents = ["mozvisibilitychange", "webkitvisibilitychange", "msvisibilitychange", "visibilitychange"];
const oldAddEventListener = document.addEventListener;
document.addEventListener = function () {
	const EventType = arguments[0];
	if (BlacklistedEvents.indexOf(EventType) !== -1) {
		console.log("Google Forms Unlocker - Blocked event type " + EventType);
		return;
	}
	return oldAddEventListener.apply(this, arguments);
};
