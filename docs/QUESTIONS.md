# Atlas: questions you may be asked

Preparation for a conversation with someone who is not a developer but follows AI out of interest. Expect "what did you use for this?", "how does that part work?" and "why did you do it that way?". The answers are written to be said out loud, in plain words. Where a fact matters, it is the real figure from the code or the docs.

For "where is that in the code?", and a table of AI buzzwords with what they mean for Atlas, see [DEMO_GUIDE.md](DEMO_GUIDE.md).

---

## Start with this (30 seconds)

> Atlas is a chat assistant for a folder of project documents: PDFs and Excel files like contracts, bills of quantities and specifications. You ask in English or Arabic, by typing or on a voice call, and every answer shows the exact page or spreadsheet rows it came from. The AI does not do the maths. It decides what to look up, ordinary code does the searching and adding up, and a checker throws out any number the AI typed itself.

---

## 1. "What did you use?"

**Which AI answers the questions?**
OpenAI's GPT-6 models. The default is the smallest, GPT-6 Luna, because it is cheap and fast. The top bar switches to GPT-6.1 Sol or GPT-6 Astra for harder questions. It can also use Google's Gemini on its free tier, or a model running on the computer itself through Ollama, with nothing sent to the internet.

**Why the small model and not the best one?**
Because code does the hard parts, the model mostly plans. On the 21-question test, the small model scored 21 of 21 for 2 cents in total. An earlier run on the biggest model scored 20 of 21 for $1.48. To be fair, some fixes went in between those two runs, so it is not a perfect head-to-head. The point stands: once code does the counting, a cheap model is enough.

**Why OpenAI, and not Claude or Gemini?**
One account covers everything Atlas needs: the answering models, the search model, the live voice and dictation. But Atlas is not locked in. The core talks to a plug, not to OpenAI directly, and Gemini and local models already use that same plug. Claude could be added the same way.
*(If you had another reason, say that instead.)*

**What runs the voice?**
GPT-Live, OpenAI's real-time voice model, for calls. A separate model, gpt-transcribe, powers the microphone button that turns speech into typed text you can edit before sending.

**What does the search use?**
Two searches at once, merged into one list:
- plain keyword search, built into the SQLite database,
- search by meaning, using OpenAI's text-embedding-3-small model.

The keyword search catches exact terms like item codes. The meaning search catches the same idea in other words, even in another language.

**Where is everything stored?**
In SQLite, a small database that is just one file on the computer, one per folder. Every table found in the spreadsheets and PDFs becomes a real database table. So "total" means adding up every row, not estimating.

**What reads the files?**
mupdf for PDFs (it also draws scanned pages as images), and exceljs for Excel.

**What is the website built with?**
React for the screen, with a component library called Mantine. The server is Node.js with Fastify. Everything is written in TypeScript.

**Did you use LangChain? A vector database? Fine-tuning? MCP?**
No to all four.
- **LangChain:** the agent loop is a small piece of code I control. Fewer layers, and I can see exactly what happens at each step.
- **Vector database** (Pinecone and the like): the embeddings sit in the same SQLite file. A project folder is small enough that a separate service would only add cost and setup.
- **Fine-tuning:** nothing is trained. The model reads the files when you ask, so new files work straight away.
- **MCP:** that is a standard for plugging tools into other AI apps. Atlas's tools are built into Atlas, so it does not need it. Exposing Atlas's tools over MCP, so Claude Desktop could use them, would be a reasonable next step.

---

## 2. "How does it actually work?"

**Is it an "agent"?**
Yes, a small one. The AI gets the question, the list of files and 11 tools: search, read pages, run a database query, look at a page image, check BOQ arithmetic, find dates, compare two versions of a BOQ, calculate, export to Excel, list the files, and hand in the answer. It picks a tool, the code runs it, the AI reads the result and picks the next one, for up to 12 rounds. Then it hands in its answer through a special tool, and that answer is checked before anyone sees it.

**What are the 11 tools, exactly? Where did they come from?**
They are Atlas's own code, written for this project. Each tool is one file in [server/src/application/tools/](../server/src/application/tools/), and [registry.ts](../server/src/application/tools/registry.ts) is the list the AI is shown. None of them came from a library or an MCP server. Each tool gives the AI a name, a few sentences on when to use it, and the inputs it takes. The AI only picks a tool and fills in the inputs; the code does the actual work. The maths behind several tools sits in [server/src/domain/](../server/src/domain/): plain code with no AI and no internet, tested on its own.

