// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import "@untzel/skin-booth/styles.css";
import "./preview.css";
import { mountSimulated } from "./mount";
import { readPageFlags } from "./page-flags";

// Preview composition: every screen over the fake session. Flags:
//   ?screen=A|B|C|D|E|F|G|desktop-track|desktop-code|collapsed|collapsed-code|desktop-collapsed|load-failed|unsupported
//   ?data=wireframe   the 9-track onboard of the wireframes (default: phase 1)
//   ?still=1          freeze the transport at the wireframe's values
//   ?stress=<n>       n tracks
//   ?renderer=webgl2|2d, ?motion=reduce, ?template=<name>
//   ?sim=1 and ?seed=<n> are accepted for parity with apps/web; the preview is always simulated.

const root = document.getElementById("app");
if (root === null) throw new Error("Missing #app");
const page = mountSimulated(root, readPageFlags(window.location.search), `${import.meta.env.BASE_URL}brand/untzel-wordmark-dark.svg`);
Object.assign(window, { untzelPreview: page });
