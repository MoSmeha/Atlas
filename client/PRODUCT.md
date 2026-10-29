# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A mixed project team at an architecture and engineering firm in Saudi Arabia: project managers, quantity surveyors and engineers. Each of them opens a folder of project documents (contracts, BOQs, specifications, schedules, minutes, drawings) and asks questions they would otherwise answer by reading and adding up by hand: which cost items are above SAR 1 million, what the scope of a contract is, which dates and deliverables are due, what changed between two BOQ revisions.

The first audience is the firm's hiring reviewers, who are not software engineers. They load their own folder of PDFs and Excel files and ask questions nobody has seen before, live.

## Product Purpose

Atlas reads every PDF and Excel file in a folder and answers natural-language questions about them, with each fact tied to its source: file and page for PDFs, file, sheet and rows for spreadsheets. Success means someone can trust an answer at a glance and check it in one click.

## Positioning

Numbers are never typed by the model: totals, thresholds and comparisons are computed by SQL or a calculator over every row, and the answer attaches the exact rows. Every claim links to the page or rows it came from. When the documents do not say, Atlas says "not found" and names the files it could not read, instead of guessing.

## Operating Context

- Runs locally on the user's machine (`pnpm dev`), browser at localhost. One folder loaded at a time, by typing its path or dropping files.
- Documents are mixed English and Arabic; questions may be in either language and answers come back in the question's language. Arabic answers read right to left.
- Amounts appear in SAR and other currencies (USD, EUR), sometimes written as "SAR 1.2M" or with Arabic-Indic digits.
- Folders contain messy files on purpose: corrupt and password-protected PDFs, empty workbooks, scanned pages, 300-page PDFs, 10,000-row sheets, unsupported files such as .docx.
- A live session: answers stream in while the agent works; the user can stop a question, read the tool trace ("How I found this"), export a result table to Excel or CSV, and open a source at its page or rows.

## Capabilities and Constraints

- Stack is fixed: React with Vite, Mantine 9.7 (core, hooks, notifications, dropzone), @tabler/icons-react, react-pdf for the viewer, TanStack Query for server state.
- All colours, spacing and radii come from the Mantine theme object. One brand hue plus neutrals; colour is used only for warnings and errors. No hex values in components.
- The interface is in English or Arabic, switched from the top bar and remembered (2026-10-29). Arabic mirrors the whole layout right to left. Answers follow the question's language. Figures stay in Western digits in both, matching the documents.
- Light and dark themes, switched from the top bar and remembered; light is the default for the daytime meeting room.
- File statuses: ok, empty, corrupt, encrypted, scanned, too_large, skipped. Document types: Contract, BOQ, Specification, Schedule, Drawing, Minutes, Correspondence, Other.
- The model picker shows the cost and time of the last answer.

## Brand Commitments

Atlas is a fresh identity of its own. It uses no firm logo, colours or name style, and never imitates a real company.

Visual direction (chosen 2026-10-28): the category standard for chat-with-your-documents tools, executed at the craft level of Claude.ai, Perplexity and Linear. Conventions are embraced, not dressed up.

## Evidence on Hand

Generated sample documents for an invented project (a mixed-use building in Riyadh) under `samples/`, with ground truth in `samples/expected.json`. No real company documents, customers, testimonials or metrics exist; none may be invented.

## Product Principles

1. Trust is shown, not claimed: every answer carries its sources and its working.
2. Plain language for people who are not engineers; no jargon in labels or errors.
3. A bad file never blocks the rest; problems are named specifically, with what to do next.
4. Numbers are exact and attributed; nothing is rounded or estimated without saying so.
5. Fast to a first answer: the question box waits at the foot of the first screen, and indexing shows a visible progress line. The empty conversation is Atlas's face and its line only; suggested questions were dropped from it at the owner's request (2026-10-29).

## Accessibility & Inclusion

Right-to-left rendering for the Arabic interface, Arabic answers and Arabic text inside tables and sources; file names, paths and codes keep their own direction inside Arabic sentences. Both themes hold body text at 4.5:1 or better. Readable at laptop sizes in a meeting room, where reviewers watch a shared screen.
