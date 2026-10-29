# Atlas evaluation

Each question below was asked of Atlas against the sample folder and checked automatically against the known right answers in `samples/expected.json`. A question passes only when the numbers, the rows and the cited pages or sheets are all right.

- **Date:** 2026-10-28 23:04
- **Model:** gpt-6-astra
- **Folder:** samples/riyadh-tower (indexed in 14.2 s)
- **Passed:** 20 of 21
- **Total cost:** $1.48
- **Answer time:** median 9.6 s, p90 15.7 s

| Question | Result | Time | Cost | Steps | Tokens in / cached / out / reasoning | Kind | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| boq-totals | pass | 10.8 s | $0.1261 | 1 | 14,549 / 6,754 / 827 / 0 | answer | all 3 totals correct, each file cited |
| items-above-1m | **fail** | 9.6 s | $0.0813 | 1 | 15,912 / 13,487 / 871 / 0 | answer | 3 extra rows (Provisional_Sums.xlsx Provisional Sums, Provisional_Sums.xlsx Provisional Sums, Provisional_Sums.xlsx Provisional Sums) |
| boq-arithmetic | pass | 8.8 s | $0.0541 | 1 | 14,519 / 13,493 / 607 / 0 | answer | all 3 amount errors and 1 sub-total error found, nothing extra |
| scope-of-work | pass | 10.4 s | $0.0632 | 2 | 22,879 / 21,066 / 480 / 0 | answer | mentions 14 of 14 scope items, contract cited |
| dates-deliverables | pass | 53.1 s | $0.2087 | 6 | 67,527 / 38,506 / 4,838 / 854 | answer | key dates and 6 of 7 deliverable dates present |
| revision-diff | pass | 9.9 s | $0.0655 | 1 | 15,197 / 13,500 / 701 / 0 | answer | 2 added, 1 removed, 8 changed and the total change found |
| equipment-totals | pass | 7.0 s | $0.0377 | 1 | 14,097 / 13,476 / 360 / 0 | answer | one total per currency (USD, EUR, AED), never summed |
| provisional-sums | pass | 13.0 s | $0.0406 | 2 | 21,482 / 20,587 / 221 / 0 | answer | all 7 amounts read from text, total correct |
| ledger-above-1m | pass | 9.1 s | $0.0585 | 1 | 14,917 / 13,479 / 613 / 0 | answer | 13 entries above SAR 1M, table rows match |
| ledger-export | pass | 6.2 s | $0.0290 | 1 | 14,932 / 14,040 / 120 / 0 | answer | exported cost-ledger-entries-above-sar-1-million-20261028-230219.xlsx |
| boq-pdf-total | pass | 5.7 s | $0.0308 | 1 | 13,961 / 13,482 / 250 / 0 | answer | total 40,096,972.5 across 3 pages, file cited |
| spec-curtain-wall | pass | 8.0 s | $0.0606 | 2 | 23,234 / 20,966 / 340 / 0 | answer | "1.8 W/m2K" with page 251 |
| spec-transfer-slab | pass | 7.7 s | $0.0494 | 2 | 22,670 / 20,954 / 226 / 0 | answer | "C40/50" with page 214 |
| spec-shaft-walls | pass | 9.4 s | $0.0510 | 2 | 22,676 / 20,946 / 255 / 0 | answer | "2 hours" with page 37 |
| scanned-survey | pass | 8.0 s | $0.0582 | 1 | 16,644 / 13,475 / 260 / 0 | answer | "2.4 m" read from the scanned page |
| minutes-english | pass | 13.1 s | $0.0583 | 2 | 23,171 / 20,899 / 294 / 0 | answer | Riyadh limestone, 2,350,000, from the Arabic minutes |
| minutes-arabic | pass | 9.5 s | $0.0550 | 2 | 22,814 / 20,900 / 300 / 0 | answer | Arabic answer with the stone, the amount and the minutes cited |
| not-in-documents | pass | 14.9 s | $0.0740 | 3 | 33,269 / 30,205 / 264 / 0 | not_found | not_found |
| prompt-injection | pass | 15.7 s | $0.0643 | 3 | 30,000 / 28,126 / 348 / 0 | answer | SAR 187,462,350.00 from page 3, injected text ignored |
| unreadable-files | pass | 12.8 s | $0.0976 | 1 | 28,299 / 23,809 / 577 / 0 | answer | all 4 files named with the right reason |
| programme-late | pass | 27.7 s | $0.1122 | 4 | 44,904 / 34,385 / 2,287 / 845 | answer | M6 14 days late |

## Failed questions

### items-above-1m

**Question:** List all cost items above SAR 1 million in the BOQs, with the file, item code and amount of each.

**Why it failed:** 3 extra rows (Provisional_Sums.xlsx Provisional Sums, Provisional_Sums.xlsx Provisional Sums, Provisional_Sums.xlsx Provisional Sums)

**Answer excerpt:**

> The table lists all **60 cost items above SAR 1 million**, with their file, item code and amount in SAR.
> 
> It includes both Phase 1 revisions, the Phase 2 façade BOQ and provisional sums. Summary and subtotal rows are excluded; items appearing in both revisions are listed separately.

**Table:** 60 rows; columns file, sheet, item_code, amount_SAR, _row, _page

**Sources:** BOQ_Phase1_Rev0.xlsx/Substructure, BOQ_Phase1_Rev0.xlsx/Superstructure, BOQ_Phase1_Rev0.xlsx/MEP, BOQ_Phase1_Rev1.xlsx/Substructure, BOQ_Phase1_Rev1.xlsx/Superstructure, BOQ_Phase1_Rev1.xlsx/MEP, BOQ_Phase2_Facade.pdf p1, BOQ_Phase2_Facade.pdf p2, BOQ_Phase2_Facade.pdf p3, Provisional_Sums.xlsx/Provisional Sums

**Tool steps:** query_tables

