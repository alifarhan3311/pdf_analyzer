# AI Agent Prompt: Bank Statement OCR → Custom Excel Pipeline

> Copy-paste this entire prompt into Cursor / Claude Code / Bolt.new / Windsurf as the project brief.
> Fill in the `[[ ... ]]` placeholders before sending.

---

## PROJECT BRIEF

Build a Python-based batch pipeline that:
1. Reads multiple bank statement PDFs (scanned or digital, mixed banks/formats) from an input folder.
2. Uses a Hugging Face vision-language OCR model (Qwen2.5-VL) to extract transaction data.
3. Validates and cleans extracted data.
4. Writes all transactions into a single Excel file that **exactly matches** a provided template format.
5. Is testable and tunable against a folder of sample PDFs before being trusted on real data.

---

## 1. INPUTS I WILL PROVIDE

- **Sample PDFs**: `[[ number of sample PDFs, e.g. "15 sample statements from 4 different banks" ]]`
  - Location: `/samples/pdfs/`
  - Banks included: `[[ list bank names, e.g. HBL, Meezan Bank, RBC, TD ]]`
  - Mix: `[[ e.g. "10 digital PDFs, 5 scanned/photographed" ]]`
- **Excel template**: `[[ describe or attach, e.g. "template.xlsx with sheet 'Transactions', columns: Date | Description | Debit | Credit | Balance | Category | Bank | Account Number" ]]`
  - Any merged cells, header styling, frozen panes, or conditional formatting to preserve: `[[ describe ]]`
  - Any formulas that must remain intact (e.g. running balance check, monthly totals sheet): `[[ describe ]]`
- **Ground-truth expectations** (optional but ideal): `[[ e.g. "for 3 of the sample PDFs I will also provide the correct filled Excel row output, use these as accuracy benchmarks" ]]`

---

## 2. EXPECTED OUTPUT FORMAT

The agent must ask me to confirm the exact column list and order before writing code, using this checklist:

```
- [ ] Column names (exact, case-sensitive, in order): ___
- [ ] Date format expected in output (e.g. DD/MM/YYYY vs YYYY-MM-DD): ___
- [ ] Number format for amounts (e.g. "1,234.56" vs 1234.56 as float): ___
- [ ] Debit/Credit as separate columns OR single "Amount" column with +/-: ___
- [ ] Should each bank's statement go in its own sheet, or all combined in one sheet with a "Bank" column: ___
- [ ] Header row styling to match (color, bold, borders) — extract from template or describe: ___
- [ ] Currency symbol handling (PKR, CAD, $, Rs.) — strip or keep: ___
```

---

## 3. PIPELINE ARCHITECTURE

```
project/
├── input/
│   └── statements/              # real PDFs go here for batch runs
├── samples/
│   ├── pdfs/                    # sample PDFs for testing/tuning
│   └── expected_output/         # optional ground-truth Excel rows
├── templates/
│   └── template.xlsx            # my defined Excel format
├── src/
│   ├── ocr_extractor.py         # Qwen2.5-VL model wrapper
│   ├── pdf_to_images.py         # pdf2image conversion + preprocessing
│   ├── transaction_parser.py    # JSON validation, cleaning, normalization
│   ├── excel_writer.py          # writes into template.xlsx preserving formatting
│   ├── validator.py             # balance-continuity checks, flags anomalies
│   └── pipeline.py              # orchestrates full batch run
├── tests/
│   └── test_against_samples.py  # runs pipeline on samples/, compares to expected_output/
├── config.yaml                  # model name, prompt template, column mapping
├── requirements.txt
└── README.md
```

---

## 4. BUILD INSTRUCTIONS FOR THE AGENT

### Step 1 — Confirm Excel template contract
Before writing extraction code, load `templates/template.xlsx`, inspect its columns/sheet names/styling, and print back a summary of what it detected. Confirm this matches section 2 above.

### Step 2 — PDF → Image conversion
Use `pdf2image` (Poppler backend) at 200 DPI. Handle both:
- Digital PDFs (text-based, usually 1-page-per-statement-page)
- Scanned/photographed PDFs (may need deskew/contrast normalization — use `opencv-python` for basic preprocessing if scan quality is poor)

### Step 3 — OCR/Extraction model
Use `Qwen/Qwen2.5-VL-7B-Instruct` from Hugging Face (fallback to 3B variant if GPU memory is limited — ask me which I have available).

Extraction prompt must be stored in `config.yaml`, not hardcoded, so I can tune it. Base version:

```
You are analyzing one page of a bank statement. Extract every transaction row visible.
Return ONLY a valid JSON array, no markdown, no commentary:
[
  {"date": "", "description": "", "debit": "", "credit": "", "balance": ""}
]
Rules:
- If a field is not present, use empty string "".
- Do not summarize or skip any row, including small/fee transactions.
- Preserve description text exactly as printed, do not translate or paraphrase.
- If the page has no transactions (e.g. cover page, T&Cs page), return [].
```

### Step 4 — Parsing & normalization
- Parse model JSON output defensively (strip code fences, retry once on parse failure with a stricter re-prompt).
- Normalize dates to the format confirmed in section 2.
- Normalize amounts (strip currency symbols/commas, convert to float or formatted string per my choice).
- Tag each row with `source_file` and detected/inferred `bank` name.

### Step 5 — Validation layer
- Running balance check: `previous_balance ± debit/credit == current_balance` (within rounding tolerance). Flag mismatches in a separate "⚠️ Review" column or sheet — do not silently drop them.
- Duplicate row detection (same date+description+amount appearing twice across pages, common OCR artifact at page boundaries).
- Log a per-file summary: total transactions extracted, rows flagged for review, processing time.

### Step 6 — Excel writing
Write into a **copy** of `templates/template.xlsx` (never mutate the original), preserving all existing formatting/formulas, appending data rows starting at the correct row. Do not use a fresh `openpyxl.Workbook()` unless I confirm no template styling needs preserving.

### Step 7 — Test harness
Build `tests/test_against_samples.py` that:
- Runs the full pipeline against every PDF in `samples/pdfs/`
- If `samples/expected_output/` exists, diffs extracted rows against it and prints an accuracy % per file
- Outputs a `samples_run_report.xlsx` so I can visually eyeball results before pointing it at real statements

### Step 8 — CLI entry point
```bash
python src/pipeline.py --input input/statements/ --template templates/template.xlsx --output output/consolidated.xlsx
python src/pipeline.py --test-samples   # runs against samples/ only
```

---

## 5. CONSTRAINTS

- Python 3.10+, all dependencies pinned in `requirements.txt`.
- No hardcoded file paths — everything via CLI args or `config.yaml`.
- No silent failures: any page that fails extraction gets logged to `errors.log` with the file name and page number, and processing continues for the rest of the batch.
- Must run fully locally/offline after model download (no external API calls) — confirm Qwen2.5-VL is loaded via `transformers`, not a hosted API, unless I say otherwise.
- Keep `ocr_extractor.py` model-agnostic enough that swapping to a different HF model later only requires a config change, not a rewrite.

---

## 6. FIRST DELIVERABLE

Before building the full pipeline, first:
1. Ask me for the template Excel file and sample PDFs if not already provided.
2. Run Step 1 (template contract confirmation) and show me the detected column structure.
3. Run extraction on **just 1 sample PDF** end-to-end and show me the output row(s) for my approval before scaling to full batch + all samples.

Wait for my go-ahead after each of these before proceeding to the next.
