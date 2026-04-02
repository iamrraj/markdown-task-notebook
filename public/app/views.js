import {
  elements,
  state,
  escapeHtml,
  formatDate,
  normalizeTags,
  tagsToInputValue,
  deriveTitle,
  getExcerpt,
  getActiveDocument,
  getFilteredDocuments,
} from "./core.js";

import { renderMarkdownSync, unmountMarkdown } from "./markdownRenderer.js";

export function renderRecentList(onOpenDocument) {
  const recentDocuments = state.documents.filter((doc) => !doc.archived).slice(0, 8);
  if (!elements.recentDocumentsList) return;
  elements.recentDocumentsList.innerHTML = "";

  recentDocuments.forEach((documentItem) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `recent-item${documentItem.id === state.activeDocumentId ? " active" : ""}`;
    button.innerHTML = `
      <p class="recent-title">${escapeHtml(deriveTitle(documentItem.title, documentItem.content))}</p>
      <p class="recent-date">${escapeHtml(formatDate(documentItem.updatedAt))}</p>
    `;
    button.addEventListener("click", () => onOpenDocument(documentItem.id));
    elements.recentDocumentsList.appendChild(button);
  });
}

function renderDocumentCards(target, documents, onOpenDocument) {
  target.innerHTML = "";

  if (!documents.length) {
    target.innerHTML = `
      <div class="empty-table">
        <div class="text-lg font-bold text-slate-700 dark:text-slate-200">No notes to show</div>
        <div class="mt-2 text-sm text-slate-500 dark:text-slate-400">Try a different filter.</div>
      </div>
    `;
    return;
  }

  const container = document.createElement("div");
  container.className = "grid gap-3 md:grid-cols-2 xl:grid-cols-3";

  documents.forEach((documentItem) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "group w-full rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="truncate text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100">${escapeHtml(
            deriveTitle(documentItem.title, documentItem.content),
          )}</div>
          <div class="mt-1 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">${escapeHtml(
            getExcerpt(documentItem.content),
          )}</div>
        </div>
        <div class="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          Open
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        ${documentItem.pinned ? '<span class="status-chip status-chip-pinned">Pinned</span>' : ""}
        ${documentItem.archived ? '<span class="status-chip status-chip-archived">Archived</span>' : ""}
        ${
          normalizeTags(documentItem.tags)
            .slice(0, 5)
            .map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
            .join("") ||
          '<span class="text-sm text-slate-400 dark:text-slate-500">No tags</span>'
        }
      </div>
      <div class="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">${escapeHtml(
        formatDate(documentItem.updatedAt),
      )}</div>
    `;
    card.addEventListener("click", () => onOpenDocument(documentItem.id));
    container.appendChild(card);
  });

  target.appendChild(container);
}

function getTagStats() {
  const counts = new Map();
  state.documents.forEach((doc) => {
    normalizeTags(doc.tags).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function renderSearchPage(onOpenDocument) {
  if (!elements.searchResultsList) return;
  const query = (elements.searchPageInput?.value || "").trim().toLowerCase();

  const documents = state.documents.filter((doc) => {
    if (doc.archived && !state.filters.showArchived) return false;
    if (!query) return true;
    const title = deriveTitle(doc.title, doc.content).toLowerCase();
    const content = doc.content.toLowerCase();
    const tags = normalizeTags(doc.tags).join(" ").toLowerCase();
    return (
      title.includes(query) || content.includes(query) || tags.includes(query)
    );
  });

  if (elements.searchResultCount) {
    elements.searchResultCount.textContent = `${documents.length} result${documents.length === 1 ? "" : "s"}`;
  }

  renderDocumentCards(elements.searchResultsList, documents, onOpenDocument);
}

export function renderTagsPage(onOpenDocument) {
  const stats = getTagStats();
  const tagQuery = (elements.tagsPageFilterInput?.value || "")
    .trim()
    .toLowerCase();
  const filteredTags = stats.filter(
    (item) => !tagQuery || item.tag.toLowerCase().includes(tagQuery),
  );

  if (elements.tagsCloud) {
    elements.tagsCloud.innerHTML = "";
    if (!filteredTags.length) {
      elements.tagsCloud.innerHTML = `<div class="text-sm text-slate-500 dark:text-slate-400">No tags found.</div>`;
    } else {
      filteredTags.slice(0, 60).forEach(({ tag, count }) => {
        const button = document.createElement("button");
        button.type = "button";
        const isActive = state.tagsPage.activeTag === tag;
        button.className = `tag-chip ${isActive ? "ring-2 ring-blue-300 dark:ring-blue-700" : ""}`;
        button.textContent = `${tag} · ${count}`;
        button.addEventListener("click", () => {
          state.tagsPage.activeTag =
            state.tagsPage.activeTag === tag ? "" : tag;
          renderTagsPage(onOpenDocument);
        });
        elements.tagsCloud.appendChild(button);
      });
    }
  }

  const active = state.tagsPage.activeTag;
  const documents = active
    ? state.documents.filter((doc) =>
        normalizeTags(doc.tags).some((tag) => tag === active),
      )
    : state.documents.filter((doc) => !doc.archived || state.filters.showArchived);

  if (elements.tagsResultsHeading) {
    elements.tagsResultsHeading.textContent = active
      ? `Notes tagged “${active}”`
      : "Notes";
  }
  if (elements.tagsResultCount) {
    elements.tagsResultCount.textContent = `${documents.length} note${documents.length === 1 ? "" : "s"}`;
  }
  if (elements.tagsResultsList)
    renderDocumentCards(elements.tagsResultsList, documents, onOpenDocument);
}

export function renderRecentPage(onOpenDocument) {
  const recent = state.documents.filter((doc) => !doc.archived || state.filters.showArchived).slice(0, 18);
  if (elements.recentResultCount) {
    elements.recentResultCount.textContent = `${recent.length} note${recent.length === 1 ? "" : "s"}`;
  }
  if (elements.recentPageList)
    renderDocumentCards(elements.recentPageList, recent, onOpenDocument);
}

export function renderTable(onOpenDocument, onDeleteDocument) {
  const filteredDocuments = getFilteredDocuments();
  if (elements.docCount)
    elements.docCount.textContent = String(filteredDocuments.length);
  if (!elements.documentsTableBody) return;
  elements.documentsTableBody.innerHTML = "";

  if (!filteredDocuments.length) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="5" class="empty-table">
        <div class="text-lg font-bold text-slate-700 dark:text-slate-200">No notes matched those filters</div>
        <div class="mt-2 text-sm text-slate-500 dark:text-slate-400">Try a different title, date range, or tag filter.</div>
      </td>
    `;
    elements.documentsTableBody.appendChild(row);
    return;
  }

  filteredDocuments.forEach((documentItem) => {
    const row = document.createElement("tr");
    row.className =
      "table-row border-b border-slate-200 last:border-b-0 dark:border-slate-800";
    row.innerHTML = `
      <td class="px-5 py-4 align-top">
        <div class="font-bold text-slate-900 dark:text-slate-100">${escapeHtml(deriveTitle(documentItem.title, documentItem.content))}</div>
        <div class="mt-1 text-sm text-slate-500 dark:text-slate-400">${escapeHtml(getExcerpt(documentItem.content))}</div>
      </td>
      <td class="px-5 py-4 align-top">
        <div class="flex flex-wrap gap-2">
          ${documentItem.pinned ? '<span class="status-chip status-chip-pinned">Pinned</span>' : ""}
          ${documentItem.archived ? '<span class="status-chip status-chip-archived">Archived</span>' : '<span class="status-chip">Active</span>'}
        </div>
      </td>
      <td class="px-5 py-4 align-top text-sm text-slate-600 dark:text-slate-400">${escapeHtml(formatDate(documentItem.updatedAt))}</td>
      <td class="px-5 py-4 align-top text-sm text-slate-600 dark:text-slate-400">${escapeHtml(formatDate(documentItem.createdAt))}</td>
      <td class="px-5 py-4 align-top">
        <div class="flex justify-end gap-2">
          <button class="table-open-button" type="button">Open</button>
          <button class="table-delete-button" type="button">Delete</button>
        </div>
      </td>
    `;

    row
      .querySelector(".table-open-button")
      .addEventListener("click", () => onOpenDocument(documentItem.id));
    row
      .querySelector(".table-delete-button")
      .addEventListener("click", () => onDeleteDocument(documentItem.id));
    elements.documentsTableBody.appendChild(row);
  });
}

