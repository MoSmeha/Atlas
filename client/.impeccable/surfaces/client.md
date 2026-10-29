---
version: 1
slug: "client"
primary_target: "client"
related_targets: []
---

# Atlas web client (the whole app)

Mode: Operate. Users: a mixed project team (PMs, quantity surveyors, engineers) and non-technical reviewers watching a shared laptop screen in a meeting room, daytime office light. Job: load a folder, ask a question, trust the answer at a glance, check it in one click, export the rows. Constraints: Mantine 9.7 theme object owns every colour, spacing and radius; one brand hue plus neutrals; colour only for warnings and errors; no hex in components; English UI; Arabic answers right to left.

## Direction contract

THESIS: The category standard, chat-with-your-documents, executed at the craft of Claude.ai (calm conversation column), Perplexity (numbered sources you can open) and Linear (crisp, dense, quiet chrome). It refuses the demo look: gradients, glowing AI sparkles, bubble chat, cards inside cards.

OWN-WORLD: Light theme on a near-white neutral ground with a second, slightly cooler neutral for the sidebar and top bar. One brand hue, a deep ink blue (Mantine custom 10-shade palette, primaryShade 6 to 7), spent only on the primary action, focus rings, selection, links, the cited-text highlight, the streaming caret, and the ring of the call avatar while Atlas speaks (the voice's streaming caret). Neutral badges for document type and ok status; yellow only for scanned and too-large, red only for corrupt and encrypted, gray for empty and skipped. System UI font stack (Segoe UI carries Arabic on Windows), one family for everything, tabular numerals in tables and figures, ui-monospace only for SQL and tool input. Type scale about 1.15: 12, 13, 15 body, 17, 20, 26. 4px spacing base. Radii 4/6/8, default 6. Hairline 1px borders instead of shadows; a soft offset shadow only on modals and menus. The call avatar is a philosopher's bust in graphite line work on white, like marble: no colour in the drawing itself.

STORY: The reviewer sees which files Atlas read and which it could not, asks in plain words, watches the answer stream, sees the exact rows and numbered sources, opens a source at its page or rows, expands "How I found this" to see each tool step, and exports the table. Or they press the phone and ask out loud, in English or in Gulf, Levantine, Egyptian, North African or Modern Standard Arabic: Atlas's face listens, looks up while it checks, and speaks the checked answer while the same answer lands in the thread with its rows and sources, with what it said aloud kept under it. The microphone beside the phone dictates a question into the box instead.

FIRST VIEWPORT: 52px top bar: "Atlas" wordmark left; right side, the model picker (Select) with the last answer's cost and time as a quiet text pair, then a Clear chat button. 300px left sidebar: folder path TextInput with a Load button, a compact dropzone line under it, then the document register (one row per file: type icon, name truncated with tooltip, document type badge, status badge when not ok, pages or sheets in dimmed text), an indexing progress line while loading, and a "1 file skipped" line at the foot. Main: a centred 760px column. With nothing asked yet it holds a one-line heading naming the folder and five suggested questions as full-width quiet rows. Once asked, each turn is the question set as a heading-weight line (a spoken one ends with a dimmed microphone), then the streaming markdown answer, the result table (sticky header, export menu), numbered source rows, "Said aloud" under a spoken answer, and a collapsed "How I found this". The composer docks at the bottom of the column: multiline Textarea with a dictation microphone and a Send icon button that becomes Stop while an answer streams; with the box empty the Send slot is a filled ink phone that starts a voice call. While a call is open the call card takes the composer's place, in the composer's own white 8px frame with its Border-gray edge: Atlas's bust (72px, 56px on a phone), the status line, the call's clock and cost, live "You" and "Atlas" captions showing the newest words, the voice picker (English; Arabic dialects with their own names), Stop answer while a question runs, mute, and End call.

FORM: Category standard (canon), chosen by the user over the rolled direction; seed key 7725660b. Quality bar: Claude.ai, Perplexity, Linear.

Signature interaction: the answer streams in with a brand-blue caret, then the sources and table settle in below with one 180ms fade-and-rise; clicking a numbered source opens the viewer at that page with the quoted text highlighted, or at the sheet scrolled to the cited rows with those rows tinted. In a call, the bust's mouth moves with Atlas's measured voice while its ring holds the caret's ink.

Motion grammar: 150 to 200ms ease-out on state changes only (collapse, fade-in of finished parts, hover). Skeleton rows while tables and the register load. No page-load choreography. One exception, approved by the user on 2026-10-29: inside the call avatar, and only while a call is open, gentle continuous motion (blinks every few seconds, a slow breath, brows up while the user speaks, eyes up while a question runs, the mouth following Atlas's voice, the ring dashed and slowly turning while it checks and its weight following the user's voice while it listens); a still pose per state under reduced motion, and no motion in a hidden tab.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
