#!/usr/bin/env node
/**
 * Generate sample PDFs for the public/samples/ directory.
 *
 * Creates two small PDFs using pdf-lib:
 *   1. sample-accessible.pdf  — tagged, titled, with lang, alt text on image
 *   2. sample-issues.pdf      — untagged, no title, no lang (demonstrates failures)
 *
 * Run: node scripts/generate-samples.js
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { PDFDocument, PDFName, PDFString, PDFDict, PDFArray, rgb, StandardFonts } from 'pdf-lib';

const OUTDIR = new URL('../public/samples/', import.meta.url).pathname;
mkdirSync(OUTDIR, { recursive: true });

async function createAccessibleSample() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Set metadata
  doc.setTitle('Accessible PDF Sample');
  doc.setAuthor('PDF-A-go');
  doc.setSubject('A minimal accessible PDF for testing');
  doc.setLanguage('en');

  // Mark as tagged
  const catalog = doc.context.lookup(doc.context.trailerInfo.Root);
  catalog.set(PDFName.of('MarkInfo'), doc.context.obj({ Marked: true }));

  // ViewerPreferences: DisplayDocTitle
  catalog.set(PDFName.of('ViewerPreferences'), doc.context.obj({ DisplayDocTitle: true }));

  // Page 1
  const page = doc.addPage([612, 792]);
  const { height } = page.getSize();

  page.drawText('Accessible PDF Sample', {
    x: 50, y: height - 60, size: 24, font: boldFont, color: rgb(0.13, 0.13, 0.13),
  });

  page.drawText('This is a sample PDF that demonstrates basic accessibility.', {
    x: 50, y: height - 100, size: 12, font, color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText('It has a title, language, and is marked as tagged.', {
    x: 50, y: height - 120, size: 12, font, color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText('Use this file to see what a mostly-passing report looks like.', {
    x: 50, y: height - 140, size: 12, font, color: rgb(0.2, 0.2, 0.2),
  });

  // Decorative rectangle (simulating a figure)
  page.drawRectangle({
    x: 50, y: height - 250, width: 200, height: 80,
    color: rgb(0.85, 0.92, 0.85), borderColor: rgb(0.4, 0.6, 0.4), borderWidth: 1,
  });
  page.drawText('[ decorative image placeholder ]', {
    x: 62, y: height - 220, size: 10, font, color: rgb(0.4, 0.6, 0.4),
  });

  return doc;
}

async function createIssuesSample() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Deliberately: no title, no language, not marked as tagged

  const page = doc.addPage([612, 792]);
  const { height } = page.getSize();

  page.drawText('PDF With Accessibility Issues', {
    x: 50, y: height - 60, size: 24, font: boldFont, color: rgb(0.13, 0.13, 0.13),
  });

  page.drawText('This PDF intentionally lacks accessibility features:', {
    x: 50, y: height - 100, size: 12, font, color: rgb(0.2, 0.2, 0.2),
  });

  const issues = [
    'No document title set',
    'No document language specified',
    'Not tagged (no structure tree)',
    'No PDF/UA identifier',
    'DisplayDocTitle not set',
  ];

  issues.forEach((issue, i) => {
    page.drawText(`  \u2022  ${issue}`, {
      x: 60, y: height - 130 - i * 20, size: 11, font, color: rgb(0.3, 0.3, 0.3),
    });
  });

  page.drawText('Use this file to see what a failing report looks like.', {
    x: 50, y: height - 270, size: 12, font, color: rgb(0.2, 0.2, 0.2),
  });

  return doc;
}

// Generate both samples
const [accessible, issues] = await Promise.all([
  createAccessibleSample(),
  createIssuesSample(),
]);

const [accessibleBytes, issuesBytes] = await Promise.all([
  accessible.save(),
  issues.save(),
]);

writeFileSync(`${OUTDIR}/sample-accessible.pdf`, accessibleBytes);
writeFileSync(`${OUTDIR}/sample-issues.pdf`, issuesBytes);

console.log(`Generated ${OUTDIR}sample-accessible.pdf (${accessibleBytes.length} bytes)`);
console.log(`Generated ${OUTDIR}sample-issues.pdf (${issuesBytes.length} bytes)`);
