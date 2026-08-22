import { hostname as getHostname, platform, release } from "node:os";
import { basename } from "node:path";

const METADATA_FIELD = "_agent_metadata";

function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
	if (typeof value !== "string") return undefined;
	const result = value.trim();
	return result || undefined;
}

function sessionIdFromPath(value) {
	const path = nonEmptyString(value);
	return path ? basename(path).replace(/\.jsonl$/, "") : undefined;
}

export function getAgentIdentity(env = process.env) {
	const name = nonEmptyString(env.PI_AGENT_NAME) ?? nonEmptyString(env.OMP_AGENT_NAME) ?? (env.OMP_VERSION ? "omp" : "pi");
	const version =
		nonEmptyString(env.PI_AGENT_VERSION) ??
		nonEmptyString(env.OMP_AGENT_VERSION) ??
		nonEmptyString(env.PI_VERSION) ??
		nonEmptyString(env.OMP_VERSION) ??
		"unknown";
	return { name, version };
}

export function buildAgentMetadata(context, options = {}) {
	const sessionManager = context?.sessionManager;
	const header = sessionManager?.getHeader?.();
	const model = context?.model;
	const now = options.now instanceof Date ? options.now : new Date();
	const identity = getAgentIdentity(options.env);
	const timezone = options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? options.env?.TZ;
	const entries = [
		["session-id", sessionManager?.getSessionId?.()],
		["parent-session-id", sessionIdFromPath(header?.parentSession)],
		["session-title", sessionManager?.getSessionName?.()],
		["session-created-at", header?.timestamp],
		["os", options.os ?? platform()],
		["os-version", options.osVersion ?? release()],
		["hostname", options.hostname ?? getHostname()],
		["agent-name", identity.name],
		["agent-version", identity.version],
		["tz", timezone],
		["requested-at", now.toISOString()],
		["cwd", context?.cwd],
		["provider", model?.provider],
		["model", model?.id],
		["api", model?.api],
		["mode", context?.mode],
	];

	return entries.flatMap(([key, value]) => {
		const normalized = nonEmptyString(value == null ? undefined : String(value));
		return normalized ? [{ key, value: normalized }] : [];
	});
}

export function addAgentMetadata(payload, metadata) {
	if (!isRecord(payload)) return undefined;

	const merged = new Map();
	if (Array.isArray(payload[METADATA_FIELD])) {
		for (const item of payload[METADATA_FIELD]) {
			const key = nonEmptyString(item?.key);
			const value = nonEmptyString(item?.value);
			if (key && value) merged.set(key, { key, value });
		}
	}
	for (const item of metadata) merged.set(item.key, item);

	return { ...payload, [METADATA_FIELD]: [...merged.values()] };
}

export function createAgentMetadataHandler(now = () => new Date()) {
	return (event, context) => {
		const metadata = buildAgentMetadata(context, { now: now() });
		return addAgentMetadata(event?.payload, metadata);
	};
}

export default function agentMetadataExtension(pi) {
	pi.on("before_provider_request", createAgentMetadataHandler());
}
