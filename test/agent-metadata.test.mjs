import assert from "node:assert/strict";
import test from "node:test";

import agentMetadataExtension, {
	addAgentMetadata,
	buildAgentMetadata,
	createAgentMetadataHandler,
	getAgentIdentity,
} from "../extensions/agent-metadata.js";

const context = {
	cwd: "/workspace/project",
	mode: "tui",
	model: { provider: "batista", id: "batista-high", api: "openai-completions" },
	sessionManager: {
		getSessionId: () => "session-child",
		getSessionName: () => "Feature work",
		getHeader: () => ({ timestamp: "2026-08-22T12:00:00.000Z", parentSession: "/tmp/session-parent.jsonl" }),
	},
};

test("builds the standard metadata, including hostname", () => {
	const metadata = buildAgentMetadata(context, {
		now: new Date("2026-08-22T12:34:56.000Z"),
		env: { PI_AGENT_NAME: "pi", PI_AGENT_VERSION: "1.2.3" },
		os: "linux",
		osVersion: "6.1",
		hostname: "devbox",
		timezone: "America/Sao_Paulo",
	});

	assert.deepEqual(Object.fromEntries(metadata.map(item => [item.key, item.value])), {
		"session-id": "session-child",
		"parent-session-id": "session-parent",
		"agent-role": "sub",
		"session-title": "Feature work",
		"session-created-at": "2026-08-22T12:00:00.000Z",
		os: "linux",
		"os-version": "6.1",
		hostname: "devbox",
		"agent-name": "pi",
		"agent-version": "1.2.3",
		tz: "America/Sao_Paulo",
		"requested-at": "2026-08-22T12:34:56.000Z",
		cwd: "/workspace/project",
		provider: "batista",
		model: "batista-high",
		api: "openai-completions",
		mode: "tui",
	});
});

test("identifies main agent role when no parent session exists", () => {
	const mainContext = {
		sessionManager: {
			getSessionId: () => "main-session",
			getSessionName: () => "Root task",
			getHeader: () => ({ timestamp: "2026-08-22T12:00:00.000Z" }),
		},
	};
	const metadata = buildAgentMetadata(mainContext, {
		env: { PI_AGENT_NAME: "pi", PI_AGENT_VERSION: "1.2.3" },
		proc: null,
		now: new Date(0),
	});
	assert.equal(metadata.find(item => item.key === "agent-role")?.value, "main");
	assert.equal(metadata.find(item => item.key === "parent-session-id"), undefined);
	assert.equal(metadata.find(item => item.key === "session-title")?.value, "Root task");
});

test("merges metadata without mutating the payload", () => {
	const payload = { model: "x", _agent_metadata: [{ key: "custom", value: "yes" }, { key: "session-id", value: "old" }] };
	const metadata = [{ key: "session-id", value: "new" }, { key: "hostname", value: "host" }];
	const result = addAgentMetadata(payload, metadata);

	assert.deepEqual(payload._agent_metadata, [{ key: "custom", value: "yes" }, { key: "session-id", value: "old" }]);
	assert.deepEqual(result._agent_metadata, [
		{ key: "custom", value: "yes" },
		{ key: "session-id", value: "new" },
		{ key: "hostname", value: "host" },
	]);
});

test("omits unavailable optional values and identifies OMP via env", () => {
	const metadata = buildAgentMetadata(
		{ sessionManager: { getSessionId: () => "s" } },
		{ env: { OMP_VERSION: "17.0.0" }, proc: null, now: new Date(0) },
	);
	assert.deepEqual(metadata.filter(item => ["session-id", "agent-name", "agent-version", "requested-at"].includes(item.key)), [
		{ key: "session-id", value: "s" },
		{ key: "agent-name", value: "omp" },
		{ key: "agent-version", value: "17.0.0" },
		{ key: "requested-at", value: "1970-01-01T00:00:00.000Z" },
	]);
	assert.deepEqual(getAgentIdentity({ env: { OMP_VERSION: "17.0.0" }, proc: null }), { name: "omp", version: "17.0.0" });
});

test("detects OMP agent name and version from pi.pi export", () => {
	const identity = getAgentIdentity({ env: {}, pi: { pi: { VERSION: "18.0.4" } }, proc: null });
	assert.deepEqual(identity, { name: "omp", version: "18.0.4" });
});

test("detects OMP agent name and version from process title and path", () => {
	const fakeOmpProc = {
		title: "omp",
		argv: ["bun", "/tmp/omp-linux-x64", "-p"],
		execPath: "/tmp/omp-linux-x64",
	};
	const identity = getAgentIdentity({ env: {}, proc: fakeOmpProc });
	assert.equal(identity.name, "omp");
});

test("detects Pi agent name and version from process and package", () => {
	const fakePiProc = {
		title: "pi",
		argv: ["node", "/usr/local/bin/pi"],
		execPath: "/usr/local/bin/node",
	};
	const identity = getAgentIdentity({ env: {}, proc: fakePiProc });
	assert.equal(identity.name, "pi");
});

test("registers the common Pi/OMP provider hook and handles invalid payloads", () => {
	const registrations = [];
	agentMetadataExtension({ on: (event, handler) => registrations.push({ event, handler }) });
	assert.deepEqual(registrations.map(item => item.event), ["before_provider_request"]);
	assert.equal(createAgentMetadataHandler()({ payload: null }, context), undefined);
});
