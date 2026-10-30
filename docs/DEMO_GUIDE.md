# Atlas: demo guide

A plain guide to how Atlas is built, so you can answer "how does it work?" and "where does that live in the code?"

---

## 1. Atlas in one minute

Atlas answers questions about a folder of project documents (PDFs and Excel files). Every answer shows the exact page or spreadsheet rows it came from.

- **Pitch:** "Ask your project documents a question. Get an answer you can check."
- **For:** people on construction projects who work with contracts, bills of quantities (BOQs), specifications and meeting minutes.
- **What makes it different from pasting files into ChatGPT:**
  - It never makes up numbers. The AI plans; code does the maths over every row.
  - Every fact has a source you can click.
  - It says "not found" when the files don't say.
  - It works in English and Arabic, typed or spoken.
- **Demo data:** a fictional tower in Riyadh, 16 files in `samples/riyadh-tower/`.

---

## 2. The big picture: three parts

```
        YOU, in the browser
               |
               v
  +--------------------+          +------------------------------+
  |  client/           |  ---->   |  server/                     |
  |  THE SCREEN        |  <----   |  THE BRAIN                   |
  |  what you see and  |          |  reads the files, runs the   |
  |  click             |          |  AI, checks every answer     |
  +--------------------+          +------------------------------+
                                     |            |            |
                                     v            v            v
                               your PDF and   one SQLite     OpenAI
                               Excel files    file (the      (the AI
                               (the folder)   "index")       models)

  shared/ = the agreed forms both sides use
            (what a question, an answer, a source look like)
```

| Part | Folder | In plain words | Built with |
| --- | --- | --- | --- |
| The screen | `client/` | The website you click on | React, Vite, Mantine, TypeScript |
| The brain | `server/` | Does all the work | Node.js 24, Fastify, TypeScript |
| The agreed forms | `shared/` | Rules for what data looks like, used by both sides so they never disagree | Zod, TypeScript |

All three live in one repository (a "monorepo", managed with pnpm).

---

## 3. What happens when you ask a question

The AI works like a researcher with a toolbox. It decides what to look up. The tools (plain code) do the searching and the maths. A checker inspects the answer before you see it.

1. **You ask** by typing, dictating, or speaking on a voice call.
2. **The server sends the AI** your question, the list of files, and a menu of 11 tools.
3. **The AI picks a tool**, for example "run this query over every table" or "search for late penalties".
4. **The code runs the tool** and returns real rows or passages. Each result is saved under an id.
5. **Steps 3 and 4 repeat** until the AI has what it needs (12 rounds at most).
6. **The AI hands in its answer** with one special tool, `submit_answer`: text, the result id, and sources.
7. **The checker inspects it:**
   - every number must come from a tool result,
   - every source must exist (real file, real page, real rows),
   - the answer must be in the question's language.
   If something fails, the AI must fix it (2 tries; after that it is shown with warnings).
8. **You see the answer appear word by word**, with its table, clickable sources, the steps the AI took, the cost and the time.

If no valid source survives, the answer is "not found in the loaded documents", and Atlas names the files it could not read.

---

## 4. What happens when a folder loads

1. **Scan:** every file gets a status (ready, scanned, damaged, password protected, empty, too large, skipped).
2. **Read PDFs** with mupdf: text, positions, Arabic in the right order. Scanned pages are kept as images.
3. **Read Excel** with exceljs: every sheet, formulas, merged cells.
4. **Find tables:** real headers under title rows, total rows, "SAR 1.2M", Arabic digits, two tables on one sheet.
5. **Store everything** in one SQLite file per folder:
   - each table becomes a real database table (so totals run over every row),
   - page text goes into a keyword index,
   - page text also goes into a "meaning" index (embeddings).
6. **Sort documents** into types (contract, BOQ, ...) with the small AI model.
7. **Suggest 5 questions** to start with.
8. **Watch the folder:** a changed or new file is re-read by itself.

Loading the same folder again takes milliseconds, because the index is cached.

---

## 5. How the server code is organised (the restaurant)

The server is split into four layers. Each layer has one job.

