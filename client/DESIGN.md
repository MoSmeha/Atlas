---
name: Atlas
description: Ask a folder of project PDFs and spreadsheets in plain words; every answer carries its rows and its sources.
colors:
  ink: "#2a488b"
  ink-wash: "#f1f6fe"
  ink-tint: "#e0eafb"
  ink-selection: "#c2d5f6"
  ink-mark: "#9cb8eb"
  ink-deep: "#172953"
  page-ground: "#fcfcfd"
  white: "#ffffff"
  hover-ground: "#f6f8fb"
  chrome-ground: "#f1f4f9"
  quiet-chip: "#e6eaef"
  hairline: "#d8dde2"
  border: "#c3c8ce"
  faint-glyph: "#9da2a9"
  dimmed: "#626871"
  secondary-text: "#4a505a"
  soft-text: "#30363f"
  body-text: "#151a21"
  amber-wash: "#fff9e2"
  amber-tint: "#fef0c3"
  amber-rule: "#fdde93"
  amber-icon: "#a46311"
  amber-text: "#6e4015"
  red-wash: "#fff3f3"
  red-tint: "#ffe3e1"
  red-rule: "#ffc6c3"
  red-icon: "#b32322"
  red-error: "#971b1a"
  red-text: "#7a1615"
typography:
  display:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, BlinkMacSystemFont, \"Helvetica Neue\", \"Noto Sans\", \"Noto Sans Arabic\", \"Geeza Pro\", Tahoma, Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, BlinkMacSystemFont, \"Helvetica Neue\", \"Noto Sans\", \"Noto Sans Arabic\", \"Geeza Pro\", Tahoma, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  title:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, BlinkMacSystemFont, \"Helvetica Neue\", \"Noto Sans\", \"Noto Sans Arabic\", \"Geeza Pro\", Tahoma, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.5
  wordmark:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, BlinkMacSystemFont, \"Helvetica Neue\", \"Noto Sans\", \"Noto Sans Arabic\", \"Geeza Pro\", Tahoma, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.015em"
  body:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, BlinkMacSystemFont, \"Helvetica Neue\", \"Noto Sans\", \"Noto Sans Arabic\", \"Geeza Pro\", Tahoma, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  body-arabic:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, BlinkMacSystemFont, \"Helvetica Neue\", \"Noto Sans\", \"Noto Sans Arabic\", \"Geeza Pro\", Tahoma, Arial, sans-serif"
    fontSize: "16.05px"
    fontWeight: 400
    lineHeight: 1.75
  body-sm:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, BlinkMacSystemFont, \"Helvetica Neue\", \"Noto Sans\", \"Noto Sans Arabic\", \"Geeza Pro\", Tahoma, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, BlinkMacSystemFont, \"Helvetica Neue\", \"Noto Sans\", \"Noto Sans Arabic\", \"Geeza Pro\", Tahoma, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0"
  mono:
    fontFamily: "ui-monospace, \"Cascadia Mono\", \"Cascadia Code\", Consolas, \"SF Mono\", Menlo, \"Liberation Mono\", monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  xs: "4px"
  md: "6px"
  lg: "8px"
  full: "50%"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    height: "36px"
  button-default:
    backgroundColor: "{colors.white}"
    textColor: "{colors.body-text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    height: "30px"
  button-default-hover:
    backgroundColor: "{colors.hover-ground}"
  button-subtle:
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  composer:
    backgroundColor: "{colors.white}"
    textColor: "{colors.body-text}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "4px 4px 4px 12px"
  composer-send:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    size: "34px"
  composer-disabled:
    backgroundColor: "{colors.hover-ground}"
  badge-neutral:
    backgroundColor: "{colors.quiet-chip}"
    textColor: "{colors.soft-text}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    height: "20px"
    padding: "0 6px"
  badge-warning:
    backgroundColor: "{colors.amber-tint}"
    textColor: "{colors.amber-text}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    height: "20px"
  badge-error:
    backgroundColor: "{colors.red-tint}"
    textColor: "{colors.red-text}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    height: "20px"
  suggested-question:
    textColor: "{colors.soft-text}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: "12px 8px"
  suggested-question-hover:
    backgroundColor: "{colors.hover-ground}"
    textColor: "{colors.body-text}"
  source-row:
    textColor: "{colors.soft-text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xs}"
    padding: "6px 8px"
  source-row-hover:
    backgroundColor: "{colors.hover-ground}"
  source-row-active:
    backgroundColor: "{colors.ink-wash}"
  source-number:
    backgroundColor: "{colors.quiet-chip}"
    textColor: "{colors.soft-text}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    width: "24px"
    height: "18px"
  source-number-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
  result-table-frame:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.md}"
  result-table-header:
    backgroundColor: "{colors.hover-ground}"
    textColor: "{colors.dimmed}"
    typography: "{typography.body-sm}"
  trace-toggle:
    textColor: "{colors.secondary-text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xs}"
    padding: "4px 6px"
  answer-notice:
    backgroundColor: "{colors.hover-ground}"
    textColor: "{colors.body-text}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  error-notice:
    backgroundColor: "{colors.red-wash}"
    textColor: "{colors.red-text}"
    rounded: "{rounded.md}"
  warning-notice:
    backgroundColor: "{colors.amber-wash}"
    textColor: "{colors.amber-text}"
    rounded: "{rounded.md}"
  top-bar:
    backgroundColor: "{colors.chrome-ground}"
    height: "52px"
  sidebar:
    backgroundColor: "{colors.chrome-ground}"
    width: "300px"
    padding: "16px"
  sheet-cited-row:
    backgroundColor: "{colors.ink-wash}"
  sheet-cited-row-number:
    backgroundColor: "{colors.ink-tint}"
    textColor: "{colors.ink-deep}"
  composer-call:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    size: "34px"
  composer-dictate:
    rounded: "{rounded.md}"
    size: "34px"
  call-card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.lg}"
    padding: "12px"
  call-avatar:
    backgroundColor: "{colors.hover-ground}"
    rounded: "{rounded.full}"
    size: "72px"
  call-avatar-phone:
    size: "56px"
  call-control:
    rounded: "{rounded.md}"
    size: "34px"
  call-control-phone:
    size: "40px"
  call-caption:
    textColor: "{colors.dimmed}"
    typography: "{typography.body-sm}"
  call-caption-latest:
    textColor: "{colors.body-text}"
  call-caption-speaker:
    textColor: "{colors.dimmed}"
    typography: "{typography.label}"
    width: "44px"
  voice-picker:
    width: "208px"
  said-aloud-label:
    textColor: "{colors.dimmed}"
    typography: "{typography.label}"
  said-aloud:
    textColor: "{colors.soft-text}"
    typography: "{typography.body-sm}"
