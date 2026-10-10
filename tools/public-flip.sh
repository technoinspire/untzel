#!/usr/bin/env bash
# SPDX-License-Identifier: CPAL-1.0
# Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

# The GitHub settings of technoinspire/untzel, before and after maintainers make it public.
# prepare and after-public change settings; check only reads them.
#
#   tools/public-flip.sh prepare       [--apply]  safe while the repository is private
#   tools/public-flip.sh check                    read only; exit 1 on a blocker or a gap
#   tools/public-flip.sh after-public  [--apply]  refuses to run while it is private
#   tools/public-flip.sh badge         [--apply]  README badges, once Scorecard published
#
# Without --apply, every call that would change something is printed and not run. Only a
# maintainer changes the visibility, in Settings: this script never does it, never merges a
# pull request and never creates a tag or a release.
set -euo pipefail

readonly REPO=technoinspire/untzel
readonly ORG=technoinspire
readonly TEAM=maintainers
readonly CHECKS_APP_ID=15368 # github-actions, which reports ci-ok and cla
readonly ADMIN_ROLE_ID=5     # the admin repository role, as rulesets name it
readonly DESCRIPTION="Untzel is an audiovisual instrument for the browser: every line of code is a layer of sound and a layer of light. Any style, any melody, any rhythm."
readonly TOPICS=(live-coding music music-programming creative-coding audiovisual audio web-audio webassembly rust typescript synthesizer sequencer visualizer webgl browser)
readonly RULESETS=("main: integrity" "main: review" "release tags")
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
readonly ROOT
APPLY=false

usage() {
  sed -n '8,11p' "${BASH_SOURCE[0]}" | sed 's/^#  //'
  exit 2
}

# run <what> <command...>: runs the command with --apply, prints it otherwise.
run() {
  local what=$1
  shift
  if [ "$APPLY" = true ]; then
    echo "apply: $what"
    "$@" >/dev/null
  else
    printf 'would run (%s):' "$what"
    printf ' %q' "$@"
    echo
  fi
}

# send <what> <method> <path> <json>: a REST call with a JSON body.
send() {
  local what=$1 method=$2 path=$3 body=$4
  if [ "$APPLY" = true ]; then
    echo "apply: $what"
    gh api -X "$method" "$path" --input - <<<"$body" >/dev/null
  else
    echo "would run ($what): gh api -X $method $path --input - <<< '$body'"
  fi
}

is_private() { [ "$(gh api "repos/$REPO" --jq .private)" = "true" ]; }

# api_value <default> <jq> <gh api arguments...>: one value, or the default when the call
# fails (gh prints the error body on stdout, so it is never captured).
api_value() {
  local default=$1 filter=$2 out
  shift 2
  if out=$(gh api "$@" --jq "$filter" 2>/dev/null); then echo "$out"; else echo "$default"; fi
}

exists() { gh api "$@" >/dev/null 2>&1; }

json_list() { printf '%s\n' "$@" | jq -R . | jq -sc .; }

prepare() {
  send "description, homepage, discussions, merge settings" PATCH "repos/$REPO" "$(jq -nc --arg d "$DESCRIPTION" '{
    description: $d, homepage: "https://untzel.com", has_discussions: true, has_wiki: false,
    delete_branch_on_merge: true, allow_merge_commit: false, allow_rebase_merge: false,
    allow_squash_merge: true, squash_merge_commit_title: "PR_TITLE", allow_update_branch: true}')"
  send "topics" PUT "repos/$REPO/topics" "{\"names\":$(json_list "${TOPICS[@]}")}"
  run "Dependabot alerts" gh api -X PUT "repos/$REPO/vulnerability-alerts"
  run "Dependabot security updates" gh api -X PUT "repos/$REPO/automated-security-fixes"
  send "actions pinned by SHA" PUT "repos/$REPO/actions/permissions" '{"enabled":true,"allowed_actions":"all","sha_pinning_required":true}'
  send "read-only workflow token" PUT "repos/$REPO/actions/permissions/workflow" '{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}'
  if ! exists "orgs/$ORG/teams/$TEAM"; then
    send "team $TEAM" POST "orgs/$ORG/teams" "{\"name\":\"$TEAM\",\"privacy\":\"closed\",\"description\":\"Reviews every change to Untzel (CODEOWNERS)\"}"
  fi
  send "team $TEAM maintains the repository" PUT "orgs/$ORG/teams/$TEAM/repos/$REPO" '{"permission":"maintain"}'
  local name color about
  while IFS='|' read -r name color about; do
    if exists "repos/$REPO/labels/$name"; then continue; fi
    send "label $name" POST "repos/$REPO/labels" "$(jq -nc --arg n "$name" --arg c "$color" --arg d "$about" '{name: $n, color: $c, description: $d}')"
  done <<'LABELS'
