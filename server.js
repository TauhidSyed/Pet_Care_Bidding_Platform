// J: I did not expect having to do server-side in 3 days.
/*
  server.js  -  THE WEB SERVER (Express)
  ----------------------------------------------------------------------
  This file only does the "web" part. Each route:
    1. reads what the browser sent (req.body / req.params / req.query),
    2. calls a function from logic.js (where all the rules live),
    3. sends the answer: a redirect or an HTML page (built in pages.js) on success,
       or an error page with the right status code (400 / 401 / 403 / 404).
  The logic.js functions talk to the MySQL database, so they are `async`. That's why every
  route is written  async (req, res) => { ... await logic.something(...) ... }:
  `await` waits for the database's answer before we build the page (see the top of logic.js).
  Start it with:  node server.js   then open http://127.0.0.1:3000/
*/

/* =====================================================================
   1. SETUP
   ===================================================================== */
const express = require('express');
const app = express();
const hostname = '127.0.0.1';
const port = 3000;
const path = require('path');
/*
    J: This is a built-in module in Node.js to handle file and directory paths:
    It works by joining path segments into a valid path and inserts the correct
    separator for the OS (since windows does \X\Y\Z and others do /X/Y/Z).
*/

/*----- Reading Data ------*/
app.use(express.urlencoded({ extended: true }));
// J: This reads form data (application/x-www-form-urlencoded) into req.body.
// Umar: { extended: true } = use the "qs" library to parse form data, which also
// understands nested names like pet[name]. Express 5 changed the default to false,
// so we say it explicitly (same as the lecture slides) to avoid surprises.

app.use(express.json());
// J: Reads request body, turns the string into a json, assigns it to req.body.
// J: Ill probably use this later so Ill just add it now.

/* =====================================================================
   2. DATA (MySQL database through Prisma, see logic.js)
   ===================================================================== */
// server.js never talks to the database directly: it always goes through logic.js
// (the only file that uses Prisma). So all database code is in one place.
const logic = require('./logic');
const pages = require('./pages');

/*
  sendError(res, result, backUrl, user)
  When a logic.js function returns { ok: false, status, error }, every route answers
  the same way: that status code + the shared error page. One helper = consistent errors.
*/
function sendError(res, result, backUrl, user) {
  res.status(result.status).send(pages.errorPage(result.status, result.error, backUrl, user));
}

/*
  toId(text)
  Turns an id from the URL or a form ("3") into a number (3) with parseInt.
  Our ids are numbers, and 3 === "3" is false, so we must convert before comparing.
  If it isn't a number at all (e.g. /requests/abc), parseInt gives NaN; logic.js checks for
  that before asking the database, and treats it as "not found" -> 404.
*/
function toId(text) {
  return parseInt(text);
}

/* =====================================================================
   3. AUTH (sessions + "are you logged in?" checks)
   ===================================================================== */

/*
  EXCEPTION (not in the lectures): express-session
  HTTP has no memory: every request arrives as if from a stranger. After a successful
  login we need to REMEMBER who this browser is. express-session does that:
    - it gives the browser a cookie holding a random session id (just an id, no secrets),
    - on the server it keeps a small object, req.session, linked to that id,
    - so on later requests req.session.userId tells us who is logged in.
  Settings:
    secret: used to sign the cookie so nobody can fake one. (Should move to the .env file later.)
    resave: false             -> don't re-save the session if nothing changed
    saveUninitialized: false  -> don't create sessions for visitors who never log in
*/
const session = require('express-session');
app.use(session({
  secret: 'cmp357-pet-care-change-this-secret',
  resave: false,
  saveUninitialized: false
}));

/*
  getCurrentUser(req)
  The logged-in user (their row from the users table), or null if nobody is logged in.
  We only keep the id + role in the session, and look up the rest in the database when needed.
  It's async because the lookup asks the database, so callers write: await getCurrentUser(req)
*/
async function getCurrentUser(req) {
  if (!req.session.userId) {
    return null;
  }
  return await logic.findUserById(req.session.userId);
}

/*
  EXCEPTION (not in the lectures): our own middleware functions
  A middleware is a function (req, res, next) that runs BEFORE the route.
  It either stops the request (redirect / error) or calls next() to continue to the route.
  We put it in front of a route like:  app.get('/pets', ownerOnly, async (req, res) => {...})
  Why: every private page needs the same "are you logged in? right role?" check;
  writing it once avoids forgetting it in one of 20 routes.
  They're async because finding the logged-in user asks the database.
*/

// authentication: must be logged in (any role). Not logged in -> go to the login page.
async function authentication(req, res, next) {
  if (await getCurrentUser(req) === null) {
    return res.redirect('/login.html');
  }
  next();
}

