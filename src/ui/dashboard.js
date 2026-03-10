/**
 * Report Dashboard — high-level report card view.
 *
 * Shows an at-a-glance summary of audit results grouped by status,
 * with action buttons to drill into the full detailed report.
 * This is the initial view shown in the results window.
 */

import { formatFileSize } from './report.js';
import { STATUS_GROUPS, groupFindings, computeVerdict } from './constants.js';
import { resolveChecklistStatus, UNDRR_CHECKLIST } from './undrr-checklist.js';
import { CREATOR_HINTS, detectCreatorTool, META_TOOLTIPS } from '../guidance.js';

/** Module-level lookup for UNDRR checklist data by number. */
const undrrLookup = new Map();
for (const entry of UNDRR_CHECKLIST) {
  undrrLookup.set(entry.undrrNumber, entry);
}

/**
 * Render the report dashboard into a container element.
 *
 * @param {HTMLElement} el - Container to render into
 * @param {object} data - Audit result { findings, meta, structureTree }
 * @param {object} callbacks
 * @param {function} callbacks.onViewFullReport - Switch to the detailed findings view
 * @param {function} callbacks.onPreviewPdf - Open the PDF preview floating panel
 * @param {function(string)} callbacks.onExport - Export in given format ('json'|'csv'|'pdf')
 * @param {function} callbacks.onUploadAnother - Open file picker for another PDF
 */
