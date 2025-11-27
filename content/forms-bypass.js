const kAssessmentAssistantExtensionId = "gndmhdcefbhlchkhipcnnbkcmicncehk";
const ERROR_USER_AGENT = "_useragenterror";

var shouldSpoof = localStorage.getItem("gfu_active") === "true";

window.chrome = window.chrome || {};
window.chrome.runtime = window.chrome.runtime || {};

const oldSendMessage = window.chrome.runtime.sendMessage;

window.chrome.runtime.sendMessage = function () {
	const args = arguments;
	const extId = args[0];

	if (typeof extId !== "string" || extId !== kAssessmentAssistantExtensionId) {
		return oldSendMessage.apply(this, args);
	}

	const payload = args[1];
	const callback = args[2];

	if (payload && payload.command) {
		switch (payload.command) {
			case "isLocked":
				if (callback) callback({ locked: shouldSpoof });
				return;

			case "lock":
				if (shouldSpoof) {
					if (callback) callback({ locked: true });
					return;
				}
				break;

			case "unlock":
				if (callback) callback({ locked: false });
				return;
		}
	}

	return oldSendMessage.apply(this, args);
};

function ButtonAction() {
	localStorage.setItem("gfu_active", "true");
	location.reload();
}

function ResetAction() {
	localStorage.removeItem("gfu_active");
	location.reload();
}

function GetGoogleForm() {
	const containers = document.querySelectorAll("div.RGiwf");
	for (const container of containers) {
		for (const child of container.childNodes) {
			if (child.nodeName === "FORM") return child;
		}
	}
	return undefined;
}

function PageIsErrored() {
	const quizHeader = document.querySelector("div.mGzJpd");
	if (!quizHeader) return false;

	const childNodes = quizHeader.childNodes;
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

	const buttonHolder = form.childNodes[2];
	if (!buttonHolder) return;

	if (document.getElementById(id)) return;

	const button = document.createElement("div");
	button.id = id;
	button.classList.value = "uArJ5e UQuaGc Y5sE8d TIHcue QvWxOd";
	button.style.marginLeft = "10px";
	button.style.backgroundColor = Color;
	button.setAttribute("role", "button");
	button.setAttribute("mia-gfu-state", "custom-button");

	const glowDiv = document.createElement("div");
	glowDiv.className = "Fvio9d MbhUzd";
	glowDiv.style.top = "21px";
	glowDiv.style.left = "9px";
	glowDiv.style.width = "110px";
	glowDiv.style.height = "110px";
	button.appendChild(glowDiv);

	const spanOuter = document.createElement("span");
	spanOuter.className = "l4V7wb Fxmcue";
	button.appendChild(spanOuter);

	const spanInner = document.createElement("span");
	spanInner.className = "NPEfkd RveJvd snByac";
	spanInner.textContent = Text;
	spanOuter.appendChild(spanInner);

	button.addEventListener("click", Callback);
	buttonHolder.appendChild(button);
}

function Initialize() {
	if (shouldSpoof) {
		const form = GetGoogleForm();
		if (form) {
			MakeButton("Sair do Modo GFU", ResetAction, "#667eea", "gfu-reset-btn");
		}
		return;
	}

	const errorType = PageIsErrored();

	if (errorType === ERROR_USER_AGENT) {
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

	const form = GetGoogleForm();
	if (form) {
		const buttonHolder = form.childNodes[2];
		if (buttonHolder) {
			for (const btn of buttonHolder.childNodes) {
				if (btn.getAttribute("mia-gfu-state") !== "custom-button") {
				}
			}
		}
		MakeButton("Desbloquear", ButtonAction, "#ff90bf", "gfu-activate-btn");
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", Initialize);
} else {
	Initialize();
}

setInterval(Initialize, 1000);

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
		return;
	}
	return oldAddEventListener.call(this, type, listener, options);
};
