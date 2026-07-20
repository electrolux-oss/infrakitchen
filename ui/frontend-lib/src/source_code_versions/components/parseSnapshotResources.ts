import { parseToObject as hclParseToObject } from "hcl2-parser";

export interface SnapshotResource {
  id: string;
  type: string;
  name: string;
  provider: string;
  moduleSource?: string;
  isConditional?: boolean;
  parentModule: string | null;
  deps: string[];
}

interface RawBlock {
  kind: "resource" | "module";
  rtype: string;
  name: string;
  source?: string;
  refs: Set<string>;
  isConditional: boolean;
}

interface DirData {
  blocks: RawBlock[];
  providers: Map<string, Set<string>>;
}

const FILE_HEADER = /^#\s*-{2,}\s*FILE:\s*(.+?)\s*-{2,}\s*$/m;

function normDir(d: string): string {
  const parts: string[] = [];
  for (const p of d.replace(/\\/g, "/").split("/")) {
    if (p === "" || p === ".") continue;
    if (p === "..") parts.pop();
    else parts.push(p);
  }
  return parts.join("/");
}

function fileDir(fp: string): string {
  const s = fp.replace(/@.*$/, "").replace(/\\/g, "/").replace(/^\//, "");
  const i = s.lastIndexOf("/");
  return i < 0 ? "" : s.slice(0, i);
}

function resolveModuleDir(
  source: string,
  cur: string,
  allDirs: Set<string>,
): string | null {
  const src = source.split("//").pop()?.split("?")[0] ?? source;
  if (source.startsWith("./") || source.startsWith("../")) {
    const r = normDir(cur + "/" + src);
    return allDirs.has(r) ? r : null;
  }
  const suffix = normDir(src);
  for (const dir of allDirs)
    if (dir === suffix || dir.endsWith("/" + suffix)) return dir;
  return null;
}

type Body = Record<string, unknown>;

function parseHcl(text: string): Body | null {
  try {
    return hclParseToObject(text)?.[0] ?? null;
  } catch {
    return null;
  }
}

function unwrap(v: unknown): Body | null {
  return Array.isArray(v)
    ? ((v[0] as Body) ?? null)
    : v && typeof v === "object"
      ? (v as Body)
      : null;
}

function refs(val: unknown): Set<string> {
  const out = new Set<string>();
  const re = /\$\{([a-z][a-z0-9_]*\.[a-z_][a-z0-9_]*)/g;
  if (typeof val === "string") {
    let m: RegExpExecArray | null;
    while ((m = re.exec(val)) !== null) {
      const [p0, p1] = m[1].split(".");
      out.add(`${p0}.${p1}`);
    }
  } else if (Array.isArray(val)) {
    for (const i of val) for (const r of refs(i)) out.add(r);
  } else if (val && typeof val === "object") {
    for (const v of Object.values(val as Body))
      for (const r of refs(v)) out.add(r);
  }
  return out;
}

function isConditional(body: Body): boolean {
  const isVar = (v: unknown) => typeof v === "string" && /\$\{var\./.test(v);
  return isVar(body.count) || isVar(body.for_each);
}

function parseDirData(text: string): DirData {
  const blocks: RawBlock[] = [];
  const providers = new Map<string, Set<string>>();
  const p = parseHcl(text);
  if (!p) return { blocks, providers };

  for (const [rtype, inst] of Object.entries((p.resource as Body) ?? {})) {
    for (const [rname, bv] of Object.entries(inst as Body)) {
      const b = unwrap(bv);
      if (!b) continue;
      blocks.push({
        kind: "resource",
        rtype,
        name: rname,
        refs: refs(b),
        isConditional: isConditional(b),
      });
    }
  }

  for (const [mname, bv] of Object.entries((p.module as Body) ?? {})) {
    const b = unwrap(bv);
    if (!b) continue;
    blocks.push({
      kind: "module",
      rtype: "module",
      name: mname,
      source: typeof b.source === "string" ? b.source : undefined,
      refs: refs(b),
      isConditional: isConditional(b),
    });
  }

  for (const [name, bv] of Object.entries((p.provider as Body) ?? {})) {
    const b = unwrap(bv);
    if (!b) continue;
    const r = refs(b);
    if (r.size > 0) providers.set(name, r);
  }

  return { blocks, providers };
}

export function parseSnapshotResources(
  snapshot: string | null,
  sourceCodeFolder?: string,
): SnapshotResource[] {
  if (!snapshot) return [];

  const dirText = new Map<string, string>();
  let curPath: string | null = null;
  const buf: string[] = [];
  const flush = () => {
    if (curPath) {
      const d = fileDir(curPath);
      dirText.set(d, (dirText.get(d) ?? "") + "\n" + buf.join("\n"));
    }
  };
  for (const line of snapshot.split("\n")) {
    const m = line.match(FILE_HEADER);
    if (m) {
      flush();
      curPath = m[1].trim();
      buf.length = 0;
    } else if (curPath) buf.push(line);
  }
  flush();
  if (dirText.size === 0) return [];

  const allDirs = new Set(dirText.keys());
  const dirData = new Map<string, DirData>();
  for (const [dir, text] of dirText) dirData.set(dir, parseDirData(text));

  const childDirs = new Set<string>();
  for (const [dir, { blocks }] of dirData) {
    for (const b of blocks) {
      if (b.kind === "module" && b.source) {
        const r = resolveModuleDir(b.source, dir, allDirs);
        if (r) childDirs.add(r);
      }
    }
  }
  const norm = sourceCodeFolder ? normDir(sourceCodeFolder) : null;
  const rootDir =
    norm && allDirs.has(norm)
      ? norm
      : ([...allDirs].find((d) => !childDirs.has(d)) ?? [...allDirs][0]);

  const rootProviders = dirData.get(rootDir)?.providers ?? new Map();
  const providerDepsFor = (
    dir: string,
    rtype: string,
  ): Set<string> | undefined => {
    const provider = rtype.split("_")[0];
    return (
      dirData.get(dir)?.providers.get(provider) ?? rootProviders.get(provider)
    );
  };

  const allIds = new Set<string>();
  const visited = new Set<string>();
  const entries: Array<{
    id: string;
    resource: Omit<SnapshotResource, "deps">;
    rawRefs: Set<string>;
    parent: string | null;
  }> = [];
  const queue: Array<{ dir: string; parent: string | null }> = [
    { dir: rootDir, parent: null },
  ];

  while (queue.length > 0) {
    const { dir, parent } = queue.shift()!;
    if (visited.has(dir)) continue;
    visited.add(dir);

    for (const b of dirData.get(dir)?.blocks ?? []) {
      const id =
        b.kind === "module"
          ? parent
            ? `${parent}.module.${b.name}`
            : `module.${b.name}`
          : parent
            ? `${parent}.${b.rtype}.${b.name}`
            : `${b.rtype}.${b.name}`;
      if (allIds.has(id)) continue;
      allIds.add(id);

      const rawRefs = new Set(b.refs);
      for (const r of providerDepsFor(dir, b.rtype) ?? []) rawRefs.add(r);

      entries.push({
        id,
        parent,
        rawRefs,
        resource: {
          id,
          type: b.rtype,
          name: b.name,
          provider: b.kind === "module" ? "module" : b.rtype.split("_")[0],
          moduleSource: b.source,
          isConditional: b.isConditional,
          parentModule: parent,
        },
      });

      if (b.kind === "module" && b.source) {
        const childDir = resolveModuleDir(b.source, dir, allDirs);
        if (childDir) queue.push({ dir: childDir, parent: id });
      }
    }
  }

  return entries.map(({ id, rawRefs, parent, resource }) => {
    const depSet = new Set<string>();
    for (const raw of rawRefs) {
      const q = parent ? `${parent}.${raw}` : raw;
      if (q !== id && allIds.has(q)) {
        depSet.add(q);
        continue;
      }
      if (allIds.has(raw) && raw !== id && !id.startsWith(raw + "."))
        depSet.add(raw);
    }
    if (resource.type === "module" && parent && allIds.has(parent))
      depSet.add(parent);
    return { ...resource, deps: [...depSet] };
  });
}

export function topoPositions(
  resources: SnapshotResource[],
): Map<string, number> {
  const ids = new Set(resources.map((r) => r.id));
  const inDeg = new Map(resources.map((r) => [r.id, 0]));
  const adj = new Map(resources.map((r) => [r.id, [] as string[]]));

  for (const r of resources)
    for (const dep of r.deps) {
      if (!ids.has(dep)) continue;
      inDeg.set(r.id, inDeg.get(r.id)! + 1);
      adj.get(dep)!.push(r.id);
    }

  const pos = new Map<string, number>();
  const queue = [...inDeg].filter(([, d]) => d === 0).map(([id]) => id);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const col = pos.get(id) ?? 0;
    for (const next of adj.get(id) ?? []) {
      pos.set(next, Math.max(pos.get(next) ?? 0, col + 1));
      inDeg.set(next, inDeg.get(next)! - 1);
      if (inDeg.get(next) === 0) queue.push(next);
    }
  }

  for (const r of resources) if (!pos.has(r.id)) pos.set(r.id, 0);
  return pos;
}
