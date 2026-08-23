import { test } from "node:test";
import assert from "node:assert/strict";
import { searchSkills, MOCK_SKILLS } from "../src/search.js";

test("mock search returns", async () => {
  const res = await searchSkills("", { mock: true });
  assert.ok(res.length >= 2);
});

test("mock filter", async () => {
  const res = await searchSkills("superpowers", { mock: true });
  assert.ok(res.some(r => r.repo.includes("superpowers")));
});