| Tool | What it does | Where it is |
| --- | --- | --- |
| list_documents | Lists every file in the folder: whether it opened (and why not), its type, pages or sheets, which pages are scanned, its language and currencies, and the database tables made from it. Usually the first step, and how Atlas names the files it could not open. | [listDocuments.ts](../server/src/application/tools/listDocuments.ts) |
| search_documents | Finds passages about a topic by exact words and by meaning at the same time, merges the two lists, and returns the best 8 (20 at most), each with its file, page and about 500 characters of text. If the meaning search is unavailable, it falls back to exact words and says so. | [searchDocuments.ts](../server/src/application/tools/searchDocuments.ts); the merging in [domain/ranking.ts](../server/src/domain/ranking.ts) |
| read_pages | Gives the exact text of up to 5 pages of one PDF (about 15,000 characters per call), so the AI can quote the wording and cite the page. Says when a page is scanned and needs look_at_page instead. | [readPages.ts](../server/src/application/tools/readPages.ts) |
| look_at_page | Draws one PDF page as an image and shows it to the AI with a specific question. For scanned pages, drawings, stamps, signatures and handwriting. It says when something cannot be read, so the answer never guesses. | [lookAtPage.ts](../server/src/application/tools/lookAtPage.ts); the image step in [application/vision/askAboutPage.ts](../server/src/application/vision/askAboutPage.ts) |
| query_tables | Runs one database query over every table found in the files. Every total, count and "items over X" question goes through it, so no row is missed. The query is checked to be read-only first and stopped after 5 seconds. Each result row comes back with the sheet rows or pages it came from. It warns when total rows could be counted twice or currencies are mixed. | [queryTables.ts](../server/src/application/tools/queryTables.ts); the read-only check in [domain/sqlGuard.ts](../server/src/domain/sqlGuard.ts) |
| calculate | Does arithmetic in code: sums, averages, percentages, rounding. Every number typed into it must already have appeared in the question or a tool result; only small constants such as 12 or 100 are free. It is a calculator of its own, so it never runs code. | [calculate.ts](../server/src/application/tools/calculate.ts); the calculator in [domain/calculator.ts](../server/src/domain/calculator.ts) |
| check_boq_arithmetic | Checks every row of each bill of quantities: quantity × rate must equal the amount, and every subtotal and total must equal the rows it adds up. Lists each mismatch with the stated amount, the right amount, the difference and its row. | [checkBoqArithmetic.ts](../server/src/application/tools/checkBoqArithmetic.ts); the rules in [domain/boqArithmetic.ts](../server/src/domain/boqArithmetic.ts) |
| compare_revisions | Compares two versions of a BOQ: items added, removed and changed (old and new quantity, rate and amount), and the change in the total for each currency. Items are matched by item code, or by description when the code is missing or has changed. | [compareRevisions.ts](../server/src/application/tools/compareRevisions.ts); the matching in [domain/revisions.ts](../server/src/domain/revisions.ts) |
| extract_schedule | Finds dates, deadlines, durations, milestones and deliverables in every PDF and programme sheet. Code finds the candidates, and the small model confirms and labels them. Hijri dates are kept exactly as written, never converted. | [extractSchedule.ts](../server/src/application/tools/extractSchedule.ts); the steps in [application/schedule/](../server/src/application/schedule/) |
| export_table | Saves a result as an Excel file that also lists the sources, or as a plain CSV. Used only when the user asks to export. | [exportTable.ts](../server/src/application/tools/exportTable.ts); the saving in [application/ExportResult.ts](../server/src/application/ExportResult.ts) |
| submit_answer | Hands in the final answer: the text, its language, the table to show and every source. The answer is then checked (numbers, sources, language) before anyone sees it, and goes back to the AI to fix if it fails. Unlike the other ten, it is added by the agent loop itself rather than the list. | [submitAnswer.ts](../server/src/application/tools/submitAnswer.ts); added in [application/AskQuestion.ts](../server/src/application/AskQuestion.ts), checked in [application/guards/](../server/src/application/guards/) |

**Is this RAG?**
For text, yes: search finds the right pages first, and only those go to the AI. For tables it does something more exact than RAG. The AI writes a database query and the code runs it over every row. RAG on a spreadsheet would only see the few rows the search happened to find, which is how you get wrong totals.

