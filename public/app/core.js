export const STORAGE_KEY = "markdown-task-notebook.documents.v1";
export const THEME_KEY = "markdown-task-notebook.theme.v1";
export const SIDEBAR_KEY = "markdown-task-notebook.sidebar.v1";

export const MARKDOWN_THEME_LINKS = {
  light: "https://cdn.jsdelivr.net/npm/github-markdown-css@5.8.1/github-markdown-light.min.css",
  dark: "https://cdn.jsdelivr.net/npm/github-markdown-css@5.8.1/github-markdown-dark.min.css"
};

export const state = {
  documents: [],
  activeDocumentId: null,
  saveTimer: null,
  savePromise: null,
  currentView: "table",
  notebookPane: "editor",
  theme: "light",
  themeSource: "system",
  sidebarCollapsed: false,
  hasLoadedFromDisk: false,
  filters: {
    search: "",
    date: "all",
    tag: ""
  },
  tagsPage: {
    activeTag: ""
  }
};

export const elements = {};

export function initElements() {
  Object.assign(elements, {
    recentDocumentsList: document.getElementById("recentDocumentsList"),
    documentsTableBody: document.getElementById("documentsTableBody"),
    docCount: document.getElementById("docCount"),
    appShell: document.getElementById("appShell"),
    dashboardView: document.getElementById("dashboardView"),
    editorView: document.getElementById("editorView"),
    searchView: document.getElementById("searchView"),
    tagsView: document.getElementById("tagsView"),
    recentView: document.getElementById("recentView"),
    collapseSidebarButton: document.getElementById("collapseSidebarButton"),
    collapseIcon: document.getElementById("collapseIcon"),
    newDocButton: document.getElementById("newDocButton"),
    newDocTableButton: document.getElementById("newDocTableButton"),
    backToListButton: document.getElementById("backToListButton"),
    deleteDocButton: document.getElementById("deleteDocButton"),
    copyMarkdownButton: document.getElementById("copyMarkdownButton"),
    insertImageButton: document.getElementById("insertImageButton"),
    imageFileInput: document.getElementById("imageFileInput"),
    themeToggleButton: document.getElementById("themeToggleButton"),
    themeToggleButtonEditor: document.getElementById("themeToggleButtonEditor"),
    themeToggleButtonSearch: document.getElementById("themeToggleButtonSearch"),
    themeToggleButtonTags: document.getElementById("themeToggleButtonTags"),
    themeToggleButtonRecent: document.getElementById("themeToggleButtonRecent"),
    themeToggleLabel: document.getElementById("themeToggleLabel"),
    markdownThemeStylesheet: document.getElementById("markdownThemeStylesheet"),
    searchInput: document.getElementById("searchInput"),
    dateFilter: document.getElementById("dateFilter"),
    tagFilterInput: document.getElementById("tagFilterInput"),
    clearFiltersButton: document.getElementById("clearFiltersButton"),
    navAllNotes: document.getElementById("navAllNotes"),
    navSearch: document.getElementById("navSearch"),
    navTags: document.getElementById("navTags"),
    navRecent: document.getElementById("navRecent"),
    searchPageInput: document.getElementById("searchPageInput"),
    searchPageClearButton: document.getElementById("searchPageClearButton"),
    searchResultCount: document.getElementById("searchResultCount"),
    searchResultsList: document.getElementById("searchResultsList"),
    tagsCloud: document.getElementById("tagsCloud"),
    tagsPageFilterInput: document.getElementById("tagsPageFilterInput"),
    tagsResultsHeading: document.getElementById("tagsResultsHeading"),
    tagsResultCount: document.getElementById("tagsResultCount"),
    tagsResultsList: document.getElementById("tagsResultsList"),
    recentResultCount: document.getElementById("recentResultCount"),
    recentPageList: document.getElementById("recentPageList"),
    titleInput: document.getElementById("titleInput"),
    tagsInput: document.getElementById("tagsInput"),
    tagChipList: document.getElementById("tagChipList"),
    markdownInput: document.getElementById("markdownInput"),
    previewOutput: document.getElementById("previewOutput"),
    previewHeading: document.getElementById("previewHeading"),
    saveStatus: document.getElementById("saveStatus"),
    documentMeta: document.getElementById("documentMeta"),
    emptyStateTemplate: document.getElementById("emptyStateTemplate"),
    showEditorButton: document.getElementById("showEditorButton"),
    showPreviewButton: document.getElementById("showPreviewButton"),
    editorPane: document.getElementById("editorPane"),
    previewPane: document.getElementById("previewPane")
  });
}

export function uid() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDate(dateString) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(dateString));
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
}

export function parseTags(value) {
  return normalizeTags(String(value || "").split(","));
}

