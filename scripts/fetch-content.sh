#!/bin/bash
# Fetch content from external repo and set up for Jekyll build
#
# Local dev: content/ folder already exists with its own .git
# CI: clones CONTENT_REPO into content/

set -e

CONTENT_DIR="content"
POSTS_DIR="_posts"
DRAFTS_DIR="_drafts"
DATA_DIR="_data"
ABOUT_DIR="about"

# In CI, clone the content repo if CONTENT_REPO is set. Skip when content/
# already has its own .git (already cloned). Bail out if content/ exists
# but is not a git repo — git clone would fail with a confusing error
# message, and silently overwriting a hand-populated content/ would lose
# the user's work.
if [ -n "$CONTENT_REPO" ] && [ ! -d "$CONTENT_DIR/.git" ]; then
  if [ -d "$CONTENT_DIR" ] && [ -n "$(ls -A "$CONTENT_DIR" 2>/dev/null)" ]; then
    echo "Error: $CONTENT_DIR/ exists and is not a git checkout. Refusing to clone over it."
    echo "Either remove $CONTENT_DIR/ or unset CONTENT_REPO."
    exit 1
  fi
  echo "Cloning content from $CONTENT_REPO..."
  git clone --depth 1 \
    "https://x-access-token:${CONTENT_PAT:-$GITHUB_TOKEN}@github.com/${CONTENT_REPO}.git" \
    "$CONTENT_DIR"
fi

# Generators always run as long as some site.yml is reachable. This handles
# three cases:
#   1. content/ missing entirely (single-repo / preview mode) — generate
#      from _data/site.yml if it exists.
#   2. content/ exists with site.yml — copy it into _data/ and generate.
#   3. content/ exists but has no site.yml (e.g. user ran `make new-post`
#      before adding site.yml) — keep using _data/site.yml.
mkdir -p "$DATA_DIR"
if [ -d "$CONTENT_DIR" ] && [ -f "$CONTENT_DIR/site.yml" ]; then
  cp "$CONTENT_DIR/site.yml" "$DATA_DIR/site.yml"
  echo "Copied site.yml to $DATA_DIR/"
fi

if [ -f "$DATA_DIR/site.yml" ]; then
  echo "Generating Jekyll config and CNAME..."
  node scripts/generate-config.js
  echo "Generating taglines.ts..."
  node scripts/generate-taglines.js
  echo "Generating about page..."
  node scripts/generate-about.js
else
  echo "No site.yml found in content/ or _data/ — skipping config generators."
fi

# Bail out early when there's no content/ folder at all — nothing to copy.
if [ ! -d "$CONTENT_DIR" ]; then
  echo "No content/ directory; using existing _posts/ if any."
  echo "Done!"
  exit 0
fi

echo "Processing content..."

# Resolve CMS-configurable subdirectories so the local build copies from
# the same paths the in-browser CMS commits to (cms.content_posts_path /
# cms.content_drafts_path in site.yml).
POSTS_SUBDIR=""
DRAFTS_SUBDIR="drafts"
if cms_paths="$(node scripts/print-cms-paths.js 2>/dev/null)"; then
  eval "$cms_paths"
fi

POSTS_SRC="$CONTENT_DIR"
[ -n "$POSTS_SUBDIR" ] && POSTS_SRC="$CONTENT_DIR/$POSTS_SUBDIR"
DRAFTS_SRC="$CONTENT_DIR/$DRAFTS_SUBDIR"

mkdir -p "$POSTS_DIR" "$ABOUT_DIR"

# Copy markdown posts. Only files matching YYYY-MM-DD-*.md are treated
# as posts — README.md, system-prompt.md, *.example.md, etc. live next
# to posts in the content repo and would otherwise leak into _posts/.
count=0
skipped=0
if [ -d "$POSTS_SRC" ]; then
  for file in "$POSTS_SRC"/*.md; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      if echo "$filename" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}-.+\.md$'; then
        cp "$file" "$POSTS_DIR/$filename"
        count=$((count + 1))
      else
        skipped=$((skipped + 1))
      fi
    fi
  done
fi

echo "Copied $count posts to $POSTS_DIR/ (from $POSTS_SRC)"
if [ $skipped -gt 0 ]; then
  echo "Skipped $skipped non-post .md file(s) (README, system-prompt, etc.)"
fi

# Copy drafts if they exist at the configured drafts path
if [ -d "$DRAFTS_SRC" ]; then
  mkdir -p "$DRAFTS_DIR"
  draft_count=0
  for file in "$DRAFTS_SRC"/*.md; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      cp "$file" "$DRAFTS_DIR/$filename"
      draft_count=$((draft_count + 1))
    fi
  done
  if [ $draft_count -gt 0 ]; then
    echo "Copied $draft_count drafts to $DRAFTS_DIR/ (from $DRAFTS_SRC)"
  fi
fi

echo "Done!"
