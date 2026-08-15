# Portfolio site

Static site: `index.html`, `styles.css`, `script.js`. No build step needed to
run it - just open `index.html` in a browser, or serve the folder statically.

## Tests

A jsdom-based functional test harness lives in `tests/portfolio.test.js`. It
loads the real `index.html` and `script.js`, drives the actual UI (adds and
deletes certificates through the real buttons/inputs), and checks:

- Certificate IDs stay unique after a delete + re-add (regression test for a
  fixed ID-collision bug).
- Malicious credential URLs (e.g. `javascript:` links) are rejected at save
  time and can't inject attributes into the rendered HTML.

Run it with:

```powershell
npm install
npm test
```

Add more assertions to `tests/portfolio.test.js` as the site grows - it's
plain Node + jsdom, no test framework required.