export function tagsToInputValue(tags) {
  return normalizeTags(tags).join(", ");
}

export function deriveTitle(title, content) {
  if (String(title || "").trim()) return String(title).trim();
  const firstLine = String(content || "")
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 60) : "Untitled Task Note";
}

export function getExcerpt(content) {
  const flattened = String(content || "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  return flattened ? flattened.slice(0, 90) : "Empty note";
}

export function sortDocuments() {
  state.documents.sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
}

export function getActiveDocument() {
  return state.documents.find((documentItem) => documentItem.id === state.activeDocumentId) || null;
}

export function applyTheme(theme) {
  state.theme = theme;
  state.themeSource = "user";
  document.documentElement.classList.toggle("dark", theme === "dark");
  if (elements.markdownThemeStylesheet) {
    elements.markdownThemeStylesheet.href = MARKDOWN_THEME_LINKS[theme] || MARKDOWN_THEME_LINKS.light;
  }
  const nextLabel = theme === "dark" ? "Light mode" : "Dark mode";
  if (elements.themeToggleLabel) elements.themeToggleLabel.textContent = nextLabel;
  if (elements.themeToggleButtonEditor) elements.themeToggleButtonEditor.textContent = nextLabel;
  if (elements.themeToggleButtonSearch) elements.themeToggleButtonSearch.textContent = nextLabel;
  if (elements.themeToggleButtonTags) elements.themeToggleButtonTags.textContent = nextLabel;
  if (elements.themeToggleButtonRecent) elements.themeToggleButtonRecent.textContent = nextLabel;
  if (state.hasLoadedFromDisk) queueSave();
}

export function toggleTheme() {
  applyTheme(state.theme === "dark" ? "light" : "dark");
}

export function getSystemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

export function applySidebarState(collapsed) {
  state.sidebarCollapsed = collapsed;
  if (elements.appShell) elements.appShell.classList.toggle("sidebar-collapsed", collapsed);
  if (elements.collapseIcon) elements.collapseIcon.textContent = collapsed ? "»" : "«";
  if (state.hasLoadedFromDisk) queueSave();
}

export function setActiveNav(view) {
  const navButtons = [elements.navAllNotes, elements.navSearch, elements.navTags, elements.navRecent].filter(Boolean);
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
}

export function switchView(view) {
  state.currentView = view;
  const views = [
    { key: "table", el: elements.dashboardView },
    { key: "notebook", el: elements.editorView },
    { key: "search", el: elements.searchView },
    { key: "tags", el: elements.tagsView },
    { key: "recent", el: elements.recentView }
  ];

  views.forEach(({ key, el }) => {
    if (!el) return;
    const show = key === view;
    el.classList.toggle("hidden", !show);
    el.classList.toggle("flex", show);
  });

  setActiveNav(view);
}

export function focusEditor() {
  window.requestAnimationFrame(() => {
    elements.markdownInput?.focus();
  });
}

export function insertAtCursor(textToInsert, options = {}) {
  const input = elements.markdownInput;
  if (!input) return;

  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  input.value = `${before}${textToInsert}${after}`;

  const nextCursor = start + textToInsert.length;
  input.selectionStart = nextCursor;
  input.selectionEnd = nextCursor;
  input.focus();

  if (options.dispatchInput !== false) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export async function saveDocumentsNow() {
  if (elements.saveStatus) {
    elements.saveStatus.textContent = "Saving...";
    elements.saveStatus.classList.add("pending");
  }
  const payload = {
    documents: state.documents,
    settings: {
      theme: state.theme,
      themeSource: state.themeSource,
      sidebarCollapsed: state.sidebarCollapsed
    }
  };
  state.savePromise = fetch("/api/state", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to save app state");
      }
      await response.json();
      if (elements.saveStatus) {
        elements.saveStatus.textContent = "Saved";
        elements.saveStatus.classList.remove("pending");
      }
    })
    .catch((error) => {
      console.error("Failed to save app state", error);
      if (elements.saveStatus) {
        elements.saveStatus.textContent = "Save failed";
        elements.saveStatus.classList.remove("pending");
      }
    });
  return state.savePromise;
}

export function queueSave() {
  if (elements.saveStatus) {
    elements.saveStatus.textContent = "Saving...";
    elements.saveStatus.classList.add("pending");
  }
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(saveDocumentsNow, 220);
}

export function matchesDateFilter(documentItem) {
  if (state.filters.date === "all") return true;
  const updatedAt = new Date(documentItem.updatedAt).getTime();
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  if (state.filters.date === "today") return now - updatedAt <= oneDay;
  if (state.filters.date === "week") return now - updatedAt <= oneDay * 7;
  if (state.filters.date === "month") return now - updatedAt <= oneDay * 30;
  return true;
}