---

# Design System: Atlas

## Overview

**Creative North Star: "The Quiet Register"**

Atlas is the category standard for chat-with-your-documents tools, built to the craft of Claude.ai's calm reading column, Perplexity's numbered sources and Linear's dense, quiet chrome. The owner chose the conventions on purpose and the build doesn't dress them up. A near-white page holds one 760px conversation column. A slightly cooler neutral frames it: a 52px top bar and a 300px document register on the left. Everything is drawn with 1px hairlines on flat grounds. The one ink blue appears only where the reader acts or where the system points at evidence.

Density follows Linear more than a marketing page. Sidebar rows are 13px names over 12px meta. Tables run at 13px with tabular figures. The answer reads at 15px with a 75ch measure. Every number lines up digit under digit (register meta, result tables, source places, usage line, sheet row numbers). Motion only marks state changes: a hover tint, a chevron turning, and the finished answer's table and sources settling in once with a short fade-and-rise. One exception, approved by the owner on 2026-10-29: during a voice call, Atlas's face (a philosopher's bust in graphite line work) moves continuously, and nothing else does.

The system refuses the demo look named in the direction contract: gradients, glowing AI sparkles, bubble chat and cards inside cards. The question is a heading-weight line, not a bubble. The answer is plain prose on the page ground, not a card.

**Key Characteristics:**
- One brand hue (deep ink blue, shade 7 of a 10-step ramp) for actions, focus, selection, links, citations, the streaming caret and the call avatar's ring while Atlas speaks
- Two neutral grounds: near-white page and cooler chrome
- 1px hairline borders instead of shadows on every resting surface
- One system UI family for everything (Segoe UI carries Arabic on Windows); monospace only for SQL and tool input
- Tabular numerals wherever figures appear
- Logical properties throughout, so Arabic answers, quotes and arrows mirror correctly
- Continuous motion lives only in the call avatar, and only while a call is open

## Colors

A cool, nearly colourless palette: blue-tinted grays carry the structure, one ink blue carries meaning, and amber and red appear only when a file or request has a problem.

### Primary
- **Atlas Ink** (`ink`): filled primary buttons (Load, Send, Stop), focus outlines (2px, 2px offset), the input caret, links, the active source number, the 3px streaming caret at the end of a growing answer, and the call avatar's 1.5px ring while Atlas speaks (the voice's streaming caret). The composer's phone, the dictation check mark and End call are primary actions and take the filled ink too.
- **Ink Wash** (`ink-wash`): the ground of the source row or register row whose file is open in the viewer, and of cited rows in the sheet viewer.
- **Ink Tint** (`ink-tint`): `<mark>` highlights and the row-number cell of a cited sheet row, a step deeper than the row itself.
- **Ink Selection** (`ink-selection`): text selection ground, with Ink Deep (`ink-deep`) text.
- **Ink Mark** (`ink-mark`): mixed at 45% over the rendered PDF page so the printed words of a cited passage show through.

