const API_BASE_URL = "https://sillymaquina.vercel.app/api/v1";
const EXTENSION_VERSION = "3.0.9";

let currentUser = null;
let currentConfig = null;
let currentTab = "dashboard";
let cachedMetrics = null;
let metricsLastFetched = null;
const METRICS_CACHE_TTL = 5 * 60 * 1000;
let maintenanceStatus = null;

//
document.addEventListener("DOMContentLoaded", async () => {
	showLoadingScreen();
	await checkMaintenanceAndAuth();
});

async function checkMaintenanceAndAuth() {
	try {
		const maintenanceResponse = await fetch(`${API_BASE_URL}/public/maintenance-status`);

		if (maintenanceResponse.ok) {
			maintenanceStatus = await maintenanceResponse.json();

			if (maintenanceStatus.isUnderMaintenance) {
				showMaintenanceScreen(maintenanceStatus.active);
				return;
			}
		}

		await checkVersionAndAuth();
	} catch (error) {
		console.error("Failed to check maintenance status:", error);
		await checkVersionAndAuth();
	}
}

async function checkVersionAndAuth() {
	try {
		const configResponse = await fetch(`${API_BASE_URL}/public/config`);

		if (!configResponse.ok) {
			throw new Error("Failed to load config from API");
		}

		const config = await configResponse.json();
		currentConfig = config;

		await chrome.storage.local.set({ config });

		const { token, user } = await chrome.storage.local.get(["token", "user"]);

		if (!token || !user) {
			console.log("Not authenticated");
			showLoginScreen();
			return;
		}

		console.log("User authenticated");

		currentUser = user;

		const { settings: storedSettings } = await chrome.storage.local.get(["settings"]);

		let finalSettings;
		if (storedSettings && Object.keys(storedSettings).length > 0) {
			finalSettings = mergeWithDefaults(storedSettings);

			if (currentUser.configurationSettings && Object.keys(currentUser.configurationSettings).length > 0) {
				finalSettings = { ...finalSettings, ...currentUser.configurationSettings };
			}
		} else if (currentUser.configurationSettings && Object.keys(currentUser.configurationSettings).length > 0) {
			finalSettings = mergeWithDefaults(currentUser.configurationSettings);
		} else {
			finalSettings = getDefaultSettings();
		}

		if (finalSettings.historyLimit > 15) {
			console.warn(`History limit (${finalSettings.historyLimit}) exceeds maximum, forcing to 15`);
			finalSettings.historyLimit = 15;
		}

		await chrome.storage.local.set({ settings: finalSettings });

		const planConfig = currentConfig.plans[user.plan.id];
		if (!planConfig) {
			console.error("Plan not found in config:", user.plan.id);
			alert(`Plano '${user.plan.id}' não encontrado na configuração. Contate o suporte.`);
			showLoginScreen();
			return;
		}

		let extensionConfig = config.extensionInfo || config.extension;

		if (extensionConfig && extensionConfig.minVersion) {
			const versionStatus = compareVersions(EXTENSION_VERSION, extensionConfig.minVersion);

			if (versionStatus === "outdated") {
				showUpdateModal(extensionConfig.updateLink);
				return;
			}

			const existingBadge = document.getElementById("testBuildBadge");
			if (existingBadge) {
				existingBadge.remove();
			}

			if (versionStatus === "test") {
				showTestBuildBadge();
			} else {
				console.log("Version is current - no badge needed");
			}
		}

		updateUserDisplay();
		showMainScreen();
	} catch (error) {
		console.error("INIT ERROR:", error);
		console.error(error.stack);
		showLoginScreen();
	}
}

function mergeWithDefaults(userSettings) {
	const defaults = getDefaultSettings();
	const merged = { ...defaults, ...userSettings };
	return merged;
}

function showTestBuildBadge() {
	const existing = document.getElementById("testBuildBadge");
	if (existing) {
		existing.remove();
	}

	const mainScreen = document.getElementById("mainScreen");
	const tokensDisplay = mainScreen.querySelector(".tokens-display");

	const badge = document.createElement("div");
	badge.id = "testBuildBadge";
	badge.className = "test-build-badge";
	badge.innerHTML = '<i class="fas fa-flask"></i> Versão de Teste';

	tokensDisplay.insertAdjacentElement("afterend", badge);
}

function compareVersions(current, min) {
	const c = current.split(".").map(Number);
	const m = min.split(".").map(Number);

	for (let i = 0; i < 3; i++) {
		if (c[i] > m[i]) return "test";
		if (c[i] < m[i]) return "outdated";
	}
	return "current";
}

