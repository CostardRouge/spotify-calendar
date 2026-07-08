# =============================================================================
# Spotify Library Calendar — Makefile
# Controls the Docker Compose stacks (local dev + Home Lab).
# =============================================================================

DC        := docker compose
DEV_FILE  := docker-compose.yml
PROD_FILE := docker-compose.prod.yml
DC_PROD   := $(DC) -f $(PROD_FILE)

.DEFAULT_GOAL := help

# ---- Meta -------------------------------------------------------------------
.PHONY: help
help: ## Show this help
	@echo "Spotify Library Calendar — available commands:"
	@echo ""
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
	@echo ""

.PHONY: init
init: ## Create .env from template (if missing) and build the dev image
	@if [ ! -f .env ]; then \
	  cp .env.example .env; \
	  echo "Created .env from .env.example — edit it with your Spotify credentials."; \
	else \
	  echo ".env already exists — leaving it untouched."; \
	fi
	$(MAKE) build

# ---- Local development ------------------------------------------------------
.PHONY: build
build: ## Build the local dev image
	$(DC) build

.PHONY: up
up: ## Start the dev stack in the background
	$(DC) up -d

.PHONY: start
start: ## Start the dev stack in the foreground (Ctrl-C to stop)
	$(DC) up

.PHONY: down
down: ## Stop and remove the dev stack
	$(DC) down

.PHONY: restart
restart: ## Restart the dev stack
	$(DC) restart

.PHONY: reset
reset: ## Full clean rebuild: tear down (+volumes), rebuild image no-cache, start
	$(DC) down -v --remove-orphans
	$(DC) build --no-cache
	$(DC) up -d
	@echo "Reset complete — app running on http://127.0.0.1:$${APP_PORT:-3000}"

.PHONY: logs
logs: ## Follow dev logs
	$(DC) logs -f

.PHONY: shell
shell: ## Open a shell inside the dev container
	$(DC) exec web sh

# ---- Home Lab / production --------------------------------------------------
.PHONY: prod-build
prod-build: ## Build the optimized standalone image
	$(DC_PROD) build

.PHONY: prod-up
prod-up: ## Start the Home Lab stack in the background
	$(DC_PROD) up -d

.PHONY: prod-start
prod-start: ## Start the Home Lab stack in the foreground
	$(DC_PROD) up

.PHONY: prod-down
prod-down: ## Stop and remove the Home Lab stack
	$(DC_PROD) down

.PHONY: prod-logs
prod-logs: ## Follow Home Lab logs
	$(DC_PROD) logs -f

.PHONY: prod-deploy
prod-deploy: ## Rebuild and (re)start the Home Lab stack
	$(DC_PROD) up -d --build

# ---- Housekeeping -----------------------------------------------------------
.PHONY: ps
ps: ## Show running containers
	$(DC) ps

.PHONY: clean
clean: ## Stop everything and remove volumes + built image
	-$(DC) down -v
	-$(DC_PROD) down -v
	-docker image rm spotify-calendar:latest 2>/dev/null || true
