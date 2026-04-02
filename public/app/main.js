import {
  elements,
  state,
  initElements,
  applyTheme,
  toggleTheme,
  applySidebarState,
  applySyncScrollState,
  setSplitRatio,
  setSortBy,
  setShowArchived,
  switchView,
  focusEditor,
  insertAtCursor,
  deriveTitle,
  slugify,
  createDocument,
  openDocument,
  deleteDocument,
  duplicateDocument,
  togglePinDocument,
  toggleArchiveDocument,
  getActiveDocument,
  updateActiveDocument,
  parseTags,
  loadDocumentsFromStorage,
  getSystemTheme
} from "./core.js";

import { renderAll, renderSearchPage, renderTagsPage } from "./views.js";

function handleOpenDocument(id) {
  openDocument(id);
  switchView("notebook");
  renderAll(handleOpenDocument, handleDeleteDocument);
  applyNotebookPane();
}

function handleDeleteDocument(id) {
  const result = deleteDocument(id);
  if (!result.deleted) return;
  switchView("table");
  renderAll(handleOpenDocument, handleDeleteDocument);
}

function handleDuplicateDocument(id) {
  const nextId = duplicateDocument(id);
  if (!nextId) return;
  switchView("notebook");
  renderAll(handleOpenDocument, handleDeleteDocument);
  applyNotebookPane();
  focusEditor();
}

function handleCreateDocument() {
  createDocument("");
  switchView("notebook");
  renderAll(handleOpenDocument, handleDeleteDocument);
  applyNotebookPane();
  focusEditor();
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportActiveDocument() {
  const activeDocument = getActiveDocument();
  if (!activeDocument) return;
  const title = deriveTitle(activeDocument.title, activeDocument.content);
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `tags: ${JSON.stringify(activeDocument.tags || [])}`,
    `createdAt: ${JSON.stringify(activeDocument.createdAt)}`,
    `updatedAt: ${JSON.stringify(activeDocument.updatedAt)}`,
    `pinned: ${Boolean(activeDocument.pinned)}`,
    `archived: ${Boolean(activeDocument.archived)}`,
    "---",
    ""
  ].join("\n");
  downloadTextFile(`${slugify(title)}.md`, `${frontmatter}${activeDocument.content}`);
}

function handleCreateDocumentFromMarkdown(markdownText, fileName = "") {
  const nextId = createDocument(String(markdownText || ""));
  if (fileName) {
    const titleFromFile = fileName.replace(/\.[^.]+$/, "").trim();
    if (titleFromFile) {
      openDocument(nextId);
      updateActiveDocument({ title: titleFromFile });
    }
  }
  switchView("notebook");
  renderAll(handleOpenDocument, handleDeleteDocument);
  applyNotebookPane();
  focusEditor();
}

function bindNav(button) {
  if (!button) return;
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    if (!view) return;
    switchView(view);
    renderAll(handleOpenDocument, handleDeleteDocument);
  });
}

function setNotebookPane(pane) {
  state.notebookPane = pane;
  applyNotebookPane();
}

function applyNotebookPane() {
  const isWide = window.matchMedia("(min-width: 1280px)").matches;
  if (isWide) {
    elements.editorPane?.classList.remove("hidden");
    elements.editorPane?.classList.add("flex");
    elements.previewPane?.classList.remove("hidden");
    elements.previewPane?.classList.add("flex");
  } else {
    const showEditor = state.notebookPane !== "preview";
    elements.editorPane?.classList.toggle("hidden", !showEditor);
    elements.editorPane?.classList.toggle("flex", showEditor);
    elements.previewPane?.classList.toggle("hidden", showEditor);
    elements.previewPane?.classList.toggle("flex", !showEditor);
  }

  const editorActive = state.notebookPane !== "preview";
  if (elements.showEditorButton) {
    elements.showEditorButton.classList.toggle("bg-white", editorActive);
    elements.showEditorButton.classList.toggle("shadow-sm", editorActive);
    elements.showEditorButton.classList.toggle("dark:bg-slate-800", editorActive);
    elements.showEditorButton.classList.toggle("text-slate-700", editorActive);
    elements.showEditorButton.classList.toggle("dark:text-slate-200", editorActive);
    elements.showEditorButton.classList.toggle("text-slate-500", !editorActive);
    elements.showEditorButton.classList.toggle("dark:text-slate-400", !editorActive);
  }
  if (elements.showPreviewButton) {
    elements.showPreviewButton.classList.toggle("bg-white", !editorActive);
    elements.showPreviewButton.classList.toggle("shadow-sm", !editorActive);
    elements.showPreviewButton.classList.toggle("rounded-full", !editorActive);
    elements.showPreviewButton.classList.toggle("dark:bg-slate-800", !editorActive);
    elements.showPreviewButton.classList.toggle("text-slate-700", !editorActive);
    elements.showPreviewButton.classList.toggle("dark:text-slate-200", !editorActive);
    elements.showPreviewButton.classList.toggle("text-slate-500", editorActive);
    elements.showPreviewButton.classList.toggle("dark:text-slate-400", editorActive);
  }
}

