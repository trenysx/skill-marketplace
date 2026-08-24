/**
 * search.js — skill marketplace search & install core
 * Supports GitHub API search with mock fallback, caching, validation.
 */

export const MOCK_SKILLS = [
  { repo: "anthropics/skills", stars: 168363, description: "Agent Skills spec + packs — official spec and curated packs", tgz: "https://github.com/anthropics/skills", category: "official", installs: 12450 },
  { repo: "mattpocock/skills", stars: 229522, description: "Skills for Real Engineers — practical patterns", tgz: "", category: "community", installs: 8920 },
  { repo: "obra/superpowers", stars: 275663, description: "Agentic skills framework — supercharge your agent", tgz: "", category: "framework", installs: 15600 },
  { repo: "addyosmani/agent-skills", stars: 86386, description: "Production-grade engineering skills", tgz: "", category: "community", installs: 4300 },
  { repo: "vercel/skills", stars: 54210, description: "Vercel AI skills — Next.js, AI SDK", tgz: "", category: "official", installs: 3100 },
  { repo: "anomalyco/opencode-skills", stars: 12400, description: "OpenCode skills — curated for opencode", tgz: "", category: "community", installs: 890 },
  { repo: "github/skills", stars: 45200, description: "GitHub Skills — learn GitHub", tgz: "", category: "official", installs: 2100 },
  { repo: "continuedev/skills", stars: 32100, description: "Continue.dev skills — IDE assistant", tgz: "", category: "community", installs: 1500 },
];

const GITHUB_API_BASE = "https://api.github.com";
const SEARCH_PER_PAGE = 10;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const memoryCache = new Map(); // query -> { data, timestamp }

/**
 * Normalize repo name: owner/repo, lowercase, trim
 */
export function normalizeRepo(repo) {
  if (!repo || typeof repo !== "string") return null;
  const trimmed = repo.trim().toLowerCase();
  const parts = trimmed.split("/");
  if (parts.length !== 2) return null;
  const [owner, name] = parts;
  if (!owner || !name) return null;
  if (!/^[a-z0-9-]+$/.test(owner) || !/^[a-z0-9._-]+$/.test(name)) return null;
  return `${owner}/${name}`;
}

export function validateRepo(repo) {
  const norm = normalizeRepo(repo);
  if (!norm) return { valid: false, reason: "must be owner/repo (e.g. anthropics/skills)" };
  if (norm.length > 100) return { valid: false, reason: "repo name too long" };
  return { valid: true, normalized: norm };
}

export function filterSkills(skills, query) {
  if (!query) return [...skills];
  const q = query.toLowerCase().trim();
  return skills.filter(s =>
    s.repo.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q) ||
    (s.category && s.category.toLowerCase().includes(q))
  );
}

export function sortSkills(skills, sortBy = "stars") {
  const copy = [...skills];
  if (sortBy === "stars") copy.sort((a, b) => b.stars - a.stars);
  else if (sortBy === "installs") copy.sort((a, b) => (b.installs || 0) - (a.installs || 0));
  else if (sortBy === "name") copy.sort((a, b) => a.repo.localeCompare(b.repo));
  return copy;
}

function getCached(query) {
  const key = query || "__all__";
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(query, data) {
  const key = query || "__all__";
  memoryCache.set(key, { data, timestamp: Date.now() });
  // simple LRU: keep max 20 entries
  if (memoryCache.size > 20) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
}

export function clearCache() {
  memoryCache.clear();
}

export function getCacheStats() {
  return { size: memoryCache.size, keys: [...memoryCache.keys()] };
}

async function fetchFromGitHub(query) {
  const q = query ? `topic:agent-skills+${encodeURIComponent(query)}` : "topic:agent-skills";
  const url = `${GITHUB_API_BASE}/search/repositories?q=${q}&sort=stars&order=desc&per_page=${SEARCH_PER_PAGE}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "skill-marketplace/0.1.0",
      "Accept": "application/vnd.github.v3+json",
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return (data.items || []).map(i => ({
    repo: i.full_name,
    stars: i.stargazers_count,
    description: i.description || "",
    tgz: i.html_url,
    category: (i.topics || []).includes("agent-skills") ? "community" : "other",
    installs: 0,
    updatedAt: i.updated_at,
    language: i.language,
  }));
}

/**
 * Search skills with GitHub API + mock fallback + cache
 */
export async function searchSkills(query, { mock = false, sortBy = "stars", useCache = true, perPage = SEARCH_PER_PAGE } = {}) {
  const normalizedQuery = (query || "").trim();
  if (mock) {
    const filtered = filterSkills(MOCK_SKILLS, normalizedQuery);
    return sortSkills(filtered, sortBy).slice(0, perPage);
  }
  if (useCache) {
    const cached = getCached(normalizedQuery);
    if (cached) return sortSkills(cached, sortBy).slice(0, perPage);
  }
  try {
    const remote = await fetchFromGitHub(normalizedQuery);
    const merged = remote.length ? remote : filterSkills(MOCK_SKILLS, normalizedQuery);
    const sorted = sortSkills(merged, sortBy);
    if (useCache) setCached(normalizedQuery, sorted);
    return sorted.slice(0, perPage);
  } catch {
    const fallback = filterSkills(MOCK_SKILLS, normalizedQuery);
    const sorted = sortSkills(fallback, sortBy);
    return sorted.slice(0, perPage);
  }
}

export async function getSkillDetails(repo, { mock = false } = {}) {
  const v = validateRepo(repo);
  if (!v.valid) throw new Error(v.reason);
  const normalized = v.normalized;
  if (mock) {
    const found = MOCK_SKILLS.find(s => s.repo.toLowerCase() === normalized);
    if (found) return { ...found, readme: `# ${found.repo}\n${found.description}`, files: ["SKILL.md"] };
    throw new Error(`Skill not found in mock: ${repo}`);
  }
  try {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${normalized}`, {
      headers: { "User-Agent": "skill-marketplace/0.1.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const data = await res.json();
    return {
      repo: data.full_name,
      stars: data.stargazers_count,
      description: data.description || "",
      tgz: data.html_url,
      category: "community",
      installs: 0,
      updatedAt: data.updated_at,
      language: data.language,
      readme: null,
    };
  } catch (e) {
    throw new Error(`Failed to fetch skill details: ${e.message}`);
  }
}

export function formatSkillForTable(skill) {
  return {
    repo: skill.repo,
    stars: String(skill.stars),
    description: skill.description.slice(0, 60),
    category: skill.category || "-",
  };
}

export function generateMarketplaceReport(skills, query = "") {
  const lines = [];
  lines.push(`# Skill Marketplace — ${new Date().toISOString().slice(0, 10)}`);
  lines.push(``);
  lines.push(`Query: "${query || "(all)"}" — found ${skills.length} skills`);
  lines.push(``);
  lines.push(`| Repo | Stars | Category | Description |`);
  lines.push(`|------|-------|----------|-------------|`);
  for (const s of skills) {
    lines.push(`| ${s.repo} | ${s.stars} | ${s.category || "-"} | ${s.description.slice(0, 50)} |`);
  }
  return lines.join("\n");
}
