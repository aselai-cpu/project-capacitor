# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Capacitor is an enterprise-grade, full-stack Task Assignment application.

## Repository Status

This project is in early stages. Update this file as the codebase evolves with:
- Build, test, and lint commands
- Architecture and key design decisions
- Development workflow and conventions

## Git Workflow

- Make frequent, incremental commits — commit after each meaningful unit of work (e.g., adding a function, fixing a bug, updating config), not in large batches
- Write detailed commit messages: first line is a concise summary (≤72 chars), followed by a blank line and a body explaining *what* changed and *why*
- Prefer many small commits over few large ones — this makes review, bisect, and revert easier

## Documentation

Keep documentation in `docs/` using the Diataxis framework — four distinct types, never blended:

```
docs/
├── tutorials/          # Guided learning experiences ("help me learn")
├── how-to/             # Steps to accomplish a specific goal ("help me do X")
├── reference/           # Factual technical descriptions ("give me the facts")
└── concepts/            # Context, reasoning, and design decisions ("help me understand why")
```

- Update relevant docs when adding features or changing behavior
- Each doc must be clearly one type — don't mix tutorials with reference, or how-to guides with explanation
- Use `/diataxis-documentation` skill when writing or reviewing docs
