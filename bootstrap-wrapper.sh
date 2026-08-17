#!/usr/bin/env bash
#
# One-time (or CI) bootstrap for gradle-wrapper.jar.
#
# WHY THIS SCRIPT EXISTS: gradle-wrapper.jar is a small compiled binary,
# not source — it isn't something that can be hand-authored, and this
# scaffold was generated in an offline sandbox with no network access,
# so the real binary couldn't be embedded directly. Run this script once
# (locally, or as an explicit CI step — see .github/workflows/build.yml)
# to fetch and verify the authentic jar for the exact Gradle version
# pinned in gradle-wrapper.properties. Commit the resulting jar and the
# project becomes 100% self-contained for every clone after that — no
# machine needs to run this script, or have a system `gradle` installed,
# ever again.
#
# Source: the jar is fetched from the official gradle/gradle GitHub repo
# at the matching release tag — gradle-wrapper.jar is version-locked and
# identical whether obtained this way or via `gradle wrapper` / a full
# distribution zip, since all three are built from the same release.
#
# Usage:
#   ./android/gradle/wrapper/bootstrap-wrapper.sh
#
# The script verifies the downloaded SHA-256 against Gradle's published
# checksum before leaving the JAR on disk.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROPS_FILE="$SCRIPT_DIR/gradle-wrapper.properties"
JAR_PATH="$SCRIPT_DIR/gradle-wrapper.jar"

if [ ! -f "$PROPS_FILE" ]; then
  echo "error: $PROPS_FILE not found" >&2
  exit 1
fi

# Pull the Gradle version out of distributionUrl, e.g.
# .../gradle-8.6-all.zip -> 8.6
GRADLE_VERSION=$(grep '^distributionUrl=' "$PROPS_FILE" \
  | sed -E 's#.*gradle-([0-9][^-]*)-(all|bin)\.zip#\1#')

if [ -z "$GRADLE_VERSION" ]; then
  echo "error: could not parse Gradle version from $PROPS_FILE" >&2
  exit 1
fi

case "$GRADLE_VERSION" in
  8.13) EXPECTED_SHA256="81a82aaea5abcc8ff68b3dfcb58b3c3c429378efd98e7433460610fecd7ae45f" ;;
  *)
    echo "error: no pinned wrapper checksum is configured for Gradle $GRADLE_VERSION" >&2
    echo "Add the official SHA-256 from https://gradle.org/release-checksums/ before using this bootstrap script." >&2
    exit 1
    ;;
esac

SOURCE_URL="https://raw.githubusercontent.com/gradle/gradle/v${GRADLE_VERSION}.0/gradle/wrapper/gradle-wrapper.jar"

echo "Fetching gradle-wrapper.jar for Gradle ${GRADLE_VERSION}"
echo "  from: $SOURCE_URL"

curl -fL --retry 3 -o "$JAR_PATH" "$SOURCE_URL"

echo
echo "Downloaded to: $JAR_PATH"
if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL_SHA256=$(sha256sum "$JAR_PATH" | awk '{print $1}')
else
  ACTUAL_SHA256=$(shasum -a 256 "$JAR_PATH" | awk '{print $1}')
fi
echo "SHA-256: $ACTUAL_SHA256"
if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
  echo "error: wrapper JAR checksum mismatch" >&2
  echo "expected: $EXPECTED_SHA256" >&2
  echo "actual:   $ACTUAL_SHA256" >&2
  rm -f "$JAR_PATH"
  exit 1
fi
echo "Wrapper JAR checksum verified against Gradle's published checksum."
