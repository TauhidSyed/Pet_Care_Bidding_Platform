/*
  pages.js  -  BUILDS THE SMALL DYNAMIC PIECES OF THE PAGES
  ----------------------------------------------------------------------
  The pages themselves are our teammates' HTML files (private/*.html and
  public/browse-requests.html). They contain placeholder comments such as
      <!-- BID_CARDS --> ...their sample cards... <!-- /BID_CARDS -->
  server.js reads the file and swaps what's between the two markers for real data.

  This file builds ONLY that real data, as small HTML strings made with for loops
  (Lecture 15/16 style): pet cards, <option> lists, request cards, bid cards,
  review cards, and the bid-form area on the request details page.
  - The pieces copy the markup of the teammates' sample cards (same Bootstrap classes,
    same class names like "browse-request-card" and "provider-bid-card"), so the page
    looks exactly like their design and script.js still finds what it needs.
  - Data comes from the database through logic.js, so field names are the database
    column names: pet.name, pet.pet_type, request.service_start, bid.proposed_price ...
  - Links start with "/" (e.g. "/requests/3") so they work from any page.

  It also keeps one full page of its own: errorPage(), the shared error page.
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
  if (status === 'closed') { return 'Closed - provider chosen'; }
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

// A grey "nothing here yet" line, used when a list is empty.
function emptyMessage(text) {
  return '<p class="text-muted">' + text + '</p>';
}


/* =====================================================================
   OWNER PIECES
   ===================================================================== */

/*
  petCards(pets)  ->  fills <!-- PET_CARDS --> in pets.html
  One card per pet: photo (if it has one) + name, type, breed, age.
*/
function petCards(pets) {
  if (pets.length === 0) {
    return '<div class="container">' + emptyMessage('You have not added any pets yet.') + '</div>';
  }
  let html = '<div class="container"><div class="row g-4 my-3">';
  for (let i = 0; i < pets.length; i++) {
    const pet = pets[i];
    html += '<div class="col-12 col-md-6 col-lg-4"><section class="card p-4 h-100">';
    if (pet.photo_url) {
      html += '<img src="' + escapeHtml(pet.photo_url) + '" alt="Photo of ' + escapeHtml(pet.name) + '" class="img-fluid mb-3" />';
    }
    html += '<h2 class="card-title">' + escapeHtml(pet.name) + '</h2>';
    html += '<p class="mb-1"><strong>Type:</strong> ' + escapeHtml(pet.pet_type) + '</p>';
    html += '<p class="mb-1"><strong>Breed:</strong> ' + escapeHtml(pet.breed) + '</p>';
    html += '<p class="mb-0"><strong>Age:</strong> ' + escapeHtml(pet.age_years) + '</p>';
    html += '</section></div>';
  }
  html += '</div></div>';
  return html;
}

/*
  petOptions(pets)  ->  fills <!-- PET_OPTIONS --> in create-request.html
  One <option> per pet, value = pet id, text = "Cloud - cat" (same format as their sample options).
*/
function petOptions(pets) {
  const ids = [];
  const labels = [];
  for (let i = 0; i < pets.length; i++) {
    ids.push(String(pets[i].id));
    labels.push(pets[i].name + ' - ' + pets[i].pet_type);
  }
  return optionsHtml(ids, labels, '');
}

