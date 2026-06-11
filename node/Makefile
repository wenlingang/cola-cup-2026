# Cup — build & deploy helpers
#
# Static asset offload to Cloudflare Pages (CDN for css/js/fonts):
#   1. `next build` emits hashed, immutable files under .next/static
#      and rewrites their URLs to $(ASSET_PREFIX)/_next/static/... (set at build time)
#   2. we stage them under _next/static + a _headers file (CORS + long cache)
#   3. `wrangler pages deploy` pushes the dir to https://<project>.pages.dev (global CDN)

ASSET_PROJECT ?= cup-assets
ASSET_PREFIX  ?= https://cup-assets.pages.dev
STAGE         := .cf-assets

.PHONY: build deploy stage-assets publish start dev clean

# Production build (minifies JS/CSS; embeds ASSET_PREFIX into asset URLs).
build:
	ASSET_PREFIX=$(ASSET_PREFIX) npm run build

# Build + publish static assets to Cloudflare Pages. Run after every code change.
deploy: build stage-assets
	npx wrangler pages deploy $(STAGE) --project-name $(ASSET_PROJECT)
	@echo "✅ assets live on $(ASSET_PREFIX) — now reload the app:  make publish  (or  make start)"

# One-shot: build & publish to Pages CDN, then rebuild & restart the docker
# container using the SAME .next/ that was pushed to Pages (so chunk hashes match).
publish: deploy
	docker compose up -d --build
	@echo "✅ container restarted with matching build → http://localhost:8026"

# Lay out files so they're served at /_next/static/... + set CORS & cache headers.
stage-assets:
	rm -rf $(STAGE)
	mkdir -p $(STAGE)/_next
	cp -r .next/static $(STAGE)/_next/static
	printf '/_next/static/*\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=31536000, immutable\n' > $(STAGE)/_headers
	@echo "✅ staged → $(STAGE)"

# Run the production server (8026 to match docker; override with PORT=...).
start:
	PORT=$(or $(PORT),8026) npm run start

dev:
	npm run dev

clean:
	rm -rf .next $(STAGE)