function renderMeta(documentItem) {
  if (!elements.documentMeta) return;
  elements.documentMeta.innerHTML = `
    <span class="whitespace-nowrap">Created ${escapeHtml(formatDate(documentItem.createdAt))}</span>
    <span class="mx-2 text-slate-300 dark:text-slate-700">•</span>
    <span class="whitespace-nowrap">Updated ${escapeHtml(formatDate(documentItem.updatedAt))}</span>
  `;
}

function renderMarkdown(markdown) {
  if (!elements.previewOutput) return;
  if (!markdown.trim()) {
    unmountMarkdown(elements.previewOutput);
    const fragment = elements.emptyStateTemplate?.content.cloneNode(true);
    elements.previewOutput.innerHTML = "";
    if (fragment) elements.previewOutput.appendChild(fragment);
    return;
  }
  renderMarkdownSync(elements.previewOutput, markdown);
}

export function renderEditor() {
  const activeDocument = getActiveDocument();
  if (!activeDocument) return;
  if (!elements.markdownInput || !elements.previewOutput) return;

  if (
    elements.titleInput &&
    document.activeElement !== elements.titleInput &&
    elements.titleInput.value !== activeDocument.title
  ) {
    elements.titleInput.value = activeDocument.title;
  }

  if (
    document.activeElement !== elements.markdownInput &&
    elements.markdownInput.value !== activeDocument.content
  ) {
    elements.markdownInput.value = activeDocument.content;
  }

  if (elements.tagsInput && document.activeElement !== elements.tagsInput) {
    const tagValue = tagsToInputValue(activeDocument.tags);
    if (elements.tagsInput.value !== tagValue) {
      elements.tagsInput.value = tagValue;
    }
  }

  if (elements.tagChipList) {
    elements.tagChipList.innerHTML = normalizeTags(activeDocument.tags)
      .map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
      .join("");
  }

  if (elements.previewHeading) {
    elements.previewHeading.textContent = deriveTitle(
      activeDocument.title,
      activeDocument.content,
    );
  }
  if (elements.pinDocButton) {
    elements.pinDocButton.classList.toggle("is-active", Boolean(activeDocument.pinned));
    elements.pinDocButton.textContent = activeDocument.pinned ? "Unpin note" : "Pin note";
  }
  if (elements.archiveDocButton) {
    elements.archiveDocButton.classList.toggle("is-active", Boolean(activeDocument.archived));
    elements.archiveDocButton.textContent = activeDocument.archived ? "Restore note" : "Archive note";
  }
  renderMeta(activeDocument);
  renderMarkdown(activeDocument.content);
}

export function renderAll(onOpenDocument, onDeleteDocument) {
  renderRecentList(onOpenDocument);
  renderTable(onOpenDocument, onDeleteDocument);
  renderEditor();
  renderSearchPage(onOpenDocument);
  renderTagsPage(onOpenDocument);
  renderRecentPage(onOpenDocument);
}
