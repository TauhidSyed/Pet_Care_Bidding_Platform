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


/* =====================================================================
   OWNER PAGES
   ===================================================================== */

/*
  petsPage(user, pets)
  "My Pets": a card per pet (photo + details) and the add-pet form.
  The form keeps the ids from pets.html (#pet-form, #pet-name, ...) so script.js
  still validates it, and posts to POST /pets.
*/
function petsPage(user, pets) {
  let html = pageStart('My Pets', 'My Pets', 'Your pet profiles.', user);

  html += '<div class="row g-4 mb-4">';
  if (pets.length === 0) {
    html += '<p class="text-muted text-center">You have not added any pets yet.</p>';
  }
  for (let i = 0; i < pets.length; i++) {
    const pet = pets[i];
    html += '<div class="col-12 col-md-6 col-lg-4"><section class="card p-4 h-100">';
    html += '<img src="' + escapeHtml(pet.petPhoto) + '" alt="Photo of ' + escapeHtml(pet.petName) + '" class="img-fluid mb-3" />';
    html += '<h2 class="card-title">' + escapeHtml(pet.petName) + '</h2>';
    html += '<p class="mb-1"><strong>Type:</strong> ' + escapeHtml(pet.petType) + '</p>';
    html += '<p class="mb-1"><strong>Breed:</strong> ' + escapeHtml(pet.petBreed) + '</p>';
    html += '<p class="mb-0"><strong>Age:</strong> ' + escapeHtml(pet.petAge) + '</p>';
    html += '</section></div>';
  }
  html += '</div>';

  // Add-pet form: method="POST" + action="/pets" makes the browser send it to our route.
  html += '<h2 class="text-center">Add a Pet</h2>';
  html += '<form id="pet-form" action="/pets" method="POST" novalidate>';
  html += '<label for="pet-name">Pet name:</label><input type="text" id="pet-name" name="petName" />';
  html += '<label for="pet-type">Type of pet:</label><select id="pet-type" name="petType">';
  html += '<option value="">Choose a type</option>' + optionsHtml(['cat', 'dog', 'other'], ['Cat', 'Dog', 'Other'], '');
  html += '</select>';
  html += '<label for="pet-breed">Breed:</label><input type="text" id="pet-breed" name="petBreed" />';
  html += '<label for="pet-age">Age:</label><input type="number" id="pet-age" name="petAge" />';
  html += '<label for="pet-photo">Photo URL:</label><input type="url" id="pet-photo" name="petPhoto" />';
  html += '<p id="pet-message" style="color: red"></p>';
  html += '<button type="submit" class="btn btn-primary">Add Pet</button>';
  html += '</form>';

  html += pageEnd();
  return html;
}

/*
  createRequestPage(user, pets, services)
  The "Create a Care Request" form, with the pet dropdown built from THIS owner's pets
  (the old page had hard-coded pets). Posts to POST /requests.
  Same ids as create-request.html so script.js validates it.
  NEW field: "tags" (keywords for our tag-search extra feature).
*/
function createRequestPage(user, pets, services) {
  let html = pageStart('Create Request', 'Creating a Care Request', '', user);

  if (pets.length === 0) {
    html += '<section class="card p-4 text-center"><p>You need to add a pet before you can create a request.</p>';
    html += '<div><a href="/pets" class="btn btn-primary">Add a Pet</a></div></section>';
    html += pageEnd();
    return html;
  }

  // Build the pet options: value = pet id, text = "Cloud - cat"
  const petIds = [];
  const petLabels = [];
  for (let i = 0; i < pets.length; i++) {
    petIds.push(String(pets[i].id));
    petLabels.push(pets[i].petName + ' - ' + pets[i].petType);
  }
  const serviceLabels = [];
  for (let i = 0; i < services.length; i++) {
    serviceLabels.push(serviceLabel(services[i]));
  }

  html += '<form id="create-request-form" action="/requests" method="POST" novalidate>';
  html += '<div class="row">';
  html += '<div class="col-12 col-md-6"><label for="pet">Your pet:</label><select id="pet" name="petId" required>';
  html += '<option value="">Choose a pet</option>' + optionsHtml(petIds, petLabels, '') + '</select></div>';
  html += '<div class="col-12 col-md-6"><label for="service">Required Service:</label><select id="service" name="service" required>';
  html += '<option value="">Choose a service</option>' + optionsHtml(services, serviceLabels, '') + '</select></div>';
  html += '</div>';

  html += '<div class="row">';
  html += '<div class="col-12 col-md-6"><label for="start-time">Service starts at:</label><input type="datetime-local" id="start-time" name="startTime" required /></div>';
  html += '<div class="col-12 col-md-6"><label for="end-time">Service ends at:</label><input type="datetime-local" id="end-time" name="endTime" required /></div>';
  html += '</div>';

  html += '<div class="row">';
  html += '<div class="col-12 col-md-6"><label for="budget">Total budget (AED):</label><input type="number" id="budget" name="budget" required /></div>';
  html += '<div class="col-12 col-md-6"><label for="deadline">Bidding Deadline:</label><input type="datetime-local" id="deadline" name="deadline" required /></div>';
  html += '</div>';

  html += '<div class="row"><div class="col-12">';
  html += '<label for="additional-instructions">Additional care instructions (optional):</label>';
  html += '<textarea id="additional-instructions" name="instructions"></textarea>';
  html += '</div></div>';

  html += '<div class="row"><div class="col-12">';
  html += '<label for="request-tags">Search tags (optional, separated by spaces):</label>';
  html += '<input type="text" id="request-tags" name="tags" placeholder="e.g. calm indoor sharjah" />';
  html += '</div></div>';

  html += '<p id="request-message" style="color: red"></p>';
  html += '<div class="row"><div class="col-12"><button type="submit" class="btn btn-primary">Create Request</button></div></div>';
  html += '</form>';

  html += pageEnd();
  return html;
}

