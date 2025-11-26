// ==UserScript==
// @name         CleanX - Bloqueador de País/Região/Idioma (PT-BR)
// @namespace    http://tampermonkey.net/
// @version      6.1
// @description  Bloqueie ou mostre país, região e idioma. Interface Swiss Design em Português.
// @author       A Pleasant Experience & Gemini
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==

(function () {
	"use strict";

	if (!/^https?:\/\/(x|twitter)\.com\//.test(window.location.href)) return;

	const STORAGE_KEY = "xCountryBlocker";
	const defaultTotals = () => ({
		overall: 0,
		country: {},
		lang: {},
		region: {},
		session: 0,
	});
	const defaultAnalytics = () => ({
		seenTotal: 0,
		seenCountry: {},
		seenRegion: {},
	});
	let config = {
		blockedCountries: new Set(),
		blockedLangs: new Set(),
		blockedRegions: new Set(),
		countryDB: {},
		knownUsers: {},
		pending: new Set(),
		displayMode: "both", // "show" = apenas mostrar, "block" = apenas bloquear, "both" = mostrar e bloquear
		filterTotals: defaultTotals(),
		analytics: defaultAnalytics(),
		// Toggles para cada categoria
		countryFilterEnabled: true,
		regionFilterEnabled: true,
		langFilterEnabled: true,
	};
	const fetchQueue = [];

	const nowTs = () => Date.now();
	let filteredCount = 0;
	let totalsSaveTimer = null;
	let nextFetchAllowed = 0;
	let scanDebounceTimer = null;
	let isScanning = false;
	const FETCH_GAP_MS = 5000;
	const RATE_LIMIT_BACKOFF_MS = 2 * 60 * 1000;
	const UNKNOWN_RETRY_MS = 10 * 60 * 1000;
	const PREFETCH_BATCH = 5;
	const PREFETCH_INTERVAL_MS = 5000;
	const blockStats = { country: {}, lang: {}, region: {} };
	let dbPromise = null;
	const FIELD_TOGGLES = { withAuxiliaryUserLabels: false };
	const BEARER_TOKEN =
		"AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
	const ABOUT_QUERY_ID = "XRqGa7EeokUU5kppkh13EA";
	const GRAPHQL_FEATURES = {
		hidden_profile_subscriptions_enabled: true,
		subscriptions_verification_info_is_identity_verified_enabled: true,
		subscriptions_verification_info_verified_since_enabled: true,
		responsive_web_graphql_skip_user_profile_image_extensions_enabled: true,
		responsive_web_graphql_timeline_navigation_enabled: true,
		responsive_web_graphql_timeline_navigation_enabled_elsewhere: true,
		responsive_web_graphql_enhance_cards_enabled: true,
		verified_phone_label_enabled: true,
		creator_subscriptions_tweet_preview_api_enabled: true,
		highlights_tweets_tab_ui_enabled: true,
		longform_notetweets_consumption_enabled: true,
		tweetypie_unmention_optimization_enabled: true,
		vibe_api_enabled: true,
	};

	// Mapa de nomes em inglês para códigos (usado para parsing da API)
	const COUNTRY_MAP = {
		Afghanistan: "AF", Albania: "AL", Algeria: "DZ", Andorra: "AD", Angola: "AO", Argentina: "AR", Armenia: "AM", Australia: "AU", Austria: "AT", Azerbaijan: "AZ", Bahamas: "BS", Bahrain: "BH", Bangladesh: "BD", Barbados: "BB", Belarus: "BY", Belgium: "BE", Belize: "BZ", Benin: "BJ", Bhutan: "BT", Bolivia: "BO", "Bosnia and Herzegovina": "BA", Botswana: "BW", Brazil: "BR", Bulgaria: "BG", "Burkina Faso": "BF", Burundi: "BI", Cambodia: "KH", Cameroon: "CM", Canada: "CA", Chile: "CL", China: "CN", Colombia: "CO", "Costa Rica": "CR", Croatia: "HR", Cuba: "CU", Cyprus: "CY", Czechia: "CZ", Denmark: "DK", "Dominican Republic": "DO", Ecuador: "EC", Egypt: "EG", "El Salvador": "SV", Estonia: "EE", Ethiopia: "ET", Finland: "FI", France: "FR", Georgia: "GE", Germany: "DE", Ghana: "GH", Greece: "GR", Guatemala: "GT", Honduras: "HN", Hungary: "HU", Iceland: "IS", India: "IN", Indonesia: "ID", Iran: "IR", Iraq: "IQ", Ireland: "IE", Israel: "IL", Italy: "IT", Jamaica: "JM", Japan: "JP", Jordan: "JO", Kazakhstan: "KZ", Kenya: "KE", Kuwait: "KW", Latvia: "LV", Lebanon: "LB", Libya: "LY", Lithuania: "LT", Luxembourg: "LU", Madagascar: "MG", Malaysia: "MY", Maldives: "MV", Mexico: "MX", Monaco: "MC", Morocco: "MA", Nepal: "NP", Netherlands: "NL", "New Zealand": "NZ", Nigeria: "NG", Norway: "NO", Oman: "OM", Pakistan: "PK", Panama: "PA", Paraguay: "PY", Peru: "PE", Philippines: "PH", Poland: "PL", Portugal: "PT", Qatar: "QA", Romania: "RO", Russia: "RU", "Saudi Arabia": "SA", Senegal: "SN", Serbia: "RS", Singapore: "SG", Slovakia: "SK", Slovenia: "SI", "South Africa": "ZA", "South Korea": "KR", Spain: "ES", "Sri Lanka": "LK", Sweden: "SE", Switzerland: "CH", Taiwan: "TW", Thailand: "TH", Tunisia: "TN", Turkey: "TR", Ukraine: "UA", "United Arab Emirates": "AE", "United Kingdom": "GB", "United States": "US", Uruguay: "UY", Venezuela: "VE", Vietnam: "VN", Yemen: "YE", Zimbabwe: "ZW",
	};

	// Nomes dos países em português
	const CODE_TO_COUNTRY = {
		"AF": "Afeganistão", "AL": "Albânia", "DZ": "Argélia", "AD": "Andorra", "AO": "Angola",
		"AR": "Argentina", "AM": "Armênia", "AU": "Austrália", "AT": "Áustria", "AZ": "Azerbaijão",
		"BS": "Bahamas", "BH": "Bahrein", "BD": "Bangladesh", "BB": "Barbados", "BY": "Bielorrússia",
		"BE": "Bélgica", "BZ": "Belize", "BJ": "Benim", "BT": "Butão", "BO": "Bolívia",
		"BA": "Bósnia e Herzegovina", "BW": "Botsuana", "BR": "Brasil", "BG": "Bulgária",
		"BF": "Burkina Faso", "BI": "Burundi", "KH": "Camboja", "CM": "Camarões", "CA": "Canadá",
		"CL": "Chile", "CN": "China", "CO": "Colômbia", "CR": "Costa Rica", "HR": "Croácia",
		"CU": "Cuba", "CY": "Chipre", "CZ": "Tchéquia", "DK": "Dinamarca", "DO": "República Dominicana",
		"EC": "Equador", "EG": "Egito", "SV": "El Salvador", "EE": "Estônia", "ET": "Etiópia",
		"FI": "Finlândia", "FR": "França", "GE": "Geórgia", "DE": "Alemanha", "GH": "Gana",
		"GR": "Grécia", "GT": "Guatemala", "HN": "Honduras", "HU": "Hungria", "IS": "Islândia",
		"IN": "Índia", "ID": "Indonésia", "IR": "Irã", "IQ": "Iraque", "IE": "Irlanda",
		"IL": "Israel", "IT": "Itália", "JM": "Jamaica", "JP": "Japão", "JO": "Jordânia",
		"KZ": "Cazaquistão", "KE": "Quênia", "KW": "Kuwait", "LV": "Letônia", "LB": "Líbano",
		"LY": "Líbia", "LT": "Lituânia", "LU": "Luxemburgo", "MG": "Madagascar", "MY": "Malásia",
		"MV": "Maldivas", "MX": "México", "MC": "Mônaco", "MA": "Marrocos", "NP": "Nepal",
		"NL": "Países Baixos", "NZ": "Nova Zelândia", "NG": "Nigéria", "NO": "Noruega", "OM": "Omã",
		"PK": "Paquistão", "PA": "Panamá", "PY": "Paraguai", "PE": "Peru", "PH": "Filipinas",
		"PL": "Polônia", "PT": "Portugal", "QA": "Catar", "RO": "Romênia", "RU": "Rússia",
		"SA": "Arábia Saudita", "SN": "Senegal", "RS": "Sérvia", "SG": "Singapura", "SK": "Eslováquia",
		"SI": "Eslovênia", "ZA": "África do Sul", "KR": "Coreia do Sul", "ES": "Espanha",
		"LK": "Sri Lanka", "SE": "Suécia", "CH": "Suíça", "TW": "Taiwan", "TH": "Tailândia",
		"TN": "Tunísia", "TR": "Turquia", "UA": "Ucrânia", "AE": "Emirados Árabes Unidos",
		"GB": "Reino Unido", "US": "Estados Unidos", "UY": "Uruguai", "VE": "Venezuela",
		"VN": "Vietnã", "YE": "Iêmen", "ZW": "Zimbábue"
	};

	const LANG_NAMES = {
		hi: "Hindi",
		ta: "Tâmil",
		te: "Telugu",
		kn: "Canarês",
		ml: "Malaiala",
		he: "Hebraico",
		ur: "Urdu",
		pa: "Punjabi",
		ar: "Árabe",
		fa: "Persa",
		ps: "Pashto"
	};

	const LANG_SCRIPTS = {
		hi: /[\u0900-\u097F]/,
		ta: /[\u0B80-\u0BFF]/,
		te: /[\u0C00-\u0C7F]/,
		kn: /[\u0C80-\u0CFF]/,
		ml: /[\u0D00-\u0D7F]/,
		he: /[\u0590-\u05FF]/,
		ur: /[\u0600-\u06FF]/,
		pa: /[\u0A00-\u0A7F]/,
		ar: /[\u0600-\u06FF]/,
		fa: /[\u0600-\u06FF]/,
		ps: /[\u0600-\u06FF]/,
	};

	const REGION_DEFS = [
		{ name: "África", codes: ["DZ", "AO", "BJ", "BW", "BF", "BI", "CM", "CV", "CF", "TD", "KM", "CG", "CD", "DJ", "EG", "GQ", "ER", "ET", "GA", "GM", "GH", "GN", "GW", "CI", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RE", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "SZ", "TZ", "TG", "TN", "UG", "YT", "ZM", "ZW"] },
		{ name: "Oriente Médio e Norte da África", codes: ["IR", "IQ", "IL", "JO", "LB", "SA", "AE", "QA", "BH", "KW", "EG", "MA", "DZ", "TN", "LY", "TR", "OM", "YE", "SY", "PS"] },
		{ name: "Sul da Ásia", codes: ["IN", "PK", "BD", "LK", "NP", "AF", "MV", "BT"] },
		{ name: "Sudeste Asiático", codes: ["SG", "TH", "VN", "MY", "ID", "PH", "KH", "LA", "MM", "BN"] },
		{ name: "Leste Asiático e Pacífico", codes: ["CN", "JP", "KR", "TW", "PH", "ID", "TH", "VN", "MY", "SG", "AU", "NZ", "HK", "MO", "PG", "FJ"] },
		{ name: "América Latina", codes: ["MX", "BR", "AR", "CL", "CO", "PE", "VE", "UY", "PY", "BO", "CR", "PA", "DO", "HN", "GT", "SV", "CU", "EC", "PR", "JM", "TT", "NI"] },
		{ name: "América do Sul", codes: ["AR", "BR", "CL", "CO", "PE", "VE", "UY", "PY", "BO", "EC", "GY", "SR"] },
		{ name: "Europa Oriental", codes: ["RU", "UA", "LV", "RO", "PL", "HU", "BG", "CZ", "SK", "SI", "RS", "HR", "BA", "BY", "LT", "EE", "MD", "GE"] },
		{ name: "Europa Ocidental", codes: ["GB", "FR", "DE", "ES", "PT", "IT", "NL", "BE", "CH", "AT", "IE", "NO", "SE", "DK", "FI", "LU", "GR"] },
		{ name: "Europa", codes: ["GB", "FR", "DE", "ES", "PT", "IT", "NL", "BE", "CH", "AT", "IE", "NO", "SE", "DK", "FI", "LU", "CZ", "PL", "HU", "RO", "BG", "RS", "HR", "SI", "SK", "UA", "LT", "LV", "EE", "GR", "MD", "GE"] },
		{ name: "América do Norte", codes: ["US", "CA", "MX"] },
	];

	function load() {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved);
			config.blockedCountries = new Set(parsed.blockedCountries || []);
			config.blockedLangs = new Set(parsed.blockedLangs || []);
			config.blockedRegions = new Set(parsed.blockedRegions || []);
			config.countryDB = parsed.countryDB || {};
			config.displayMode = ["show", "block", "both"].includes(parsed.displayMode) ? parsed.displayMode : "both";
			config.filterTotals = { ...defaultTotals(), ...(parsed.filterTotals || {}) };
			config.analytics = { ...defaultAnalytics(), ...(parsed.analytics || {}) };
			config.countryFilterEnabled = parsed.countryFilterEnabled !== false;
			config.regionFilterEnabled = parsed.regionFilterEnabled !== false;
			config.langFilterEnabled = parsed.langFilterEnabled !== false;
			if (parsed.knownUsers) {
				config.knownUsers = {};
				for (const [k, v] of Object.entries(parsed.knownUsers)) {
					config.knownUsers[k] = {
						accountCountry: v.accountCountry || null,
						accountRegion: v.accountRegion || null,
						usernameChanges: typeof v.usernameChanges === "number" ? v.usernameChanges : null,
						ts: v.ts || 0,
					};
				}
			}
		}
	}

	function save() {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				blockedCountries: Array.from(config.blockedCountries),
				blockedLangs: Array.from(config.blockedLangs),
				blockedRegions: Array.from(config.blockedRegions),
				countryDB: config.countryDB,
				displayMode: config.displayMode,
				filterTotals: config.filterTotals,
				analytics: config.analytics,
				countryFilterEnabled: config.countryFilterEnabled,
				regionFilterEnabled: config.regionFilterEnabled,
				langFilterEnabled: config.langFilterEnabled,
			}),
		);
	}

	function openDB() {
		if (dbPromise) return dbPromise;
		dbPromise = new Promise((resolve, reject) => {
			const req = indexedDB.open("xcb-country-blocker", 2);
			req.onerror = () => reject(req.error);
			req.onupgradeneeded = () => {
				const db = req.result;
				if (!db.objectStoreNames.contains("known")) {
					db.createObjectStore("known", { keyPath: "user" });
				}
				if (!db.objectStoreNames.contains("stats")) {
					db.createObjectStore("stats", { keyPath: "id" });
				}
			};
			req.onsuccess = () => resolve(req.result);
		});
		return dbPromise;
	}

	async function loadKnownFromDB() {
		try {
			const db = await openDB();
			const tx = db.transaction("known", "readonly");
			const store = tx.objectStore("known");
			const rows = await new Promise((resolve, reject) => {
				const req = store.getAll();
				req.onsuccess = () => resolve(req.result || []);
				req.onerror = () => reject(req.error);
			});
			config.knownUsers = {};
			for (const row of rows) {
				if (!row?.user) continue;
				config.knownUsers[row.user] = {
					accountCountry: row.accountCountry || null,
					accountRegion: row.accountRegion || null,
					usernameChanges: typeof row.usernameChanges === "number" ? row.usernameChanges : null,
					ts: row.ts || 0,
				};
			}
		} catch (e) {
			console.warn("[XCB] loadKnownFromDB failed", e);
		}
	}

	async function saveKnownToDB(user, data) {
		try {
			const db = await openDB();
			const tx = db.transaction("known", "readwrite");
			tx.objectStore("known").put({
				user,
				accountCountry: data.accountCountry || null,
				accountRegion: data.accountRegion || null,
				usernameChanges: typeof data.usernameChanges === "number" ? data.usernameChanges : null,
				ts: data.ts || nowTs(),
			});
		} catch (e) {
			console.warn("[XCB] saveKnownToDB failed", e);
		}
	}

	async function loadTotalsFromDB() {
		try {
			const db = await openDB();
			const tx = db.transaction("stats", "readonly");
			const store = tx.objectStore("stats");
			const totals = await new Promise((resolve, reject) => {
				const req = store.get("totals");
				req.onsuccess = () => resolve(req.result || null);
				req.onerror = () => reject(req.error);
			});
			if (totals) {
				config.filterTotals = {
					overall: totals.overall || 0,
					country: totals.country || {},
					lang: totals.lang || {},
					region: totals.region || {},
					session: totals.session || 0,
				};
				filteredCount = totals.session || 0;
				config.analytics = { ...defaultAnalytics(), ...(totals.analytics || {}) };
			}
		} catch (e) {
			console.warn("[XCB] loadTotalsFromDB failed", e);
		} finally {
			if (!config.filterTotals) config.filterTotals = defaultTotals();
		}
	}

	async function saveTotalsToDB() {
		try {
			const db = await openDB();
			const tx = db.transaction("stats", "readwrite");
			tx.objectStore("stats").put({
				id: "totals",
				overall: config.filterTotals.overall || 0,
				country: config.filterTotals.country || {},
				lang: config.filterTotals.lang || {},
				region: config.filterTotals.region || {},
				session: filteredCount,
				analytics: config.analytics || defaultAnalytics(),
				updated: nowTs(),
			});
		} catch (e) {
			console.warn("[XCB] saveTotalsToDB failed", e);
		}
	}

	function scheduleTotalsSave() {
		if (totalsSaveTimer) return;
		totalsSaveTimer = setTimeout(() => {
			totalsSaveTimer = null;
			config.filterTotals.session = filteredCount;
			save();
			saveTotalsToDB();
		}, 1000);
	}
	load();

	function normUser(u) {
		return (u || "").toLowerCase().replace(/^@/, "");
	}

	function extractUsername(tweet) {
		const link = tweet.querySelector('div[data-testid="User-Name"] a[href]') || tweet.querySelector('a[href*="/status/"]');
		if (!link) return null;
		let href = link.getAttribute("href") || "";
		if (/^https?:\/\//i.test(href)) {
			try {
				href = new URL(href).pathname;
			} catch (e) { }
		}
		const parts = href.split("/").filter(Boolean);
		if (!parts.length) return null;
		const candidate = parts[0];
		if (["i", "home", "explore", "notifications", "messages", "search"].includes(candidate)) return null;
		return normUser(candidate);
	}

	function hasBlockedLang(text) {
		if (!text || !config.langFilterEnabled) return false;
		for (const lang of config.blockedLangs)
			if (LANG_SCRIPTS[lang]?.test(text)) return lang;
		return false;
	}

	function countryCodeToFlag(code) {
		if (!code || typeof code !== "string" || code.length !== 2) return "";
		const upper = code.toUpperCase();
		const a = upper.charCodeAt(0) - 65 + 0x1f1e6;
		const b = upper.charCodeAt(1) - 65 + 0x1f1e6;
		if (a < 0x1f1e6 || b < 0x1f1e6) return "";
		return String.fromCodePoint(a, b);
	}

	function regionFromCountry(code) {
		if (!code) return null;
		const upper = code.toUpperCase();
		for (const def of REGION_DEFS) {
			if (def.codes.includes(upper)) return def.name;
		}
		return null;
	}

	// Renderiza bandeira e nome do país ao lado do nome do usuário
	function renderCountryBadge(tweet, countryCode) {
		// Só mostra se o modo for "show" ou "both"
		const shouldShow = config.displayMode === "show" || config.displayMode === "both";

		const userNameDiv = tweet.querySelector('div[data-testid="User-Name"]');
		if (!userNameDiv) return;

		const existingBadgeId = tweet.dataset.xcbCountryBadgeId;
		if (existingBadgeId) {
			const existing = document.getElementById(existingBadgeId);
			if (existing) {
				if (!countryCode || !shouldShow) {
					existing.remove();
					delete tweet.dataset.xcbCountryBadgeId;
					return;
				}
				const expectedText = `${countryCodeToFlag(countryCode)} [${CODE_TO_COUNTRY[countryCode] || countryCode}]`;
				if (existing.textContent === expectedText) {
					return;
				}
				existing.remove();
				delete tweet.dataset.xcbCountryBadgeId;
			}
		}

		if (!countryCode || !shouldShow) return;

		const flag = countryCodeToFlag(countryCode);
		const countryName = CODE_TO_COUNTRY[countryCode] || countryCode;

		const badge = document.createElement("span");
		const id = `xcb-country-badge-${Math.random().toString(36).slice(2, 9)}`;
		badge.id = id;
		badge.className = "xcb-country-badge";
		badge.textContent = `${flag} [${countryName}]`;
		badge.style.cssText = `
			font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui, -apple-system, sans-serif;
			font-size: 13px;
			color: rgb(113, 118, 123);
			margin-left: 4px;
			white-space: nowrap;
			font-weight: bold;
		`;

		const spans = userNameDiv.querySelectorAll('span:not(.xcb-country-badge)');
		if (spans.length > 0) {
			const lastSpan = spans[spans.length - 1];
			lastSpan.parentNode.insertBefore(badge, lastSpan.nextSibling);
		} else {
			userNameDiv.appendChild(badge);
		}

		tweet.dataset.xcbCountryBadgeId = id;
	}

	function recordSeen(countryCode, regionName, tweet) {
		if (!countryCode && !regionName) return;
		if (tweet?.dataset?.xcbSeenCounted) return;
		tweet.dataset.xcbSeenCounted = "1";
		config.analytics = config.analytics || defaultAnalytics();
		config.analytics.seenTotal = (config.analytics.seenTotal || 0) + 1;
		if (countryCode) config.analytics.seenCountry[countryCode] = (config.analytics.seenCountry[countryCode] || 0) + 1;
		if (regionName) config.analytics.seenRegion[regionName] = (config.analytics.seenRegion[regionName] || 0) + 1;
		scheduleTotalsSave();
	}

	function markChatFlag(container, user, countryCode) {
		if (!user || !countryCode) return;

		const shouldShow = config.displayMode === "show" || config.displayMode === "both";
		if (!shouldShow) return;

		const flag = countryCodeToFlag(countryCode);
		const countryName = CODE_TO_COUNTRY[countryCode] || countryCode;
		if (!flag) return;

		const existingId = container.dataset.xcbChatFlagId;
		if (existingId) {
			const existing = document.getElementById(existingId);
			if (existing) {
				const expectedText = `${flag} [${countryName}]`;
				if (existing.textContent === expectedText) return;
				existing.remove();
			}
		}

		const nameSpan = container.querySelector("span:not([aria-hidden]):not(.xcb-chat-flag)") || container.querySelector("span:not(.xcb-chat-flag)");
		if (!nameSpan) return;

		const badge = document.createElement("span");
		const id = `xcb-chat-flag-${Math.random().toString(36).slice(2, 9)}`;
		badge.id = id;
		badge.className = "xcb-chat-flag";
		badge.textContent = `${flag} [${countryName}]`;
		badge.style.cssText = `
			font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", system-ui, -apple-system, sans-serif;
			margin-left: 6px;
			font-size: 13px;
			color: rgb(113, 118, 123);
			font-weight: bold;
		`;
		nameSpan.insertAdjacentElement("afterend", badge);
		container.dataset.xcbChatFlagId = id;
	}

	function scanChatFlags() {
		if (!window.location.pathname.startsWith("/messages")) return;
		const targets = document.querySelectorAll('div[data-testid="DMDrawer"] div[data-testid="User-Name"], div[data-testid="DMConversation"] div[data-testid="User-Name"], div[aria-label^="Conversation"] div[data-testid="User-Name"], div[data-testid="DMChat"] div[data-testid="User-Name"]');
		targets.forEach((node) => {
			const userKey = extractUsername(node);
			if (!userKey) return;
			const info = config.knownUsers[userKey];
			const code = info?.accountCountry || null;
			if (code) {
				markChatFlag(node, userKey, code);
				recordSeen(code, info?.accountRegion || null, node);
			} else if (needsFetch(userKey)) {
				queueUser(userKey);
			}
		});
	}

	function updateFilteredDisplay() {
		const counterEl = document.getElementById("xcb-blocked-count");
		if (counterEl)
			counterEl.textContent = `Detectados nesta sessão: ${filteredCount} | Total Ocultos: ${config.filterTotals?.overall || 0}`;
	}

	function clearFilterMark(tweet) {
		const noteId = tweet.dataset.xcbNoteId;
		if (noteId) {
			const noteEl = document.getElementById(noteId);
			if (noteEl) noteEl.remove();
		}
		if (tweet.dataset.xcbPrevDisplay !== undefined) {
			tweet.style.display = tweet.dataset.xcbPrevDisplay;
			delete tweet.dataset.xcbPrevDisplay;
		} else if (tweet.dataset.xcbMode === "block") {
			tweet.style.removeProperty("display");
		}
		delete tweet.dataset.xcbMode;
		delete tweet.dataset.xcbReason;
		delete tweet.dataset.blocked;
		delete tweet.dataset.xcbNoteId;
	}

	function markBlocked(tweet, reason) {
		tweet.dataset.blocked = "1";
		tweet.dataset.xcbMode = "block";
		tweet.dataset.xcbReason = reason;
		tweet.dataset.xcbPrevDisplay = tweet.style.display || "";
		tweet.style.setProperty("display", "none", "important");
		console.log("[CleanX] Bloqueado:", reason);
	}

	function bumpCounts({ countryCode, lang, region }) {
		config.filterTotals = config.filterTotals || defaultTotals();
		if (countryCode) {
			blockStats.country[countryCode] = (blockStats.country[countryCode] || 0) + 1;
			config.filterTotals.country[countryCode] = (config.filterTotals.country[countryCode] || 0) + 1;
		}
		if (lang) {
			blockStats.lang[lang] = (blockStats.lang[lang] || 0) + 1;
			config.filterTotals.lang[lang] = (config.filterTotals.lang[lang] || 0) + 1;
		}
		if (region) {
			blockStats.region[region] = (blockStats.region[region] || 0) + 1;
			config.filterTotals.region[region] = (config.filterTotals.region[region] || 0) + 1;
		}
		config.filterTotals.overall = (config.filterTotals.overall || 0) + 1;
		config.filterTotals.session = filteredCount;
	}

	function applyFilterAction(tweet, info) {
		// Só bloqueia se o modo for "block" ou "both"
		const shouldBlock = config.displayMode === "block" || config.displayMode === "both";
		if (!shouldBlock) return;

		const reason = info?.reason;
		const countryCode = info?.countryCode;
		const lang = info?.lang || null;
		const region = info?.region || null;
		const prevMode = tweet.dataset.xcbMode;
		const prevReason = tweet.dataset.xcbReason;
		if (prevMode === "block" && prevReason === reason) return;

		clearFilterMark(tweet);
		if (!reason) return;

		if (!tweet.dataset.xcbCounted) {
			filteredCount += 1;
			tweet.dataset.xcbCounted = "1";
			bumpCounts({ countryCode, lang, region });
			updateFilteredDisplay();
			scheduleTotalsSave();
		}

		markBlocked(tweet, reason);
	}

	function parseProfileFromJson(obj) {
		if (!obj || typeof obj !== "object") return { accountCountry: null };
		const result =
			obj.user?.result ||
			obj.user_result_by_screen_name?.result ||
			obj.about_account?.result ||
			obj.data?.user?.result ||
			obj.data?.user_result_by_screen_name?.result ||
			obj.data?.about_account?.result ||
			obj.data?.user;

		if (!result) return { accountCountry: null };

		const about = result.aboutModule || result.about || result.legacy?.about || result.about_account || result;
		const aboutProfile = result.about_profile || result.aboutProfile || result.profile || result.profile_about || {};

		const accountCountryRaw = about?.accountBasedIn || about?.account_based_in || about?.account_base || about?.accountCountry || aboutProfile?.account_based_in || aboutProfile?.accountBasedIn || null;
		const accountRegionRaw = about?.accountRegion || about?.account_region || aboutProfile?.account_region || aboutProfile?.accountRegion || null;
		const usernameChangesRaw = aboutProfile?.usernameChangeCount || aboutProfile?.username_changes || aboutProfile?.screen_name_change_count || about?.usernameChangeCount || about?.username_changes || about?.screen_name_change_count || result.legacy?.screen_name_change_count || null;

		const accountCountry = accountCountryRaw ? COUNTRY_MAP[accountCountryRaw] || accountCountryRaw.slice(0, 2).toUpperCase() : null;
		const accountRegion = typeof accountRegionRaw === "string" && accountRegionRaw.trim() ? accountRegionRaw.trim() : null;
		const usernameChanges = typeof usernameChangesRaw === "number" ? usernameChangesRaw : Number.isFinite(Number(usernameChangesRaw)) ? Number(usernameChangesRaw) : null;

		return { accountCountry, accountRegion, usernameChanges };
	}

	function getCsrfToken() {
		const match = document.cookie.match(/(?:^|; )ct0=([^;]+)/);
		return match ? match[1] : "";
	}

	function needsFetch(user) {
		if (!user) return false;
		// Sempre busca se algum filtro está ativo OU se displayMode inclui mostrar país
		const hasFilters = config.blockedCountries.size > 0 || config.blockedLangs.size > 0 || config.blockedRegions.size > 0;
		const wantsToShow = config.displayMode === "show" || config.displayMode === "both";
		if (!hasFilters && !wantsToShow) return false;

		const known = config.knownUsers[user];
		if (!known) return true;
		if (known.accountCountry) return false;
		if (known.accountRegion) {
			if (known.ts && nowTs() - known.ts < UNKNOWN_RETRY_MS) return false;
			return true;
		}
		if (known.ts && nowTs() - known.ts < UNKNOWN_RETRY_MS) return false;
		return true;
	}

	function queueUser(user) {
		const u = normUser(user);
		if (!needsFetch(u)) return;
		if (config.pending.has(u)) return;
		if (fetchQueue.includes(u)) return;
		fetchQueue.push(u);
	}

	function fetchCountry(username) {
		const user = normUser(username);
		if (!user) return false;

		const known = config.knownUsers[user];
		if (known) {
			if (known.accountCountry) return;
			if (known.ts && nowTs() - known.ts < UNKNOWN_RETRY_MS) return;
		}
		if (config.pending.has(user)) return false;

		const hasFilters = config.blockedCountries.size > 0 || config.blockedLangs.size > 0 || config.blockedRegions.size > 0;
		const wantsToShow = config.displayMode === "show" || config.displayMode === "both";
		if (!hasFilters && !wantsToShow) return false;

		const now = nowTs();
		if (now < nextFetchAllowed) {
			config.knownUsers[user] = { accountCountry: null, ts: now };
			return false;
		}

		config.pending.add(user);
		console.log("[XCB] fetching about page for", user);
		const host = window.location.host || "x.com";
		const url = `https://${host}/i/api/graphql/${ABOUT_QUERY_ID}/AboutAccountQuery?variables=${encodeURIComponent(JSON.stringify({ screenName: user }))}&features=${encodeURIComponent(JSON.stringify(GRAPHQL_FEATURES))}&fieldToggles=${encodeURIComponent(JSON.stringify(FIELD_TOGGLES))}`;

		fetch(url, {
			credentials: "include",
			method: "GET",
			headers: {
				"x-csrf-token": getCsrfToken(),
				authorization: `Bearer ${BEARER_TOKEN}`,
				"content-type": "application/json",
				"x-twitter-active-user": "yes",
				"x-twitter-auth-type": "OAuth2Session",
				"x-twitter-client-language": navigator.language || "en",
				"x-client-transaction-id": Math.random().toString(36).slice(2, 10),
				referer: `https://${host}/${user}`,
			},
		})
			.then((resp) => resp.json().then((body) => ({ status: resp.status, body })).catch(() => ({ status: resp.status, body: {} })))
			.then(({ status, body }) => {
				if (status === 429) {
					nextFetchAllowed = Math.max(nextFetchAllowed, nowTs() + RATE_LIMIT_BACKOFF_MS);
					config.pending.delete(user);
					queueUser(user);
					return;
				}
				if (status >= 400) {
					console.warn("[XCB] about query failed", status, body?.errors);
					config.pending.delete(user);
					return;
				}
				const info = parseProfileFromJson(body);
				console.log("[XCB] about json", user, info);
				if (!info.accountCountry && !info.accountRegion) {
					config.knownUsers[user] = {
						accountCountry: null,
						accountRegion: info.accountRegion || null,
						usernameChanges: info.usernameChanges ?? null,
						ts: nowTs(),
					};
					save();
					return;
				}
				config.knownUsers[user] = {
					accountCountry: info.accountCountry || null,
					accountRegion: info.accountRegion || null,
					usernameChanges: info.usernameChanges ?? null,
					ts: nowTs(),
				};
				saveKnownToDB(user, config.knownUsers[user]);
				if (info.accountCountry) {
					const code = info.accountCountry;
					if (!config.countryDB[code]) config.countryDB[code] = [];
					if (!config.countryDB[code].includes(user)) config.countryDB[code].push(user);
					if (config.blockedCountries.has(code) && config.countryFilterEnabled) scanAndHide();
				}
				save();
			})
			.catch((err) => {
				console.error("[XCB] fetch about failed", user, err);
			})
			.finally(() => {
				config.pending.delete(user);
				nextFetchAllowed = Math.max(nextFetchAllowed, nowTs() + FETCH_GAP_MS);
			});
		return true;
	}

	function scanAndHide() {
		const tweets = document.querySelectorAll('article[data-testid="tweet"]');
		const now = nowTs();
		const shouldBlock = config.displayMode === "block" || config.displayMode === "both";

		tweets.forEach((tweet) => {
			const lastScan = parseInt(tweet.dataset.xcbLastScan || '0', 10);
			if (now - lastScan < 500) return;
			tweet.dataset.xcbLastScan = String(now);

			const userKey = extractUsername(tweet);
			if (!userKey) return;
			const text = tweet.querySelector('[data-testid="tweetText"]')?.textContent || "";

			let reason = "";
			let countryCode = null;
			let langMatch = null;
			let regionName = null;

			const userInfo = config.knownUsers[userKey];
			const accountCountry = userInfo?.accountCountry || null;
			regionName = userInfo?.accountRegion || (userInfo?.accountCountry ? regionFromCountry(userInfo.accountCountry) : null);
			if (userInfo?.accountRegion && !regionName) regionName = userInfo.accountRegion;

			// Verificação de idioma (independente)
			if (config.langFilterEnabled && shouldBlock) {
				langMatch = hasBlockedLang(text);
				if (langMatch) {
					reason = `Idioma:${LANG_NAMES[langMatch] || langMatch}`;
				}
			}

			// Verificação de país (independente)
			if (config.countryFilterEnabled && shouldBlock && userInfo && accountCountry && config.blockedCountries.has(accountCountry)) {
				countryCode = accountCountry;
				reason = reason ? `${reason} + País:${CODE_TO_COUNTRY[accountCountry] || accountCountry}` : `País:${CODE_TO_COUNTRY[accountCountry] || accountCountry}`;
			}

			// Verificação de região (independente)
			if (config.regionFilterEnabled && shouldBlock && regionName && config.blockedRegions.has(regionName)) {
				reason = reason ? `${reason} + Região:${regionName}` : `Região:${regionName}`;
			}

			if (accountCountry || regionName) {
				recordSeen(accountCountry, regionName, tweet);
			}

			if (!userInfo || (!userInfo.accountCountry && (!userInfo.ts || now - userInfo.ts >= UNKNOWN_RETRY_MS))) {
				queueUser(userKey);
			}

			// Renderiza badge do país ao lado do nome
			renderCountryBadge(tweet, accountCountry);

			if (!reason && (tweet.dataset.xcbMode || tweet.dataset.blocked)) {
				clearFilterMark(tweet);
			}

			if (reason) {
				applyFilterAction(tweet, {
					reason,
					countryCode,
					lang: langMatch,
					region: config.regionFilterEnabled && config.blockedRegions.has(regionName || "") ? regionName : null
				});
			}
		});
	}

	function processQueue() {
		const now = nowTs();
		if (now < nextFetchAllowed) return;
		let processed = 0;
		while (fetchQueue.length && processed < PREFETCH_BATCH) {
			const user = fetchQueue.shift();
			if (!needsFetch(user)) continue;
			const started = fetchCountry(user);
			if (!started) {
				if (!config.pending.has(user)) fetchQueue.unshift(user);
				break;
			}
			processed += 1;
		}
	}

	function ensureSidebarButton(openModal) {
		const existing = document.getElementById("xcb-button");
		const nav = document.querySelector('nav[role="navigation"]');
		if (!nav) return false;

		const allLinks = nav.querySelectorAll('a[href]');
		let homeLink = null;
		let profileLink = null;

		for (const link of allLinks) {
			const href = link.getAttribute('href') || '';
			if (href === '/home') homeLink = link;
			if (href.match(/^\/[a-zA-Z0-9_]+$/) && !href.includes('/')) {
				profileLink = link;
			}
		}

		const moreEntry = nav.querySelector('[data-testid="AppTabBar_More_Menu"]') ||
			nav.querySelector('div[role="button"]');

		const anchorRef = moreEntry || profileLink || homeLink || allLinks[0];
		if (!anchorRef) return false;
		const parent = (anchorRef.closest("a, div, button") || anchorRef).parentElement || nav;
		if (!parent) return false;
		const btn = existing || document.createElement("a");
		btn.id = "xcb-button";
		btn.setAttribute("role", "button");
		btn.href = "javascript:void(0)";
		btn.innerHTML = '<span class="xcb-icon" style="font-size:22px;line-height:22px;">🚫</span><span class="xcb-label" style="font-size:18px;font-weight:700;">CleanX</span>';
		btn.style = "display:flex;align-items:center;gap:14px;padding:12px;border-radius:9999px;color:#e7e9ea;text-decoration:none;font-size:17px;font-weight:700;cursor:pointer;max-width:260px;min-width:52px;box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif;";
		btn.onmouseenter = () => { btn.style.backgroundColor = "rgba(255,255,255,0.08)"; };
		btn.onmouseleave = () => { btn.style.backgroundColor = "transparent"; };
		btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openModal(); };
		btn.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(); } };
		const label = btn.querySelector(".xcb-label");
		const updateLabelVisibility = () => {
			if (!label) return;
			label.style.display = (nav.getBoundingClientRect().width || 0) > 80 ? "inline" : "none";
		};
		updateLabelVisibility();
		if (typeof ResizeObserver !== "undefined") {
			const ro = new ResizeObserver(updateLabelVisibility);
			ro.observe(nav);
		} else {
			window.addEventListener("resize", updateLabelVisibility);
		}
		if (btn.parentElement !== parent) {
			if (moreEntry && moreEntry.parentElement === parent) {
				parent.insertBefore(btn, moreEntry);
			} else if (profileLink && profileLink.parentElement === parent) {
				parent.insertBefore(btn, profileLink.nextSibling);
			} else if (homeLink && homeLink.parentElement === parent) {
				parent.insertBefore(btn, homeLink.nextSibling);
			} else {
				parent.appendChild(btn);
			}
		}
		return true;
	}

	function injectUI() {
		if (document.getElementById("xcb-modal")) return;
		const modal = document.createElement("div");
		modal.id = "xcb-modal";
		modal.style.cssText = `
			display: none;
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.6);
			backdrop-filter: blur(8px);
			-webkit-backdrop-filter: blur(8px);
			z-index: 10000;
			align-items: center;
			justify-content: center;
			font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		`;

		modal.innerHTML = `
		<div id="xcb-modal-content" style="
			background: #1a1a2e;
			color: #e0e0e0;
			padding: 28px 32px;
			border-radius: 16px;
			max-width: 600px;
			width: 94%;
			max-height: 88vh;
			overflow-y: auto;
			box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
			border: 1px solid rgba(255, 255, 255, 0.1);
		">
			<h2 style="margin: 0 0 8px; text-align: center; font-size: 24px; font-weight: 600; letter-spacing: -0.5px; color: #fff;">
				🚫 CleanX
			</h2>
			<p style="text-align: center; font-size: 13px; color: #888; margin: 0 0 20px;">
				Bloqueador de País, Região e Idioma para X/Twitter
			</p>
			
			<!-- MODO DE EXIBIÇÃO -->
			<div style="margin-bottom: 20px; padding: 16px; background: rgba(29, 155, 240, 0.1); border-radius: 12px; border: 1px solid rgba(29, 155, 240, 0.2);">
				<div style="font-weight: 600; font-size: 15px; margin-bottom: 12px; color: #1d9bf0;">Modo de Operação</div>
				<div style="display: flex; flex-direction: column; gap: 8px;">
					<label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 8px;">
						<input type="radio" name="xcb-display-mode" value="show" style="width: 16px; height: 16px; accent-color: #1d9bf0;">
						<span><strong>Apenas mostrar país</strong> — Exibe a bandeira ao lado do nome, sem bloquear</span>
					</label>
					<label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 8px;">
						<input type="radio" name="xcb-display-mode" value="block" style="width: 16px; height: 16px; accent-color: #1d9bf0;">
						<span><strong>Apenas bloquear</strong> — Oculta posts dos países/regiões/idiomas selecionados</span>
					</label>
					<label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 8px;">
						<input type="radio" name="xcb-display-mode" value="both" style="width: 16px; height: 16px; accent-color: #1d9bf0;">
						<span><strong>Mostrar e bloquear</strong> — Exibe bandeiras E bloqueia os selecionados</span>
					</label>
				</div>
			</div>
			
			<!-- PAÍSES -->
			<div style="margin-bottom: 20px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
				<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
					<label style="display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 15px; cursor: pointer;">
						<input type="checkbox" id="xcb-toggle-country" style="width: 18px; height: 18px; accent-color: #1d9bf0;">
						Países
					</label>
					<div style="display: flex; gap: 6px;">
						<button id="btn-add-all-c" style="padding: 6px 10px; font-size: 11px; background: #2a3a4a; border: none; border-radius: 6px; color: #aaa; cursor: pointer;">Adicionar Todos</button>
						<button id="btn-clear-c" style="padding: 6px 10px; font-size: 11px; background: #3a2a2a; border: none; border-radius: 6px; color: #f88; cursor: pointer;">Limpar</button>
					</div>
				</div>
				<div id="list-c" style="max-height: 140px; overflow-y: auto; margin-bottom: 10px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 8px; font-size: 13px;"></div>
				<div style="display: flex; gap: 8px;">
					<select id="select-c" style="flex: 1; padding: 10px 12px; border-radius: 8px; background: #252540; color: #fff; border: 1px solid rgba(255,255,255,0.1); font-size: 14px;">
						<option value="">Selecione um país...</option>
					</select>
					<button id="btn-add-c" style="padding: 10px 20px; border-radius: 8px; background: #1d9bf0; color: #fff; border: none; cursor: pointer; font-weight: 600; font-size: 14px;">Adicionar</button>
				</div>
			</div>
			
			<!-- REGIÕES -->
			<div style="margin-bottom: 20px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
				<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
					<label style="display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 15px; cursor: pointer;">
						<input type="checkbox" id="xcb-toggle-region" style="width: 18px; height: 18px; accent-color: #1d9bf0;">
						Regiões
					</label>
					<div style="display: flex; gap: 6px;">
						<button id="btn-add-all-r" style="padding: 6px 10px; font-size: 11px; background: #2a3a4a; border: none; border-radius: 6px; color: #aaa; cursor: pointer;">Adicionar Todas</button>
						<button id="btn-clear-r" style="padding: 6px 10px; font-size: 11px; background: #3a2a2a; border: none; border-radius: 6px; color: #f88; cursor: pointer;">Limpar</button>
					</div>
				</div>
				<div id="list-r" style="max-height: 140px; overflow-y: auto; margin-bottom: 10px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 8px; font-size: 13px;"></div>
				<div style="display: flex; gap: 8px;">
					<select id="select-r" style="flex: 1; padding: 10px 12px; border-radius: 8px; background: #252540; color: #fff; border: 1px solid rgba(255,255,255,0.1); font-size: 14px;">
						<option value="">Selecione uma região...</option>
					</select>
					<button id="btn-add-r" style="padding: 10px 20px; border-radius: 8px; background: #1d9bf0; color: #fff; border: none; cursor: pointer; font-weight: 600; font-size: 14px;">Adicionar</button>
				</div>
			</div>
			
			<!-- IDIOMAS -->
			<div style="margin-bottom: 20px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
				<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
					<label style="display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 15px; cursor: pointer;">
						<input type="checkbox" id="xcb-toggle-lang" style="width: 18px; height: 18px; accent-color: #1d9bf0;">
						Idiomas
					</label>
					<div style="display: flex; gap: 6px;">
						<button id="btn-add-all-l" style="padding: 6px 10px; font-size: 11px; background: #2a3a4a; border: none; border-radius: 6px; color: #aaa; cursor: pointer;">Adicionar Todos</button>
						<button id="btn-clear-l" style="padding: 6px 10px; font-size: 11px; background: #3a2a2a; border: none; border-radius: 6px; color: #f88; cursor: pointer;">Limpar</button>
					</div>
				</div>
				<div id="list-l" style="max-height: 140px; overflow-y: auto; margin-bottom: 10px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 8px; font-size: 13px;"></div>
				<div style="display: flex; gap: 8px;">
					<select id="select-l" style="flex: 1; padding: 10px 12px; border-radius: 8px; background: #252540; color: #fff; border: 1px solid rgba(255,255,255,0.1); font-size: 14px;">
						<option value="">Selecione um idioma...</option>
					</select>
					<button id="btn-add-l" style="padding: 10px 20px; border-radius: 8px; background: #1d9bf0; color: #fff; border: none; cursor: pointer; font-weight: 600; font-size: 14px;">Adicionar</button>
				</div>
			</div>
			
			<!-- ESTATÍSTICAS -->
			<div style="margin-bottom: 16px; padding: 14px; background: rgba(29, 155, 240, 0.08); border-radius: 10px; border: 1px solid rgba(29, 155, 240, 0.2);">
				<div id="xcb-blocked-count" style="font-size: 14px; font-weight: 500; color: #1d9bf0; margin-bottom: 8px;">
					Detectados nesta sessão: 0 | Total Ocultos: 0
				</div>
				<div id="xcb-analytics" style="font-size: 12px; color: #888; line-height: 1.6;">Carregando estatísticas...</div>
			</div>
			
			<!-- STATUS -->
			<div id="xcb-status" style="margin-bottom: 16px; font-size: 12px; color: #4ade80; min-height: 18px;"></div>
			
			<!-- RODAPÉ COM BOTÕES -->
			<div style="display: flex; gap: 10px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08);">
				<button id="xcb-save" style="flex: 1; padding: 12px; background: #22c55e; border: none; border-radius: 10px; color: #fff; cursor: pointer; font-weight: 600; font-size: 14px;">
					💾 Salvar
				</button>
				<button id="xcb-close" style="flex: 1; padding: 12px; background: #525252; border: none; border-radius: 10px; color: #fff; cursor: pointer; font-weight: 600; font-size: 14px;">
					✕ Fechar
				</button>
			</div>
		</div>`;

		document.body.appendChild(modal);

		updateFilteredDisplay();
		const setStatus = (msg) => {
			const statusEl = document.getElementById("xcb-status");
			if (statusEl) statusEl.textContent = msg || "";
		};

		// Populate Dropdowns
		const selC = document.getElementById("select-c");
		Object.entries(CODE_TO_COUNTRY).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).forEach(([code, name]) => {
			const opt = document.createElement("option");
			opt.value = code;
			opt.textContent = `${countryCodeToFlag(code)} ${name}`;
			selC.appendChild(opt);
		});

		const selR = document.getElementById("select-r");
		REGION_DEFS.sort((a, b) => a.name.localeCompare(b.name)).forEach(def => {
			const opt = document.createElement("option");
			opt.value = def.name;
			opt.textContent = def.name;
			selR.appendChild(opt);
		});

		const selL = document.getElementById("select-l");
		Object.keys(LANG_SCRIPTS).sort().forEach(code => {
			const opt = document.createElement("option");
			opt.value = code;
			opt.textContent = LANG_NAMES[code] || code;
			selL.appendChild(opt);
		});

		// Display mode handlers
		modal.querySelectorAll('input[name="xcb-display-mode"]').forEach((input) => {
			input.checked = input.value === config.displayMode;
			input.addEventListener("change", () => {
				if (!input.checked) return;
				config.displayMode = input.value;
				save();
				const modeNames = { show: "Apenas mostrar país", block: "Apenas bloquear", both: "Mostrar e bloquear" };
				setStatus(`Modo alterado: ${modeNames[config.displayMode]}`);
				// Limpa marcações e refaz o scan
				document.querySelectorAll('article[data-testid="tweet"]').forEach(t => {
					clearFilterMark(t);
					delete t.dataset.xcbLastScan;
					delete t.dataset.xcbCountryBadgeId;
					const badge = t.querySelector('.xcb-country-badge');
					if (badge) badge.remove();
				});
				safeScan();
				updateFilteredDisplay();
			});
		});

		// Toggle handlers
		const toggleCountry = document.getElementById("xcb-toggle-country");
		const toggleRegion = document.getElementById("xcb-toggle-region");
		const toggleLang = document.getElementById("xcb-toggle-lang");

		toggleCountry.checked = config.countryFilterEnabled;
		toggleRegion.checked = config.regionFilterEnabled;
		toggleLang.checked = config.langFilterEnabled;

		toggleCountry.addEventListener("change", () => {
			config.countryFilterEnabled = toggleCountry.checked;
			save();
			setStatus(config.countryFilterEnabled ? "Filtro de países ativado" : "Filtro de países desativado");
			document.querySelectorAll('article[data-testid="tweet"]').forEach(t => clearFilterMark(t));
			safeScan();
		});

		toggleRegion.addEventListener("change", () => {
			config.regionFilterEnabled = toggleRegion.checked;
			save();
			setStatus(config.regionFilterEnabled ? "Filtro de regiões ativado" : "Filtro de regiões desativado");
			document.querySelectorAll('article[data-testid="tweet"]').forEach(t => clearFilterMark(t));
			safeScan();
		});

		toggleLang.addEventListener("change", () => {
			config.langFilterEnabled = toggleLang.checked;
			save();
			setStatus(config.langFilterEnabled ? "Filtro de idiomas ativado" : "Filtro de idiomas desativado");
			document.querySelectorAll('article[data-testid="tweet"]').forEach(t => clearFilterMark(t));
			safeScan();
		});

		const refreshList = () => {
			const countryList = document.getElementById("list-c");
			countryList.innerHTML = "";
			if (config.blockedCountries.size === 0) {
				countryList.innerHTML = '<span style="color:#666;">Nenhum país na lista</span>';
			} else {
				Array.from(config.blockedCountries).sort().forEach((c) => {
					const row = document.createElement("div");
					row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin:2px 0;background:rgba(255,255,255,0.03);border-radius:6px;";
					const countryName = CODE_TO_COUNTRY[c] || c;
					row.innerHTML = `<span>${countryCodeToFlag(c)} ${countryName} <span style="color:#666;">(S:${blockStats.country[c] || 0} | T:${config.filterTotals?.country?.[c] || 0})</span></span><span style="cursor:pointer;color:#f66;font-size:16px;padding:0 4px;">×</span>`;
					row.lastChild.addEventListener("click", () => {
						config.blockedCountries.delete(c);
						save();
						refreshList();
						safeScan();
						setStatus(`País removido: ${countryName}`);
					});
					countryList.appendChild(row);
				});
			}

			const regionList = document.getElementById("list-r");
			regionList.innerHTML = "";
			if (config.blockedRegions.size === 0) {
				regionList.innerHTML = '<span style="color:#666;">Nenhuma região na lista</span>';
			} else {
				Array.from(config.blockedRegions).sort().forEach((r) => {
					const row = document.createElement("div");
					row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin:2px 0;background:rgba(255,255,255,0.03);border-radius:6px;";
					row.innerHTML = `<span>${r} <span style="color:#666;">(S:${blockStats.region[r] || 0} | T:${config.filterTotals?.region?.[r] || 0})</span></span><span style="cursor:pointer;color:#f66;font-size:16px;padding:0 4px;">×</span>`;
					row.lastChild.addEventListener("click", () => {
						config.blockedRegions.delete(r);
						save();
						refreshList();
						safeScan();
						setStatus(`Região removida: ${r}`);
					});
					regionList.appendChild(row);
				});
			}

			const langList = document.getElementById("list-l");
			langList.innerHTML = "";
			if (config.blockedLangs.size === 0) {
				langList.innerHTML = '<span style="color:#666;">Nenhum idioma na lista</span>';
			} else {
				Array.from(config.blockedLangs).sort().forEach((l) => {
					const row = document.createElement("div");
					row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin:2px 0;background:rgba(255,255,255,0.03);border-radius:6px;";
					row.innerHTML = `<span>${LANG_NAMES[l] || l} <span style="color:#666;">(S:${blockStats.lang[l] || 0} | T:${config.filterTotals?.lang?.[l] || 0})</span></span><span style="cursor:pointer;color:#f66;font-size:16px;padding:0 4px;">×</span>`;
					row.lastChild.addEventListener("click", () => {
						config.blockedLangs.delete(l);
						save();
						refreshList();
						safeScan();
						setStatus(`Idioma removido: ${l}`);
					});
					langList.appendChild(row);
				});
			}

			const analyticsDiv = document.getElementById("xcb-analytics");
			if (analyticsDiv) {
				const topCountries = Object.entries(config.analytics?.seenCountry || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([code, count]) => `${countryCodeToFlag(code)} ${CODE_TO_COUNTRY[code] || code} (${count})`).join(", ");
				const topRegions = Object.entries(config.analytics?.seenRegion || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => `${name} (${count})`).join(", ");
				analyticsDiv.innerHTML = `
					<div><strong>Vistos (total):</strong> ${config.analytics?.seenTotal || 0}</div>
					<div><strong>Principais países:</strong> ${topCountries || "—"}</div>
					<div><strong>Principais regiões:</strong> ${topRegions || "—"}</div>
				`;
			}
		};

		const openModal = () => { modal.style.display = "flex"; refreshList(); updateFilteredDisplay(); };
		const closeModal = () => (modal.style.display = "none");

		const placeButton = () => { if (!ensureSidebarButton(openModal)) setTimeout(placeButton, 700); };
		placeButton();
		modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
		document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); openModal(); } if (e.key === "Escape") closeModal(); });

		// Botões do rodapé
		document.getElementById("xcb-close").onclick = () => closeModal();
		document.getElementById("xcb-save").onclick = () => {
			save();
			saveTotalsToDB();
			setStatus("Configurações salvas com sucesso!");
		};

		// Botões de adicionar
		document.getElementById("btn-add-c").onclick = () => {
			const code = document.getElementById("select-c").value;
			if (!code) return;
			config.blockedCountries.add(code);
			save(); refreshList(); safeScan();
			setStatus(`País adicionado: ${CODE_TO_COUNTRY[code] || code}`);
		};

		document.getElementById("btn-add-r").onclick = () => {
			const val = document.getElementById("select-r").value;
			if (!val) return;
			config.blockedRegions.add(val);
			save(); refreshList(); safeScan();
			setStatus(`Região adicionada: ${val}`);
		};

		document.getElementById("btn-add-l").onclick = () => {
			const val = document.getElementById("select-l").value;
			if (!val) return;
			config.blockedLangs.add(val);
			save(); refreshList(); safeScan();
			setStatus(`Idioma adicionado: ${LANG_NAMES[val] || val}`);
		};

		// Botões "Adicionar Todos"
		document.getElementById("btn-add-all-c").onclick = () => {
			Object.values(COUNTRY_MAP).forEach(code => config.blockedCountries.add(code));
			save(); refreshList(); safeScan();
			setStatus("Todos os países adicionados!");
		};

		document.getElementById("btn-add-all-r").onclick = () => {
			REGION_DEFS.forEach(def => config.blockedRegions.add(def.name));
			save(); refreshList(); safeScan();
			setStatus("Todas as regiões adicionadas!");
		};

		document.getElementById("btn-add-all-l").onclick = () => {
			Object.keys(LANG_SCRIPTS).forEach(code => config.blockedLangs.add(code));
			save(); refreshList(); safeScan();
			setStatus("Todos os idiomas adicionados!");
		};

		// Botões "Limpar"
		document.getElementById("btn-clear-c").onclick = () => {
			config.blockedCountries.clear();
			save(); refreshList();
			document.querySelectorAll('article[data-testid="tweet"]').forEach(t => clearFilterMark(t));
			safeScan();
			setStatus("Lista de países limpa!");
		};

		document.getElementById("btn-clear-r").onclick = () => {
			config.blockedRegions.clear();
			save(); refreshList();
			document.querySelectorAll('article[data-testid="tweet"]').forEach(t => clearFilterMark(t));
			safeScan();
			setStatus("Lista de regiões limpa!");
		};

		document.getElementById("btn-clear-l").onclick = () => {
			config.blockedLangs.clear();
			save(); refreshList();
			document.querySelectorAll('article[data-testid="tweet"]').forEach(t => clearFilterMark(t));
			safeScan();
			setStatus("Lista de idiomas limpa!");
		};
	}

	function debouncedScan() {
		if (scanDebounceTimer) return;
		scanDebounceTimer = setTimeout(() => {
			scanDebounceTimer = null;
			safeScan();
		}, 300);
	}

	function start() {
		const target = document.body || document.documentElement;
		if (!target) { document.addEventListener("DOMContentLoaded", start, { once: true }); return; }

		const observer = new MutationObserver((mutations) => {
			const dominated = mutations.every(m => {
				if (m.type === 'childList') {
					for (const node of m.addedNodes) {
						if (node.nodeType === 1 && (node.id?.startsWith('xcb-') || node.className?.includes?.('xcb-'))) {
							return true;
						}
					}
				}
				return false;
			});
			if (dominated) return;
			debouncedScan();
		});
		observer.observe(target, { childList: true, subtree: true });
		setInterval(safeScan, 5000);
		setInterval(processQueue, PREFETCH_INTERVAL_MS);
		setTimeout(() => { safeScan(); processQueue(); injectUI(); }, 1500);
	}

	function safeScan() {
		if (isScanning) return;
		isScanning = true;
		try {
			scanAndHide();
			scanChatFlags();
		} catch (e) {
			console.error("[CleanX] scan error", e);
		} finally {
			isScanning = false;
		}
	}

	Promise.all([loadKnownFromDB(), loadTotalsFromDB()]).finally(() => start());

	console.log("CleanX v6.1 (PT-BR Swiss Design) pronto");
})();
