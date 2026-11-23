/*
  pages.js  -  BUILDS THE HTML PAGES
  ----------------------------------------------------------------------
  Pages that show data (dashboards, pets, requests, bids, reviews) can't be plain
  .html files any more, because the data changes. So, like Lectures 15/16, the server
  builds the page as one long HTML string with for loops, and server.js sends it
  with res.send(...).

  - Every function here takes data in and RETURNS a string of HTML. No Express, no rules.
  - We reuse the same Bootstrap classes, styles.css classes and element ids as our
    teammates' pages, so it looks the same and script.js validation still works.
  - Links to CSS/JS start with "/" (e.g. "/styles.css"): on a page like /requests/3
    a relative "styles.css" would wrongly look for /requests/styles.css.
*/

/* =====================================================================
   SAFETY + FORMATTING HELPERS
   ===================================================================== */

/*
  escapeHtml(text)
  VERY IMPORTANT for security. Users type things (pet names, comments...) that we put
  into our HTML. If someone types <script>...</script> as their pet's name and we paste
  it in as-is, that script runs in OTHER people's browsers (an "XSS" attack).
  So we swap the 5 special HTML characters for safe codes: the browser SHOWS them
  as text instead of running them. Use it on EVERYTHING a user typed.
*/
function escapeHtml(text) {
  const value = String(text);
  let safe = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '&') {
      safe = safe + '&amp;';
    } else if (ch === '<') {
      safe = safe + '&lt;';
    } else if (ch === '>') {
      safe = safe + '&gt;';
    } else if (ch === '"') {
      safe = safe + '&quot;';
    } else if (ch === "'") {
      safe = safe + '&#39;';
    } else {
      safe = safe + ch;
    }
  }
  return safe;
}

// "walking" -> "Pet walking" (the same words the teammates' pages show)
function serviceLabel(service) {
  if (service === 'walking') { return 'Pet walking'; }
  if (service === 'bathing') { return 'Pet bathing'; }
  if (service === 'grooming') { return 'Pet grooming'; }
  if (service === 'feeding') { return 'Pet feeding'; }
  if (service === 'sitting') { return 'Pet sitting'; }
  return escapeHtml(service);
}

// "2026-12-05T09:00" -> "12/5/2026, 9:00:00 AM" (same toLocaleString() script.js uses)
function formatDate(text) {
  return new Date(text).toLocaleString();
}

// Status words for people: "open" -> "Open - accepting bids", "pending" -> "Pending", etc.
function statusLabel(status) {
  if (status === 'open') { return 'Open - accepting bids'; }
  if (status === 'closed') { return 'Closed'; }
  if (status === 'completed') { return 'Completed'; }
  if (status === 'pending') { return 'Pending'; }
  if (status === 'accepted') { return 'Accepted'; }
  if (status === 'rejected') { return 'Rejected'; }
  if (status === 'withdrawn') { return 'Withdrawn'; }
  return escapeHtml(status);
}

// Builds <option> tags for a <select>. `selected` is the value that should be pre-picked.
function optionsHtml(values, labels, selected) {
  let html = '';
  for (let i = 0; i < values.length; i++) {
    let selectedAttr = '';
    if (values[i] === selected) {
      selectedAttr = ' selected';
    }
    html += '<option value="' + escapeHtml(values[i]) + '"' + selectedAttr + '>' + escapeHtml(labels[i]) + '</option>';
  }
  return html;
}


/* =====================================================================
   PAGE FRAME (the top and bottom every page shares)
   ===================================================================== */

/*
  pageStart(title, heading, subheading, user)
  The <head> (Bootstrap + styles.css) and the top bar.
  - user: the logged-in user object, or null. If there is one, the top bar shows
    "Dashboard" and "Log Out". Log Out is a LINK to /logout (not the old #logout-btn
    button), because the server must end the session, not just change the page.
*/
function pageStart(title, heading, subheading, user) {
  let html = '<!doctype html><html><head>';
  html += '<title>' + escapeHtml(title) + '</title>';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';
  html += '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" />';
  html += '<link rel="stylesheet" href="/styles.css" />';
  html += '</head><body><div class="container mt-3">';

  // Top bar: brand on the left, buttons on the right
  html += '<nav class="d-flex justify-content-between align-items-center mb-4">';
  html += '<div class="brand-pill">PetCare Bidding Platform</div>';
  if (user) {
    let dashboardUrl = '/owner-dashboard';
    if (user.userType === 'carer') {
      dashboardUrl = '/provider-dashboard';
    }
    html += '<div class="d-flex gap-2">';
    html += '<a href="' + dashboardUrl + '" class="btn btn-primary btn-clear">Dashboard</a>';
    html += '<a href="/logout" class="btn btn-primary btn-clear">Log Out</a>';
    html += '</div>';
  }
  html += '</nav><main>';

  html += '<div class="text-center mb-3">';
  html += '<h1 class="main-heading">' + escapeHtml(heading) + '</h1>';
  if (subheading) {
    html += '<p class="sub-heading text-muted">' + escapeHtml(subheading) + '</p>';
  }
  html += '</div>';
  return html;
}

// The bottom of every page. script.js gives us the same client-side validation as before.
function pageEnd() {
  return '</main></div><script src="/script.js"></script></body></html>';
}

/*
  errorPage(status, message, backUrl, user)
  The one page we show for EVERY error, so error messages look consistent.
  - status: 400 / 401 / 403 / 404 (shown as a title)
  - backUrl: where the "Go back" button points
*/
function errorPage(status, message, backUrl, user) {
  let title = 'Something went wrong';
  if (status === 400) { title = 'Please fix the following'; }
  if (status === 401) { title = 'Login failed'; }
  if (status === 403) { title = 'Not allowed'; }
  if (status === 404) { title = 'Not found'; }

  let html = pageStart(title, title, '', user);
  html += '<section class="card p-4 mb-4 text-center">';
  html += '<p style="color: red">' + escapeHtml(message) + '</p>';
  html += '<div><a href="' + escapeHtml(backUrl) + '" class="btn btn-primary">Go back</a></div>';
  html += '</section>';
  html += pageEnd();
  return html;
}


/* ---- (more pages are added below: owner, provider, reviews, dashboards) ---- */


// module.exports: lets server.js use these functions with require('./pages').
module.exports = {
  escapeHtml: escapeHtml,
  errorPage: errorPage
};
