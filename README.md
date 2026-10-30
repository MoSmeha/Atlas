<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/logo-dark.svg">
    <img src="docs/images/logo-light.svg" alt="The Atlas logo: Atlas's face in front of a spreadsheet and a PDF" width="128">
  </picture>
</p>

<h1 align="center">Atlas</h1>

<p align="center"><b>Ask your project documents a question. Get an answer you can check.</b></p>

Atlas reads a folder of PDFs and Excel files (contracts, bills of quantities, specifications, meeting minutes) and answers questions about them in English or Arabic. Every answer shows where it came from, down to the page or the spreadsheet row.

![Atlas answering "What is the total of each BOQ?" with a table and its sources](docs/images/answer.png)

## Contents

1. [What Atlas does](#what-atlas-does)
2. [Check every answer](#check-every-answer)
3. [Talk to Atlas](#talk-to-atlas)
4. [Pick the AI model](#pick-the-ai-model)
5. [How it works](#how-it-works)
6. [Tech stack](#tech-stack)
7. [Run it yourself](#run-it-yourself)
8. [Good to know](#good-to-know)

## What Atlas does

<p align="center"><img src="docs/images/features.svg" alt="Atlas's six features on a wheel: reads whole folders, a source for every fact, exact numbers from code, compares revisions, voice calls and dictation, English and Arabic" width="760"></p>

- **Reads whole folders.** Every PDF and spreadsheet, scanned pages included. Files it cannot read (damaged, password protected, empty) are named, never skipped quietly.
- **A source for every fact.** Each one links to its page or rows; one click opens it, highlighted.
- **Exact numbers from code.** "Above SAR 1 million" checks every row, not a sample, and the list downloads as Excel or CSV. When the files do not say, Atlas says so and shows every place it looked.
- **Compares revisions.** What was added, removed and changed between two revisions of a bill of quantities, and how the total moved.
- **Voice calls and dictation.** Ask out loud and hear the checked answer back, or dictate a question and edit it before sending.
- **English and Arabic.** Atlas answers in the language you ask in. The top bar switches the interface between English and Arabic, and light and dark.

## Check every answer

Click a source and the PDF opens at the right page, with the sentence highlighted. A spreadsheet opens with the rows the answer used marked.

![A PDF opened at page 37 with the sentence highlighted](docs/images/pdf-source.png)

## Talk to Atlas

Press the phone button and talk to Atlas as you would on a call, in English or in your own Arabic dialect.

<img src="docs/images/voice.png" alt="A voice call: Atlas's face, what you said, what Atlas said, and the answer on screen" width="720">

- **English and five Arabic dialects** (Gulf, Levantine, Egyptian, North African, Modern Standard), female or male.
- **Pick the voice** from the arrow beside the call button.
- **Checked answers.** The voice reads out the checked answer and never works out numbers itself.
- **Prefer typing?** The microphone button turns speech into a question you can edit before sending.

## Pick the AI model

Pick the model, and how long it thinks, from the top bar. Each answer shows what it cost and how long it took.

| Model | Best for | Cost |
| --- | --- | --- |
| GPT-6 Luna | Everyday questions | Lowest |
| GPT-6.1 Sol | A balance of depth and cost | Medium |
| GPT-6 Astra | The hardest questions | Highest |

### Or use it for free

| Free option | How to set it up | Good to know |
| --- | --- | --- |
| Gemini's free tier | Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and add `GEMINI_API_KEY=` to `.env` | Daily limit. Google may use what it is sent, so keep confidential files off it |
| A model on your computer | Install [Ollama](https://ollama.com), then run `ollama pull qwen3:14b` and `ollama pull bge-m3` | Nothing leaves your computer. Needs a graphics card with 6 GB or more, or a Mac with Apple silicon and 16 GB or more |

Free models sit in the same picker. Voice calls still use OpenAI.

## How it works

An AI model and ordinary code share the work. The model reads your question and decides what to look up. Code does the looking up: it searches the files, reads pages and adds up table rows. The model then writes the answer from what the code found. Before you see it, Atlas checks that every number in the answer appears in those results and that every source points to a real page or row. An answer that fails goes back to the model to fix.

```mermaid
flowchart LR
  ask(["You ask a question"]) --> plan["The AI decides<br/>what to look up"]
  plan --> work["Code does the work<br/>in your files: search,<br/>read pages, add up rows"]
  work --> check{"Atlas checks every<br/>number and source"}
  check -- "something is off" --> plan
  check -- "all good" --> answer(["Answer with<br/>its sources"])
```

A voice call takes the same path: the voice only listens and speaks, and the question it hears is answered and checked like a typed one.

### In the code

```mermaid
flowchart TD
  files[/"PDF and Excel files"/] -->|"on load and on change"| readers["Readers<br/>mupdf, exceljs"]
  readers --> index[("SQLite index per folder<br/>tables as SQL tables<br/>keyword + embedding search")]

  ask(["POST /api/chat<br/>typed, or from a voice call"]) --> agent["Agent loop<br/>OpenAI, Gemini or Ollama"]
  agent -->|"tool call"| tools["Tools<br/>search_documents<br/>read_pages, query_tables<br/>calculate, ..."]
  tools <--> index
  tools -->|"result, with an id"| agent
  agent -->|"submit_answer"| checks["Checks<br/>numbers from tool results<br/>sources exist"]
  checks -->|"fail: back to the model, max 2"| agent
  checks -->|"pass"| reply(["Streamed to the web app<br/>answer, table, sources"])
```

Each step has its own chart in [docs/TECHNICAL.md](docs/TECHNICAL.md).

## Tech stack

| Part | Built with |
| --- | --- |
| Web app | React, Vite, Mantine, TypeScript |
| Server | Node.js 24, Fastify, TypeScript |
| AI | OpenAI: GPT-6 models for answers, GPT-Live for voice calls, gpt-transcribe for dictation, text-embedding-3-small for search by meaning. Free instead: Gemini (Google's free tier) or a local model through Ollama |
| Reading files | mupdf for PDFs, exceljs for Excel |
| Storage | SQLite on your computer, one file per folder, with keyword search |
| Data shapes | Zod, shared by the server and the web app |
| Tests | Vitest: about 1,890 tests that need no key and no network |

## Run it yourself

| Step | Windows (PowerShell) | macOS / Linux |
| --- | --- | --- |
| 1. Install Node.js 24 | [nodejs.org](https://nodejs.org/en/download) | [nodejs.org](https://nodejs.org/en/download), or Homebrew (see [On a Mac](#on-a-mac)) |
| 2. Switch on pnpm | `corepack enable` | `corepack enable` |
| 3. Get the code | `git clone https://github.com/MoSmeha/Atlas.git; cd Atlas` | `git clone https://github.com/MoSmeha/Atlas.git && cd Atlas` |
| 4. Install | `pnpm install` | `pnpm install` |
| 5. Add a model key | `Copy-Item .env.example .env`, then set `OPENAI_API_KEY=`, or `GEMINI_API_KEY=` to use it free | `cp .env.example .env`, then set `OPENAI_API_KEY=`, or `GEMINI_API_KEY=` to use it free |
| 6. Start | `pnpm dev`, then open http://localhost:5173 | `pnpm dev`, then open http://localhost:5173 |

A sample project, a fictional tower in Riyadh, loads by itself. To use your own files, click the folder button in the sidebar and choose a folder, type its path, or drop files on the sidebar.

### On a Mac

The same steps, with what a Mac asks along the way. Open Terminal (Applications, then Utilities), and press Return after each command.

1. **Install Node.js 24.** The simplest way is the macOS installer at [nodejs.org](https://nodejs.org/en/download): pick version 24. With [Homebrew](https://brew.sh) instead, run these three lines. Homebrew keeps `node@24` off the path, and the second line puts it there:

   ```sh
   brew install node@24
   echo "export PATH=\"$(brew --prefix node@24)/bin:\$PATH\"" >> ~/.zshrc
   source ~/.zshrc
   ```

   `node --version` should now print a version starting with `v24`.
2. **Switch on pnpm:** `corepack enable`. If it says permission denied, run `sudo corepack enable` and type your Mac password. If it says command not found, run `npm install -g pnpm` instead.
3. **Get the code:** `git clone https://github.com/MoSmeha/Atlas.git && cd Atlas`. On a Mac without developer tools, this asks to install the "command line developer tools": click Install, wait for it to finish, then run the line again.
4. **Install:** `pnpm install`. If it asks to download pnpm, type `Y`.
5. **Add a model key:** `cp .env.example .env`, then `open -e .env` opens the file in TextEdit. Paste your key after `GEMINI_API_KEY=` (free) or `OPENAI_API_KEY=`, and save.
6. **Start:** `pnpm dev`, then open http://localhost:5173 in Safari, Chrome or Edge. Press Control+C in Terminal to stop.

The first voice call or dictation asks for the microphone. Allow it in the browser, and in System Settings, Privacy & Security, Microphone if macOS asks too.

To answer for free on the Mac itself, Ollama runs on Apple silicon. `qwen3:14b` needs 24 GB of memory; with 16 GB, run `ollama pull qwen3:8b` in its place.

## Good to know

- **Your files stay on your computer.** The app and its index run locally. The AI runs at OpenAI or Google (Gemini), so the passages and page images it needs are sent there; with Ollama nothing leaves the computer.
- **Cost.** A question on Luna costs a fraction of a cent, and nothing on Gemini's free tier or Ollama. A voice call costs $0.05 a minute.
- **File types.** PDF and Excel (`.pdf`, `.xlsx`, `.xlsm`). Other files are listed and skipped.
- **Sample documents are fictional.** `samples/expected.json` holds their right answers.
- **Licence.** mupdf is AGPL-3.0, so this repository has no permissive licence file.
- **For developers.** Settings, the eleven tools, edge cases, project layout, tests and how to add a tool are in [docs/TECHNICAL.md](docs/TECHNICAL.md). Design notes are in [docs/NOTE.md](docs/NOTE.md), time spent in [docs/TIMELOG.md](docs/TIMELOG.md), and the design system in [client/DESIGN.md](client/DESIGN.md).