| Layer | Folder | Restaurant role | What is in it |
| --- | --- | --- | --- |
| API | `server/src/api/` | The waiters | Web routes: take requests from the screen, send answers back. No cooking. |
| Application | `server/src/application/` | The head chef and the recipes | The AI loop, the 11 tools, the answer checks, chat memory, voice calls |
| Domain | `server/src/domain/` | The rule book | Pure rules: money, currencies, tables, dates, the safe calculator, the SQL safety check. No outside contact. |
| Infrastructure | `server/src/infrastructure/` | Kitchen equipment and suppliers | PDF reader, Excel reader, SQLite database, OpenAI connection, file watcher, Excel export |
| Wiring | `server/src/main.ts` | The manager who connects everyone at opening | The one place where the real equipment is plugged in |

**Why it is built this way (good answer if someone says "architecture"):**

- The chef never talks to a supplier directly. They use a fixed order form, called a **port** (an interface in `application/ports/`). The supplier side is an **adapter**.
- So a supplier can be swapped. To use another AI provider, you write a new adapter in `infrastructure/`; the recipes stay the same.
- Tests use **fake suppliers** (`server/test/fakes/`). About 1,760 tests run with no internet and no cost.
- The name for this is "clean architecture" or "ports and adapters" (also called "hexagonal").

**The screen's code** (`client/src/`) is organised by feature:

| Folder | What it is |
| --- | --- |
| `features/chat/` | The conversation: question box, answers, tables, sources, steps |
| `features/sidebar/` | The file list on the left (folder tree, upload, statuses) |
| `features/viewer/` | The pop-up that opens a PDF page or spreadsheet rows |
| `features/voice/` | Voice calls and the animated face |
| `features/topbar/` | Top bar: model picker, language, theme, cost, clear chat |
| `features/errors/` | Error messages |
| `api/` | The only code that talks to the server. Screens never call the server directly. |
| `i18n/` | English and Arabic text |
| `shell/` | The page frame: top bar, sidebar, opening animation |
| `theme.ts` | Colours, spacing, light and dark |

---

## 6. Where each feature lives

Use this when someone asks "where is X in the code?". Paths start at `client/src/` (screen) or `server/src/` (brain).

### Files and folders

| Feature | Screen (`client/src/`) | Brain (`server/src/`) |
| --- | --- | --- |
| Load a folder by path or choose it in the folder window | `features/sidebar/FolderForm.tsx` | `api/routes/folder.ts`, `application/indexing/IndexFolder.ts`, `infrastructure/dialog/NativeFolderPicker.ts` |
| Upload by drag and drop | `features/sidebar/UploadDrop.tsx` | `api/routes/uploads.ts` |
| File list as a folder tree | `features/sidebar/FolderTree.tsx` | (status comes from `api/routes/folder.ts`) |
| File status (damaged, scanned, empty...) | `features/sidebar/StatusBadge.tsx` | `domain/documentStatus.ts` |
| Re-read files when they change | (live updates: `api/useIndexEvents.ts`) | `application/indexing/WatchFolder.ts`, `infrastructure/watch/ChokidarWatcher.ts` |
| Read PDFs | | `infrastructure/readers/MupdfReader.ts` |
| Arabic text order in PDFs | | `infrastructure/readers/rtlOrder.ts` |
| Read Excel | | `infrastructure/readers/ExcelJsReader.ts` |
| Find tables, headers, totals, currencies | | `domain/tables/` |
| The database (index) | | `infrastructure/index/SqliteIndex.ts` |
| Search by meaning (embeddings) | | `infrastructure/index/vectors.ts`, `infrastructure/openai/OpenAiEmbeddingClient.ts` |
| Sort documents into types | | `application/indexing/ClassifyDocument.ts` |
| Suggested questions | `features/chat/SuggestedQuestions.tsx` | `application/indexing/SuggestQuestions.ts` |

### Asking and answering