// ownerOnly: must be logged in AND a pet owner. Logged in as a provider -> 403 Forbidden.
async function ownerOnly(req, res, next) {
  const user = await getCurrentUser(req);
  if (user === null) {
    return res.redirect('/login.html');
  }
  if (user.role !== 'owner') {
    return res.status(403).send(pages.errorPage(403, 'Only pet owners can do this.', '/provider-dashboard', user));
  }
  next();
}

// carerOnly: must be logged in AND a care provider. Logged in as an owner -> 403 Forbidden.
async function carerOnly(req, res, next) {
  const user = await getCurrentUser(req);
  if (user === null) {
    return res.redirect('/login.html');
  }
  if (user.role !== 'carer') {
    return res.status(403).send(pages.errorPage(403, 'Only care providers can do this.', '/owner-dashboard', user));
  }
  next();
}

/* =====================================================================
   4. PUBLIC ROUTES (anyone, not logged in)
   ===================================================================== */

/*
  POST /register
  IN:   req.body from register.html: userType, username, email, password, confirmPassword,
        providerService, providerExperience
  DOES: logic.registerUser checks everything again (never trust the browser) and saves the user.
  OUT:  success -> redirect to the login page.
        problem -> 400 + error page listing what to fix.
*/
app.post('/register', async (req, res) => {
  const result = await logic.registerUser(req.body);
  if (!result.ok) {
    return sendError(res, result, '/register.html', null);
  }
  // Redirect after a POST so refreshing the page doesn't send the form twice.
  res.redirect('/login.html');
});

/*
  POST /login
  IN:   req.body.username, req.body.password
  DOES: logic.loginUser checks the password with bcrypt.
        On success we save the user's id and role in the session (= "logged in").
  OUT:  owner -> /owner-dashboard, carer -> /provider-dashboard.
        wrong details -> 401 (Unauthorized) + error page.
*/
app.post('/login', async (req, res) => {
  const result = await logic.loginUser(req.body.username, req.body.password);
  if (!result.ok) {
    return sendError(res, result, '/login.html', null);
  }
  req.session.userId = result.user.id;
  req.session.role = result.user.role;
  if (result.user.role === 'owner') {
    res.redirect('/owner-dashboard');
  } else {
    res.redirect('/provider-dashboard');
  }
});

/*
  GET /logout
  DOES: deletes this browser's session on the server, so its cookie no longer logs anyone in.
  OUT:  redirect to the "You are now logged out" page.
  destroy() takes a function that runs once the session is gone; we redirect inside it.
*/
app.get('/logout', function (req, res) {
  req.session.destroy(function () {
    res.redirect('/logged-out.html');
  });
});

/*----- Sending Files -----*/
app.use(express.static(path.join(__dirname, 'public')));
/*
    J: This line effectively handles all the files that will be requested.
    So first, "__dirname" is a global variable from Node.js, which holds the
    absolute path of the directory thats currently executing the JS file.
    Eg: Since I have C:\Users\Whatever\Pet_Care_Bidding_Platform\server.js
    then the __dirname will be C:\Users\Whatever\Pet_Care_Bidding_Platform.
    So for path.join(__dirname, 'public'), "path" I explained earlier, the
    "join" part adds them together so join(__dirname, 'public') just adds
    public to the __dirname we had earlier, so it'll become:
    C:\Users\Whatever\Pet_Care_Bidding_Platform\public

    Then we have express.static, it needs a root directory so we use the stuff
    from above for that, then it whenever theres a request, it takes the URL
    path of the request, matches it to the thing being requested in the root
    directory (not really but this explanation is long enough), and then sends
    it to the browser.
    The good thing is it only allows requests inside the root directory we
    sent, so anything outside of \public wont be allowed so this code here and
    anything else won't be shown.
    Remember though, it only calls next() if it fails to find a file that was
    requested, so since we are only doing links to html files we have, anything
    below this won't be seen. Which is fine if theres no errors

    app.use we learnt in class.
*/

/* =====================================================================
   5. OWNER ROUTES (logged in + userType "owner")
   ===================================================================== */
/*
  GET /owner-dashboard
  OUT: the owner dashboard: counts + lists of my pets, open, active and completed requests.
*/
app.get('/owner-dashboard', ownerOnly, async (req, res) => {
  const user = await getCurrentUser(req);
  res.send(pages.ownerDashboardPage(user, await logic.getOwnerDashboard(user.id)));
});
// Every route here has `ownerOnly` in front: not logged in -> login page, provider -> 403.
// The owner's id always comes from the SESSION, never from the form, so nobody can act as someone else.

/*
  GET /pets
  OUT: the "My Pets" page: the logged-in owner's pets + the add-pet form.
*/
app.get('/pets', ownerOnly, async (req, res) => {
  const user = await getCurrentUser(req);
  res.send(pages.petsPage(user, await logic.getPetsForOwner(user.id)));
});

