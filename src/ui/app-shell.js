/**
 * App shell — dockview-core panel layout.
 *
 * Creates the dockview panel system and manages layout transitions
 * between drop-zone view and report view.
 */
import { DockviewComponent, themeLight } from 'dockview-core';
import { state } from './state.js';
import { renderSummaryPanel } from './report.js';
import { renderFindingsPanel } from './findings-list.js';
import { renderDetailsPanel } from './details.js';
import { renderTreeExplorer } from './tree-explorer.js';
import { renderFontTable } from './font-table.js';
import { renderImageTable } from './image-table.js';

import 'dockview-core/dist/styles/dockview.css';
import '../styles/dockview-theme.css';

/**
 * Initialize the application shell.
 *
 * @param {HTMLElement} container - The #app element
 * @returns {{ showReport: Function }}
 */
export function initAppShell(container) {
  let dockview = null;
  let dockviewContainer = null;

  function showReport(data) {
    // Create dockview container if it doesn't exist
    if (!dockviewContainer) {
      dockviewContainer = document.createElement('div');
      dockviewContainer.style.cssText = 'flex:1;position:relative;';
      container.appendChild(dockviewContainer);
    }

    // Try to restore saved layout, otherwise build default
    dockview = new DockviewComponent(dockviewContainer, {
      theme: themeLight,
      createComponent: (options) => {
        return createPanel(options.name, data);
      },
    });

    // Build default layout
    const summaryPanel = dockview.addPanel({
      id: 'summary',
      component: 'summary',
      title: 'Summary',
    });

    const findingsPanel = dockview.addPanel({
      id: 'findings',
      component: 'findings',
      title: 'Findings',
      position: { referencePanel: summaryPanel, direction: 'below' },
    });

    dockview.addPanel({
      id: 'details',
      component: 'details',
      title: 'Details',
      position: { referencePanel: summaryPanel, direction: 'right' },
    });

    dockview.addPanel({
      id: 'structure',
      component: 'structure',
      title: 'Structure Tree',
      position: { referencePanel: 'details', direction: 'within' },
    });

    dockview.addPanel({
      id: 'fonts',
      component: 'fonts',
      title: 'Fonts',
      position: { referencePanel: 'details', direction: 'within' },
    });

    dockview.addPanel({
      id: 'images',
      component: 'images',
      title: 'Images',
      position: { referencePanel: 'details', direction: 'within' },
    });
  }

  return { showReport };
}

/**
 * Create a panel component by name.
 *
 * dockview-core's createComponent receives { id, name } and must return
 * an object with an `element` property (HTMLElement) and an `init()` method.
 * The element is mounted by dockview; init() is called afterwards with
 * { params, title, api, containerApi }.
 */
export function createPanel(name, data) {
  const el = document.createElement('div');
  el.style.overflow = 'auto';
  el.style.padding = '16px';
  el.style.fontFamily = 'var(--font-family)';
  el.style.height = '100%';

  return {
    element: el,
    init(parameters) {
      switch (name) {
        case 'summary':
          renderSummaryPanel(el, data);
          break;
        case 'findings':
          renderFindingsPanel(el, data);
          break;
        case 'details':
          renderDetailsPanel(el, data);
          break;
        case 'structure':
          renderTreeExplorer(el, data);
          break;
        case 'fonts':
          renderFontTable(el, data);
          break;
        case 'images':
          renderImageTable(el, data);
          break;
      }
    },
  };
}
