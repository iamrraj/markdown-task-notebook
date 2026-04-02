import {
  elements,
  state,
  initElements,
  applyTheme,
  toggleTheme,
  applySidebarState,
  switchView,
  focusEditor,
  insertAtCursor,
  createDocument,
  openDocument,
  deleteDocument,
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

function handleCreateDocument() {
  createDocument("");
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function insertImageFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const safeName = (file.name || "image").replace(/[\[\]]/g, "");
    const markdownImage = `\n![${safeName}](${dataUrl})\n`;
    insertAtCursor(markdownImage);
  } catch (error) {
    console.error("Image insert failed", error);
  }
}

function init() {
  initElements();

  elements.newDocButton?.addEventListener("click", handleCreateDocument);
  elements.newDocTableButton?.addEventListener("click", handleCreateDocument);

  elements.collapseSidebarButton?.addEventListener("click", () => applySidebarState(!state.sidebarCollapsed));

  elements.themeToggleButton?.addEventListener("click", toggleTheme);
  elements.themeToggleButtonEditor?.addEventListener("click", toggleTheme);
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
  });

  elements.copyMarkdownButton?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(elements.markdownInput?.value || "");
      if (elements.copyMarkdownButton) elements.copyMarkdownButton.textContent = "Copied";
      window.setTimeout(() => {
        if (elements.copyMarkdownButton) elements.copyMarkdownButton.textContent = "Copy";
      }, 1200);
    } catch (error) {
      console.error("Clipboard write failed", error);
    }
  });

  elements.insertImageButton?.addEventListener("click", () => {
    elements.imageFileInput?.click();
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
    const imageFile = files.find((file) => file.type.startsWith("image/"));
    if (!imageFile) return;
    event.preventDefault();
    await insertImageFile(imageFile);
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
    state.filters = { search: "", date: "all", tag: "" };
    if (elements.searchInput) elements.searchInput.value = "";
    if (elements.dateFilter) elements.dateFilter.value = "all";
    if (elements.tagFilterInput) elements.tagFilterInput.value = "";
    renderAll(handleOpenDocument, handleDeleteDocument);
  });

  bindNav(elements.navAllNotes);
  bindNav(elements.navSearch);
  bindNav(elements.navTags);
  bindNav(elements.navRecent);

  elements.showEditorButton?.addEventListener("click", () => setNotebookPane("editor"));
  elements.showPreviewButton?.addEventListener("click", () => setNotebookPane("preview"));
  window.addEventListener("resize", applyNotebookPane);
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
      if (elements.themeToggleButtonEditor) elements.themeToggleButtonEditor.textContent = nextLabel;
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

  const loaded = loadDocumentsFromStorage();
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
  renderAll(handleOpenDocument, handleDeleteDocument);
  applyNotebookPane();
}

init();
