# Maintenance

## Runtime and tooling

Use HTML, CSS, and JavaScript without runtime dependencies. Use Node.js 24 for tests and Python 3 for a local HTTP server. Browser checks require Web Crypto and the standard Clipboard API. Use the Codex in-app browser (`iab`) for local browser checks. Create hidden tabs and keep them silent.

## Project rules

- Keep utility entries in the list in the root `index.html`. Each entry has a stable ID, label, and relative path to its own HTML file. Keep the password generator first so missing, empty, and unknown `tool` values fall back to it.
- Keep the root page responsible for the sidebar, address bar, and iframe. Add one history entry per sidebar navigation and use `location.replace()` in the iframe, so Back and Forward follow utility selections. Keep the iframe on the site's origin for clipboard access.
- Keep the generator in `password-generator/index.html` with embedded assets so the downloaded HTML works offline. Preserve the generator's CommonJS exports, generation modes, selected character groups, exact requested lengths, entropy display, secure randomness, and clipboard fallback. Keep the supported range at 8–64 characters. Build both vocabulary presets from independently authored word pools. Check that story templates generate distinct output sets before adding their counts. Update CSP hashes whenever the corresponding inline blocks change. Preserve the existing connection restriction.
- Keep `README.md` and this file as the only Markdown files in the repository.
- Keep sample pages used for manual checks outside the repository. Update these rules when changing a project decision, expected behavior, or its verification.

## Build and checks

1. Run `node --test` from the repository root. The test suite checks the generator and the routes.
2. To test the project site prefix, serve the parent of a checkout named `web-utilities` with `python3 -m http.server 8000 --bind 127.0.0.1`. Open `http://127.0.0.1:8000/web-utilities/`.
3. No compilation is required. The Pages workflow tests the commit and stages the contents listed in `.github/workflows/pages.yml` as a Pages artifact. Update that list when adding a production utility. Confirm CI passed for the exact published commit.

| Scenario | Expected result |
| --- | --- |
| Open the root, then `?tool=` and `?tool=unknown` | The password generator opens and its sidebar link is active. |
| Open `?tool=password-generator` under `/web-utilities/` and reload | The iframe loads `/web-utilities/password-generator/index.html` and the selection survives reload. |
| In a temporary copy, add a second HTML utility and its list entry. Click its sidebar link, reload, and exercise Back and Forward | The URL, selected link and iframe agree. Each Back or Forward step visits one selection. |
| Open a downloaded generator HTML file offline | A password is generated. Check all three modes at 8 and 64 characters. At 16 characters with default settings, Story phrase produces a sentence. |
| On the HTTPS site, click **Copy** inside the generator, then paste into a local field | The pasted value matches the visible password. Keep password values out of logs. |

## Pages

1. Use **Settings → Pages → Source → GitHub Actions**. Publish commits directly to `master`. The **Pages** workflow runs on pushes to `master` and can be started with **Run workflow**. It deploys after the tests pass and the site has Pages enabled. The deployment job checks the current head of `master` before publishing so delayed runs cannot replace a newer deployment.
2. Verify the deployed revision and the manual HTTPS scenarios above.
