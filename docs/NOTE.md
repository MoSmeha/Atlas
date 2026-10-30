# Note

**AI coding agent.** Claude Code (Claude Opus 5.5). I wrote the contracts first: Zod schemas, ports, in-memory fakes and the model config. Claude Code split the rest into about 50 units and ran them as parallel agents in separate worktrees, each merged into `main` with `--no-ff` after typecheck and tests. The `impeccable` design skill set the visual direction.

**Time.** About 15 hours over 28 to 30 October 2026 (`docs/TIMELOG.md`): one for contracts and design direction, three for the parallel build, one for the eval and fixes, the rest for voice, the Arabic interface, free providers and docs.

**Key design decisions.**
- **Numbers come from code, not the model.** Tables become SQLite tables; totals and "above SAR 1 million" run SQL over every row. A guard rejects any number no tool returned.
- **One strict `submit_answer` call** carries kind, language, text, result and sources. No valid source means "not found in the loaded documents".
- **Search** merges keyword hits (FTS5) with embedding hits. Scanned pages are read as images.
- **Any provider.** OpenAI by default (the small GPT-6 Luna keeps the demo cheap), Gemini's free tier or local Ollama. Voice calls on GPT-Live hand each question to the same agent, so a spoken total is still SQL.
- **Clean architecture:** domain, application (use cases, tools, ports), infrastructure, api; one composition root serves the web server, the CLI and the eval. 1,919 unit tests run with no API key and no network.

**Results.** The eval (`docs/EVAL.md`) asks 21 questions with known answers: 21 of 21 on GPT-6 Luna for $0.02, median 6.9 s; a first run scored 20 of 21 on GPT-6 Astra for $1.48.

**With more time.** Numbered source markers in answers; an OCR pass before reading pages as images; PDF tables beyond BOQ layouts; a spending cap per question; `sqlite-vec` for very large folders; the eval on Gemini and Ollama, tested with fakes only; fewer, larger commits.