function showUpdateModal(updateLink) {
	const modal = document.getElementById("updateModal");
	const link = document.getElementById("updateLink");
	link.href = updateLink;
	modal.classList.remove("hidden");
}

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
	e.preventDefault();

	const email = document.getElementById("email").value;
	const password = document.getElementById("password").value;
	const submitBtn = e.target.querySelector('button[type="submit"]');
	const errorDiv = document.getElementById("loginError");

	submitBtn.disabled = true;
	submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
	errorDiv.classList.remove("show");

	try {
		const response = await fetch(`${API_BASE_URL}/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error?.message || "Erro ao fazer login");
		}

		const data = await response.json();

		await chrome.storage.local.set({
			token: data.token,
			user: data.user,
		});

		window.location.reload();
	} catch (error) {
		errorDiv.textContent = error.message;
		errorDiv.classList.add("show");
	} finally {
		submitBtn.disabled = false;
		submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
	}
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
	const token = await getStorageItem("token");

	try {
		await fetch(`${API_BASE_URL}/auth/logout`, {
			method: "POST",
			headers: { Authorization: `Bearer ${token}` },
		});
	} catch (error) {}

	await chrome.storage.local.clear();
	window.location.reload();
});

document.getElementById("refreshMaintenanceBtn")?.addEventListener("click", async () => {
	window.location.reload();
});

document.getElementById("bannerDetailsBtn")?.addEventListener("click", () => {
	if (maintenanceStatus && maintenanceStatus.upcoming) {
		showMaintenanceModal(maintenanceStatus.upcoming);
	}
});

document.getElementById("closeMaintenanceModal")?.addEventListener("click", () => {
	document.getElementById("maintenanceModal").classList.add("hidden");
});

document.getElementById("maintenanceModal")?.addEventListener("click", (e) => {
	if (e.target.id === "maintenanceModal") {
		document.getElementById("maintenanceModal").classList.add("hidden");
	}
});

function updateUserDisplay() {
	if (!currentUser || !currentConfig) return;

	const iconDiv = document.getElementById("userIcon");
	if (currentUser.configurationSettings?.buttonIcon) {
		iconDiv.innerHTML = `<i class="${currentUser.configurationSettings.buttonIcon}"></i>`;
	} else {
		iconDiv.textContent = currentUser.username[0].toUpperCase();
	}

	document.getElementById("username").textContent = currentUser.username;

	const planBadge = document.getElementById("planBadge");
	const planConfig = currentConfig.plans[currentUser.plan.id];
	planBadge.textContent = planConfig?.name || currentUser.plan.id;

	updateTokensDisplay();
}

function updateTokensDisplay() {
	if (!currentUser || !currentConfig) return;

	const planConfig = currentConfig.plans[currentUser.plan.id];
	const remaining = currentUser.tokens.remaining;
	const total = planConfig.weeklyTokenAllocation;
	const percentage = (remaining / total) * 100;

	document.getElementById("tokensProgress").style.width = `${percentage}%`;
	document.getElementById("tokensText").textContent = `${formatNumber(remaining)} / ${formatNumber(total)}`;
}

function showLoadingScreen() {
	document.getElementById("loadingScreen").classList.remove("hidden");
	document.getElementById("loginScreen").classList.add("hidden");
	document.getElementById("mainScreen").classList.add("hidden");
}

function showMainScreen() {
	document.getElementById("loadingScreen").classList.add("hidden");
	document.getElementById("loginScreen").classList.add("hidden");
	document.getElementById("mainScreen").classList.remove("hidden");
	document.getElementById("maintenanceScreen").classList.add("hidden");

	if (maintenanceStatus && maintenanceStatus.upcoming) {
		showMaintenanceBanner(maintenanceStatus.upcoming);
	} else {
		hideMaintenanceBanner();
	}

	loadTab("dashboard");
}

function showMaintenanceScreen(maintenanceData) {
	document.getElementById("loadingScreen").classList.add("hidden");
	document.getElementById("loginScreen").classList.add("hidden");
	document.getElementById("mainScreen").classList.add("hidden");
	document.getElementById("maintenanceScreen").classList.remove("hidden");

	const { title, message, startTime, endTime, affectedServices } = maintenanceData;

	document.getElementById("maintenanceMessage").innerHTML = `<strong>${title}</strong><p>${message}</p>`;
	document.getElementById("maintenanceStart").textContent = formatDateTime(startTime);
	document.getElementById("maintenanceEnd").textContent = formatDateTime(endTime);

	updateMaintenanceTimeRemaining(endTime);

	if (affectedServices && affectedServices.length > 0) {
		const servicesContainer = document.getElementById("maintenanceServices");
		servicesContainer.innerHTML = `
			<div class="services-title"><i class="fas fa-server"></i> Serviços Afetados:</div>
			<ul class="services-list">
				${affectedServices.map((service) => `<li>${service}</li>`).join("")}
			</ul>
		`;
		servicesContainer.style.display = "block";
	}
}

function showMaintenanceBanner(upcomingData) {
	const banner = document.getElementById("maintenanceBanner");
	const info = document.getElementById("bannerMaintenanceInfo");

	const startTime = new Date(upcomingData.startTime);
	const timeUntil = formatTimeUntil(upcomingData.timeUntilStart);

	info.innerHTML = `${upcomingData.title} - <span class="time-highlight">começa em ${timeUntil}</span>`;
	banner.classList.remove("hidden");
}

function hideMaintenanceBanner() {
	document.getElementById("maintenanceBanner").classList.add("hidden");
}

function showMaintenanceModal(maintenanceData) {
	const modal = document.getElementById("maintenanceModal");
	const { title, message, startTime, endTime, timeUntilStart, affectedServices } = maintenanceData;

	document.getElementById("modalMaintenanceTitle").textContent = title;
	document.getElementById("modalMaintenanceMessage").textContent = message;
	document.getElementById("modalMaintenanceStart").textContent = formatDateTime(startTime);
	document.getElementById("modalMaintenanceEnd").textContent = formatDateTime(endTime);

	if (timeUntilStart) {
		document.getElementById("modalMaintenanceTimeUntil").textContent = formatTimeUntil(timeUntilStart);
	}

	if (affectedServices && affectedServices.length > 0) {
		const servicesContainer = document.getElementById("modalMaintenanceServices");
		servicesContainer.innerHTML = `
			<div class="services-title"><i class="fas fa-server"></i> Serviços Afetados:</div>
			<ul class="services-list">
				${affectedServices.map((service) => `<li>${service}</li>`).join("")}
			</ul>
		`;
		servicesContainer.style.display = "block";
	}

	modal.classList.remove("hidden");
}

function updateMaintenanceTimeRemaining(endTime) {
	const updateTime = () => {
		const now = Date.now();
		const end = new Date(endTime).getTime();
		const remaining = end - now;

		if (remaining <= 0) {
			document.getElementById("maintenanceRemaining").textContent = "Finalizando...";
			return;
		}

		document.getElementById("maintenanceRemaining").textContent = formatTimeUntil(remaining);
	};

	updateTime();
	setInterval(updateTime, 60000);
}

function formatDateTime(dateString) {
	const date = new Date(dateString);
	return date.toLocaleString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatTimeUntil(milliseconds) {
	const hours = Math.floor(milliseconds / (1000 * 60 * 60));
	const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

	if (hours > 24) {
		const days = Math.floor(hours / 24);
		return `${days} dia${days > 1 ? "s" : ""}`;
	} else if (hours > 0) {
		return `${hours}h ${minutes}min`;
	} else {
		return `${minutes} minuto${minutes !== 1 ? "s" : ""}`;
	}
}

function showLoginScreen() {
	document.getElementById("loadingScreen").classList.add("hidden");
	document.getElementById("loginScreen").classList.remove("hidden");
	document.getElementById("mainScreen").classList.add("hidden");
	document.getElementById("maintenanceScreen").classList.add("hidden");
}

document.querySelectorAll(".nav-tab").forEach((tab) => {
	tab.addEventListener("click", () => {
		const tabName = tab.dataset.tab;
		loadTab(tabName);
	});
});

async function loadTab(tabName) {
	currentTab = tabName;

	document.querySelectorAll(".nav-tab").forEach((t) => {
		t.classList.toggle("active", t.dataset.tab === tabName);
	});

	document.querySelectorAll(".tab-pane").forEach((p) => {
		p.classList.remove("active");
	});

	const tabContent = document.getElementById(`${tabName}Tab`);
	tabContent.classList.add("active");

	switch (tabName) {
		case "dashboard":
			await loadDashboard(tabContent, false);
			break;
		case "settings":
			await loadSettings(tabContent);
			break;
		case "history":
			await loadHistory(tabContent);
			break;
		case "support":
			loadSupport(tabContent);
			break;
	}
}

async function loadDashboard(container, forceRefresh = false) {
	const now = Date.now();
	const cacheIsValid = cachedMetrics && metricsLastFetched && now - metricsLastFetched < METRICS_CACHE_TTL;

	if (!forceRefresh && cacheIsValid) {
		renderDashboard(container, cachedMetrics);
		return;
	}

	container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

	try {
		const token = await getStorageItem("token");
		const response = await fetch(`${API_BASE_URL}/users/me/metrics`, {
			headers: { Authorization: `Bearer ${token}` },
		});

		if (!response.ok) {
			if (response.status === 401) {
				await chrome.storage.local.clear();
				window.location.reload();
				return;
			}
			throw new Error("Erro ao carregar métricas");
		}

		const data = await response.json();

		cachedMetrics = data.metrics;
		metricsLastFetched = now;

		if (data.metrics.tokens) {
			currentUser.tokens.remaining = data.metrics.tokens.remaining;
			await chrome.storage.local.set({ user: currentUser });
			updateTokensDisplay();
		}

		renderDashboard(container, cachedMetrics);
	} catch (error) {
		console.error("Dashboard error:", error);
		container.innerHTML = `
      <div class="error-message show">
        <i class="fas fa-exclamation-triangle"></i>
        Erro ao carregar métricas. Tente novamente.
      </div>
    `;
	}
}

function renderDashboard(container, metrics) {
	const planConfig = currentConfig.plans[currentUser.plan.id];

	container.innerHTML = `
      <div class="dashboard">
        <!-- Add refresh button at top -->
        <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end; margin-bottom: -10px;">
          <button id="refreshDashboard" class="btn btn-sm" style="padding: 6px 12px;">
            <i class="fas fa-sync-alt"></i> Atualizar
          </button>
        </div>
        
        <div class="dashboard-card user-card">
          <div class="card-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <i class="fas fa-user"></i>
          </div>
          <div class="card-content">
            <div class="card-label">Usuário</div>
            <div class="card-value">${currentUser.username}</div>
            <div class="card-sublabel">${currentUser.email}</div>
          </div>
        </div>
        
        <div class="dashboard-card plan-card">
          <div class="card-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
            <i class="fas fa-crown"></i>
          </div>
          <div class="card-content">
            <div class="card-label">Plano Atual</div>
            <div class="card-value">${planConfig.name}</div>
            ${
				currentUser.plan.endDate
					? `<div class="card-sublabel">Expira em ${metrics.plan.currentPlan.daysUntilExpiry} dias</div>`
					: '<div class="card-sublabel">Plano vitalício</div>'
			}
          </div>
        </div>
        
        <div class="dashboard-card tokens-card">
          <div class="card-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
            <i class="fas fa-coins"></i>
          </div>
          <div class="card-content">
            <div class="card-label">Tokens Restantes</div>
            <div class="card-value">${formatNumber(metrics.tokens.remaining)}</div>
            <div class="card-sublabel">
              de ${formatNumber(metrics.tokens.totalAllocation)}
              (${metrics.tokens.percentageUsed.toFixed(1)}% usado)
            </div>
            <div class="progress-bar-small">
              <div class="progress-fill" style="width: ${
					metrics.tokens.percentageUsed
				}%; background: linear-gradient(90deg, #43e97b 0%, #38f9d7 100%);"></div>
            </div>
          </div>
        </div>
        
        <div class="dashboard-card renewal-card">
          <div class="card-icon" style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);">
            <i class="fas fa-sync-alt"></i>
          </div>
          <div class="card-content">
            <div class="card-label">Renovação de Tokens</div>
            <div class="card-value">${metrics.tokens.daysUntilRefresh} dias</div>
            <div class="card-sublabel">${metrics.tokens.hoursUntilRefresh} horas restantes</div>
          </div>
        </div>
        
        <div class="dashboard-card requests-card">
          <div class="card-icon" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
            <i class="fas fa-chart-line"></i>
          </div>
          <div class="card-content">
            <div class="card-label">Total de Requisições</div>
            <div class="card-value">${formatNumber(metrics.usage.totalRequests)}</div>
            <div class="card-sublabel">${formatNumber(metrics.usage.totalTokensSpent)} tokens gastos</div>
          </div>
        </div>
        
        <div class="dashboard-card average-card">
          <div class="card-icon" style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);">
            <i class="fas fa-calculator"></i>
          </div>
          <div class="card-content">
            <div class="card-label">Média por Requisição</div>
            <div class="card-value">${formatNumber(metrics.usage.averageTokensPerRequest)}</div>
            <div class="card-sublabel">tokens</div>
          </div>
        </div>
        
        <div class="dashboard-card model-card">
          <div class="card-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <i class="fas fa-brain"></i>
          </div>
          <div class="card-content">
            <div class="card-label">Modelo Mais Usado</div>
            <div class="card-value model-name">${metrics.usage.mostUsedModel.name}</div>
            <div class="card-sublabel">${formatNumber(metrics.usage.mostUsedModel.usageCount)} usos</div>
          </div>
        </div>
        
        <div class="dashboard-card age-card">
          <div class="card-icon" style="background: linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%);">
            <i class="fas fa-calendar-alt"></i>
          </div>
          <div class="card-content">
            <div class="card-label">Idade da Conta</div>
            <div class="card-value">${metrics.account.accountAgeDays}</div>
            <div class="card-sublabel">dias</div>
          </div>
        </div>
        
        <div class="dashboard-section">
          <h3><i class="fas fa-chart-pie"></i> Uso por Modelo</h3>
          <div class="chart-container">
            ${createModelUsageChart(metrics.usage.byModel)}
          </div>
        </div>
        
        <div class="dashboard-section">
          <h3><i class="fas fa-table"></i> Detalhes por Modelo</h3>
          <div class="model-table">
            ${createModelTable(metrics.usage.byModel)}
          </div>
        </div>
        
        <div class="dashboard-section">
          <h3><i class="fas fa-clock"></i> Informações de Rate Limit</h3>
          <div class="rate-limiter-info">
            <div class="info-item">
              <span class="info-label">Cooldown:</span>
              <span class="info-value">${metrics.rateLimiter.cooldownSeconds} segundos</span>
            </div>
            <div class="info-item">
              <span class="info-label">Pode fazer requisição:</span>
              <span class="info-value ${metrics.rateLimiter.canMakeRequest ? "text-success" : "text-danger"}">
                ${
					metrics.rateLimiter.canMakeRequest
						? '<i class="fas fa-check"></i> Sim'
						: `<i class="fas fa-times"></i> Aguarde ${metrics.rateLimiter.secondsUntilNextRequest}s`
				}
              </span>
            </div>
          </div>
        </div>
      </div>
    `;

	container.querySelector("#refreshDashboard")?.addEventListener("click", async () => {
		const btn = container.querySelector("#refreshDashboard");
		const icon = btn.querySelector("i");

		btn.disabled = true;
		icon.classList.add("fa-spin");

		await loadDashboard(container, true);

		btn.disabled = false;
		icon.classList.remove("fa-spin");

		showToast("Dashboard atualizado!", "success");
	});
}

function createModelUsageChart(byModel) {
	const models = Object.entries(byModel);
	if (models.length === 0) {
		return '<div class="empty-chart">Nenhum dado disponível ainda</div>';
	}
	const total = models.reduce((sum, [, data]) => sum + data.totalUsages, 0);
	const maxUsage = Math.max(...models.map(([, data]) => data.totalUsages));
	return `
    <div class="bar-chart">
      ${models
			.map(([modelId, data]) => {
				const modelConfig = currentConfig.models[modelId];
				const percentage = (data.totalUsages / maxUsage) * 100;
				const sharePercentage = ((data.totalUsages / total) * 100).toFixed(1);
				return `
          <div class="chart-bar-item">
            <div class="chart-label">
              <span class="chart-model-name">${modelConfig.name}</span>
              <span class="chart-value">${formatNumber(data.totalUsages)} (${sharePercentage}%)</span>
            </div>
            <div class="chart-bar">
              <div class="chart-bar-fill" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
			})
			.join("")}
    </div>
  `;
}

function createModelTable(byModel) {
	const models = Object.entries(byModel);
	if (models.length === 0) {
		return '<div class="empty-table">Nenhum dado disponível ainda</div>';
	}
	return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Modelo</th>
          <th>Usos</th>
          <th>Custo/Uso</th>
          <th>Total Gasto</th>
        </tr>
      </thead>
      <tbody>
        ${models
			.map(([modelId, data]) => {
				const modelConfig = currentConfig.models[modelId];
				return `
            <tr>
              <td>
                <div class="model-cell">
                  <strong>${modelConfig.name}</strong>
                  <small>${modelConfig.description}</small>
                </div>
              </td>
              <td>${formatNumber(data.totalUsages)}</td>
              <td>${formatNumber(data.tokenCost)}</td>
              <td><strong>${formatNumber(data.tokensSpent)}</strong></td>
            </tr>
          `;
			})
			.join("")}
      </tbody>
    </table>
  `;
}

async function loadSettings(container) {
	try {
		let settings;

		if (currentUser.configurationSettings) {
			settings = mergeWithDefaults(currentUser.configurationSettings);
		} else {
			settings = (await getStorageItem("settings")) || getDefaultSettings();
		}

		if (!currentUser) {
			throw new Error("currentUser is null");
		}
		if (!currentConfig) {
			throw new Error("currentConfig is null");
		}

		const userPlanId = currentUser.plan.id;
		const planConfig = currentConfig.plans[userPlanId];

		if (!planConfig) {
			throw new Error(`Plan '${userPlanId}' not found in config`);
		}

		const modelsAllowed = planConfig.modelsAllowed;

		if (!modelsAllowed) {
			throw new Error(
				`BACKEND ERROR: 'modelsAllowed' field is missing from plan config. The backend is not sending this field!`
			);
		}

		if (!Array.isArray(modelsAllowed)) {
			throw new Error(`BACKEND ERROR: 'modelsAllowed' is not an array. Got: ${typeof modelsAllowed}`);
		}

		if (modelsAllowed.length === 0) {
			throw new Error(`CONFIG ERROR: 'modelsAllowed' array is empty for plan '${userPlanId}'`);
		}

		const modelOptions = modelsAllowed
			.map((modelId) => {
				const modelConfig = currentConfig.models[modelId];
				if (!modelConfig) {
					console.warn(`⚠️ Model '${modelId}' not found in config.models`);
					return null;
				}
				return {
					id: modelId,
					name: modelConfig.name,
					cost: modelConfig.tokenCost,
					selected: settings.selectedModel === modelId,
				};
			})
			.filter((m) => m !== null)
			.sort((a, b) => a.cost - b.cost);

		if (modelOptions.length === 0) {
			throw new Error("No valid models found after filtering");
		}

		const modelOptionsHTML = modelOptions
			.map(
				(model) =>
					`<option value="${model.id}" ${model.selected ? "selected" : ""}>${model.name} (${formatNumber(
						model.cost
					)} tokens)</option>`
			)
			.join("");

		container.innerHTML = `
		<div class="settings">
		  <div class="settings-section">
			<h3><i class="fas fa-brain"></i> Modelo e IA</h3>
			
			<div class="setting-item">
			  <label>Modelo Padrão</label>
			  <select id="selectedModel" class="setting-select">
				${modelOptionsHTML}
			  </select>
			  <small>Modelo usado para processar imagens</small>
			</div>
			
			<div class="setting-item">
			  <label>Temperatura</label>
			  <div class="slider-container">
				<input type="range" id="temperature" min="0" max="1.5" step="0.1" value="${
					settings.temperature
				}" class="setting-slider">
				<span class="slider-value">${settings.temperature}</span>
			  </div>
			  <small>Controla a criatividade do modelo (0 = preciso, 1.5 = criativo)</small>
			</div>
		  </div>
		  
		  <div class="settings-section">
			<h3><i class="fas fa-camera"></i> Captura de Tela</h3>
			
			<div class="setting-item">
			  <label>Modo de Captura</label>
			  <select id="screenCaptureMode" class="setting-select" ${
					checkPlanAccess(userPlanId, ["pro", "admin"]) ? "" : "disabled"
				}>
				<option value="padrão" ${settings.screenCaptureMode === "padrão" ? "selected" : ""}>Padrão</option>
				<option value="total" ${settings.screenCaptureMode === "total" ? "selected" : ""}>
				  Total (Página Completa) ${!checkPlanAccess(userPlanId, ["pro", "admin"]) ? "🔒" : ""}
				</option>
			  </select>
			  ${
					!checkPlanAccess(userPlanId, ["pro", "admin"])
						? '<small class="plan-restriction">Captura total disponível apenas para planos Pro e Admin</small>'
						: "<small>Padrão captura área visível, Total captura página completa</small>"
				}
			</div>

			<div class="setting-item" ${!checkPlanAccess(userPlanId, ["pro", "admin"]) ? 'style="opacity:0.5"' : ""}>
			  <label>
				<input type="checkbox" id="legacyCapture" ${settings.legacyCapture ? "checked" : ""} ${
			!checkPlanAccess(userPlanId, ["pro", "admin"]) ? "disabled" : ""
		}>
				Usar Modo de Captura Legado (Atalho: ";")
			  </label>
			  ${
					!checkPlanAccess(userPlanId, ["pro", "admin"])
						? '<small class="plan-restriction">Modo de captura legado disponível apenas para planos Pro e Admin</small>'
						: '<small class="warning-text"><i class="fas fa-exclamation-triangle"></i> Aviso: O modo de captura padrão (html2canvas) não captura imagens. Use o modo legado se precisar capturar imagens, mas pode ser mais lento.</small>'
				}
			</div>

			<div class="setting-item">
			  <label>
				<input type="checkbox" id="formsLockedModeBypass" ${settings.formsLockedModeBypass ? "checked" : ""}>
				Desbloquear Google Forms em Modo Bloqueado
			  </label>
			  <small><i class="fas fa-info-circle"></i> Permite acessar Google Forms em modo bloqueado sem restrições. Funciona em Chromebooks gerenciados com extensões habilitadas.</small>
			  <small class="warning-text"><i class="fas fa-exclamation-triangle"></i> Use apenas para fins educacionais. Requer recarregar a página do formulário após ativar até aparecer o botão de desbloquear.</small>
			  <small class="warning-text"><i class="fas fa-info-circle"></i> <strong>Dica:</strong> Ative o modo tela cheia (F11) para evitar ser detectado.</small>
			</div>
		  </div>
		  
		  <div class="settings-section">
			<h3><i class="fas fa-keyboard"></i> Atalhos de Teclado</h3>
			
			<div class="setting-item">
			  <div class="keybind-toggle">
				<label>
				  <input type="radio" name="keybindMode" value="simple" ${!settings.keybindProEnabled ? "checked" : ""}>
				  Keybind Simples
				</label>
				<label>
				  <input type="radio" name="keybindMode" value="pro" ${settings.keybindProEnabled ? "checked" : ""} ${
			checkPlanAccess(userPlanId, ["pro", "admin"]) ? "" : "disabled"
		}>
				  Keybind Pro ${!checkPlanAccess(userPlanId, ["pro", "admin"]) ? "🔒" : ""}
				</label>
			  </div>
			</div>
			
			<div class="setting-item" id="simpleKeybindSetting" ${settings.keybindProEnabled ? 'style="display:none"' : ""}>
			  <label>Atalho Simples (Capturar)</label>
			  <div class="keybind-recorder">
				<input type="text" id="keybindSimple" value="${
					settings.keybindSimple
				}" class="setting-input keybind-input" readonly placeholder="Clique e pressione as teclas">
				<button type="button" class="btn btn-sm keybind-clear" data-target="keybindSimple">
				  <i class="fas fa-times"></i>
				</button>
			  </div>
			  <small>Deve conter Ctrl, Alt ou Shift + uma tecla (ex: Alt+X, Ctrl+A, Ctrl+Alt+Z)</small>
			  <small id="keybindSimpleError" class="plan-restriction" style="display:none;"></small>
			</div>
			
			<div class="setting-item" id="proKeybindSetting" ${!settings.keybindProEnabled ? 'style="display:none"' : ""}>
			  <label>Atalho Pro (Capturar)</label>
			  <div class="keybind-recorder">
				<input type="text" id="keybindPro" value="${
					settings.keybindPro || ""
				}" class="setting-input keybind-input" readonly placeholder="Clique para configurar (tecla única ou clique do meio)">
				<button type="button" class="btn btn-sm keybind-clear" data-target="keybindPro">
				  <i class="fas fa-times"></i>
				</button>
			  </div>
			  <small>Teclas individuais: Letras (A-Z), Números (0-9), Setas (↑↓←→), F-keys (F1-F12), ou clique do MEIO do mouse</small>
			  <small id="keybindProError" class="plan-restriction" style="display:none;"></small>
			</div>
			
			<div class="setting-item" ${!checkPlanAccess(userPlanId, ["basic", "pro", "admin"]) ? 'style="opacity:0.5"' : ""}>
			  <label>Atalho para Trocar Modelo</label>
			  <div class="keybind-recorder">
				<input type="text" id="keybindModelSwitch" value="${
					settings.keybindModelSwitch || ""
				}" class="setting-input keybind-input" ${
			!checkPlanAccess(userPlanId, ["basic", "pro", "admin"]) ? "disabled" : "readonly"
		} placeholder="Clique e pressione as teclas">
				<button type="button" class="btn btn-sm keybind-clear" data-target="keybindModelSwitch" ${
					!checkPlanAccess(userPlanId, ["basic", "pro", "admin"]) ? "disabled" : ""
				}>
				  <i class="fas fa-times"></i>
				</button>
			  </div>
			  ${
					!checkPlanAccess(userPlanId, ["basic", "pro", "admin"])
						? '<small class="plan-restriction">Disponível a partir do plano Basic</small>'
						: "<small>Deve conter Ctrl, Alt ou Shift + uma tecla</small>"
				}
			  <small id="keybindModelSwitchError" class="plan-restriction" style="display:none;"></small>
			</div>

			<div class="setting-item" ${!checkPlanAccess(userPlanId, ["pro", "admin"]) ? 'style="opacity:0.5"' : ""}>
			  <label>Atalho para Trocar Modo de Captura</label>
			  <div class="keybind-recorder">
				<input type="text" id="keybindCaptureModeSwitch" value="${
					settings.keybindCaptureModeSwitch || ""
				}" class="setting-input keybind-input" ${
			!checkPlanAccess(userPlanId, ["pro", "admin"]) ? "disabled" : "readonly"
		} placeholder="Clique e pressione as teclas">
				<button type="button" class="btn btn-sm keybind-clear" data-target="keybindCaptureModeSwitch" ${
					!checkPlanAccess(userPlanId, ["pro", "admin"]) ? "disabled" : ""
				}>
				  <i class="fas fa-times"></i>
				</button>
			  </div>
			  ${
					!checkPlanAccess(userPlanId, ["pro", "admin"])
						? '<small class="plan-restriction">Disponível apenas para plano Pro</small>'
						: "<small>Deve usar apenas Alt + uma tecla (ex: Alt+C)</small>"
				}
			  <small id="keybindCaptureModeError" class="plan-restriction" style="display:none;"></small>
			</div>
		  </div>
		  
		  <div class="settings-section">
			<h3><i class="fas fa-eye"></i> Exibição de Resposta</h3>
			
			<div class="setting-item">
			  <label>Modo de Exibição</label>
			  <select id="answerExhibitionMode" class="setting-select">
				<option value="smallPopup" ${settings.answerExhibitionMode === "smallPopup" ? "selected" : ""}>Popup Pequeno</option>
				<option value="pageTitle" ${settings.answerExhibitionMode === "pageTitle" ? "selected" : ""}>Título da Página</option>
			  </select>
			</div>
			
			<div id="popupSettings" ${settings.answerExhibitionMode !== "smallPopup" ? 'style="display:none"' : ""}>
			  <div class="setting-item">
				<label>Tamanho do Popup</label>
				<div class="slider-container">
				  <input type="range" id="popupSize" min="200" max="800" step="50" value="${settings.popupSize}" class="setting-slider">
				  <span class="slider-value">${settings.popupSize}px</span>
				</div>
			  </div>
			  
			  <div class="setting-item">
				<label>Opacidade do Popup</label>
				<div class="slider-container">
				  <input type="range" id="popupOpacity" min="0.1" max="1" step="0.05" value="${
						settings.popupOpacity
					}" class="setting-slider">
				  <span class="slider-value">${Math.round(settings.popupOpacity * 100)}%</span>
				</div>
			  </div>
			  
			  <div class="setting-item">
				<label>Duração (segundos)</label>
				<input type="number" id="popupDuration" min="0" max="60" value="${settings.popupDuration}" class="setting-input">
				<small>0 = permanente até clique</small>
			  </div>
			</div>
			
			<div id="titleSettings" ${settings.answerExhibitionMode !== "pageTitle" ? 'style="display:none"' : ""}>
			  <div class="setting-item">
				<label>
				  <input type="checkbox" id="titleCooldownDisplay" ${settings.titleCooldownDisplay ? "checked" : ""}>
				  Mostrar Cooldown no Título
				</label>
			  </div>
			  
			  <div class="setting-item">
				<label>Duração da Resposta (segundos)</label>
				<input type="number" id="titleAnswerDuration" min="1" max="120" value="${
					settings.titleAnswerDuration
				}" class="setting-input">
			  </div>
			  
			  <div class="setting-item">
				<label>
				  <input type="checkbox" id="titleShowAnalyzing" ${settings.titleShowAnalyzing ? "checked" : ""}>
				  Mostrar "Analisando..." no Título
				</label>
			  </div>
			</div>
		  </div>
		  
		  <div class="settings-section">
			<h3><i class="fas fa-hand-pointer"></i> Botão Flutuante</h3>
			
			<div class="setting-item">
			  <label>Posição</label>
			  <select id="buttonPosition" class="setting-select">
				<option value="bottomRight" ${settings.buttonPosition === "bottomRight" ? "selected" : ""}>Inferior Direita</option>
				<option value="bottomLeft" ${settings.buttonPosition === "bottomLeft" ? "selected" : ""}>Inferior Esquerda</option>
				<option value="hidden" ${settings.buttonPosition === "hidden" ? "selected" : ""}>Oculto</option>
			  </select>
			</div>
			
			<div class="setting-item">
			  <label>Tamanho</label>
			  <div class="slider-container">
				<input type="range" id="buttonSize" min="20" max="80" step="5" value="${settings.buttonSize}" class="setting-slider">
				<span class="slider-value">${settings.buttonSize}px</span>
			  </div>
			</div>
			
			<div class="setting-item">
			  <label>Opacidade</label>
			  <div class="slider-container">
				<input type="range" id="buttonOpacity" min="0.1" max="1" step="0.05" value="${
					settings.buttonOpacity
				}" class="setting-slider">
				<span class="slider-value">${Math.round(settings.buttonOpacity * 100)}%</span>
			  </div>
			</div>
			
			<div class="setting-item">
			  <label>Ícone</label>
			  <input type="text" id="buttonIcon" value="${
					settings.buttonIcon
				}" class="setting-input" placeholder="fa-solid fa-robot">
			  <small>Código Font Awesome (ex: fa-solid fa-robot, fa-solid fa-brain)</small>
			  <a href="https://sillymaquina.netlify.app/icons" target="_blank" class="btn btn-sm">
				<i class="fas fa-icons"></i> Escolher Ícone
			  </a>
			</div>
			
			<div class="setting-item">
			  <label>Ações do Botão</label>
			  <label>
				<input type="checkbox" id="buttonSingleClick" ${settings.buttonSingleClick ? "checked" : ""}>
				Clique Simples: Capturar Tela
			  </label>
			  <label>
				<input type="checkbox" id="buttonDoubleClick" ${settings.buttonDoubleClick ? "checked" : ""}>
				Clique Duplo: Trocar Modelo
			  </label>
			</div>
			
			<div class="setting-item">
			  <label>
				<input type="checkbox" id="buttonTooltip" ${settings.buttonTooltip ? "checked" : ""}>
				Mostrar Tooltip ao Passar o Mouse
			  </label>
			</div>
		  </div>
		  
		  <div class="settings-section">
			<h3><i class="fas fa-history"></i> Histórico</h3>
			
			<div class="setting-item">
			  <label>Limite de Itens</label>
			  <input type="number" id="historyLimit" min="0" max="15" value="${settings.historyLimit}" class="setting-input">
			  <small>0 = desabilitar histórico (máximo 15 para prevenir erros de storage)</small>
			</div>
		  </div>
		  
		  <div class="settings-actions">
			<button id="saveSettings" class="btn btn-primary">
			  <i class="fas fa-save"></i> Salvar Configurações
			</button>
			<button id="resetSettings" class="btn btn-secondary">
			  <i class="fas fa-undo"></i> Restaurar Padrões
			</button>
		  </div>
		</div>
	  `;

		setupSettingsHandlers(container);
	} catch (error) {
		console.error("SETTINGS LOAD ERROR:", error);
		console.error(error.stack);

		container.innerHTML = `
			<div class="error-message show">
				<i class="fas fa-exclamation-triangle"></i>
				<strong>Erro ao carregar configurações</strong><br>
				<small>${error.message}</small><br><br>
				<button class="btn btn-primary" onclick="window.location.reload()">Recarregar Extensão</button>
			</div>
		`;
	}
}

function setupSettingsHandlers(container) {
	container.querySelectorAll('input[name="keybindMode"]').forEach((radio) => {
		radio.addEventListener("change", (e) => {
			const isProMode = e.target.value === "pro";
			container.querySelector("#simpleKeybindSetting").style.display = isProMode ? "none" : "block";
			container.querySelector("#proKeybindSetting").style.display = isProMode ? "block" : "none";
		});
	});

	container.querySelector("#answerExhibitionMode").addEventListener("change", (e) => {
		const mode = e.target.value;
		container.querySelector("#popupSettings").style.display = mode === "smallPopup" ? "block" : "none";
		container.querySelector("#titleSettings").style.display = mode === "pageTitle" ? "block" : "none";
	});

	container.querySelectorAll(".setting-slider").forEach((slider) => {
		slider.addEventListener("input", (e) => {
			const valueSpan = e.target.nextElementSibling;
			let displayValue = e.target.value;

			if (e.target.id === "temperature") {
				displayValue = parseFloat(displayValue).toFixed(1);
			} else if (e.target.id.includes("Opacity")) {
				displayValue = Math.round(parseFloat(displayValue) * 100) + "%";
			} else {
				displayValue += e.target.id.includes("Size") ? "px" : "";
			}

			valueSpan.textContent = displayValue;
		});
	});

	setupKeybindRecorders(container);

	container.querySelector("#saveSettings").addEventListener("click", async () => {
		await saveSettings(container);
	});

	container.querySelector("#resetSettings").addEventListener("click", async () => {
		if (confirm("Tem certeza que deseja restaurar as configurações padrão?")) {
			await chrome.storage.local.set({ settings: getDefaultSettings() });
			await loadSettings(container);
			showToast("Configurações restauradas!", "success");
		}
	});
}

function setupKeybindRecorders(container) {
	const keybindInputs = container.querySelectorAll(".keybind-input");

	keybindInputs.forEach((input) => {
		if (input.disabled) return;

		input.addEventListener("click", function () {
			this.value = "Pressione as teclas...";
			this.classList.add("recording");

			const errorEl = container.querySelector(`#${this.id}Error`);
			if (errorEl) errorEl.style.display = "none";

			const isProMode = this.id === "keybindPro";
			const isSimpleMode = this.id === "keybindSimple" || this.id === "keybindModelSwitch";
			const isCaptureModeSwitch = this.id === "keybindCaptureModeSwitch";

			const mouseHandler = (e) => {
				if (isProMode && e.button === 1) {
					e.preventDefault();
					this.value = "MiddleMouse";
					this.classList.remove("recording");
					cleanup();
				}
			};

			const keyHandler = (e) => {
				e.preventDefault();
				e.stopPropagation();

				let keybind = "";
				const modifiers = [];

				if (e.ctrlKey) modifiers.push("Ctrl");
				if (e.altKey) modifiers.push("Alt");
				if (e.shiftKey) modifiers.push("Shift");

				let key = e.key;

				const specialKeyMap = {
					ArrowUp: "ArrowUp",
					ArrowDown: "ArrowDown",
					ArrowLeft: "ArrowLeft",
					ArrowRight: "ArrowRight",
					" ": "Space",
					Enter: "Enter",
					Tab: "Tab",
					Escape: "Escape",
					Backspace: "Backspace",
					Delete: "Delete",
					Home: "Home",
					End: "End",
					PageUp: "PageUp",
					PageDown: "PageDown",
					Insert: "Insert",
					Pause: "Pause",
					PrintScreen: "Print",
				};

				if (/^F\d+$/.test(key)) {
					specialKeyMap[key] = key;
				}

				for (const [origKey, mappedKey] of Object.entries(specialKeyMap)) {
					if (key === origKey) {
						key = mappedKey;
						break;
					}
				}

				if (key.length === 1 && !/^[A-Za-z0-9]$/.test(key)) {
					key = key.toUpperCase();
				}

				if (isCaptureModeSwitch) {
					if (modifiers.length !== 1 || modifiers[0] !== "Alt") {
						if (errorEl) {
							errorEl.textContent = "Use apenas Alt + uma tecla (ex: Alt+C)";
							errorEl.style.display = "block";
						}
						this.value = "";
						this.classList.remove("recording");
						cleanup();
						return;
					}

					if (key === "Control" || key === "Alt" || key === "Shift") {
						if (errorEl) {
							errorEl.textContent = "Adicione uma tecla além do Alt";
							errorEl.style.display = "block";
						}
						return;
					}

					if (!/^[A-Za-z0-9]$/.test(key)) {
						if (errorEl) {
							errorEl.textContent = "Use apenas letras (A-Z) ou números (0-9)";
							errorEl.style.display = "block";
						}
						this.value = "";
						this.classList.remove("recording");
						cleanup();
						return;
					}

					keybind = `Alt+${key}`;
				} else if (isSimpleMode) {
					if (modifiers.length === 0) {
						if (errorEl) {
							errorEl.textContent = "Deve conter Alt, Ctrl ou Ctrl+Alt + uma tecla";
							errorEl.style.display = "block";
						}
						this.value = "";
						this.classList.remove("recording");
						cleanup();
						return;
					}

					if (key === "Control" || key === "Alt" || key === "Shift") {
						if (errorEl) {
							errorEl.textContent = "Adicione uma tecla além dos modificadores";
							errorEl.style.display = "block";
						}
						return;
					}

					let validModifiers = false;
					if (modifiers.length === 1 && (modifiers[0] === "Alt" || modifiers[0] === "Ctrl")) {
						validModifiers = true;
					} else if (modifiers.length === 2 && modifiers.includes("Ctrl") && modifiers.includes("Alt")) {
						validModifiers = true;
					}

					if (!validModifiers) {
						if (errorEl) {
							errorEl.textContent = "Use apenas Alt, Ctrl ou Ctrl+Alt (não use Shift)";
							errorEl.style.display = "block";
						}
						this.value = "";
						this.classList.remove("recording");
						cleanup();
						return;
					}

					if (!/^[A-Za-z0-9]$/.test(key)) {
						if (errorEl) {
							errorEl.textContent = "Use apenas letras (A-Z) ou números (0-9)";
							errorEl.style.display = "block";
						}
						this.value = "";
						this.classList.remove("recording");
						cleanup();
						return;
					}

					if (modifiers.includes("Ctrl") && modifiers.includes("Alt")) {
						keybind = `Ctrl+Alt+${key}`;
					} else if (modifiers.includes("Ctrl")) {
						keybind = `Ctrl+${key}`;
					} else if (modifiers.includes("Alt")) {
						keybind = `Alt+${key}`;
					}
				} else if (isProMode) {
					if (modifiers.length > 0) {
						if (errorEl) {
							errorEl.textContent = "Modo Pro não permite modificadores (Ctrl/Alt/Shift)";
							errorEl.style.display = "block";
						}
						this.value = "";
						this.classList.remove("recording");
						cleanup();
						return;
					}

					if (key === "Control" || key === "Alt" || key === "Shift") {
						return;
					}

					keybind = key;
				}

				this.value = keybind;
				this.classList.remove("recording");
				cleanup();
			};

			const cleanup = () => {
				document.removeEventListener("keydown", keyHandler, true);
				document.removeEventListener("mousedown", mouseHandler, true);
			};

			document.addEventListener("keydown", keyHandler, true);
			if (isProMode) {
				document.addEventListener("mousedown", mouseHandler, true);
			}

			setTimeout(() => {
				if (this.classList.contains("recording")) {
					this.value = "";
					this.classList.remove("recording");
					cleanup();
				}
			}, 10000);
		});
	});

	container.querySelectorAll(".keybind-clear").forEach((btn) => {
		btn.addEventListener("click", function (e) {
			e.preventDefault();
			const targetId = this.dataset.target;
			const input = container.querySelector(`#${targetId}`);
			if (input) {
				input.value = "";
				const errorEl = container.querySelector(`#${targetId}Error`);
				if (errorEl) errorEl.style.display = "none";
			}
		});
	});
}

