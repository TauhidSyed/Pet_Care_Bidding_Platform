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
// TODO(Umar): GET  /pets                      -> list my pets + the add-pet form
// TODO(Umar): POST /pets                      -> validate + add a pet for the logged-in owner
// TODO(Umar): GET  /create-request            -> form, with the pet dropdown built from MY pets
// TODO(Umar): POST /requests                  -> validate (dates, budget, deadline in future) + add request, status "open"
// TODO(Umar): GET  /owner-requests            -> my requests grouped by status, with their bids
// TODO(Umar): POST /requests/:id/select-bid   -> pick winning bid (only my request, only if open) -> status "closed"
// TODO(Umar): POST /requests/:id/close        -> close without a winner (only my request)
// TODO(Umar): POST /requests/:id/complete     -> mark a closed request "completed" (no button for this yet, see ROUTES.md)

/* =====================================================================
   6. PROVIDER ROUTES (logged in + userType "carer")
   ===================================================================== */
// TODO(Umar): GET  /provider-dashboard        -> counts of my current tasks / active bids / completed
// TODO(Umar): GET  /browse-requests           -> open requests as cards (keep data-pet-type, data-service, data-budget, data-search!)
// TODO(Umar): POST /requests/:id/bids         -> submit bid (request must be open AND before deadline)
// TODO(Umar): GET  /bids                      -> my bids
// TODO(Umar): POST /bids/:id/edit             -> edit my bid (only mine, only pending, only before deadline)
// TODO(Umar): POST /bids/:id/withdraw         -> withdraw my bid (same rules)

/* =====================================================================
   7. SHARED ROUTES (logged in, either role)
   ===================================================================== */
// TODO(Umar): GET  /requests/:id              -> request details page (bid form only shown to carers)
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