function closeNoteMenu() {
  elements.noteMenu?.classList.add("hidden");
  elements.noteMenuButton?.setAttribute("aria-expanded", "false");
}

function toggleNoteMenu() {
  if (!elements.noteMenu || !elements.noteMenuButton) return;
  const shouldOpen = elements.noteMenu.classList.contains("hidden");
  elements.noteMenu.classList.toggle("hidden", !shouldOpen);
  elements.noteMenuButton.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
}

function initSplitResizer() {
  const resizer = elements.splitResizer;
  const pane = elements.splitPane;
  if (!resizer || !pane) return;

  let dragging = false;

  const handlePointerMove = (event) => {
    if (!dragging) return;
    const rect = pane.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    setSplitRatio(ratio);
  };

  const stopDragging = () => {
    dragging = false;
    document.body.classList.remove("split-resizing");
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDragging);
  };

  resizer.addEventListener("pointerdown", (event) => {
    dragging = true;
    document.body.classList.add("split-resizing");
    resizer.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
  });
}

let syncScrollLock = false;

function syncPaneScroll(sourceEl, targetEl) {
  if (!sourceEl || !targetEl || syncScrollLock || !state.syncScroll) return;

  const sourceMax = sourceEl.scrollHeight - sourceEl.clientHeight;
  const targetMax = targetEl.scrollHeight - targetEl.clientHeight;
  const ratio = sourceMax > 0 ? sourceEl.scrollTop / sourceMax : 0;

  syncScrollLock = true;
  targetEl.scrollTop = Math.max(0, targetMax * ratio);
  window.requestAnimationFrame(() => {
    syncScrollLock = false;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function getLineRange(value, start, end) {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = value.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  return { lineStart, lineEnd };
}

function updateMarkdownWithSelection(transform) {
  const input = elements.markdownInput;
  if (!input) return;

  const value = input.value;
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? start;
  const selectedText = value.slice(start, end);
  const next = transform({
    value,
    start,
    end,
    selectedText
  });

  if (!next || typeof next.value !== "string") return;

  const prefixLength = next.replaceStart ?? 0;
  const replaceStart = next.replaceStartIndex ?? 0;
  const replaceEnd = next.replaceEndIndex ?? value.length;
  const replacement = next.replacement ?? next.value.slice(replaceStart, next.value.length - (value.length - replaceEnd));

  input.setRangeText(replacement, replaceStart, replaceEnd, "end");
  input.selectionStart = next.selectionStart ?? start;
  input.selectionEnd = next.selectionEnd ?? input.selectionStart;
  input.focus();
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function wrapSelection(prefix, suffix = prefix, placeholder = "") {
  updateMarkdownWithSelection(({ value, start, end, selectedText }) => {
    const inner = selectedText || placeholder;
    const replacement = `${prefix}${inner}${suffix}`;
    const selectionStart = start + prefix.length;
    const selectionEnd = selectionStart + inner.length;
    return {
      value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
      replacement,
      replaceStartIndex: start,
      replaceEndIndex: end,
      selectionStart,
      selectionEnd
    };
  });
}

function prefixLines(prefix) {
  updateMarkdownWithSelection(({ value, start, end }) => {
    const { lineStart, lineEnd } = getLineRange(value, start, end);
    const block = value.slice(lineStart, lineEnd);
    const replaced = block
      .split("\n")
      .map((line) => `${prefix}${line}`)
      .join("\n");
    return {
      value: `${value.slice(0, lineStart)}${replaced}${value.slice(lineEnd)}`,
      replacement: replaced,
      replaceStartIndex: lineStart,
      replaceEndIndex: lineEnd,
      selectionStart: lineStart,
      selectionEnd: lineStart + replaced.length
    };
  });
}

function insertBlock(before, after = "", placeholder = "") {
  updateMarkdownWithSelection(({ value, start, end, selectedText }) => {
    const inner = selectedText || placeholder;
    const replacement = `${before}${inner}${after}`;
    const selectionStart = start + before.length;
    const selectionEnd = selectionStart + inner.length;
    return {
      value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
      replacement,
      replaceStartIndex: start,
      replaceEndIndex: end,
      selectionStart,
      selectionEnd
    };
  });
}

async function insertImageFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const safeName = (file.name || "image").replace(/[\[\]]/g, "");
    const response = await fetch("/api/assets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fileName: safeName,
        mimeType: file.type,
        dataUrl
      })
    });

    if (!response.ok) {
      throw new Error("Failed to save image asset");
    }

    const payload = await response.json();
    const markdownImage = `\n![${safeName}](${payload.url})\n`;
    insertAtCursor(markdownImage);
  } catch (error) {
    console.error("Image insert failed", error);
  }
}