/*
  ownerRequestCard(item)
  One request card on the "My Requests" page. What it shows depends on the status:
    open      -> the bids + "Select Provider" form + "Close Request" button
    closed    -> the chosen provider + "Mark as Completed" button (if a winner exists)
    completed -> the provider + "Leave a Review" link
  item = { request, pet, bids: [{ bid, carer }] }  (from logic.getOwnerRequests)
*/
function ownerRequestCard(item) {
  const request = item.request;
  let html = '<section class="card p-4 mb-4">';
  html += '<h3 class="card-title">' + serviceLabel(request.service) + ' for ' + escapeHtml(item.pet.petName) + '</h3>';
  html += '<p><strong>Status:</strong> ' + statusLabel(request.status) + '</p>';
  html += '<p><strong>Service:</strong> ' + formatDate(request.startTime) + ' to ' + formatDate(request.endTime) + '</p>';
  html += '<p><strong>Budget:</strong> AED ' + escapeHtml(request.budget) + '</p>';
  html += '<p><strong>Bidding deadline:</strong> ' + formatDate(request.deadline) + '</p>';

  // List the bids, and remember the pending ones for the dropdown.
  html += '<h4 class="h5 mt-3">Submitted Bids</h4>';
  const pendingIds = [];
  const pendingLabels = [];
  let winnerName = '';
  if (item.bids.length === 0) {
    html += '<p class="text-muted">No bids yet.</p>';
  }
  for (let i = 0; i < item.bids.length; i++) {
    const bid = item.bids[i].bid;
    const carer = item.bids[i].carer;
    html += '<div class="card p-3 mb-3">';
    html += '<p class="mb-1"><strong>' + escapeHtml(carer.username) + '</strong> (' + statusLabel(bid.status) + ')</p>';
    html += '<p class="mb-1">AED ' + escapeHtml(bid.bidPrice) + '</p>';
    html += '<p class="text-muted mb-0">' + escapeHtml(bid.bidDescription) + '</p>';
    html += '</div>';
    if (bid.status === 'pending') {
      pendingIds.push(String(bid.id));
      pendingLabels.push(carer.username + ' - AED ' + bid.bidPrice);
    }
    if (bid.id === request.winningBidId) {
      winnerName = carer.username;
    }
  }

  if (request.status === 'open') {
    // Pick a winner. "required" = the browser won't send an empty choice (client-side check).
    html += '<form action="/requests/' + request.id + '/select-bid" method="POST">';
    html += '<label class="form-label" for="winning-bid-' + request.id + '">Choose a provider:</label>';
    html += '<select class="form-select" id="winning-bid-' + request.id + '" name="winningBidId" required>';
    html += '<option value="">Choose a bid</option>' + optionsHtml(pendingIds, pendingLabels, '') + '</select>';
    html += '<button type="submit" class="btn btn-primary mt-2">Select Provider</button>';
    html += '</form>';
    // Closing is a separate form, so it doesn't need a bid to be chosen.
    html += '<form action="/requests/' + request.id + '/close" method="POST">';
    html += '<button type="submit" class="btn btn-outline-danger mt-2">Close Request</button>';
    html += '</form>';
  } else if (request.status === 'closed') {
    if (winnerName !== '') {
      html += '<p><strong>Provider:</strong> ' + escapeHtml(winnerName) + '</p>';
      html += '<form action="/requests/' + request.id + '/complete" method="POST">';
      html += '<button type="submit" class="btn btn-primary mt-0">Mark as Completed</button>';
      html += '</form>';
    } else {
      html += '<p class="text-muted">Closed without choosing a provider.</p>';
    }
  } else if (request.status === 'completed') {
    html += '<p><strong>Provider:</strong> ' + escapeHtml(winnerName) + '</p>';
    html += '<a href="/reviews" class="btn btn-primary align-self-start">Leave a Review</a>';
  }
  html += '<a href="/requests/' + request.id + '" class="btn btn-primary btn-clear align-self-start mt-2">View Details</a>';
  html += '</section>';
  return html;
}

/*
  ownerRequestsPage(user, items)
  "Your Requests": the owner's requests in three groups (open / closed / completed),
  each built with ownerRequestCard.
*/
function ownerRequestsPage(user, items) {
  let html = pageStart('Your Requests', 'Your Requests', 'Review provider bids and completed services.', user);
  html += '<div class="text-center mb-4"><a href="/create-request" class="btn btn-primary">Create a New Request</a></div>';

  const groups = ['open', 'closed', 'completed'];
  const groupTitles = ['Open Requests', 'Closed Requests (provider chosen)', 'Completed Requests'];
  for (let g = 0; g < groups.length; g++) {
    html += '<h2 class="mb-3">' + groupTitles[g] + '</h2>';
    let count = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].request.status === groups[g]) {
        html += ownerRequestCard(items[i]);
        count++;
      }
    }
    if (count === 0) {
      html += '<p class="text-muted">None.</p>';
    }
  }

  html += pageEnd();
  return html;
}


/* ---- (more pages are added below: provider, reviews, dashboards) ---- */


// module.exports: lets server.js use these functions with require('./pages').
module.exports = {
  escapeHtml: escapeHtml,
  errorPage: errorPage,
  petsPage: petsPage,
  createRequestPage: createRequestPage,
  ownerRequestsPage: ownerRequestsPage
};
