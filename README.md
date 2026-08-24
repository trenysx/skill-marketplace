# skill-marketplace

> **pnpm for skills — search, install, update skills from multiple sources (skills.sh, GitHub).**

<p align="center">
  <img src="./assets/hero.jpg" width="100%" alt="skill-marketplace — pnpm for agent skills">
</p>

<p align="center">
  <em>Hero: marketplace of agent skills — search, install, stars — generated with Gemini</em>
</p>

![License](https://img.shields.io/badge/license-Apache--2.0-blue) ![Node](https://img.shields.io/badge/node-%3E%3D18-green) ![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)

```bash
npx skill-marketplace search "linter" --mock
npx skill-marketplace install anthropics/skills
```

---

## Why?

Agent Skills are exploding (`topic:agent-skills` 200+ repos), but discovery is manual. This is **pnpm for skills**: one command to search across GitHub (stars, category) with offline mock fallback, then `git clone` to `.agents/skills/<name>` — reproducible, versioned, no lock-in.

## Demo

```bash
skill search "superpowers" --mock
# ⎈ Skill Marketplace — "superpowers" (1 found)
```

```
┌──────────────────────┬────────┬──────────┬─────────────────────────────┐
│ Repo                 │ Stars  │ Category │ Description                 │
├──────────────────────┼────────┼──────────┼─────────────────────────────┤
│ obra/superpowers     │ 275663 │ framework│ Agentic skills framework    │
└──────────────────────┴────────┴──────────┴─────────────────────────────┘
```

```bash
skill install anthropics/skills --dry-run
# [dry-run] would run: git clone https://github.com/anthropics/skills.git .agents/skills/skills
```

## Installation

**One-liner (npx):**
```bash
npx skill-marketplace search --mock
```

**Global:**
```bash
npm install -g skill-marketplace
skill search "linter" --mock
```

**From source:**
```bash
git clone https://github.com/trenysx/skill-marketplace
cd skill-marketplace
npm install
npm test
```

## Usage

```bash
# Search (live GitHub, fallback to mock)
skill search "linter"
skill search --mock --json
skill search "agent" --sort installs --limit 5

# Install
skill install anthropics/skills
skill install mattpocock/skills --dry-run
skill install obra/superpowers --force

# List installed
skill list
skill list --scan --json

# Info
skill info anthropics/skills --mock --json

# Update
skill update anthropics/skills
skill update --dry-run # update all

# Remove
skill remove anthropics/skills --dry-run
```

### CLI Options (shared)

| Command | Key Options |
|---------|-------------|
| `search [query]` | `--mock`, `--json`, `--sort stars|installs|name`, `--limit <n>`, `--report <path>` |
| `install <repo>` | `--dry-run`, `--force` |
| `list` | `--json`, `--scan` |
| `info <repo>` | `--mock`, `--json` |
| `update [repo]` | `--dry-run` |
| `remove <repo>` | `--dry-run` |

All repos validated as `owner/repo` (`^[a-z0-9-]+/[a-z0-9._-]+$`).

## Features

- **Live + mock:** GitHub `search/repositories?q=topic:agent-skills` with 5s timeout, fallback to 8 curated mocks (168k–275k stars)
- **Smart sort:** `stars`, `installs`, `name` — `sortSkills()` pure
- **Cache:** 5-min memory cache `getCacheStats()`/`clearCache()` for repeat queries
- **Install:** `git clone https://github.com/<repo>.git .agents/skills/<name>` + `.cache.json` tracking `addInstalled()`
- **List & scan:** `listInstalled()` from cache + `scanInstallDir()` checking `SKILL.md` existence
- **Dry-run everywhere:** Preview `git` commands without executing
- **JSON for agents:** Every command `--json` for pipelines

## Test

```bash
npm test
```

| Test | Status |
|------|--------|
| mock search returns | PASS |
| mock filter | PASS |
| validateRepo | PASS |
| filterSkills | PASS |
| sortSkills | PASS |
| search mock sort/perPage | PASS |
| cache set/get/clear | PASS |
| formatSkillForTable | PASS |
| generateMarketplaceReport | PASS |
| getSkillDetails mock | PASS |
| cache file add/list/remove/scan | PASS |
| scanInstallDir with SKILL.md | PASS |
| search empty query | PASS |
| search case insensitive | PASS |
| MOCK_SKILLS structure | PASS |
| loadCache/saveCache | PASS |

**16 tests passing** — validation, filter, sort, cache, install dir, mock.

## License

Apache-2.0 — see [LICENSE](./LICENSE). Third-party in [THIRD_PARTY.md](./THIRD_PARTY.md).

---

## Contributing

PRs welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

1. Fork → `git checkout -b feat/foo` → commit → push → PR
2. Run `npm test` — 16 must pass
3. Keep `MOCK_SKILLS` curated (stars >10k, category)

## FAQ

**Does it need GitHub token?** No, uses unauthenticated `api.github.com/search` (60 req/hour). For higher rate, set `GITHUB_TOKEN` env (future).

**What if offline?** Falls back to `MOCK_SKILLS` (8 skills) — `search --mock` always works.

**Where are skills installed?** `.agents/skills/<repo-name>` + tracked in `.agents/skills/.cache.json` via `cache.js`.

**How is it pnpm for skills?** Like `pnpm add <pkg>`, it clones to isolated dir and tracks in cache — reproducible.

**Can I update all?** `skill update` (no arg) loops `listInstalled()` and `git -C <dir> pull` each.

## Architecture

```
skill-marketplace/
├── src/
│   ├── cli.js              # commander, 6 commands (search/install/list/info/remove/update/demo)
│   ├── search.js           # searchSkills, MOCK_SKILLS (8), validateRepo, filter/sort, cache, fetch
│   ├── cache.js            # loadCache/saveCache, add/remove/list, scanInstallDir, validateInstallDir
│   └── OPEN_CORE_BOUNDARY.md
├── test/
│   └── search.test.js      # 16 tests
├── assets/
│   └── hero.jpg            # Gemini hero (800x447)
├── LICENSE / THIRD_PARTY.md
└── package.json
```

**No build step** — pure ESM, `node src/cli.js`.

## Roadmap

- [ ] `skill update --all` with parallel `git pull`
- [ ] `skill search --skills-sh` — fetch from skills.sh API
- [ ] `skill template` — scaffold `SKILL.md` from template
- [ ] Authenticated GitHub search via `GITHUB_TOKEN`

## Examples

```bash
# Search and install in one go
skill search "linter" --mock --json | jq -r '.skills[0].repo' | xargs skill install

# List what you have
skill list --scan
# ⎈ Installed Skills — 2 in cache, 2 on disk
# Repo                 | Installed At
# anthropics/skills    | 2026-08-24T00:00:00.000Z
```

## Version

Current `v0.1.0` — see [package.json](./package.json).

---

**Star if this helped you discover skills — and tell us which skill you installed!**