async function saveSettings(container) {
	const btn = container.querySelector("#saveSettings");
	btn.disabled = true;
	btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

	try {
		const userPlan = currentUser.plan.id;
		const planConfig = currentConfig.plans[userPlan];

		const newSettings = {
			selectedModel: container.querySelector("#selectedModel").value,
			temperature: parseFloat(container.querySelector("#temperature").value),
			screenCaptureMode: container.querySelector("#screenCaptureMode").value,
			legacyCapture: checkPlanAccess(userPlan, ["pro", "admin"])
				? container.querySelector("#legacyCapture").checked
				: false,
			formsLockedModeBypass: container.querySelector("#formsLockedModeBypass").checked,
			keybindSimple: container.querySelector("#keybindSimple").value,
			keybindPro: container.querySelector("#keybindPro").value || null,
			keybindProEnabled: container.querySelector('input[name="keybindMode"]:checked').value === "pro",
			keybindModelSwitch: checkPlanAccess(userPlan, ["basic", "pro", "admin"])
				? container.querySelector("#keybindModelSwitch").value || null
				: null,
			keybindCaptureModeSwitch: checkPlanAccess(userPlan, ["pro", "admin"])
				? container.querySelector("#keybindCaptureModeSwitch").value || null
				: null,
			answerExhibitionMode: container.querySelector("#answerExhibitionMode").value,
			popupSize: parseInt(container.querySelector("#popupSize").value),
			popupOpacity: parseFloat(container.querySelector("#popupOpacity").value),
			popupDuration: parseInt(container.querySelector("#popupDuration").value),
			titleCooldownDisplay: container.querySelector("#titleCooldownDisplay").checked,
			titleAnswerDuration: parseInt(container.querySelector("#titleAnswerDuration").value),
			titleShowAnalyzing: container.querySelector("#titleShowAnalyzing").checked,
			buttonPosition: container.querySelector("#buttonPosition").value,
			buttonSize: parseInt(container.querySelector("#buttonSize").value),
			buttonOpacity: parseFloat(container.querySelector("#buttonOpacity").value),
			buttonIcon: container.querySelector("#buttonIcon").value,
			buttonSingleClick: container.querySelector("#buttonSingleClick").checked,
			buttonDoubleClick: container.querySelector("#buttonDoubleClick").checked,
			buttonTooltip: container.querySelector("#buttonTooltip").checked,
			historyLimit: Math.min(parseInt(container.querySelector("#historyLimit").value), 15),
		};

		const requestedLimit = parseInt(container.querySelector("#historyLimit").value);
		if (requestedLimit > 15) {
			console.warn(`History limit adjusted from ${requestedLimit} to 15 to prevent storage quota exceeded`);
		}

		const availableModels = planConfig.modelsAllowed || [];

		if (!availableModels.includes(newSettings.selectedModel)) {
			throw new Error("O modelo selecionado não está disponível no seu plano");
		}

		if (newSettings.screenCaptureMode === "total" && !checkPlanAccess(userPlan, ["pro", "admin"])) {
			throw new Error("Seu plano não permite captura total");
		}

		if (newSettings.keybindProEnabled && !checkPlanAccess(userPlan, ["pro", "admin"])) {
			throw new Error("Seu plano não permite Keybind Pro");
		}

		if (newSettings.keybindSimple) {
			const simplePattern = /^(Alt|Ctrl|Ctrl\+Alt)\+[A-Za-z0-9]$/;
			if (!simplePattern.test(newSettings.keybindSimple)) {
				throw new Error("Keybind simples inválido. Use Alt+X, Ctrl+X ou Ctrl+Alt+X");
			}
		}

		if (newSettings.keybindCaptureModeSwitch) {
			const captureModePattern = /^Alt\+[A-Za-z0-9]$/;
			if (!captureModePattern.test(newSettings.keybindCaptureModeSwitch)) {
				throw new Error("Keybind de modo de captura inválido. Use apenas Alt+X (ex: Alt+C)");
			}
		}

		if (newSettings.buttonIcon) {
			const iconPattern = /^fa-[a-z0-9-]+$/;
			if (!iconPattern.test(newSettings.buttonIcon)) {
				throw new Error("Ícone inválido. Use o formato fa-nome-do-icone");
			}
		}

		// Create settings object for API
		const apiSettings = { ...newSettings };
		// All settings are now sent to the API

		const token = await getStorageItem("token");
		const response = await fetch(`${API_BASE_URL}/users/me/configuration`, {
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(apiSettings),
		});

		if (!response.ok) {
			if (response.status === 401) {
				await chrome.storage.local.clear();
				window.location.reload();
				return;
			}
			const error = await response.json();
			throw new Error(error.error?.message || "Erro ao salvar configurações");
		}

		await chrome.storage.local.set({ settings: newSettings });

		currentUser.configurationSettings = newSettings;
		await chrome.storage.local.set({ user: currentUser });

		console.log("Settings saved to user object and storage");

		showToast("Configurações salvas com sucesso!", "success");

		const settingsTab = document.getElementById("settingsTab");
		if (settingsTab && settingsTab.classList.contains("active")) {
			await loadSettings(settingsTab);
		}

		chrome.tabs.query({}, (tabs) => {
			tabs.forEach((tab) => {
				chrome.tabs.sendMessage(tab.id, { action: "reloadSettings" }).catch(() => {});
			});
		});
	} catch (error) {
		showToast(error.message, "error");
	} finally {
		btn.disabled = false;
		btn.innerHTML = '<i class="fas fa-save"></i> Salvar Configurações';
	}
}