/*
  POST /pets
  IN:   req.body: petName, petType, petBreed, petAge, petPhoto
  DOES: logic.addPet validates and saves the pet for THIS owner.
  OUT:  success -> back to /pets (the new pet shows up). Problem -> 400 + error page.
*/
app.post('/pets', ownerOnly, async (req, res) => {
  const user = await getCurrentUser(req);
  const result = await logic.addPet(user.id, req.body);
  if (!result.ok) {
    return sendError(res, result, '/pets', user);
  }
  res.redirect('/pets');
});

/*
  GET /create-request
  OUT: the create-request form, with a dropdown of THIS owner's pets.
*/
app.get('/create-request', ownerOnly, async (req, res) => {
  const user = await getCurrentUser(req);
  res.send(pages.createRequestPage(user, await logic.getPetsForOwner(user.id), logic.SERVICES));
});

/*
  POST /requests
  IN:   req.body: petId, service, startTime, endTime, budget, deadline, instructions, tags
  DOES: logic.createRequest checks the dates/budget/pet and saves it with status "open".
  OUT:  success -> /owner-requests. Problem -> 400 + error page.
*/
app.post('/requests', ownerOnly, async (req, res) => {
  const user = await getCurrentUser(req);
  const result = await logic.createRequest(user.id, req.body);
  if (!result.ok) {
    return sendError(res, result, '/create-request', user);
  }
  res.redirect('/owner-requests');
});

/*
  GET /owner-requests
  OUT: the owner's requests grouped by status, each with its bids and action buttons.
*/
app.get('/owner-requests', ownerOnly, async (req, res) => {
  const user = await getCurrentUser(req);
  const result = await logic.getOwnerRequests(user.id);
  res.send(pages.ownerRequestsPage(user, result.items));
});

/*
  POST /requests/:id/select-bid
  IN:   req.params.id = the request id (from the URL), req.body.winningBidId = the chosen bid
  DOES: logic.selectWinningBid: chosen bid accepted, others rejected, request closed.
  OUT:  success -> /owner-requests. Not found -> 404, not your request -> 403, not allowed now -> 400.
*/
app.post('/requests/:id/select-bid', ownerOnly, async (req, res) => {
  const user = await getCurrentUser(req);
  const result = await logic.selectWinningBid(user.id, toId(req.params.id), toId(req.body.winningBidId));
  if (!result.ok) {
    return sendError(res, result, '/owner-requests', user);
  }
  res.redirect('/owner-requests');
});

/*
  POST /requests/:id/complete
  IN:   req.params.id
  DOES: logic.completeRequest: closed request with a winner -> "completed" (reviews unlock).
  OUT:  success -> /owner-requests, otherwise 404 / 403 / 400.
*/
app.post('/requests/:id/complete', ownerOnly, async (req, res) => {
  const user = await getCurrentUser(req);
  const result = await logic.completeRequest(user.id, toId(req.params.id));
  if (!result.ok) {
    return sendError(res, result, '/owner-requests', user);
  }
  res.redirect('/owner-requests');
});

/* =====================================================================
   6. PROVIDER ROUTES (logged in + userType "carer")
   ===================================================================== */
/*
  GET /provider-dashboard
  OUT: the provider dashboard: counts + lists of current tasks, active bids, completed jobs.
*/
app.get('/provider-dashboard', carerOnly, async (req, res) => {
  const user = await getCurrentUser(req);
  res.send(pages.providerDashboardPage(user, await logic.getProviderDashboard(user.id)));
});
// Every route here has `carerOnly` in front: not logged in -> login page, owner -> 403.

/*
  GET /browse-requests
  IN:   req.query (all optional): search, petType, service, maxBudget
        e.g. /browse-requests?search=calm&service=walking&maxBudget=150
  DOES: logic.browseRequests returns the open, not-yet-expired requests that match.
  OUT:  the Browse page with one card per request.
*/
app.get('/browse-requests', carerOnly, async (req, res) => {
  const user = await getCurrentUser(req);
  const result = await logic.browseRequests(req.query);
  res.send(pages.browsePage(user, result.items, req.query, logic.SERVICES, logic.PET_TYPES));
});

/*
  POST /requests/:id/bids
  IN:   req.params.id = request id, req.body: bidPrice, bidDescription
  DOES: logic.placeBid: request must be open + before the deadline, valid price/description,
        no second bid from the same provider.
  OUT:  success -> /bids. Missing request -> 404. Closed/late/invalid -> 400.
*/
app.post('/requests/:id/bids', carerOnly, async (req, res) => {
  const user = await getCurrentUser(req);
  const requestId = toId(req.params.id);
  const result = await logic.placeBid(requestId, user.id, req.body.bidPrice, req.body.bidDescription);
  if (!result.ok) {
    return sendError(res, result, '/requests/' + req.params.id, user);
  }
  res.redirect('/bids');
});

