#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { execSync } from "node:child_process";
import { searchSkills, MOCK_SKILLS, validateRepo, getSkillDetails, generateMarketplaceReport, sortSkills } from "./search.js";
import { listInstalled, addInstalled, removeInstalled, scanInstallDir, validateInstallDir, getInstallDir } from "./cache.js";

const program = new Command();
program.name("skill-marketplace").description("pnpm for skills — search, install, update skills from multiple sources").version("0.1.0");

// --- search ---
program.command("search")
  .alias("find")
  .description("Search skills (GitHub topic:agent-skills)")
  .argument("[query]", "search term", "")
  .option("--mock", "use mock data (offline)", false)
  .option("--json", "json output", false)
  .option("--sort <by>", "sort by: stars|installs|name", "stars")
  .option("--limit <n>", "limit results", "10")
  .option("--report <path>", "write markdown report", null)
  .action(async (query, opts) => {
    const limit = parseInt(opts.limit, 10) || 10;
    const skills = await searchSkills(query, { mock: !!opts.mock, sortBy: opts.sort, perPage: limit });
    if (opts.json) { console.log(JSON.stringify({ query, total: skills.length, skills }, null, 2)); return; }
    if (!skills.length) { console.log(chalk.yellow(`No skills found for "${query}"`)); return; }
    const t = new Table({
      head: [chalk.cyan("Repo"), chalk.cyan("Stars"), chalk.cyan("Category"), chalk.cyan("Description")],
      colWidths: [28, 10, 14, 48],
      wordWrap: true,
      style: { head: [], border: [] }
    });
    for (const s of skills) t.push([s.repo, String(s.stars), s.category || "-", s.description.slice(0, 48)]);
    console.log(chalk.bold.cyan(`\n⎈ Skill Marketplace — "${query || "all"}" (${skills.length} found)`));
    console.log(t.toString());
    if (opts.report) {
      const { writeFile } = await import("node:fs/promises");
      const md = generateMarketplaceReport(skills, query);
      await writeFile(opts.report, md, "utf8");
      console.log(chalk.dim(`Report written to ${opts.report}`));
    }
  });

// --- install ---
program.command("install")
  .alias("add")
  .description("Install a skill (git clone to .agents/skills/<name>)")
  .argument("<repo>", "repo like anthropics/skills")
  .option("--dry-run", "show what would be done", false)
  .option("--force", "force re-install if exists", false)
  .action(async (repo, opts) => {
    const v = validateRepo(repo);
    if (!v.valid) { console.error(chalk.red(`Invalid repo: ${v.reason}`)); process.exit(1); }
    const normalized = v.normalized;
    const dir = await getInstallDir(normalized);
    console.log(chalk.dim(`Installing ${normalized} → ${dir} ...`));
    if (opts.dryRun) { console.log(chalk.dim(`[dry-run] would run: git clone https://github.com/${normalized}.git ${dir}`)); return; }
    const existing = await validateInstallDir(normalized);
    if (existing.exists && !opts.force) {
      console.error(chalk.yellow(`Already installed at ${dir} (use --force to reinstall)`));
      process.exitCode = 1; return;
    }
    try {
      execSync(`git clone https://github.com/${normalized}.git ${JSON.stringify(dir)}`, { stdio: "inherit" });
      await addInstalled(normalized);
      console.log(chalk.green(`✓ Installed ${normalized} → ${dir}`));
    } catch (e) { console.error(chalk.red(`Failed: ${e.message}`)); process.exit(1); }
  });

// --- list ---
program.command("list")
  .alias("ls")
  .description("List installed skills")
  .option("--json", "json output", false)
  .option("--scan", "scan .agents/skills directory", false)
  .action(async (opts) => {
    const installed = await listInstalled();
    const scanned = opts.scan ? await scanInstallDir() : [];
    if (opts.json) { console.log(JSON.stringify({ installed, scanned }, null, 2)); return; }
    if (!installed.length && !scanned.length) { console.log(chalk.yellow("No skills installed — try: skill install anthropics/skills")); return; }
    console.log(chalk.bold.cyan(`\n⎈ Installed Skills — ${installed.length} in cache, ${scanned.length} on disk`));
    if (installed.length) {
      const t = new Table({ head: [chalk.cyan("Repo"), chalk.cyan("Installed At")], colWidths: [40, 30], style: { head: [], border: [] } });
      for (const s of installed) t.push([s.repo, s.installedAt || "-"]);
      console.log(t.toString());
    }
    if (opts.scan && scanned.length) {
      console.log(chalk.dim("\nScanned .agents/skills:"));
      for (const s of scanned) console.log(` - ${s.name} ${s.hasSkillMd ? chalk.green("✓ SKILL.md") : chalk.yellow("no SKILL.md")} @ ${s.path}`);
    }
  });

