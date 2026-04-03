export function unmountMarkdown() {}

export function renderMarkdownSync(targetEl, markdown) {
  if (!targetEl) {
    return;
  }

  if (typeof window.marked === "undefined") {
    targetEl.innerHTML = `<pre>${escapeHtml(markdown)}</pre>`;
    return;
  }

  window.marked.setOptions({
    gfm: true,
    breaks: true
  });

  const parsedHtml = window.marked.parse(markdown);
  const safeHtml =
    typeof window.DOMPurify !== "undefined"
      ? window.DOMPurify.sanitize(parsedHtml, { USE_PROFILES: { html: true } })
      : parsedHtml;

  targetEl.innerHTML = safeHtml;
}

function escapeHtml(value) {
  if (value == null) return "";
  const el = document.createElement("div");
  el.textContent = String(value);
  return el.innerHTML;
}
