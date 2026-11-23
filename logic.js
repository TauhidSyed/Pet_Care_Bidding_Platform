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
  new Date('nonsense') gives an "Invalid Date", which counts as NaN (Not a Number),
  so isNaN(...) is true for bad dates and false for real ones.
*/
function isValidDate(text) {
  return text !== '' && !isNaN(new Date(text));
}

/*
  beginsWith(text, start)
  true if `text` starts with `start`, checked one character at a time with a for loop.
  e.g. beginsWith('https://a.com', 'https://') -> true
*/
function beginsWith(text, start) {
  if (text.length < start.length) {
    return false;
  }
  for (let i = 0; i < start.length; i++) {
    if (text[i] !== start[i]) {
      return false;
    }
  }
  return true;
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
  if (!beginsWith(petPhoto, 'http://') && !beginsWith(petPhoto, 'https://')) {
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


/* =====================================================================
   PROVIDER: BROWSING + REQUEST DETAILS
   ===================================================================== */

/*
  browseRequests(query)
  The list on the Browse page, filtered on the SERVER (the page also filters live
  in the browser with script.js; doing it here too means it works without JavaScript).
  IN:  query = req.query: search, petType, service, maxBudget (all optional, "" = no filter)
  RULES: only requests that are "open" AND still before their deadline are shown.
         search matches pet name/type/breed, service, instructions AND the tags field
         (our tag-search extra feature), ignoring upper/lower case.
  OUT: { ok: true, items } where each item is { request, pet }
*/
function browseRequests(query) {
  const search = cleanText(query.search).toLowerCase();
  const petType = cleanText(query.petType);
  const service = cleanText(query.service);
  const maxBudgetText = cleanText(query.maxBudget);
  const maxBudget = Number(maxBudgetText);

  const items = [];
  for (let i = 0; i < data.requests.length; i++) { // DB: replace with prisma call (prisma.careRequest.findMany where status open, deadline > now)
    const request = data.requests[i];
    // `continue` = skip this request and go to the next one in the loop.
    if (request.status !== 'open' || !isBeforeDeadline(request)) {
      continue;
    }
    const pet = findPetById(request.petId);
    if (petType !== '' && pet.petType !== petType) {
      continue;
    }
    if (service !== '' && request.service !== service) {
      continue;
    }
    // Only filter by budget if a real number was typed in.
    if (maxBudgetText !== '' && Number.isFinite(maxBudget) && request.budget > maxBudget) {
      continue;
    }
    if (search !== '') {
      // One lowercase string with everything searchable, then check if the search text is inside it.
      const searchable = (pet.petName + ' ' + pet.petType + ' ' + pet.petBreed + ' ' + request.service + ' ' +
        request.instructions + ' ' + request.tags).toLowerCase();
      if (!searchable.includes(search)) {
        continue;
      }
    }
    items.push({ request: request, pet: pet });
  }
  return { ok: true, items: items };
}

/*
  getRequestDetails(user, requestId)
  Everything the request details page needs.
  IN:  user = the logged-in user object, requestId from the URL
  RULES: 404 if it doesn't exist. Owners may only open THEIR OWN requests (403 otherwise).
         Providers may open any request.
  OUT: { ok: true, request, pet, bids, myBid, canBid }
       - bids: all bids with their provider ({ bid, carer }), only filled in for the owner
       - myBid: this provider's own bid on it (or null)
       - canBid: true if this provider may submit a bid right now
*/
function getRequestDetails(user, requestId) {
  const request = findRequestById(requestId);
  if (request === null) {
    return fail(404, ['That request does not exist.']);
  }
  if (user.userType === 'owner' && request.ownerId !== user.id) {
    return fail(403, ['This is not your request.']);
  }

  const bids = [];
  let myBid = null;
  let canBid = false;
  if (user.userType === 'owner') {
    const requestBids = getBidsForRequest(request.id);
    for (let i = 0; i < requestBids.length; i++) {
      bids.push({ bid: requestBids[i], carer: findUserById(requestBids[i].carerId) });
    }
  } else {
    myBid = findBidByRequestAndCarer(request.id, user.id);
    // A provider can bid if the request is open, the deadline hasn't passed,
    // and they have no bid yet (or only a withdrawn one).
    canBid = request.status === 'open' && isBeforeDeadline(request) &&
      (myBid === null || myBid.status === 'withdrawn');
  }
  return { ok: true, request: request, pet: findPetById(request.petId), bids: bids, myBid: myBid, canBid: canBid };
}


/* =====================================================================
   PROVIDER: BIDS
   ===================================================================== */

/*
  checkBidDetails(bidPrice, bidDescription)
  Shared validation for placing and editing a bid (same rules as script.js).
  OUT: an array of error messages (empty = all good).
*/
function checkBidDetails(bidPrice, bidDescription) {
  const errors = [];
  const priceText = cleanText(bidPrice);
  const price = Number(priceText);
  if (priceText === '' || !Number.isFinite(price) || price <= 0) {
    errors.push('Enter a bid price greater than zero.');
  }
  if (cleanText(bidDescription).length < 10) {
    errors.push('Describe your service in at least 10 characters.');
  }
  return errors;
}

/*
  placeBid(requestId, carerId, bidPrice, bidDescription)
  A provider submits a bid on a request.
  IN:  requestId (URL), carerId (session), bidPrice + bidDescription (form)
  RULES: request exists (404), status is "open", deadline not passed,
         price > 0, description at least 10 characters,
         and NO existing bid from this provider unless it was withdrawn.
  DOES: new bid with status "pending". If they had WITHDRAWN a bid on this request before,
        we reuse that same bid instead of making a second one: the database (pet_care_schema.sql)
        only allows ONE bid per provider per request (UNIQUE request_id + provider_id).
  OUT: { ok: true, bid } or { ok: false, status, error }
*/
function placeBid(requestId, carerId, bidPrice, bidDescription) {
  const request = findRequestById(requestId);
  if (request === null) {
    return fail(404, ['That request does not exist.']);
  }
  // These two checks are what "block bids after a request is closed" means.
  if (request.status !== 'open') {
    return fail(400, ['This request is closed. Bids are no longer accepted.']);
  }
  if (!isBeforeDeadline(request)) {
    return fail(400, ['The bidding deadline has passed. Bids are no longer accepted.']);
  }
  const errors = checkBidDetails(bidPrice, bidDescription);
  if (errors.length > 0) {
    return fail(400, errors);
  }

  const existing = findBidByRequestAndCarer(request.id, carerId);
  if (existing !== null && existing.status !== 'withdrawn') {
    return fail(400, ['You already bid on this request. Edit your bid on the My Bids page instead.']);
  }
  if (existing !== null) {
    // Re-bidding after a withdraw: bring the old bid back with the new details.
    existing.bidPrice = Number(cleanText(bidPrice));       // DB: replace with prisma call (prisma.bid.update)
    existing.bidDescription = cleanText(bidDescription);   // DB: replace with prisma call (same update)
    existing.status = 'pending';                           // DB: replace with prisma call (same update)
    return { ok: true, bid: existing };
  }

  const newBid = {
    id: nextId(data.bids), // DB: replace with prisma call (id comes from AUTO_INCREMENT)
    requestId: request.id,
    carerId: carerId,
    bidPrice: Number(cleanText(bidPrice)),
    bidDescription: cleanText(bidDescription),
    status: 'pending'
  };
  data.bids.push(newBid); // DB: replace with prisma call (prisma.bid.create)
  return { ok: true, bid: newBid };
}

/*
  checkBidCanChange(carerId, bidId)
  Shared checks before editing OR withdrawing a bid.
  RULES: bid exists (404), it's YOUR bid (403), it's still "pending",
         and its request is still open and before the deadline.
  OUT: { ok: true, bid, request } or { ok: false, status, error }
*/
function checkBidCanChange(carerId, bidId) {
  const bid = findBidById(bidId);
  if (bid === null) {
    return fail(404, ['That bid does not exist.']);
  }
  if (bid.carerId !== carerId) {
    return fail(403, ['This is not your bid.']);
  }
  if (bid.status !== 'pending') {
    return fail(400, ['Only pending bids can be changed.']);
  }
  const request = findRequestById(bid.requestId);
  if (request.status !== 'open' || !isBeforeDeadline(request)) {
    return fail(400, ['Bidding on this request is over, so the bid can no longer be changed.']);
  }
  return { ok: true, bid: bid, request: request };
}

/*
  editBid(carerId, bidId, bidPrice, bidDescription)
  A provider changes the price/description of their own pending bid.
  RULES: checkBidCanChange + the same price/description rules as placeBid.
  OUT: { ok: true, bid } or { ok: false, status, error }
*/
function editBid(carerId, bidId, bidPrice, bidDescription) {
  const check = checkBidCanChange(carerId, bidId);
  if (!check.ok) {
    return check;
  }
  const errors = checkBidDetails(bidPrice, bidDescription);
  if (errors.length > 0) {
    return fail(400, errors);
  }
  check.bid.bidPrice = Number(cleanText(bidPrice));        // DB: replace with prisma call (prisma.bid.update)
  check.bid.bidDescription = cleanText(bidDescription);    // DB: replace with prisma call (same update)
  return { ok: true, bid: check.bid };
}

/*
  withdrawBid(carerId, bidId)
  A provider takes back their own pending bid.
  RULES: same as checkBidCanChange.
  DOES: bid status -> "withdrawn" (we keep it rather than delete it, so there's a history,
        and so placeBid can reuse it if they bid again).
*/
function withdrawBid(carerId, bidId) {
  const check = checkBidCanChange(carerId, bidId);
  if (!check.ok) {
    return check;
  }
  check.bid.status = 'withdrawn'; // DB: replace with prisma call (prisma.bid.update status withdrawn)
  return { ok: true, bid: check.bid };
}

/*
  getCarerBids(carerId)
  Everything the "My Bids" page needs.
  OUT: { ok: true, items } where each item is { bid, request, pet, canChange }
       canChange = true if the edit/withdraw buttons should be shown.
*/
function getCarerBids(carerId) {
  const items = [];
  for (let i = 0; i < data.bids.length; i++) { // DB: replace with prisma call (prisma.bid.findMany where carerId)
    const bid = data.bids[i];
    if (bid.carerId !== carerId) {
      continue;
    }
    const request = findRequestById(bid.requestId);
    const canChange = bid.status === 'pending' && request.status === 'open' && isBeforeDeadline(request);
    items.push({ bid: bid, request: request, pet: findPetById(request.petId), canChange: canChange });
  }
  return { ok: true, items: items };
}


/* =====================================================================
   REVIEWS
   ===================================================================== */

/*
  getReviewPartner(request, userId)
  On a completed request, the two people involved are the owner and the winning provider.
  OUT: the id of the OTHER person (the one userId would review), or null if userId
       wasn't part of this request.
*/
function getReviewPartner(request, userId) {
  const winningBid = findBidById(request.winningBidId);
  if (winningBid === null) {
    return null;
  }
  if (userId === request.ownerId) {
    return winningBid.carerId;
  }
  if (userId === winningBid.carerId) {
    return request.ownerId;
  }
  return null;
}

/*
  hasReviewed(requestId, reviewerId)
  true if this person already left a review for this request (only one allowed each).
*/
function hasReviewed(requestId, reviewerId) {
  for (let i = 0; i < data.reviews.length; i++) { // DB: replace with prisma call (prisma.review.findUnique by requestId + reviewerId)
    if (data.reviews[i].requestId === requestId && data.reviews[i].reviewerId === reviewerId) {
      return true;
    }
  }
  return false;
}

/*
  addReview(reviewerId, body)
  Leave a review after a completed service.
  IN:  reviewerId (session), body = review form: requestId, rating, comment
  RULES: request exists and is "completed", you are its owner or its winning provider (403 otherwise),
         rating is a whole number 1 to 5, comment at most 1000 characters (optional),
         and you haven't reviewed this request yet.
  DOES: saves the review about the OTHER person (owner reviews provider, provider reviews owner).
  OUT: { ok: true, review } or { ok: false, status, error }
*/
function addReview(reviewerId, body) {
  const requestId = parseInt(body.requestId);
  const ratingText = cleanText(body.rating);
  const rating = Number(ratingText);
  const comment = cleanText(body.comment);

  const errors = [];
  const request = findRequestById(requestId);
  if (request === null || request.status !== 'completed') {
    errors.push('Choose one of your completed services.');
  }
  if (ratingText === '' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.push('Choose a rating from 1 to 5.');
  }
  if (comment.length > 1000) {
    errors.push('Keep the comment under 1000 characters.');
  }
  if (errors.length > 0) {
    return fail(400, errors);
  }

  const revieweeId = getReviewPartner(request, reviewerId);
  if (revieweeId === null) {
    return fail(403, ['You can only review services you were part of.']);
  }
  if (hasReviewed(request.id, reviewerId)) {
    return fail(400, ['You already reviewed this service.']);
  }

  const newReview = {
    id: nextId(data.reviews), // DB: replace with prisma call (id comes from AUTO_INCREMENT)
    requestId: request.id,
    reviewerId: reviewerId,
    revieweeId: revieweeId,
    rating: rating,
    comment: comment
  };
  data.reviews.push(newReview); // DB: replace with prisma call (prisma.review.create)
  return { ok: true, review: newReview };
}

/*
  getReviewsPage(userId)
  Everything the Reviews page needs.
  OUT: { ok: true, about, written, reviewable }
       - about:      reviews other people wrote about me   [{ review, reviewer, request, pet }]
       - written:    reviews I wrote                        [{ review, reviewee, request, pet }]
       - reviewable: my completed requests I haven't reviewed yet  [{ request, pet, partner }]
*/
function getReviewsPage(userId) {
  const about = [];
  const written = [];
  for (let i = 0; i < data.reviews.length; i++) { // DB: replace with prisma call (prisma.review.findMany where reviewerId or revieweeId)
    const review = data.reviews[i];
    const request = findRequestById(review.requestId);
    const pet = findPetById(request.petId);
    if (review.revieweeId === userId) {
      about.push({ review: review, reviewer: findUserById(review.reviewerId), request: request, pet: pet });
    }
    if (review.reviewerId === userId) {
      written.push({ review: review, reviewee: findUserById(review.revieweeId), request: request, pet: pet });
    }
  }

  const reviewable = [];
  for (let i = 0; i < data.requests.length; i++) { // DB: replace with prisma call (prisma.careRequest.findMany where status completed)
    const request = data.requests[i];
    if (request.status !== 'completed') {
      continue;
    }
    const partnerId = getReviewPartner(request, userId);
    if (partnerId !== null && !hasReviewed(request.id, userId)) {
      reviewable.push({ request: request, pet: findPetById(request.petId), partner: findUserById(partnerId) });
    }
  }
  return { ok: true, about: about, written: written, reviewable: reviewable };
}


/* =====================================================================
   DASHBOARDS
   ===================================================================== */

/*
  getOwnerDashboard(ownerId)
  The numbers and lists on the owner dashboard.
  OUT: { ok: true, pets, openRequests, closedRequests, completedRequests }
       each request list holds { request, pet }.
       (closedRequests = a provider was chosen but the service isn't done yet = "active".)
*/
function getOwnerDashboard(ownerId) {
  const requests = getRequestsForOwner(ownerId);
  const openRequests = [];
  const closedRequests = [];
  const completedRequests = [];
  for (let i = 0; i < requests.length; i++) {
    const item = { request: requests[i], pet: findPetById(requests[i].petId) };
    if (requests[i].status === 'open') {
      openRequests.push(item);
    } else if (requests[i].status === 'closed') {
      closedRequests.push(item);
    } else if (requests[i].status === 'completed') {
      completedRequests.push(item);
    }
  }
  return {
    ok: true,
    pets: getPetsForOwner(ownerId),
    openRequests: openRequests,
    closedRequests: closedRequests,
    completedRequests: completedRequests
  };
}

/*
  getProviderDashboard(carerId)
  The numbers and lists on the provider dashboard, all built from this provider's bids.
  OUT: { ok: true, currentTasks, activeBids, completedTasks }, each a list of { bid, request, pet }
       - currentTasks:   my bid won ("accepted") and the request is "closed" (job not done yet)
       - activeBids:     my bid is "pending" and the request is still "open"
       - completedTasks: my bid won and the request is "completed"
*/
function getProviderDashboard(carerId) {
  const all = getCarerBids(carerId).items;
  const currentTasks = [];
  const activeBids = [];
  const completedTasks = [];
  for (let i = 0; i < all.length; i++) {
    const bid = all[i].bid;
    const request = all[i].request;
    if (bid.status === 'accepted' && request.status === 'closed') {
      currentTasks.push(all[i]);
    } else if (bid.status === 'accepted' && request.status === 'completed') {
      completedTasks.push(all[i]);
    } else if (bid.status === 'pending' && request.status === 'open') {
      activeBids.push(all[i]);
    }
  }
  return { ok: true, currentTasks: currentTasks, activeBids: activeBids, completedTasks: completedTasks };
}


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
  completeRequest: completeRequest,
  browseRequests: browseRequests,
  getRequestDetails: getRequestDetails,
  placeBid: placeBid,
  editBid: editBid,
  withdrawBid: withdrawBid,
  getCarerBids: getCarerBids,
  addReview: addReview,
  getReviewsPage: getReviewsPage,
  getOwnerDashboard: getOwnerDashboard,
  getProviderDashboard: getProviderDashboard
};
