#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { searchSkills, MOCK_SKILLS } from "./search.js";
import { execSync } from "node:child_process";

const program = new Command();
program.name("skill-marketplace").description("pnpm for skills — search/install").version("0.1.0");

program.command("search")
  .argument("[query]", "search term", "")
  .option("--mock", "mock", false)
  .option("--json", "json", false)
  .action(async (query, opts) => {
    const skills = await searchSkills(query, { mock: !!opts.mock });
    if (opts.json) { console.log(JSON.stringify(skills, null, 2)); return; }
    const t = new Table({ head: [chalk.cyan("Repo"), chalk.cyan("Stars"), chalk.cyan("Description")], colWidths: [30, 10, 60], style: { head: [], border: [] } });
    for (const s of skills) t.push([s.repo, String(s.stars), s.description.slice(0,60)]);
    console.log(t.toString());
  });

program.command("install")
  .argument("<repo>", "repo like anthropics/skills")
  .action((repo) => {
    console.log(chalk.dim(`Cloning ${repo} to .agents/skills/${repo.split("/")[1]} ...`));
    try {
      execSync(`git clone https://github.com/${repo}.git .agents/skills/${repo.split("/")[1]}`, { stdio: "inherit" });
      console.log(chalk.green(`✓ Installed ${repo}`));
    } catch (e) { console.error(chalk.red(`Failed: ${e.message}`)); process.exit(1); }
  });

program.command("demo").action(async () => {
  const skills = await searchSkills("", { mock: true });
  console.log(`Mock skills: ${skills.length}`);
});

if (process.argv.length === 2) program.parse(["node","cli.js","search","--mock"]);
else program.parse();