/*
  ownerRequestCard(item)
  One request card on owner-requests.html, in the same layout as their sample card.
  What it shows depends on the status:
    open      -> the bids + "Select Provider" form
    closed    -> the chosen provider + "Mark as Completed" button
    completed -> the provider + "Leave a Review" link
  item = { request, pet, bids: [{ bid, carer }] }  (from logic.getOwnerRequests)
*/
function ownerRequestCard(item) {
  const request = item.request;
  let html = '<section class="card p-4 mb-4">';
  html += '<h3 class="card-title">' + serviceLabel(request.service) + ' for ' + escapeHtml(item.pet.name) + '</h3>';
  html += '<p><strong>Status:</strong> ' + statusLabel(request.status) + '</p>';
  html += '<p><strong>Service date:</strong> ' + formatDate(request.service_start) + ' to ' + formatDate(request.service_end) + '</p>';
  html += '<p><strong>Budget:</strong> AED ' + escapeHtml(request.budget) + '</p>';
  html += '<p><strong>Bidding deadline:</strong> ' + formatDate(request.bidding_deadline) + '</p>';

  // List the bids, and remember the active ones for the dropdown.
  html += '<h4 class="h5 mt-3">Submitted Bids</h4>';
  const activeIds = [];
  const activeLabels = [];
  let winnerName = '';
  if (item.bids.length === 0) {
    html += emptyMessage('No bids yet.');
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
    html += '<form action="/requests/' + request.id + '/select-bid" method="post">';
    html += '<label class="form-label" for="winning-bid-' + request.id + '">Choose a provider:</label>';
    html += '<select class="form-select" id="winning-bid-' + request.id + '" name="winningBidId" required>';
    html += '<option value="">Choose a bid</option>' + optionsHtml(activeIds, activeLabels, '') + '</select>';
    html += '<button type="submit" class="btn btn-primary mt-2">Select Provider</button>';
    html += '</form>';
  } else if (request.status === 'closed') {
    html += '<p><strong>Provider:</strong> ' + escapeHtml(winnerName) + '</p>';
    html += '<form action="/requests/' + request.id + '/complete" method="post">';
    html += '<button type="submit" class="btn btn-primary mt-0">Mark as Completed</button>';
    html += '</form>';
  } else if (request.status === 'completed') {
    html += '<p><strong>Provider:</strong> ' + escapeHtml(winnerName) + '</p>';
    html += '<a href="/reviews" class="btn btn-primary align-self-start">Leave a Review</a>';
  }
  html += '<a href="/requests/' + request.id + '" class="btn btn-primary btn-clear align-self-start mt-2">View Details</a>';
  html += '</section>';
  return html;
}

/*
  ownerRequestCards(items, statuses, emptyText)
  All the cards whose status is in `statuses`, one after another.
  server.js calls it twice for owner-requests.html:
    <!-- OPEN_REQUESTS -->      gets ['open', 'closed']  (still in progress)
    <!-- COMPLETED_REQUESTS --> gets ['completed']
*/
function ownerRequestCards(items, statuses, emptyText) {
  let html = '';
  for (let i = 0; i < items.length; i++) {
    for (let s = 0; s < statuses.length; s++) {
      if (items[i].request.status === statuses[s]) {
        html += ownerRequestCard(items[i]);
      }
    }
  }
  if (html === '') {
    return emptyMessage(emptyText);
  }
  return html;
}


/* =====================================================================
   PROVIDER PIECES
   ===================================================================== */

/*
  browseCards(items)  ->  fills <!-- REQUEST_CARDS --> in browse-requests.html
  One card per open request, with the same data-* attributes as the teammates' sample
  cards. script.js reads those attributes to filter live while you type:
  data-pet-type, data-service, data-budget, data-instructions, and data-search.
  EXTRA FEATURE (tag search): data-search holds the request's tags (from request_tags).
  items = [{ request, pet, tags }] from logic.browseRequests
*/
function browseCards(items) {
  let html = '';
  for (let i = 0; i < items.length; i++) {
    const request = items[i].request;
    const pet = items[i].pet;
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
    // Empty instructions can be '' or null, so we check for "has text".
    if (request.instructions) {
      html += '<p class="text-muted">' + escapeHtml(request.instructions) + '</p>';
    }
    if (items[i].tags !== '') {
      html += '<p class="text-muted small">Tags: ' + escapeHtml(items[i].tags) + '</p>';
    }
    html += '<a href="/requests/' + request.id + '" class="btn btn-primary view-request mt-auto">View Request</a>';
    html += '</div></div>';
  }
  return html;
}