**What are embeddings, in simple terms?**
Each passage is turned into a list of about 1,500 numbers that capture its meaning. Passages that mean similar things get similar numbers, so you can search by meaning instead of exact words. That is how an English question finds an answer that is only written in Arabic.

**How do you stop it making things up?**
Three ways:
1. **It cannot type numbers.** Every number in an answer must appear in something a tool returned. If one does not, the answer goes back to the AI to fix, twice at most.
2. **Every fact needs a source, and the source is checked.** The file, the page or the spreadsheet rows must really exist.
3. **"Not found" is allowed.** If nothing checks out, it says "not found in the loaded documents", names any files it could not open, and shows where it looked.

**Can it read scanned documents?**
Yes. A scanned page has no text in it, just a picture. Atlas draws the page as an image and shows it to the AI, which can read images. There is no separate OCR step yet; adding one would be cheaper.

**What about a 300-page PDF? Does that not overflow the AI's memory?**
It never sends the whole thing. Search finds the few pages that matter and only those are read. A typical question uses 15,000 to 25,000 tokens, and most of that is the same set-up text every time, which OpenAI caches and bills at a tenth of the price.

**What is the "thinking effort" picker?**
Newer models think before they answer. Effort sets how long: Fast, Medium, or Slower and most careful. Fast is quicker and cheaper; careful is for tricky questions. I have not yet measured whether Fast keeps the full test score.

**Does it remember the conversation?**
Yes, the last 6 questions and answers, so "and what about the second one?" works. A voice call remembers the last 4. Clearing the chat or restarting the server starts fresh.

**What if a document says "ignore your rules"?**
That is called prompt injection. Atlas's rules say text inside documents is data, never orders. The sample specification has one planted on page 297, telling the AI to report a wrong contract value. Atlas ignores it and gives the real figure, from page 3. That trap is one of the test questions.

---

## 3. Voice calls

**How does a call work?**
The voice model only listens and talks. When you ask about the documents, it does not answer itself: it hands the question to the same agent as a typed question, with the same checks. Then it reads out a short text built from the checked answer. So a total said out loud still came from the database.

**Why not let the voice AI answer directly?**
Then the numbers would come from the voice model's own head, with no checks. Splitting the job lets the voice stay quick while the answer stays checked. The screen also keeps what was actually said aloud under the answer, so the two can be compared.

**How does it speak Arabic dialects?**
The voice model has no Arabic voices built in. So Atlas designs one per dialect (Gulf, Levantine, Egyptian, North African, Modern Standard) and per gender, from a written description and a sample script in that dialect. The rules for how to speak are written in the dialect itself, because the model follows them better that way. How close each voice sounds is up to the voice model, and they still need tuning by ear.

**How does the audio get through so quickly?**
WebRTC, the same technology as video calls in the browser. The browser and OpenAI's voice service exchange audio directly. The Atlas server only sets the call up, so the OpenAI key never reaches the browser.

**Is it reliable?**
Honestly, it is the newest and least tested part. Early test calls answered late. The likely cause was the browser going silent between words, which stalled the voice service; a fix is in but has not been confirmed on a live call yet.

**What is the face?**
A philosopher's bust, drawn in code as line art rather than an image file. It blinks and its mouth moves with Atlas's voice. In an empty chat it greets you with "Every answer, with its page."

---

## 4. "Did AI build this?"

**Did you write all this yourself?**
Be straight about it: I designed it, and an AI coding agent wrote most of the code. I used Claude Code, Anthropic's coding agent (model Claude Opus 5.5), in VS Code. I set the foundations first: the shapes of the data, the plugs between the parts, fake versions of each part for testing, and the rules (numbers from code, every fact sourced). Claude Code then split the rest into about 50 small jobs and ran them in parallel, each in its own copy of the project, merging each one only after its tests passed.

**So what did you actually do?**
The decisions are the product: what the AI is allowed to do, what code does instead, what gets checked, and what counts as a right answer. The coding agent wrote code to that plan. I steered it, reviewed it, and judged it against the test questions.

**What is a coding agent?**
An AI that works inside a project folder. It reads the code, writes files, runs the tests and fixes what fails, in a loop. The same idea as Atlas, aimed at programming instead of documents.

**How long did it take?**
I started on the evening of 28 October 2026. The core app (reading files, the agent and all its tools, the checks, the website and the test questions) took about 7 hours of logged work, finished the next morning. Voice calls, the free models, the Arabic interface, the document viewer and the rest came during 29 October.

