// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setText } from "../dom";
import type { SessionIntents } from "@untzel/skin-contract";
import type { ProjectView, TemplatesView } from "@untzel/presentation/view-model";
import type { ProjectIntents } from "@untzel/skin-contract";
import { phrases, text } from "../../copy/copy";
import { createTemplatePicker } from "./template-picker";

/** "Continue Night Drive": the most recent stored project, if any. */
export function continueLabel(latest: ProjectView["latest"]): string | null {
  return latest === null ? null : phrases.continueProject(latest.title);
}

/** The waiting screen's templates: Start blank, the picker, its hint, and Continue the latest project. */
export function createIdleTemplates(intents: SessionIntents & Pick<ProjectIntents, "continueProject">): {
  readonly root: HTMLElement;
  setResume(project: ProjectView): void;
  update(templates: TemplatesView): void;
} {
  const picker = createTemplatePicker("ui-templates-label", intents);
  let latestId: string | null = null;
  const resume = button("ui-pill ui-pill--outline ui-idle__resume", "", () => {
    if (latestId !== null) intents.continueProject(latestId);
  });
  return {
    root: element("div", { className: "ui-idle__templates" }, [
      picker.blank,
      element("p", { className: "ui-idle__templates-label", text: text.startFromTemplate, attributes: { id: "ui-templates-label" } }),
      picker.root,
      element("p", { className: "ui-idle__hint", text: text.templateHint }),
      element("div", { className: "ui-idle__more" }, [resume]),
    ]),
    setResume(project) {
      const resumeLabel = continueLabel(project.latest);
      latestId = project.latest?.id ?? null;
      resume.hidden = resumeLabel === null || project.title !== null;
      setText(resume, resumeLabel ?? "");
    },
    update: (templates) => picker.update(templates),
  };
}
