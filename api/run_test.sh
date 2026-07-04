#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
"$SCRIPT_DIR/convert.sh" -s gaudi-organic < "$SCRIPT_DIR/test.md"
