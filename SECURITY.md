# Security Policy

## Supported Versions

This project is small and currently maintained as a single active version from the `main` branch.

## Reporting A Vulnerability

If you discover a security issue in this project:

1. Do not open a public issue with exploit details.
2. Report it privately to the project maintainer first.
3. Include:
   - a clear description
   - reproduction steps
   - impact
   - screenshots or logs if useful

If no private reporting channel has been set up yet, establish one before publishing the repository broadly.

## Current Security Notes

- The app is local-first and stores notes in an internal on-disk file:
  - `/Users/rahulraj/markdown-task-notebook/.data/app-state.json`
- Uploaded and pasted images are stored as local files in:
  - `/Users/rahulraj/markdown-task-notebook/.data/assets/`
- Markdown preview rendering uses `marked`.
- Rendered output is sanitized with `DOMPurify`.
- There is no backend database or account system in the current project.
- The local server is intended to run on `127.0.0.1:9090`.
- This project currently uses CDN-hosted frontend dependencies in the browser.

## Scope

Security review is especially relevant for:

- markdown rendering
- HTML sanitization
- local file persistence handling
- local asset file handling
- drag and drop or pasted file input flows
- third-party CDN dependencies
