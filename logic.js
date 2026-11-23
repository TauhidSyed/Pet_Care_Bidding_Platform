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


/* =====================================================================
   OWNER: PETS
   ===================================================================== */

/*
  getPetsForOwner(ownerId)
  OUT: an array of this owner's pets (can be empty).
*/
function getPetsForOwner(ownerId) {
  const result = [];
  for (let i = 0; i < data.pets.length; i++) { // DB: replace with prisma call (prisma.pet.findMany where ownerId)
    if (data.pets[i].ownerId === ownerId) {
      result.push(data.pets[i]);
    }
  }
  return result;
}

/*
  addPet(ownerId, body)
  Adds a pet for the logged-in owner.
  IN:  ownerId (from the session, NOT from the form, so nobody can add pets to someone else)
       body = pets form: petName, petType, petBreed, petAge, petPhoto
  RULES (same as script.js): name at least 2 characters, type is cat/dog/other,
       breed not empty, age is a whole number 0 or more, photo is a web link (http/https).
  OUT: { ok: true, pet } or { ok: false, status: 400, error }
*/
function addPet(ownerId, body) {
  const petName = cleanText(body.petName);
  const petType = cleanText(body.petType);
  const petBreed = cleanText(body.petBreed);
  const ageText = cleanText(body.petAge);
  const petAge = Number(ageText);
  const petPhoto = cleanText(body.petPhoto);

  const errors = [];
  if (petName.length < 2) {
    errors.push('Enter a pet name with at least 2 characters.');
  }
  if (!isOneOf(petType, PET_TYPES)) {
    errors.push('Choose a type of pet.');
  }
  if (petBreed === '') {
    errors.push("Enter the pet's breed.");
  }
  // Number.isInteger: true only for whole numbers (3 yes, 2.5 no, NaN no). script.js uses it too.
  if (ageText === '' || !Number.isInteger(petAge) || petAge < 0) {
    errors.push("Enter the pet's age as a whole number of 0 or more.");
  }
  // Only allow real web links. This also blocks tricks like "javascript:..." in an <img src>.
  if (!petPhoto.startsWith('http://') && !petPhoto.startsWith('https://')) {
    errors.push('Enter a valid photo URL (starting with http:// or https://).');
  }
  if (errors.length > 0) {
    return fail(400, errors);
  }

  const newPet = {
    id: nextId(data.pets), // DB: replace with prisma call (id comes from AUTO_INCREMENT)
    ownerId: ownerId,
    petName: petName,
    petType: petType,
    petBreed: petBreed,
    petAge: petAge,
    petPhoto: petPhoto
  };
  data.pets.push(newPet); // DB: replace with prisma call (prisma.pet.create)
  return { ok: true, pet: newPet };
}


/* =====================================================================
   OWNER: CARE REQUESTS
   ===================================================================== */

/*
  createRequest(ownerId, body)
  Posts a new care request.
  IN:  ownerId (from the session)
       body = create-request form: petId, service, startTime, endTime, budget, deadline,
              instructions (optional), tags (optional, space-separated keywords for search)
  RULES: the pet must be one of THIS owner's pets, service from the list, all dates real,
         start before end, budget above 0, deadline in the future AND before the start.
  OUT: { ok: true, request } (status "open") or { ok: false, status: 400, error }
*/
function createRequest(ownerId, body) {
  const petId = parseInt(body.petId);
  const service = cleanText(body.service);
  const startTime = cleanText(body.startTime);
  const endTime = cleanText(body.endTime);
  const budgetText = cleanText(body.budget);
  const budget = Number(budgetText);
  const deadline = cleanText(body.deadline);
  const instructions = cleanText(body.instructions);
  const tags = cleanText(body.tags).toLowerCase();

  const errors = [];
  // The pet must exist AND belong to this owner (stops posting requests for someone else's pet).
  const pet = findPetById(petId);
  if (pet === null || pet.ownerId !== ownerId) {
    errors.push('Choose one of your pets.');
  }
  if (!isOneOf(service, SERVICES)) {
    errors.push('Choose a service.');
  }
  if (!isValidDate(startTime)) {
    errors.push('Enter when the service starts.');
  }
  if (!isValidDate(endTime)) {
    errors.push('Enter when the service ends.');
  }
  // Dates can only be compared if both are real dates.
  if (isValidDate(startTime) && isValidDate(endTime) && new Date(startTime) >= new Date(endTime)) {
    errors.push('The end time must be after the start time.');
  }
  // Number.isFinite: false for NaN (letters) and Infinity.
  if (budgetText === '' || !Number.isFinite(budget) || budget <= 0) {
    errors.push('Enter a budget greater than zero.');
  }
  if (!isValidDate(deadline)) {
    errors.push('Choose a bidding deadline.');
  } else {
    if (new Date(deadline) <= new Date()) {
      errors.push('The bidding deadline must be in the future.');
    }
    if (isValidDate(startTime) && new Date(deadline) >= new Date(startTime)) {
      errors.push('The bidding deadline must be before the service starts.');
    }
  }
  if (errors.length > 0) {
    return fail(400, errors);
  }

  const newRequest = {
    id: nextId(data.requests), // DB: replace with prisma call (id comes from AUTO_INCREMENT)
    ownerId: ownerId,
    petId: petId,
    service: service,
    startTime: startTime,
    endTime: endTime,
    budget: budget,
    deadline: deadline,
    instructions: instructions,
    tags: tags,
    status: 'open',       // every new request starts open (taking bids)
    winningBidId: null    // no winner yet
  };
  data.requests.push(newRequest); // DB: replace with prisma call (prisma.careRequest.create)
  return { ok: true, request: newRequest };
}

