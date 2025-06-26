document.addEventListener("DOMContentLoaded", () => {
	const loginView = document.getElementById("login-view");
	const loggedInView = document.getElementById("logged-in-view");
	const allViews = document.querySelectorAll(".view");
	const loginForm = document.getElementById("login-form");
	const userIdInput = document.getElementById("userId");
	const passwordInput = document.getElementById("password");
	const loginButton = document.getElementById("login-button");
	const loginError = document.getElementById("login-error");
	const versionMessageArea = document.getElementById("version-message-area");
	const popupUserName = document.getElementById("popup-user-name");
	const optionsButton = document.getElementById("options-button");
	const logoutButton = document.getElementById("logout-button");
	const btnText = loginButton.querySelector(".btn-text");
	const btnSpinner = loginButton.querySelector(".btn-spinner");

	const userAvatarIcon = loggedInView.querySelector(".user-avatar");

	const compareVersions = (v1, v2) => {
		const parts1 = v1.split(".").map(Number);
		const parts2 = v2.split(".").map(Number);
		const len = Math.max(parts1.length, parts2.length);
		for (let i = 0; i < len; i++) {
			const p1 = parts1[i] || 0;
			const p2 = parts2[i] || 0;
			if (p1 > p2) return 1;
			if (p1 < p2) return -1;
		}
		return 0;
	};

	const setLoginFormState = (enabled) => {
		userIdInput.disabled = !enabled;
		passwordInput.disabled = !enabled;
		loginButton.disabled = !enabled;
	};

	const showVersionMessage = (message, type, linkUrl = null) => {
		if (linkUrl) {
			versionMessageArea.innerHTML = `${message} <a href="${linkUrl}" target="_blank">aqui</a>.`;
		} else {
			versionMessageArea.textContent = message;
		}
		versionMessageArea.className = "message-area";
		versionMessageArea.classList.add(type, "show");
	};

	const hideVersionMessage = () => {
		versionMessageArea.textContent = "";
		versionMessageArea.classList.remove("show");
	};

	const setLoginButtonState = (isLoading) => {
		loginButton.disabled = isLoading;
		btnText.style.display = isLoading ? "none" : "inline-block";
		btnSpinner.style.display = isLoading ? "inline-block" : "none";
	};

	const showLoginError = (message) => {
		loginError.textContent = message;
		loginError.classList.add("error", "show");
	};

	const hideLoginError = () => {
		loginError.textContent = "";
		loginError.classList.remove("error", "show");
	};

	const updateView = (session) => {
		allViews.forEach((view) => (view.style.display = "none"));

		if (session && session.token && session.user) {
			loggedInView.style.display = "block";
			popupUserName.textContent = session.user.name || session.user.user;

			if (userAvatarIcon) {
				const userConfig = session.user.extensionConfigs;
				const iconClass = userConfig?.appearance?.iconClass || "fas fa-user-astronaut";
				userAvatarIcon.className = `user-avatar ${iconClass}`;
			}
		} else {
			loginView.style.display = "block";
		}
	};

	const checkSession = () => {
		window.chrome.runtime.sendMessage({ type: "GET_SESSION" }, (session) => {
			if (window.chrome.runtime.lastError) {
				console.error(window.chrome.runtime.lastError.message);
				showLoginError("Erro ao comunicar com a extensão.");
				updateView(null);
				return;
			}
			updateView(session);
		});
	};

	window.chrome.runtime.sendMessage({ type: "VERSION_CHECK" }, (response) => {
		if (!response || !response.success) {
			console.error("Version check failed:", response?.error);
			checkSession();
			return;
		}

		const { minRequiredExtensionVersion, serverVersion, extensionUpdateLink } = response;
		const extensionVersion = window.chrome.runtime.getManifest().version;

		if (compareVersions(extensionVersion, minRequiredExtensionVersion) < 0) {
			showVersionMessage(
				"Sua extensão está desatualizada e precisa ser atualizada para continuar. Baixe a nova versão",
				"error",
				extensionUpdateLink
			);
			setLoginFormState(false);
			window.chrome.runtime.sendMessage({ type: "IS_LOGGED_IN" }, ({ loggedIn }) => {
				if (loggedIn) {
					window.chrome.runtime.sendMessage({ type: "LOGOUT" }, () => updateView(null));
				} else {
					updateView(null);
				}
			});
			return;
		}

		if (compareVersions(extensionVersion, serverVersion) > 0) {
			showVersionMessage("Você está usando uma versão de desenvolvedor (Dev Build).", "success");
		} else {
			hideVersionMessage();
		}

		setLoginFormState(true);
		checkSession();
	});

	loginForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		hideLoginError();
		setLoginButtonState(true);

		const userId = userIdInput.value.trim();
		const password = passwordInput.value.trim();

		if (!userId || !password) {
			showLoginError("Por favor, preencha todos os campos.");
			setLoginButtonState(false);
			return;
		}

		try {
			const response = await window.chrome.runtime.sendMessage({
				type: "LOGIN",
				payload: { userId, password },
			});

			if (response && response.success) {
				updateView({ token: true, user: response.user });
			} else {
				showLoginError(response.error || "Falha no login. Verifique suas credenciais.");
			}
		} catch (error) {
			console.error("Login error:", error);
			showLoginError("Ocorreu um erro inesperado. Tente novamente.");
		} finally {
			setLoginButtonState(false);
		}
	});

	logoutButton.addEventListener("click", async () => {
		await window.chrome.runtime.sendMessage({ type: "LOGOUT" });
		window.location.reload();
	});

	optionsButton.addEventListener("click", () => {
		window.chrome.runtime.openOptionsPage();
	});
});
