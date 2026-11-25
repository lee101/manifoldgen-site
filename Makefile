# gobed v1.0.6 builds gobed_int8.go with -mavx512* cgo flags (amd64 only); on
# other arches (Apple Silicon, aarch64) test without cgo, which drops that file.
GO_TEST_ENV := $(if $(filter amd64,$(shell cd server && go env GOARCH)),,CGO_ENABLED=0)

.PHONY: install server frontend dev build visualbench hooks check-fast test test-go test-frontend-unit test-cli test-py test-studio test-studio-full verify

install:
	cd frontend && bun install
	cd server && go mod tidy

server:
	cd server && go build -o manifoldgen-server . && PORT=8116 DIST_DIR=../frontend/out ./manifoldgen-server

frontend:
	cd frontend && bun run dev

dev:
	cd frontend && bun run dev:https

build-frontend:
	cd frontend && NEXT_OUTPUT=export bun run build

build-server:
	cd server && CGO_ENABLED=1 go build -o manifoldgen-server .

build: build-frontend build-server

i18n-extract:
	cd frontend && bun scripts/i18n-extract.ts

i18n-check:
	cd frontend && bun scripts/i18n-check.ts

i18n-fill:
	cd frontend && python3 scripts/i18n_fill.py --langs all

i18n-build:
	cd frontend && bun scripts/i18n-build.ts

hooks:
	git config core.hooksPath .githooks

check-fast:
	./scripts/check-fast.sh

# Fast unit suites only (no server, DB, browser, GPU or API keys). check-fast
# additionally runs gofmt and the i18n coverage gate.
test: test-go test-frontend-unit test-cli test-py

test-frontend-unit:
	cd frontend && bun run typecheck && bun run test:unit

test-cli:
	cd cli && bun install --frozen-lockfile && bun run typecheck && bun test

test-py:
	uv run --no-project --python 3.12 --with pytest --with boto3 --with psycopg2-binary --with pillow --with requests \
		python -m pytest -q tests scripts/test_*.py monitoring/tests

test-go:
	cd server && $(GO_TEST_ENV) go test ./...

test-studio:
	cd frontend && bun run test:e2e:hook

test-studio-full:
	cd frontend && bun run test:e2e

verify: check-fast test-studio

visualbench:
	@echo "Start frontend on :3219 then run capture, or set VISUALBENCH_BASE_URL"
	cd frontend && bunx playwright install chromium || true
	VISUALBENCH_BASE_URL=$${VISUALBENCH_BASE_URL:-http://127.0.0.1:3219} node visualbench/capture-studio.cjs
