export const MOCK_SKILLS = [
  { repo: "anthropics/skills", stars: 168363, description: "Agent Skills spec + packs", tgz: "https://github.com/anthropics/skills" },
  { repo: "mattpocock/skills", stars: 229522, description: "Skills for Real Engineers", tgz: "" },
  { repo: "obra/superpowers", stars: 275663, description: "Agentic skills framework", tgz: "" },
  { repo: "addyosmani/agent-skills", stars: 86386, description: "Production-grade engineering skills", tgz: "" }
];

export async function searchSkills(query, { mock = false } = {}) {
  if (mock) return MOCK_SKILLS.filter(s => !query || s.repo.includes(query) || s.description.toLowerCase().includes(query.toLowerCase()));
  try {
    const url = `https://api.github.com/search/repositories?q=topic:agent-skills+${encodeURIComponent(query||"")}&sort=stars&per_page=10`;
    const res = await fetch(url, { headers: { "User-Agent": "skill-marketplace" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.items||[]).map(i => ({ repo: i.full_name, stars: i.stargazers_count, description: i.description || "" }));
  } catch {
    return MOCK_SKILLS;
  }
}
