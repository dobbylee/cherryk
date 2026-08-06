#!/usr/bin/env bash

set -Eeuo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin

readonly github_repository=dobbylee/cherryk
readonly image_repository=ghcr.io/dobbylee/cherryk-backend
readonly operator_script=/opt/cherryk/operator/deploy-backend.sh

fail() {
  echo "$1" >&2
  return 1
}

require_root() {
  if ((EUID != 0)); then
    fail "Production deployment wrapper must run as root"
  fi
}

validate_inputs() {
  local registry_user_pattern='^[A-Za-z0-9][A-Za-z0-9_-]*(\[bot\])?$'

  [[ $deploy_sha =~ ^[0-9a-f]{40}$ ]] || { fail "Invalid deploy SHA"; return; }
  [[ $image_digest =~ ^sha256:[0-9a-f]{64}$ ]] || { fail "Invalid image digest"; return; }
  [[ $registry_user =~ $registry_user_pattern ]] || { fail "Invalid registry user"; return; }
  [[ $github_token =~ ^[A-Za-z0-9._-]+$ ]] || { fail "Invalid GitHub token"; return; }
}

prepare_credentials() {
  docker_config=$(mktemp -d /tmp/cherryk-docker-config.XXXXXX) || return
  github_api_config=$(mktemp /tmp/cherryk-github-api.XXXXXX) || return
  chmod 600 "$github_api_config" || return
  printf '%s\n' \
    'fail' \
    'silent' \
    'show-error' \
    'header = "Accept: application/vnd.github+json"' \
    'header = "X-GitHub-Api-Version: 2022-11-28"' \
    "header = \"Authorization: Bearer $github_token\"" > "$github_api_config" || return
  export DOCKER_CONFIG=$docker_config
}

cleanup() {
  local status=$?

  trap - EXIT
  unset github_token
  if [[ -n ${github_api_config:-} ]]; then
    rm -f "$github_api_config"
  fi
  if [[ -n ${docker_config:-} ]]; then
    rm -rf "$docker_config"
  fi
  exit "$status"
}

remote_main_sha() {
  curl --config "$github_api_config" \
    "https://api.github.com/repos/${github_repository}/commits/main" |
    jq -er '.sha'
}

confirm_main() {
  local remote_main

  remote_main=$(remote_main_sha) || return
  if [[ $remote_main != "$deploy_sha" ]]; then
    fail "main no longer targets $deploy_sha"
    return
  fi
}

login_to_registry() {
  printf '%s' "$github_token" |
    docker login ghcr.io --username "$registry_user" --password-stdin
}

pull_and_tag_image() {
  local image_architecture
  local immutable_image="${image_repository}@${image_digest}"

  docker pull "$immutable_image" || return
  image_architecture=$(docker image inspect "$immutable_image" --format '{{.Architecture}}') || return
  if [[ $image_architecture != arm64 ]]; then
    fail "Expected an arm64 image, got $image_architecture"
    return
  fi
  docker image tag "$immutable_image" "cherryk-backend:$deploy_sha"
}

run_operator_deploy() {
  CHERRYK_EXPECTED_MAIN_SHA=$deploy_sha \
    CHERRYK_GITHUB_API_CONFIG=$github_api_config \
    DEPLOY_SHA=$deploy_sha \
    "$operator_script"
}

main() {
  require_root || return
  IFS= read -r deploy_sha || { fail "Missing deploy SHA"; return; }
  IFS= read -r image_digest || { fail "Missing image digest"; return; }
  IFS= read -r registry_user || { fail "Missing registry user"; return; }
  IFS= read -r github_token || { fail "Missing GitHub token"; return; }
  validate_inputs || return

  trap cleanup EXIT
  prepare_credentials || return
  confirm_main || return
  login_to_registry || return
  pull_and_tag_image || return
  confirm_main || return
  run_operator_deploy || return
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
  main "$@"
fi
