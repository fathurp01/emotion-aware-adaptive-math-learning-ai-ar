import fs from "node:fs";
import path from "node:path";

type AnyJson = null | boolean | number | string | AnyJson[] | { [key: string]: AnyJson };

function isObject(value: unknown): value is Record<string, AnyJson> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function renameKeyRecursive(value: AnyJson, fromKey: string, toKey: string): { value: AnyJson; changed: boolean } {
  let changed = false;

  if (Array.isArray(value)) {
    const mapped = value.map((v) => {
      const result = renameKeyRecursive(v, fromKey, toKey);
      if (result.changed) changed = true;
      return result.value;
    });
    return { value: mapped, changed };
  }

  if (isObject(value)) {
    const out: Record<string, AnyJson> = {};
    for (const [k, v] of Object.entries(value)) {
      const nextKey = k === fromKey ? toKey : k;
      if (nextKey !== k) changed = true;

      const result = renameKeyRecursive(v, fromKey, toKey);
      if (result.changed) changed = true;

      out[nextKey] = result.value;
    }
    return { value: out, changed };
  }

  return { value, changed };
}

function ensureFileExists(filePath: string, label: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function getNestedString(obj: any, pathParts: string[]): string | null {
  let cur = obj;
  for (const part of pathParts) {
    if (cur == null || typeof cur !== "object") return null;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : null;
}

function stripPrefixFromWeightsManifest(root: any): { changed: boolean } {
  const manifest = root?.weightsManifest;
  if (!Array.isArray(manifest) || manifest.length === 0) return { changed: false };

  // For Keras Sequential exports, some converters emit weight names like:
  //   "sequential/batch_normalization/gamma"
  // but tfjs-layers typically targets:
  //   "batch_normalization/gamma"
  // Strip the model name prefix if (and only if) all weights share it.
  const modelName =
    getNestedString(root, ["modelTopology", "model_config", "config", "name"]) ??
    getNestedString(root, ["modelTopology", "model_config", "config", "name"]) ??
    getNestedString(root, ["modelTopology", "model_config", "config", "name"]);
  const inferredModelName = modelName || getNestedString(root, ["modelTopology", "model_config", "config", "name"]);
  const prefix = inferredModelName ? `${inferredModelName}/` : "sequential/";

  const allWeights: any[] = [];
  for (const group of manifest) {
    const weights = group?.weights;
    if (Array.isArray(weights)) {
      allWeights.push(...weights);
    }
  }

  if (allWeights.length === 0) return { changed: false };

  const names = allWeights.map((w) => (typeof w?.name === "string" ? w.name : ""));
  const withPrefix = names.filter((n) => n.startsWith(prefix)).length;
  if (withPrefix === 0) return { changed: false };
  if (withPrefix !== names.length) {
    // Mixed naming; don't guess.
    return { changed: false };
  }

  const stripped = names.map((n) => n.slice(prefix.length));
  const seen = new Set<string>();
  for (const n of stripped) {
    if (!n) {
      throw new Error(`Invalid empty weight name after stripping prefix '${prefix}'`);
    }
    if (seen.has(n)) {
      throw new Error(`Duplicate weight name after stripping prefix '${prefix}': ${n}`);
    }
    seen.add(n);
  }

  // Apply
  let idx = 0;
  for (const group of manifest) {
    const weights = group?.weights;
    if (!Array.isArray(weights)) continue;
    for (const w of weights) {
      if (typeof w?.name === "string") {
        w.name = stripped[idx];
      }
      idx++;
    }
  }

  return { changed: true };
}

async function main() {
  const args = process.argv.slice(2);
  const modelJsonArg = args[0];
  const dryRun = args.includes("--dry-run");

  const repoRoot = process.cwd();
  const defaultModelPath = path.join(repoRoot, "public", "model", "tfjs_model", "model.json");
  const modelJsonPath = path.isAbsolute(modelJsonArg || "")
    ? (modelJsonArg as string)
    : path.join(repoRoot, modelJsonArg || defaultModelPath);

  ensureFileExists(modelJsonPath, "model.json");

  const modelDir = path.dirname(modelJsonPath);
  const metadataPath = path.join(modelDir, "metadata.json");

  const raw = await fs.promises.readFile(modelJsonPath, "utf8");
  // Some tooling can prepend a UTF-8 BOM or stray null bytes; JSON.parse will fail.
  const cleaned = raw.replace(/^[\uFEFF\u0000]+/, "").trimStart();
  const parsed = JSON.parse(cleaned) as AnyJson;

  // Fix Keras v3 converter mismatch: InputLayer.config.batch_shape -> batchInputShape
  const renamed = renameKeyRecursive(parsed, "batch_shape", "batchInputShape");

  // Fix potential mismatch: weight names prefixed with model name (e.g. 'sequential/').
  const rootForManifest = renamed.value as any;
  const manifestPrefixFix = stripPrefixFromWeightsManifest(rootForManifest);

  // Validate weights manifest paths exist (common cause of runtime load failure)
  const root = rootForManifest;
  const manifest = root?.weightsManifest;
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error(`weightsManifest missing/empty in ${modelJsonPath}`);
  }

  for (const group of manifest) {
    const pathsList = group?.paths;
    if (!Array.isArray(pathsList) || pathsList.length === 0) {
      throw new Error(`weightsManifest group has no paths in ${modelJsonPath}`);
    }
    for (const rel of pathsList) {
      const weightPath = path.join(modelDir, String(rel));
      ensureFileExists(weightPath, "Weight shard");
    }
  }

  // Metadata is optional for runtime, but helpful for labels mapping.
  if (!fs.existsSync(metadataPath)) {
    // eslint-disable-next-line no-console
    console.warn(`WARN: metadata.json not found next to model.json: ${metadataPath}`);
  } else {
    try {
      const metaRaw = await fs.promises.readFile(metadataPath, "utf8");
      const meta = JSON.parse(metaRaw) as any;
      if (!Array.isArray(meta?.labels) || meta.labels.length === 0) {
        // eslint-disable-next-line no-console
        console.warn(`WARN: metadata.json has no labels array: ${metadataPath}`);
      }
    } catch {
      // eslint-disable-next-line no-console
      console.warn(`WARN: metadata.json exists but is not valid JSON: ${metadataPath}`);
    }
  }

  if (renamed.changed || manifestPrefixFix.changed) {
    if (dryRun) {
      // eslint-disable-next-line no-console
      console.log(
        `DRY RUN: would patch model.json in ${modelJsonPath}` +
          `${renamed.changed ? " (batch_shape -> batchInputShape)" : ""}` +
          `${manifestPrefixFix.changed ? " (strip weight name prefix)" : ""}`
      );
      return;
    }

    const nextRaw = JSON.stringify(renamed.value);
    await fs.promises.writeFile(modelJsonPath, nextRaw, "utf8");
    // eslint-disable-next-line no-console
    console.log(
      `OK: patched model.json in ${modelJsonPath}` +
        `${renamed.changed ? " (batch_shape -> batchInputShape)" : ""}` +
        `${manifestPrefixFix.changed ? " (stripped weight name prefix)" : ""}`
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(`OK: no patch needed (batch_shape not found) in ${modelJsonPath}`);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
