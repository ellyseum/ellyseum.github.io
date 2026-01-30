#!/bin/bash
# Fetch content from external repo and set up for Jekyll build
#
# Local dev: content/ folder already exists with its own .git
# CI: clones CONTENT_REPO into content/

set -e

CONTENT_DIR="content"
POSTS_DIR="_posts"
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
  # Still try to generate config if _data/site.yml exists
  if [ -f "$DATA_DIR/site.yml" ]; then
    echo "Found existing _data/site.yml, generating configs..."
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

  # Generate _config.yml and CNAME from site.yml
  echo "Generating Jekyll config and CNAME..."
  node scripts/generate-config.js

  # Generate taglines.ts from site.yml
  echo "Generating taglines.ts..."
  node scripts/generate-taglines.js

  # Generate about page from site.yml
  echo "Generating about page..."
  node scripts/generate-about.js
fi

# Copy all markdown posts
count=0
for file in "$CONTENT_DIR"/*.md; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    cp "$file" "$POSTS_DIR/$filename"
    count=$((count + 1))
  fi
done

echo "Copied $count posts to $POSTS_DIR/"
echo "Done!"
