document.addEventListener("DOMContentLoaded", async () => {
	const loggedOutView = document.getElementById("logged-out-view");
	const loggedInContent = document.getElementById("logged-in-content");
	const tabs = document.querySelectorAll(".tab-link");
	const tabPanes = document.querySelectorAll(".tab-pane");
	const saveButton = document.getElementById("save-button");
	const logoutButton = document.getElementById("logout-button");
	const resetButton = document.getElementById("reset-button");
	const saveStatus = document.getElementById("save-status");

	const infoUserId = document.getElementById("info-userId");
	const infoName = document.getElementById("info-name");
	const infoPlan = document.getElementById("info-plan");
	const infoPlanExpiry = document.getElementById("info-plan-expiry");
	const paymentHistoryBody = document.getElementById("payment-history-body");

	const displayModeRadios = document.getElementsByName("displayMode");
	const titleRevertGroup = document.getElementById("title-revert-group");
	const titleRevertDelayInput = document.getElementById("title-revert-delay");
	const aiModelSelect = document.getElementById("ai-model-select");
	const modelUsageInfo = document.getElementById("model-usage-info");
	const aiTemperatureSlider = document.getElementById("ai-temperature");
	const temperatureValue = document.getElementById("temperature-value");

	const shortcutInput = document.getElementById("shortcut-input");

	const iconClassInput = document.getElementById("icon-class");
	const iconSizeSlider = document.getElementById("icon-size");
	const iconSizeValue = document.getElementById("icon-size-value");
	const iconOpacitySlider = document.getElementById("icon-opacity");
	const iconOpacityValue = document.getElementById("icon-opacity-value");
	const popupOpacitySlider = document.getElementById("popup-opacity");
	const popupOpacityValue = document.getElementById("popup-opacity-value");
	const hideIconToggle = document.getElementById("hide-icon-toggle");
	const cooldownTitleSettingGroup = document.getElementById("cooldown-title-setting-group");
	const cooldownInTitleToggle = document.getElementById("cooldown-in-title-toggle");

	const popupOpacityGroup = document.getElementById("popup-opacity-group");
	const iconPreview = document.getElementById("icon-preview");
	const iconPreviewElement = document.getElementById("icon-preview-element");

	const historySizeInput = document.getElementById("history-size-input");
	const historySearchInput = document.getElementById("history-search-input");
	const historyFavoritesToggle = document.getElementById("history-favorites-toggle");
	const historyListContainer = document.getElementById("history-list-container");
	const clearHistoryButton = document.getElementById("clear-history-button");

	const guideTabPane = document.getElementById("guide");

	const modelUsageChartCanvas = document.getElementById("model-usage-chart");

	let currentUserData = null;
	let refreshInterval = null;
	let saveStatusTimeout = null;
	let fullHistory = [];
	let historyFilters = {
		search: "",
		favoritesOnly: false,
	};
	let modelUsageChart = null;

	const DEFAULT_CONFIG = {
		captureMode: "inteira",
		displayMode: "popup",
		titleRevertDelay: 5,
		fixedCoords: null,
		appearance: {
			iconClass: "fas fa-robot",
			iconSize: 50,
			iconOpacity: 1.0,
			popupOpacity: 1.0,
			hideIcon: false,
			cooldownInTitle: true,
		},
		selectedModel: "",
		temperature: 0.4,
		shortcut: "Alt+X",
	};

	function formatDate(dateInput) {
		if (!dateInput) return "N/A";
		try {
			return new Date(dateInput).toLocaleString("pt-BR", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				timeZone: "America/Sao_Paulo",
			});
		} catch (e) {
			return "Data inválida";
		}
	}

	function populateAccountInfo(user) {
		currentUserData = user;
		infoUserId.textContent = user.user;
		infoName.textContent = `${user.name} ${user.surname || ""}`;
		infoPlan.textContent = user.plan.type;
		infoPlanExpiry.textContent = user.plan.endDate ? formatDate(user.plan.endDate).split(" ")[0] : "Permanente";
		paymentHistoryBody.innerHTML = "";
		if (user.paymentHistory && user.paymentHistory.length > 0) {
			user.paymentHistory.forEach((p) => {
				const row = document.createElement("tr");
				row.innerHTML = `<td>${formatDate(p.date).split(" ")[0]}</td><td>${
					p.planKey
				}</td><td>R$ ${p.amountPaidBRL.toFixed(2)}</td>`;
				paymentHistoryBody.appendChild(row);
			});
		} else {
			paymentHistoryBody.innerHTML = `<tr><td colspan="3">Nenhum histórico de pagamento.</td></tr>`;
		}
		aiModelSelect.innerHTML = "";
		if (user.models && user.models.allowed) {
			user.models.allowed.forEach((model) => {
				const option = document.createElement("option");
				option.value = model.model;
				option.textContent = model.name;
				aiModelSelect.appendChild(option);
			});
		}
		updateModelUsageInfo();
	}

	function updateModelUsageInfo() {
		if (!currentUserData || !aiModelSelect.value) {
			modelUsageInfo.textContent = "";
			return;
		}
		const selectedModelId = aiModelSelect.value;
		const modelConfig = currentUserData.models.allowed.find((m) => m.model === selectedModelId);
		const usageData = currentUserData.models.currentUsage.find((u) => u.modelId === selectedModelId);
		if (modelConfig && usageData) {
			modelUsageInfo.textContent = `Uso hoje: ${usageData.uses} / ${modelConfig.maxUses}. Renova em: ${formatDate(
				usageData.dateRefresh
			)}.`;
		} else {
			modelUsageInfo.textContent = "Informações de uso não disponíveis para este modelo.";
		}
	}

	function showSaveStatus(message, type = "success") {
		if (saveStatusTimeout) clearTimeout(saveStatusTimeout);
		saveStatus.textContent = message;
		saveStatus.className = "message-area";
		saveStatus.classList.add(type, "show");
		saveStatusTimeout = setTimeout(() => {
			saveStatus.classList.remove("show");
		}, 3000);
	}

	function toggleCooldownTitleVisibility() {
		cooldownTitleSettingGroup.style.display = hideIconToggle.checked ? "block" : "none";
	}

	function togglePopupOpacityVisibility() {
		const isPopupSelected = document.querySelector('input[name="displayMode"][value="popup"]').checked;
		popupOpacityGroup.style.display = isPopupSelected ? "block" : "none";
	}

	function updateIconPreview() {
		if (!iconPreview || !iconPreviewElement) return;

		const iconClass = iconClassInput.value.trim() || "fas fa-question-circle";
		const iconSize = parseInt(iconSizeSlider.value, 10);
		const iconOpacity = parseFloat(iconOpacitySlider.value);

		iconPreviewElement.className = iconClass;
		iconPreview.style.width = `${iconSize}px`;
		iconPreview.style.height = `${iconSize}px`;
		iconPreview.style.opacity = iconOpacity;
		iconPreviewElement.style.fontSize = `${iconSize * 0.45}px`;
	}

	function loadSettings() {
		chrome.storage.sync.get("config", (data) => {
			const config = { ...DEFAULT_CONFIG, ...(data.config || {}) };
			config.appearance = { ...DEFAULT_CONFIG.appearance, ...(config.appearance || {}) };

			shortcutInput.value = config.shortcut || "Alt+X";
			historySizeInput.value = config.historySize || 50;

			const availableCaptureModes = ["inteira"];
			document.querySelectorAll('input[name="captureMode"]').forEach((radio) => {
				const isAvailable = availableCaptureModes.includes(radio.value);
				radio.disabled = !isAvailable;
				radio.closest(".radio-option").classList.toggle("disabled-option", !isAvailable);
			});

			if (!availableCaptureModes.includes(config.captureMode)) {
				config.captureMode = availableCaptureModes[0];
			}

			document.querySelector(`input[name="captureMode"][value="${config.captureMode}"]`).checked = true;
			document.querySelector(`input[name="displayMode"][value="${config.displayMode}"]`).checked = true;
			titleRevertDelayInput.value = config.titleRevertDelay;
			titleRevertGroup.style.display = config.displayMode === "titulo" ? "block" : "none";
			hideIconToggle.checked = !!config.appearance.hideIcon;
			cooldownInTitleToggle.checked = config.appearance.cooldownInTitle;
			iconClassInput.value = config.appearance.iconClass;
			iconSizeSlider.value = config.appearance.iconSize;
			iconSizeValue.textContent = config.appearance.iconSize;
			iconOpacitySlider.value = config.appearance.iconOpacity;
			iconOpacityValue.textContent = config.appearance.iconOpacity;
			popupOpacitySlider.value = config.appearance.popupOpacity;
			popupOpacityValue.textContent = config.appearance.popupOpacity;

			if (config.selectedModel && aiModelSelect.querySelector(`option[value="${config.selectedModel}"]`)) {
				aiModelSelect.value = config.selectedModel;
			} else if (aiModelSelect.options.length > 0) {
				config.selectedModel = aiModelSelect.options[0].value;
				aiModelSelect.value = config.selectedModel;
			}
			updateModelUsageInfo();
			toggleCooldownTitleVisibility();
			togglePopupOpacityVisibility();
			updateIconPreview();

			if (typeof config.temperature !== "undefined") {
				aiTemperatureSlider.value = config.temperature;
				temperatureValue.textContent = config.temperature.toFixed(1);
			}
		});
	}

	function packSettingsForServer() {
		const serverConfigs = {
			captureMode: {
				type: document.querySelector('input[name="captureMode"]:checked').value,
			},
			exhibitionMode: {
				type: document.querySelector('input[name="displayMode"]:checked').value,
				extraData: [parseInt(titleRevertDelayInput.value, 10) || 0],
			},
			appearance: {
				iconClass: iconClassInput.value.trim(),
				iconSize: parseInt(iconSizeSlider.value, 10),
				iconOpacity: parseFloat(iconOpacitySlider.value),
				popupOpacity: parseFloat(popupOpacitySlider.value),
				hideIcon: hideIconToggle.checked,
				cooldownInTitle: cooldownInTitleToggle.checked,
			},
			selectedModel: aiModelSelect.value,
			temperature: parseFloat(aiTemperatureSlider.value),
			shortcut: shortcutInput.value,
			historySize: parseInt(historySizeInput.value, 10),
		};
		return serverConfigs;
	}

	function saveSettings() {
		const localSettings = {
			captureMode: document.querySelector('input[name="captureMode"]:checked').value,
			displayMode: document.querySelector('input[name="displayMode"]:checked').value,
			titleRevertDelay: parseInt(titleRevertDelayInput.value, 10),
			appearance: {
				iconClass: iconClassInput.value.trim(),
				iconSize: parseInt(iconSizeSlider.value, 10),
				iconOpacity: parseFloat(iconOpacitySlider.value),
				popupOpacity: parseFloat(popupOpacitySlider.value),
			},
			selectedModel: aiModelSelect.value,
			temperature: parseFloat(aiTemperatureSlider.value),
			shortcut: shortcutInput.value,
			historySize: parseInt(historySizeInput.value, 10) || 50,
		};

		const serverPayload = packSettingsForServer();

		chrome.runtime.sendMessage(
			{
				type: "SAVE_USER_SETTINGS",
				payload: { extensionConfigs: serverPayload },
			},
			(response) => {
				if (chrome.runtime.lastError) {
					console.error(chrome.runtime.lastError.message);
					showSaveStatus("Erro de comunicação com a extensão.", "error");
					return;
				}
				if (response && response.success) {
					showSaveStatus("Configurações salvas com sucesso!", "success");
				} else {
					showSaveStatus(`Erro ao salvar: ${response?.error || "Tente novamente."}`, "error");
				}
			}
		);
	}

	async function fetchFreshData() {
		if (document.hidden) return;
		try {
			const response = await chrome.runtime.sendMessage({
				type: "GET_FRESH_USER_DATA",
			});
			if (response && response.success) {
				populateAccountInfo(response.user);
				loadSettings();
			} else {
				console.warn("Periodic refresh failed:", response.error);
				stopDataRefresh();
			}
		} catch (error) {
			console.error("Error during periodic refresh:", error);
			stopDataRefresh();
		}
	}

	function startDataRefresh() {
		if (refreshInterval) clearInterval(refreshInterval);
		refreshInterval = setInterval(fetchFreshData, 120000);
	}

	function stopDataRefresh() {
		if (refreshInterval) clearInterval(refreshInterval);
	}

	async function loadHistory() {
		const { captureHistory = [] } = await chrome.storage.local.get("captureHistory");
		fullHistory = captureHistory;
		renderHistory();
	}

	function renderHistory() {
		if (!historyListContainer) return;
		historyListContainer.innerHTML = "";

		const searchTerm = historyFilters.search.toLowerCase();
		const filteredHistory = fullHistory.filter((item) => {
			if (historyFilters.favoritesOnly && !item.isFavorite) {
				return false;
			}
			if (searchTerm) {
				const inText = item.text.toLowerCase().includes(searchTerm);
				const inTags = item.tags.some((tag) => tag.toLowerCase().includes(searchTerm));
				if (!inText && !inTags) return false;
			}
			return true;
		});

		if (filteredHistory.length === 0) {
			historyListContainer.innerHTML =
				'<p style="text-align: center; color: var(--text-secondary); padding: 20px;">Nenhum item encontrado.</p>';
			return;
		}

		filteredHistory.forEach((entry) => {
			const itemEl = document.createElement("div");
			itemEl.className = "history-item";
			itemEl.dataset.id = entry.id;
			if (entry.isFavorite) itemEl.classList.add("is-favorite");
			const currentEl = document.querySelector(`.history-item[data-id='${entry.id}']`);
			if (currentEl && currentEl.classList.contains("is-expanded")) {
				itemEl.classList.add("is-expanded");
			}

			const tagsHTML = (entry.tags || [])
				.map(
					(tag) => `
            <span class="tag-pill">
                ${tag.replace(/</g, "<").replace(/>/g, ">")}
                <button class="remove-tag-btn" data-tag="${tag.replace(/"/g, "")}">×</button>
            </span>
        `
				)
				.join("");

			itemEl.innerHTML = `
            <div class="history-item-summary">
                <img class="history-thumbnail" src="${entry.image}" alt="Captura">
                <div class="history-summary-text">${entry.text.replace(/</g, "<").replace(/>/g, ">")}</div>
                <div class="history-item-date">${formatDate(entry.date)}</div>
            </div>
            <div class="history-item-details">
                <div class="details-image-container">
                    <img class="history-full-image" src="${entry.image}" alt="Captura Completa">
                </div>
                <div class="details-content-container">
                    <p class="history-full-text">${entry.text.replace(/</g, "<").replace(/>/g, ">")}</p>
                    <div class="history-item-actions">
                        <button class="favorite-button ${entry.isFavorite ? "is-favorite" : ""}">
                            <i class="fas fa-star"></i>
                            <span>${entry.isFavorite ? "Favorito" : "Favoritar"}</span>
                        </button>
                        <div class="tags-section">
                            <div class="tags-display">${tagsHTML}</div>
                            <input type="text" class="tag-input" placeholder="Adicionar tag...">
                        </div>
                    </div>
                </div>
            </div>`;
			historyListContainer.appendChild(itemEl);
		});
	}

	async function updateHistoryItem(id, updateFn) {
		const itemIndex = fullHistory.findIndex((item) => item.id == id);
		if (itemIndex > -1) {
			updateFn(fullHistory[itemIndex]);
			await chrome.storage.local.set({ captureHistory: fullHistory });
			renderHistory();
		}
	}

	try {
		const response = await chrome.runtime.sendMessage({ type: "GET_FRESH_USER_DATA" });

		if (chrome.runtime.lastError) {
			throw new Error(chrome.runtime.lastError.message);
		}

		if (response && response.success) {
			loggedInContent.style.display = "block";
			loggedOutView.style.display = "none";
			populateAccountInfo(response.user);
			loadSettings();
			startDataRefresh();
		} else {
			loggedInContent.style.display = "none";
			loggedOutView.style.display = "block";
			if (response && response.error) {
				console.error("Could not get user data:", response.error);
			}
		}
	} catch (error) {
		loggedInContent.style.display = "none";
		loggedOutView.style.display = "block";
		console.error("Failed to initialize options page:", error.message);
	}

	function getTodayModelUsageData() {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		if (!currentUserData || !currentUserData.models || !currentUserData.models.currentUsage) {
			return [];
		}

		const usageData = currentUserData.models.currentUsage
			.map((usage) => {
				const modelInfo = currentUserData.models.allowed.find((m) => m.model === usage.modelId);
				const refreshDate = new Date(usage.dateRefresh);

				if (refreshDate > today && usage.uses > 0) {
					return {
						name: modelInfo ? modelInfo.name : usage.modelId,
						uses: usage.uses,
					};
				}
				return null;
			})
			.filter(Boolean);

		return usageData;
	}

	function renderModelUsageChart() {
		if (!modelUsageChartCanvas) return;
		const ctx = modelUsageChartCanvas.getContext("2d");
		const dashboardMessage = document.getElementById("dashboard-message");

		const usageData = getTodayModelUsageData();

		if (usageData.length === 0) {
			dashboardMessage.textContent = "Nenhum modelo foi utilizado hoje. Faça uma captura para começar!";
			modelUsageChartCanvas.style.display = "none";
			if (modelUsageChart) {
				modelUsageChart.destroy();
				modelUsageChart = null;
			}
			return;
		}

		dashboardMessage.textContent = "";
		modelUsageChartCanvas.style.display = "block";

		const labels = usageData.map((d) => d.name);
		const data = usageData.map((d) => d.uses);

		const colors = [
			["#a777e3", "#6a5acd"],
			["#5eead4", "#0d9488"],
			["#fbbf24", "#f97316"],
			["#f87171", "#ef4444"],
			["#60a5fa", "#2563eb"],
		];

		const backgroundColors = data.map((_, i) => {
			const colorPair = colors[i % colors.length];
			const gradient = ctx.createLinearGradient(0, 0, 0, 400);
			gradient.addColorStop(0, colorPair[0]);
			gradient.addColorStop(1, colorPair[1]);
			return gradient;
		});

		const chartData = {
			labels: labels,
			datasets: [
				{
					label: " Usos",
					data: data,
					backgroundColor: backgroundColors,
					borderColor: "#1f1f23",
					borderWidth: 3,
					hoverOffset: 10,
				},
			],
		};

		if (modelUsageChart) {
			modelUsageChart.data = chartData;
			modelUsageChart.update();
		} else {
			modelUsageChart = new Chart(ctx, {
				type: "doughnut",
				data: chartData,
				options: {
					responsive: true,
					maintainAspectRatio: true,
					cutout: "70%",
					plugins: {
						legend: {
							position: "bottom",
							labels: {
								color: "#e4e4e7",
								font: {
									family: "'Torus', 'Inter', sans-serif",
									size: 14,
								},
								padding: 20,
							},
						},
						tooltip: {
							backgroundColor: "#101014",
							titleColor: "#e4e4e7",
							bodyColor: "#a0a0a7",
							padding: 10,
							cornerRadius: 8,
							titleFont: { weight: "bold" },
							bodyFont: { size: 13 },
						},
					},
				},
			});
		}
	}

	function renderGuideContent() {
		if (!guideTabPane || typeof guideContent === "undefined") {
			console.error("Elemento do guia ou conteúdo do guia não encontrado.");
			return;
		}

		guideTabPane.innerHTML = "";

		guideContent.forEach((section) => {
			const sectionEl = document.createElement("div");
			sectionEl.className = "guide-section";
			sectionEl.id = section.id;

			sectionEl.innerHTML = `
                <h3><i class="${section.icon}" style="color: var(--accent-primary);"></i> ${section.title}</h3>
                ${section.content}
            `;

			guideTabPane.appendChild(sectionEl);
		});
	}

	document.addEventListener("visibilitychange", () => {
		if (!document.hidden) {
			fetchFreshData();
			startDataRefresh();
		} else {
			stopDataRefresh();
		}
	});

	hideIconToggle.addEventListener("change", toggleCooldownTitleVisibility);

	iconClassInput.addEventListener("input", updateIconPreview);
	iconSizeSlider.addEventListener("input", (e) => {
		iconSizeValue.textContent = e.target.value;
		updateIconPreview();
	});
	iconOpacitySlider.addEventListener("input", (e) => {
		iconOpacityValue.textContent = parseFloat(e.target.value).toFixed(1);
		updateIconPreview();
	});

	tabs.forEach((tab) => {
		tab.addEventListener("click", () => {
			tabs.forEach((t) => t.classList.remove("active"));
			tabPanes.forEach((p) => p.classList.remove("active"));
			tab.classList.add("active");
			const activePaneId = tab.dataset.tab;
			document.getElementById(activePaneId).classList.add("active");

			if (activePaneId === "history") {
				loadHistory();
			} else if (activePaneId === "dashboard") {
				renderModelUsageChart();
			}
		});
	});

	displayModeRadios.forEach((radio) => {
		radio.addEventListener("change", (e) => {
			titleRevertGroup.style.display = e.target.value === "titulo" ? "block" : "none";
			togglePopupOpacityVisibility();
		});
	});

	aiTemperatureSlider.addEventListener(
		"input",
		(e) => (temperatureValue.textContent = parseFloat(e.target.value).toFixed(1))
	);
	iconSizeSlider.addEventListener("input", (e) => (iconSizeValue.textContent = e.target.value));
	iconOpacitySlider.addEventListener(
		"input",
		(e) => (iconOpacityValue.textContent = parseFloat(e.target.value).toFixed(1))
	);
	popupOpacitySlider.addEventListener(
		"input",
		(e) => (popupOpacityValue.textContent = parseFloat(e.target.value).toFixed(1))
	);
	aiModelSelect.addEventListener("change", updateModelUsageInfo);

	saveButton.addEventListener("click", saveSettings);

	logoutButton.addEventListener("click", () => {
		chrome.runtime.sendMessage({ type: "LOGOUT" }, () => {
			window.location.reload();
		});
	});

	resetButton.addEventListener("click", () => {
		if (
			confirm(
				"Tem certeza que deseja resetar todas as configurações para o padrão? Esta ação também salvará as configurações padrão no servidor."
			)
		) {
			Object.assign(document.querySelector('input[name="captureMode"]:checked'), { checked: false });
			document.querySelector(`input[name="captureMode"][value="${DEFAULT_CONFIG.captureMode}"]`).checked = true;
			chrome.storage.sync.set({ config: DEFAULT_CONFIG }, () => {
				loadSettings();
				saveSettings();
				alert("Configurações resetadas para o padrão.");
			});
		}
	});

	shortcutInput.addEventListener("keydown", (e) => {
		e.preventDefault();
		const key = e.key;

		if (["Control", "Shift", "Alt", "Meta"].includes(key)) {
			return;
		}

		const modifiers = [];
		if (e.ctrlKey) modifiers.push("Ctrl");
		if (e.altKey) modifiers.push("Alt");
		if (e.shiftKey) modifiers.push("Shift");

		if (modifiers.length === 0) {
			shortcutInput.value = "Use um modificador (Ctrl, Alt, Shift)";
			setTimeout(() => {
				chrome.storage.sync.get("config", (data) => {
					shortcutInput.value = (data.config && data.config.shortcut) || "Alt+X";
				});
			}, 1500);
			return;
		}

		const finalKey = key.length === 1 ? key.toUpperCase() : key;
		modifiers.push(finalKey);

		shortcutInput.value = modifiers.join("+");
	});

	historyListContainer.addEventListener("click", (e) => {
		const summary = e.target.closest(".history-item-summary");
		if (summary) {
			const item = summary.closest(".history-item");
			item.classList.toggle("is-expanded");
			return;
		}

		const favoriteBtn = e.target.closest(".favorite-button");
		if (favoriteBtn) {
			const id = favoriteBtn.closest(".history-item").dataset.id;
			updateHistoryItem(id, (item) => {
				item.isFavorite = !item.isFavorite;
			});
			return;
		}

		const removeTagBtn = e.target.closest(".remove-tag-btn");
		if (removeTagBtn) {
			const id = removeTagBtn.closest(".history-item").dataset.id;
			const tagToRemove = removeTagBtn.dataset.tag;
			updateHistoryItem(id, (item) => {
				item.tags = item.tags.filter((t) => t !== tagToRemove);
			});
		}
	});

	historyListContainer.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && e.target.classList.contains("tag-input")) {
			e.preventDefault();
			const id = e.target.closest(".history-item").dataset.id;
			const newTag = e.target.value.trim();
			if (newTag) {
				updateHistoryItem(id, (item) => {
					if (!item.tags.includes(newTag)) {
						item.tags.push(newTag);
					}
				});
				e.target.value = "";
			}
		}
	});

	historySearchInput.addEventListener("input", () => {
		historyFilters.search = historySearchInput.value;
		renderHistory();
	});

	historyFavoritesToggle.addEventListener("change", () => {
		historyFilters.favoritesOnly = historyFavoritesToggle.checked;
		renderHistory();
	});

	clearHistoryButton.addEventListener("click", () => {
		if (
			confirm("Tem certeza que deseja apagar TODO o seu histórico de capturas? Esta ação não pode ser desfeita.")
		) {
			chrome.storage.local.remove("captureHistory", () => {
				fullHistory = [];
				renderHistory();
				alert("Histórico apagado com sucesso.");
			});
		}
	});

	renderGuideContent();
});
