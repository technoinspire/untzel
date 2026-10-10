// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// window.untzelDemo, for pnpm demo record. Loaded with the
// test hooks, only in the test build with ?demo; check-budgets.mjs fails if the name reaches
// production. The take is the Record's own: the same TakeCapture over the same command
// watch, with the auditions in and no cap, so pnpm sim --take renders what the video shows.
import type { CommandWatch, Engine, ReceiptMessage } from "@untzel/audio/main";
import type { Session, SessionView } from "@untzel/session";
import { TakeRecorder, encodeTake } from "@untzel/take";
import { exportTitleText } from "../../adapters/controls/export-sheet/export-title";
import { TakeCapture } from "../../adapters/take/take-capture";
import { createDemoCards, type DemoCards } from "./demo-cards";
import { createDemoCursor } from "./demo-cursor";

export interface DemoHookSources {
  readonly engine: Engine;
  readonly session: Session;
  /** brand/untzel-lockup-dark.png, for the closing card. */
  readonly logoUrl: string;
}

/** What the title card says: the finished song's title, tempo and key. */
export type DemoSong = Pick<SessionView, "title" | "tempo" | "key">;

export interface Attribution {
  readonly isVisible: boolean;
  readonly text: string;
}

interface Armed {
  readonly recorder: TakeRecorder;
  readonly watch: CommandWatch;
}

/** In the viewport, and what the centre of its box hits is the element itself or inside it. */
function isUncovered(element: Element | null): boolean {
  if (element === null) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
  const hit = document.elementFromPoint(x, y);
  return hit !== null && (hit === element || element.contains(hit));
}

function attribution(): Attribution {
  const logo = document.querySelector('a[href="https://untzel.com"] img');
  const phrase = document.querySelector(".ui-attribution__phrase");
  return { isVisible: isUncovered(logo) && isUncovered(phrase), text: phrase?.textContent ?? "" };
}

/** Arms a recorder on the engine's command watch; resolves once the arm's receipt is in. */
function arm(sources: DemoHookSources): Promise<Armed> {
  const recorder = new TakeRecorder({ sampleRate: sources.engine.clock.sampleRate, capSeconds: Number.POSITIVE_INFINITY, includesAuditions: true });
  return new Promise((resolve, reject) => {
    let watch: CommandWatch | null = null;
    let isArmed = false;
    const capture = new TakeCapture(recorder, sources.session, {
      received: (outcome, receipt: ReceiptMessage) => {
        if (!isArmed && receipt.command === "receipts" && outcome === "recorded" && watch !== null) {
          isArmed = true;
          resolve({ recorder, watch });
        } else if (outcome !== "recorded" && outcome !== "disarmed") {
          console.error("demo take:", outcome, receipt.command);
          if (!isArmed) reject(new Error(`the arm was refused: ${outcome}`));
        }
      },
      lost: () => console.error("demo take: the engine is gone"),
    });
    watch = sources.engine.sound.watchCommands(capture);
  });
}

export function installDemoHooks(sources: DemoHookSources): void {
  const { engine, session } = sources;
  const cards: DemoCards = createDemoCards(document.body, sources.logoUrl);
  createDemoCursor(document.body);
  let armed: Armed | null = null;
  const hooks = {
    armTake: async (): Promise<number> => {
      if (armed !== null) throw new Error("a take is already armed");
      armed = await arm(sources);
      return engine.clock.nowFrame() ?? 0;
    },
    finishTake: async (): Promise<string> => {
      const current = armed;
      if (current === null) throw new Error("no take is armed");
      armed = null;
      const disarm = await current.watch.stop();
      const view = session.view();
      const take = current.recorder.finish("stop", disarm?.frame ?? current.recorder.lastFrame(), view.title);
      if (take === null) throw new Error("the take has no sound: nothing played");
      return encodeTake(take);
    },
    sessionText: (): string => session.view().source,
    // Written by the stage mount once the light picked its level; null before.
    stageRenderer: (): string | null => document.documentElement.dataset["renderer"] ?? null,
    attribution,
    showCard: (kind: "title" | "brand", song?: DemoSong): Promise<void> =>
      kind === "title" ? cards.showTitle(exportTitleText(song ?? session.view(), "Untitled")) : cards.showBrand(),
    hideCards: (): void => cards.hide(),
  };
  (window as unknown as Record<string, unknown>)["untzelDemo"] = hooks;
}