function checkPlanAccess(userPlan, allowedPlans) {
	return allowedPlans.includes(userPlan);
}

async function loadHistory(container) {
	container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

	try {
		const history = (await getStorageItem("history")) || [];

		if (history.length === 0) {
			container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-history"></i>
          <h3>Nenhum histórico ainda</h3>
          <p>Suas capturas e respostas aparecerão aqui</p>
        </div>
      `;
			return;
		}

		container.innerHTML = `
      <div class="history-container">
        <div class="history-header">
          <h3><i class="fas fa-history"></i> Histórico (${history.length} itens)</h3>
          <button id="clearHistory" class="btn btn-danger btn-sm">
            <i class="fas fa-trash"></i> Limpar Tudo
          </button>
        </div>
        
        <div class="history-list">
          ${history.map((item) => createHistoryItem(item)).join("")}
        </div>
      </div>
    `;

		setupHistoryHandlers(container);
	} catch (error) {
		console.error("Load history error:", error);
		container.innerHTML = `<div class="error-message show">Erro ao carregar histórico</div>`;
	}
}

function createHistoryItem(item) {
	const date = new Date(item.timestamp);
	const formattedDate = formatDate(date);
	const modelConfig = item.modelId ? `<span class="history-model">${item.modelId}</span>` : "";

	return `
    <div class="history-item" data-timestamp="${item.timestamp}">
      <div class="history-item-header">
        <div class="history-date">
          <i class="fas fa-clock"></i> ${formattedDate}
        </div>
        ${modelConfig}
        <div class="history-actions">
          <button class="icon-btn view-image" title="Ver Imagem">
            <i class="fas fa-image"></i>
          </button>
          <button class="icon-btn copy-response" title="Copiar Resposta">
            <i class="fas fa-copy"></i>
          </button>
          <button class="icon-btn delete-item" title="Excluir">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      
      <div class="history-response">
        ${item.response}
      </div>
      
      <img src="${item.image}" class="history-image" style="display: none;">
    </div>
  `;
}

function setupHistoryHandlers(container) {
	container.querySelector("#clearHistory")?.addEventListener("click", async () => {
		if (confirm("Tem certeza que deseja limpar todo o histórico?")) {
			await chrome.storage.local.set({ history: [] });
			await loadHistory(container);
			showToast("Histórico limpo com sucesso", "success");
		}
	});

	container.querySelectorAll(".view-image").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			const item = e.target.closest(".history-item");
			const img = item.querySelector(".history-image");

			if (img.style.display === "none") {
				img.style.display = "block";
				btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
				btn.title = "Ocultar Imagem";
			} else {
				img.style.display = "none";
				btn.innerHTML = '<i class="fas fa-image"></i>';
				btn.title = "Ver Imagem";
			}
		});
	});

	container.querySelectorAll(".copy-response").forEach((btn) => {
		btn.addEventListener("click", async (e) => {
			const item = e.target.closest(".history-item");
			const response = item.querySelector(".history-response").textContent;

			try {
				await navigator.clipboard.writeText(response);
				showToast("Resposta copiada!", "success");
				btn.innerHTML = '<i class="fas fa-check"></i>';
				setTimeout(() => {
					btn.innerHTML = '<i class="fas fa-copy"></i>';
				}, 2000);
			} catch (error) {
				showToast("Erro ao copiar", "error");
			}
		});
	});

	container.querySelectorAll(".delete-item").forEach((btn) => {
		btn.addEventListener("click", async (e) => {
			const item = e.target.closest(".history-item");
			const timestamp = parseInt(item.dataset.timestamp);

			if (confirm("Excluir este item do histórico?")) {
				const history = (await getStorageItem("history")) || [];
				const filtered = history.filter((h) => h.timestamp !== timestamp);
				await chrome.storage.local.set({ history: filtered });
				await loadHistory(container);
				showToast("Item removido", "success");
			}
		});
	});
}

function loadSupport(container) {
	container.innerHTML = `
    <div class="support-section">
      <h3>Precisa de Ajuda?</h3>
      <p>Entre em contato conosco através dos canais abaixo:</p>
      <a href="mailto:support@sillymaquina.com" class="btn btn-primary">
        <i class="fas fa-envelope"></i> Enviar Email
      </a>
      <a href="https://sillymaquina.netlify.app/support" target="_blank" class="btn">
        <i class="fas fa-external-link-alt"></i> Acessar Suporte
      </a>
    </div>
  `;
}

function formatDate(date) {
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = date.getFullYear();
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");

	return `${day}/${month}/${year} ${hours}:${minutes}`;
}

async function getStorageItem(key) {
	const result = await chrome.storage.local.get(key);
	return result[key];
}

function formatNumber(num) {
	return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function getDefaultSettings() {
	return {
		selectedModel: "gemini-2.5-flash-lite",
		temperature: 0.9,
		screenCaptureMode: "padrão",
		legacyCapture: false,
		formsLockedModeBypass: false,
		keybindSimple: "Alt+X",
		keybindPro: null,
		keybindProEnabled: false,
		keybindModelSwitch: null,
		keybindCaptureModeSwitch: null,
		answerExhibitionMode: "pageTitle",
		popupSize: 300,
		popupOpacity: 0.95,
		popupDuration: 10,
		titleCooldownDisplay: true,
		titleAnswerDuration: 15,
		titleShowAnalyzing: true,
		buttonPosition: "bottomRight",
		buttonSize: 50,
		buttonOpacity: 0.9,
		buttonIcon: "fa-robot",
		buttonSingleClick: true,
		buttonDoubleClick: true,
		buttonTooltip: true,
		historyLimit: 15,
	};
}

function showToast(message, type = "info") {
	const toast = document.createElement("div");
	toast.className = `toast toast-${type}`;
	toast.textContent = message;
	toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === "success" ? "#48bb78" : type === "error" ? "#f56565" : "#667eea"};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
  `;
	document.body.appendChild(toast);

	setTimeout(() => {
		toast.remove();
	}, 3000);
}
