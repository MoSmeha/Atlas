# Note

**Which agent.** Claude Code, first on Claude Opus 5.5 and later on Fable 5.1. I did not hand it the brief and wait. I wrote the contracts first (schemas, ports, in-memory fakes, model config) so every agent built against the same shapes. Claude Code then split the rest into about fifty units and ran them as parallel agents, each merged into `main` with `--no-ff` once typecheck and tests passed. The `impeccable` skill set the visual direction.

**How long.** About 15 hours across 28 to 30 October 2026 (`docs/TIMELOG.md`): one on contracts and design, three on the parallel build, one on the eval and fixes, the rest on voice, Arabic, free providers and docs.

**Decisions I would defend.**
- The model never types a number. Tables become SQLite tables; totals and "above SAR 1 million" run SQL over every row, and a guard rejects any figure no tool returned. Everything else hangs on this.
- Every answer is one strict `submit_answer` call: kind, language, text, result, sources. No source that checks out means "not found in the loaded documents", not a guess.
- Search merges keyword hits (FTS5) with embeddings; scanned pages are read as images.
- Any provider: OpenAI by default (the small GPT-6 Luna keeps the demo cheap), Gemini's free tier or local Ollama. Voice calls on GPT-Live hand each question to the same agent, so a spoken total is still SQL.
- Clean architecture, kept light: one composition root serves the web server, the CLI and the eval. 1,919 unit tests, no API key, no network.

**Results.** The eval (`docs/EVAL.md`) asks 21 questions with known answers: 20 of 21 on GPT-6 Astra for $1.48 at first, then 21 of 21 on GPT-6 Luna for $0.02, median 6.9 seconds.

**Given more time.** Source markers in the answer text. OCR before page images. PDF tables beyond BOQ layouts. A spending cap per question. `sqlite-vec` for very large folders. The eval on Gemini and Ollama, so far passed only against fakes. Fewer, larger commits: the build left over 750.
