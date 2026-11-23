# Front-end changes needed to connect the backend

The backend is finished on the `umar-backend` branch, but some front-end files still stop the forms from reaching the server. These files belong to the front-end team, so nothing here has been edited yet. Each change is small.

## How the pages work now

- **Still served as static files from `public/`:** `index.html`, `register.html`, `login.html`, `logged-out.html`, `styles.css`, `script.js`. The fixes below are mostly in these files.
- **Built by the server:** every logged-in page (dashboards, pets, create request, my requests, browse, request details, bids, reviews), made from the data in `pages.js`. These pages already have working forms (`action` + `method` + `name`). They reuse your Bootstrap classes, `styles.css` and the same element ids, so `script.js` validation still applies to them.
- **`private/*.html` is no longer sent to the browser.** Keep those files as the design reference. If you change a design, tell Umar so `pages.js` can be updated to match.

---

## 1. `public/script.js` (most important)

Right now every submit handler calls `event.preventDefault()` on its first line. That cancels **every** submit, even valid ones, so nothing ever reaches the server.

**Change:** call `preventDefault()` only when there are errors. Apply this to all 5 handlers: register (line ~42), login (~96), create-request (~122), pet (~174), bid (~211).

Register, before:
```js
registerForm.addEventListener("submit", function (event) {
  event.preventDefault();
  ...
  if (errors.length > 0) {
    registerMessage.textContent = errors.join("\n");
    return;
  }
  registerMessage.textContent = "All fields passed front-end validation.";
});
```
After:
```js
registerForm.addEventListener("submit", function (event) {
  ...
  if (errors.length > 0) {
    event.preventDefault();               // only stop the submit when something is wrong
    registerMessage.textContent = errors.join("\n");
    return;
  }
  // no preventDefault -> the browser sends the form to the server
});
```
The other four handlers end with `if (errors.length > 0) { ...message... } else { ...message... }`. Put `event.preventDefault();` inside the `if`, and delete the `else` message, because the page will change anyway.

**Also in `script.js`:**
- **Lines ~234–270 (the `sampleRequest` block):** delete it. The server now fills in the request details. It doesn't break anything right now, because the server page uses `id="request-info"` instead of `#request-details-card`, but it's dead code.
- **Lines ~337–342 (logout buttons):** change `window.location.href = "logged-out.html";` to `window.location.href = "/logout";`. Going straight to logged-out.html doesn't end the session. The server pages use a plain `<a href="/logout">` link, so this is only for any old page that still has `#logout-btn`.

## 2. `public/register.html`

| Line | Now | Change to |
|---|---|---|
| 31 | `<form id="register-form" novalidate>` | `<form id="register-form" action="/register" method="POST" novalidate>` |
| ~58 | password `<input type="text" ...>` | `type="password"` (it currently shows the password on screen) |
| 89–94 | `providerService` options: walking, bathing, grooming | optional: add `<option value="feeding">Pet feeding</option>` and `<option value="sitting">Pet sitting</option>` so the list matches the database and the create-request page |

The `name` attributes are already correct: `userType`, `username`, `email`, `password`, `confirmPassword`, `providerService`, `providerExperience`. The `?role=owner` / `?role=carer` auto-select (extra feature 1) needs no change.

## 3. `public/login.html`

| Line | Now | Change to |
|---|---|---|
| 19 | `<form id="login-form">` | `<form id="login-form" action="/login" method="POST">` |
| ~22 | username input has no `name` | add `name="username"` |
| ~31 | password input has no `name` | add `name="password"` |

Without `name`, the browser doesn't send the value, so `req.body.username` would be empty.

## 4. `public/browse-requests.html`

The server now builds the real browse page at **`/browse-requests`** (providers only). This static file, with its hard-coded cards and `test:` tags, is still reachable at `/browse-requests.html`. Choose one:
- delete it (recommended), or
- keep it as a demo and add a note at the top saying the live page is `/browse-requests`.

Extra feature 2 (tag search) still works on the live page. Each card's `data-search` holds the request's tags, `script.js` filters on them as you type, and the server also searches tags when you press "Apply Filters". Owners can now add tags in a new "Search tags" box on the create-request page.

## 5. `public/logged-out.html`

Optional: add links so the user isn't stuck on the page:
```html
<a href="/login.html" class="btn btn-primary">Log in again</a>
<a href="/" class="btn btn-primary btn-clear">Home</a>
```
It also has no Bootstrap/`styles.css` `<link>`s like the other pages. Copy the `<head>` from `login.html` if you want it to match.

## 6. `public/index.html`

No change needed. The links to `register.html?role=...` and `login.html` still work.

---

## Quick check after the changes

1. `npm install`, then `node server.js`, then open http://127.0.0.1:3000/
2. Register as a provider, log in, and you should land on `/provider-dashboard`.
3. Log in as `umar_owner` / `password123` and you should land on `/owner-dashboard`.
4. Submit a form with a mistake. `script.js` should show the error and **not** submit.
5. Submit it correctly. The page should change. That means the server got it.
