#!/bin/bash
set -euo pipefail

version="v0.5.0"
base="https://github.com/kishann-19/Aster-System_Assistant/releases/download/$version"
destination="$HOME/Applications/Aster-0.5.0"
if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
  echo "This build requires an Apple Silicon Mac." >&2
  exit 1
fi
if [ -e "$destination/Aster.app" ]; then
  echo "Aster is already installed at $destination/Aster.app"
  open "$destination/Aster.app"
  exit 0
fi
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fL --retry 3 "$base/Aster-Mac.zip" -o "$tmp/Aster-Mac.zip"
curl -fsSL --retry 3 "$base/Aster-Mac.sha256" -o "$tmp/Aster-Mac.sha256"
expected="$(awk 'NR==1 {print $1}' "$tmp/Aster-Mac.sha256")"
actual="$(shasum -a 256 "$tmp/Aster-Mac.zip" | awk '{print $1}')"
[ "$actual" = "$expected" ] || { echo "Download checksum mismatch." >&2; exit 1; }
ditto -x -k "$tmp/Aster-Mac.zip" "$tmp/unpacked"
codesign --verify --deep --strict "$tmp/unpacked/Aster.app"
mkdir -p "$destination"
ditto "$tmp/unpacked/Aster.app" "$destination/Aster.app"
echo "Installed at $destination/Aster.app"
open "$destination/Aster.app"