export function getFilteredDocuments() {
  const search = state.filters.search.trim().toLowerCase();
  const tagQuery = state.filters.tag.trim().toLowerCase();

  return state.documents.filter((documentItem) => {
    const title = deriveTitle(documentItem.title, documentItem.content).toLowerCase();
    const content = documentItem.content.toLowerCase();
    const tags = normalizeTags(documentItem.tags).map((tag) => tag.toLowerCase());
    const searchMatch = !search || title.includes(search) || content.includes(search);
    const tagMatch = !tagQuery || tags.some((tag) => tag.includes(tagQuery));
    return searchMatch && tagMatch && matchesDateFilter(documentItem);
  });
}

export function createDocumentModel(initialContent = "") {
  const now = new Date().toISOString();
  return {
    id: uid(),
    title: "",
    content: initialContent,
    tags: [],
    createdAt: now,
    updatedAt: now
  };
}

export function createDocument(initialContent = "") {
  const documentItem = createDocumentModel(initialContent);
  state.documents.unshift(documentItem);
  state.activeDocumentId = documentItem.id;
  sortDocuments();
  queueSave();
  return documentItem.id;
}

export function openDocument(id) {
  state.activeDocumentId = id;
}

export function deleteDocument(id) {
  const current = state.documents.find((item) => item.id === id);
  if (!current) return { deleted: false };

  const shouldDelete = window.confirm(`Delete "${deriveTitle(current.title, current.content)}"?`);
  if (!shouldDelete) return { deleted: false };

  state.documents = state.documents.filter((documentItem) => documentItem.id !== id);
  if (!state.documents.length) {
    state.documents = [createDocumentModel("")];
  }
  if (!state.documents.some((documentItem) => documentItem.id === state.activeDocumentId)) {
    state.activeDocumentId = state.documents[0].id;
  }
  sortDocuments();
  queueSave();
  return { deleted: true };
}

export function updateActiveDocument(patch) {
  const activeDocument = getActiveDocument();
  if (!activeDocument) return;

  Object.assign(activeDocument, patch, {
    updatedAt: new Date().toISOString()
  });

  sortDocuments();
  queueSave();
}

function applyInitialTheme(theme, themeSource = "system") {
  state.theme = theme;
  state.themeSource = themeSource;
  document.documentElement.classList.toggle("dark", theme === "dark");
  if (elements.markdownThemeStylesheet) {
    elements.markdownThemeStylesheet.href = MARKDOWN_THEME_LINKS[theme] || MARKDOWN_THEME_LINKS.light;
  }
  const nextLabel = theme === "dark" ? "Light mode" : "Dark mode";
  if (elements.themeToggleLabel) elements.themeToggleLabel.textContent = nextLabel;
  if (elements.themeToggleButtonEditor) elements.themeToggleButtonEditor.textContent = nextLabel;
  if (elements.themeToggleButtonSearch) elements.themeToggleButtonSearch.textContent = nextLabel;
  if (elements.themeToggleButtonTags) elements.themeToggleButtonTags.textContent = nextLabel;
  if (elements.themeToggleButtonRecent) elements.themeToggleButtonRecent.textContent = nextLabel;
}

export async function loadDocumentsFromStorage() {
  try {
    const response = await fetch("/api/state", {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("Failed to load app state");
    }

    const payload = await response.json();
    const settings = payload.settings || {};
    const resolvedThemeSource =
      settings.themeSource === "user" || settings.themeSource === "system" ? settings.themeSource : "system";
    const resolvedTheme =
      resolvedThemeSource === "system"
        ? getSystemTheme()
        : settings.theme === "dark"
          ? "dark"
          : "light";

    applyInitialTheme(resolvedTheme, resolvedThemeSource);
    state.sidebarCollapsed = Boolean(settings.sidebarCollapsed);
    if (elements.appShell) elements.appShell.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
    if (elements.collapseIcon) elements.collapseIcon.textContent = state.sidebarCollapsed ? "»" : "«";

    state.documents = Array.isArray(payload.documents)
      ? payload.documents.map((documentItem) => ({
          ...documentItem,
          tags: normalizeTags(documentItem.tags || [])
        }))
      : [];
    sortDocuments();
    state.activeDocumentId = state.documents[0]?.id || null;
    state.hasLoadedFromDisk = true;
    return { hasData: state.documents.length > 0 };
  } catch (error) {
    console.error("Failed to load saved documents", error);
    applyInitialTheme(getSystemTheme(), "system");
    state.documents = [];
    state.activeDocumentId = null;
    state.hasLoadedFromDisk = true;
    return { hasData: false };
  }
}
