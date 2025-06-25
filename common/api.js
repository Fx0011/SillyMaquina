const api = {};

(() => {
	const SERVER_BASE_URL = "https://sillymaquina.vercel.app";

	async function apiCall(endpoint, method = "GET", token = null, body = null) {
		const headers = {
			"Content-Type": "application/json",
		};
		if (token) {
			headers["Authorization"] = `Bearer ${token}`;
		}

		const config = {
			method,
			headers,
		};

		if (body) {
			config.body = JSON.stringify(body);
		}

		try {
			const response = await fetch(`${SERVER_BASE_URL}${endpoint}`, config);
			const responseData = await response.json().catch(() => ({}));

			if (!response.ok) {
				const errorMessage = responseData.error || `Erro de Servidor: ${response.status}`;
				const errorCode = responseData.code || `HTTP_${response.status}`;
				const error = new Error(errorMessage);
				error.code = errorCode;
				throw error;
			}

			return responseData;
		} catch (error) {
			console.error(`API Call Error (${method} ${endpoint}):`, error);
			throw error;
		}
	}

	api.loginUser = (userId, password) => {
		return apiCall("/api/auth/login", "POST", null, { user: userId, password });
	};

	api.logoutUser = (token) => {
		return apiCall("/api/auth/logout", "POST", token);
	};

	api.fetchUserData = (token) => {
		return apiCall("/api/auth/user/me", "GET", token);
	};

	api.saveUserSettings = (token, settingsObject) => {
		return apiCall("/api/ai/settings", "POST", token, { extensionConfigs: settingsObject });
	};

	api.versionCheck = () => {
		return apiCall("/api/version", "GET");
	};

	api.generateAiResponse = async (token, imageBlob) => {
		const formData = new FormData();
		formData.append("image", imageBlob, "capture.png");

		const headers = {
			Authorization: `Bearer ${token}`,
		};

		try {
			const response = await fetch(`${SERVER_BASE_URL}/api/ai/generate`, {
				method: "POST",
				headers,
				body: formData,
			});

			const responseData = await response.json().catch(() => ({}));

			if (!response.ok) {
				const errorMessage = responseData.error || `Erro de Servidor: ${response.status}`;
				const errorCode = responseData.code || `HTTP_${response.status}`;
				const error = new Error(errorMessage);
				error.code = errorCode;
				throw error;
			}

			return responseData;
		} catch (error) {
			console.error("API Call Error (POST /api/ai/generate):", error);
			throw error;
		}
	};
})();
