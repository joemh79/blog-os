---
title: "Blog-OS: An Open-Source Blog System with a Local AI Writing Assistant"
tags: hf26challenge, opensource, ai, sidehustle
---

*This is a submission for the Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle*

## What I Built

**Blog-OS** is a complete open-source personal blog system with a built-in AI writing assistant. It gives you everything a mature blog needs — article management, a Markdown editor, site settings, comment moderation — plus an AI helper that runs entirely on your own machine.

Here's the side hustle angle: setting up a personal blog with a real admin panel usually means paying for Ghost ($9+/month), WordPress hosting, or hiring a developer. Blog-OS is free, deploys in 15 minutes on Cloudflare's free tier, and the AI writing assistant (which suggests excerpts, tags, and titles) runs on a local open-weight model — no API bills, no data leaving your laptop.

**Who would pay for it:** Freelancers, indie hackers, and small creators who want a professional blog without monthly fees. The AI assistant alone saves 10–15 minutes per post on the tedious parts (writing excerpts, picking tags). If I packaged this as a hosted service, $5/month would undercut Ghost while keeping the AI local and private.

## Demo

The blog system is live and open source. Here's what the admin panel looks like:

🎥 **Video demo:** `media-generation-blog-os-demo-0-a0c20653-1379-47e0-9e2a-3c55c0509fb0.mp4` (in repo root, upload to YouTube and embed)

**Try it yourself:**
- Frontend: Deploy `frontend/` to Cloudflare Pages (zero build step)
- Admin panel: `/admin/` — login, write posts in Markdown, use the AI assistant
- The AI features need Ollama running locally with a Gemma model (`ollama pull gemma3:4b`)

## Code

https://github.com/joemh79/blog-os

MIT licensed. 33 files, zero frontend build dependencies, single-file Worker backend.

## How I Built It

**The AI core:** The writing assistant calls Ollama's local API (`http://localhost:11434`) with Gemma 3 4B, an open-weight model from Google. Three endpoints:

- `POST /api/ai/excerpt` — generates a Chinese summary from article Markdown
- `POST /api/ai/tags` — suggests 3–5 relevant tags
- `POST /api/ai/title` — suggests a catchy title

The prompts are tuned for Chinese-language blog content. If Ollama isn't running, the UI shows a friendly message explaining how to set it up — no crashes, no confusion.

**The blog system:**
- **Frontend:** Pure HTML/CSS/JS, no build step. Keeps the original gallery-style homepage design and warm-paper blog aesthetic. All personal info lives in a single `config.js`.
- **Backend:** Single-file Cloudflare Worker (~600 lines, zero npm dependencies) + D1 database. Handles auth (SHA-256 + HMAC tokens), post CRUD, settings, and the AI proxy endpoints.
- **Admin panel:** Native JS SPA with article list, Markdown editor with live preview, AI assistant buttons, settings editor, and message moderation.

**Why local AI:** Your drafts are your unfinished thoughts. Sending them to a cloud API for a tag suggestion is overkill and a privacy leak. Running Gemma locally means the AI sees your content and nothing else does.

## Why Does Open Innovation Matter?

Three concrete reasons for this project:

1. **The model is the feature.** Without open-weight models like Gemma, the AI writing assistant would require a paid API key, per-token billing, and sending your drafts to someone else's server. Open weights make "private AI assistant" a feature anyone can ship, not just companies with API partnerships.

2. **The stack is inspectable.** A blogger trusting their content to a platform should be able to read every line of it. Blog-OS has no minified blobs, no hidden telemetry, no vendor lock-in. If Cloudflare raises prices tomorrow, the same code runs on any Worker-compatible runtime.

3. **It compounds.** Every improvement — a better prompt, a new AI endpoint, a UI tweak — is a pull request anyone can make. The project gets better because it's open, not despite it.

## My Agent Session

Built with Muse (AI assistant) — the entire system was designed and implemented through agent sessions, including the 39 backend tests.

## Prize Categories

- **Hacktoberfest Week 2: Side Hustle** (primary)
- Featured: Best Use of Gemma (the AI assistant runs on Gemma 3 4B via Ollama)
