#!/bin/bash
# Étape 4 : revue qualité du dashboard par Opus 5.5.
cd "/mnt/c/Users/Timothée/Documents/IA/Hermes/FermentationLab2" || { echo "cd impossible"; exit 1; }
echo "cwd=$(pwd)" > _build/logs/opus-revue.log
date -Iseconds >> _build/logs/opus-revue.log
PROMPT="$(cat _build/brief-opus-2-revue.md)"
claude -p "$PROMPT" \
  --model opus --effort high \
  --allowedTools "Read Write Edit Glob Grep Bash" \
  --disallowedTools "WebFetch WebSearch" \
  --max-turns 140 \
  --output-format stream-json --verbose --no-session-persistence \
  >> _build/logs/opus-revue.log 2>&1
echo "EXIT=$?" >> _build/logs/opus-revue.log
date -Iseconds >> _build/logs/opus-revue.log
