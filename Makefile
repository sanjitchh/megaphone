.PHONY: help setup bootstrap ssl up down restart logs build rebuild destroy prune shell shell-web shell-worker shell-reverb shell-scheduler shell-mysql shell-redis shell-livekit shell-nginx composer artisan npm init migrate seed fresh test pint reload wait-web check-hosts check-cert

DC          := docker compose
APP_SERVICE := web
SERVICE     ?=
SSL_CRT     := docker/edge/ssl/star.megaphone.local.crt
# Every vhost the edge proxy serves; `check-hosts` verifies each is in /etc/hosts.
DOMAINS     := megaphone.local mail.megaphone.local

help:
	@echo "Megaphone Docker Development Environment"
	@echo ""
	@echo "Usage:"
	@echo "  make setup                      - SSL cert + report the manual steps still needed"
	@echo "  make up                         - Start all services (builds images if missing)"
	@echo "  make init                       - Create/reset the database, migrate + seed (prompts)"
	@echo "  make bootstrap                  - setup + up + init, in one go"
	@echo "  make ssl                        - Generate SSL certs (keeps a valid existing one)"
	@echo "  FORCE=1 make ssl                - Replace a still-valid cert (re-trust it afterwards)"
	@echo "  make up SERVICE=web             - Start a specific service"
	@echo "  make down                       - Stop all services"
	@echo "  make restart                    - Restart all services"
	@echo "  make logs                       - Tail logs for all services (SERVICE=x for one)"
	@echo "  make build                      - Build all containers (SERVICE=x for one)"
	@echo "  make rebuild                    - Rebuild without cache (SERVICE=x for one)"
	@echo "  make destroy                    - Remove containers AND data volumes (WARNING: deletes data)"
	@echo "  make prune                      - Remove unused Megaphone images and build cache (data safe)"
	@echo ""
	@echo "  make shell-web                  - Shell in the web container (nginx + Octane)"
	@echo "  make shell-worker               - Shell in the Horizon worker container"
	@echo "  make shell-reverb               - Shell in the Reverb container"
	@echo "  make shell-scheduler            - Shell in the scheduler container"
	@echo "  make shell-mysql                - Shell in MySQL"
	@echo "  make shell-redis                - Shell in Redis"
	@echo "  make shell-livekit              - Shell in LiveKit"
	@echo "  make shell-nginx                - Shell in the edge nginx"
	@echo ""
	@echo "  make composer cmd='require pkg' - Run composer in the web container"
	@echo "  make artisan cmd='about'        - Run artisan in the web container"
	@echo "  make npm cmd='run build'        - Run npm in the web container"
	@echo ""
	@echo "  make migrate                    - Run migrations"
	@echo "  make seed                       - Seed the database"
	@echo "  make fresh                      - migrate:fresh --seed"
	@echo "  make test                       - Run the test suite (against megaphone_test)"
	@echo "  make pint                       - Run Laravel Pint (args=--test to check)"
	@echo "  make reload                     - Gracefully reload Octane workers"
	@echo "  make wait-web                   - Block until the app finishes first boot and serves /up"
	@echo ""
	@echo "Artisan/composer/npm run with 'docker compose exec', so the stack must be up first."
	@echo "There is no compose .env file - every value lives in docker-compose.yml."

# SSL cert, then report what still needs doing by hand.
setup: ssl
	@echo ""
	@$(MAKE) check-hosts
	@$(MAKE) check-cert
	@echo "Setup complete. Next:"
	@echo "  make up      - start the stack"
	@echo "  make init    - create and seed the database (first run)"

bootstrap:
	@$(MAKE) setup
	@$(MAKE) up
	@$(MAKE) init

# Report any missing /etc/hosts entries.
check-hosts:
	@missing=""; \
	for d in $(DOMAINS); do \
		grep -qE "^[[:space:]]*[^#][^[:space:]]*[[:space:]]+$$d([[:space:]]|$$)" /etc/hosts || missing="$$missing $$d"; \
	done; \
	if [ -n "$$missing" ]; then \
		echo "TODO — add these to /etc/hosts (needs sudo):"; \
		for d in $$missing; do echo "  127.0.0.1 $$d"; done; \
		echo ""; \
	else \
		echo "OK: /etc/hosts entries are all present."; \
		echo ""; \
	fi

# The cert only needs trusting once; getUserMedia (camera/mic) needs a secure context.
check-cert:
	@if security verify-cert -c $(SSL_CRT) >/dev/null 2>&1; then \
		echo "OK: the SSL certificate is trusted."; \
		echo ""; \
	else \
		echo "TODO — trust the SSL certificate (needs sudo), or browsers will warn"; \
		echo "and the camera/mic checks will not work:"; \
		echo "  sudo security add-trusted-cert -d -r trustRoot \\"; \
		echo "    -k /Library/Keychains/System.keychain $(SSL_CRT)"; \
		echo ""; \
	fi