/*
  bidCards(items)  ->  fills <!-- BID_CARDS --> in bids.html
  One card per bid, in the same layout as their sample bid cards.
  If the bid can still change (item.canChange) it gets their form with "Save Edit" and
  "Withdraw Bid". Both buttons are in ONE form: "Save Edit" sends it to /bids/:id/edit,
  and "Withdraw Bid" uses formaction="/bids/:id/withdraw" (a normal HTML attribute that
  sends the same form to a different URL), so the layout stays exactly like theirs.
  items = [{ bid, request, pet, canChange }] from logic.getCarerBids
*/
function bidCards(items) {
  if (items.length === 0) {
    return '<div class="col-12">' + emptyMessage('You have not placed any bids yet. <a href="/browse-requests">Browse requests</a>') + '</div>';
  }
  let html = '';
  for (let i = 0; i < items.length; i++) {
    const bid = items[i].bid;
    const request = items[i].request;
    html += '<div class="col-12 col-lg-6 provider-bid-card"><section class="card p-4 h-100">';
    html += '<h2 class="card-title">' + serviceLabel(request.service) + ' for ' + escapeHtml(items[i].pet.name) + '</h2>';
    html += '<p><strong>Status:</strong> <span class="bid-status">' + statusLabel(bid.status) + '</span></p>';
    html += '<p><strong>Deadline:</strong> ' + formatDate(request.bidding_deadline) + '</p>';

    if (items[i].canChange) {
      // required / min / minlength = simple client-side checks done by the browser itself.
      html += '<form class="bid-edit-form" action="/bids/' + bid.id + '/edit" method="post">';
      html += '<div class="mb-3"><label class="form-label">Your price (AED):</label>';
      html += '<input type="number" class="form-control bid-price" name="bidPrice" min="0.01" step="0.01" required value="' + escapeHtml(bid.proposed_price) + '" /></div>';
      html += '<div class="mb-3"><label class="form-label">Service description:</label>';
      html += '<textarea class="form-control bid-description" name="bidDescription" rows="3" minlength="10" required>' + escapeHtml(bid.description) + '</textarea></div>';
      html += '<p class="bid-message" style="color: red"></p>';
      html += '<div class="d-flex flex-wrap align-items-center gap-2">';
      html += '<button type="submit" class="btn btn-primary mt-0">Save Edit</button>';
      // formnovalidate: withdrawing doesn't need the price/description boxes to be valid.
      html += '<button type="submit" formaction="/bids/' + bid.id + '/withdraw" formnovalidate class="btn btn-outline-danger mt-0 withdraw-bid">Withdraw Bid</button>';
      html += '</div></form>';
    } else {
      html += '<p><strong>Your price:</strong> AED ' + escapeHtml(bid.proposed_price) + '</p>';
      html += '<p class="text-muted">' + escapeHtml(bid.description) + '</p>';
    }
    html += '<a href="/requests/' + request.id + '" class="btn btn-primary btn-clear align-self-start mt-2">View Request</a>';
    html += '</section></div>';
  }
  return html;
}

/*
  bidAreaMessage(details)  ->  replaces <!-- BID_FORM --> on request-details.html
  when the teammates' bid form should NOT be shown:
    - owner:  the list of bids on their request
    - provider who already bid: their bid + a link to My Bids
    - provider when bidding is over: a short message
  (When a provider CAN bid, server.js keeps their form and only fills in the request id.)
  details comes from logic.getRequestDetails.
*/
function bidAreaMessage(user, details) {
  let html = '<section class="card p-4">';
  if (user.role === 'owner') {
    html += '<h2 class="card-title">Bids</h2>';
    if (details.bids.length === 0) {
      html += emptyMessage('No bids yet.');
    }
    for (let i = 0; i < details.bids.length; i++) {
      const bid = details.bids[i].bid;
      html += '<div class="card p-3 mb-2">';
      html += '<p class="mb-1"><strong>' + escapeHtml(details.bids[i].carer.username) + '</strong> - AED ' + escapeHtml(bid.proposed_price) + ' (' + statusLabel(bid.status) + ')</p>';
      html += '<p class="text-muted mb-0">' + escapeHtml(bid.description) + '</p></div>';
    }
    html += '<a href="/owner-requests" class="btn btn-primary mt-2">Manage on My Requests</a>';
  } else if (details.myBid !== null && details.myBid.status !== 'withdrawn') {
    html += '<h2 class="card-title">Your Bid</h2>';
    html += '<p><strong>Price:</strong> AED ' + escapeHtml(details.myBid.proposed_price) + '</p>';
    html += '<p><strong>Status:</strong> ' + statusLabel(details.myBid.status) + '</p>';
    html += '<a href="/bids" class="btn btn-primary">Go to My Bids</a>';
  } else {
    html += '<p class="mb-0">Bidding is closed for this request.</p>';
  }
  html += '</section>';
  return html;
}


