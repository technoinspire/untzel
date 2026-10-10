// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
export {
  LINK_PREFIX,
  MAX_PARAMS_LENGTH,
  MAX_PAYLOAD_LENGTH,
  MAX_SOURCE_BYTES,
  SAFE_LINK_LENGTH,
  decodeFragment,
  encodeLink,
  type DecodedLink,
  type LinkFailure,
} from "./link";
export {
  FORMAT_LINE,
  MAX_FILE_BYTES,
  UNTZEL_EXTENSION,
  UNTZEL_MIME,
  isUntzelCandidate,
  readUntzelFile,
  timestamp,
  untzelFileName,
  untzelFileText,
  type FileFailure,
  type ReadFile,
} from "./untzel-file";
export { LOCAL_KEY, LocalSessionStore } from "./local-store";
export { createSourceStore } from "./source-store";
export {
  canShareFiles,
  downloadBlob,
  pageFileEnvironment,
  saveBlob,
  shareFiles,
  type FileEnvironment,
  type FilePickerAcceptType,
  type SaveOutcome,
  type ShareOutcome,
} from "./browser-file";
