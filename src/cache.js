/**
 * cache.js — file-based cache for installed skills
 * Stores installed skills in .agents/skills/.cache.json
 */
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

const CACHE_FILE = ".agents/skills/.cache.json";
const INSTALL_DIR = ".agents/skills";

export async function loadCache(cwd = process.cwd()) {
  const path = join(cwd, CACHE_FILE);
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return { installed: [], updatedAt: null };
  }
}

export async function saveCache(data, cwd = process.cwd()) {
  const path = join(cwd, CACHE_FILE);
  await mkdir(dirname(path), { recursive: true });
  const payload = { ...data, updatedAt: new Date().toISOString() };
  await writeFile(path, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

export async function addInstalled(repo, cwd = process.cwd()) {
  const cache = await loadCache(cwd);
  const normalized = repo.toLowerCase();
  if (!cache.installed.some(s => s.repo.toLowerCase() === normalized)) {
    cache.installed.push({ repo, installedAt: new Date().toISOString() });
    await saveCache(cache, cwd);
  }
  return cache;
}

export async function removeInstalled(repo, cwd = process.cwd()) {
  const cache = await loadCache(cwd);
  const before = cache.installed.length;
  cache.installed = cache.installed.filter(s => s.repo.toLowerCase() !== repo.toLowerCase());
  if (cache.installed.length !== before) await saveCache(cache, cwd);
  return cache;
}

export async function listInstalled(cwd = process.cwd()) {
  const cache = await loadCache(cwd);
  return cache.installed;
}

export async function isInstalled(repo, cwd = process.cwd()) {
  const list = await listInstalled(cwd);
  return list.some(s => s.repo.toLowerCase() === repo.toLowerCase());
}

export async function getInstallDir(repo, cwd = process.cwd()) {
  const name = repo.split("/")[1] || repo;
  return join(cwd, INSTALL_DIR, name);
}

export async function scanInstallDir(cwd = process.cwd()) {
  const dir = join(cwd, INSTALL_DIR);
  if (!existsSync(dir)) return [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const result = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const full = join(dir, e.name);
      try {
        const st = await stat(join(full, "SKILL.md"));
        result.push({ name: e.name, path: full, hasSkillMd: true, mtime: st.mtime });
      } catch {
        result.push({ name: e.name, path: full, hasSkillMd: false, mtime: null });
      }
    }
    return result;
  } catch {
    return [];
  }
}

export async function validateInstallDir(repo, cwd = process.cwd()) {
  const dir = await getInstallDir(repo, cwd);
  if (!existsSync(dir)) return { exists: false, hasSkillMd: false, issues: ["not installed"] };
  try {
    await stat(join(dir, "SKILL.md"));
    return { exists: true, hasSkillMd: true, issues: [] };
  } catch {
    return { exists: true, hasSkillMd: false, issues: ["SKILL.md missing"] };
  }
}