| Feature | Screen (`client/src/`) | Brain (`server/src/`) |
| --- | --- | --- |
| Question box | `features/chat/Composer.tsx` | |
| Send a question, receive the answer | `api/useAskStream.ts` | `api/routes/chat.ts`, `application/AskQuestion.ts` |
| Answer appears word by word (streaming) | `api/sse.ts`, `api/followStream.ts` | `api/sse.ts`, `api/chatEvents.ts` |
| The AI loop (ask AI, run tool, repeat) | | `application/agent/runAgent.ts` |
| The AI's rules (its "instructions") | | `application/agent/instructions.ts` |
| Talk to OpenAI | | `infrastructure/openai/OpenAiModelClient.ts` |
| The 11 tools | | `application/tools/` (one file per tool, list in `registry.ts`) |
| Answer checks (numbers, sources, language) | | `application/guards/` |
| "Not found" answer | `features/chat/AnswerNotice.tsx` | `application/guards/sourcesGuard.ts` |
| Result table under the answer | `features/chat/ResultTable.tsx` | |
| The "steps" the AI took | `features/chat/Trace.tsx` | |
| Chat memory (follow-up questions) | `features/chat/ChatProvider.tsx` | `application/session/`, `application/agent/conversationInput.ts` |
| Clear the chat | `features/topbar/ClearChatButton.tsx` | `api/routes/chat.ts` |

### Sources and exports

| Feature | Screen (`client/src/`) | Brain (`server/src/`) |
| --- | --- | --- |
| Source list under an answer | `features/chat/SourcesList.tsx` | |
| Open a PDF at the page, sentence highlighted | `features/viewer/PdfView.tsx`, `useQuoteHighlight.ts` | `api/routes/documents.ts` |
| Open a spreadsheet with rows marked | `features/viewer/SheetView.tsx` | `api/routes/documents.ts` |
| Open a whole file from the list | `features/viewer/DocumentViewer.tsx` | `api/routes/documents.ts` |
| Download a result as Excel or CSV | `features/chat/ExportMenu.tsx` | `api/routes/exports.ts`, `infrastructure/export/XlsxExporter.ts` |

### The tools (what the AI can ask the code to do)

All in `server/src/application/tools/`. The pure maths behind several of them is in `server/src/domain/`.

| Tool | What it does | File |
| --- | --- | --- |
| list_documents | Lists every file, its status, pages, sheets, tables | `listDocuments.ts` |
| search_documents | Finds passages by exact words and by meaning | `searchDocuments.ts` |
| read_pages | Reads the exact text of some PDF pages | `readPages.ts` |
| query_tables | Runs one read-only SQL query over all tables | `queryTables.ts` |
| look_at_page | Shows a page image to the AI (scanned pages, drawings) | `lookAtPage.ts` |
| check_boq_arithmetic | Checks quantity x rate = amount, and subtotals | `checkBoqArithmetic.ts` |
| extract_schedule | Finds dates, deadlines, durations (Hijri dates too) | `extractSchedule.ts` |
| compare_revisions | Compares two BOQ versions: added, removed, changed | `compareRevisions.ts` |
| calculate | Safe arithmetic on numbers the tools returned | `calculate.ts` |
| export_table | Saves a result as .xlsx or .csv | `exportTable.ts` |
| submit_answer | Hands in the final answer, which is then checked | `submitAnswer.ts` |

### Safety

| Feature | Where |
| --- | --- |
| AI cannot type its own numbers | `server/src/application/guards/numbersGuard.ts` |
| Every source must really exist | `server/src/application/guards/sourcesGuard.ts` |
| Answer in the question's language | `server/src/application/guards/languageGuard.ts` |
| SQL can only read, never change data | `server/src/domain/sqlGuard.ts` |
| A slow query is stopped (runs in its own process with a time limit) | `server/src/infrastructure/index/QueryRunner.ts` |
| Safe calculator (no code execution) | `server/src/domain/calculator.ts` |
| Never add different currencies together | `server/src/domain/money.ts`, `currency.ts` |
| Text inside documents is data, not commands | `server/src/application/agent/instructions.ts` |
| The OpenAI key stays on the server | `.env`, read by `server/src/infrastructure/settings.ts` |

### Voice, language, look

