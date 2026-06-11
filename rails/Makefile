# Cup 2026 (Rails) — deploy helpers
#
# Single-container production deploy via docker compose: Thruster serves the
# precompiled assets itself, so unlike the old Next.js stack there is no CDN
# step — publish is just rebuild + restart. SQLite data lives on the ./storage
# volume and survives container rebuilds; pending migrations run automatically
# on boot (entrypoint db:prepare).

.PHONY: publish build up status logs console restart

# Rebuild the image with the latest code and restart the container.
publish:
	docker compose build
	docker compose up -d
	@sleep 5
	@$(MAKE) --no-print-directory status

build:
	docker compose build

up:
	docker compose up -d

status:
	docker compose ps
	@curl -sf -o /dev/null -w "health /up -> %{http_code}\n" http://localhost:8026/up || echo "health /up -> FAILED"

logs:
	docker compose logs -f --tail 100

# Rails console inside the running container.
console:
	docker compose exec app ./bin/rails console

restart:
	docker compose restart