/*
  GET /bids
  OUT: the "My Bids" page with all of this provider's bids.
*/
app.get('/bids', carerOnly, async (req, res) => {
  const user = await getCurrentUser(req);
  const result = await logic.getCarerBids(user.id);
  res.send(pages.bidsPage(user, result.items));
});

/*
  POST /bids/:id/edit
  IN:   req.params.id = bid id, req.body: bidPrice, bidDescription
  DOES: logic.editBid: only YOUR pending bid, only while the request is open and before the deadline.
  OUT:  success -> /bids. Not found 404, not yours 403, too late / invalid 400.
  (A plain HTML form can only send GET or POST, so we use POST instead of PUT.)
*/
app.post('/bids/:id/edit', carerOnly, async (req, res) => {
  const user = await getCurrentUser(req);
  const result = await logic.editBid(user.id, toId(req.params.id), req.body.bidPrice, req.body.bidDescription);
  if (!result.ok) {
    return sendError(res, result, '/bids', user);
  }
  res.redirect('/bids');
});

/*
  POST /bids/:id/withdraw
  IN:   req.params.id = bid id
  DOES: logic.withdrawBid: same rules as edit; the bid becomes "withdrawn".
  OUT:  success -> /bids, otherwise 404 / 403 / 400.
  (POST instead of DELETE for the same reason as above.)
*/
app.post('/bids/:id/withdraw', carerOnly, async (req, res) => {
  const user = await getCurrentUser(req);
  const result = await logic.withdrawBid(user.id, toId(req.params.id));
  if (!result.ok) {
    return sendError(res, result, '/bids', user);
  }
  res.redirect('/bids');
});

/* =====================================================================
   7. SHARED ROUTES (logged in, either role)
   ===================================================================== */
// These need `authentication` (logged in, either role). logic.js decides what each role may see.

/*
  GET /requests/:id
  IN:   req.params.id = request id
  DOES: logic.getRequestDetails: 404 if missing; owners can only open their own (403).
  OUT:  the details page. Providers get the bid form (if bidding is still allowed),
        owners get the list of bids.
*/
app.get('/requests/:id', authentication, async (req, res) => {
  const user = await getCurrentUser(req);
  const result = await logic.getRequestDetails(user, toId(req.params.id));
  if (!result.ok) {
    let backUrl = '/owner-requests';
    if (user.role === 'carer') {
      backUrl = '/browse-requests';
    }
    return sendError(res, result, backUrl, user);
  }
  res.send(pages.requestDetailsPage(user, result));
});
/*
  GET /reviews
  OUT: the Reviews page: reviews about me, reviews I wrote, and a form listing
       my completed services that I haven't reviewed yet.
*/
app.get('/reviews', authentication, async (req, res) => {
  const user = await getCurrentUser(req);
  res.send(pages.reviewsPage(user, await logic.getReviewsPage(user.id)));
});

/*
  POST /reviews
  IN:   req.body: requestId, rating, comment
  DOES: logic.addReview: request must be completed, you must be its owner or winning provider,
        rating 1-5, one review per person per request.
  OUT:  success -> /reviews. Not part of it -> 403. Invalid -> 400.
*/
app.post('/reviews', authentication, async (req, res) => {
  const user = await getCurrentUser(req);
  const result = await logic.addReview(user.id, req.body);
  if (!result.ok) {
    return sendError(res, result, '/reviews', user);
  }
  res.redirect('/reviews');
});

// Umar: J's old plan was  app.use(authentication, express.static(path.join(__dirname, 'private')));
// We don't need it any more: every private page is now built by a route above (with its own
// login/role check), so the static files in private/ are never sent to the browser.

/* =====================================================================
   8. 404 (must stay LAST)
   ===================================================================== */
/*
  If no route or static file above matched the URL, we end up here.
  It must be the LAST app.use, because Express checks routes from top to bottom.
  We show the same error page as everywhere else (with a link home).
*/
app.use(async (req, res) => {
  res.status(404).send(pages.errorPage(404, 'Page not found.', '/', await getCurrentUser(req)));
});
// J: This basically handles anything that gets to this point and

/*
  500 - DATABASE / SERVER ERRORS
  If something crashes inside an async route (e.g. MySQL is not running), Express 5 catches it
  and passes it here. A middleware with FOUR parameters (err, req, res, next) is Express's way of
  saying "this one handles errors". We log the real error for us in the terminal, and show the user
  a simple page instead of a stack trace (which could leak details about our code or database).
*/
app.use(function (err, req, res, next) {
  console.log(err);
  res.status(500).send(pages.errorPage(500, 'Something went wrong on our side. Please try again later.', '/', null));
});

app.listen(port, hostname, function () {
  console.log(`Server running at http://${hostname}:${port}/`);
});