| Feature | Screen (`client/src/`) | Brain (`server/src/`) |
| --- | --- | --- |
| Voice call | `features/voice/CallSession.ts`, `CallCard.tsx`, `api/liveCall.ts` | `api/routes/voice.ts`, `application/voice/VoiceCalls.ts`, `infrastructure/openai/OpenAiVoiceClient.ts` |
| The animated face | `features/voice/AtlasFace.tsx` | |
| Voice and dialect picker | `features/voice/VoicePicker.tsx` | `server/config/voices.json` |
| What the voice says (built from the checked answer) | | `domain/speech.ts` |
| Dictation (speak, get typed text) | `api/useDictation.ts` | `application/voice/TranscribeSpeech.ts` |
| English / Arabic interface | `i18n/`, `features/topbar/LanguageToggle.tsx` | |
| Light / dark theme | `theme.ts`, `features/topbar/ColorSchemeToggle.tsx` | |
| Opening animation | `shell/Opening.tsx` | |
| Model picker (Luna, Sol, Astra) | `features/topbar/ModelPicker.tsx` | `api/routes/models.ts`, `server/config/models.json` |
| Cost and time per answer | `features/topbar/UsageReadout.tsx` | `application/agent/UsageMeter.ts`, `domain/pricing.ts` |

### Everything else

| What | Where |
| --- | --- |
| Settings (key, folder, port) | `.env` (template: `.env.example`) |
| Logs of every question and tool call | `.logs/` (written by `infrastructure/logging/JsonlRunLogger.ts`) |
| Saved index and uploads | `.atlas/` |
| Command-line version (`pnpm cli`) | `server/src/cli.ts`, `server/src/cli/` |
| Sample documents | `samples/riyadh-tower/`; right answers in `samples/expected.json` |
| Code that builds the samples | `server/scripts/samples/` |
| The exam (21 questions with known answers) | `server/scripts/eval/`; results in `docs/EVAL.md` |
| Tests | `server/test/`, `client/test/`, `shared/test/` |
| Shared data shapes | `shared/src/schemas/` |

---

## 7. Buzzwords: what they mean and what to say

| If they say... | It means | For Atlas |
| --- | --- | --- |
| LLM | Large language model, the AI that reads and writes text | OpenAI GPT-6 models |
| Agent, agentic | An AI that works in steps and uses tools | Yes. The loop is in `application/agent/runAgent.ts` |
| Tool calling, function calling | The AI asks code to do a job | Yes, 11 tools |
| RAG | Look up the right passages first, then answer from them | Yes, for text (search, then read pages). Tables go through SQL instead, which is more exact. |
| Embeddings, semantic search | Text turned into numbers so you can search by meaning | Yes, `text-embedding-3-small` |
| Hybrid search | Keyword search and meaning search combined | Yes, merged by rank |
| Vector database | A special database for embeddings (Pinecone, etc.) | Not a separate one. Vectors sit in the same SQLite file. Enough for a project folder. |
| Hallucination | The AI making things up | Blocked by the checks: numbers must come from tools, sources must exist |
| Grounding, citations | Every claim tied to a source | Yes, file + page, or file + sheet + rows |
| Fine-tuning, training | Retraining the AI on your data | No. Your files are read when you ask; nothing is trained. |
| Prompt injection | Text in a document trying to give the AI orders | Treated as data. The sample spec has a planted order on page 297; Atlas ignores it. |
| OCR | Reading text from an image | Scanned pages are shown to the AI as images (vision). No separate OCR step yet. |
| Multimodal, vision | AI that can look at images | Yes, `look_at_page` |
| Streaming, SSE | The answer appears while it is written | Yes, server-sent events |
| WebRTC | Live audio between browser and service | Yes, for voice calls |
| Frontend / backend | Screen / server | `client/` / `server/` |
| API | How the screen talks to the server | `server/src/api/routes/` |
| Clean architecture, ports and adapters | Layers with one job each; swappable parts | Yes, see section 5 |
| Monorepo | Several packages in one repository | Yes: client, server, shared |
| SQL | Database query language | The AI writes read-only queries; a guard blocks any change |
| Tokens | Pieces of text; AI is priced per token | Cost per answer is shown in the top bar |
| Context window | How much text the AI can read at once | Atlas sends only the pages search found, not the whole 300-page PDF |
| Eval | An exam with known right answers | 21 of 21 passed |
| Unit tests | Small automatic checks of the code | About 1,760, no internet needed |