# Block until the app is actually serving. Octane answering /up is the one signal
# that the whole first-boot entrypoint (env, composer, npm, key, assets) finished.
wait-web:
	@echo "Waiting for the app to finish first-boot setup (composer, npm, key, assets)..."
	@$(DC) exec -T $(APP_SERVICE) sh -lc 'i=0; \
		until curl -sf -o /dev/null http://127.0.0.1:8000/up 2>/dev/null; do \
			i=$$((i+1)); \
			if [ $$i -gt 450 ]; then \
				echo "  Timed out after 15 minutes. Check: make logs SERVICE=web"; \
				exit 1; \
			fi; \
			if [ $$((i % 15)) -eq 0 ]; then echo "  still waiting ($$((i * 2))s)..."; fi; \
			sleep 2; \
		done; \
		echo "  App is serving."'

ssl:
	@echo "Generating SSL certificates..."
	@./docker/edge/generate-ssl.sh

# Builds any image that does not exist yet; the web container provisions itself
# from a bare clone (env file, Composer/npm, app key, assets).
up:
	@echo "Starting Megaphone environment..."
	@$(DC) up -d --build $(SERVICE)
	@echo ""
	@if [ -z "$(SERVICE)" ]; then $(MAKE) wait-web; fi
	@echo "Environment started. Run 'make init' if the database is not set up yet."
	@echo "  app  -> https://megaphone.local:9443"
	@echo "  mail -> https://mail.megaphone.local:9443"

down:
	@echo "Stopping Megaphone environment..."
	@$(DC) down $(SERVICE)

restart:
	@echo "Restarting Megaphone environment..."
	@$(DC) restart $(SERVICE)

logs:
	@$(DC) logs -f $(SERVICE)

build:
	@echo "Building containers..."
	@$(DC) build $(SERVICE)

rebuild:
	@echo "Rebuilding containers without cache..."
	@$(DC) build --no-cache $(SERVICE)

# Tear down ONLY this compose project: containers, networks, named volumes,
# locally-built images and orphaned project containers.
destroy:
	@echo "WARNING: This deletes the Megaphone containers AND their named data volumes."
	@echo "MySQL, Redis and Mailpit data will be permanently lost."
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read confirm
	@$(DC) down -v --rmi local --remove-orphans
	@echo "Done. Run 'make setup' to rebuild from scratch."

# Scoped by the compose project label, so other projects keep their images.
prune:
	@echo "This removes unused images belonging to the Megaphone compose project only."
	@echo "Named volumes are never touched. The shared build cache is also pruned."
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read confirm
	@docker image prune -a -f --filter label=com.docker.compose.project=megaphone
	@docker builder prune -f

shell-web:
	@$(DC) exec web bash

shell-worker:
	@$(DC) exec worker bash

shell-reverb:
	@$(DC) exec reverb bash

shell-scheduler:
	@$(DC) exec scheduler bash

shell-mysql:
	@$(DC) exec mysql bash

shell-redis:
	@$(DC) exec redis sh

shell-livekit:
	@$(DC) exec livekit sh

shell-nginx:
	@$(DC) exec nginx sh

shell:
	@$(DC) exec $(if $(SERVICE),$(SERVICE),$(APP_SERVICE)) bash

composer:
	@$(DC) exec $(APP_SERVICE) composer $(cmd)

artisan:
	@$(DC) exec $(APP_SERVICE) php artisan $(cmd)

npm:
	@$(DC) exec $(APP_SERVICE) npm $(cmd)

# DESTRUCTIVE: drops and rebuilds the schema from the migrations. Confirms first.
init:
	@echo "This DROPS and rebuilds the 'megaphone' database, then seeds it."
	@echo "On a first setup there is nothing to lose. Otherwise all data is permanently lost."
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read confirm
	@$(MAKE) fresh
	@echo ""
	@echo "Database ready -> https://megaphone.local:9443"

migrate:
	@$(DC) exec $(APP_SERVICE) php artisan migrate --force

seed:
	@$(DC) exec $(APP_SERVICE) php artisan db:seed --force

fresh:
	@$(DC) exec $(APP_SERVICE) php artisan migrate:fresh --seed --force

test:
	@$(DC) exec $(APP_SERVICE) php artisan test

# args=--test to check without fixing, or args=--dirty for changed files only.
pint:
	@$(DC) exec $(APP_SERVICE) ./vendor/bin/pint $(args)

# Octane caches PHP code and the Vite manifest; reload after PHP changes or a rebuild.
reload:
	@$(DC) exec $(APP_SERVICE) php artisan octane:reload