**How do you know AI-written code works?**
Two layers:
- **About 1,900 automatic tests** that need no internet and cost nothing.
- **An exam of 21 real questions** against the sample documents, checked automatically against the known right answers. It includes the traps: broken files, a question the documents cannot answer, the planted instruction, a scanned page, an Arabic document. Latest result: 21 of 21.

**Why are there over 800 commits?**
Each small job got its own branch and was merged once its tests passed. That is a side effect of running many agents in parallel. Next time I would make fewer, larger ones.

---

## 5. Trust, privacy and cost

**Where does my data go?**
The files, the database and the app stay on the computer. To answer, the passages and page images it needs are sent to the AI provider. OpenAI's stated policy is that it does not train on API data by default. Gemini's free tier is different: Google may use what it is sent, so keep confidential files off it. With Ollama, nothing leaves the computer.

**Can the AI change or delete my files?**
No. It can only read. Its database queries are checked to be read-only before they run, and they run in a separate process with a time limit.

**How much does it cost?**
A fraction of a cent per question on Luna: the whole 21-question exam cost about 2 cents. Nothing on Gemini's free tier or Ollama. A voice call is 5 cents a minute. Every answer shows its own cost and time.

**How fast is it?**
The middle answer on the exam took about 7 seconds. Simple lookups take 3 to 6 seconds; a question that has to gather many dates can take 30 to 50.

**Is it always right?**
No AI system is. What Atlas does is make every answer checkable. Each fact has a source you can click: the PDF opens at the page with the sentence highlighted, or the spreadsheet opens with the rows marked. And when it cannot find something, it says so.

---

## 6. Arabic

**Does it really work in Arabic?**
Yes. Ask in Arabic and it answers in Arabic, and the whole interface flips to right-to-left. It never translates file names, item codes or numbers. It reads Arabic PDFs in the right order, which needed its own fix, because Arabic text can come out reversed when taken from a PDF. It also understands Arabic-Indic digits in spreadsheets.

**Can I ask in English about an Arabic document?**
Yes. Search by meaning works across languages. One test question asks in English about a decision recorded only in Arabic meeting minutes, and gets it right.

**Anything still in English?**
In Arabic mode, the answer warnings and the step-by-step trace are still in English.

---

## 7. Harder questions

**Why not just upload the files to ChatGPT?**
A general chatbot may or may not run code for the maths, and you cannot easily tell which numbers it calculated and which it wrote itself. In Atlas every number comes from code and is checked, every fact links to its page or rows, and it says "not found" instead of filling a gap. It also handles a folder of messy real files at once: broken PDFs, password-protected ones, a 10,000-row ledger, two versions of the same BOQ.

**Will this replace engineers or quantity surveyors?**
No. It replaces the hunting: it finds the clause, the rows or the total, and shows where they came from. Deciding what to do with that stays with people.

**What was the hardest part?**
Pick the one that was true for you. Good candidates:
- **Messy spreadsheets:** headers sitting under title rows, merged cells, total rows that get counted twice, two tables on one sheet, amounts written as "SAR 1.2M".
- **Arabic in PDFs** coming out in the wrong order.
- **The voice** answering late.

**What surprised you?**
That the small, cheap model was enough once the code did the heavy lifting.

**What would you add next?**
- OCR for scanned pages, cheaper than sending images
- a spending cap per question
- sign-in and several users (today it is one person on one computer)
- Word files (only PDF and Excel are read today)
- numbered markers in the answer text pointing to each source
- confirming voice calls live, and running the exam on the free models

**Could it work outside construction?**
The core (read a folder, look things up with tools, check every number and source) is not specific to construction. The AI's instructions, the sample documents and a few tools (BOQ arithmetic, comparing revisions) are. Swapping those is the main work.

---

## If you get stuck

- "I don't know, but here is how I would find out" is a good answer.
- Show instead of tell. Ask a question, then click a source.
- Questions that demo well:
  - "What is the total of each BOQ in the folder?"
  - "List all cost items above SAR 1 million in the BOQs." Then "Export that to Excel."
  - "What changed between BOQ_Phase1_Rev0.xlsx and BOQ_Phase1_Rev1.xlsx?"
  - "What is the load rating of the rooftop helipad?" (not in the files, so it says "not found")
  - Any question in Arabic.
