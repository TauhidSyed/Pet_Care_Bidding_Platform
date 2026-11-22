// J: I did not expect having to do server-side in 3 days.

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
const data = require('./data');
// DB: replace with prisma client (const { PrismaClient } = require('@prisma/client'); ...)
// Use it like: data.users, data.pets, data.requests, data.bids, data.reviews
// Every read/write of these arrays below must get a "// DB: replace with prisma call" comment.

/* =====================================================================
   3. AUTH (sessions + "are you logged in?" checks)
   ===================================================================== */
// TODO(Umar): set up express-session here (step: login/sessions)

// TODO(Umar): write function authentication(req, res, next)  -> must be logged in
// TODO(Umar): write function ownerOnly(req, res, next)       -> must be logged in as "owner"
// TODO(Umar): write function carerOnly(req, res, next)       -> must be logged in as "carer"

/* =====================================================================
   4. PUBLIC ROUTES (anyone, not logged in)
   ===================================================================== */
// TODO(Umar): POST /register   -> validate req.body, check username/email unused, add user, redirect to /login.html
// TODO(Umar): POST /login      -> find user, check password, save user in session, redirect to the right dashboard
// TODO(Umar): GET  /logout     -> destroy session, redirect to /logged-out.html

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