/*
  getRequestsForOwner(ownerId)
  OUT: array of this owner's requests (all statuses).
*/
function getRequestsForOwner(ownerId) {
  const result = [];
  for (let i = 0; i < data.requests.length; i++) { // DB: replace with prisma call (prisma.careRequest.findMany where ownerId)
    if (data.requests[i].ownerId === ownerId) {
      result.push(data.requests[i]);
    }
  }
  return result;
}

/*
  getOwnerRequests(ownerId)
  Everything the "My Requests" page needs.
  OUT: { ok: true, items } where each item is { request, pet, bids }
       and bids is an array of { bid, carer } (carer = the provider's user object).
*/
function getOwnerRequests(ownerId) {
  const requests = getRequestsForOwner(ownerId);
  const items = [];
  for (let i = 0; i < requests.length; i++) {
    const requestBids = getBidsForRequest(requests[i].id);
    const bidsWithCarer = [];
    for (let j = 0; j < requestBids.length; j++) {
      bidsWithCarer.push({ bid: requestBids[j], carer: findUserById(requestBids[j].carerId) });
    }
    items.push({ request: requests[i], pet: findPetById(requests[i].petId), bids: bidsWithCarer });
  }
  return { ok: true, items: items };
}

/*
  checkOwnRequest(ownerId, requestId)
  Shared first check for every owner action on ONE request.
  OUT: { ok: true, request } or 404 (doesn't exist) / 403 (exists but isn't yours).
*/
function checkOwnRequest(ownerId, requestId) {
  const request = findRequestById(requestId);
  if (request === null) {
    return fail(404, ['That request does not exist.']);
  }
  if (request.ownerId !== ownerId) {
    return fail(403, ['This is not your request.']);
  }
  return { ok: true, request: request };
}

/*
  selectWinningBid(ownerId, requestId, bidId)
  The owner picks the winning bid.
  IN:  ownerId (session), requestId (URL), bidId (form: winningBidId)
  RULES: must be your request, request must still be "open", and the bid must be a
         "pending" bid ON THIS request (not a withdrawn one, not from another request).
  DOES: chosen bid -> "accepted", every other pending bid -> "rejected",
        request -> "closed", request.winningBidId = the chosen bid's id.
        (Withdrawn bids stay "withdrawn".)
  OUT: { ok: true, request } or { ok: false, status, error }
*/
function selectWinningBid(ownerId, requestId, bidId) {
  const check = checkOwnRequest(ownerId, requestId);
  if (!check.ok) {
    return check;
  }
  const request = check.request;
  if (request.status !== 'open') {
    return fail(400, ['This request is no longer open, so a winner cannot be chosen.']);
  }
  const bid = findBidById(bidId);
  if (bid === null || bid.requestId !== request.id || bid.status !== 'pending') {
    return fail(400, ['Choose one of the pending bids on this request.']);
  }

  // Update every bid on this request in one pass.
  const requestBids = getBidsForRequest(request.id);
  for (let i = 0; i < requestBids.length; i++) {
    if (requestBids[i].id === bid.id) {
      requestBids[i].status = 'accepted'; // DB: replace with prisma call (prisma.bid.update status accepted)
    } else if (requestBids[i].status === 'pending') {
      requestBids[i].status = 'rejected'; // DB: replace with prisma call (prisma.bid.updateMany status rejected)
    }
  }
  request.status = 'closed';      // DB: replace with prisma call (prisma.careRequest.update status closed)
  request.winningBidId = bid.id;  // DB: replace with prisma call (same update: winningBidId)
  return { ok: true, request: request };
}

/*
  closeRequest(ownerId, requestId)
  The owner closes a request WITHOUT picking a winner (e.g. no good bids).
  RULES: your request, and it must still be "open".
  DOES: request -> "closed", all pending bids -> "rejected". After this no one can bid.
*/
function closeRequest(ownerId, requestId) {
  const check = checkOwnRequest(ownerId, requestId);
  if (!check.ok) {
    return check;
  }
  const request = check.request;
  if (request.status !== 'open') {
    return fail(400, ['Only open requests can be closed.']);
  }
  const requestBids = getBidsForRequest(request.id);
  for (let i = 0; i < requestBids.length; i++) {
    if (requestBids[i].status === 'pending') {
      requestBids[i].status = 'rejected'; // DB: replace with prisma call (prisma.bid.updateMany status rejected)
    }
  }
  request.status = 'closed'; // DB: replace with prisma call (prisma.careRequest.update status closed)
  return { ok: true, request: request };
}

/*
  completeRequest(ownerId, requestId)
  The owner marks the service as done.
  RULES: your request, status must be "closed" AND there must be a winning bid
         (you can't "complete" a request nobody was hired for).
  DOES: request -> "completed". Now both sides can leave reviews.
*/
function completeRequest(ownerId, requestId) {
  const check = checkOwnRequest(ownerId, requestId);
  if (!check.ok) {
    return check;
  }
  const request = check.request;
  if (request.status !== 'closed' || request.winningBidId === null) {
    return fail(400, ['Only closed requests with a chosen provider can be marked completed.']);
  }
  request.status = 'completed'; // DB: replace with prisma call (prisma.careRequest.update status completed)
  return { ok: true, request: request };
}


/* ---- (more sections are added below: provider, reviews, dashboards) ---- */


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
  loginUser: loginUser,
  getPetsForOwner: getPetsForOwner,
  addPet: addPet,
  createRequest: createRequest,
  getOwnerRequests: getOwnerRequests,
  selectWinningBid: selectWinningBid,
  closeRequest: closeRequest,
  completeRequest: completeRequest
};