// --- info ---
program.command("info")
  .description("Show skill details")
  .argument("<repo>", "repo like anthropics/skills")
  .option("--mock", "use mock", false)
  .option("--json", "json output", false)
  .action(async (repo, opts) => {
    try {
      const details = await getSkillDetails(repo, { mock: !!opts.mock });
      if (opts.json) { console.log(JSON.stringify(details, null, 2)); return; }
      console.log(chalk.bold.cyan(`\n⎈ ${details.repo}`));
      console.log(`Stars: ${details.stars} | Category: ${details.category}`);
      console.log(`Description: ${details.description}`);
      console.log(`URL: ${details.tgz}`);
      const local = await validateInstallDir(repo);
      console.log(chalk.dim(`Installed: ${local.exists ? "yes" : "no"}${local.hasSkillMd ? " (SKILL.md present)" : ""}`));
    } catch (e) { console.error(chalk.red(e.message)); process.exit(1); }
  });

// --- remove ---
program.command("remove")
  .alias("rm")
  .description("Remove an installed skill")
  .argument("<repo>", "repo like anthropics/skills")
  .option("--dry-run", "dry run", false)
  .action(async (repo, opts) => {
    const v = validateRepo(repo);
    if (!v.valid) { console.error(chalk.red(v.reason)); process.exit(1); }
    const dir = await getInstallDir(v.normalized);
    console.log(chalk.dim(`Removing ${v.normalized} @ ${dir} ...`));
    if (opts.dryRun) { console.log(chalk.dim(`[dry-run] would remove ${dir} and cache entry`)); return; }
    try {
      const { rm } = await import("node:fs/promises");
      await rm(dir, { recursive: true, force: true });
      await removeInstalled(v.normalized);
      console.log(chalk.green(`✓ Removed ${v.normalized}`));
    } catch (e) { console.error(chalk.red(e.message)); process.exit(1); }
  });

// --- update ---
program.command("update")
  .description("Update an installed skill (git pull)")
  .argument("[repo]", "repo to update, or all if omitted", "")
  .option("--dry-run", "dry run", false)
  .action(async (repo, opts) => {
    if (repo) {
      const v = validateRepo(repo);
      if (!v.valid) { console.error(chalk.red(v.reason)); process.exit(1); }
      const dir = await getInstallDir(v.normalized);
      console.log(chalk.dim(`Updating ${v.normalized} @ ${dir} ...`));
      if (opts.dryRun) { console.log(chalk.dim(`[dry-run] would run: git -C ${dir} pull`)); return; }
      try { execSync(`git -C ${JSON.stringify(dir)} pull`, { stdio: "inherit" }); console.log(chalk.green(`✓ Updated ${v.normalized}`)); }
      catch (e) { console.error(chalk.red(e.message)); process.exit(1); }
    } else {
      const installed = await listInstalled();
      if (!installed.length) { console.log(chalk.yellow("No installed skills")); return; }
      for (const s of installed) {
        const dir = await getInstallDir(s.repo);
        console.log(chalk.dim(`Updating ${s.repo} ...`));
        if (opts.dryRun) console.log(chalk.dim(`[dry-run] git -C ${dir} pull`));
        else try { execSync(`git -C ${JSON.stringify(dir)} pull`, { stdio: "inherit" }); } catch (e) { console.error(chalk.red(`Failed ${s.repo}: ${e.message}`)); }
      }
      console.log(chalk.green(`✓ Update done for ${installed.length} skills`));
    }
  });

// --- demo ---
program.command("demo")
  .description("Demo with mock data")
  .action(async () => {
    const skills = await searchSkills("", { mock: true });
    console.log(chalk.bold(`Mock skills: ${skills.length}`));
    console.log(skills.slice(0, 3));
    console.log(chalk.dim("\nTry: skill search \"linter\" --mock --json"));
  });

if (process.argv.length === 2) program.parse(["node", "cli.js", "search", "--mock"]);
else program.parse();
