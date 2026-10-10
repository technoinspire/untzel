#!/usr/bin/env node
// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pnpm lint:deps: dependency-cruiser over CRUISE_TARGETS with the repository's rules, exiting
// with its code. A package.json script cannot import the list, so this file does.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { CRUISE_TARGETS } from "./cruise-targets.mjs";
import { REPO } from "./lib.mjs";
const result = spawnSync(join(REPO, "node_modules", ".bin", "depcruise"), [...CRUISE_TARGETS, "--config", ".dependency-cruiser.cjs"], { cwd: REPO, stdio: "inherit" });
process.exit(result.status ?? 1);