### Tertiary (status only)
- **Amber** (`amber-tint` ground, `amber-text` text, `amber-wash`/`amber-rule`/`amber-icon` in notices): files Atlas read only partly (Scanned, Too large) and warning notices. The badge text reads at 7.7:1.
- **Signal Red** (`red-tint` ground, `red-text` text, `red-wash`/`red-rule`/`red-icon` in notices): files Atlas could not open (Damaged, Password protected) and error notices. `red-error` is the inline error text under fields and the dropzone.

### Neutral
- **Page Ground** (`page-ground`): the conversation background, a step lighter than every gray. The docked composer strip reuses it so turns scroll under it cleanly.
- **White** (`white`): surfaces that hold content you read: composer box, result-table frame, PDF page, sheet stage, the open sheet's tab. On the chrome ground, a register row also lifts to white under the pointer.
- **Hover Ground** (`hover-ground`): the hover tint on rows and quiet controls, sticky table headers, the disabled composer and the "not found" notice ground.
- **Chrome Ground** (`chrome-ground`): the top bar, the sidebar, the viewer stage behind a PDF page, sheet headers, the row-number gutter and the strip of sheet tabs.
- **Quiet Chip** (`quiet-chip`): neutral badges and source numbers. Also the hairline between suggested questions and under the viewer header.
- **Hairline** (`hairline`): table frames, quote rules, the trace rail, the PDF page edge and the sheet gutter rule.
- **Border** (`border`): input and composer borders, the default control border, scrollbar thumbs and trace markers.
- **Dimmed** (`dimmed`): meta text, placeholders, column headers, file-kind icons and list markers (5.1:1 on chrome).
- **Body Text** (`body-text`): body and heading text. `soft-text` and `secondary-text` step down for row text and quiet controls. `faint-glyph` is for trailing arrows and empty-cell dashes only.

