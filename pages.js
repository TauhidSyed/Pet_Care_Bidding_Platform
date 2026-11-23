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
  - The data comes from the database through logic.js, so field names are the database
    column names: pet.name, pet.pet_type, request.service_start, bid.proposed_price, user.role ...
    Dates arrive as JavaScript Date objects and prices as DECIMAL values (shown with String()).
  - The form input names (petName, bidPrice, ...) did NOT change: they match the teammates'
    HTML and script.js. logic.js copies them into the right database columns.
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
  // Empty database columns come back as null: show nothing instead of the word "null".
  if (text === null || text === undefined) {
    return '';
  }
  // String() also turns DECIMAL prices from the database (e.g. budget 120.00) into normal text: "120".
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

// A DATETIME from the database (a JavaScript Date) -> "12/5/2026, 9:00:00 AM"
// (same toLocaleString() script.js uses)
function formatDate(date) {
  return new Date(date).toLocaleString();
}

// Status words for people: "open" -> "Open - accepting bids", "active" -> "Active", etc.
function statusLabel(status) {
  if (status === 'open') { return 'Open - accepting bids'; }
  if (status === 'closed') { return 'Closed'; }
  if (status === 'completed') { return 'Completed'; }
  if (status === 'active') { return 'Active'; }
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
    if (user.role === 'carer') {
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
    html += '<img src="' + escapeHtml(pet.photo_url) + '" alt="Photo of ' + escapeHtml(pet.name) + '" class="img-fluid mb-3" />';
    html += '<h2 class="card-title">' + escapeHtml(pet.name) + '</h2>';
    html += '<p class="mb-1"><strong>Type:</strong> ' + escapeHtml(pet.pet_type) + '</p>';
    html += '<p class="mb-1"><strong>Breed:</strong> ' + escapeHtml(pet.breed) + '</p>';
    html += '<p class="mb-0"><strong>Age:</strong> ' + escapeHtml(pet.age_years) + '</p>';
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
    petLabels.push(pets[i].name + ' - ' + pets[i].pet_type);
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
  html += '<h3 class="card-title">' + serviceLabel(request.service) + ' for ' + escapeHtml(item.pet.name) + '</h3>';
  html += '<p><strong>Status:</strong> ' + statusLabel(request.status) + '</p>';
  html += '<p><strong>Service:</strong> ' + formatDate(request.service_start) + ' to ' + formatDate(request.service_end) + '</p>';
  html += '<p><strong>Budget:</strong> AED ' + escapeHtml(request.budget) + '</p>';
  html += '<p><strong>Bidding deadline:</strong> ' + formatDate(request.bidding_deadline) + '</p>';

  // List the bids, and remember the active ones for the dropdown.
  html += '<h4 class="h5 mt-3">Submitted Bids</h4>';
  const activeIds = [];
  const activeLabels = [];
  let winnerName = '';
  if (item.bids.length === 0) {
    html += '<p class="text-muted">No bids yet.</p>';
  }
  for (let i = 0; i < item.bids.length; i++) {
    const bid = item.bids[i].bid;
    const carer = item.bids[i].carer;
    html += '<div class="card p-3 mb-3">';
    html += '<p class="mb-1"><strong>' + escapeHtml(carer.username) + '</strong> (' + statusLabel(bid.status) + ')</p>';
    html += '<p class="mb-1">AED ' + escapeHtml(bid.proposed_price) + '</p>';
    html += '<p class="text-muted mb-0">' + escapeHtml(bid.description) + '</p>';
    html += '</div>';
    if (bid.status === 'active') {
      activeIds.push(String(bid.id));
      activeLabels.push(carer.username + ' - AED ' + bid.proposed_price);
    }
    // The accepted bid is the winner (the database has no separate "winner" column).
    if (bid.status === 'accepted') {
      winnerName = carer.username;
    }
  }

  if (request.status === 'open') {
    // Pick a winner. "required" = the browser won't send an empty choice (client-side check).
    html += '<form action="/requests/' + request.id + '/select-bid" method="POST">';
    html += '<label class="form-label" for="winning-bid-' + request.id + '">Choose a provider:</label>';
    html += '<select class="form-select" id="winning-bid-' + request.id + '" name="winningBidId" required>';
    html += '<option value="">Choose a bid</option>' + optionsHtml(activeIds, activeLabels, '') + '</select>';
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


/* =====================================================================
   PROVIDER PAGES
   ===================================================================== */

/*
  browsePage(user, items, query, services, petTypes)
  "Browse Care Requests". Two kinds of filtering work together:
    1. SERVER: the filters are a GET form (action="/browse-requests"), so pressing
       "Apply Filters" sends ?search=...&petType=... and the route filters with req.query.
    2. BROWSER: script.js still filters the cards live while you type. For that it needs the
       same ids (#request-search, #pet-type-filter, ...) and the data-* attributes on each card.
  EXTRA FEATURE (tag search): each card's data-search holds the request's tags, which
  script.js searches; the server search checks the tags too.
  items = [{ request, pet, tags }] from logic.browseRequests, query = req.query (to keep the typed values).
*/
function browsePage(user, items, query, services, petTypes) {
  let html = pageStart('Requests', 'Browse Care Requests', 'Find a request that matches the care you provide.', user);

  // Keep what the user typed in the boxes after the page reloads.
  let search = '';
  let petType = '';
  let service = '';
  let maxBudget = '';
  if (query.search) { search = String(query.search); }
  if (query.pet_type) { petType = String(query.pet_type); }
  if (query.service) { service = String(query.service); }
  if (query.maxBudget) { maxBudget = String(query.maxBudget); }

  const serviceLabels = [];
  for (let i = 0; i < services.length; i++) {
    serviceLabels.push(serviceLabel(services[i]));
  }
  const petTypeLabels = ['Cat', 'Dog', 'Other'];

  html += '<section class="card p-4 mb-4"><h2 class="card-title">Find Requests</h2>';
  html += '<form action="/browse-requests" method="GET"><div class="row g-3">';
  html += '<div class="col-12 col-md-6 col-lg-4"><label for="request-search" class="form-label">Search:</label>';
  html += '<input type="search" class="form-control" id="request-search" name="search" placeholder="Search pet, instructions or tags" value="' + escapeHtml(search) + '" /></div>';
  html += '<div class="col-12 col-md-6 col-lg-3"><label for="pet-type-filter" class="form-label">Pet type:</label>';
  html += '<select class="form-select" id="pet-type-filter" name="petType"><option value="">All pet types</option>' + optionsHtml(petTypes, petTypeLabels, petType) + '</select></div>';
  html += '<div class="col-12 col-md-6 col-lg-3"><label for="service-filter" class="form-label">Service:</label>';
  html += '<select class="form-select" id="service-filter" name="service"><option value="">All services</option>' + optionsHtml(services, serviceLabels, service) + '</select></div>';
  html += '<div class="col-12 col-md-6 col-lg-2"><label for="budget-filter" class="form-label">Max budget (AED):</label>';
  html += '<input type="number" class="form-control" id="budget-filter" name="maxBudget" placeholder="Any" value="' + escapeHtml(maxBudget) + '" /></div>';
  html += '</div><div class="mt-3 d-flex gap-2">';
  html += '<button type="submit" class="btn btn-primary mt-0">Apply Filters</button>';
  // A link back to /browse-requests with no ?query = no server filters. script.js also clears the boxes on click.
  html += '<a href="/browse-requests" id="clear-filters" class="btn btn-primary btn-clear mt-0">Clear Filters</a>';
  html += '</div></form></section>';

  html += '<div class="d-flex justify-content-between align-items-center mb-3">';
  html += '<h2 class="card-title mb-0">Available Requests</h2>';
  html += '<p id="request-count" class="text-muted mb-0">' + items.length + ' requests found</p></div>';
  // Shown only when there are no cards.
  let hiddenAttr = '';
  if (items.length > 0) {
    hiddenAttr = ' hidden';
  }
  html += '<p id="no-requests-message" class="text-muted"' + hiddenAttr + '>No requests match those filters.</p>';

  html += '<div class="row g-4" id="request-list">';
  for (let i = 0; i < items.length; i++) {
    const request = items[i].request;
    const pet = items[i].pet;
    // data-* attributes: script.js reads these to filter without reloading.
    html += '<div class="col-12 col-md-6 col-lg-4 browse-request-card"';
    html += ' data-pet="' + escapeHtml(pet.name) + '"';
    html += ' data-pet-type="' + escapeHtml(pet.pet_type) + '"';
    html += ' data-service="' + escapeHtml(request.service) + '"';
    html += ' data-service-name="' + serviceLabel(request.service) + '"';
    html += ' data-budget="' + escapeHtml(request.budget) + '"';
    html += ' data-instructions="' + escapeHtml(request.instructions) + '"';
    html += ' data-search="' + escapeHtml(items[i].tags) + '">';
    html += '<div class="card p-4 h-100">';
    html += '<h3 class="card-title">' + serviceLabel(request.service) + ' for ' + escapeHtml(pet.name) + '</h3>';
    html += '<p><strong>Pet:</strong> ' + escapeHtml(pet.name) + ' - ' + escapeHtml(pet.pet_type) + '</p>';
    html += '<p><strong>Service:</strong> ' + serviceLabel(request.service) + '</p>';
    html += '<p><strong>Service date:</strong> ' + formatDate(request.service_start) + '</p>';
    html += '<p><strong>Budget:</strong> AED ' + escapeHtml(request.budget) + '</p>';
    html += '<p><strong>Bidding deadline:</strong> ' + formatDate(request.bidding_deadline) + '</p>';
    // Empty instructions can be '' or null (empty column), so we check for "has text".
    if (request.instructions) {
      html += '<p class="text-muted">' + escapeHtml(request.instructions) + '</p>';
    }
    if (items[i].tags !== '') {
      html += '<p class="text-muted small">Tags: ' + escapeHtml(items[i].tags) + '</p>';
    }
    html += '<a href="/requests/' + request.id + '" class="btn btn-primary view-request mt-auto">View Request</a>';
    html += '</div></div>';
  }
  html += '</div>';

  html += pageEnd();
  return html;
}

/*
  requestDetailsPage(user, details)
  "Care Request Details". details comes from logic.getRequestDetails.
  - Providers see the bid form (only if details.canBid) or their existing bid.
  - Owners see the list of bids on their request.
  NOTE: the info card uses id="request-info", NOT "request-details-card": script.js fills
  "#request-details-card" with hard-coded sample data and would overwrite our real data.
*/
function requestDetailsPage(user, details) {
  const request = details.request;
  const pet = details.pet;
  let html = pageStart('Request Details', 'Care Request Details', '', user);

  html += '<div class="row justify-content-center mt-3">';
  html += '<div class="col-12 col-lg-7 mb-4"><section id="request-info" class="card p-4 h-100">';
  html += '<h2 class="card-title">Request Information</h2><div class="row">';
  html += '<div class="col-12 col-md-6"><p class="mb-1"><strong>Pet:</strong></p><p>' + escapeHtml(pet.name) + ' - ' + escapeHtml(pet.pet_type) + ' (' + escapeHtml(pet.breed) + ')</p></div>';
  html += '<div class="col-12 col-md-6"><p class="mb-1"><strong>Service:</strong></p><p>' + serviceLabel(request.service) + '</p></div>';
  html += '<div class="col-12 col-md-6"><p class="mb-1"><strong>Service starts:</strong></p><p>' + formatDate(request.service_start) + '</p></div>';
  html += '<div class="col-12 col-md-6"><p class="mb-1"><strong>Service ends:</strong></p><p>' + formatDate(request.service_end) + '</p></div>';
  html += '<div class="col-12 col-md-6"><p class="mb-1"><strong>Budget:</strong></p><p>AED ' + escapeHtml(request.budget) + '</p></div>';
  html += '<div class="col-12 col-md-6"><p class="mb-1"><strong>Bidding deadline:</strong></p><p>' + formatDate(request.bidding_deadline) + '</p></div>';
  html += '<div class="col-12 col-md-6"><p class="mb-1"><strong>Status:</strong></p><p>' + statusLabel(request.status) + '</p></div>';
  html += '<div class="col-12"><p class="mb-1"><strong>Care instructions:</strong></p><p>' + escapeHtml(request.instructions) + '</p></div>';
  html += '</div></section></div>';

  html += '<div class="col-12 col-lg-5 mb-4">';
  if (user.role === 'carer') {
    if (details.canBid) {
      // Same ids as request-details.html so script.js validates it. Posts to POST /requests/:id/bids.
      html += '<form id="bid-form" action="/requests/' + request.id + '/bids" method="POST" novalidate>';
      html += '<h2 class="card-title">Submit a Bid</h2>';
      html += '<div class="mb-3"><label for="bid-price" class="form-label">Proposed price (AED):</label>';
      html += '<input type="number" class="form-control" id="bid-price" name="bidPrice" /></div>';
      html += '<div class="mb-3"><label for="bid-description" class="form-label">Service description:</label>';
      html += '<textarea class="form-control" id="bid-description" name="bidDescription" rows="4"></textarea></div>';
      html += '<p id="bid-message" aria-live="polite"></p>';
      html += '<button type="submit" class="btn btn-primary">Submit Bid</button>';
      html += '</form>';
    } else if (details.myBid !== null && details.myBid.status !== 'withdrawn') {
      html += '<section class="card p-4"><h2 class="card-title">Your Bid</h2>';
      html += '<p><strong>Price:</strong> AED ' + escapeHtml(details.myBid.proposed_price) + '</p>';
      html += '<p><strong>Status:</strong> ' + statusLabel(details.myBid.status) + '</p>';
      html += '<a href="/bids" class="btn btn-primary">Go to My Bids</a></section>';
    } else {
      html += '<section class="card p-4"><p class="mb-0">Bidding is closed for this request.</p></section>';
    }
    html += '<a href="/browse-requests" class="btn btn-primary btn-clear mt-3">Back to Requests</a>';
  } else {
    html += '<section class="card p-4"><h2 class="card-title">Bids</h2>';
    if (details.bids.length === 0) {
      html += '<p class="text-muted mb-0">No bids yet.</p>';
    }
    for (let i = 0; i < details.bids.length; i++) {
      const bid = details.bids[i].bid;
      html += '<div class="card p-3 mb-2">';
      html += '<p class="mb-1"><strong>' + escapeHtml(details.bids[i].carer.username) + '</strong> - AED ' + escapeHtml(bid.proposed_price) + ' (' + statusLabel(bid.status) + ')</p>';
      html += '<p class="text-muted mb-0">' + escapeHtml(bid.description) + '</p></div>';
    }
    html += '</section>';
    html += '<a href="/owner-requests" class="btn btn-primary btn-clear mt-3">Back to My Requests</a>';
  }
  html += '</div></div>';

  html += pageEnd();
  return html;
}

/*
  bidsPage(user, items)
  "My Bids": a card per bid. If the bid can still change (item.canChange), it has an
  edit form (POST /bids/:id/edit) and a withdraw form (POST /bids/:id/withdraw).
  required / min / minlength = simple client-side checks done by the browser itself.
*/
function bidsPage(user, items) {
  let html = pageStart('My Bids', 'My Bids', 'Review bids you have submitted.', user);

  html += '<div class="row g-4">';
  if (items.length === 0) {
    html += '<p class="text-muted text-center">You have not placed any bids yet. <a href="/browse-requests">Browse requests</a></p>';
  }
  for (let i = 0; i < items.length; i++) {
    const bid = items[i].bid;
    const request = items[i].request;
    html += '<div class="col-12 col-lg-6 provider-bid-card"><section class="card p-4 h-100">';
    html += '<h2 class="card-title">' + serviceLabel(request.service) + ' for ' + escapeHtml(items[i].pet.name) + '</h2>';
    html += '<p><strong>Status:</strong> <span class="bid-status">' + statusLabel(bid.status) + '</span></p>';
    html += '<p><strong>Deadline:</strong> ' + formatDate(request.bidding_deadline) + '</p>';

    if (items[i].canChange) {
      html += '<form class="bid-edit-form" action="/bids/' + bid.id + '/edit" method="POST">';
      html += '<div class="mb-3"><label class="form-label">Your price (AED):</label>';
      html += '<input type="number" class="form-control bid-price" name="bidPrice" min="0.01" step="0.01" required value="' + escapeHtml(bid.proposed_price) + '" /></div>';
      html += '<div class="mb-3"><label class="form-label">Service description:</label>';
      html += '<textarea class="form-control bid-description" name="bidDescription" rows="3" minlength="10" required>' + escapeHtml(bid.description) + '</textarea></div>';
      html += '<button type="submit" class="btn btn-primary mt-0">Save Edit</button>';
      html += '</form>';
      html += '<form action="/bids/' + bid.id + '/withdraw" method="POST">';
      html += '<button type="submit" class="btn btn-outline-danger mt-2 withdraw-bid">Withdraw Bid</button>';
      html += '</form>';
    } else {
      html += '<p><strong>Your price:</strong> AED ' + escapeHtml(bid.proposed_price) + '</p>';
      html += '<p class="text-muted">' + escapeHtml(bid.description) + '</p>';
    }
    html += '<a href="/requests/' + request.id + '" class="btn btn-primary btn-clear align-self-start mt-2">View Request</a>';
    html += '</section></div>';
  }
  html += '</div>';

  html += pageEnd();
  return html;
}


/* =====================================================================
   REVIEWS PAGE
   ===================================================================== */

// 4 -> "★★★★☆" (filled stars for the rating, empty stars for the rest, out of 5)
function stars(rating) {
  let text = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      text += '★';
    } else {
      text += '☆';
    }
  }
  return text;
}

/*
  reviewsPage(user, info)
  info comes from logic.getReviewsPage: { about, written, reviewable }.
  Left: reviews about me + reviews I wrote. Right: the "Leave a Review" form, whose
  dropdown only lists my completed services that I haven't reviewed yet.
  The form posts to POST /reviews (fields: requestId, rating, comment).
*/
function reviewsPage(user, info) {
  let html = pageStart('Reviews', 'Reviews', 'Feedback from completed care services.', user);
  html += '<div class="row g-4">';

  html += '<div class="col-12 col-lg-7"><section class="card p-4 mb-4"><h2 class="card-title">Reviews About You</h2>';
  if (info.about.length === 0) {
    html += '<p class="text-muted mb-0">No reviews yet.</p>';
  }
  for (let i = 0; i < info.about.length; i++) {
    const item = info.about[i];
    html += '<div class="card p-3 mb-3">';
    html += '<h3 class="h5">' + escapeHtml(item.reviewer.username) + ' <span class="text-warning">' + stars(item.review.rating) + '</span></h3>';
    html += '<p class="mb-1">' + escapeHtml(item.review.comment) + '</p>';
    html += '<p class="text-muted mb-0">' + serviceLabel(item.request.service) + ' for ' + escapeHtml(item.pet.name) + '</p>';
    html += '</div>';
  }
  html += '</section>';

  html += '<section class="card p-4"><h2 class="card-title">Reviews You Wrote</h2>';
  if (info.written.length === 0) {
    html += '<p class="text-muted mb-0">You have not written any reviews yet.</p>';
  }
  for (let i = 0; i < info.written.length; i++) {
    const item = info.written[i];
    html += '<div class="card p-3 mb-3">';
    html += '<h3 class="h5">About ' + escapeHtml(item.reviewee.username) + ' <span class="text-warning">' + stars(item.review.rating) + '</span></h3>';
    html += '<p class="mb-1">' + escapeHtml(item.review.comment) + '</p>';
    html += '<p class="text-muted mb-0">' + serviceLabel(item.request.service) + ' for ' + escapeHtml(item.pet.name) + '</p>';
    html += '</div>';
  }
  html += '</section></div>';

  html += '<div class="col-12 col-lg-5">';
  if (info.reviewable.length === 0) {
    html += '<section class="card p-4"><h2 class="card-title">Leave a Review</h2>';
    html += '<p class="text-muted mb-0">You can leave a review once one of your services is completed.</p></section>';
  } else {
    const ids = [];
    const labels = [];
    for (let i = 0; i < info.reviewable.length; i++) {
      const item = info.reviewable[i];
      ids.push(String(item.request.id));
      labels.push(serviceLabel(item.request.service) + ' for ' + item.pet.name + ' (with ' + item.partner.username + ')');
    }
    html += '<form id="review-form" action="/reviews" method="POST">';
    html += '<h2 class="card-title">Leave a Review</h2>';
    html += '<div class="mb-3"><label for="review-service" class="form-label">Completed service:</label>';
    html += '<select class="form-select" id="review-service" name="requestId" required><option value="">Choose a service</option>' + optionsHtml(ids, labels, '') + '</select></div>';
    html += '<div class="mb-3"><label for="review-rating" class="form-label">Rating:</label>';
    html += '<select class="form-select" id="review-rating" name="rating" required><option value="">Choose a rating</option>';
    html += optionsHtml(['5', '4', '3', '2', '1'], ['5 - Excellent', '4 - Good', '3 - Okay', '2 - Poor', '1 - Very poor'], '') + '</select></div>';
    html += '<div class="mb-3"><label for="review-comment" class="form-label">Comment:</label>';
    html += '<textarea class="form-control" id="review-comment" name="comment" rows="4" maxlength="1000"></textarea></div>';
    html += '<p id="review-message" style="color: red"></p>';
    html += '<button type="submit" class="btn btn-primary">Submit Review</button>';
    html += '</form>';
  }
  html += '</div></div>';

  html += pageEnd();
  return html;
}


/* =====================================================================
   DASHBOARDS
   Same layout as owner-dashboard.html / provider-dashboard.html:
   3 number cards on top, then the lists, then "What would you like to do?" cards.
   ===================================================================== */

// One of the 3 number cards at the top ("Your Pets  2").
function statCard(title, count) {
  return '<div class="col-md-4 mb-3"><div class="card p-4"><h2 class="card-title mb-2">' + title +
    '</h2><div class="stat-number">' + count + '</div></div></div>';
}

// One of the "What would you like to do?" cards: a title, a sentence, a button link.
function actionCard(title, text, url, buttonText) {
  return '<div class="col-md-6 mb-4"><div class="card p-4 h-100 d-flex flex-column">' +
    '<h3 class="card-title dashboard-card-title">' + title + '</h3>' +
    '<p class="text-muted mb-4">' + text + '</p>' +
    '<div class="mt-auto"><a href="' + url + '" class="btn btn-primary mt-0">' + buttonText + '</a></div>' +
    '</div></div>';
}

/*
  requestListCard(title, items, emptyText)
  A card with a short list of requests: "Pet walking for Cloud - 12/5/2026 ..." each linking
  to its details page. items = [{ request, pet }] (bid items also have these two fields).
*/
function requestListCard(title, items, emptyText) {
  let html = '<div class="col-md-4 mb-3"><section class="card p-4 h-100"><h2 class="h5 card-title">' + title + '</h2>';
  if (items.length === 0) {
    html += '<p class="text-muted mb-0">' + emptyText + '</p>';
  }
  html += '<ul class="list-unstyled mb-0">';
  for (let i = 0; i < items.length; i++) {
    const request = items[i].request;
    html += '<li class="mb-2"><a href="/requests/' + request.id + '">' + serviceLabel(request.service) + ' for ' +
      escapeHtml(items[i].pet.name) + '</a><br /><span class="text-muted small">' + formatDate(request.service_start) + '</span></li>';
  }
  html += '</ul></section></div>';
  return html;
}

/*
  ownerDashboardPage(user, dash)
  dash comes from logic.getOwnerDashboard.
*/
function ownerDashboardPage(user, dash) {
  let html = pageStart('Dashboard', 'Welcome back, ' + user.username + '!', 'Manage your pets and care requests from here.', user);

  html += '<div class="row mb-3 text-center">';
  html += statCard('Your Pets', dash.pets.length);
  html += statCard('Open Requests', dash.openRequests.length);
  html += statCard('Completed Requests', dash.completedRequests.length);
  html += '</div>';

  html += '<div class="row mb-3">';
  html += requestListCard('Open (taking bids)', dash.openRequests, 'No open requests.');
  html += requestListCard('Active (provider chosen)', dash.closedRequests, 'Nothing in progress.');
  html += requestListCard('Completed', dash.completedRequests, 'Nothing completed yet.');
  html += '</div>';

  html += '<h2 class="text-center mb-4">What would you like to do?</h2><div class="row">';
  html += actionCard('Manage Your Pets', 'View and add your pet profiles.', '/pets', 'View Pets');
  html += actionCard('Create a Care Request', 'Tell providers what service your pet needs and when.', '/create-request', 'Create Request');
  html += actionCard('My Requests', 'Review your requests and compare provider bids.', '/owner-requests', 'View Requests');
  html += actionCard('Reviews', 'Read and leave reviews for completed care services.', '/reviews', 'View Reviews');
  html += '</div>';

  html += pageEnd();
  return html;
}

/*
  providerDashboardPage(user, dash)
  dash comes from logic.getProviderDashboard.
*/
function providerDashboardPage(user, dash) {
  let html = pageStart('Dashboard', 'Welcome back, ' + user.username + '!', 'Find requests, manage your bids and track your jobs.', user);

  html += '<div class="row mb-3 text-center">';
  html += statCard('Current Tasks', dash.currentTasks.length);
  html += statCard('Active Bids', dash.activeBids.length);
  html += statCard('Completed Requests', dash.completedTasks.length);
  html += '</div>';

  html += '<div class="row mb-3">';
  html += requestListCard('Current Tasks (you won)', dash.currentTasks, 'No current tasks.');
  html += requestListCard('Active Bids', dash.activeBids, 'No active bids.');
  html += requestListCard('Completed', dash.completedTasks, 'Nothing completed yet.');
  html += '</div>';

  html += '<h2 class="text-center mb-4">What would you like to do?</h2><div class="row">';
  html += actionCard('Browse Requests', 'Find care requests that match the service you provide.', '/browse-requests', 'Browse Requests');
  html += actionCard('Your Bids', 'Edit or withdraw the bids you have placed.', '/bids', 'View Bids');
  html += actionCard('Your Reviews', 'See what owners said about you and review them back.', '/reviews', 'View Reviews');
  html += '</div>';

  html += pageEnd();
  return html;
}


// module.exports: lets server.js use these functions with require('./pages').
module.exports = {
  escapeHtml: escapeHtml,
  errorPage: errorPage,
  petsPage: petsPage,
  createRequestPage: createRequestPage,
  ownerRequestsPage: ownerRequestsPage,
  browsePage: browsePage,
  requestDetailsPage: requestDetailsPage,
  bidsPage: bidsPage,
  reviewsPage: reviewsPage,
  ownerDashboardPage: ownerDashboardPage,
  providerDashboardPage: providerDashboardPage
};
