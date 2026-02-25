# Test PDF Sources --Comprehensive Reference

Complete catalog of CORS-friendly test PDFs available for accessibility testing. This reference documents both the PDFs we use in the Advanced menu (`src/ui/dev-test-pdfs.js`) and the many additional PDFs available for future use.

All URLs use `cdn.jsdelivr.net` which serves with `Access-Control-Allow-Origin: *`. See `docs/learnings.md` for CORS domain details.

---

## Quick Stats

| Repository | Available PDFs | Currently Used |
|---|---|---|
| veraPDF PDF/UA-1 corpus | ~210 | 22 |
| PDF Association techniques | ~50 | 7 |
| OpenPreserve Cabinet of Horrors | ~30 | 3 |
| **Total** | **~290** | **32** |

---

## Repository 1: veraPDF PDF/UA-1 Test Corpus

- **Repo:** [veraPDF/veraPDF-corpus](https://github.com/veraPDF/veraPDF-corpus) (staging branch, `PDF_UA-1/` directory)
- **License:** CC BY 4.0 / GPLv3+ (dual-licensed)
- **CDN base:** `https://cdn.jsdelivr.net/gh/veraPDF/veraPDF-corpus@staging/PDF_UA-1`
- **Naming:** `{section}-t{test}-{pass|fail}-{variant}.pdf`

### Section 5 --Version Identification (PDF/UA conformance marker)

Tests for the PDF/UA conformance declaration in XMP metadata.

| File | Status | Used? |
|---|---|---|
| `5-t01-pass-a.pdf` | pass | **Yes** |
| `5-t01-fail-a.pdf` | fail | **Yes** |
| `5-t02-pass-a.pdf` | pass | |
| `5-t02-fail-a.pdf` | fail | |
| `5-t03-pass-a.pdf` | pass | |
| `5-t03-fail-a.pdf` | fail | |
| `5-t04-pass-a.pdf` | pass | |
| `5-t04-fail-a.pdf` | fail | |
| `5-t05-pass-a.pdf` | pass | |
| `5-t05-fail-a.pdf` | fail | |

Path: `5%20Version%20identification/{file}`

### Section 7.1 --General (Metadata, Tagging, Language, Title)

Core document-level requirements: tagged PDF, MarkInfo, language, title, DisplayDocTitle.

| File | What it tests | Status | Used? |
|---|---|---|---|
| `7.1-t01-pass-a.pdf` | Tagged PDF (MarkInfo) | pass | **Yes** |
| `7.1-t01-fail-a.pdf` | Not tagged | fail | **Yes** |
| `7.1-t01-pass-b.pdf` | Tagged PDF (variant) | pass | |
| `7.1-t02-pass-a.pdf` | StructTreeRoot | pass | |
| `7.1-t02-pass-b.pdf` | StructTreeRoot (variant) | pass | |
| `7.1-t02-fail-a.pdf` | StructTreeRoot missing | fail | |
| `7.1-t03-pass-a.pdf` | Language set | pass | **Yes** |
| `7.1-t03-fail-a.pdf` | Language missing | fail | **Yes** |
| `7.1-t03-pass-b.pdf` | Language (variant) | pass | |
| `7.1-t03-fail-b.pdf` | Language (variant) | fail | |
| `7.1-t04-pass-a.pdf` | Title set | pass | **Yes** |
| `7.1-t04-fail-a.pdf` | Title missing | fail | **Yes** |
| `7.1-t05-pass-a.pdf` | Suspect flag false | pass | |
| `7.1-t05-pass-b.pdf` | Suspect flag absent | pass | |
| `7.1-t05-fail-a/b/c/d.pdf` | Suspect flag true variants | fail | |
| `7.1-t06-pass-a.pdf` | DisplayDocTitle set | pass | **Yes** |
| `7.1-t06-fail-a.pdf` | DisplayDocTitle missing | fail | **Yes** |
| `7.1-t07-pass-a.pdf` | Content fully tagged (pass) | pass | |
| `7.1-t07-fail-a.pdf` | Content not fully tagged | fail | |
| `7.1-t08-pass-a.pdf` | StructParents | pass | |
| `7.1-t08-fail-a.pdf` | StructParents missing | fail | |
| `7.1-t09-pass-a.pdf` | Artifact handling | pass | |
| `7.1-t09-fail-a.pdf` | Artifact handling wrong | fail | |
| `7.1-t10-pass-a/b.pdf` | Role mapping | pass | |
| `7.1-t10-fail-a/b.pdf` | Role mapping wrong | fail | |
| `7.1-t11-fail-a.pdf` | Circular role mapping | fail | |

Path: `7.1%20General/{file}`

### Section 7.2 --Text (~110 PDFs)

Extensive text handling tests: character encoding, Unicode mapping, ActualText, font usage. ~110 files across tests t02-t43 with multiple variants. Too many to list individually.

Path: `7.2%20Text/{file}`

**Highlights for future use:**
- `7.2-t02` --Basic text string extraction
- `7.2-t29` --ActualText attribute (10 pass + fail variants)
- `7.2-t36-t43` --Composite fonts, ligatures, complex scripts

### Section 7.3 --Graphics (Images/Alt Text)

| File | Status | Used? |
|---|---|---|
| `7.3-t01-pass-a.pdf` | pass | **Yes** |
| `7.3-t01-pass-b.pdf` | pass | |
| `7.3-t01-pass-c.pdf` | pass | |
| `7.3-t01-fail-a.pdf` | fail | **Yes** |
| `7.3-t01-fail-b.pdf` | fail | |

Path: `7.3%20Graphics/{file}`

### Section 7.4 --Headings

#### 7.4.2 Numbered Headings (H1-H6)

| File | Status | Used? |
|---|---|---|
| `7.4.2-t01-pass-a/b/c/d.pdf` | pass | |
| `7.4.2-t01-fail-a/b.pdf` | fail | |

Path: `7.4%20Headings/7.4.2%20Numbered%20headings/{file}`

#### 7.4.4 Unnumbered Headings

| File | Status | Used? |
|---|---|---|
| `7.4.4-t01-pass-a.pdf` | pass | |
| `7.4.4-t01-fail-a.pdf` | fail | |
| `7.4.4-t02-pass-a/b.pdf` | pass | |
| `7.4.4-t02-fail-a.pdf` | fail | |
| `7.4.4-t03-pass-a.pdf` | pass | |
| `7.4.4-t03-fail-a/b.pdf` | fail | |

Path: `7.4%20Headings/7.4.4%20Unnumbered%20headings/{file}`

### Section 7.5 --Tables

| File | Status | Used? |
|---|---|---|
| `7.5-t01-pass-a.pdf` | pass | **Yes** |
| `7.5-t01-pass-b/c/d/e.pdf` | pass | |
| `7.5-t01-fail-a.pdf` | fail | **Yes** |
| `7.5-t01-fail-b.pdf` | fail | |
| `7.5-t02-fail-a.pdf` | fail | |

Path: `7.5%20Tables/{file}`

### Section 7.7 --Mathematical Expressions

| File | Status | Used? |
|---|---|---|
| `7.7-t01-pass-a/b/c.pdf` | pass | |
| `7.7-t01-fail-a/b.pdf` | fail | |

Path: `7.7%20Mathematical%20expressions/{file}`

### Section 7.9 --Notes and References

| File | Status | Used? |
|---|---|---|
| `7.9-t01-pass-a.pdf` | pass | |
| `7.9-t01-fail-a/b.pdf` | fail | |
| `7.9-t02-pass-a.pdf` | pass | |
| `7.9-t02-fail-a.pdf` | fail | |

Path: `7.9%20Notes%20and%20references/{file}`

### Section 7.10 --Optional Content

| File | Status | Used? |
|---|---|---|
| `7.10-t01-pass-a.pdf` | pass | |
| `7.10-t01-fail-a/b.pdf` | fail | |
| `7.10-t02-pass-a.pdf` | pass | |
| `7.10-t02-fail-a.pdf` | fail | |

Path: `7.10%20Optional%20content/{file}`

### Section 7.11 --Embedded Files

| File | Status | Used? |
|---|---|---|
| `7.11-t01-pass-a.pdf` | pass | |
| `7.11-t01-fail-a/b.pdf` | fail | |

Path: `7.11%20Embedded%20files/{file}`

### Section 7.15 --XFA

| File | Status | Used? |
|---|---|---|
| `7.15-t01-fail-a.pdf` | fail | |

Path: `7.15%20XFA/{file}`

### Section 7.16 --Security (Encryption Permissions)

| File | Status | Used? |
|---|---|---|
| `7.16-t01-pass-a.pdf` | pass | **Yes** |
| `7.16-t01-fail-a.pdf` | fail | **Yes** |

Path: `7.16%20Security/{file}`

### Section 7.18 --Annotations (Forms, Links, Tab Order)

This is the largest section with ~44 test PDFs. Critical for form, link, and tab order testing.

#### 7.18.1 General (Annotation structure, TU tooltips)

| File | What it tests | Status | Used? |
|---|---|---|---|
| `7.18.1-t01-pass-a/b/c.pdf` | Annotation in structure tree | pass | |
| `7.18.1-t01-fail-a.pdf` | Annotation not in structure | fail | |
| `7.18.1-t02-pass-a` through `h.pdf` | Annotation types correct | pass | |
| `7.18.1-t02-fail-a/b/c.pdf` | Annotation types wrong | fail | |
| `7.18.1-t03-pass-a` through `f.pdf` | TU tooltip / Contents | pass | **Yes** (pass-a) |
| `7.18.1-t03-fail-a` through `d.pdf` | TU tooltip missing | fail | **Yes** (fail-a) |

Path: `7.18%20Annotations/7.18.1%20General/{file}`

#### 7.18.2 Annotation Types

| File | Status | Used? |
|---|---|---|
| `7.18.2-t01-fail-a.pdf` | fail | |

Path: `7.18%20Annotations/7.18.2%20Annotation%20types/{file}`

#### 7.18.3 Tab Order

| File | Status | Used? |
|---|---|---|
| `7.18.3-t01-pass-a.pdf` | pass | **Yes** |
| `7.18.3-t01-fail-a.pdf` | fail | **Yes** |
| `7.18.3-t01-fail-b.pdf` | fail | |

Path: `7.18%20Annotations/7.18.3%20Tab%20order/{file}`

#### 7.18.4 Forms

| File | Status | Used? |
|---|---|---|
| `7.18.4-t01-pass-a.pdf` | pass | **Yes** |
| `7.18.4-t01-fail-a.pdf` | fail | **Yes** |

Path: `7.18%20Annotations/7.18.4%20Forms/{file}`

#### 7.18.5 Links

| File | Status | Used? |
|---|---|---|
| `7.18.5-t01-pass-a.pdf` | pass | **Yes** |
| `7.18.5-t01-pass-b.pdf` | pass | |
| `7.18.5-t01-fail-a.pdf` | fail | **Yes** |
| `7.18.5-t02-pass-a.pdf` | pass | **Yes** |
| `7.18.5-t02-fail-a.pdf` | fail | **Yes** |
| `7.18.5-t02-fail-b.pdf` | fail | |

Path: `7.18%20Annotations/7.18.5%20Links/{file}`

#### 7.18.6.2 Media Clip Data

| File | Status | Used? |
|---|---|---|
| `7.18.6.2-t01-pass-a.pdf` | pass | |
| `7.18.6.2-t02-pass-a.pdf` | pass | |
| `7.18.6.2-t01-fail-a.pdf` | fail | |
| `7.18.6.2-t02-fail-a/b.pdf` | fail | |

Path: `7.18%20Annotations/7.18.6%20Media/7.18.6.2%20Media%20clip%20data/{file}`

#### 7.18.7 File Attachments

| File | Status | Used? |
|---|---|---|
| `7.18.7-t01-pass-a.pdf` | pass | |
| `7.18.7-t01-fail-a/b/c/d.pdf` | fail | |

Path: `7.18%20Annotations/7.18.7%20File%20Attachments/{file}`

#### 7.18.8 PrinterMark

| File | Status | Used? |
|---|---|---|
| `7.18.8-t01-fail-a.pdf` | fail | |

Path: `7.18%20Annotations/7.18.8%20PrinterMark/{file}`

### Section 7.20 --XObjects

| File | Status | Used? |
|---|---|---|
| `7.20-t01-pass-a.pdf` | pass | |
| `7.20-t02-pass-a.pdf` | pass | |
| `7.20-t01-fail-a.pdf` | fail | |
| `7.20-t02-fail-a.pdf` | fail | |

Path: `7.20%20XObjects/{file}`

### Section 7.21 --Fonts (~30 PDFs)

#### 7.21.3.1 Composite Fonts --General

| File | Status | Used? |
|---|---|---|
| `7.21.3.1-t01-pass-a/b/c/d.pdf` | pass | |
| `7.21.3.1-t01-fail-a/b/c.pdf` | fail | |

Path: `7.21%20Fonts/7.21.3%20Composite%20fonts/7.21.3.1%20General/{file}`

#### 7.21.4.1 Font Embedding --General

| File | Status | Used? |
|---|---|---|
| `7.21.4.1-t01-pass-a.pdf` | pass | **Yes** |
| `7.21.4.1-t01-fail-a.pdf` | fail | **Yes** |

Path: `7.21%20Fonts/7.21.4%20Embedding/7.21.4.1%20General/{file}`

#### 7.21.4.2 Font Subset Embedding

| File | Status | Used? |
|---|---|---|
| `7.21.4.2-t01-pass-a.pdf` | pass | |
| `7.21.4.2-t02-pass-a.pdf` | pass | |
| `7.21.4.2-t01-fail-a/b.pdf` | fail | |
| `7.21.4.2-t02-fail-a.pdf` | fail | |

Path: `7.21%20Fonts/7.21.4%20Embedding/7.21.4.2%20Subset%20embedding/{file}`

#### 7.21.5 Font Metrics

| File | Status | Used? |
|---|---|---|
| `7.21.5-t01-pass-a.pdf` | pass | |
| `7.21.5-t01-fail-a.pdf` | fail | |

Path: `7.21%20Fonts/7.21.5%20Font%20metrics/{file}`

#### 7.21.6 Character Encodings (~10 PDFs)

| File | Status | Used? |
|---|---|---|
| `7.21.6-t02-pass-a/b/c/d.pdf` | pass | |
| `7.21.6-t03-pass-a.pdf` | pass | |
| `7.21.6-t02-fail-a/b/c/d.pdf` | fail | |
| `7.21.6-t03-fail-a.pdf` | fail | |

Path: `7.21%20Fonts/7.21.6%20Character%20encodings/{file}`

#### 7.21.7 Unicode Character Maps (ToUnicode CMap)

| File | Status | Used? |
|---|---|---|
| `7.21.7-t01-pass-a.pdf` | pass | **Yes** |
| `7.21.7-t01-pass-b/c.pdf` | pass | |
| `7.21.7-t01-fail-a.pdf` | fail | **Yes** |
| `7.21.7-t02-pass-a.pdf` | pass | |
| `7.21.7-t02-fail-a/b/c.pdf` | fail | |

Path: `7.21%20Fonts/7.21.7%20Unicode%20character%20maps/{file}`

#### 7.21.8 Use of .notdef Glyph

| File | Status | Used? |
|---|---|---|
| `7.21.8-t01-fail-a.pdf` | fail | |

Path: `7.21%20Fonts/7.21.8%20Use%20of%20.notdef%20glyph/{file}`

---

## Repository 2: PDF Association --Techniques for Accessible PDF

- **Repo:** [pdf-association/techniques-for-accessible-pdf](https://github.com/pdf-association/techniques-for-accessible-pdf)
- **License:** CC BY 4.0
- **CDN base:** `https://cdn.jsdelivr.net/gh/pdf-association/techniques-for-accessible-pdf@main`
- **Naming:** `UA1_Tpdf-{code}.pdf` where code = `{Category}_{number}` (pass) or `{Category}_F{number}` (fail)

### Fundamentals --Basic Technical Rules (G1)

| Code | Description | Status | Used? |
|---|---|---|---|
| G1_01 | Custom tag correctly role-mapped | pass | **Yes** |
| G1_F01 | Custom tag role map missing | fail | **Yes** |

Path: `fundamentals/1-basic-technical-rules/{technique-folder}/UA1_Tpdf-{code}.pdf`

### Fundamentals --Text (G2)

| Code | Description | Status | Used? |
|---|---|---|---|
| G2_01 | Text content correctly tagged (one container) | pass | |
| G2_02 | Text tagged one container per word | pass | |
| G2_03 | Text tagged one container per character | pass | |
| G2_04 | Special character with correct Unicode mapping | pass | |
| G2_05 | Graphics representing text correctly tagged | pass | |
| G2_06 | ActualText provides correct extractable characters | pass | |
| G2_F01 | Special character missing Unicode mapping | fail | |
| G2_F02 | Special character with incorrect Unicode mapping | fail | |
| G2_F03 | Graphics representing text incorrectly tagged as figure | fail | |
| G2_F04 | Extractable characters not present | fail | |

Path: `fundamentals/2-text/{technique-folder}/UA1_Tpdf-{code}.pdf`

### Fundamentals --Content (G3)

| Code | Description | Status | Used? |
|---|---|---|---|
| G3_01 | Real content correctly tagged | pass | |
| G3_02 | Decorative content correctly marked as artifact | pass | |
| G3_F01 | Real content not tagged | fail | |
| G3_F02 | Real content incorrectly tagged | fail | |
| G3_F03 | Decorative content incorrectly tagged as figure | fail | |
| G3_F04 | Decorative content not marked as artifact | fail | |

Path: `fundamentals/3-content/{technique-folder}/UA1_Tpdf-{code}.pdf`

### Fundamentals --Logical Content Order (G4)

Includes tab order tests relevant to our Forms audit.

| Code | Description | Status | Used? |
|---|---|---|---|
| G4_01 | Content order correctly set | pass | |
| G4_02 | Marked content sequences order correct | pass | |
| G4_03 | Content in columns correctly ordered | pass | |
| G4_04 | Sidebar correctly located in content order | pass | |
| G4_05 | Tab order for pages with annotations correctly set | pass | |
| G4_F01 | Content order incorrectly set | fail | |
| G4_F02 | Marked content sequences order incorrect | fail | |
| G4_F03 | Content in columns incorrectly ordered | fail | |
| G4_F04 | Sidebar incorrectly located in content order | fail | |
| G4_F05 | Content order within marked content sequence incorrect | fail | |
| G4_F06 | Tab order for pages with annotations incorrectly set | fail | |
| G4_F07 | Tab order for pages with annotations missing | fail | |

Path: `fundamentals/4-logical-content-order/{technique-folder}/UA1_Tpdf-{code}.pdf`

### Fundamentals --Appropriate Semantics (G5)

| Code | Description | Status | Used? |
|---|---|---|---|
| G5_01 | H1 heading appropriately tagged | pass | |
| G5_02 | Similar real content appropriately tagged | pass | |
| G5_03 | Visually separated content appropriately tagged | pass | |
| G5_04 | Multiline heading appropriately tagged | pass | |
| G5_F01 | H1 heading inappropriately tagged | fail | |
| G5_F02 | Similar real content inappropriately tagged | fail | |
| G5_F03 | Single semantic unit inappropriately tagged | fail | |
| G5_F04 | Visually separated content inappropriately tagged | fail | |
| G5_F05 | Multiline heading inappropriately tagged | fail | |
| G5_F06 | Table header cell inappropriately tagged | fail | |

Path: `fundamentals/5-appropriate-semantics/{technique-folder}/UA1_Tpdf-{code}.pdf`

### Headings (H)

| Code | Description | Status | Used? |
|---|---|---|---|
| H_01 | Top-level heading correctly tagged as H1 | pass | |
| H_02 | Multiline heading correctly tagged | pass | |
| H_03 | Headings with different levels correctly tagged | pass | **Yes** |
| H_04 | Image correctly tagged as heading | pass | |
| H_05 | Heading levels correctly not skipped | pass | |
| H_06 | Subtitle correctly tagged | pass | |
| H_07 | Title in page content correctly tagged | pass | |
| H_08 | Heading level 7 correctly role-mapped to P | pass | |
| H_09 | Heading level 7 correctly role-mapped to H6 | pass | |
| H_F01 | Top-level heading incorrectly tagged as P | fail | |
| H_F02 | Multiline heading incorrectly tagged | fail | |
| H_F03 | Paragraph incorrectly tagged as H2 | fail | |
| H_F04 | Headings used instead of table header cells | fail | |
| H_F05 | First heading incorrectly tagged as H3 | fail | **Yes** |
| H_F06 | Incorrect combined use of Hn and H tags | fail | |
| H_F07 | Both title and heading incorrectly tagged as H1 | fail | |
| H_F08 | Heading level incorrectly skipped | fail | **Yes** |

Path: `headings/{technique-folder}/UA1_Tpdf-{code}.pdf`

### Lists (L)

| Code | Description | Status | Used? |
|---|---|---|---|
| L_01 | Unordered list | pass | **Yes** |
| L_02 | Ordered list with UpperRoman ListNumbering | pass | |
| L_03 | Ordered list with Decimal ListNumbering | pass | |
| L_04 | Unordered list with decorative images as bullets | pass | |
| L_05 | Multi-level list correctly tagged | pass | |
| L_06 | List with semantic images as bullets | pass | |
| L_07 | Three unordered lists with ListNumbering not set | pass | |
| L_08 | Three unordered lists with ListNumbering set to None | pass | |
| L_09 | Caption for List correctly tagged | pass | |
| L_10 | Inline List correctly tagged | pass | |
| L_11 | List item spanning 2 pages correctly tagged | pass | |
| L_12 | Hierarchical list correctly tagged | pass | |
| L_13 | List item with substructure correctly tagged | pass | |
| L_14 | Description list correctly tagged | pass | |
| L_15 | List spanning 2 pages correctly tagged | pass | |
| L_F01 | List item content not tagged in LBody | fail | |
| L_F02 | List incorrectly tagged without Lbl | fail | |
| L_F03 | List items with incorrect nesting | fail | |
| L_F04 | Single-item list (questionable use) | fail | |
| L_F05 | Nested list not in LBody | fail | **Yes** |
| L_F06 | List incorrectly tagged as paragraphs | fail | **Yes** |
| L_F07 | Ordered list with wrong ListNumbering | fail | |
| L_F08 | Description list incorrectly tagged | fail | |
| L_F09 | Caption for list incorrectly tagged | fail | |
| L_F10 | Inline list incorrectly tagged | fail | |

Path: `list/{technique-folder}/UA1_Tpdf-{code}.pdf`

---

## Repository 3: OpenPreserve "Cabinet of Horrors"

- **Repo:** [openpreserve/format-corpus](https://github.com/openpreserve/format-corpus) (`pdfCabinetOfHorrors/` directory)
- **License:** CC0 1.0 (public domain)
- **CDN base:** `https://cdn.jsdelivr.net/gh/openpreserve/format-corpus@master/pdfCabinetOfHorrors`

### Encryption Variants

| File | Description | Used? |
|---|---|---|
| `encryption_openpassword.pdf` | Open password required | |
| `encryption_nocopy.pdf` | Copy permission denied | |
| `encryption_noprinting.pdf` | Print permission denied | |
| `encryption_notextaccess.pdf` | Text access denied (accessibility bit) | |

### Font Embedding Variants

| File | Description | Used? |
|---|---|---|
| `text_only_fontsNotEmbedded.pdf` | No fonts embedded at all | **Yes** |
| `text_only_fontsEmbeddedAll.pdf` | All fonts fully embedded | |
| `text_only_fontsEmbeddedSubset.pdf` | Fonts subset-embedded | |
| `test_fontArialNotEmbedded.pdf` | Arial specifically not embedded | |
| `calistoMTNoFontsEmbedded.pdf` | Calisto MT not embedded | |

### PDF/A Conformance

| File | Description | Used? |
|---|---|---|
| `text_only_pdfa1b.pdf` | PDF/A-1b conformance | **Yes** |

### Corruption / Malformation

| File | Description | Used? |
|---|---|---|
| `corruptionOneByteMissing.pdf` | Truncated file (1 byte) | **Yes** |
| `pdf-17-header18.pdf` | Wrong PDF version header | |

### Multimedia

| File | Description | Used? |
|---|---|---|
| `embedded_video_avi.pdf` | Embedded AVI video | |
| `embedded_video_quicktime.pdf` | Embedded QuickTime video | |

### Other

| File | Description | Used? |
|---|---|---|
| `javascript.pdf` | Contains embedded JavaScript | |
| `fileAttachment.pdf` | File attachment | |
| `fileAttachment_fileAttachmentAnnotation.pdf` | Annotation-based attachment | |
| `externalLink.pdf` | External link | |
| `webCapture.pdf` | Web capture content | |
| `digitally_signed_3D_Portfolio.pdf` | Digital signatures + 3D | |

---

## Coverage Map: Audit Checks vs Test PDFs

Maps each audit module's finding IDs to available test PDFs.

| Finding ID | Audit Module | Test PDFs in Menu | Additional Available |
|---|---|---|---|
| `metadata-title` | metadata | 2 (pass/fail) | - |
| `metadata-language` | metadata | 2 (pass/fail) | 2 variants |
| `metadata-display-doc-title` | metadata | 2 (pass/fail) | - |
| `structure-tagged` | structure | 2 (pass/fail) | 1 variant |
| `structure-role-map` | structure | 2 (pass/fail) | ~4 (7.1-t10) |
| `images-alt-text` | images | 2 (pass/fail) | 3 variants |
| `headings-hierarchy` | structure | 3 (1 pass, 2 fail) | 14 PDF Association + 14 veraPDF |
| `tables-headers` | tables | 2 (pass/fail) | 6 variants |
| `lists-structure` | lists | 3 (1 pass, 2 fail) | 22 more from PDF Association |
| `fonts-tounicode` | fonts | 2 (pass/fail) | ~6 variants |
| `fonts-embedding` | fonts | 2 (pass/fail) | ~12 (veraPDF + Cabinet of Horrors) |
| `form-labels` | forms | 4 (2 pass, 2 fail) | ~20 (7.18.1) |
| `link-text` | links | 4 (2 pass, 2 fail) | 2 variants |
| `tab-order` | forms | 2 (pass/fail) | 1 fail variant + 3 PDF Association |
| `security-permissions` | metadata | 2 (pass/fail) | 4 Cabinet of Horrors encryption |
| `bookmarks` | metadata | 0 | None found in test repos |
| `reading-order` | reading-order | 0 (manual check) | 12 PDF Association (G4) |
| `screen-reader` | reading-order | 0 (manual check) | N/A |
| `conformance` | metadata | 2 (pass/fail) | 8 more (section 5) |

### Gaps Still Unfilled

- **Bookmarks (`/Outlines`)** --No test PDFs found in any of the three repos. Would need to create custom fixtures or find another source.

---

## Notes on URL Encoding

veraPDF corpus paths contain spaces that must be URL-encoded as `%20`:
- `7.1 General` → `7.1%20General`
- `7.18 Annotations` → `7.18%20Annotations`
- `7.21.4 Embedding` → `7.21.4%20Embedding`

PDF Association paths use hyphens (no encoding needed):
- `H_F05-First-level-heading-incorrectly-tagged-as-H3-instead-of-H1`

---

*Last updated: 2026-02-25*
