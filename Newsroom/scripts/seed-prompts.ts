#!/usr/bin/env tsx

// Prints prompt defaults as JSON for manual seeding in the Firestore Console.
// In this setup, `Prompts` are publicly readable and writes are blocked by rules.

import { DEFAULT_PROMPTS } from "../src/lib/prompt-defaults";

const pretty = process.argv.includes("--pretty");

const payload = {
  Prompts: DEFAULT_PROMPTS,
};

process.stdout.write(pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload));
process.stdout.write("\n");
