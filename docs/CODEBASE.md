# Atlas: folders and files

Where everything lives, folder by folder, with one line per file. For how the pieces work together (a question's path, indexing, the answer checks, voice), read [TECHNICAL.md](TECHNICAL.md).

## Contents

- [Top level](#top-level)
- [Where the data lives](#where-the-data-lives)
- [Inside an index file](#inside-an-index-file)
- [The container](#the-container)
- [shared/](#shared)
- [server/](#server)
- [client/](#client)
- [samples/](#samples)
- [docs/](#docs)

## Top level

| Path | What it holds |
| --- | --- |
| `shared/` | Zod schemas and types the server and the web app both use (package `@atlas/shared`) |
| `server/` | The Node server, the CLI, the sample generator and the eval (package `@atlas/server`) |
| `client/` | The web app (package `@atlas/client`) |
| `samples/` | Fictional project documents and their right answers |
| `docs/` | Guides, the eval report and screenshots |
| `package.json` | Root scripts: `dev`, `cli`, `samples`, `eval`, `models`, `test`, `typecheck` |
| `pnpm-workspace.yaml` | The three packages; stops pnpm from compiling better-sqlite3 |
| `pnpm-lock.yaml` | Locked dependency versions |
| `tsconfig.base.json` | TypeScript settings every package extends |
| `.env.example` | Every setting with its default; copy it to `.env`, which git never sees |
| `.gitattributes`, `.gitignore` | Line endings, and what git leaves out |
| `README.md` | Atlas for non-technical readers |
| `CLAUDE.md` | Notes for coding agents: layer rules, conventions, current state |

Atlas creates these while it runs. Git ignores them all.

| Path | What it holds |
| --- | --- |
| `.atlas/` | Indexes, uploads and designed voices (next section) |
| `.logs/` | One JSON line per tool call, question, indexing run and voice event |
| `exports/` | Results saved as `.xlsx` or `.csv` |
| `eval-runs/` | Reports written by `pnpm eval` |
| `node_modules/` | Installed packages |

## Where the data lives

Atlas has no database server. Each loaded folder gets its own SQLite file, which better-sqlite3 opens inside the Node process.

| What | Where | Notes |
| --- | --- | --- |
| A folder's index | `.atlas/indexes/<hash>.sqlite` | `<hash>` is the first 16 hex characters of the SHA-256 of the folder's absolute path, lower-cased on Windows. The file runs in WAL mode, so `-wal` and `-shm` files sit beside it. Unloading the top folder deletes all three |
| Uploaded files | `.atlas/uploads/` | Files dropped on the sidebar. This folder is loaded as a whole and has its own index |
| Designed voices | `.atlas/voices.json` | The ids of the Arabic voices designed at server start, with the description each was made from |
| Logs | `.logs/<YYYY-MM-DD>.jsonl` | Tool calls, questions, indexing runs, and `call_start`, `call_end`, `dictation` and `voice_design` |
| Exports | `exports/` | Never overwritten: a second file with the same name gets `-2`, then `-3` |
| Eval reports | `eval-runs/` | One Markdown report per run; the committed copy is [EVAL.md](EVAL.md) |

`ATLAS_DATA_DIR`, `ATLAS_LOG_DIR` and `ATLAS_EXPORTS_DIR` in `.env` move these. Relative paths start at the repository root.

**Not on disk.** Chats (their turns, saved results such as `r3`, and spend) live in server memory in `SessionStore`, keyed by session id. A server restart forgets them, and a page reload starts a new session. The loaded folder and its status live in memory in `Workspace`; at start the server loads `ATLAS_FOLDER` again, and its index file makes that quick.

**In the browser.** localStorage keeps `atlas-language`, `atlas-color-scheme`, `atlas-sidebar` (open and width) and `atlas.voice` (the last voice chosen).

**Which file is which folder.** The hash depends on where the folder sits, so it differs from one machine to the next. This prints it for a folder:

```sh
node -e "const p=require('path').resolve(process.argv[1]);console.log(require('crypto').createHash('sha256').update(process.platform==='win32'?p.toLowerCase():p).digest('hex').slice(0,16))" samples/riyadh-tower
```

Any SQLite viewer opens the file (DB Browser for SQLite, or the `sqlite3` shell). Open it read-only while the server runs, since the server writes to it.

## Inside an index file

| Table | One row per | What it holds |
| --- | --- | --- |
| `meta` | setting | `schema_version` (a file written by another version is emptied and rebuilt) and `embedding_model` (when it changes, every chunk is embedded again) |
| `documents` | file in the folder | Path, name, kind, status and its reason, modified time and size (to spot changes), page count, scanned pages, sheets, language, currencies, and the classification as JSON |
| `pages` | PDF page | The page's text in reading order |
| `chunks` | search passage | A piece of a page's text, and its embedding vector (null until embedded) |
| `chunks_fts` | chunk | FTS5 keyword index over the chunks, with Arabic folded; triggers keep it in step with `chunks` |
| `table_catalog` | clean table | Its SQL name, file, title, sheet or page range, columns (JSON), row count and currency |
| `sheet_rows` | Excel row | The raw cells as JSON, for the viewer |
| `excluded` | removed path | Files and subfolders taken out of Atlas with the sidebar's × |
| `t_<document>_<sheet or page>` | table row | One real SQL table per clean table, which `query_tables` runs over. The document's columns come first; recognised ones get fixed names (`item_code`, `description`, `unit`, `quantity`, `rate`, `amount`, `currency`). Then `_row`, `_page`, `_is_total` and `_section`, so answers can cite rows and skip totals |

Deleting a row of `documents` deletes its pages, chunks, catalog entries and sheet rows with it. The schema is in [schema.ts](../server/src/infrastructure/index/schema.ts), and the `t_` tables are written by [tableWriter.ts](../server/src/infrastructure/index/tableWriter.ts).

## The container

[server/src/main.ts](../server/src/main.ts) is the only place that builds real adapters. `compose()` returns a `Container`; the web server (`start()` in the same file) and the CLI ([cli.ts](../server/src/cli.ts)) both run on it.

| Field | What it is |
| --- | --- |
| `settings` | `.env`, read and checked by `infrastructure/settings.ts` |
| `modelConfig` | The default provider's section of `server/config/models.json` |
| `models` | Every model a question may use, from every provider set up, and the default one |
| `providerChoice` | The default provider and why it was picked |
| `provider`, `providers` | The default provider, and every provider set up, each with its model client and embedding client |
| `localProblem` | Why Ollama is not used, when the machine was scanned and it is not |
| `modelClient` | A `ModelRouter` that sends each call to the provider of its model; null while no provider is set up |
| `embeddings` | The default provider's embedding client; null means search by keyword only |
| `clock`, `logger`, `fs` | `SystemClock`, `JsonlRunLogger` (writes `.logs/`), `NodeFileSystem` |
| `workspace` | The loaded folder, its index and its status |
| `indexFolder` | Loads and indexes folders, with `MupdfReader` and `ExcelJsReader`, `SqliteIndexFactory`, and the classification and suggestions steps |
| `watchFolder` | Re-reads files that change while their folder is loaded (`ChokidarWatcher`) |
| `sessions` | Chats, in memory |
| `askQuestion` | The answer use case: agent loop, tools and checks |
| `voiceCatalog`, `voiceCalls` | Voices from `server/config/voices.json`, and the calls still open |
| `api` | What each route group is given (below) |

| Route group | Paths | Given |
| --- | --- | --- |
| health | `/api/health` | Version, and whether a provider is set up |
| folder | `/api/folder`, `/status`, `/events`, `/remove`, `/restore`, `/pick` | `indexFolder`, `workspace`, the repository root, `NativeFolderPicker` |
| uploads | `/api/uploads` | `indexFolder`, the uploads folder, the file size limit |
| documents | `/api/documents/:id/file`, `/api/documents/:id/sheets/:sheet/rows` | `workspace` |
| chat | `/api/chat`, `/api/chat/:sessionId` | `askQuestion`, `sessions`, `workspace` |
| models | `/api/models` | `models` |
| usage | `/api/usage` | `sessions` |
| exports | `/api/exports`, `/api/exports/:fileName` | `sessions`, `ExportResult`, the exports folder |
| voice | `/api/voice/voices`, `/calls`, `/calls/:id/end`, `/transcriptions` | The catalog, `VoiceCalls`, `TranscribeSpeech`, and whether calls and dictation are available |

Tests build the same parts from fakes in `server/test/fakes/apiDeps.ts`, and `server/test/compose.test.ts` checks `compose()` itself.

## shared/

`@atlas/shared` holds the shapes both sides agree on. The server checks every request and reply with them, and the client parses replies with them.

| File | What it holds |
| --- | --- |
| `src/index.ts` | Re-exports everything below |
| `src/routes.ts` | Every API path, used by the server's routes and the client's API module |
| `src/schemas/answer.ts` | Answer kinds, cell values, result tables, the answer |
| `src/schemas/chat.ts` | The chat request (question, session, model, effort), tool steps, and the streamed chat events |
| `src/schemas/documents.ts` | File statuses and kinds, document types, language, money, classification, table columns and summaries, document summaries |
| `src/schemas/errors.ts` | Every error code, and the error body |
| `src/schemas/exports.ts` | Export format, request and reply |
| `src/schemas/folder.ts` | Load, pick, remove and restore requests; indexing phase and progress; suggested questions; folder status and its events |
| `src/schemas/health.ts` | The health reply |
| `src/schemas/models.ts` | Model tiers, providers, effort, model options, usage |
| `src/schemas/sheets.ts` | Sheet rows for the viewer |
| `src/schemas/sources.ts` | A PDF source (file, page, quote) and an Excel source (file, sheet, rows) |
| `src/schemas/voice.ts` | Dialects, voice options, starting and ending a call, the call's diagnosis, transcription |
| `test/schemas.test.ts` | Tests for the schemas |

## server/

| File | What it holds |
| --- | --- |
| `package.json` | `dev` (restarts on change), `start`, `typecheck`, `test` |
| `tsconfig.json`, `vitest.config.ts` | TypeScript and test settings |
| `config/models.json` | Per provider (OpenAI, Gemini, Ollama): the model catalog with prices and tiers, `answerTier`, reasoning effort, the embedding model |
| `config/voices.json` | The call model and its price, silence and length limits, the dictation model, each dialect's speaking rules and greeting, and each voice |

The code in `server/src` is in four layers, and dependencies point one way: `api` → `application` → `domain`. `infrastructure` implements the ports that `application` declares.

### server/src (entry points)

| File | What it does |
| --- | --- |
| `main.ts` | The composition root: builds the container, starts Fastify, loads `ATLAS_FOLDER`, designs voices in the background, shuts down cleanly |
| `cli.ts` | `pnpm cli <folder> "<question>"` answers one question; without a question it starts a chat |

### server/src/domain

Pure rules: no I/O and no SDKs, tested without mocks.

| File | What it does |
| --- | --- |
| `CalculatorError.ts` | The error for an expression the calculator cannot read or compute |
| `bidi.ts` | Puts the characters of a right-to-left line of a PDF into reading order |
| `boqArithmetic.ts` | Checks BOQ rows: quantity × rate against the amount, and subtotals against their items, within a tolerance |
| `calculator.ts` | Evaluates `calculate` expressions over numbers and saved results such as `r3` |
| `capSources.ts` | Caps how many sources one answer lists |
| `cellRange.ts` | Excel column letters to numbers and back, and ranges such as `B7:F22` |
| `chunking.ts` | Cuts a page's text into overlapping search chunks |
| `currency.ts` | Currency codes and their aliases, and the key for amounts with no known currency |
| `decimal.ts` | Exact decimal sums, with no floating-point drift |
| `document.ts` | Types for a parsed PDF: pages, blocks, lines, words and their boxes |
| `documentId.ts` | A short stable id for a document path (FNV-1a), safe in a URL |
| `documentStatus.ts` | Groups file statuses (usable, empty, failed, skipped) and counts them |
| `expression/tokenize.ts` | Splits a calculator expression into tokens |
| `expression/parse.ts` | Parses tokens into an expression tree; lists the allowed functions |
| `fileName.ts` | Safe file names and timestamps for exports |
| `fileTypes.ts` | Which extensions Atlas reads, which names it ignores, and why others are skipped |
| `folderItems.ts` | Whether a path lies inside a removed file or folder; tidies item paths |
| `language.ts` | Tells English from Arabic; folds Arabic letter forms |
| `money.ts` | Reads numbers and amounts: "SAR 1.2M", Arabic-Indic digits, invisible direction marks |
| `numberMatch.ts` | A pool of numbers looked up with a rounding tolerance |
| `numbers.ts` | Finds the numbers written in a text or held in a value |
| `numbersInText.ts` | The pattern for a written number: thousands commas, decimals, percent |
| `pageBudget.ts` | Fits page text into a size budget for `read_pages`, cutting cleanly |
| `pageRanges.ts` | Groups page numbers into ranges and words them |
| `pricing.ts` | Token usage and its cost in dollars |
| `ranking.ts` | Reciprocal rank fusion of keyword and meaning search |
| `revisionName.ts` | Spots a revision marker in a file name, such as `_Rev1` |
| `revisions.ts` | Compares two BOQ revisions: items added, removed and changed, paired by code or by similar description |
| `rowRanges.ts` | Groups sheet rows into ranges |
| `schedule.ts` | Finds dates, deadlines, durations and deliverables in page text |
| `scheduleDates.ts` | Reads dates and lengths of time: Gregorian and Hijri, English and Arabic, Excel serial numbers |
| `scheduleRepeats.ts` | Merges schedule candidates that repeat the same wording |
| `scheduleTables.ts` | Finds schedule rows in tables loaded from sheets |
| `sentences.ts` | Splits text into sentences and strips invisible marks |
| `snippet.ts` | Cuts a search snippet around the query's words |
| `speech.ts` | What a voice call says about a checked answer: the prose cut short, a few rows and sources |
| `speechKeywords.ts` | Words from the folder (file names, codes) sent to dictation as hints |
| `sqlGuard.ts` | Lets through one read-only `SELECT` only; anything that writes, changes settings or touches files is refused |
| `sqlReferences.ts` | The names a SQL query refers to, so unknown tables can be reported |
| `sqlTokens.ts` | The SQL tokenizer the two files above use |
| `table.ts` | Clean table types, the column roles and the `_row`, `_page`, `_is_total`, `_section` columns |
| `text.ts` | Slices text without cutting an emoji in half |
| `visibleColumns.ts` | Hides the `_` columns from readers |

#### server/src/domain/tables

Turns sheets and PDF pages into clean tables.

| File | What it does |
| --- | --- |
| `area.ts` | Rectangles of a sheet grid, and what each row holds (text, numbers, blanks) |
| `buildTable.ts` | Builds a clean table from a header and its rows: column names, types and roles |
| `cellText.ts` | Reads one cell as text, number or date |
| `cleanSheet.ts` | A whole sheet to clean tables: finds headers, splits tables, marks totals |
| `columnRoles.ts` | Matches header labels, English and Arabic, to column roles |
| `columnTypes.ts` | Decides each column's type and cleans its values |
| `headerDetection.ts` | Finds the real header under title rows, joining headers that run over two or three merged rows |
| `pdfColumns.ts` | Where each column of a PDF table sits, from its header |
| `pdfHeader.ts` | Reads a PDF table's header, and tells whether a later page continues the same table |
| `pdfLines.ts` | Groups a page's words into printed lines |
| `pdfRows.ts` | Assembles printed lines into table rows, joining descriptions that wrap |
| `pdfTables.ts` | Extracts tables from PDF pages, across page breaks, skipping running headers and footers |
| `splitTables.ts` | Splits a sheet that holds several tables |
| `tableCurrency.ts` | The one currency of a table's amounts, from a column, the header or the cells |
| `totalRows.ts` | Spots total, carried-forward and section heading rows, in English and Arabic |

### server/src/application

Use cases, the agent loop, tools, checks and the ports. Tools use ports only, never SQLite, mupdf or OpenAI.

| File | What it does |
| --- | --- |
| `AskQuestion.ts` | The answer use case: picks the model and effort, runs the agent with the tools, checks the answer, records usage and the turn |
| `ExportResult.ts` | Saves a chat's result (such as `r3`) as `.xlsx` or `.csv` |
| `errors.ts` | `AppError` and every expected failure, with a code the API and CLI can explain |

#### application/agent

| File | What it does |
| --- | --- |
| `runAgent.ts` | The tool loop: asks the model, runs the tools it calls, stops at `submit_answer` or the round limit |
| `ToolCaller.ts` | Runs one tool call: checks the arguments, turns a `ToolError` into a message the model can act on, spots repeats, logs |
| `UsageMeter.ts` | Adds up one question's tokens per model, including the calls its tools make |
| `agentMessages.ts` | The fixed text the loop sends the model |
| `callKey.ts` | A key for a tool call (name and arguments, in any order) to spot repeats |
| `conversationInput.ts` | The earlier turns the model sees with a new question |
| `events.ts` | What the loop reports: a step starting or ending, answer text, an answer thrown away |
| `instructions.ts` | The model's instructions: the rules and the folder's files |
| `noteEvidence.ts` | Records the numbers each tool returns as the chat's evidence |
| `parseArguments.ts` | Parses a tool call's JSON arguments and says what is wrong with them |
| `partialJson.ts` | Reads the answer field out of `submit_answer`'s arguments while they stream |
| `streamAnswer.ts` | Streams the answer text to the user as the model writes it |
| `summaries.ts` | One line per tool call's arguments, for the trace and the logs |
| `toolOutput.ts` | A tool's output as JSON text, cut at a size limit with a note |

#### application/guards

The checks every answer passes before the user sees it.

| File | What it does |
| --- | --- |
| `checkAnswer.ts` | Runs the checks on a submitted answer and sends it back to the model, at most a few times, before accepting it with warnings |
| `numbersGuard.ts` | Every number in the answer must come from a tool's output |
| `sourcesGuard.ts` | Every fact needs a source; a "not found" answer names the files Atlas could not read |
| `languageGuard.ts` | The answer must be in the question's language |
| `buildAnswer.ts` | Assembles the final answer: text, sources and the attached result table |
| `guardMessages.ts` | The fixed answers and feedback, per language |
| `problems.ts` | The type of a problem a check found |
| `ToolOutputLog.ts` | What the tools returned during this question, for the checks |

#### application/indexing

| File | What it does |
| --- | --- |
| `IndexFolder.ts` | Loads a folder: scans it, reads each new or changed file, saves it to the index, embeds it, runs the steps; reports progress; handles remove, restore, unload and uploads |
| `scanFolder.ts` | Lists the folder's files and marks each one: to read, skipped, too large or empty |
| `scanSummary.ts` | How a file the scan ruled out shows in the document list |
| `readDocument.ts` | Reads one file with the reader for its type and builds its record; never throws |
| `buildRecord.ts` | Everything the index keeps for one file: page text, chunks, clean tables, raw sheet rows, language, currencies |
| `embedPending.ts` | Embeds the chunks that have no vector yet, in batches |
| `ClassifyDocument.ts` | Asks the small model what kind of document a file is, from its opening text |
| `classificationInput.ts` | The opening text the classifier sees |
| `classificationReply.ts` | Reads the classifier's reply and drops values it is unsure of |
| `classificationStep.ts` | The indexing step that classifies new files |
| `SuggestQuestions.ts` | Suggested questions from the documents, in English and Arabic, with no model call |
| `suggestionsStep.ts` | The last indexing step, which builds those questions |
| `WatchFolder.ts` | Watches the loaded folder and re-reads files that change |

#### application/models

| File | What it does |
| --- | --- |
| `answerEffort.ts` | The effort a question runs at, and whether the picker can change it |
| `chooseModel.ts` | The requested model when it is allowed, otherwise the default |
| `modelChoices.ts` | The models a question may use; `smallModelFor` gives a provider's small model |
| `pickLineup.ts` | Picks the frontier, balanced and small models from the catalog, by what the account can see |

#### application/ports

The interfaces infrastructure implements. Tests use the fakes in `server/test/fakes/`.

| File | The port |
| --- | --- |
| `Clock.ts` | The time |
| `DocumentIndex.ts` | A folder's index: documents, pages, search by words and meaning, tables, read-only SQL |
| `DocumentReader.ts` | Opens one file and returns its content or a status; never throws for a bad file |
| `EmbeddingClient.ts` | One vector per text |
| `FileSystem.ts` | Lists, reads and stats files |
| `FileWatcher.ts` | Reports files added, changed or removed |
| `FolderPicker.ts` | The computer's own folder window |
| `ModelClient.ts` | A model turn with tools, streamed; the input items and events |
| `PageRenderer.ts` | A PDF page as PNG bytes |
| `ResultExporter.ts` | Writes a table to a file |
| `RunLogger.ts` | The log entries: tool, question, index, voice |
| `Transcriber.ts` | Speech to text |
| `VoiceClient.ts` | Starts and ends voice calls, designs voices |
| `index.ts` | Re-exports the ports |

#### application/schedule

The parts of `extract_schedule`.

| File | What it does |
| --- | --- |
| `collectCandidates.ts` | Collects candidate dates and deadlines from PDF pages and sheet rows |
| `confirmCandidates.ts` | Asks the small model which candidates are real schedule items |
| `confirmInBatches.ts` | Sends those candidates in batches |
| `ScheduleCache.ts` | Keeps the verdicts, so the same candidates are not checked twice |
| `scheduleTable.ts` | The schedule as result rows, dated items first, with their sources |

#### application/session

| File | What it does |
| --- | --- |
| `Session.ts` | One chat: its turns, saved results (`r1`, `r2` …) and spend |
| `SessionStore.ts` | Chats by session id, in memory |
| `NumberEvidence.ts` | The numbers a chat has seen; `calculate` accepts only these |

#### application/tools

One file per tool, built with `defineTool`, plus helpers.

| File | What it does |
| --- | --- |
| `Tool.ts` | `defineTool`, what a tool may use (`ToolContext`), and `ToolError` |
| `registry.ts` | Every tool the model sees, in order |
| `listDocuments.ts` | `list_documents`: every file with its status, pages or sheets, tables and currencies |
| `searchDocuments.ts` | `search_documents`: passages by exact words and by meaning, fused |
| `readPages.ts` | `read_pages`: the exact text of a range of PDF pages |
| `queryTables.ts` | `query_tables`: one read-only SQL query over the loaded tables |
| `lookAtPage.ts` | `look_at_page`: shows a page image to the model, for scans and drawings |
| `checkBoqArithmetic.ts` | `check_boq_arithmetic`: quantity × rate, and subtotals |
| `extractSchedule.ts` | `extract_schedule`: dates, deadlines, durations and deliverables |
| `compareRevisions.ts` | `compare_revisions`: two BOQ revisions, item by item |
| `calculate.ts` | `calculate`: safe arithmetic on numbers the tools returned |
| `exportTable.ts` | `export_table`: saves a result as `.xlsx` or `.csv` |
| `submitAnswer.ts` | `submit_answer`: the answer, its kind, language and sources |
| `boqReport.ts` | Wording and sources for the BOQ check's findings |
| `boqTables.ts` | Picks the tables that have the columns a BOQ check needs |
| `describeTable.ts` | A table's columns as the model sees them |
| `findDocument.ts` | Matches a file name the model gave to a loaded file |
| `querySources.ts` | The sources (rows, pages) behind a SQL result |
| `queryWarnings.ts` | Warns when a query adds up amounts in different currencies |
| `revisionSources.ts` | Loads one side of a revision comparison |

#### application/vision, voice, workspace

| File | What it does |
| --- | --- |
| `vision/askAboutPage.ts` | Renders a PDF page and asks the model about the image |
| `vision/pagePrompt.ts` | What the model is asked about a page image |
| `voice/VoiceCalls.ts` | Starts and ends calls, designs voices at start, hangs up every call on shutdown, logs each call's diagnosis |
| `voice/VoiceCatalog.ts` | Voice and dialect types; finds a voice |
| `voice/callInstructions.ts` | A call's instructions, its greeting and the chat's earlier turns |
| `voice/TranscribeSpeech.ts` | Dictation: audio to text, with the folder's words as hints |
| `workspace/Workspace.ts` | The loaded folder, its index and its status, shared by every use case |

### server/src/infrastructure

Adapters that implement the ports, plus settings.

| File | What it does |
| --- | --- |
| `settings.ts` | Reads and checks `.env`; the repository root |
| `SystemClock.ts` | The real clock |

#### infrastructure/index (SQLite)

| File | What it does |
| --- | --- |
| `SqliteIndex.ts` | The index of one folder in one SQLite file; writes go through its connection |
| `SqliteIndexFactory.ts` | One file per folder; rebuilds a damaged file; deletes it on unload |
| `schema.ts` | The tables (see [Inside an index file](#inside-an-index-file)) and the schema version |
| `tableWriter.ts` | Creates the `t_` table for each clean table and records it in `table_catalog` |
| `indexRows.ts` | Turns SQLite rows into the port's types |
| `QueryRunner.ts` | Runs `query_tables` SQL in a child process with a time limit, so a runaway query can be killed |
| `queryProcess.cjs` | That child process: one read-only connection |
| `ftsQuery.ts` | Turns search words into an FTS5 query, dropping common words |
| `foldText.ts` | Strips Arabic short vowels, marks and tatweel before indexing |
| `quoteIdentifier.ts` | Quotes a table or column name for SQL |
| `vectors.ts` | Cosine similarity, and vectors to and from BLOBs |

#### infrastructure/readers (files)

| File | What it does |
| --- | --- |
| `MupdfReader.ts` | Reads PDFs: page text in reading order, scanned pages, damaged and password-protected files; pauses between pages so a long PDF does not hold up the server |
| `MupdfPageRenderer.ts` | A PDF page as a PNG, for `look_at_page` |
| `openPdf.ts` | Opens a PDF with mupdf, or returns a status with the reason |
| `stextBlocks.ts` | mupdf's structured text as blocks, lines and characters |
| `pageLayout.ts` | A page's text from those blocks; a page with almost no text counts as scanned |
| `rtlOrder.ts` | The direction of Arabic lines, and their reading order |
| `ExcelJsReader.ts` | Reads workbooks: each sheet as a grid; spots empty and protected workbooks |
| `sheetGrid.ts` | A sheet as a grid, merged cells included, capped in size |
| `cellValue.ts` | One cell's value: a formula's saved result, plain text from rich text and links |
| `officeContainer.ts` | Spots an `.xlsx` that is really an older Office container: password-protected, or an old `.xls` |
| `readError.ts` | Why a file could not be read from disk, in plain words |

#### infrastructure/openai

| File | What it does |
| --- | --- |
| `OpenAiModelClient.ts` | The model client on OpenAI's Responses API |
| `OpenAiEmbeddingClient.ts` | Embeddings for all three providers, since Gemini and Ollama speak the same API |
| `OpenAiTranscriber.ts` | Dictation on OpenAI's transcription endpoint |
| `OpenAiVoiceClient.ts` | Starts GPT-Live calls and designs voices, keeping their ids in `.atlas/voices.json` |
| `createOpenAiClient.ts` | One shared SDK client, with retries and a time limit |
| `embeddingRequests.ts` | Groups texts into embedding requests under the API's limits |
| `inputItems.ts` | The port's input items as Responses API input |
| `mapOpenAiError.ts` | SDK errors as `AppError`s |
| `parseObject.ts` | Reads a structured reply that must match a schema |
| `readResponse.ts` | Reads a finished response: tool calls, text, refusal, usage |
| `resolveLineup.ts` | Lists the models the account can see and picks the lineup |
| `streamEvents.ts` | Follows a streamed turn's events |
| `toolSchema.ts` | A tool's Zod object as a strict JSON schema |

#### infrastructure/chat (Gemini and Ollama)

| File | What it does |
| --- | --- |
| `ChatModelClient.ts` | The model client on Chat Completions; keeps each conversation itself |
| `chatInput.ts` | The port's input items as Chat Completions messages |
| `chatStream.ts` | Reads streamed chunks, keeping extra tool-call fields such as Gemini's thought signatures |
| `chatTool.ts` | Tools, tool choice and effort in Chat Completions form |

#### infrastructure/providers, local, config

| File | What it does |
| --- | --- |
| `providers/chooseProvider.ts` | Which provider is the default (auto: Ollama, then Gemini, then OpenAI), and which are offered |
| `providers/connectProvider.ts` | Builds one provider's model and embedding clients |
| `providers/ModelRouter.ts` | One model client over every provider; each call goes to its model's provider |
| `providers/resolveChoices.ts` | The models a question may use, from what each account can see |
| `local/scanMachine.ts` | This machine's RAM and graphics memory (nvidia-smi, Windows registry, sysfs) |
| `local/listOllamaModels.ts` | The models Ollama has pulled |
| `local/pickLocalModels.ts` | The largest chat and embedding models that fit, or why none do |
| `local/scanLocal.ts` | Runs both scans; never throws |
| `config/modelConfig.ts` | Loads `server/config/models.json` |
| `config/voiceConfig.ts` | Loads and checks `server/config/voices.json` |

#### infrastructure (the rest)

| File | What it does |
| --- | --- |
| `dialog/NativeFolderPicker.ts` | Opens the computer's folder window: Explorer's dialog through PowerShell on Windows, `osascript` on macOS, zenity on Linux |
| `export/XlsxExporter.ts` | Writes a result as `.xlsx` or `.csv`, never overwriting |
| `export/workbook.ts` | Builds the Excel workbook |
| `export/csv.ts` | Builds the CSV, with a byte order mark so Excel shows Arabic correctly |
| `fs/NodeFileSystem.ts` | The file system port on Node |
| `logging/JsonlRunLogger.ts` | Appends one JSON line per event to `.logs/<date>.jsonl`; logging never breaks a question |
| `watch/ChokidarWatcher.ts` | Watches a folder with chokidar |

### server/src/api

Fastify routes by feature. Every request and reply is checked with a schema from `@atlas/shared`.

| File | What it does |
| --- | --- |
| `app.ts` | Builds the Fastify app with every route group; tests call it with `inject` |
| `errorHandler.ts` | The one error hook: any thrown value to an API error body and status |
| `sse.ts` | A server-sent event stream that notices when the browser leaves |
| `chatEvents.ts` | Sends a question's events down its stream, and stops the question when the user presses Stop |
| `zod.ts` | Lets routes take their types from their Zod schemas |
| `routes/chat.ts` | Asks a question and streams the answer; clears a chat |
| `routes/documents.ts` | Serves a document's file, and sheet rows for the viewer |
| `routes/exports.ts` | Saves a result to a file, and serves it for download |
| `routes/folder.ts` | Loads, unloads, removes and restores; folder status and its live events; opens the folder window |
| `routes/health.ts` | Version, and whether a model provider is set up |
| `routes/models.ts` | The models a question may use |
| `routes/uploads.ts` | Takes dropped files into `.atlas/uploads/` |
| `routes/usage.ts` | Tokens, cost and time of the last answer and the chat so far |
| `routes/voice.ts` | Voices, starting and ending calls, dictation |

### server/src/cli

| File | What it does |
| --- | --- |
| `ask.ts` | Asks one question and prints the answer, its steps, sources and cost |
| `chat.ts` | The interactive chat: reads questions until `/exit`; Ctrl+C stops the one running |
| `loadFolder.ts` | Loads a folder, with progress on the status line |
| `Terminal.ts` | Prints whole lines, plus one status line rewritten in place |
| `format.ts` | Numbers, durations, costs and tables for the terminal |

### server/scripts

| File | What it does |
| --- | --- |
| `models.ts` | `pnpm models`: which models each key can see, and what the local scan found. Free |
| `eval/run.ts` | `pnpm eval`: indexes the samples, asks every question, checks each answer, writes a report to `eval-runs/`. Costs money on OpenAI |
| `eval/questions.ts` | The eval's questions |
| `eval/checks.ts` | Checks an answer against `samples/expected.json` |
| `eval/report.ts` | Writes the Markdown report |
| `samples/index.ts` | `pnpm samples`: writes `samples/riyadh-tower/`, `samples/empty-folder/` and `samples/expected.json`. The Arabic minutes need Microsoft Edge |
| `samples/sampleSet.ts` | Every sample document, built in memory |
| `samples/project.ts` | The invented project every document describes |
| `samples/expected.ts`, `expectedTables.ts`, `expectedEdge.ts` | The right answers, built from the same data the documents were written from |

Each of these writes one sample document:

| File | Writes |
| --- | --- |
| `samples/boqPhase1Rev0.ts` | `BOQ_Phase1_Rev0.xlsx`, with a planted arithmetic error |
| `samples/boqPhase1Rev1.ts` | `BOQ_Phase1_Rev1.xlsx`: quantities and rates changed, items added and removed |
| `samples/boqPhase2Facade.ts` | `BOQ_Phase2_Facade.pdf`: a BOQ running over pages |
| `samples/contractMainWorks.ts` | `Contract_Main_Works.pdf` |
| `samples/costLedger.ts` | `Cost_Ledger_10k.xlsx`: 10,000 rows |
| `samples/coverLetter.ts` | `Cover_Letter.docx`, which Atlas skips |
| `samples/drawingRegister.ts` | `Drawing_Register.pdf`, cut off and damaged |
| `samples/emptyWorkbooks.ts` | `Cost_Report_Empty.xlsx` (0 bytes) and `Blank_Template.xlsx` |
| `samples/equipmentImports.ts` | `Equipment_Imports.xlsx`: two tables on one sheet, several currencies |
| `samples/meetingMinutesAr.ts`, `meetingMinutesHtml.ts`, `meetingMinutesPdf.ts` | `Meeting_Minutes_07_AR.pdf`: Arabic minutes, laid out in HTML and printed by Edge |
| `samples/programmeMilestones.ts` | `Programme_Milestones.xlsx` |
| `samples/provisionalSums.ts` | `Provisional_Sums.xlsx`: amounts typed as text |
| `samples/siteSurveyScanned.ts` | `Site_Survey_Scanned.pdf`: an image with no text layer |
| `samples/specification.ts`, `specificationAppendices.ts`, `specificationPdf.ts` | `Specification_Volume_2.pdf`: about 300 pages, with planted clauses and a prompt injection |
| `samples/tenderAddendum.ts` | `Tender_Addendum_03.pdf`: password-protected |

`samples/lib/` holds their helpers:

| File | What it does |
| --- | --- |
| `PdfWriter.ts` | Writes text PDFs: styles, tables, running headers |
| `htmlPdf.ts` | Prints HTML to PDF with Edge |
| `pdfBoqLayout.ts`, `pdfBoqWriter.ts` | Lays out and writes a BOQ as a PDF |
| `scan.ts` | Makes a page look scanned, as an image-only PDF |
| `workbook.ts` | Workbook styles and fixed metadata, so the bytes repeat |
| `boqWorkbook.ts` | Writes a BOQ revision as `.xlsx`, with formulas and their results |
| `boqLayout.ts`, `boqTypes.ts` | Where a BOQ's rows go, and its types |
| `tableSheet.ts` | Places a table, its totals and its title block on a sheet |
| `reviseBoq.ts`, `revisionDiff.ts` | Applies changes to a BOQ, and lists the differences |
| `money.ts` | Money in halalas, so totals never drift |
| `dates.ts`, `due.ts` | Date helpers, and how the contract words a due date |
| `arabicText.ts` | Arabic digits, amounts and dates, Hijri included |
| `specClauses.ts` | Filler clauses for the specification |
| `sources.ts` | Sources in the shape `expected.json` uses |
| `random.ts` | A seeded random source, so every run gives the same data |
| `zip.ts`, `zipDates.ts` | Zips with fixed dates, so regenerated files keep the same bytes |

### server/test

About 200 test files. They follow `src` by layer, though `application/` and `infrastructure/` are mostly flat (`server/test/application/IndexFolder.test.ts` tests `src/application/indexing/IndexFolder.ts`). No key and no network.

| Folder | What it tests |
| --- | --- |
| `api/` | Each route group, through `inject` |
| `application/` | Use cases and indexing; subfolders `agent/`, `guards/`, `schedule/`, `tools/`, `vision/`, `voice/` |
| `domain/` | The pure rules; `tables/` for table extraction |
| `infrastructure/` | Readers, SQLite, exports, settings, logging, the folder window; subfolders `chat/`, `local/`, `openai/`, `providers/` |
| `cli/`, `eval/` | The CLI and the eval's checks and report |
| `samples/` | That the generated sample documents hold what `expected.json` says |
| `fixtures/arabic-edge.pdf` | A small Arabic PDF for the reader tests |
| `compose.test.ts` | `compose()` with a stand-in local scan |

`fakes/` has a stand-in for every port:

| File | What it fakes |
| --- | --- |
| `FakeClock.ts` | The clock |
| `FakeEmbeddingClient.ts` | Embeddings, by hashing words, so texts that share words get similar vectors |
| `FakeFileSystem.ts` | Files in memory |
| `FakeFileWatcher.ts` | A watch the test sends changes through |
| `FakeFolderPicker.ts` | A folder window that answers with a set path |
| `FakeIndex.ts` | The index in memory |
| `FakeModelClient.ts` | A model that plays scripted turns |
| `FakeOutputs.ts` | The page renderer and the exporter |
| `FakeTranscriber.ts` | Dictation with a fixed transcript |
| `FakeVoiceClient.ts` | Calls and voice designs, recorded |
| `MemoryRunLogger.ts` | A logger that keeps entries in memory |
| `apiDeps.ts` | Every route group's parts, made of fakes |
| `toolContext.ts` | A tool context made of fakes |
| `records.ts` | Ready-made PDF and Excel records |
| `lineup.ts` | A model lineup that matches `FakeModelClient` |
| `voiceCatalog.ts` | A small voice catalog |
| `fakes.test.ts` | Tests for the fakes |

## client/

The web app: Vite, React, Mantine. Components never call fetch; they use the hooks in `src/api/`.

| File | What it holds |
| --- | --- |
| `package.json` | `dev`, `build`, `typecheck`, `test` |
| `index.html` | The page Vite serves |
| `vite.config.ts` | Port 5173 (or `CLIENT_PORT`), forwarding `/api` to the server's `PORT` from the root `.env` |
| `tsconfig.json`, `vitest.config.ts` | TypeScript and test settings |
| `PRODUCT.md` | The product brief: who uses Atlas and on what |
| `DESIGN.md` | The design system |
| `.impeccable/` | The design direction (`surfaces/client.md`) and the design system as data (`design.json`) |

Each `Name.module.css` styles the component `Name.tsx` beside it.

### client/src

| File | What it does |
| --- | --- |
| `main.tsx` | Mounts the app inside its providers: Mantine, language, React Query, session, chat, voice call, document viewer |
| `App.tsx` | The frame: top bar, sidebar, and the conversation on its inset sheet |
| `theme.ts` | The Mantine theme: colours, light and dark roles, motion |
| `queryClient.ts` | The React Query cache |
| `styles/global.css` | Page-wide styles |

### client/src/api

Talking to the server. Each `use*.ts` is a React Query hook.

| File | What it does |
| --- | --- |
| `endpoints.ts` | Every API call, typed with the shared schemas |
| `http.ts` | Sends a request as JSON or multipart and parses the reply |
| `ApiError.ts`, `queryErrors.ts` | The client's error type, and React Query told about it |
| `parseJson.ts` | JSON parsing that never throws |
| `queryKeys.ts` | Every React Query key |
| `sse.ts` | Parses server-sent events as they arrive |
| `followStream.ts` | Follows an event stream, reconnecting when it drops |
| `askQuestion.ts` | Sends a question and reads its streamed events |
| `useAskStream.ts` | Runs a question from a component, with Stop |
| `useFolderStatus.ts`, `useIndexEvents.ts` | The loaded folder and its documents, kept fresh by the server's events |
| `useLoadFolder.ts`, `usePickFolder.ts`, `useUnloadFolder.ts` | Load a folder by path or from the folder window; unload it |
| `useRemoveFromFolder.ts`, `useRestoreToFolder.ts` | Take a file out of Atlas, and put it back |
| `useUpload.ts` | Uploads dropped files |
| `useSheetRows.ts` | Sheet rows for the viewer |
| `useModels.ts`, `useUsage.ts`, `useHealth.ts` | Models, the last answer's cost and time, server health |
| `useExport.ts` | Saves a result as `.xlsx` or `.csv` |
| `useClearChat.ts` | Forgets the chat on the server |
| `useVoices.ts`, `useDictation.ts` | Voices for calls, and dictation into the question box |
| `liveCall.ts` | Opens a GPT-Live call over WebRTC; `warmUpCalls` makes the first offer ahead of time |
| `liveEvents.ts` | The call events the client reacts to |
| `opusDtx.ts` | Turns off Opus DTX in the call's answer, so the browser keeps sending audio in silence |
| `microphone.ts` | Opens the microphone and explains why it could not |
| `audioMeter.ts` | How loud the microphone and the voice are |
| `CallDiagnostics.ts` | A call's numbers for the `call_end` log: mic level, packets, startup times |

### client/src/features

#### chat

| File | What it does |
| --- | --- |
| `ChatProvider.tsx`, `ChatContext.ts`, `useChat.ts` | The conversation's state and controls |
| `chatReducer.ts` | How each event changes the conversation |
| `ChatThread.tsx` | The conversation column: one turn per question |
| `Turn.tsx` | One question with its trace, answer, table and sources |
| `Composer.tsx` | The question box, with send, stop, dictation and the call button |
| `askReadiness.ts` | Why a question cannot be sent yet |
| `AnswerMarkdown.tsx`, `streamingMarkdown.ts`, `rehypeCaret.ts` | The answer as Markdown while it streams, with a caret after the last word |
| `AnswerWarnings.tsx` | The notes the answer checks left |
| `AnswerNotice.tsx` | The files Atlas could not read, under a "not found" answer |
| `PendingLine.tsx` | What Atlas is doing before the first words arrive |
| `StoppedNote.tsx` | The note on an answer the user stopped |
| `SaidAloud.tsx` | What the voice said about an answer during a call |
| `ResultTable.tsx`, `resultColumns.ts`, `formatNumber.ts` | The attached result table, its columns and its numbers |
| `ExportMenu.tsx`, `downloadFile.ts` | Export to Excel or CSV, and the download |
| `SourcesList.tsx`, `SourceRow.tsx`, `sourcePlace.ts`, `useOpenedSource.ts` | The answer's sources, and which one is open in the viewer |
| `Trace.tsx`, `TraceStep.tsx`, `TraceStepIcon.tsx` | The steps Atlas took, one per tool call |
| `traceSummary.ts`, `stepLabel.ts`, `stepActivity.ts`, `stepInput.ts`, `formatDuration.ts` | The trace's words: summary line, step names, step inputs, durations |
| `useFollowScroll.ts` | Keeps the newest text in view while the reader is at the bottom |
| `arabicText.ts` | How much of a text is Arabic |
| `chatCopy.ts`, `traceCopy.ts` | The interface text, in English and Arabic |

#### sidebar

| File | What it does |
| --- | --- |
| `Sidebar.tsx` | The sidebar: folder box, upload drop, progress, document tree |
| `FolderForm.tsx`, `folderPath.ts`, `folderErrorMessage.ts` | The folder path box, its folder button, and why a load failed |
| `UploadDrop.tsx` | The drop zone for files |
| `IndexProgress.tsx`, `indexingNow.ts` | The indexing line and its progress bar |
| `DocumentRegister.tsx` | The documents, as a folder tree |
| `FolderTree.tsx`, `buildFolderTree.ts`, `TreeFile.tsx` | The tree, built from the documents' paths, and one file row |
| `FolderGlyph.tsx`, `FileTypeIcon.tsx` | Folder and file icons |
| `StatusBadge.tsx`, `fileStatus.ts`, `documentMeta.ts` | A file's status and its size, pages or sheets |
| `RemoveButton.tsx` | The × that takes a file or folder out of Atlas |
| `RemovedLine.tsx` | The removed files at the foot, with Put back |
| `SkippedLine.tsx` | The files Atlas does not read |
| `RegisterEmpty.tsx`, `RegisterSkeleton.tsx` | The empty list, and the placeholder while it loads |
| `sidebarCopy.ts` | The interface text |

#### topbar

| File | What it does |
| --- | --- |
| `TopBarActions.tsx` | The end of the top bar: cost, badge, pickers, Clear chat, language and theme |
| `ModelPicker.tsx`, `modelGroups.ts`, `useChosenModel.ts` | The model picker, grouped by provider, and the model chosen |
| `EffortPicker.tsx` | Low, medium or high thinking effort |
| `OptionRow.tsx` | One row of either picker |
| `FreeTierBadge.tsx`, `freeTier.ts` | The "Free tier" badge while a free model is picked |
| `UsageReadout.tsx`, `usageText.ts` | The last answer's cost and time |
| `ClearChatButton.tsx` | Stops any answer and starts a new chat |
| `Preferences.tsx`, `LanguageToggle.tsx`, `ColorSchemeToggle.tsx` | Interface language and theme |
| `topbarCopy.ts` | The interface text |

#### viewer

Opens a cited source, or a whole file from the sidebar.

| File | What it does |
| --- | --- |
| `SourceViewerModal.tsx`, `SourceViewer.tsx`, `findSourceDocument.ts` | Shows a source's page or rows |
| `DocumentViewerProvider.tsx`, `DocumentViewerContext.ts`, `useDocumentViewer.ts` | Which whole file is open; any component opens one |
| `DocumentViewerModal.tsx`, `DocumentViewer.tsx` | Shows a whole file |
| `ViewerModal.tsx`, `ViewerTitle.tsx`, `ViewerLoading.tsx`, `ViewerNotice.tsx` | The modal both viewers share, its title, loading line and notices |
| `DocumentProblemNotice.tsx`, `documentProblem.ts` | Why a file cannot be shown, with a download button |
| `PdfView.tsx`, `LazyPdfView.tsx`, `PdfToolbar.tsx`, `pdfWorker.ts`, `pdfLoadError.ts` | PDFs through pdf.js: the page, the page field, the worker, load errors |
| `QuoteNote.tsx`, `useQuoteHighlight.ts`, `findQuote.ts`, `foldText.ts`, `markedHtml.ts` | Finds and marks the quoted text on a PDF page |
| `WorkbookView.tsx` | A whole workbook, with sheet tabs along the foot |
| `SheetView.tsx`, `SheetBlock.tsx`, `SheetCell.tsx`, `cellSpans.ts` | Sheet rows, the cited ones tinted, long text running over empty neighbours |
| `sheetWindow.ts`, `useKeepInView.ts`, `stageScroll.ts` | Which rows to load, and keeping the cited rows in view |
| `viewerCopy.ts` | The interface text |

#### voice

| File | What it does |
| --- | --- |
| `VoiceCallProvider.tsx`, `VoiceCallContext.ts`, `useVoiceCall.ts` | The call's state and controls |
| `CallSession.ts` | Directs a call: hands each spoken question to the chat, tells the voice what to say, and records why the call ended |
| `callTranscript.ts` | Puts the call's transcript pieces together |
| `CallButton.tsx`, `voiceChoice.ts` | The split call button with its voice list, and the voice remembered |
| `CallCard.tsx`, `LevelBars.tsx` | The card shown during a call, and its sound level bars |
| `AtlasFace.tsx`, `faceDrawing.ts`, `faceMotion.ts` | The animated bust: its drawing, and how it moves with the call and the audio |
| `callCopy.ts` | The interface text, and what the voice says when there is no answer |

#### errors

| File | What it does |
| --- | --- |
| `ErrorNotice.tsx`, `noticeStyles.ts` | An error shown in place, with Try again when that can work |
| `notifyError.ts` | An error as a notification, for actions with no place on the page |
| `errorCopy.ts` | A message per error code |

### client/src (the rest)

| File | What it does |
| --- | --- |
| `i18n/LanguageProvider.tsx`, `LanguageContext.ts`, `useLanguage.ts`, `language.ts` | The interface language; Arabic mirrors the layout |
| `i18n/useCopy.ts` | A feature's text in the current language |
| `i18n/count.ts` | Numbers and plurals, Arabic plurals included |
| `i18n/bidi.ts` | Keeps a file name's direction inside an Arabic sentence |
| `shell/TopBar.tsx`, `Wordmark.tsx`, `AtlasMark.tsx` | The top bar, and Atlas's mark: a spreadsheet and a PDF behind the call face's head |
| `shell/MainColumn.tsx` | The conversation, with the composer docked at the foot |
| `shell/Sheet.tsx`, `ScrollContainerContext.ts`, `useScrollContainer.ts` | The inset sheet the conversation scrolls in |
| `shell/Opening.tsx`, `openingScript.ts` | The bust's opening line before the first question |
| `shell/useSidebar.ts`, `sidebarPrefs.ts` | Opening, closing (Ctrl+B) and resizing the sidebar, remembered |
| `shell/layout.ts` | Fixed frame sizes |
| `shell/shellCopy.ts` | The interface text |
| `state/SessionProvider.tsx`, `SessionContext.ts`, `useSession.ts`, `newSessionId.ts` | The chat's session id, and the model and effort chosen for the next question |

### client/test

Vitest tests for the client's pure logic, by feature: `api/` (call diagnostics, live events, Opus DTX), `chat/` (the reducer and answer text), `shell/` (the opening, sidebar settings), `sidebar/` (the folder tree), `topbar/` (free tier, model groups), `viewer/` (file problems, viewer text) and `voice/` (CallSession, transcript, face motion, voice choice).

## samples/

| Path | What it holds |
| --- | --- |
| `riyadh-tower/` | 16 fictional project files: BOQs, contract, specification, ledger, minutes, and the damaged, empty, scanned, protected and skipped cases |
| `empty-folder/` | Only a `.gitkeep`, to show the empty-folder message |
| `expected.json` | The right answers, which the eval checks against |
| `README.md` | What each sample file is and what it tests |

`pnpm samples` writes all of it again.

## docs/

| Path | What it holds |
| --- | --- |
| `TECHNICAL.md` | How Atlas works: a question's path, indexing, checks, voice, tools, edge cases, settings |
| `CODEBASE.md` | This guide |
| `EVAL.md` | The latest eval report |
| `DEMO_GUIDE.md` | A plain guide to how Atlas is built, for answering "how does it work?" in a demo |
| `NOTE.md` | How Atlas was built: the coding agent, the time, the approach |
| `TIMELOG.md` | One line per work block |
| `images/` | The README's logo (`logo-light.svg`, `logo-dark.svg`), feature wheel (`features.svg`) and three screenshots |
