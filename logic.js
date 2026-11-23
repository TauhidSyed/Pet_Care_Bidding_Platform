/*
  logic.js  -  THE APP'S RULES
  ----------------------------------------------------------------------
  This file holds every rule of the app as a plain function:
  "can this provider bid?", "is this request form valid?", "who wins?" ...

  - There is NO Express in here (no req, no res). Every function just takes
    normal values in and gives back an object:
        success:  { ok: true,  ...the data... }
        failure:  { ok: false, status: 400, error: 'message for the user' }
    `status` is the HTTP code server.js should send:
        400 = the user typed something wrong / it's not allowed right now
        401 = wrong username or password
        403 = you're logged in, but this isn't yours / wrong role
        404 = that thing doesn't exist
  - Why split it out? server.js stays short (read the request, call a function,
    send the answer), and test.js can test every rule without starting a server.

  DATABASE: there is no database yet. We read and write the arrays in data.js.
  Every line that touches those arrays has a "// DB: replace with prisma call" comment
  so our DB teammate can find and swap them.
*/

const data = require('./data');  // helps us to access data.js's contents

/*
  EXCEPTION (not in the lectures): bcrypt
  bcrypt turns a password into a "hash": a long scrambled string you can't turn back
  into the password. We only ever save the hash. At login, bcrypt hashes what the user
  typed and checks if it matches the saved hash.
  Why we need it: if someone ever reads our users table, they still don't learn anyone's
  password. Saving plain passwords is a serious security mistake.
  We use the "Sync" versions (hashSync / compareSync) so we don't need async/await.
*/
const bcrypt = require('bcrypt');


/* =====================================================================
   ALLOWED VALUES
   The server must not trust the browser: someone can send ANY value,
   not just the options in our <select>. So we keep the allowed lists here.
   (These match the ENUMs in pet_care_schema.sql.)
   ===================================================================== */
const USER_TYPES = ['owner', 'carer'];
const SERVICES = ['walking', 'bathing', 'grooming', 'feeding', 'sitting'];
const PET_TYPES = ['cat', 'dog', 'other'];


/* =====================================================================
   SMALL HELPERS
   ===================================================================== */

/*
  fail(status, messages)
  Builds the "something went wrong" object every function returns.
  - status: the HTTP code (400, 401, 403 or 404)
  - messages: an array of error strings, e.g. ['Choose a pet.', 'Enter a budget.']
  We glue the messages into one string (one sentence after another).
*/
function fail(status, messages) {
  let error = '';
  for (let i = 0; i < messages.length; i++) {
    if (i > 0) {
      error = error + ' ';
    }
    error = error + messages[i];
  }
  return { ok: false, status: status, error: error };
}

/*
  isOneOf(value, list)
  true if `value` is exactly one of the items in `list`.
  Used to check <select> values, e.g. isOneOf('cat', PET_TYPES) -> true.
*/
function isOneOf(value, list) {
  for (let i = 0; i < list.length; i++) {
    if (list[i] === value) {
      return true;
    }
  }
  return false;
}

/*
  cleanText(value)
  Form fields arrive as strings, but a missing field is `undefined`.
  This always gives back a string with the spaces at the start/end removed
  (.trim() is the same thing script.js uses).
*/
function cleanText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

/*
  rawText(value)
  Same as cleanText but WITHOUT trimming. Used for passwords, because a space
  at the start or end can be a real part of someone's password.
*/
function rawText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

/*
  isValidEmail(email)
  A simple email check (the browser has `type="email"`, but the server can't rely on it):
  - no spaces
  - exactly one "@", with something before it
  - a "." somewhere after the "@", with something between them and after the dot
  e.g. "a@b.com" -> true, "a@b" -> false, "@b.com" -> false
*/
function isValidEmail(email) {
  let atCount = 0;
  let atPosition = -1;
  for (let i = 0; i < email.length; i++) {
    if (email[i] === ' ') {
      return false;
    }
    if (email[i] === '@') {
      atCount++;
      atPosition = i;
    }
  }
  if (atCount !== 1 || atPosition === 0) {
    return false;
  }
  // Find the last "." after the "@"
  let dotPosition = -1;
  for (let i = atPosition + 1; i < email.length; i++) {
    if (email[i] === '.') {
      dotPosition = i;
    }
  }
  // The dot can't be right after the "@" and can't be the last character
  return dotPosition > atPosition + 1 && dotPosition < email.length - 1;
}