### Named Rules
**The Ink Is Evidence Rule.** Ink blue marks only what you can act on and where an answer points (primary action, focus, link, selection, active citation, cited text, streaming caret, and the call avatar's ring while Atlas speaks). The wordmark, headings, icons and the drawing of the bust stay neutral.

**The Colour Means Trouble Rule.** Amber and red mean a file or request has a problem, nothing else. Document types and the ok state use neutral badges, empty and skipped files use gray, and "not found" answers use a neutral notice.

## Typography

**Display Font:** Segoe UI (with system-ui, -apple-system, Helvetica Neue, Noto Sans, Noto Sans Arabic, Geeza Pro, Tahoma, Arial)
**Body Font:** the same stack
**Label/Mono Font:** ui-monospace (with Cascadia Mono, Consolas, SF Mono, Menlo), for SQL and tool input in the trace only

**Character:** One native family at about a 1.15 ratio (12, 13, 15, 17, 20, 26). It looks like the user's own operating system, so the documents and figures carry the voice. Weight does the ranking: 400 for reading, 600 for names, labels and headings, and 700 only on the wordmark.

### Hierarchy
- **Display** (600, 26px, 1.25, -0.01em, balanced wrap): the one empty-state heading that names the folder or the state ("Ask about Riyadh Tower").
- **Headline** (600, 20px, 1.35): each question at the top of its turn, `dir="auto"` so Arabic questions set right to left.
- **Title** (600, 17px, 1.5): modal titles and headings inside an answer. The wordmark uses the same size at 700 with -0.015em tracking.
- **Body** (400, 15px, 1.55, max 75ch): answer prose, suggested questions, composer text and empty-state lines (65ch). Arabic answers set at 1.07x (about 16px) with 1.75 line height.
- **Body small** (400, 13px, 1.45): sidebar names, source rows, tables, trace steps, form labels (600) and the usage line.
- **Label** (600, 12px, sentence case, no tracking): badges, source numbers, the "Sources" list heading, sheet column letters and row numbers. Dimmed 12px/400 is the meta line.

### Named Rules
**The Tabular Figures Rule.** Every place a number appears sets `font-variant-numeric: tabular-nums`. Numeric table columns align right and never wrap.

**The Sentence Case Rule.** Labels and badges are sentence case at zero tracking. The build has no uppercase or letterspaced text.

## Layout

Fixed app frame: a 52px top bar, a 300px navbar (16px padding) that collapses behind a burger below Mantine's `sm` breakpoint (48em), and a main area holding a centred column of 760px plus 16px gutters each side. The column's content stack has 32px top and 24px bottom padding with 24px between turns. Inside a turn, parts are 16px apart. The composer docks with `position: sticky` at the column's bottom edge on the page ground, with a 16px foot.

Spacing runs on an 8/12/16/24/32 scale (`xs` to `xl`). Tight inner rhythm uses 2, 4 and 6px steps: 2px between a name and its meta, 4px between badges and trace lines, and 6px for row padding and stacked label-to-field gaps. Sidebar rows are 6px tall-padded two-line items. Suggested questions are full-width rows (12px by 8px) separated by hairlines. Source rows bleed their hover ground 8px past the column edge so their text lines up with the prose. Result tables scroll inside their frame up to `min(28rem, 60dvh)`. Below `xs` (36em), a source's place always drops under its name, and the cost-and-time pair moves from the top bar to the composer's hint line.

During a voice call the call card takes the composer's docked place at the same width. Inside it, 12px padding and 12px gaps: the avatar and a text block side by side, then a control row under a 1px Quiet Chip rule (voice picker at the start, actions at the end). Below `xs` the avatar drops to 56px, controls grow to 40px, the picker takes the row's remaining width so the controls stay on one line, only the latest caption shows, and the standing hint under the card is hidden.

Content widths inside the viewer cap at 560 to 600px for notes and states. The PDF page centres on the chrome stage with 16px padding, and the sheet runs edge to edge on white like a grid in Excel. A workbook opened whole keeps its sheet tabs along the viewer's foot, as Excel does.

## Elevation & Depth

Flat, with tonal layering. Resting surfaces separate by ground (page, chrome, white) and 1px hairlines, never by shadow. Shadows are reserved for things that float above the page: modals, menus, popovers, comboboxes and the PDF page sitting on its stage. They carry an ink tint (`rgba(21, 26, 33, a)`), a downward offset and a soft negative-spread blur.

### Shadow Vocabulary
- **Page** (`box-shadow: 0 1px 2px rgba(21,26,33,0.06)`): the rendered PDF page on the viewer stage.
- **Overlay** (`box-shadow: 0 6px 16px -4px rgba(21,26,33,0.14), 0 2px 4px rgba(21,26,33,0.05)`): menus, popovers, the model picker dropdown.
- **Modal** (`box-shadow: 0 12px 32px -8px rgba(21,26,33,0.2), 0 4px 8px rgba(21,26,33,0.06)`): the source viewer and confirmation modals, over a 32% overlay.

### Named Rules
**The Hairline Not Shadow Rule.** A surface that sits in the page gets a 1px border and no shadow. A shadow means the surface floats above the page.

## Shapes

Small, even corners on a 4/6/8 scale, with 6px as the default. Chips, source numbers, `<mark>` and hover rows take 4px. Buttons, inputs, menus, notices and the result-table frame take 6px. The composer and modals take 8px. The PDF page takes 4px, so it reads as paper. Only the trace markers (18px circles) and the call avatar's medallion are round. Borders are always 1px. The trace rail is a 1px line that turns dashed while a step runs, and the avatar's ring follows the same rule: dashed (4 on, 5 off) while a question runs. Refused or unfinished markers have dashed rings. Quotes are set off by a 1px rule on their reading side (`border-inline-start`), so they mirror in Arabic. The quote rule is a quiet hairline in `hairline` gray, not a coloured stripe.

## Components

### Buttons
Mantine defaults, tuned small and quiet.
- **Shape:** gently rounded (6px).
- **Primary:** Atlas Ink fill, white text, size `sm` (36px). Used once per region: Load in the sidebar, Send/Stop in the composer. Loading shows the dots loader.
- **Default:** white with a Border-gray 1px edge and Body Text, size `xs` (30px). Used for Export, Clear chat, Try again and Ask again.
- **Subtle:** no ground, ink text, compact sizes. Used for "Show N more", "Ask again" after a stop, and viewer toolbar controls.
- **Icon buttons:** subtle gray by default (`lg`). The composer's Send is a 34px filled ink square that becomes a filled Stop square while an answer streams. With the box empty, the same slot is a filled ink phone that starts a voice call.
- **Focus:** a 2px ink outline at 2px offset on every focusable element.

### Chips (badges)
- **Style:** 20px tall, 6px side padding, 4px corners, 12px/600 sentence case. Neutral badges have a Quiet Chip ground and Soft Text. Amber and red badges have a shade-1 ground, shade-9 text and a 12px Tabler status icon.
- **State:** status badges show only when a file is not ok, and are focusable so the reason shows in a tooltip.

### Cards / Containers
- **Corner Style:** 6px (result table, notices), 8px (composer, modals).
- **Background:** white for content frames, Hover Ground for the neutral "not found" notice, and the shade-0 wash with a shade-2 border for error and warning alerts.
- **Shadow Strategy:** none at rest (see Elevation & Depth).
- **Border:** 1px `hairline` or `border` gray.
- **Internal Padding:** 12px by 16px for notices. Tables run flush in their frame.

### Inputs / Fields
- **Style:** Mantine TextInput with a 1px Border-gray edge, 6px corners, a white ground and a dimmed placeholder. Field labels sit above at 13px/600.
- **Composer:** an unstyled autosizing Textarea (1 to 8 rows, 15px) inside a white 8px-radius box with a 1px Border-gray edge, plus a dimmed 12px hint line under it.
- **Focus:** the composer's border turns ink over 150ms. Other fields take the global 2px ink outline.
- **Error / Disabled:** errors are 12px `red-error` text under the field with `role="alert"`. A disabled composer turns Hover Ground with a not-allowed cursor.
- **Dictation:** a 34px subtle gray microphone sits before the Send slot (a small gray loader while the words are written down). While it records, the text area gives its place, at the same height, to five still level bars (3px wide, 6, 11, 16, 11 and 6px tall, 2px apart) that sit in `border` gray and darken to `secondary-text` while the microphone hears speech, one 150ms colour change each way and nothing moving, a dimmed 15px "Listening" and a dimmed 13px tabular timer. The controls become a subtle gray Cancel and a filled ink check mark that writes the words into the box. Esc cancels. The hint line says what to do.
- **Voice problems:** a blocked microphone, a call or dictation that could not start, or a failed transcription shows on the composer's hint line as 12px `red-error` text with `role="alert"`, next to the controls that retry it; why a call ended (silence, the length limit, a dropped connection) shows there in dimmed text. Neither floats over the controls, and both clear after 20 seconds, on typing, or on the next call or dictation.

### Navigation
- **Top bar:** Chrome Ground, 52px. Left: the "Atlas" wordmark in neutral ink at 17px/700. Right: the model picker (Select), the dimmed tabular cost-and-time pair ("$0.042 · 14.2 s", details in a tooltip), and a default Clear chat button.
- **Sidebar:** Chrome Ground. From the top: a folder path field with Load, a one-line dashed dropzone, the "Documents" register with a dimmed file count, a 3px progress line while indexing, and a collapsible "N files skipped" foot. On mobile it collapses behind a burger.

### Document Register Row
Two lines per file. Line one: a dimmed 18px Tabler outline file-kind icon and a 13px name, truncated, with the full path in a tooltip. Line two: dimmed 12px tabular meta ("4 sheets, 4 tables") left, and the type badge plus any status badge right. Rows arrive with a 180ms 2px rise.

The whole row opens the file in the viewer. Its ground bleeds 8px past the text, lifts to white under the pointer, and takes the Ink Wash while the file is open. The focus ring sits inside the row, so the list's edge never clips it. The status badge stays above the row's button, so its reason still shows on hover and focus.

### Numbered Sources
A labelled ordered list of quiet full-width rows: a 24px by 18px tabular number chip, a file-kind icon, the bold name with its dimmed place (page, sheet and rows), an optional two-line quote behind an inline-start hairline, and a trailing open icon that darkens on hover. The open source turns Ink Wash with a filled ink number. Opening one shows the viewer at that page with the quote washed in ink, or at the sheet with the cited rows tinted.

### Viewer
A 1040px modal (full screen on a phone): the file's icon, name and place in the header, a control bar under a hairline, and a stage that scrolls. Opened from a source, it starts at the cited page or rows and offers a way back to them. Opened from the register, it shows the whole file. A PDF starts at page 1 with previous and next buttons, a 52px tabular page field (type a number and press Enter) and the arrow keys. A workbook starts at the top of its first sheet, with the sheets as tabs along the foot on the chrome ground: the open one is white, with the ink rule on its top edge. A file the viewer cannot draw (damaged, password protected, or a workbook with no sheets read) shows the reason in a notice in its status colour, with a default "Download the file" button.

### Result Table
A title (13px/600) and an Export menu (default button, Excel or CSV) sit above a white 6px hairline frame with a sticky Hover Ground header (dimmed 600 labels, balanced wrap). Rows highlight on hover. Numbers align right with tabular figures, and empty cells show a faint dash. The row count and "Show N more" sit below the frame.

### How I Found This (trace)
A quiet text toggle (13px, 600 label, dimmed meta "1 step so far") with a chevron that rotates 90 degrees when open. The steps hang on a rail of 18px ring markers joined by hairlines. The rail is dashed while a step runs, and markers are dashed for refused or unfinished steps. SQL and tool input are set in monospace on a gray code ground.

### Streaming Answer
Answer markdown at 15px/1.55 with a 3px ink caret at the end that pulses between full and 30% opacity every 900ms (static under reduced motion). Once the answer finishes, the warnings, table and sources fade in together and rise 4px over 180ms on `cubic-bezier(0.16, 1, 0.3, 1)`.

### Spoken Question and Said Aloud
A question asked in a call is a normal turn. Its heading ends with a dimmed 16px outline microphone, 8px after the text on its inline-end side. Under the sources, "Said aloud" keeps what the voice said: a dimmed 14px speaker icon, a 12px/600 dimmed label, and the transcript in 13px Soft Text with `dir="auto"`. The written answer stays the record.

### Call Card
The voice call, docked where the composer was, in the composer's own frame: white, 8px corners, a 1px Border-gray edge, settling in with the 180ms fade-and-rise. Beside the avatar, a 13px/600 status line ("Listening", "Muted", the running step's name, "Atlas is speaking", truncated, announced politely) with the call's clock and cost at the line end in dimmed 12px tabular numerals (price per minute in a tooltip). Under it, "You" and "Atlas" captions: a 44px dimmed 12px/600 speaker column and 13px words capped at two lines, set against their end so the newest words stay in view. The latest speaker's line reads in Body Text, the other in Dimmed. The control row holds the voice picker, a default Stop answer while a question runs, a default mute toggle and a filled ink End call (34 to 36px). On a phone they are 40px icon buttons. A dimmed 12px hint sits under the card.

