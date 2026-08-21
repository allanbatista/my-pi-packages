import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT_SETTINGS_FILES = [".pi/settings.json", ".omp/settings.json"];
const GLOBAL_SETTINGS_FILES = [
	join(homedir(), ".pi/agent/settings.json"),
	join(homedir(), ".omp/agent/settings.json"),
];

const DEFAULT_PROVIDERS = [];

function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function getPromptCacheKey(sessionId) {
	if (typeof sessionId !== "string" || sessionId.trim() === "") return undefined;
	return `omp-${sessionId.trim()}`;
}

export function resolveProviders(value = process.env.PI_PROMPT_CACHE_ISOLATION_PROVIDERS) {
	if (Array.isArray(value)) {
		return new Set(value.filter(provider => typeof provider === "string").map(provider => provider.trim()).filter(Boolean));
	}

	const configured = typeof value === "string" ? value : DEFAULT_PROVIDERS.join(",");
	return new Set(configured.split(",").map(provider => provider.trim()).filter(Boolean));
}

export function shouldIsolateModel(model, providers) {
	return model?.api === "openai-completions" && (providers.has(model.provider) || providers.has("*"));
}

export async function loadConfiguredProviders(cwd, fallbackProviders, logger, readFileImpl = readFile) {
	const settingsFiles = [
		...(typeof cwd === "string" && cwd.trim() !== "" ? PROJECT_SETTINGS_FILES.map(file => join(cwd, file)) : []),
		...GLOBAL_SETTINGS_FILES,
	];

	for (const settingsPath of settingsFiles) {
		let content;
		try {
			content = await readFileImpl(settingsPath, "utf8");
		} catch (error) {
			if (error?.code === "ENOENT") continue;
			logger?.warn?.("prompt-cache-isolation-settings-read-failed", { settingsPath, error: String(error) });
			return fallbackProviders;
		}

		let settings;
		try {
			settings = JSON.parse(content);
		} catch (error) {
			logger?.warn?.("prompt-cache-isolation-settings-invalid", { settingsPath, error: String(error) });
			return fallbackProviders;
		}

		const config = settings?.promptCacheIsolation;
		if (config === undefined) continue;
		if (config === false || (isRecord(config) && config.enabled === false)) return new Set();
		if (Array.isArray(config)) return resolveProviders(config);
		if (!isRecord(config) || !Array.isArray(config.providers)) {
			logger?.warn?.("prompt-cache-isolation-settings-invalid", {
				settingsPath,
				reason: "promptCacheIsolation.providers must be an array",
			});
			return fallbackProviders;
		}
		return resolveProviders(config.providers);
	}

	return fallbackProviders;
}

export function addPromptCacheKey(payload, sessionId) {
	if (!isRecord(payload) || Object.hasOwn(payload, "prompt_cache_key")) return undefined;

	const promptCacheKey = getPromptCacheKey(sessionId);
	if (!promptCacheKey) return undefined;
	return { ...payload, prompt_cache_key: promptCacheKey };
}

export function createPromptCacheIsolationHandler(providers = resolveProviders(), logger) {
	const getProviders = typeof providers === "function" ? providers : () => providers;

	return (event, context) => {
		if (!shouldIsolateModel(context?.model, getProviders(context))) return undefined;

		const sessionId = context?.sessionManager?.getSessionId?.();
		const payload = event?.payload;
		const explicitPromptCacheKey =
			isRecord(payload) && typeof payload.prompt_cache_key === "string" ? payload.prompt_cache_key : undefined;
		const promptCacheKey = explicitPromptCacheKey ?? getPromptCacheKey(sessionId);
		if (!promptCacheKey) return undefined;

		const replacement = addPromptCacheKey(payload, sessionId);
		logger?.info?.("prompt-cache-isolation", {
			provider: context.model.provider,
			api: context.model.api,
			sessionId,
			promptCacheKey,
			applied: replacement !== undefined,
		});
		return replacement;
	};
}

export default function promptCacheIsolationExtension(pi) {
	let providers = resolveProviders();
	const handler = createPromptCacheIsolationHandler(() => providers, pi.logger);

	pi.on("session_start", async (_event, context) => {
		providers = await loadConfiguredProviders(context?.cwd, providers, pi.logger);
	});
	pi.on("before_provider_request", handler);
}