async function importMarkdownFile(file) {
  if (!file) return;
  const lowerName = (file.name || "").toLowerCase();
  const isMarkdownLike =
    file.type === "text/markdown" ||
    file.type === "text/plain" ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".markdown") ||
    lowerName.endsWith(".txt");

  if (!isMarkdownLike) return;

  try {
    const text = await readFileAsText(file);
    handleCreateDocumentFromMarkdown(text, file.name || "");
  } catch (error) {
    console.error("Markdown import failed", error);
  }
}

async function init() {
  initElements();

  elements.newDocButton?.addEventListener("click", handleCreateDocument);
  elements.newDocTableButton?.addEventListener("click", handleCreateDocument);
  elements.uploadDocButton?.addEventListener("click", () => {
    elements.markdownFileInput?.click();
  });

  elements.collapseSidebarButton?.addEventListener("click", () => applySidebarState(!state.sidebarCollapsed));
  elements.syncScrollCheckbox?.addEventListener("change", (event) => {
    applySyncScrollState(event.target.checked);
  });

  elements.themeToggleButton?.addEventListener("click", toggleTheme);
  elements.themeToggleButtonEditor?.addEventListener("click", () => {
    toggleTheme();
    closeNoteMenu();
  });
  elements.themeToggleButtonSearch?.addEventListener("click", toggleTheme);
  elements.themeToggleButtonTags?.addEventListener("click", toggleTheme);
  elements.themeToggleButtonRecent?.addEventListener("click", toggleTheme);

  elements.backToListButton?.addEventListener("click", () => {
    switchView("table");
    renderAll(handleOpenDocument, handleDeleteDocument);
  });

  elements.deleteDocButton?.addEventListener("click", () => {
    const id = state.activeDocumentId;
    if (!id) return;
    handleDeleteDocument(id);
    closeNoteMenu();
  });

  elements.duplicateDocButton?.addEventListener("click", () => {
    const id = state.activeDocumentId;
    if (!id) return;
    handleDuplicateDocument(id);
    closeNoteMenu();
  });

  elements.pinDocButton?.addEventListener("click", () => {
    const id = state.activeDocumentId;
    if (!id) return;
    togglePinDocument(id);
    renderAll(handleOpenDocument, handleDeleteDocument);
    closeNoteMenu();
  });

  elements.archiveDocButton?.addEventListener("click", () => {
    const id = state.activeDocumentId;
    if (!id) return;
    toggleArchiveDocument(id);
    renderAll(handleOpenDocument, handleDeleteDocument);
    closeNoteMenu();
  });

  elements.copyMarkdownButton?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(elements.markdownInput?.value || "");
      if (elements.copyMarkdownButton) elements.copyMarkdownButton.textContent = "Copied";
      window.setTimeout(() => {
        if (elements.copyMarkdownButton) elements.copyMarkdownButton.textContent = "Copy markdown";
      }, 1200);
    } catch (error) {
      console.error("Clipboard write failed", error);
    }
    closeNoteMenu();
  });

  elements.importMarkdownButton?.addEventListener("click", () => {
    elements.markdownFileInput?.click();
    closeNoteMenu();
  });

  elements.exportMarkdownButton?.addEventListener("click", () => {
    exportActiveDocument();
    closeNoteMenu();
  });

  elements.markdownFileInput?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    await importMarkdownFile(file);
    event.target.value = "";
  });

  elements.insertImageButton?.addEventListener("click", () => {
    elements.imageFileInput?.click();
    closeNoteMenu();
  });

  elements.imageFileInput?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    await insertImageFile(file);
    event.target.value = "";
  });

  elements.titleInput?.addEventListener("input", (event) => {
    updateActiveDocument({ title: event.target.value });
    renderAll(handleOpenDocument, handleDeleteDocument);
  });

  elements.tagsInput?.addEventListener("input", (event) => {
    updateActiveDocument({ tags: parseTags(event.target.value) });
    renderAll(handleOpenDocument, handleDeleteDocument);
  });

  elements.markdownInput?.addEventListener("input", (event) => {
    updateActiveDocument({ content: event.target.value });
    renderAll(handleOpenDocument, handleDeleteDocument);
  });

  elements.markdownInput?.addEventListener("scroll", () => {
    syncPaneScroll(elements.markdownInput, elements.previewOutput);
  });

  elements.previewOutput?.addEventListener("scroll", () => {
    syncPaneScroll(elements.previewOutput, elements.markdownInput);
  });

  elements.markdownInput?.addEventListener("paste", async (event) => {
    const items = [...(event.clipboardData?.items || [])];
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();
    const file = imageItem.getAsFile();
    await insertImageFile(file);
  });

  elements.markdownInput?.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  elements.markdownInput?.addEventListener("drop", async (event) => {
    const files = [...(event.dataTransfer?.files || [])];
    event.preventDefault();
    const markdownFile = files.find((file) => {
      const lowerName = (file.name || "").toLowerCase();
      return (
        file.type === "text/markdown" ||
        file.type === "text/plain" ||
        lowerName.endsWith(".md") ||
        lowerName.endsWith(".markdown") ||
        lowerName.endsWith(".txt")
      );
    });
    if (markdownFile) {
      await importMarkdownFile(markdownFile);
      return;
    }
    const imageFile = files.find((file) => file.type.startsWith("image/"));
    if (imageFile) {
      await insertImageFile(imageFile);
    }
  });

  elements.markdownInput?.addEventListener("keydown", (event) => {
    const isModifier = event.metaKey || event.ctrlKey;
    if (!isModifier) return;

    const key = event.key.toLowerCase();

    if (key === "b") {
      event.preventDefault();
      wrapSelection("**", "**", "bold");
      return;
    }

    if (key === "i") {
      event.preventDefault();
      wrapSelection("_", "_", "italic");
      return;
    }

    if (key === "k") {
      event.preventDefault();
      wrapSelection("[", "](https://example.com)", "link text");
      return;
    }

    if (key === "e") {
      event.preventDefault();
      wrapSelection("`", "`", "code");
      return;
    }

    if (key === "1" && event.shiftKey) {
      event.preventDefault();
      prefixLines("# ");
      return;
    }

    if (key === "2" && event.shiftKey) {
      event.preventDefault();
      prefixLines("## ");
      return;
    }

    if (key === "7" && event.shiftKey) {
      event.preventDefault();
      prefixLines("- ");
      return;
    }

    if (key === "8" && event.shiftKey) {
      event.preventDefault();
      prefixLines("1. ");
      return;
    }

    if (key === "9" && event.shiftKey) {
      event.preventDefault();
      prefixLines("> ");
      return;
    }

    if (key === "u" && event.shiftKey) {
      event.preventDefault();
      prefixLines("- [ ] ");
      return;
    }

    if (key === "m" && event.shiftKey) {
      event.preventDefault();
      insertBlock("```\n", "\n```", "code");
      return;
    }
  });

  elements.searchInput?.addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    renderAll(handleOpenDocument, handleDeleteDocument);
  });

  elements.dateFilter?.addEventListener("change", (event) => {
    state.filters.date = event.target.value;
    renderAll(handleOpenDocument, handleDeleteDocument);
  });

  elements.tagFilterInput?.addEventListener("input", (event) => {
    state.filters.tag = event.target.value;
    renderAll(handleOpenDocument, handleDeleteDocument);
  });

  elements.clearFiltersButton?.addEventListener("click", () => {
    state.filters = { search: "", date: "all", tag: "", showArchived: false };
    if (elements.searchInput) elements.searchInput.value = "";
    if (elements.dateFilter) elements.dateFilter.value = "all";
    if (elements.tagFilterInput) elements.tagFilterInput.value = "";
    if (elements.showArchivedCheckbox) elements.showArchivedCheckbox.checked = false;
    renderAll(handleOpenDocument, handleDeleteDocument);
  });

  elements.showArchivedCheckbox?.addEventListener("change", (event) => {
    setShowArchived(event.target.checked);
    renderAll(handleOpenDocument, handleDeleteDocument);
  });

  elements.sortSelect?.addEventListener("change", (event) => {
    setSortBy(event.target.value);
    renderAll(handleOpenDocument, handleDeleteDocument);
  });

  bindNav(elements.navAllNotes);
  bindNav(elements.navSearch);
  bindNav(elements.navTags);
  bindNav(elements.navRecent);

  elements.showEditorButton?.addEventListener("click", () => setNotebookPane("editor"));
  elements.showPreviewButton?.addEventListener("click", () => setNotebookPane("preview"));
  elements.noteMenuButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNoteMenu();
  });
  document.addEventListener("click", (event) => {
    if (!elements.noteMenu || !elements.noteMenuButton) return;
    if (elements.noteMenu.contains(event.target) || elements.noteMenuButton.contains(event.target)) return;
    closeNoteMenu();
  });
  window.addEventListener("resize", applyNotebookPane);
  initSplitResizer();
  const systemThemeMedia = window.matchMedia?.("(prefers-color-scheme: dark)");
  systemThemeMedia?.addEventListener?.("change", () => {
    if (state.themeSource === "system") {
      const next = getSystemTheme();
      state.theme = next;
      document.documentElement.classList.toggle("dark", next === "dark");
      if (elements.markdownThemeStylesheet) {
        elements.markdownThemeStylesheet.href =
          next === "dark"
            ? "https://cdn.jsdelivr.net/npm/github-markdown-css@5.8.1/github-markdown-dark.min.css"
            : "https://cdn.jsdelivr.net/npm/github-markdown-css@5.8.1/github-markdown-light.min.css";
      }
      const nextLabel = next === "dark" ? "Light mode" : "Dark mode";
      if (elements.themeToggleLabel) elements.themeToggleLabel.textContent = nextLabel;
      if (elements.themeToggleButtonEditor) {
        elements.themeToggleButtonEditor.textContent = nextLabel;
      }
      if (elements.themeToggleButtonSearch) elements.themeToggleButtonSearch.textContent = nextLabel;
      if (elements.themeToggleButtonTags) elements.themeToggleButtonTags.textContent = nextLabel;
      if (elements.themeToggleButtonRecent) elements.themeToggleButtonRecent.textContent = nextLabel;
    }
  });

  elements.searchPageInput?.addEventListener("input", () => renderSearchPage(handleOpenDocument));
  elements.searchPageClearButton?.addEventListener("click", () => {
    if (elements.searchPageInput) elements.searchPageInput.value = "";
    renderSearchPage(handleOpenDocument);
  });

  elements.tagsPageFilterInput?.addEventListener("input", () => renderTagsPage(handleOpenDocument));

  window.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
      event.preventDefault();
      handleCreateDocument();
    }
  });

  const loaded = await loadDocumentsFromStorage();
  if (!loaded.hasData) {
    createDocument("# Today\n\n- Capture tasks\n- Draft the plan\n- Review the rendered note\n");
  }
  if (!state.documents.length) {
    createDocument("");
  }
  if (!state.activeDocumentId && state.documents[0]) {
    state.activeDocumentId = state.documents[0].id;
  }

  switchView("table");
  setShowArchived(state.filters.showArchived);
  renderAll(handleOpenDocument, handleDeleteDocument);
  applyNotebookPane();
}

init();