### Call Avatar
A philosopher's bust with curls and a full beard, drawn like marble: graphite line work (gray 8 at 1.2 to 1.7 stroke, curls and cloak folds in gray 5) with white skin and cloth on a Hover Ground disc, no colour in the drawing. A 72px circle (56px on a phone, which drops the curls and folds, draws heavier lines and larger eyes so it reads as a face first). Its ring carries the state: a Hairline ring while it listens, a gray 6 ring whose weight follows the user's voice while they speak, a dashed gray 5 ring turning once every 7s while a question runs, and a 1.5px ink ring while Atlas speaks. Before and after the live call it rests at 85% opacity with its eyes lowered.

**The Living Face Rule.** Continuous motion is allowed inside the call avatar only, and only while a call is open: blinks every 2.8 to 6.5s, a slow 4.2s breath, brows up while the user speaks, eyes up while a question runs, the mouth following Atlas's measured voice, and the ring dashed and turning while the call connects and while it checks. Under reduced motion it holds one still pose per state, and it does not move in a hidden tab. Every other surface keeps motion for state changes only.

### Voice Picker
A Mantine Select (208px in the call card) grouped under "English" and "Arabic". Options read "Gulf · female"; each Arabic dialect shows its own name in Arabic, dimmed and right to left, at the option's end. Its dropdown opens upward at 240px. Choosing another voice mid-call reconnects in the new voice.

