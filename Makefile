# Ellyseum Blog - Makefile
# Common commands for Jekyll development

# Environment setup
export GEM_HOME := $(HOME)/.gems
export PATH := $(HOME)/.gems/bin:$(PATH)

.PHONY: install serve build clean deploy new-post help content

# Default target
help:
	@echo "Available commands:"
	@echo "  make prod       - Full build (Vite + Jekyll) for local testing"
	@echo "  make content    - Process content from content/ directory"
	@echo "  make install    - Install Ruby dependencies"
	@echo "  make serve      - Start Jekyll server (requires prior build)"
	@echo "  make build      - Build Jekyll only (use 'make prod' for full build)"
	@echo "  make clean      - Remove generated files"
	@echo "  make deploy     - Push changes to GitHub"
	@echo "  make sync-prompt - Sync system-prompt.md to GitHub secret"
	@echo "  make sync-chunks - Sync context-chunks.json to GitHub secret"
	@echo "  make sync-all    - Sync all secrets to GitHub"
	@echo "  make rebuild    - Trigger GitHub Actions rebuild without pushing"
	@echo "  make embeddings - Regenerate embeddings from context-chunks.ts"
	@echo "  make new-post   - Create a new blog post (usage: make new-post TITLE='My Post')"

# Process content from content/ directory
content:
	@echo "Processing content..."
	bash scripts/fetch-content.sh

# Install dependencies
install:
	bundle install

# Start development server with live reload
serve:
	bundle exec jekyll serve --livereload

# Build for production
build:
	JEKYLL_ENV=production bundle exec jekyll build

# Production build (vite + hash update + jekyll)
prod: content
	@echo "Building JS..."
	npm run build
	@echo "Building Jekyll..."
	JEKYLL_ENV=production bundle exec jekyll build
	@echo "Done! Run: npx serve _site -l 4000"

# Clean generated files
clean:
	bundle exec jekyll clean
	rm -rf _site .jekyll-cache .jekyll-metadata

# Deploy to GitHub Pages
deploy:
	git add .
	@read -p "Commit message: " msg; \
	git commit -m "$$msg"
	git push origin main

# Create a new post
# Usage: make new-post TITLE="My New Post"
new-post:
ifndef TITLE
	$(error TITLE is required. Usage: make new-post TITLE="My Post Title")
endif
	@filename="_posts/$$(date +%Y-%m-%d)-$$(echo '$(TITLE)' | tr '[:upper:]' '[:lower:]' | tr ' ' '-').md"; \
	echo "---" > $$filename; \
	echo "layout: post" >> $$filename; \
	echo "title: \"$(TITLE)\"" >> $$filename; \
	echo "date: $$(date +%Y-%m-%d)" >> $$filename; \
	echo "author: " >> $$filename; \
	echo "tags: []" >> $$filename; \
	echo "---" >> $$filename; \
	echo "" >> $$filename; \
	echo "Write your post content here..." >> $$filename; \
	echo "Created: $$filename"

# Draft a new post (won't be published)
draft:
ifndef TITLE
	$(error TITLE is required. Usage: make draft TITLE="My Draft Title")
endif
	@mkdir -p content/drafts
	@filename="content/drafts/$$(echo '$(TITLE)' | tr '[:upper:]' '[:lower:]' | tr ' ' '-').md"; \
	echo "---" > $$filename; \
	echo "layout: post" >> $$filename; \
	echo "title: \"$(TITLE)\"" >> $$filename; \
	echo "author: " >> $$filename; \
	echo "tags: []" >> $$filename; \
	echo "---" >> $$filename; \
	echo "" >> $$filename; \
	echo "Write your draft content here..." >> $$filename; \
	echo "Created draft: $$filename"

# Serve with drafts visible
serve-drafts:
	bundle exec jekyll serve --livereload --drafts

# Check for broken links and issues
doctor:
	bundle exec jekyll doctor

# Sync system prompt to GitHub secret
sync-prompt:
	@echo "Syncing system prompt to GitHub secret..."
	@gh secret set SYSTEM_PROMPT < system-prompt.md
	@echo "System prompt synced to GitHub!"

# Sync context chunks to GitHub secret
sync-chunks:
	@echo "Syncing context chunks to GitHub secret..."
	@gh secret set CONTEXT_CHUNKS < context-chunks.json
	@echo "Context chunks synced to GitHub!"

# Sync all secrets
sync-all: sync-prompt sync-chunks
	@echo "All secrets synced!"

# Trigger GitHub Actions rebuild without pushing
rebuild:
	gh workflow run "Build and Deploy" --ref main

# Regenerate embeddings from context-chunks.ts
# Requires: conda activate embeddings && pip install sentence-transformers
embeddings:
	python scripts/generate-embeddings.py
