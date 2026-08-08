.PHONY: install server frontend build

install:
	cd frontend && bun install
	cd server && go mod tidy

server:
	cd server && go build -o manifoldgen-server . && PORT=8116 DIST_DIR=../frontend/out ./manifoldgen-server

frontend:
	cd frontend && bun run dev

build-frontend:
	cd frontend && NEXT_OUTPUT=export bun run build

build-server:
	cd server && CGO_ENABLED=1 go build -o manifoldgen-server .

build: build-frontend build-server