/*
  isValidDate(text)
  true if `text` (e.g. "2026-12-05T09:00" from a datetime-local input) is a real date.
  new Date('nonsense') gives an "Invalid Date" whose getTime() is NaN (Not a Number).
*/
function isValidDate(text) {
  return text !== '' && !isNaN(new Date(text).getTime());
}

/*
  isBeforeDeadline(request)
  true if right now is still before the request's bidding deadline.
  Used by placeBid / editBid / withdrawBid / browse so nobody can bid late.
*/
function isBeforeDeadline(request) {
  return new Date() < new Date(request.deadline);
}

/*
  nextId(list)
  Gives a new unique id: (biggest id in the list) + 1.
  A real database does this for us automatically (AUTO_INCREMENT).
*/
function nextId(list) {
  let biggest = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i].id > biggest) {
      biggest = list[i].id;
    }
  }
  return biggest + 1;
}


/* =====================================================================
   LOOKUPS ("find one thing by its id")
   All reads of the arrays go through these small functions, so the DB
   teammate only has to swap a few places.
   They return the object, or null if nothing matches.
   ===================================================================== */

function findUserById(id) {
  for (let i = 0; i < data.users.length; i++) { // DB: replace with prisma call (prisma.user.findUnique by id)
    if (data.users[i].id === id) {
      return data.users[i];
    }
  }
  return null;
}

// Usernames are compared in lowercase, so "Umar" and "umar" count as the same name.
function findUserByUsername(username) {
  const wanted = username.toLowerCase();
  for (let i = 0; i < data.users.length; i++) { // DB: replace with prisma call (prisma.user.findUnique by username)
    if (data.users[i].username.toLowerCase() === wanted) {
      return data.users[i];
    }
  }
  return null;
}

function findUserByEmail(email) {
  const wanted = email.toLowerCase();
  for (let i = 0; i < data.users.length; i++) { // DB: replace with prisma call (prisma.user.findUnique by email)
    if (data.users[i].email.toLowerCase() === wanted) {
      return data.users[i];
    }
  }
  return null;
}

function findPetById(id) {
  for (let i = 0; i < data.pets.length; i++) { // DB: replace with prisma call (prisma.pet.findUnique by id)
    if (data.pets[i].id === id) {
      return data.pets[i];
    }
  }
  return null;
}

function findRequestById(id) {
  for (let i = 0; i < data.requests.length; i++) { // DB: replace with prisma call (prisma.careRequest.findUnique by id)
    if (data.requests[i].id === id) {
      return data.requests[i];
    }
  }
  return null;
}

function findBidById(id) {
  for (let i = 0; i < data.bids.length; i++) { // DB: replace with prisma call (prisma.bid.findUnique by id)
    if (data.bids[i].id === id) {
      return data.bids[i];
    }
  }
  return null;
}

// The bid this provider made on this request (or null). One bid per provider per request.
function findBidByRequestAndCarer(requestId, carerId) {
  for (let i = 0; i < data.bids.length; i++) { // DB: replace with prisma call (prisma.bid.findUnique by requestId + carerId)
    if (data.bids[i].requestId === requestId && data.bids[i].carerId === carerId) {
      return data.bids[i];
    }
  }
  return null;
}

// All bids on one request (any status).
function getBidsForRequest(requestId) {
  const result = [];
  for (let i = 0; i < data.bids.length; i++) { // DB: replace with prisma call (prisma.bid.findMany where requestId)
    if (data.bids[i].requestId === requestId) {
      result.push(data.bids[i]);
    }
  }
  return result;
}