triage|fbca04|Waiting for a maintainer to look at it
sound|f65d00|Timbre, level, timing, instruments and sample packs
dependencies|0366d6|Dependency updates
LABELS
}

# report <state> <item>: one line of check.
GAPS=0
BLOCKERS=0
report() {
  printf '%-8s %s\n' "$1" "$2"
  case "$1" in MISSING) GAPS=$((GAPS + 1)) ;; BLOCKED) BLOCKERS=$((BLOCKERS + 1)) ;; esac
}
expect() { if [ "$2" = "$3" ]; then report OK "$1"; else report MISSING "$1 (now: $2)"; fi; }

check() {
  local private repo
  repo=$(gh api "repos/$REPO")
  private=$(jq -r .private <<<"$repo")
  if [ "$private" = true ]; then report AFTER "the repository is still private (a maintainer makes it public)"; else report OK "the repository is public"; fi
  expect "description" "$(jq -r .description <<<"$repo")" "$DESCRIPTION"
  expect "homepage" "$(jq -r .homepage <<<"$repo")" "https://untzel.com"
  expect "discussions on" "$(jq -r .has_discussions <<<"$repo")" true
  expect "wiki off" "$(jq -r .has_wiki <<<"$repo")" false
  expect "squash only" "$(jq -r '[.allow_squash_merge, .allow_merge_commit, .allow_rebase_merge] | map(tostring) | join(",")' <<<"$repo")" "true,false,false"
  expect "squash title is the PR title" "$(jq -r .squash_merge_commit_title <<<"$repo")" PR_TITLE
  expect "delete branch on merge" "$(jq -r .delete_branch_on_merge <<<"$repo")" true
  expect "update branch button" "$(jq -r .allow_update_branch <<<"$repo")" true
  local topic topics absent=()
  topics=" $(api_value "" '.names | join(" ")' "repos/$REPO/topics") "
  for topic in "${TOPICS[@]}"; do
    if [[ "$topics" != *" $topic "* ]]; then absent+=("$topic"); fi
  done
  if [ "${#absent[@]}" -eq 0 ]; then report OK "topics"; else report MISSING "topics (missing: ${absent[*]})"; fi
  if exists "repos/$REPO/vulnerability-alerts"; then report OK "Dependabot alerts"; else report MISSING "Dependabot alerts"; fi
  expect "Dependabot security updates" "$(api_value false .enabled "repos/$REPO/automated-security-fixes")" true
  expect "actions pinned by SHA" "$(api_value false .sha_pinning_required "repos/$REPO/actions/permissions")" true
  expect "read-only workflow token" "$(api_value none '"\(.default_workflow_permissions),\(.can_approve_pull_request_reviews)"' "repos/$REPO/actions/permissions/workflow")" "read,false"
  expect "team $TEAM maintains" "$(api_value none .role_name -H 'Accept: application/vnd.github.v3.repository+json' "orgs/$ORG/teams/$TEAM/repos/$REPO")" maintain
  local label workflow
  for label in triage sound dependencies no-changelog; do
    if exists "repos/$REPO/labels/$label"; then report OK "label $label"; else report MISSING "label $label"; fi
  done
  for workflow in cla codeql scorecard; do
    if exists "repos/$REPO/contents/.github/workflows/$workflow.yml?ref=main"; then report OK "$workflow.yml on main"; else report MISSING "$workflow.yml on main"; fi
  done
  check_after_public "$private"
  # The README's Play section sends people to app.untzel.com.
  expect "app.untzel.com answers" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://app.untzel.com/ || true)" 200
  if grep -qF '[CONDUCT_CONTACT]' "$ROOT/CODE_OF_CONDUCT.md"; then
    report BLOCKED "CODE_OF_CONDUCT.md still has the [CONDUCT_CONTACT] placeholder (maintainer action)"
  else
    report OK "code of conduct contact"
  fi
  if grep -q 'Status: draft' "$ROOT/CLA.md"; then report WARNING "CLA.md is marked as a draft"; fi
  echo "summary: $BLOCKERS blocker(s), $GAPS gap(s)"
  if [ "$BLOCKERS" -gt 0 ] || [ "$GAPS" -gt 0 ]; then return 1; fi
}

