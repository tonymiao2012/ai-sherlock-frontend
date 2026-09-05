# AI Sherlock

An AI-powered issue diagnosis platform: capture a problem's browser context in one click, automatically enrich it with logs and source-code evidence, let an LLM locate the root cause and file JIRA tickets, then — after human approval — have AI fix the code, open a PR, and auto-deploy to UAT once merged.

> Every bug leaves a trail.

## Components & Status

| Component | Description | Status |
| --- | --- | --- |
| Chrome extension | Problem-site capture and reporting (implemented in this repo) | MVP available |
| Backend service | Context parsing, evidence enrichment, AI diagnosis orchestration, JIRA integration (Spring Boot + PostgreSQL) | Technical design done, development pending |
| Admin console | Project management, JIRA board, human approval → LLM auto-fix → PR → UAT auto-deploy | PRD done, development pending |

## Extension Features

- **Region screenshot + annotation**: in-page WeChat-style toolbar — select to capture, then annotate with boxes, mosaic, and text
- **rrweb recording**: full capture of the user's actions, replayable inside the report
- **Automatic evidence collection** (MAIN-world injection, zero interaction):
  - Network requests and errors (with request/response body summaries)
  - Console logs (log / warn / error)
  - Uncaught exceptions and Promise rejections
  - Capacity caps to keep memory bounded: 300 network entries / 300 console entries / 100 errors / 40,000 rrweb events
- **Editor-style side panel reporting**: title, description, screenshots, and recording drafts are persisted automatically — nothing is lost when the panel reopens
- **Report preview**: the Report page aggregates all collected evidence (the payload currently logs to console; backend integration in progress)

## Project Layout

```
├── extension/            # Chrome extension (WXT + React 19 + antd v6 + rrweb)
│   ├── entrypoints/
│   │   ├── background/       # Service worker
│   │   ├── content/          # Content script (screenshots, capture relay)
│   │   ├── injected.content/ # MAIN-world capture script (monkey-patches fetch/XHR/console)
│   │   ├── sidepanel/        # Side-panel report editor
│   │   └── report/           # Report preview page
│   ├── components/       # ReportApp, ReplayPlayer, BrandLogo, etc.
│   ├── core/             # Types, message protocol, local draft storage, theme
│   └── scripts/preview.mjs # One-command debug environment
├── docs/                 # Design documents (HTML)
├── test-page/            # Local test page
└── assets/               # Logo and visual guidelines
```

## Getting Started

Requirements: [Bun](https://bun.sh) (package manager) and a Chromium-based browser.

```bash
cd extension
bun install          # Install dependencies
bun run dev          # Dev mode (builds to .output/chrome with hot reload)
```

In Chrome, open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `extension/.output/chrome`.

### One-command debug environment

```bash
bun run preview       # Production build + local test page + self-check injection on startup
bun run preview:fast  # Skip the build and reuse existing artifacts
```

`preview` opens a local test page and injects the capture script for a self-check — handy for verifying the evidence chain before a release.

### Production build

```bash
bun run build         # Build to .output/chrome
bun run zip           # Package as a zip, ready for the Chrome Web Store
```

## Design Documents

HTML documents under `docs/`, open directly in a browser:

| Document | Content |
| --- | --- |
| `issue-diagnosis-prd.html` | Product design: extension capture → backend diagnosis → JIRA tickets |
| `ai-sherlock-backend-technical-design.html` | Backend technical design V1.2: domain model, evidence enrichment, AI orchestration, APIs, state machines |
| `middle-platform-prd.html` | Admin console PRD V1.1: dual-channel login, project management, JIRA board, LLM auto-fix pipeline, UAT deploy |

## Roadmap

- [ ] Upload extension payloads to the backend (replace console logging)
- [ ] Backend MVP: Case / Context / Evidence / automatic JIRA ticket creation
- [ ] Admin console MVP: Google login, project management, JIRA board
- [ ] Human approval → Devin auto-fix → PR status synced back to JIRA
- [ ] Auto-deploy to UAT after PR merge

## Contributing

1. Fork the repository and create a `feat_xxx` branch
2. Commit your code following the `feat: / fix: / docs:` message convention
3. Open a Pull Request