/* =====================================================================
   REGISTER + LOGIN
   ===================================================================== */

/*
  registerUser(body)
  Creates a new account.
  IN:  body = the register form (req.body): userType, username, email, password,
       confirmPassword, providerService, providerExperience
  RULES (same as script.js, checked again because the browser can be bypassed):
       - userType must be "owner" or "carer"
       - carers must pick a service
       - username at least 3 characters (max 50, the DB column size)
       - valid email
       - password at least 8 characters, and both passwords match
       - username and email not already used
  OUT: { ok: true, user } or { ok: false, status: 400, error }
*/
function registerUser(body) {
  const userType = cleanText(body.userType);
  const username = cleanText(body.username);
  const email = cleanText(body.email).toLowerCase();
  // Passwords are NOT trimmed: a space can be part of a password.
  const password = rawText(body.password);
  const confirmPassword = rawText(body.confirmPassword);
  let providerService = cleanText(body.providerService);
  let providerExperience = cleanText(body.providerExperience);

  // Collect ALL problems first, so the user can fix everything at once (same idea as script.js).
  const errors = [];
  if (!isOneOf(userType, USER_TYPES)) {
    errors.push('Choose Pet Owner or Care Provider.');
  }
  if (userType === 'carer' && !isOneOf(providerService, SERVICES)) {
    errors.push('Choose the service you provide.');
  }
  if (username.length < 3) {
    errors.push('Username must be at least 3 characters.');
  }
  if (username.length > 50) {
    errors.push('Username must be at most 50 characters.');
  }
  if (!isValidEmail(email)) {
    errors.push('Enter a valid email address.');
  }
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters.');
  }
  if (password !== confirmPassword) {
    errors.push('Passwords do not match.');
  }
  if (errors.length > 0) {
    return fail(400, errors);
  }

  // Only carers have provider fields. Clear them for owners so no junk gets saved.
  if (userType === 'owner') {
    providerService = '';
    providerExperience = '';
  }

  // Usernames and emails must be unique (the DB also enforces this with UNIQUE keys).
  if (findUserByUsername(username) !== null) {
    return fail(400, ['That username is already taken.']);
  }
  if (findUserByEmail(email) !== null) {
    return fail(400, ['That email is already registered.']);
  }

  // Save the HASH of the password, never the password itself. 10 = how much work bcrypt does (standard value).
  const newUser = {
    id: nextId(data.users), // DB: replace with prisma call (id comes from AUTO_INCREMENT)
    userType: userType,
    username: username,
    email: email,
    password: bcrypt.hashSync(password, 10),
    providerService: providerService,
    providerExperience: providerExperience
  };
  data.users.push(newUser); // DB: replace with prisma call (prisma.user.create)
  return { ok: true, user: newUser };
}

/*
  loginUser(username, password)
  Checks a login attempt.
  IN:  username and password from the login form
  RULES: user must exist AND bcrypt must say the password matches the saved hash.
  OUT: { ok: true, user } or { ok: false, status: 401, error }
  We give the SAME message for "no such user" and "wrong password", so an attacker
  can't use the login form to find out which usernames exist.
*/
function loginUser(username, password) {
  const user = findUserByUsername(cleanText(username));
  if (user === null || !bcrypt.compareSync(rawText(password), user.password)) {
    return fail(401, ['Wrong username or password.']);
  }
  return { ok: true, user: user };
}


/* ---- (more sections are added below: owner, provider, reviews, dashboards) ---- */


/*
  module.exports - EXCEPTION (not in the lectures' examples, but it's how require() works)
  Whatever we put in this object is what another file gets when it does require('./logic').
  server.js and test.js use these functions; the helpers not listed stay private to this file.
*/
module.exports = {
  SERVICES: SERVICES,
  PET_TYPES: PET_TYPES,
  findUserById: findUserById,
  findPetById: findPetById,
  findRequestById: findRequestById,
  findBidById: findBidById,
  registerUser: registerUser,
  loginUser: loginUser
};
