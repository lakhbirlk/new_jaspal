#!/usr/bin/env bash
# Build the single frontend+backend image and push it to ECR.
#
# Usage: ./build-push.sh <aws-region> <ecr-repository-url> [tag] [platform]
# Example: ./build-push.sh us-east-1 123456789012.dkr.ecr.us-east-1.amazonaws.com/business-directory-prod latest linux/amd64
set -euo pipefail

REGION="${1:?usage: build-push.sh <region> <ecr-repo-url> [tag] [platform]}"
REPOSITORY="${2:?usage: build-push.sh <region> <ecr-repo-url> [tag] [platform]}"
TAG="${3:-latest}"
PLATFORM="${4:-linux/amd64}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGISTRY="${REPOSITORY%%/*}"

aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

docker buildx build \
  --platform "$PLATFORM" \
  --tag "${REPOSITORY}:${TAG}" \
  --push \
  "$ROOT"

echo "Pushed ${REPOSITORY}:${TAG} (${PLATFORM})"