export function renderDashboard(el, data, callbacks) {
  const { findings, meta } = data;

  const groups = groupFindings(findings);
  const { overallStatus, label, description } = computeVerdict(groups);

  el.innerHTML = '';
  el.classList.add('dashboard');

  // === Verdict banner ===
  const verdict = document.createElement('div');
  verdict.className = `dashboard__verdict dashboard__verdict--${overallStatus}`;

  const verdictTitle = document.createElement('h2');
  verdictTitle.className = 'dashboard__verdict-title';
  verdictTitle.textContent = 'PDF Accessibility Report';
  verdict.appendChild(verdictTitle);

  const verdictLabel = document.createElement('div');
  verdictLabel.className = 'dashboard__verdict-label';
  verdictLabel.setAttribute('role', 'status');
  verdictLabel.textContent = label;

  const verdictDesc = document.createElement('p');
  verdictDesc.className = 'dashboard__verdict-desc';
  verdictDesc.textContent = description;

  verdict.appendChild(verdictLabel);
  verdict.appendChild(verdictDesc);
  el.appendChild(verdict);

  // === Header section ===
  const header = document.createElement('div');
  header.className = 'dashboard__header';

  // File info
  const fileInfo = document.createElement('div');
  fileInfo.className = 'dashboard__file-info';

  const fileName = document.createElement('h3');
  fileName.className = 'dashboard__file-name';
  fileName.textContent = meta.fileName || 'Unknown file';
  fileInfo.appendChild(fileName);

  // Show document title below filename when available and different
  if (meta.title) {
    const docTitle = document.createElement('p');
    docTitle.className = 'dashboard__doc-title';
    docTitle.textContent = meta.title;
    fileInfo.appendChild(docTitle);
  }

  const fileFacts = buildFileFacts(meta);
  fileInfo.appendChild(fileFacts);

  header.appendChild(fileInfo);

  // Document Properties — inline in the header for at-a-glance visibility
  const metaGrid = document.createElement('dl');
  metaGrid.className = 'dashboard__meta-grid';

  const metaItems = [
    // Accessibility-critical fields (always shown, warn when empty)
    { label: 'Title', value: meta.title, warn: !meta.title },
    { label: 'Author', value: meta.author, warn: !meta.author },
    { label: 'Subject', value: meta.subject, warn: !meta.subject },
    { label: 'Keywords', value: meta.keywords, warn: !meta.keywords },
    { label: 'Language', value: meta.lang, warn: !meta.lang },
    { label: 'Pages', value: meta.pageCount != null ? String(meta.pageCount) : 'Unknown' },
    { label: 'File Size', value: formatFileSize(meta.fileSize) },
    { label: 'Tagged', value: meta.isTagged ? 'Yes' : 'No', warn: !meta.isTagged },
    { label: 'PDF/UA', value: meta.isPdfUA ? 'Yes' : 'No' },
    { label: 'PDF/A', value: meta.isPdfA ? `Yes (${meta.pdfALevel || 'level unknown'})` : 'No' },
    { label: 'Viewer Shows Title', value: meta.displayDocTitle ? 'Yes' : 'No' },
    { label: 'Structure Tree', value: meta.hasStructTree ? 'Yes' : 'No' },
  ];

  // Tool metadata (only shown when present)
  if (meta.creator) metaItems.push({ label: 'Creator', value: meta.creator });
  if (meta.producer) metaItems.push({ label: 'Producer', value: meta.producer });

  for (const item of metaItems) {
    const dt = document.createElement('dt');
    dt.textContent = item.label;
    const tooltip = META_TOOLTIPS[item.label];
    if (tooltip) {
      dt.setAttribute('data-tooltip', tooltip);
      dt.setAttribute('title', tooltip);
      dt.setAttribute('tabindex', '0');
      dt.classList.add('has-tooltip');
    }
    const dd = document.createElement('dd');
    dd.textContent = item.value || 'Not set';
    if (item.warn) {
      dd.className = 'dashboard__meta-warn';
    }
    metaGrid.appendChild(dt);
    metaGrid.appendChild(dd);
  }

  header.appendChild(metaGrid);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'dashboard__actions';

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'toolbar-btn dashboard__action-btn dashboard__action-btn--primary';
  downloadBtn.textContent = 'Download Report';
  downloadBtn.addEventListener('click', () => callbacks.onExport('pdf'));
  actions.appendChild(downloadBtn);

  const viewBtn = document.createElement('button');
  viewBtn.type = 'button';
  viewBtn.className = 'toolbar-btn dashboard__action-btn';
  viewBtn.textContent = 'View Advanced Report';
  viewBtn.addEventListener('click', () => callbacks.onViewFullReport());
  actions.appendChild(viewBtn);

  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.className = 'toolbar-btn dashboard__action-btn';
  previewBtn.textContent = 'Preview PDF';
  previewBtn.addEventListener('click', () => callbacks.onPreviewPdf());
  actions.appendChild(previewBtn);

  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.className = 'toolbar-btn dashboard__action-btn';
  uploadBtn.textContent = 'Upload Another PDF';
  uploadBtn.addEventListener('click', () => callbacks.onUploadAnother());
  actions.appendChild(uploadBtn);

  header.appendChild(actions);
  el.appendChild(header);

  // === Creator-specific hint ===
  const toolKey = detectCreatorTool(meta);
  if (toolKey && CREATOR_HINTS[toolKey]) {
    const hintData = CREATOR_HINTS[toolKey];
    const hintBanner = document.createElement('div');
    hintBanner.className = 'dashboard__creator-hint';
    hintBanner.setAttribute('role', 'note');

    const hintLabel = document.createElement('strong');
    hintLabel.textContent = `Created with ${hintData.tool}: `;
    hintBanner.appendChild(hintLabel);

    const hintText = document.createTextNode(hintData.hint);
    hintBanner.appendChild(hintText);
    el.appendChild(hintBanner);
  }

  // === UNDRR Validation Checklist ===
  const checklistItems = resolveChecklistStatus(findings);
  const checklistSection = document.createElement('section');
  checklistSection.className = 'dashboard__checklist-section';
  checklistSection.setAttribute('aria-label', 'Validation Checklist');

  const checklistHeading = document.createElement('h3');
  checklistHeading.className = 'dashboard__section-heading';
  checklistHeading.textContent = 'Validation Checklist';
  checklistSection.appendChild(checklistHeading);

  // Progress indicator — count of automated checks that pass
  const automatedItems = checklistItems.filter(i => i.status !== 'not-checked');
  const passCount = automatedItems.filter(i => i.status === 'pass').length;
  const progressP = document.createElement('p');
  progressP.className = 'dashboard__checklist-progress';
  progressP.textContent = `${passCount} of ${automatedItems.length} automated checks pass`;
  checklistSection.appendChild(progressP);

  const checklistGrid = document.createElement('div');
  checklistGrid.className = 'dashboard__checklist';

  for (const item of checklistItems) {
    const undrrData = undrrLookup.get(item.undrrNumber);

    // Expandable checklist item using details/summary
    const details = document.createElement('details');
    details.className = 'dashboard__checklist-item';

    const summary = document.createElement('summary');
    summary.className = 'dashboard__checklist-summary';

    const number = document.createElement('span');
    number.className = `dashboard__checklist-number dashboard__checklist-number--${item.status}`;
    number.textContent = String(item.undrrNumber);

    const titleWrap = document.createElement('span');
    titleWrap.className = 'dashboard__checklist-title';
    titleWrap.textContent = item.title;

    // Show contextual summary for N/A and not-checked items
    if ((item.status === 'not-applicable' || item.status === 'not-checked') && item.summary) {
      const reason = document.createElement('span');
      reason.className = 'dashboard__checklist-reason';
      reason.textContent = item.summary;
      titleWrap.appendChild(document.createElement('br'));
      titleWrap.appendChild(reason);
    }

    const statusIndicator = document.createElement('span');
    statusIndicator.className = `dashboard__checklist-status dashboard__checklist-status--${item.status}`;
    statusIndicator.textContent = checklistStatusLabel(item.status);
    statusIndicator.setAttribute('aria-label', `${checklistStatusLabel(item.status)}`);

    summary.appendChild(number);
    summary.appendChild(titleWrap);
    summary.appendChild(statusIndicator);
    details.appendChild(summary);

    // Expanded body — Why This Matters + authoring tips
    if (undrrData) {
      const body = document.createElement('div');
      body.className = 'dashboard__checklist-body';

      if (undrrData.whyItMatters) {
        const whyHeading = document.createElement('strong');
        whyHeading.textContent = 'Why This Matters';
        body.appendChild(whyHeading);

        const whyP = document.createElement('p');
        whyP.className = 'dashboard__checklist-why';
        whyP.textContent = undrrData.whyItMatters;
        body.appendChild(whyP);
      }

      if (undrrData.authoringTips && undrrData.authoringTips.general) {
        const tipP = document.createElement('p');
        tipP.className = 'dashboard__checklist-tip';
        tipP.textContent = undrrData.authoringTips.general;
        body.appendChild(tipP);
      }

      details.appendChild(body);
    }

    checklistGrid.appendChild(details);
  }

  checklistSection.appendChild(checklistGrid);
  el.appendChild(checklistSection);

  // === Status group sections ===
  for (const group of STATUS_GROUPS) {
    const items = groups[group.key];
    if (items.length === 0) continue;

    const section = document.createElement('section');
    section.className = 'dashboard__section';
    section.setAttribute('aria-label', group.heading);

    const heading = document.createElement('h3');
    heading.className = 'dashboard__section-heading';
    heading.textContent = `${group.heading} \u00B7 `;
    const countSpan = document.createElement('span');
    countSpan.textContent = `${items.length} check${items.length !== 1 ? 's' : ''}`;
    heading.appendChild(countSpan);
    section.appendChild(heading);

    const content = document.createElement('div');
    content.className = `dashboard__section-content dashboard__section-content--${group.density}`;

    if (group.density === 'full') {
      // Full-width rows for fail and warning findings
      for (const f of items) {
        const row = document.createElement('div');
        row.className = 'dashboard__finding-row';

        row.appendChild(statusBadge(f.status, group.icon));

        const info = document.createElement('div');
        info.className = 'dashboard__finding-info';

        const title = document.createElement('strong');
        title.className = 'dashboard__finding-title';
        title.textContent = f.title;
        info.appendChild(title);

        const summaryP = document.createElement('p');
        summaryP.className = 'dashboard__finding-summary';
        summaryP.textContent = f.summary;
        info.appendChild(summaryP);

        // Remediation hint — first sentence of remediation text
        if (f.remediation) {
          const hint = document.createElement('p');
          hint.className = 'dashboard__finding-hint';
          hint.textContent = firstSentence(f.remediation);
          info.appendChild(hint);
        }

        row.appendChild(info);
        content.appendChild(row);
      }
    } else if (group.density === 'compact') {
      // Compact cards for manual review
      for (const f of items) {
        const card = document.createElement('div');
        card.className = 'dashboard__finding-compact';

        card.appendChild(statusBadge(f.status, group.icon));

        const title = document.createElement('strong');
        title.className = 'dashboard__finding-title';
        title.textContent = f.title;
        card.appendChild(title);

        const summary = document.createElement('p');
        summary.className = 'dashboard__finding-summary';
        summary.textContent = f.summary;
        card.appendChild(summary);

        content.appendChild(card);
      }
    } else {
      // Chip list for pass and not-applicable
      for (const f of items) {
        const chip = document.createElement('span');
        chip.className = `dashboard__chip dashboard__chip--${group.key}`;
        chip.textContent = `${group.icon} ${f.title}`;
        content.appendChild(chip);
      }
    }

    section.appendChild(content);
    el.appendChild(section);
  }

}

