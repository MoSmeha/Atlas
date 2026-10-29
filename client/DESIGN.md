---
name: Atlas
description: Ask a folder of project PDFs and spreadsheets in plain words, in English or Arabic; every answer carries its rows and its sources.
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
  overlay: "rgba(21, 26, 33, 0.32)"
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
  ink-dark: "#3b5da7"
  ink-bright-dark: "#7698d9"
  ink-wash-dark: "#182136"
  ink-tint-dark: "#1f2b47"
  ink-selection-dark: "#2c3e66"
  ink-deep-dark: "#c9d8f5"
  chrome-ground-dark: "#0f1217"
  page-ground-dark: "#14171d"
  surface-dark: "#1a1e25"
  hover-ground-dark: "#1f242c"
  quiet-chip-dark: "#272d36"
  hairline-dark: "#2b313a"
  border-dark: "#3f4651"
  faint-glyph-dark: "#5f6774"
  placeholder-dark: "#8a92a0"
  dimmed-dark: "#939ba8"
  secondary-text-dark: "#aeb5c0"
  soft-text-dark: "#cdd2d9"
  body-text-dark: "#e9ecf1"
  bright-dark: "#f4f6f9"
  overlay-dark: "rgba(5, 6, 9, 0.62)"
  amber-wash-dark: "#221c0e"
  amber-tint-dark: "#2e2512"
  amber-rule-dark: "#4a3a16"
  amber-icon-dark: "#e3a93a"
  amber-text-dark: "#f2c46b"
  red-wash-dark: "#241313"
  red-tint-dark: "#3a1818"
  red-rule-dark: "#5a2323"
  red-icon-dark: "#f0716a"
  red-error-dark: "#f58a83"
  red-text-dark: "#ffaaa4"
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
  button-primary-dark:
    backgroundColor: "{colors.ink-dark}"
    textColor: "{colors.white}"
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
  sheet:
    backgroundColor: "{colors.page-ground}"
    rounded: "{rounded.lg}"
  sheet-dark:
    backgroundColor: "{colors.page-ground-dark}"
  composer:
    backgroundColor: "{colors.white}"
    textColor: "{colors.body-text}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "4px 4px 4px 12px"
  composer-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.body-text-dark}"
  composer-send:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    size: "34px"
  composer-disabled:
    backgroundColor: "{colors.hover-ground}"
  composer-dock:
    backgroundColor: "{colors.page-ground}"
    padding: "8px 0 16px"
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
  badge-warning-dark:
    backgroundColor: "{colors.amber-tint-dark}"
    textColor: "{colors.amber-text-dark}"
  badge-error:
    backgroundColor: "{colors.red-tint}"
    textColor: "{colors.red-text}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    height: "20px"
  badge-error-dark:
    backgroundColor: "{colors.red-tint-dark}"
    textColor: "{colors.red-text-dark}"
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
  top-bar-dark:
    backgroundColor: "{colors.chrome-ground-dark}"
  language-toggle:
    textColor: "{colors.secondary-text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 8px"
  scheme-toggle:
    textColor: "{colors.secondary-text}"
    rounded: "{rounded.md}"
    size: "34px"
  sidebar:
    backgroundColor: "{colors.chrome-ground}"
    width: "300px"
    padding: "8px 16px 16px"
  sidebar-dark:
    backgroundColor: "{colors.chrome-ground-dark}"
  folder-row:
    textColor: "{colors.soft-text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xs}"
    height: "30px"
    padding: "5px 6px 5px 3px"
  folder-row-root:
    textColor: "{colors.body-text}"
  tree-file:
    textColor: "{colors.body-text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xs}"
    padding: "6px 6px 6px 4px"
  tree-file-hover:
    backgroundColor: "{colors.white}"
  tree-file-hover-dark:
    backgroundColor: "{colors.surface-dark}"
  tree-file-active:
    backgroundColor: "{colors.ink-tint}"
  tree-meta:
    textColor: "{colors.dimmed}"
    typography: "{typography.label}"
  modal:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.lg}"
    padding: "24px"
  modal-dark:
    backgroundColor: "{colors.surface-dark}"
  tooltip:
    backgroundColor: "{colors.body-text}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    width: "320px"
  tooltip-dark:
    backgroundColor: "{colors.body-text-dark}"
    textColor: "{colors.page-ground-dark}"
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
  call-card-dark:
    backgroundColor: "{colors.surface-dark}"
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