---

## 8. Questions you may get, with short answers

**Is this just ChatGPT on our files?**
No. The AI only plans. Code does the searching and the maths, and a checker rejects any number the AI typed itself. Every answer has a clickable source.

**Does it make things up?**
It is built to stop that. Numbers must come from code, sources must exist, and if nothing is found it says "not found".

**Did you train the AI on our documents?**
No. Nothing is trained. Atlas reads the files and looks things up when you ask.

**Where is our data? Is it safe?**
The files, the index and the app stay on the computer. Only the passages and page images needed for a question are sent to OpenAI. The OpenAI key stays on the server, never in the browser.

**Can the AI change or delete our data?**
No. Its database queries are checked to be read-only, run in a separate process with a time limit, and the files are never written to.

**Which AI does it use?**
OpenAI. GPT-6 Luna by default (cheap and fast). You can switch to GPT-6.1 Sol or GPT-6 Astra for harder questions from the top bar.

**Can we switch to another AI provider?**
Yes, in principle. The core code talks to an interface, not to OpenAI. A new provider means a new adapter in `server/src/infrastructure/`. Voice calls are tied to OpenAI's voice service.

**How big can files be?**
The samples include a 300-page PDF and a 10,000-row spreadsheet. Search finds the right pages, and totals run over every row. The default limit is 200 MB per file.

**What about broken files?**
They are listed with a clear status: damaged, password protected, empty, scanned, or skipped.

**Which file types?**
PDF and Excel (`.pdf`, `.xlsx`, `.xlsm`). Others, like Word, are listed and skipped.

**How much does it cost?**
A fraction of a cent per question on Luna. The full 21-question exam cost $0.02. A voice call is $0.05 a minute.

**How fast is it?**
The middle answer in the exam took 6.9 seconds.

**How do you know it is right?**
An exam of 21 questions with known answers (`docs/EVAL.md`): 21 of 21 passed. Plus about 1,760 automatic tests.

**Does it remember the conversation?**
Yes. It keeps the last 6 questions and answers, so follow-ups like "and the second one?" work. Clearing the chat, reloading the page or restarting the server starts fresh.

**Does it work in Arabic?**
Yes. The whole interface switches to Arabic (right to left). Ask in Arabic and it answers in Arabic. Voice calls support Gulf, Levantine, Egyptian, North African and Modern Standard Arabic, plus English.

**Does it work offline?**
The app and the index run locally, but answers need the internet to reach OpenAI.

**Can many people use it? Is there a login?**
Not yet. Today it is a single-user app that runs on one computer.

**How long did it take to build?**
About 5 hours of working time on 28 and 29 October 2026, using an AI coding agent with parallel workers (see `docs/NOTE.md` and `docs/TIMELOG.md`).

---

## 9. Numbers to remember

| Fact | Value |
| --- | --- |
| Exam result | 21 of 21 correct on GPT-6 Luna |
| Exam cost | $0.02 for all 21 questions |
| Typical answer time | 6.9 seconds (median) |
| Automatic tests | about 1,760 |
| Tools the AI can use | 11 |
| AI models to choose from | 3 (Luna, Sol, Astra) |
| Voice languages | English + 5 Arabic dialects, female and male voices |
| Voice call cost | $0.05 a minute |
| Sample files | 16 |

---

## 10. Honest limits (say these before someone finds them)

- **PDF and Excel only.** Word and other files are skipped.
- **Needs OpenAI.** No internet or no key means no answers.
- **One user, no login.** A chat is lost when the page reloads or the server restarts.
- **Scanned pages** are read by the AI as images. It works, but it is slower and costs more than a proper OCR step would.
- **PDF tables** are found best when they look like BOQs (clear columns).
- **No spending cap** per question yet.
- **Arabic mode:** answer warnings and the "steps" lines are still in English.
- **Voice calls are the riskiest part of a live demo.** Earlier test calls answered late, or only after muting. A fix is in, but it has not been confirmed on a live call. Try one call before the demo, and keep a typed question ready as a backup.
