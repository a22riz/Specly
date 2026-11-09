# Specly documentation

Specly turns a one-line idea into a complete **PRD** (Product Requirements Document) for non-IT
users, then exports Markdown for a coding agent. Next.js 16 (App Router), local SQLite, BYOK
(bring your own OpenAI-compatible key). PRD-only and chat-first.

This folder is the documentation for the **project and codebase**. The end-user walkthrough lives
in the app itself and in `README.md`.

## Contents

| Doc | What it covers |
|---|---|
| [Architecture](architecture.md) | How it works: stack, request flows, module map, data model, conventions. |
| [Development](development.md) | Run it locally, scripts, tests, and how to extend it (add a section, a prompt, an endpoint). |
| [Deployment](deployment.md) | Docker Compose and Kubernetes, environment, backup, updates. |
| [Design system](../design-system/specly/MASTER.md) | UI tokens and direction. |
| [AGENTS.md](../AGENTS.md) | Rules for AI coding agents working in this repo. |
| [Process history](superpowers/) | Design specs and implementation plans, one pair per feature. |

## The flow in one line

Discovery gate → one-shot plan → 12 PRD sections drafted in parallel → user reviews the decisions
and each section → export. Conversations are Indonesian; document content is English.

## Where data lives

Everything is SQLite in `data/` (`data/prd.sqlite` + `data/secret.key`). No external database. See
[Architecture → Data model](architecture.md#data-model).