# after_state <private> <item> <now> <expected>: AFTER while private, then OK or MISSING.
after_state() {
  if [ "$1" = true ]; then
    report AFTER "$2"
  else
    expect "$2" "$3" "$4"
  fi
}

# What only exists on a public repository.
check_after_public() {
  local private=$1 existing name
  after_state "$private" "secret scanning and push protection" \
    "$(api_value none '"\(.security_and_analysis.secret_scanning.status),\(.security_and_analysis.secret_scanning_push_protection.status)"' "repos/$REPO")" "enabled,enabled"
  after_state "$private" "private vulnerability reporting" "$(api_value false .enabled "repos/$REPO/private-vulnerability-reporting")" true
  after_state "$private" "approval for every external contributor" \
    "$(api_value none .approval_policy "repos/$REPO/actions/permissions/fork-pr-contributor-approval")" all_external_contributors
  existing=$(api_value "" '.[].name' "repos/$REPO/rulesets")
  for name in "${RULESETS[@]}"; do
    after_state "$private" "ruleset $name" "$(grep -cxF "$name" <<<"$existing" || true)" 1
  done
  after_state "$private" "variable PUBLIC_REPOSITORY" "$(gh variable get PUBLIC_REPOSITORY -R "$REPO" 2>/dev/null || echo unset)" true
}

ruleset_body() {
  local checks='[{"context":"ci-ok","integration_id":'$CHECKS_APP_ID'},{"context":"cla","integration_id":'$CHECKS_APP_ID'}]'
  case "$1" in
    "main: integrity") jq -nc --argjson checks "$checks" '{name: "main: integrity", target: "branch", enforcement: "active", bypass_actors: [],
      conditions: {ref_name: {include: ["refs/heads/main"], exclude: []}},
      rules: [{type: "deletion"}, {type: "non_fast_forward"}, {type: "required_linear_history"},
        {type: "pull_request", parameters: {required_approving_review_count: 0, dismiss_stale_reviews_on_push: false, require_code_owner_review: false,
          require_last_push_approval: false, required_review_thread_resolution: false, allowed_merge_methods: ["squash"]}},
        {type: "required_status_checks", parameters: {strict_required_status_checks_policy: true, required_status_checks: $checks}}]}' ;;
    "main: review") jq -nc --argjson role "$ADMIN_ROLE_ID" '{name: "main: review", target: "branch", enforcement: "active",
      bypass_actors: [{actor_id: $role, actor_type: "RepositoryRole", bypass_mode: "pull_request"}],
      conditions: {ref_name: {include: ["refs/heads/main"], exclude: []}},
      rules: [{type: "pull_request", parameters: {required_approving_review_count: 1, dismiss_stale_reviews_on_push: true, require_code_owner_review: true,
        require_last_push_approval: true, required_review_thread_resolution: true, allowed_merge_methods: ["squash"]}}]}' ;;
    "release tags") jq -nc --argjson role "$ADMIN_ROLE_ID" '{name: "release tags", target: "tag", enforcement: "active",
      bypass_actors: [{actor_id: $role, actor_type: "RepositoryRole", bypass_mode: "always"}],
      conditions: {ref_name: {include: ["refs/tags/v*"], exclude: []}},
      rules: [{type: "creation"}, {type: "update"}, {type: "deletion"}]}' ;;
  esac
}

open_pr() { gh pr list -R "$1" --head "$2" --state open --json number --jq '.[0].number // empty'; }

