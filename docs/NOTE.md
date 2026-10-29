# Note

**AI coding agent.** Claude Code (model Claude Opus 5.5) in VS Code. I started by setting the shared contracts myself: the Zod schemas, the ports every layer codes against, in-memory fakes for tests and the model config. Claude Code then split the rest into about 50 small units and ran them as parallel agents. There were ten streams, each in its own git worktree, and every unit got its own branch. One coordinator merged each branch into `main` with `--no-ff` after typecheck and tests. The `impeccable` design skill set the visual direction and ran the review at the end. I chose the familiar chat-with-documents layout, at the polish of Claude.ai, Perplexity and Linear.

**Time.** About 5 hours of wall-clock time on 28 and 29 October 2026, logged in `docs/TIMELOG.md`:
- 25 minutes for the workspace and contracts
- 30 minutes for the design direction and the model check
- 3 hours for the parallel build
- about 1 hour for the eval, the fixes, the design review and the docs

**Key design decisions.**
- **Numbers come from code, not the model.** Excel and PDF tables become real SQLite tables, and totals and "above SAR 1 million" questions run SQL over every row. A guard rejects any number in an answer that no tool returned. The answer attaches the saved rows by id instead of retyping them.
- **Every answer is one strict `submit_answer` call:** kind, language, text, result id and sources. An answer with no valid source becomes "not found in the loaded documents" and names the files that could not be read.
- **Search** merges keyword hits (SQLite FTS5) with meaning-based hits (`text-embedding-3-small`) by rank. Scanned pages are rendered with mupdf and read by the model as images.
- **The OpenAI Responses API** chains tool calls with `previous_response_id`, so reasoning carries across steps. The three models come from the account's own model list. The default answering model is the small one (GPT-6 Luna), to keep the demo cheap; the picker switches to Sol or Astra for harder questions.
- **Clean architecture, kept light:** domain, application (use cases, tools, ports), infrastructure adapters, and api. One composition root serves the web server, the CLI and the eval. About 1,650 unit tests run with no API key and no network.

**Results.** The eval asks 21 questions and checks each answer against the known right answer (`docs/EVAL.md`). It passed 20 of 21 on GPT-6 Astra, with a median answer time of 9.6 seconds and $1.48 for the run. The miss: "items above SAR 1 million" also listed three provisional sums, which the expected answer leaves out. The fixes made after that run are covered by unit tests but not yet by a second eval run, because the OpenAI credit ran out. Those fixes are row-level sources, hidden internal columns, a faster date extraction, Arabic text order and plainer answers.

**With more time.**
- Numbered markers in the answer text that point to each source.
- A cheaper OCR pass for scanned pages before falling back to images.
- PDF table detection for layouts beyond BOQ-style columns.
- A spending cap per question.
- `sqlite-vec` for very large folders.
- Sign-in, and an Arabic interface.
- Fewer, larger commits: the parallel build produced over 750 small ones.
