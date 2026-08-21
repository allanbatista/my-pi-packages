import assert from "node:assert/strict";
import test from "node:test";

import promptCacheIsolationExtension, {
	addPromptCacheKey,
	createPromptCacheIsolationHandler,
	getPromptCacheKey,
	loadConfiguredProviders,
	resolveProviders,
	shouldIsolateModel,
} from "../extensions/prompt-cache-isolation.js";

test("derives a stable key from each session", () => {
	assert.equal(getPromptCacheKey("session-a"), "omp-session-a");
	assert.notEqual(getPromptCacheKey("session-a"), getPromptCacheKey("session-b"));
	assert.deepEqual([...resolveProviders("batista,antigravity")], ["batista", "antigravity"]);
});

test("adds the key without mutating the provider payload", () => {
	const payload = { model: "batista-high", messages: [{ role: "user", content: "hello" }] };
	const result = addPromptCacheKey(payload, "session-a");

	assert.deepEqual(payload, { model: "batista-high", messages: [{ role: "user", content: "hello" }] });
	assert.equal(result.prompt_cache_key, "omp-session-a");
});

test("preserves an explicit provider key", () => {
	const payload = { prompt_cache_key: "explicit-key" };
	assert.equal(addPromptCacheKey(payload, "session-a"), undefined);
});

test("ignores invalid payloads and empty sessions", () => {
	assert.equal(addPromptCacheKey(null, "session-a"), undefined);
	assert.equal(addPromptCacheKey([], "session-a"), undefined);
	assert.equal(addPromptCacheKey({}, ""), undefined);
});

test("filters providers and APIs before changing a request", () => {
	const providers = resolveProviders("batista, antigravity");
	const handler = createPromptCacheIsolationHandler(providers);
	const payload = { model: "batista-high" };
	const isolated = handler(
		{ payload },
		{ model: { provider: "batista", api: "openai-completions" }, sessionManager: { getSessionId: () => "session-a" } },
	);

	assert.equal(shouldIsolateModel({ provider: "batista", api: "openai-completions" }, providers), true);
	assert.equal(shouldIsolateModel({ provider: "batista", api: "openai-responses" }, providers), false);
	assert.equal(shouldIsolateModel({ provider: "other", api: "openai-completions" }, providers), false);
	assert.equal(isolated.prompt_cache_key, "omp-session-a");
	assert.equal(
		handler(
			{ payload },
			{
				model: { provider: "other", api: "openai-completions" },
				sessionManager: { getSessionId: () => "session-a" },
			},
		),
		undefined,
	);
});

test("registers the provider request hook", () => {
	const registrations = [];
	promptCacheIsolationExtension({ on: (event, handler) => registrations.push({ event, handler }) });

	assert.deepEqual(
		registrations.map(registration => registration.event),
		["session_start", "before_provider_request"],
	);
});

test("logs distinct keys and whether the payload was changed", () => {
	const logs = [];
	const handler = createPromptCacheIsolationHandler(new Set(["batista"]), {
		info: (message, fields) => logs.push({ message, fields }),
	});

	const request = sessionId =>
		handler(
			{ payload: { model: "batista-high" } },
			{ model: { provider: "batista", api: "openai-completions" }, sessionManager: { getSessionId: () => sessionId } },
		);

	request("session-a");
	request("session-b");

	assert.deepEqual(logs.map(log => log.message), ["prompt-cache-isolation", "prompt-cache-isolation"]);
	assert.deepEqual(logs.map(log => log.fields.promptCacheKey), ["omp-session-a", "omp-session-b"]);
	assert.deepEqual(logs.map(log => log.fields.applied), [true, true]);
});

test("loads providers from project Pi settings", async () => {
	const settingsPath = "/project/.pi/settings.json";
	const fakeReadFile = async path => {
		if (path === settingsPath) return JSON.stringify({ promptCacheIsolation: { providers: ["custom"] } });
		const error = new Error("missing");
		error.code = "ENOENT";
		throw error;
	};

	const providers = await loadConfiguredProviders("/project", new Set(["fallback"]), undefined, fakeReadFile);

	assert.deepEqual([...providers], ["custom"]);
});

test("supports changing the provider set after session configuration loads", () => {
	let providers = new Set();
	const handler = createPromptCacheIsolationHandler(() => providers);
	const event = { payload: { model: "batista-high" } };
	const context = {
		model: { provider: "batista", api: "openai-completions" },
		sessionManager: { getSessionId: () => "session-a" },
	};

	assert.equal(handler(event, context), undefined);
	providers = new Set(["batista"]);
	assert.equal(handler(event, context).prompt_cache_key, "omp-session-a");
});