after_public() {
  if is_private; then
    echo "the repository is private: change its visibility first" >&2
    exit 1
  fi
  send "secret scanning and push protection" PATCH "repos/$REPO" '{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}'
  run "private vulnerability reporting" gh api -X PUT "repos/$REPO/private-vulnerability-reporting"
  send "approval for every external contributor" PUT "repos/$REPO/actions/permissions/fork-pr-contributor-approval" '{"approval_policy":"all_external_contributors"}'
  local existing name
  existing=$(gh api "repos/$REPO/rulesets" --jq '.[].name')
  for name in "${RULESETS[@]}"; do
    if grep -qxF "$name" <<<"$existing"; then
      echo "skip: ruleset $name exists"
      continue
    fi
    send "ruleset $name" POST "repos/$REPO/rulesets" "$(ruleset_body "$name")"
  done
  run "variable PUBLIC_REPOSITORY" gh variable set PUBLIC_REPOSITORY --body true -R "$REPO"
  run "first CodeQL analysis" gh workflow run codeql.yml --ref main -R "$REPO"
  run "first Scorecard analysis" gh workflow run scorecard.yml --ref main -R "$REPO"
  badge
  local site number
  number=$(open_pr "$REPO" docs/repository-public)
  if [ -n "$number" ]; then run "docs PR #$number ready" gh pr ready "$number" -R "$REPO"; else echo "no open PR from docs/repository-public"; fi
  site=$(gh variable get SITE_REPOSITORY -R "$REPO" 2>/dev/null || true)
  number=""
  if [ -n "$site" ]; then number=$(open_pr "$site" feat/github-repository-link); fi
  if [ -n "$number" ]; then run "site PR #$number ready" gh pr ready "$number" -R "$site"; else echo "no open site PR from feat/github-repository-link"; fi
  echo "next: tools/public-flip.sh check"
}

readonly SCORECARD_BADGE='<a href="https://scorecard.dev/viewer/?uri=github.com/technoinspire/untzel"><img alt="OpenSSF Scorecard" src="https://api.scorecard.dev/projects/github.com/technoinspire/untzel/badge"></a>'
readonly RELEASE_BADGE='<a href="https://github.com/technoinspire/untzel/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/technoinspire/untzel?color=F65D00"></a>'

scorecard_published() {
  local tries=$1 code attempt
  for ((attempt = 1; attempt <= tries; attempt++)); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "https://api.scorecard.dev/projects/github.com/$REPO" || true)
    if [ "$code" = 200 ]; then return 0; fi
    if [ "$attempt" -lt "$tries" ]; then sleep 30; fi
  done
  return 1
}

badge() {
  local tries=1 # one probe without --apply; up to 10 minutes with it
  if [ "$APPLY" = true ]; then tries=20; fi
  if ! scorecard_published "$tries"; then
    echo "run \`tools/public-flip.sh badge --apply\` after the next Scorecard run"
    return 0
  fi
  local with_release=false
  if [ "$(gh release list -R "$REPO" --limit 1 --json tagName --jq length)" -gt 0 ]; then with_release=true; fi
  if [ "$APPLY" != true ]; then
    echo "would open a PR from docs/readme-badges: Scorecard badge, release badge: $with_release"
    return 0
  fi
  local temp
  temp=$(mktemp -d)
  git -C "$ROOT" fetch origin main
  git -C "$ROOT" worktree add -b docs/readme-badges "$temp/repo" origin/main
  (
    cd "$temp/repo"
    SCORECARD=$SCORECARD_BADGE perl -pi -e 's/<!-- badge:scorecard -->/$ENV{SCORECARD}/' README.md
    if [ "$with_release" = true ]; then
      RELEASE=$RELEASE_BADGE perl -pi -e 's/<!-- badge:release -->/$ENV{RELEASE}/' README.md
    fi
    git commit -qam "docs: add the Scorecard and release badges to the README"
    git push -u origin docs/readme-badges
    gh pr create -R "$REPO" --base main --head docs/readme-badges --label no-changelog \
      --title "docs: add the Scorecard and release badges" \
      --body "Fills the badge placeholders of README.md (tools/public-flip.sh badge)."
  )
  git -C "$ROOT" worktree remove "$temp/repo"
  rm -rf "$temp"
}

main() {
  [ $# -ge 1 ] || usage
  local command=$1
  shift
  for argument in "$@"; do
    case "$argument" in --apply) APPLY=true ;; *) usage ;; esac
  done
  if ! command -v gh >/dev/null || ! command -v jq >/dev/null; then
    echo "needs gh and jq" >&2
    exit 2
  fi
  case "$command" in
    prepare) prepare ;;
    check) check ;;
    after-public) after_public ;;
    badge) badge ;;
    *) usage ;;
  esac
}

main "$@"
