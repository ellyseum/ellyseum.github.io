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

# In CI, clone the content repo if CONTENT_REPO is set
if [ -n "$CONTENT_REPO" ] && [ ! -d "$CONTENT_DIR/.git" ]; then
  echo "Cloning content from $CONTENT_REPO..."
  git clone --depth 1 \
    "https://x-access-token:${CONTENT_PAT:-$GITHUB_TOKEN}@github.com/${CONTENT_REPO}.git" \
    "$CONTENT_DIR"
fi

# Check if content directory exists
if [ ! -d "$CONTENT_DIR" ]; then
  echo "No content/ directory found."
  if [ -f "$DATA_DIR/site.yml" ]; then
    echo "Found existing _data/site.yml, generating Jekyll config and pages..."
    node scripts/generate-config.js
    node scripts/generate-taglines.js
    node scripts/generate-about.js
  else
    echo "Using existing _posts/ if any."
  fi
  exit 0
fi

echo "Processing content..."

# Create directories if needed
mkdir -p "$POSTS_DIR" "$DATA_DIR" "$ABOUT_DIR"

# Copy site.yml to _data/
if [ -f "$CONTENT_DIR/site.yml" ]; then
  cp "$CONTENT_DIR/site.yml" "$DATA_DIR/site.yml"
  echo "Copied site.yml to $DATA_DIR/"

  # Generate everything that depends on site.yml: Jekyll config, CNAME,
  # taglines, and the about page. These are owned by the content pipeline
  # so `make serve` (which only runs `make content`) gets a working build
  # without needing a separate `npm run inject-all` pass.
  echo "Generating Jekyll config and CNAME..."
  node scripts/generate-config.js
  echo "Generating taglines.ts..."
  node scripts/generate-taglines.js
  echo "Generating about page..."
  node scripts/generate-about.js
fi

# Copy markdown posts. Only files matching YYYY-MM-DD-*.md are treated
# as posts — README.md, system-prompt.md, *.example.md, etc. live next
# to posts in the content repo and would otherwise leak into _posts/.
count=0
skipped=0
for file in "$CONTENT_DIR"/*.md; do
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

echo "Copied $count posts to $POSTS_DIR/"
if [ $skipped -gt 0 ]; then
  echo "Skipped $skipped non-post .md file(s) (README, system-prompt, etc.)"
fi

# Copy drafts if they exist
if [ -d "$CONTENT_DIR/drafts" ]; then
  mkdir -p "$DRAFTS_DIR"
  draft_count=0
  for file in "$CONTENT_DIR/drafts"/*.md; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      cp "$file" "$DRAFTS_DIR/$filename"
      draft_count=$((draft_count + 1))
    fi
  done
  if [ $draft_count -gt 0 ]; then
    echo "Copied $draft_count drafts to $DRAFTS_DIR/"
  fi
fi

echo "Done!"
