#!/usr/bin/env bash
# =============================================================================
# install-bv.sh -- Download the bv (beads_viewer) binary from GitHub releases
# =============================================================================
#
# Called automatically via the "postinstall" npm script. Downloads the
# appropriate platform binary and places it in node_modules/.bin/bv.
#
# If the download fails (no internet, unsupported platform, etc.) we print a
# warning and exit 0 so that `npm install` is never blocked.  The app has a
# SQLite/JSONL fallback that works without bv.
# =============================================================================

set -euo pipefail

BV_VERSION="0.14.4"
REPO="Dicklesworthstone/beads_viewer"

# Resolve the project root (one level up from this script's directory).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_DIR="$PROJECT_ROOT/node_modules/.bin"
BV_BIN="$BIN_DIR/bv"

# ---------------------------------------------------------------------------
# Helper: print a warning and exit cleanly
# ---------------------------------------------------------------------------
warn_and_exit() {
  echo ""
  echo "Warning: Could not install bv (beads_viewer). The app will use SQLite fallback."
  echo "Install manually: brew install dicklesworthstone/tap/bv"
  echo ""
  exit 0
}

# ---------------------------------------------------------------------------
# Skip if bv is already installed
# ---------------------------------------------------------------------------
# Note: `bv --version` currently outputs just "bv" without a version number,
# so we check for a marker file that records which version we downloaded.
BV_VERSION_MARKER="$BIN_DIR/.bv-version"

if [ -x "$BV_BIN" ] && [ -f "$BV_VERSION_MARKER" ]; then
  INSTALLED_VERSION=$(cat "$BV_VERSION_MARKER" 2>/dev/null || true)
  if [ "$INSTALLED_VERSION" = "$BV_VERSION" ]; then
    echo "bv v${BV_VERSION} is already installed at $BV_BIN -- skipping download."
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Detect OS and architecture
# ---------------------------------------------------------------------------
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
  darwin)  OS="darwin" ;;
  linux)   OS="linux"  ;;
  mingw*|msys*|cygwin*)
    OS="windows"
    ;;
  *)
    echo "Unsupported OS: $OS"
    warn_and_exit
    ;;
esac

case "$ARCH" in
  x86_64)          ARCH="amd64" ;;
  aarch64|arm64)   ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH"
    warn_and_exit
    ;;
esac

# ---------------------------------------------------------------------------
# Construct the download URL (versioned asset names)
# ---------------------------------------------------------------------------
ASSET_NAME="bv_${BV_VERSION}_${OS}_${ARCH}.tar.gz"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${BV_VERSION}/${ASSET_NAME}"

echo "Downloading bv v${BV_VERSION} for ${OS}/${ARCH}..."
echo "  URL: $DOWNLOAD_URL"

# ---------------------------------------------------------------------------
# Download and extract
# ---------------------------------------------------------------------------
TMPDIR_BV="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_BV"' EXIT

if ! curl -fsSL --retry 2 --retry-delay 3 -o "$TMPDIR_BV/$ASSET_NAME" "$DOWNLOAD_URL"; then
  echo "Download failed."
  warn_and_exit
fi

if ! tar -xzf "$TMPDIR_BV/$ASSET_NAME" -C "$TMPDIR_BV"; then
  echo "Extraction failed."
  warn_and_exit
fi

# The binary is named `bv` (or `bv.exe` on Windows).
BINARY_NAME="bv"
if [ "$OS" = "windows" ]; then
  BINARY_NAME="bv.exe"
fi

if [ ! -f "$TMPDIR_BV/$BINARY_NAME" ]; then
  echo "Binary '$BINARY_NAME' not found in archive."
  warn_and_exit
fi

# ---------------------------------------------------------------------------
# Install into node_modules/.bin
# ---------------------------------------------------------------------------
mkdir -p "$BIN_DIR"
mv "$TMPDIR_BV/$BINARY_NAME" "$BV_BIN"
chmod +x "$BV_BIN"

# Record the installed version so we can skip re-downloading next time.
echo "$BV_VERSION" > "$BV_VERSION_MARKER"

echo ""
echo "bv v${BV_VERSION} installed successfully at $BV_BIN"
echo ""