/* =====================================================================
   REVIEW PIECES
   ===================================================================== */

/*
  reviewCards(info)  ->  fills <!-- REVIEW_LIST --> in reviews.html
  Same card layout as their sample reviews: name + stars, comment, which service.
  First the reviews other people wrote about me, then the ones I wrote ("About ...").
  info comes from logic.getReviewsPage: { about, written, reviewable }.
*/
function reviewCards(info) {
  let html = '';
  for (let i = 0; i < info.about.length; i++) {
    const item = info.about[i];
    html += '<div class="card p-3 mb-3">';
    html += '<h3 class="h5">' + escapeHtml(item.reviewer.username) + ' <span class="text-warning">' + stars(item.review.rating) + '</span></h3>';
    html += '<p class="mb-1">' + escapeHtml(item.review.comment) + '</p>';
    html += '<p class="text-muted mb-0">' + serviceLabel(item.request.service) + ' for ' + escapeHtml(item.pet.name) + '</p>';
    html += '</div>';
  }
  for (let i = 0; i < info.written.length; i++) {
    const item = info.written[i];
    html += '<div class="card p-3 mb-3">';
    html += '<h3 class="h5">You about ' + escapeHtml(item.reviewee.username) + ' <span class="text-warning">' + stars(item.review.rating) + '</span></h3>';
    html += '<p class="mb-1">' + escapeHtml(item.review.comment) + '</p>';
    html += '<p class="text-muted mb-0">' + serviceLabel(item.request.service) + ' for ' + escapeHtml(item.pet.name) + '</p>';
    html += '</div>';
  }
  if (html === '') {
    return emptyMessage('No reviews yet.');
  }
  return html;
}

/*
  reviewOptions(info)  ->  fills <!-- REVIEW_OPTIONS --> in reviews.html
  Only my completed services that I haven't reviewed yet: value = request id.
*/
function reviewOptions(info) {
  const ids = [];
  const labels = [];
  for (let i = 0; i < info.reviewable.length; i++) {
    const item = info.reviewable[i];
    ids.push(String(item.request.id));
    labels.push(serviceLabel(item.request.service) + ' for ' + item.pet.name + ' (with ' + item.partner.username + ')');
  }
  return optionsHtml(ids, labels, '');
}


/* =====================================================================
   ERROR PAGE (our own small page, used for every error)
   ===================================================================== */

/*
  errorPage(status, message, backUrl, user)
  The one page we show for EVERY error, so error messages look consistent.
  - status: 400 / 401 / 403 / 404 / 500 (shown as a title)
  - backUrl: where the "Go back" button points
  - user: the logged-in user or null (adds Dashboard / Log Out buttons)
*/
function errorPage(status, message, backUrl, user) {
  let title = 'Something went wrong';
  if (status === 400) { title = 'Please fix the following'; }
  if (status === 401) { title = 'Login failed'; }
  if (status === 403) { title = 'Not allowed'; }
  if (status === 404) { title = 'Not found'; }

  let html = '<!doctype html><html><head>';
  html += '<title>' + escapeHtml(title) + '</title>';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';
  html += '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" />';
  html += '<link rel="stylesheet" href="/styles.css" />';
  html += '</head><body><div class="container mt-3">';
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
  html += '<div class="text-center mb-3"><h1 class="main-heading">' + escapeHtml(title) + '</h1></div>';
  html += '<section class="card p-4 mb-4 text-center">';
  html += '<p style="color: red">' + escapeHtml(message) + '</p>';
  html += '<div><a href="' + escapeHtml(backUrl) + '" class="btn btn-primary">Go back</a></div>';
  html += '</section></main></div></body></html>';
  return html;
}


// module.exports: lets server.js use these functions with require('./pages').
module.exports = {
  escapeHtml: escapeHtml,
  serviceLabel: serviceLabel,
  formatDate: formatDate,
  petCards: petCards,
  petOptions: petOptions,
  ownerRequestCards: ownerRequestCards,
  browseCards: browseCards,
  bidCards: bidCards,
  bidAreaMessage: bidAreaMessage,
  reviewCards: reviewCards,
  reviewOptions: reviewOptions,
  errorPage: errorPage
};