## Do's and Don'ts

### Do:
- **Do** take every colour, size, radius and shadow from the Mantine theme (`theme.ts`). Components carry no hex values.
- **Do** keep ink blue to actions, focus, selection, links, citations, the streaming caret and the call avatar's speaking ring (The Ink Is Evidence Rule).
- **Do** separate resting surfaces with 1px hairlines on page, chrome or white grounds, and keep shadows for modals, menus and the PDF page.
- **Do** set every figure in tabular numerals and right-align numeric columns.
- **Do** use logical properties (`inline-start`, `dir="auto"`, mirrored arrows) so Arabic content reads right to left.
- **Do** use 150ms ease-out for hover and colour changes and 180ms `cubic-bezier(0.16, 1, 0.3, 1)` for content settling in or collapsing, and disable both under reduced motion.
- **Do** use Tabler outline icons at 1.5 to 2 stroke, sized 12 to 18px.
- **Do** give the call avatar a still pose per state under reduced motion, and stop its motion in a hidden tab (The Living Face Rule).

### Don't:
- **Don't** use gradients, glowing AI sparkles, chat bubbles or cards inside cards.
- **Don't** colour document types or ok files. Amber and red are for files and requests with problems only.
- **Don't** put a shadow on a surface that sits in the page.
- **Don't** set uppercase or letterspaced labels. Labels are sentence case at 12px/600.
- **Don't** add a second typeface or a display face. Monospace is for SQL and tool input only.
- **Don't** choreograph page loads. Motion marks state changes only, except inside the call avatar while a call is open.
- **Don't** colour the bust. Its drawing stays graphite on white, and ink touches only its ring while Atlas speaks.
