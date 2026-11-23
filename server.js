// J: I did not expect having to do server-side in 3 days.
/*
  server.js  -  THE WEB SERVER (Express)
  ----------------------------------------------------------------------
  This file only does the "web" part. Each route:
    1. reads what the browser sent (req.body / req.params / req.query),
    2. calls a function from logic.js (where all the rules live),
    3. sends the answer: a redirect or an HTML page (built in pages.js) on success,
       or an error page with the right status code (400 / 401 / 403 / 404).
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
   2. DATA (temporary, in memory)
   ===================================================================== */
// server.js never touches the data arrays directly: it always goes through logic.js
// (which reads data.js). That way the DB teammate only has to change logic.js.
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
  If it isn't a number at all (e.g. /requests/abc), parseInt gives NaN, and no id equals NaN,
  so the lookup simply finds nothing -> 404.
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
  The logged-in user object, or null if nobody is logged in.
  We only keep the id + userType in the session, and look up the rest when needed.
*/
function getCurrentUser(req) {
  if (!req.session.userId) {
    return null;
  }
  return logic.findUserById(req.session.userId);
}

/*
  EXCEPTION (not in the lectures): our own middleware functions
  A middleware is a function (req, res, next) that runs BEFORE the route.
  It either stops the request (redirect / error) or calls next() to continue to the route.
  We put it in front of a route like:  app.get('/pets', ownerOnly, function (req, res) {...})
  Why: every private page needs the same "are you logged in? right role?" check;
  writing it once avoids forgetting it in one of 20 routes.
*/

// authentication: must be logged in (any role). Not logged in -> go to the login page.
function authentication(req, res, next) {
  if (getCurrentUser(req) === null) {
    return res.redirect('/login.html');
  }
  next();
}

// ownerOnly: must be logged in AND a pet owner. Logged in as a provider -> 403 Forbidden.
function ownerOnly(req, res, next) {
  const user = getCurrentUser(req);
  if (user === null) {
    return res.redirect('/login.html');
  }
  if (user.userType !== 'owner') {
    return res.status(403).send(pages.errorPage(403, 'Only pet owners can do this.', '/provider-dashboard', user));
  }
  next();
}

