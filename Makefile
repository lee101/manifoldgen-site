.PHONY: install server frontend dev dev-https build visualbench hooks check-fast test-go test-studio verify

install:
	cd frontend && bun install
	cd server && go mod tidy

server:
	cd server && go build -o manifoldgen-server . && PORT=8116 DIST_DIR=../frontend/out ./manifoldgen-server

frontend:
	cd frontend && bun run dev

dev:
	cd frontend && bun run dev

dev-https:
	cd frontend && bun run dev:https

build-frontend:
	cd frontend && NEXT_OUTPUT=export bun run build

build-server:
	cd server && CGO_ENABLED=1 go build -o manifoldgen-server .

build: build-frontend build-server

hooks:
	git config core.hooksPath .githooks

check-fast:
	./scripts/check-fast.sh

test-go:
	cd server && go test ./...

test-studio:
	cd frontend && bunx playwright test tests/e2e/studio-media.spec.js tests/e2e/api-pricing.spec.js

verify: check-fast test-studio

visualbench:
	@echo "Start frontend on :3219 then run capture, or set VISUALBENCH_BASE_URL"
	cd frontend && bunx playwright install chromium || true
	VISUALBENCH_BASE_URL=$${VISUALBENCH_BASE_URL:-http://127.0.0.1:3219} node visualbench/capture-studio.cjs