/** Create a decorative status badge (aria-hidden). */
function statusBadge(status, icon) {
  const badge = document.createElement('span');
  badge.className = `status-badge status-badge--${status}`;
  badge.textContent = icon;
  badge.setAttribute('aria-hidden', 'true');
  return badge;
}

/** Map a checklist item status to a short display label. */
function checklistStatusLabel(status) {
  switch (status) {
    case 'pass': return 'Pass';
    case 'fail': return 'Fail';
    case 'warning': return 'Warn';
    case 'manual': return 'Manual';
    case 'not-applicable': return 'N/A';
    case 'not-checked': return '--';
    default: return status;
  }
}

/** Extract the first sentence from a string. */
function firstSentence(text) {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0] : text;
}

/**
 * Build the file facts line (pages, size, tagged, language).
 */
function buildFileFacts(meta) {
  const parts = [];
  if (meta.pageCount != null) parts.push(`${meta.pageCount} page${meta.pageCount !== 1 ? 's' : ''}`);
  if (meta.fileSize) parts.push(formatFileSize(meta.fileSize));
  if (meta.isTagged) parts.push('Tagged');
  if (meta.isPdfUA) parts.push('PDF/UA');
  if (meta.lang) parts.push(meta.lang);

  const p = document.createElement('p');
  p.className = 'dashboard__file-facts';
  p.textContent = parts.join(' \u00B7 ');
  return p;
}