// carerOnly: must be logged in AND a care provider. Logged in as an owner -> 403 Forbidden.
function carerOnly(req, res, next) {
  const user = getCurrentUser(req);
  if (user === null) {
    return res.redirect('/login.html');
  }
  if (user.userType !== 'carer') {
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
app.post('/register', function (req, res) {
  const result = logic.registerUser(req.body);
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
        On success we save the user's id and userType in the session (= "logged in").
  OUT:  owner -> /owner-dashboard, carer -> /provider-dashboard.
        wrong details -> 401 (Unauthorized) + error page.
*/
app.post('/login', function (req, res) {
  const result = logic.loginUser(req.body.username, req.body.password);
  if (!result.ok) {
    return sendError(res, result, '/login.html', null);
  }
  req.session.userId = result.user.id;
  req.session.userType = result.user.userType;
  if (result.user.userType === 'owner') {
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
// TODO(Umar): GET  /owner-dashboard           -> counts of my pets / open / completed requests
// Every route here has `ownerOnly` in front: not logged in -> login page, provider -> 403.
// The owner's id always comes from the SESSION, never from the form, so nobody can act as someone else.

/*
  GET /pets
  OUT: the "My Pets" page: the logged-in owner's pets + the add-pet form.
*/
app.get('/pets', ownerOnly, function (req, res) {
  const user = getCurrentUser(req);
  res.send(pages.petsPage(user, logic.getPetsForOwner(user.id)));
});

/*
  POST /pets
  IN:   req.body: petName, petType, petBreed, petAge, petPhoto
  DOES: logic.addPet validates and saves the pet for THIS owner.
  OUT:  success -> back to /pets (the new pet shows up). Problem -> 400 + error page.
*/
app.post('/pets', ownerOnly, function (req, res) {
  const user = getCurrentUser(req);
  const result = logic.addPet(user.id, req.body);
  if (!result.ok) {
    return sendError(res, result, '/pets', user);
  }
  res.redirect('/pets');
});

/*
  GET /create-request
  OUT: the create-request form, with a dropdown of THIS owner's pets.
*/
app.get('/create-request', ownerOnly, function (req, res) {
  const user = getCurrentUser(req);
  res.send(pages.createRequestPage(user, logic.getPetsForOwner(user.id), logic.SERVICES));
});

/*
  POST /requests
  IN:   req.body: petId, service, startTime, endTime, budget, deadline, instructions, tags
  DOES: logic.createRequest checks the dates/budget/pet and saves it with status "open".
  OUT:  success -> /owner-requests. Problem -> 400 + error page.
*/
app.post('/requests', ownerOnly, function (req, res) {
  const user = getCurrentUser(req);
  const result = logic.createRequest(user.id, req.body);
  if (!result.ok) {
    return sendError(res, result, '/create-request', user);
  }
  res.redirect('/owner-requests');
});

/*
  GET /owner-requests
  OUT: the owner's requests grouped by status, each with its bids and action buttons.
*/
app.get('/owner-requests', ownerOnly, function (req, res) {
  const user = getCurrentUser(req);
  const result = logic.getOwnerRequests(user.id);
  res.send(pages.ownerRequestsPage(user, result.items));
});

/*
  POST /requests/:id/select-bid
  IN:   req.params.id = the request id (from the URL), req.body.winningBidId = the chosen bid
  DOES: logic.selectWinningBid: chosen bid accepted, others rejected, request closed.
  OUT:  success -> /owner-requests. Not found -> 404, not your request -> 403, not allowed now -> 400.
*/
app.post('/requests/:id/select-bid', ownerOnly, function (req, res) {
  const user = getCurrentUser(req);
  const result = logic.selectWinningBid(user.id, toId(req.params.id), toId(req.body.winningBidId));
  if (!result.ok) {
    return sendError(res, result, '/owner-requests', user);
  }
  res.redirect('/owner-requests');
});

/*
  POST /requests/:id/close
  IN:   req.params.id
  DOES: logic.closeRequest: closes an open request without a winner (no more bids).
  OUT:  success -> /owner-requests, otherwise 404 / 403 / 400.
*/
app.post('/requests/:id/close', ownerOnly, function (req, res) {
  const user = getCurrentUser(req);
  const result = logic.closeRequest(user.id, toId(req.params.id));
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
app.post('/requests/:id/complete', ownerOnly, function (req, res) {
  const user = getCurrentUser(req);
  const result = logic.completeRequest(user.id, toId(req.params.id));
  if (!result.ok) {
    return sendError(res, result, '/owner-requests', user);
  }
  res.redirect('/owner-requests');
});

/* =====================================================================
   6. PROVIDER ROUTES (logged in + userType "carer")
   ===================================================================== */
// TODO(Umar): GET  /provider-dashboard        -> counts of my current tasks / active bids / completed
// Every route here has `carerOnly` in front: not logged in -> login page, owner -> 403.

/*
  GET /browse-requests
  IN:   req.query (all optional): search, petType, service, maxBudget
        e.g. /browse-requests?search=calm&service=walking&maxBudget=150
  DOES: logic.browseRequests returns the open, not-yet-expired requests that match.
  OUT:  the Browse page with one card per request.
*/
app.get('/browse-requests', carerOnly, function (req, res) {
  const user = getCurrentUser(req);
  const result = logic.browseRequests(req.query);
  res.send(pages.browsePage(user, result.items, req.query, logic.SERVICES, logic.PET_TYPES));
});

/*
  POST /requests/:id/bids
  IN:   req.params.id = request id, req.body: bidPrice, bidDescription
  DOES: logic.placeBid: request must be open + before the deadline, valid price/description,
        no second bid from the same provider.
  OUT:  success -> /bids. Missing request -> 404. Closed/late/invalid -> 400.
*/
app.post('/requests/:id/bids', carerOnly, function (req, res) {
  const user = getCurrentUser(req);
  const requestId = toId(req.params.id);
  const result = logic.placeBid(requestId, user.id, req.body.bidPrice, req.body.bidDescription);
  if (!result.ok) {
    return sendError(res, result, '/requests/' + req.params.id, user);
  }
  res.redirect('/bids');
});

/*
  GET /bids
  OUT: the "My Bids" page with all of this provider's bids.
*/
app.get('/bids', carerOnly, function (req, res) {
  const user = getCurrentUser(req);
  const result = logic.getCarerBids(user.id);
  res.send(pages.bidsPage(user, result.items));
});

/*
  POST /bids/:id/edit
  IN:   req.params.id = bid id, req.body: bidPrice, bidDescription
  DOES: logic.editBid: only YOUR pending bid, only while the request is open and before the deadline.
  OUT:  success -> /bids. Not found 404, not yours 403, too late / invalid 400.
  (A plain HTML form can only send GET or POST, so we use POST instead of PUT.)
*/
app.post('/bids/:id/edit', carerOnly, function (req, res) {
  const user = getCurrentUser(req);
  const result = logic.editBid(user.id, toId(req.params.id), req.body.bidPrice, req.body.bidDescription);
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
app.post('/bids/:id/withdraw', carerOnly, function (req, res) {
  const user = getCurrentUser(req);
  const result = logic.withdrawBid(user.id, toId(req.params.id));
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
app.get('/requests/:id', authentication, function (req, res) {
  const user = getCurrentUser(req);
  const result = logic.getRequestDetails(user, toId(req.params.id));
  if (!result.ok) {
    let backUrl = '/owner-requests';
    if (user.userType === 'carer') {
      backUrl = '/browse-requests';
    }
    return sendError(res, result, backUrl, user);
  }
  res.send(pages.requestDetailsPage(user, result));
});
// TODO(Umar): GET  /reviews                   -> reviews about me + form listing my completed requests
// TODO(Umar): POST /reviews                   -> validate rating 1-5, request must be completed and involve me

//app.use(authentication, express.static(path.join(__dirname, 'private')));
// J: Authentications here for the rest of the files. Need to define a function called "authentication" for this to work.
// Umar: once the routes above build these pages dynamically, decide if this line is still needed.

/* =====================================================================
   8. 404 (must stay LAST)
   ===================================================================== */
app.use((req, res) => res.status(404).send('Not found'));
// J: This basically handles anything that gets to this point and

app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
