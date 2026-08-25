import { existsSync, readFileSync, realpathSync } from "node:fs";
import { hostname as getHostname, platform, release } from "node:os";
import { basename, dirname, join } from "node:path";

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

function findPackageInfoFromPath(targetPath) {
	if (!targetPath || typeof targetPath !== "string") return undefined;
	try {
		let resolved = targetPath;
		try {
			resolved = realpathSync(targetPath);
		} catch {}
		let dir = dirname(resolved);
		while (dir && dir !== dirname(dir)) {
			const pkgPath = join(dir, "package.json");
			if (existsSync(pkgPath)) {
				try {
					const content = readFileSync(pkgPath, "utf8");
					const pkg = JSON.parse(content);
					if (pkg.name && pkg.version && (pkg.name.includes("coding-agent") || pkg.name.includes("pi") || pkg.name.includes("omp"))) {
						return { name: pkg.name, version: pkg.version };
					}
				} catch {}
			}
			dir = dirname(dir);
		}
	} catch {}
	return undefined;
}

export function getAgentIdentity(optionsOrEnv = process.env, piInstance, proc = process) {
	const isExplicitOptions =
		optionsOrEnv && typeof optionsOrEnv === "object" && ("env" in optionsOrEnv || "pi" in optionsOrEnv || "proc" in optionsOrEnv);
	const options = isExplicitOptions ? optionsOrEnv : { env: optionsOrEnv, pi: piInstance, proc };
	const env = options.env ?? (optionsOrEnv && !isExplicitOptions ? optionsOrEnv : process.env) ?? {};
	const pi = options.pi ?? piInstance;
	const p = options.proc ?? (optionsOrEnv && !isExplicitOptions ? proc : process);
	const envName = nonEmptyString(env.PI_AGENT_NAME) ?? nonEmptyString(env.OMP_AGENT_NAME);
	const envVersion =
		nonEmptyString(env.PI_AGENT_VERSION) ??
		nonEmptyString(env.OMP_AGENT_VERSION) ??
		nonEmptyString(env.PI_VERSION) ??
		nonEmptyString(env.OMP_VERSION);

	const piSdkVersion = nonEmptyString(pi?.pi?.VERSION);

	const isOmpProcess =
		Boolean(env.OMP_VERSION || env.OMP_AGENT_NAME || piSdkVersion) ||
		(typeof p?.title === "string" && p.title.toLowerCase() === "omp") ||
		(typeof p?.argv?.[0] === "string" && /(^|[/\\])omp([.-]|$)/i.test(p.argv[0])) ||
		(typeof p?.argv?.[1] === "string" && /(^|[/\\])omp([.-]|$)/i.test(p.argv[1])) ||
		(typeof p?.execPath === "string" && /(^|[/\\])omp([.-]|$)|oh-my-pi/i.test(p.execPath));

	let detectedPackage;
	if (p) {
		const candidatePaths = [p.argv?.[1], p.execPath, p.argv?.[0]].filter(Boolean);
		for (const candidate of candidatePaths) {
			const info = findPackageInfoFromPath(candidate);
			if (info?.version) {
				detectedPackage = info;
				break;
			}
		}
	}

	let name = envName;
	if (!name) {
		if (isOmpProcess) {
			name = "omp";
		} else if (detectedPackage?.name?.includes("omp") || detectedPackage?.name?.includes("oh-my-pi")) {
			name = "omp";
		} else {
			name = "pi";
		}
	}

	const version = envVersion ?? piSdkVersion ?? detectedPackage?.version ?? "unknown";
	return { name, version };
}

export function buildAgentMetadata(context, options = {}) {
	const sessionManager = context?.sessionManager;
	const header = sessionManager?.getHeader?.();
	const model = context?.model;
	const now = options.now instanceof Date ? options.now : new Date();
	const identity =
		options.identity ??
		getAgentIdentity(
			options.identityOptions ?? {
				env: options.env,
				pi: options.pi,
				...(options.proc !== undefined ? { proc: options.proc } : {}),
			},
		);
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

export function createAgentMetadataHandler(optionsOrNow = () => new Date(), extraOptions = {}) {
	const getNow = typeof optionsOrNow === "function" ? optionsOrNow : () => (optionsOrNow?.now instanceof Date ? optionsOrNow.now : new Date());
	const baseOptions = typeof optionsOrNow === "function" ? extraOptions : optionsOrNow;

	return (event, context) => {
		const metadata = buildAgentMetadata(context, { ...baseOptions, now: getNow() });
		return addAgentMetadata(event?.payload, metadata);
	};
}

export default function agentMetadataExtension(pi) {
	pi.on("before_provider_request", createAgentMetadataHandler({ pi }));
}
