#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
API_ROOT="${REPO_ROOT}/api"
LOCK_DIR="${REPO_ROOT}/.git/cron-auto-update.lock"
ROOT_STATUS_EXCLUDES=(
  ":(exclude)logs/cron-auto-update.log"
)

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" "$*"
}

cleanup() {
  rmdir "${LOCK_DIR}" 2>/dev/null || true
}

current_head() {
  git -C "$1" rev-parse HEAD
}

working_tree_is_dirty() {
  local repo_dir="$1"
  shift
  local status_output
  if [[ "${repo_dir}" == "${REPO_ROOT}" ]]; then
    status_output="$(git -C "${repo_dir}" status --porcelain "$@" -- . "${ROOT_STATUS_EXCLUDES[@]}")"
  else
    status_output="$(git -C "${repo_dir}" status --porcelain "$@")"
  fi
  [[ -n "${status_output}" ]]
}

fast_forward_pull_if_needed() {
  local repo_dir="$1"
  local repo_label="$2"
  local branch_name="$3"
  local remote_name="$4"

  local upstream_ref="${remote_name}/${branch_name}"
  local local_head
  local upstream_head

  local_head="$(current_head "${repo_dir}")"

  log "Fetching ${repo_label} from ${upstream_ref}..."
  git -C "${repo_dir}" fetch --prune "${remote_name}"

  upstream_head="$(git -C "${repo_dir}" rev-parse "${upstream_ref}")"

  if [[ "${local_head}" == "${upstream_head}" ]]; then
    log "${repo_label}: no new commit on ${upstream_ref}."
    return 1
  fi

  if ! git -C "${repo_dir}" merge-base --is-ancestor "${local_head}" "${upstream_head}"; then
    log "${repo_label}: local branch is ahead of or diverged from ${upstream_ref}; refusing automatic pull."
    return 2
  fi

  log "${repo_label}: new commit detected on ${upstream_ref}; attempting fast-forward pull."
  git -C "${repo_dir}" pull --ff-only "${remote_name}" "${branch_name}"

  local new_head
  new_head="$(current_head "${repo_dir}")"
  if [[ "${new_head}" == "${local_head}" ]]; then
    log "${repo_label}: pull completed but HEAD did not change."
    return 1
  fi

  log "${repo_label}: updated from ${local_head} to ${new_head}."
  return 0
}

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  log "Another cron auto-update run is already in progress; exiting."
  exit 0
fi

trap cleanup EXIT

if [[ ! -d "${API_ROOT}/.git" && ! -f "${API_ROOT}/.git" ]]; then
  log "api/ submodule is missing; refusing to run."
  exit 0
fi

if working_tree_is_dirty "${REPO_ROOT}" --ignore-submodules=all; then
  log "Root working tree is not clean; refusing to pull automatically."
  exit 0
fi

if working_tree_is_dirty "${API_ROOT}"; then
  log "API working tree is not clean; refusing to pull automatically."
  exit 0
fi

root_branch="$(git -C "${REPO_ROOT}" branch --show-current)"
if [[ -z "${root_branch}" ]]; then
  log "Root repo is in detached HEAD state; refusing automatic pull."
  exit 0
fi

root_upstream_ref="$(git -C "${REPO_ROOT}" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
if [[ -z "${root_upstream_ref}" ]]; then
  log "Root repo has no upstream tracking branch; exiting."
  exit 0
fi

root_remote="${root_upstream_ref%%/*}"
root_upstream_branch="${root_upstream_ref#*/}"

api_branch="$(git -C "${API_ROOT}" branch --show-current)"
if [[ "${api_branch}" != "main" ]]; then
  log "API repo is on '${api_branch:-detached}' instead of 'main'; refusing automatic pull."
  exit 0
fi

api_remote="origin"
if ! git -C "${API_ROOT}" rev-parse --verify "${api_remote}/main" >/dev/null 2>&1; then
  log "API repo does not have ${api_remote}/main available yet; fetching first."
  git -C "${API_ROOT}" fetch --prune "${api_remote}"
fi

root_updated=0
api_updated=0

if fast_forward_pull_if_needed "${REPO_ROOT}" "Root repo" "${root_upstream_branch}" "${root_remote}"; then
  root_updated=1
fi

git -C "${REPO_ROOT}" submodule sync --recursive
git -C "${REPO_ROOT}" submodule update --init --recursive

if fast_forward_pull_if_needed "${API_ROOT}" "API repo" "main" "${api_remote}"; then
  api_updated=1
fi

if [[ "${root_updated}" -eq 0 && "${api_updated}" -eq 0 ]]; then
  log "No new commit arrived in root or api; nothing to do."
  exit 0
fi

log "Changes detected. Running pnpm install..."
cd "${REPO_ROOT}"
pnpm install

log "Running pnpm build..."
pnpm build

log "Running pnpm pm2:restart..."
pnpm pm2:restart

log "Auto-update completed successfully."