Atlas is the category standard for chat-with-your-documents tools, built to the craft of Claude.ai's calm reading column (and its question box under the heading on a fresh chat), Perplexity's numbered sources and Linear's dense, quiet chrome with the content on an inset sheet. The owner chose the conventions on purpose and the build doesn't dress them up. The 52px top bar and the 300px sidebar are one continuous cool-neutral chrome field. The conversation sits on it as an inset sheet: the page ground, a 1px hairline and 8px corners, scrolling on its own while the chrome stays still. The sheet holds one 760px column. Everything is drawn with 1px hairlines on flat grounds. The one ink blue appears only where the reader acts or where the system points at evidence.

The same world runs in two schemes and two languages. Dark is the same roles on blue-black slate: the chrome darkest, the page a step up, raised surfaces a step above that. Every gray, ink, amber and red shade is a role, not a lightness step, and each role has its dark value, so a component that asks for "dimmed" or "red tint" reads correctly in both. Arabic mirrors the whole layout, while content (answers, questions, quotes, table cells, file names) keeps its own direction. Figures are Western digits in both languages, so a number on screen matches the number in the file.

Density follows Linear more than a marketing page. Tree rows are 13px names over 12px meta. Tables run at 13px with tabular figures. The answer reads at 15px with a 75ch measure. Motion only marks state changes: a hover tint, a chevron turning, a folder opening, and the finished answer's table and sources settling in once with a short fade-and-rise. One exception, approved by the owner on 2026-10-29: during a voice call, Atlas's face (a philosopher's bust in graphite line work, marble in both schemes) moves continuously, and nothing else does.

The system refuses the demo look named in the direction contract: decorative gradients, glowing AI sparkles, bubble chat and cards inside cards. The question is a heading-weight line, not a bubble. The answer is plain prose on the page ground, not a card.

**Key Characteristics:**
- One brand hue (deep ink blue, shade 7 in light and shade 6 in dark of a 10-step ramp) for actions, focus, selection, links, citations, the open file, the streaming caret and the call avatar's ring while Atlas speaks
- One chrome field (top bar and sidebar) with the conversation on an inset sheet of page ground
- Light and dark schemes from one set of colour roles; the PDF page and the bust stay white in both
- 1px hairline borders instead of shadows on every resting surface; floating surfaces also take a hairline edge in dark
- One system UI family for everything (Segoe UI carries Arabic on Windows); monospace only for SQL and tool input
- Tabular Western figures wherever numbers appear, in English and Arabic
- The whole layout mirrors in Arabic; content keeps its own direction
- Continuous motion lives only in the call avatar, and only while a call is open

## Colors

A cool, nearly colourless palette: blue-tinted grays carry the structure, one ink blue carries meaning, and amber and red appear only when a file or request has a problem. Each role below has a light value and a dark value (the `-dark` tokens); components name the role and the scheme supplies the value.

### Primary
- **Atlas Ink** (`ink`, `ink-dark` in dark): filled primary buttons (Load, Send, Stop), the active source number and the 3px streaming caret. The composer's phone, the dictation check mark and End call are primary actions and take the filled ink too. Dark uses shade 6 so white button text holds 6.3:1 and the fill still reads as the action. In light, focus outlines, links, the input caret and the call avatar's speaking ring use the same ink.
- **Ink Bright** (`ink-bright-dark`, dark only): what light gives to Atlas Ink as a line rather than a fill. In dark, focus outlines, links, the input caret and the call avatar's 1.5px speaking ring use ink shade 4, so a thin line still reads on the slate.
- **Ink Wash** (`ink-wash`, `ink-wash-dark`): the ground of the open source row and of cited rows in the sheet viewer.
- **Ink Tint** (`ink-tint`, `ink-tint-dark`): `<mark>` highlights, the row-number cell of a cited sheet row (a step deeper than the row itself), and the file open in the viewer in the folder tree, where the wash would vanish into the chrome.
- **Ink Selection** (`ink-selection`, `ink-selection-dark`): text selection ground, with Ink Deep (`ink-deep`, `ink-deep-dark`) text.
- **Ink Mark** (`ink-mark`): mixed at 45% over the rendered PDF page so the printed words of a cited passage show through. It is not remapped: the page stays white paper in both schemes, so the mark looks the same in both.

### Tertiary (status only)
- **Amber** (`amber-tint` ground, `amber-text` text, `amber-wash`/`amber-rule`/`amber-icon` in notices, each with its `-dark` value): files Atlas read only partly (Scanned, Too large) and warning notices. The light badge text reads at 7.7:1.
- **Signal Red** (`red-tint` ground, `red-text` text, `red-wash`/`red-rule`/`red-icon` in notices, each with its `-dark` value): files Atlas could not open (Damaged, Password protected) and error notices. `red-error` is the inline error text under fields and the dropzone. In dark the grounds sink to deep brown and maroon and the text and icons lift to light amber and coral.

### Neutral
- **Chrome Ground** (`chrome-ground`, `chrome-ground-dark`): the one field behind the top bar, the sidebar and the sheet's margin, plus the viewer stage behind a PDF page, sheet headers, the row-number gutter, the strip of sheet tabs and the code ground. In dark it is the deepest slate.
- **Page Ground** (`page-ground`, `page-ground-dark`): the inset sheet the conversation sits on. The docked composer strip reuses it so turns scroll under it cleanly.
- **Surface** (`white`, `surface-dark`): raised surfaces that hold content you read: composer box, call card, result-table frame, sheet stage, the open sheet's tab, modals, menus, popovers and dropdowns. On the chrome ground, a tree row lifts to it under the pointer. In dark it is a step above the page, so these surfaces lift off it.
- **Hover Ground** (`hover-ground`, `hover-ground-dark`): the hover tint on rows and quiet controls, sticky table headers, the disabled composer, the call avatar's disc and the "not found" notice ground.
- **Quiet Chip** (`quiet-chip`, `quiet-chip-dark`): neutral badges, source numbers and the disabled-control ground. Also the hairline between suggested questions and under the viewer header.
- **Hairline** (`hairline`, `hairline-dark`): the sheet's edge, table frames, quote rules, tree rails, the trace rail, the PDF page edge, the sheet gutter rule, the top bar's divider before the language and theme, and the disabled-control border.
- **Border** (`border`, `border-dark`): input and composer borders, the default control border, scrollbar thumbs (browser and ScrollArea) and trace markers. In dark it is also the hairline edge of floating surfaces.
- **Dimmed** (`dimmed`, `dimmed-dark`): meta text, placeholders (`placeholder-dark` in dark), column headers, file-kind icons, chevrons and list markers (5.1:1 on chrome in light).
- **Body Text** (`body-text`, `body-text-dark`): body text. Headings, the wordmark, the folder root and questions take the bright tone (`body-text` in light, `bright-dark` in dark). `soft-text` and `secondary-text` step down for row text, folder rows and quiet controls. `faint-glyph` is for trailing arrows, empty-cell dashes and disabled text only.
- **Overlay** (`overlay`, `overlay-dark`): the veil behind modals, 32% ink-tinted in light and a deeper 62% near-black in dark.
- **Tooltip**: the inverse of the scheme: Body Text ground with white text in light, `body-text-dark` ground with `page-ground-dark` text in dark.

### Named Rules
**The Ink Is Evidence Rule.** Ink blue marks only what you can act on and where an answer points (primary action, focus, link, selection, active citation, cited text, the open file, streaming caret, and the call avatar's ring while Atlas speaks). The wordmark and its mark, headings, icons and the drawing of the bust stay neutral.

**The Colour Means Trouble Rule.** Amber and red mean a file or request has a problem, nothing else. Document types and the ok state use neutral badges, empty and skipped files use gray, and "not found" answers use a neutral notice.

**The Roles Not Shades Rule.** A component asks for a role (gray 6 for dimmed, red 1 for the error tint, `--atlas-surface` for a raised surface) and never for a lightness. The dark scheme gives every role its own value, so nothing is coloured per scheme in a component. The only fixed values are the ones that are real objects: the white PDF page and the marble bust.

## Typography

**Display Font:** Segoe UI (with system-ui, -apple-system, Helvetica Neue, Noto Sans, Noto Sans Arabic, Geeza Pro, Tahoma, Arial)
**Body Font:** the same stack
**Label/Mono Font:** ui-monospace (with Cascadia Mono, Consolas, SF Mono, Menlo), for SQL and tool input in the trace only

**Character:** One native family at about a 1.15 ratio (12, 13, 15, 17, 20, 26). It looks like the user's own operating system in either script, so the documents and figures carry the voice. Weight does the ranking: 400 for reading, 600 for names, labels and headings, and 700 only on the wordmark.

### Hierarchy
- **Display** (600, 26px, 1.25, -0.01em, balanced wrap): the one empty-state heading that names the folder or the state ("Ask about riyadh-tower").
- **Headline** (600, 20px, 1.35): each question at the top of its turn, `dir="auto"` so Arabic questions set right to left.
- **Title** (600, 17px, 1.5): modal titles and headings inside an answer. The wordmark uses the same size at 700 with -0.015em tracking.
- **Body** (400, 15px, 1.55, max 75ch): answer prose, suggested questions, composer text and empty-state lines (65ch). Arabic answers set at 1.07x (about 16px) with 1.75 line height. Arabic interface text takes a 1.6 body line height, because Arabic letters sit lower and denser than Latin at the same size.
- **Body small** (400, 13px, 1.45): tree names, source rows, tables, trace steps, form labels (600) and the usage line.
- **Label** (600, 12px, sentence case, no tracking): badges, source numbers, the "Sources" list heading, sheet column letters and row numbers. Dimmed 12px/400 is the meta line.

### Named Rules
**The Tabular Figures Rule.** Every place a number appears sets `font-variant-numeric: tabular-nums`. Numeric table columns align right and never wrap.

**The Western Digits Rule.** Numbers are Western digits with comma thousands separators in both languages (counts, sizes, pages, amounts, times), the same as the documents and answers. Amounts are shown exactly as the data holds them, never rounded. Arabic counts use the noun's own plural form around the figure ("ملفان", "3 ملفات", "11 ملفًا").

**The Sentence Case Rule.** Labels and badges are sentence case at zero tracking. The build has no uppercase or letterspaced text.

## Layout

Fixed app frame: a 52px top bar and a 300px sidebar (8px top, 16px sides and foot) on one chrome field, with no rule between them. The main area holds the inset sheet: full height under the top bar less an 8px foot, 8px clear of the window's end edge, with a 1px hairline and 8px corners. The sheet scrolls on its own and contains its overscroll, so the top bar and sidebar never move. Below Mantine's `sm` breakpoint (48em) the sidebar folds behind a burger and the sheet goes edge to edge under the top bar, keeping only its top hairline and losing its corners.

Inside the sheet, a centred column of 760px plus 16px gutters each side. Its content stack has 32px top and 24px bottom padding with 24px between turns. Inside a turn, parts are 16px apart.

Before the first question, the empty state holds the composer: the heading, its one summary line, the question box and then the five suggested questions, as one block a little above the middle of the sheet (24px gaps, 12dvh extra below). Once a question is asked, the composer docks at the bottom of the sheet with `position: sticky` on the page ground, 8px above it and 16px below. Turns that scroll under it fade out over a 24px band of page ground just above the dock (see The Fade Above The Dock Rule).

Spacing runs on an 8/12/16/24/32 scale (`xs` to `xl`). Tight inner rhythm uses 2, 4 and 6px steps: 2px between a name and its meta, 4px between badges and trace lines, and 6px for row padding and stacked label-to-field gaps. Suggested questions are full-width rows (12px by 8px) separated by hairlines. Source rows bleed their hover ground 8px past the column edge so their text lines up with the prose. Result tables scroll inside their frame up to `min(28rem, 60dvh)`.

Below `sm`, the language and theme controls move from the top bar to the sidebar's foot under a hairline, Clear chat becomes an icon button, the cost-and-time pair moves to the composer's hint line, and the viewer goes full screen. Below `xs` (36em), a source's place always drops under its name.

During a voice call the call card takes the composer's place, under the heading before the first question and docked after it, at the same width. Inside it, 12px padding and 12px gaps: the avatar and a text block side by side, then a control row under a 1px Quiet Chip rule (voice picker at the start, actions at the end). Below `xs` the avatar drops to 56px, controls grow to 40px, the picker takes the row's remaining width so the controls stay on one line, only the latest caption shows, and the standing hint under the card is hidden.

Content widths inside the viewer cap at 560 to 600px for notes and states. The PDF page centres on the chrome stage with 16px padding, and the sheet runs edge to edge on the surface like a grid in Excel. A workbook opened whole keeps its sheet tabs along the viewer's foot, as Excel does.

### Arabic and direction
The interface language sets `dir` on the document, and the whole layout mirrors: the sidebar moves to the right, the top bar's ends swap, notifications rise from the bottom corner at the end of the reading direction, and every spacing, rule and rail uses logical properties (`inline-start`, `inline-end`). Arrows and chevrons that point along the reading direction turn round (`flip-rtl`, or a rotation for the trace and tree chevrons).

Content keeps its own direction with `dir="auto"`: answers (set right to left when Arabic, with `lang`), questions, quotes, suggested questions, table cells, sheet cells, file names and said-aloud transcripts. A result table runs in the direction of its own column labels, not the page's. SQL, formulas, tool input that is code, folder paths and the full-path tooltip are always left to right. The Excel grid in the viewer stays left to right as Excel draws it, while its notes, buttons and sheet tabs follow the interface. Numbers in tables align right physically, not to the end, so their units line up in either direction. A Latin file name in an Arabic tree keeps its own direction but lines up on the right with the Arabic lines.

Inside an Arabic sentence, file names, sheet names, paths, extensions and codes are wrapped in first-strong isolates, so their dots, slashes and colons stay put. An amount and its currency, and a time and its unit, are joined by no-break spaces so a wrapping line never strands "SAR" or "s" alone. The wordmark stays "Atlas" in Latin.

## Elevation & Depth

Flat, with tonal layering. Resting surfaces separate by ground (chrome, page, surface) and 1px hairlines, never by shadow; the inset sheet itself is a hairline and a change of ground, with no shadow. Shadows are reserved for things that float above the page: modals, menus, popovers, comboboxes and the PDF page sitting on its stage. They carry an ink tint (`rgba(21, 26, 33, a)`), a downward offset and a soft negative-spread blur.

A shadow does not read on a near-black page, so in dark every floating surface also takes a 1px edge in the Border role (`--atlas-float-edge`, transparent in light), sits on the raised surface rather than the page, and its veil is the deeper dark overlay.

### Shadow Vocabulary
- **Page** (`box-shadow: 0 1px 2px rgba(21,26,33,0.06)`): the rendered PDF page on the viewer stage.
- **Overlay** (`box-shadow: 0 6px 16px -4px rgba(21,26,33,0.14), 0 2px 4px rgba(21,26,33,0.05)`): menus, popovers, comboboxes (model picker, voice picker).
- **Modal** (`box-shadow: 0 12px 32px -8px rgba(21,26,33,0.2), 0 4px 8px rgba(21,26,33,0.06)`): the viewer and confirmation modals, over the Overlay veil.

### Named Rules
**The Hairline Not Shadow Rule.** A surface that sits in the page gets a 1px border and no shadow. A shadow means the surface floats above the page, and in dark a floating surface also carries a hairline edge.

**The Fade Above The Dock Rule.** The one gradient in the system is functional: a 24px band above the docked composer that runs from transparent to the page ground, so turns scrolling under the composer fade out instead of being cut at its edge. It uses only the page ground, never a hue, and it is never decoration. No other surface takes a gradient.

## Shapes

Small, even corners on a 4/6/8 scale, with 6px as the default. Chips, source numbers, `<mark>`, tree rows and hover rows take 4px. Buttons, inputs, menus, notices and the result-table frame take 6px. The inset sheet, the composer, the call card and modals take 8px. The PDF page takes 4px, so it reads as paper. Only the trace markers (18px circles) and the call avatar's medallion are round. Borders are always 1px. The trace rail and the tree's rails are 1px lines; the trace rail turns dashed while a step runs, and the avatar's ring follows the same rule: dashed (4 on, 5 off) while a question runs. Refused or unfinished markers have dashed rings. Quotes are set off by a 1px rule on their reading side (`border-inline-start`), so they mirror in Arabic. The quote rule is a quiet hairline in `hairline` gray, not a coloured stripe.

The mark is a folded map of three panels (20px, filled, the middle panel at 42% for the fold's shade), in the same neutral bright ink as the wordmark beside it, 8px apart.

## Components

### Buttons
Mantine defaults, tuned small and quiet.
- **Shape:** gently rounded (6px).
- **Primary:** Atlas Ink fill, white text, size `sm` (36px); shade 6 in dark, hovering a shade deeper. Used once per region: Load in the sidebar, Send/Stop in the composer. Loading shows the dots loader.
- **Default:** the surface with a Border-gray 1px edge and Body Text, size `xs` (30px). Used for Export, Clear chat, Try again and Ask again.
- **Subtle:** no ground, ink text, compact sizes. Used for "Show N more", "Ask again" after a stop, and viewer toolbar controls. Gray subtle buttons carry the top bar's language switch.
- **Icon buttons:** subtle gray by default (`lg`). The composer's Send is a 34px filled ink square that becomes a filled Stop square while an answer streams. With the box empty, the same slot is a filled ink phone that starts a voice call.
- **Disabled:** Quiet Chip ground, Faint Glyph text and a Hairline border in both schemes, so a disabled control stays visible on the dark surface.
- **Focus:** a 2px outline at 2px offset in the focus ink (Atlas Ink in light, Ink Bright in dark) on every focusable element.

### Chips (badges)
- **Style:** 20px tall, 6px side padding, 4px corners, 12px/600 sentence case. Neutral badges have a Quiet Chip ground and Soft Text. Amber and red badges have a shade-1 ground, shade-9 text and a 12px Tabler status icon, each from its role, so they read in both schemes.
- **State:** status badges show only when a file is not ok, and are focusable so the reason shows in a tooltip.

### Cards / Containers
- **Corner Style:** 6px (result table, notices), 8px (sheet, composer, call card, modals).
- **Background:** the surface for content frames, Hover Ground for the neutral "not found" notice, and the shade-0 wash with a shade-2 border for error and warning alerts.
- **Shadow Strategy:** none at rest (see Elevation & Depth).
- **Border:** 1px `hairline` or `border` gray.
- **Internal Padding:** 12px by 16px for notices. Tables run flush in their frame.

### Inputs / Fields
- **Style:** Mantine TextInput with a 1px Border-gray edge, 6px corners, the surface ground and a dimmed placeholder. Field labels sit above at 13px/600. The folder path field has a folder icon at its start and stays left to right in Arabic.
- **Composer:** an unstyled autosizing Textarea (1 to 8 rows, 15px, `dir="auto"`) inside an 8px-radius surface box with a 1px Border-gray edge, plus a dimmed 12px hint line under it.
- **Focus:** the composer's border turns the focus ink over 150ms. Other fields take the global 2px focus outline. The text caret is the focus ink.
- **Error / Disabled:** errors are 12px `red-error` text under the field with `role="alert"`. A disabled composer turns Hover Ground with a not-allowed cursor.
- **Dictation:** a 34px subtle gray microphone sits before the Send slot (a small gray loader while the words are written down). While it records, the text area gives its place, at the same height, to five still level bars (3px wide, 6, 11, 16, 11 and 6px tall, 2px apart) that sit in `border` gray and darken to `secondary-text` while the microphone hears speech, one 150ms colour change each way and nothing moving, a dimmed 15px "Listening" and a dimmed 13px tabular timer. The controls become a subtle gray Cancel and a filled ink check mark that writes the words into the box. Esc cancels. The hint line says what to do.
- **Voice problems:** a blocked microphone, a call or dictation that could not start, or a failed transcription shows on the composer's hint line as 12px `red-error` text with `role="alert"`, next to the controls that retry it; why a call ended (silence, the length limit, a dropped connection) shows there in dimmed text. Neither floats over the controls, and both clear after 20 seconds, on typing, or on the next call or dictation.

### Navigation
- **Top bar:** Chrome Ground, 52px, no rule under it (it is one field with the sidebar). Start: the folded-map mark and the "Atlas" wordmark in neutral bright ink at 17px/700, always Latin and left to right. End: the dimmed tabular cost-and-time pair ("$0.042 · 14.2 s", details in a tooltip), the model picker (Select), a default Clear chat button, a vertical hairline, then the language switch and the theme toggle.
- **Language switch:** a gray subtle button with a 16px language icon that names the other language in its own script ("العربية" in English, "English" in Arabic), tagged with that language. A tooltip in the current language says what it does. Switching changes the interface only; answers follow the question's language.
- **Theme toggle:** a gray subtle icon button, a moon in light and a sun in dark (18px, 1.75 stroke), labelled with the scheme it switches to. The choice is kept for the next visit and read before the app loads, so the page never flashes the other scheme.
- **Sidebar:** Chrome Ground. From the top: the folder path field with Load, a one-line dashed dropzone, a 3px progress line while indexing, then "Documents" (13px/600) over the scrolling folder tree, and a collapsible "N files skipped" foot. On a phone it collapses behind a burger and its foot also holds the language switch and theme toggle under a hairline.

### Folder Tree
The loaded folder as a tree, like File Explorer, replacing the flat document list. All folders start open.

- **Folder rows:** a 30px row: a 14px dimmed chevron, an 18px outline folder icon (open or closed) in Secondary Text, the name in 13px Soft Text and, at the row's end, the dimmed 12px tabular file count (the full count is announced in words). The root is the loaded folder, its name in bright 600. The chevron points along the reading direction when closed and down when open, turning over 150ms; the contents open and close over 180ms.
- **Rail:** each folder's contents hang on a 1px Hairline rail that drops from the middle of its chevron (10px in, 7px before the rows), on the inline-start side so it mirrors.
- **File rows:** a 16px dimmed file-kind icon, the 13px name (truncated, `dir="auto"`, the full path in a left-to-right tooltip) with any status badge at the line's end, and under it the dimmed 12px tabular meta (pages or sheets and tables, or the size for an empty file). Rows arrive with a 180ms 2px rise.
- **States:** the whole file row opens the file in the viewer. Rows lift to the surface under the pointer, and the file open in the viewer takes the Ink Tint and `aria-current`. The focus ring sits inside the row, so the tree's edge never clips it. The status badge stays above the row's button, so its reason still shows on hover and focus.

### Numbered Sources
A labelled ordered list of quiet full-width rows: a 24px by 18px tabular number chip, a file-kind icon, the bold name with its dimmed place (page, sheet and rows), an optional two-line quote behind an inline-start hairline, and a trailing open chevron that points along the reading direction and darkens on hover. The open source turns Ink Wash with a filled ink number. Opening one shows the viewer at that page with the quote washed in ink, or at the sheet with the cited rows tinted.

### Viewer
A 1040px modal on the raised surface (full screen below `sm`): the file's icon, name and place in the header, a control bar under a hairline, and a stage that scrolls. Opened from a source, it starts at the cited page or rows and offers a way back to them. Opened from the tree, it shows the whole file. A PDF starts at page 1 with previous and next buttons, a 52px tabular page field (type a number and press Enter) and the arrow keys; the page is white paper with a hairline edge and the Page shadow in both schemes, on the chrome stage. A workbook starts at the top of its first sheet, with the sheets as tabs along the foot on the chrome ground, running in the interface's direction: the open one sits on the surface, with the ink rule on its edge. A file the viewer cannot draw (damaged, password protected, or a workbook with no sheets read) shows the reason in a notice in its status colour, with a default "Download the file" button.

### Result Table
A title (13px/600, `dir="auto"`) and an Export menu (default button, Excel or CSV) sit above a surface 6px hairline frame with a sticky Hover Ground header (dimmed 600 labels, balanced wrap). Rows highlight on hover. Numbers align right with tabular figures, keep every digit they have, and never wrap; empty cells show a faint dash. A label's unit in brackets is held to it with a no-break space. The row count and "Show N more" sit below the frame.

### How I Found This (trace)
A quiet text toggle (13px, 600 label, dimmed meta "1 step so far") with a chevron that rotates 90 degrees when open. The steps hang on a rail of 18px ring markers joined by hairlines. The rail is dashed while a step runs, and markers are dashed for refused or unfinished steps. SQL and tool input are set left to right in monospace on the chrome code ground.

### Streaming Answer
Answer markdown at 15px/1.55 (Arabic 1.07x at 1.75) with a 3px ink caret at the end that pulses between full and 30% opacity every 900ms (static under reduced motion). While text streams, the answer takes the question's direction until it has enough letters to judge its own. Once the answer finishes, the warnings, table and sources fade in together and rise 4px over 180ms on `cubic-bezier(0.16, 1, 0.3, 1)`.

### Spoken Question and Said Aloud
A question asked in a call is a normal turn. Its heading ends with a dimmed 16px outline microphone, 8px after the text on its inline-end side. Under the sources, "Said aloud" keeps what the voice said: a dimmed 14px speaker icon, a 12px/600 dimmed label, and the transcript in 13px Soft Text with `dir="auto"`. The written answer stays the record.

### Call Card
The voice call, in the composer's place and in the composer's own frame: the surface, 8px corners, a 1px Border-gray edge, settling in with the 180ms fade-and-rise. Beside the avatar, a 13px/600 status line ("Listening", "Muted", the running step's name, "Atlas is speaking", truncated, announced politely) with the call's clock and cost at the line end in dimmed 12px tabular numerals (price per minute in a tooltip). Under it, "You" and "Atlas" captions: a 44px dimmed 12px/600 speaker column and 13px words capped at two lines, set against their end so the newest words stay in view. The latest speaker's line reads in Body Text, the other in Dimmed. The control row holds the voice picker, a default Stop answer while a question runs, a default mute toggle and a filled ink End call (34 to 36px). On a phone they are 40px icon buttons. A dimmed 12px hint sits under the card.

### Call Avatar
A philosopher's bust with curls and a full beard, drawn like marble: graphite line work (gray 8 at 1.2 to 1.7 stroke, curls and cloak folds in gray 5) with white skin and cloth, no colour in the drawing. The drawing takes the fixed light marble values (`--atlas-marble-*`) in both schemes; only the Hover Ground disc behind it and its ring follow the theme. A 72px circle (56px on a phone, which drops the curls and folds, draws heavier lines and larger eyes so it reads as a face first). Its ring carries the state: a Hairline ring while it listens, a gray 6 ring whose weight follows the user's voice while they speak, a dashed gray 5 ring turning once every 7s while a question runs, and a 1.5px ink ring while Atlas speaks (Ink Bright in dark). Before and after the live call it rests at 85% opacity with its eyes lowered.

**The Living Face Rule.** Continuous motion is allowed inside the call avatar only, and only while a call is open: blinks every 2.8 to 6.5s, a slow 4.2s breath, brows up while the user speaks, eyes up while a question runs, the mouth following Atlas's measured voice, and the ring dashed and turning while the call connects and while it checks. Under reduced motion it holds one still pose per state, and it does not move in a hidden tab. Every other surface keeps motion for state changes only.

### Voice Picker
A Mantine Select (208px in the call card) grouped under "English" and "Arabic". Options read "Gulf · female"; each Arabic dialect shows its own name in Arabic, dimmed and right to left, at the option's end. Its dropdown opens upward at 240px on the raised surface. Choosing another voice mid-call reconnects in the new voice.

## Do's and Don'ts

### Do:
- **Do** take every colour, size, radius and shadow from the Mantine theme (`theme.ts`). Components carry no hex values.
- **Do** ask for colour roles (gray 0 to 9, ink, yellow and red shades, `--atlas-surface`, `--atlas-focus`) so each surface reads in both schemes (The Roles Not Shades Rule).
- **Do** keep ink blue to actions, focus, selection, links, citations, the open file, the streaming caret and the call avatar's speaking ring (The Ink Is Evidence Rule).
- **Do** separate resting surfaces with 1px hairlines on chrome, page or surface grounds, and keep shadows for modals, menus and the PDF page; give floating surfaces a hairline edge in dark.
- **Do** keep the conversation on the inset sheet, which scrolls on its own inside the still chrome field.
- **Do** put the question box under the heading until the first question, then dock it at the sheet's foot with the page-ground fade above it.
- **Do** set every figure in tabular Western digits and right-align numeric columns physically, in both languages.
- **Do** use logical properties so the whole layout mirrors in Arabic, `dir="auto"` on content, and isolates around file names, paths and codes inside Arabic sentences.
- **Do** keep SQL, formulas, paths and the Excel grid left to right in both languages.
- **Do** join an amount and its currency, and a number and its unit, with a no-break space.
- **Do** use 150ms ease-out for hover and colour changes and 180ms `cubic-bezier(0.16, 1, 0.3, 1)` for content settling in, collapsing or a folder opening, and disable both under reduced motion.
- **Do** use Tabler outline icons at 1.5 to 2 stroke, sized 12 to 18px.
- **Do** give the call avatar a still pose per state under reduced motion, and stop its motion in a hidden tab (The Living Face Rule).

### Don't:
- **Don't** use decorative gradients, glowing AI sparkles, chat bubbles or cards inside cards. The page-ground fade above the docked composer is the only gradient (The Fade Above The Dock Rule).
- **Don't** colour document types or ok files. Amber and red are for files and requests with problems only.
- **Don't** put a shadow on a surface that sits in the page, including the inset sheet.
- **Don't** pick a colour per scheme inside a component, or turn the PDF page or the bust dark.
- **Don't** set uppercase or letterspaced labels. Labels are sentence case at 12px/600.
- **Don't** add a second typeface or a display face. Monospace is for SQL and tool input only.
- **Don't** use Eastern Arabic digits or round an amount for display.
- **Don't** translate the wordmark, file names, item codes or numbers.
- **Don't** choreograph page loads. Motion marks state changes only, except inside the call avatar while a call is open.
- **Don't** colour the bust. Its drawing stays graphite on white marble in both schemes, and ink touches only its ring while Atlas speaks.
