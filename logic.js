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

  DATABASE: we use Prisma 6 (Lecture 16) to talk to the MySQL database made by
  pet_care_schema.sql. Field names are the database column names (owner_id, pet_type, ...).
  Above every function there's a "PRISMA" line saying which Prisma call it uses and the
  SQL it's the same as.

  ASYNC / AWAIT (Lecture 16)
  Asking the database takes time (it's a separate program). Prisma functions don't give
  the answer straight away: they give a "promise" of an answer.
    - `await` means "wait here until the database answers, then carry on with the result".
    - We can only use `await` inside a function marked `async`.
    - An `async` function itself returns a promise, so whoever calls it must `await` it too.
  That's why almost every function here is `async`, and every route in server.js is
  `async (req, res) => { ... await logic.something(...) ... }`.
  Without `await` we'd get the promise object instead of the data, and the code would carry
  on before the database had finished.
*/

/*
  Prisma client (Lecture 16): `prisma` is our connection to the database.
  prisma.users, prisma.pets, prisma.care_requests, prisma.bids, prisma.reviews, prisma.request_tags
  are the tables. The connection details come from DATABASE_URL in the .env file.
*/
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/*
  EXCEPTION (not in the lectures): bcrypt
  bcrypt turns a password into a "hash": a long scrambled string you can't turn back
  into the password. We only ever save the hash. At login, bcrypt hashes what the user
  typed and checks if it matches the saved hash.
  Why we need it: if someone ever reads our users table, they still don't learn anyone's
  password. Saving plain passwords is a serious security mistake.
  We use the "Sync" versions (hashSync / compareSync): they're quick enough that we
  don't need to await them.
*/
const bcrypt = require('bcrypt');


/* =====================================================================
   ALLOWED VALUES
   The server must not trust the browser: someone can send ANY value,
   not just the options in our <select>. So we keep the allowed lists here.
   (These are the ENUMs in pet_care_schema.sql.)
   ===================================================================== */
const USER_TYPES = ['owner', 'carer'];
const SERVICES = ['walking', 'bathing', 'grooming', 'feeding', 'sitting'];
const PET_TYPES = ['cat', 'dog', 'other'];


/* =====================================================================
   SMALL HELPERS (no database)
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
  isId(value)
  true if value is a whole number (like the 3 that parseInt('3') gives).
  Prisma throws an error if we search for id NaN (e.g. /requests/abc), so we check first
  and simply treat a bad id as "not found".
*/
function isId(value) {
  return Number.isInteger(value);
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
  splitWords(text)
  "calm  indoor sharjah" -> ['calm', 'indoor', 'sharjah'] (split on spaces, no empty words,
  no repeats). Used to turn the tags box into one row per tag for the request_tags table.
*/
function splitWords(text) {
  const words = [];
  let current = '';
  for (let i = 0; i <= text.length; i++) {
    // At a space or at the very end, the current word is finished.
    if (i === text.length || text[i] === ' ') {
      if (current !== '' && !isOneOf(current, words)) {
        words.push(current);
      }
      current = '';
    } else {
      current = current + text[i];
    }
  }
  return words;
}

/*
  isBeforeDeadline(request)
  true if right now is still before the request's bidding deadline.
  Prisma gives DATETIME columns back as JavaScript Date objects, so we can compare
  them directly with < (an earlier date is "smaller").
*/
function isBeforeDeadline(request) {
  return new Date() < request.bidding_deadline;
}


/* =====================================================================
   LOOKUPS ("find one thing by its id")
   They return the row, or null if nothing matches.
   ===================================================================== */

// PRISMA: users.findUnique({ where: { id } })   SQL: SELECT * FROM users WHERE id = ?
async function findUserById(id) {
  if (!isId(id)) {
    return null;
  }
  return await prisma.users.findUnique({ where: { id: id } });
}

// PRISMA: users.findUnique({ where: { username } })   SQL: SELECT * FROM users WHERE username = ?
// MySQL compares text ignoring upper/lower case here, so "Umar" and "umar" count as the same name.
async function findUserByUsername(username) {
  return await prisma.users.findUnique({ where: { username: username } });
}

// PRISMA: users.findUnique({ where: { email } })   SQL: SELECT * FROM users WHERE email = ?
async function findUserByEmail(email) {
  return await prisma.users.findUnique({ where: { email: email } });
}

// PRISMA: pets.findUnique({ where: { id } })   SQL: SELECT * FROM pets WHERE id = ?
async function findPetById(id) {
  if (!isId(id)) {
    return null;
  }
  return await prisma.pets.findUnique({ where: { id: id } });
}

// PRISMA: care_requests.findUnique({ where: { id } })   SQL: SELECT * FROM care_requests WHERE id = ?
async function findRequestById(id) {
  if (!isId(id)) {
    return null;
  }
  return await prisma.care_requests.findUnique({ where: { id: id } });
}

// PRISMA: bids.findUnique({ where: { id } })   SQL: SELECT * FROM bids WHERE id = ?
async function findBidById(id) {
  if (!isId(id)) {
    return null;
  }
  return await prisma.bids.findUnique({ where: { id: id } });
}

// The bid this provider made on this request (or null). The database allows only ONE per pair.
// PRISMA: bids.findFirst({ where: { request_id, provider_id } })
// SQL:    SELECT * FROM bids WHERE request_id = ? AND provider_id = ? LIMIT 1
async function findBidByRequestAndCarer(requestId, carerId) {
  return await prisma.bids.findFirst({ where: { request_id: requestId, provider_id: carerId } });
}

// All bids on one request (any status).
// PRISMA: bids.findMany({ where: { request_id } })   SQL: SELECT * FROM bids WHERE request_id = ?
async function getBidsForRequest(requestId) {
  return await prisma.bids.findMany({ where: { request_id: requestId } });
}

/*
  getWinningBid(requestId)
  The database has no "winning bid id" column. The winner is simply the bid with
  status "accepted" (only one bid per request can ever be accepted). Returns it or null.
  PRISMA: bids.findFirst({ where: { request_id, status: 'accepted' } })
  SQL:    SELECT * FROM bids WHERE request_id = ? AND status = 'accepted' LIMIT 1
*/
async function getWinningBid(requestId) {
  return await prisma.bids.findFirst({ where: { request_id: requestId, status: 'accepted' } });
}

/*
  getTags(requestId)
  Tags are stored one per row in request_tags. This glues them back into one
  string, "calm indoor sharjah", for searching and for the page.
  PRISMA: request_tags.findMany({ where: { request_id } })   SQL: SELECT * FROM request_tags WHERE request_id = ?
*/
async function getTags(requestId) {
  const rows = await prisma.request_tags.findMany({ where: { request_id: requestId } });
  let text = '';
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) {
      text = text + ' ';
    }
    text = text + rows[i].tag;
  }
  return text;
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
       - username 3 to 50 characters, valid email (max 255, the DB column sizes)
       - password at least 8 characters, and both passwords match
       - username and email not already used
  PRISMA: findUnique (username / email taken?) + users.create({ data })
  SQL:    INSERT INTO users (username, email, password_hash, role, ...) VALUES (...)
  OUT: { ok: true, user } or { ok: false, status: 400, error }
*/
async function registerUser(body) {
  const userType = cleanText(body.userType);
  const username = cleanText(body.username);
  const email = cleanText(body.email).toLowerCase();
  // Passwords are NOT trimmed: a space can be part of a password.
  const password = rawText(body.password);
  const confirmPassword = rawText(body.confirmPassword);
  const providerService = cleanText(body.providerService);
  const providerExperience = cleanText(body.providerExperience);

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
  if (!isValidEmail(email) || email.length > 255) {
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

  // Usernames and emails must be unique (the DB also enforces this with UNIQUE keys).
  if (await findUserByUsername(username) !== null) {
    return fail(400, ['That username is already taken.']);
  }
  if (await findUserByEmail(email) !== null) {
    return fail(400, ['That email is already registered.']);
  }

  // Only carers have provider fields. Owners get null (= empty) in those columns.
  let service = null;
  let experience = null;
  if (userType === 'carer') {
    service = providerService;
    if (providerExperience !== '') {
      experience = providerExperience;
    }
  }

  // Save the HASH of the password, never the password itself. 10 = how much work bcrypt does (standard value).
  // The id is made by the database (AUTO_INCREMENT).
  const newUser = await prisma.users.create({
    data: {
      username: username,
      email: email,
      password_hash: bcrypt.hashSync(password, 10),
      role: userType,
      provider_service: service,
      provider_experience: experience
    }
  });
  return { ok: true, user: newUser };
}

/*
  loginUser(username, password)
  Checks a login attempt.
  IN:  username and password from the login form
  RULES: user must exist AND bcrypt must say the password matches the saved hash.
  PRISMA: users.findUnique({ where: { username } })   SQL: SELECT * FROM users WHERE username = ?
  OUT: { ok: true, user } or { ok: false, status: 401, error }
  We give the SAME message for "no such user" and "wrong password", so an attacker
  can't use the login form to find out which usernames exist.
*/
async function loginUser(username, password) {
  const user = await findUserByUsername(cleanText(username));
  if (user === null || !bcrypt.compareSync(rawText(password), user.password_hash)) {
    return fail(401, ['Wrong username or password.']);
  }
  return { ok: true, user: user };
}


/* =====================================================================
   OWNER: PETS
   ===================================================================== */

/*
  getPetsForOwner(ownerId)
  PRISMA: pets.findMany({ where: { owner_id } })   SQL: SELECT * FROM pets WHERE owner_id = ?
  OUT: an array of this owner's pets (can be empty).
*/
async function getPetsForOwner(ownerId) {
  return await prisma.pets.findMany({ where: { owner_id: ownerId } });
}

/*
  addPet(ownerId, body)
  Adds a pet for the logged-in owner.
  IN:  ownerId (from the session, NOT from the form, so nobody can add pets to someone else)
       body = pets form: petName, petType, petBreed, petAge, petPhoto
  RULES (same as script.js): name 2-100 characters, type is cat/dog/other,
       breed not empty (max 100), age a whole number from 0 to 100, photo is a web link (http/https).
  PRISMA: pets.create({ data })   SQL: INSERT INTO pets (owner_id, name, pet_type, ...) VALUES (...)
  OUT: { ok: true, pet } or { ok: false, status: 400, error }
*/
async function addPet(ownerId, body) {
  const petName = cleanText(body.petName);
  const petType = cleanText(body.petType);
  const petBreed = cleanText(body.petBreed);
  const ageText = cleanText(body.petAge);
  const petAge = Number(ageText);
  const petPhoto = cleanText(body.petPhoto);

  const errors = [];
  if (petName.length < 2 || petName.length > 100) {
    errors.push('Enter a pet name with 2 to 100 characters.');
  }
  if (!isOneOf(petType, PET_TYPES)) {
    errors.push('Choose a type of pet.');
  }
  if (petBreed === '' || petBreed.length > 100) {
    errors.push("Enter the pet's breed.");
  }
  // Number.isInteger: true only for whole numbers (3 yes, 2.5 no, NaN no). script.js uses it too.
  if (ageText === '' || !Number.isInteger(petAge) || petAge < 0 || petAge > 100) {
    errors.push("Enter the pet's age as a whole number from 0 to 100.");
  }
  // Only allow real web links. This also blocks tricks like "javascript:..." in an <img src>.
  if ((!beginsWith(petPhoto, 'http://') && !beginsWith(petPhoto, 'https://')) || petPhoto.length > 2048) {
    errors.push('Enter a valid photo URL (starting with http:// or https://).');
  }
  if (errors.length > 0) {
    return fail(400, errors);
  }

  const newPet = await prisma.pets.create({
    data: {
      owner_id: ownerId,
      name: petName,
      pet_type: petType,
      breed: petBreed,
      age_years: petAge,
      photo_url: petPhoto
    }
  });
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
  PRISMA: care_requests.create({ data }), then request_tags.create once per tag
  SQL:    INSERT INTO care_requests (...) VALUES (...);  INSERT INTO request_tags (request_id, tag) VALUES (?, ?)
  OUT: { ok: true, request } (status "open") or { ok: false, status: 400, error }
*/
async function createRequest(ownerId, body) {
  const petId = parseInt(body.petId);
  const service = cleanText(body.service);
  const startTime = cleanText(body.startTime);
  const endTime = cleanText(body.endTime);
  const budgetText = cleanText(body.budget);
  const budget = Number(budgetText);
  const deadline = cleanText(body.deadline);
  const instructions = cleanText(body.instructions);
  const tags = splitWords(cleanText(body.tags).toLowerCase());

  const errors = [];
  // The pet must exist AND belong to this owner (stops posting requests for someone else's pet).
  const pet = await findPetById(petId);
  if (pet === null || pet.owner_id !== ownerId) {
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
  // Number.isFinite: false for NaN (letters) and Infinity. The DB column is DECIMAL(10,2): max 99,999,999.99.
  if (budgetText === '' || !Number.isFinite(budget) || budget <= 0 || budget >= 100000000) {
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
  for (let i = 0; i < tags.length; i++) {
    if (tags[i].length > 50) {
      errors.push('Each tag must be at most 50 characters.');
      break;
    }
  }
  if (errors.length > 0) {
    return fail(400, errors);
  }

  // new Date("2026-12-05T09:00") turns the form's text into a Date for the DATETIME column.
  const newRequest = await prisma.care_requests.create({
    data: {
      owner_id: ownerId,
      pet_id: petId,
      service: service,
      service_start: new Date(startTime),
      service_end: new Date(endTime),
      budget: budget,
      bidding_deadline: new Date(deadline),
      instructions: instructions,
      status: 'open'      // every new request starts open (taking bids)
    }
  });
  // One row per tag (the table's key is request_id + tag, so splitWords already removed repeats).
  for (let i = 0; i < tags.length; i++) {
    await prisma.request_tags.create({ data: { request_id: newRequest.id, tag: tags[i] } });
  }
  return { ok: true, request: newRequest };
}

/*
  getRequestsForOwner(ownerId)
  PRISMA: care_requests.findMany({ where: { owner_id } })   SQL: SELECT * FROM care_requests WHERE owner_id = ?
  OUT: array of this owner's requests (all statuses).
*/
async function getRequestsForOwner(ownerId) {
  return await prisma.care_requests.findMany({ where: { owner_id: ownerId } });
}

/*
  getOwnerRequests(ownerId)
  Everything the "My Requests" page needs.
  PRISMA: getRequestsForOwner, then for each request: its pet, its bids, and each bidder (findUnique).
  OUT: { ok: true, items } where each item is { request, pet, bids }
       and bids is an array of { bid, carer } (carer = the provider's user row).
*/
async function getOwnerRequests(ownerId) {
  const requests = await getRequestsForOwner(ownerId);
  const items = [];
  for (let i = 0; i < requests.length; i++) {
    const requestBids = await getBidsForRequest(requests[i].id);
    const bidsWithCarer = [];
    for (let j = 0; j < requestBids.length; j++) {
      bidsWithCarer.push({ bid: requestBids[j], carer: await findUserById(requestBids[j].provider_id) });
    }
    items.push({ request: requests[i], pet: await findPetById(requests[i].pet_id), bids: bidsWithCarer });
  }
  return { ok: true, items: items };
}

/*
  checkOwnRequest(ownerId, requestId)
  Shared first check for every owner action on ONE request.
  OUT: { ok: true, request } or 404 (doesn't exist) / 403 (exists but isn't yours).
*/
async function checkOwnRequest(ownerId, requestId) {
  const request = await findRequestById(requestId);
  if (request === null) {
    return fail(404, ['That request does not exist.']);
  }
  if (request.owner_id !== ownerId) {
    return fail(403, ['This is not your request.']);
  }
  return { ok: true, request: request };
}

/*
  selectWinningBid(ownerId, requestId, bidId)
  The owner picks the winning bid.
  IN:  ownerId (session), requestId (URL), bidId (form: winningBidId)
  RULES: must be your request, request must still be "open", and the bid must be an
         "active" bid ON THIS request (not a withdrawn one, not from another request).
  DOES: chosen bid -> "accepted", every other active bid -> "rejected", request -> "closed".
        (Withdrawn bids stay "withdrawn". The accepted bid IS the winner, no extra column needed.)
  PRISMA: bids.update once per bid (a loop), then care_requests.update
  SQL:    UPDATE bids SET status = ? WHERE id = ?;  UPDATE care_requests SET status = 'closed' WHERE id = ?
  OUT: { ok: true, request } or { ok: false, status, error }
*/
async function selectWinningBid(ownerId, requestId, bidId) {
  const check = await checkOwnRequest(ownerId, requestId);
  if (!check.ok) {
    return check;
  }
  const request = check.request;
  if (request.status !== 'open') {
    return fail(400, ['This request is no longer open, so a winner cannot be chosen.']);
  }
  const bid = await findBidById(bidId);
  if (bid === null || bid.request_id !== request.id || bid.status !== 'active') {
    return fail(400, ['Choose one of the active bids on this request.']);
  }

  // Update every bid on this request, one at a time.
  const requestBids = await getBidsForRequest(request.id);
  for (let i = 0; i < requestBids.length; i++) {
    if (requestBids[i].id === bid.id) {
      await prisma.bids.update({ where: { id: requestBids[i].id }, data: { status: 'accepted' } });
    } else if (requestBids[i].status === 'active') {
      await prisma.bids.update({ where: { id: requestBids[i].id }, data: { status: 'rejected' } });
    }
  }
  const updated = await prisma.care_requests.update({ where: { id: request.id }, data: { status: 'closed' } });
  return { ok: true, request: updated };
}

/*
  closeRequest(ownerId, requestId)
  The owner closes a request WITHOUT picking a winner (e.g. no good bids).
  RULES: your request, and it must still be "open".
  DOES: request -> "closed", all active bids -> "rejected". After this no one can bid.
  PRISMA: bids.update in a loop + care_requests.update
  SQL:    UPDATE bids SET status = 'rejected' WHERE id = ?;  UPDATE care_requests SET status = 'closed' WHERE id = ?
*/
async function closeRequest(ownerId, requestId) {
  const check = await checkOwnRequest(ownerId, requestId);
  if (!check.ok) {
    return check;
  }
  const request = check.request;
  if (request.status !== 'open') {
    return fail(400, ['Only open requests can be closed.']);
  }
  const requestBids = await getBidsForRequest(request.id);
  for (let i = 0; i < requestBids.length; i++) {
    if (requestBids[i].status === 'active') {
      await prisma.bids.update({ where: { id: requestBids[i].id }, data: { status: 'rejected' } });
    }
  }
  const updated = await prisma.care_requests.update({ where: { id: request.id }, data: { status: 'closed' } });
  return { ok: true, request: updated };
}

/*
  completeRequest(ownerId, requestId)
  The owner marks the service as done.
  RULES: your request, status must be "closed" AND there must be a winning (accepted) bid
         (you can't "complete" a request nobody was hired for).
  DOES: request -> "completed". Now both sides can leave reviews.
  PRISMA: care_requests.update({ where: { id }, data: { status: 'completed' } })
  SQL:    UPDATE care_requests SET status = 'completed' WHERE id = ?
*/
async function completeRequest(ownerId, requestId) {
  const check = await checkOwnRequest(ownerId, requestId);
  if (!check.ok) {
    return check;
  }
  const request = check.request;
  if (request.status !== 'closed' || await getWinningBid(request.id) === null) {
    return fail(400, ['Only closed requests with a chosen provider can be marked completed.']);
  }
  const updated = await prisma.care_requests.update({ where: { id: request.id }, data: { status: 'completed' } });
  return { ok: true, request: updated };
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
         search matches pet name/type/breed, service, instructions AND the tags
         (our tag-search extra feature), ignoring upper/lower case.
  PRISMA: care_requests.findMany({ where: { status: 'open', bidding_deadline: { gt: now }, service?, budget: { lte }? } })
  SQL:    SELECT * FROM care_requests WHERE status = 'open' AND bidding_deadline > NOW()
            [AND service = ?] [AND budget <= ?]
          The pet type and text search are then checked in JavaScript, because they need the pet and the tags.
  OUT: { ok: true, items } where each item is { request, pet, tags }
*/
async function browseRequests(query) {
  const search = cleanText(query.search).toLowerCase();
  const petType = cleanText(query.petType);
  const service = cleanText(query.service);
  const maxBudgetText = cleanText(query.maxBudget);
  const maxBudget = Number(maxBudgetText);

  // Build the `where` step by step: only add a filter if the user chose one.
  const where = { status: 'open', bidding_deadline: { gt: new Date() } };
  if (isOneOf(service, SERVICES)) {
    where.service = service;
  }
  if (maxBudgetText !== '' && Number.isFinite(maxBudget)) {
    where.budget = { lte: maxBudget };
  }
  const requests = await prisma.care_requests.findMany({ where: where });

  const items = [];
  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];
    const pet = await findPetById(request.pet_id);
    // `continue` = skip this request and go to the next one in the loop.
    if (petType !== '' && pet.pet_type !== petType) {
      continue;
    }
    const tags = await getTags(request.id);
    if (search !== '') {
      // One lowercase string with everything searchable, then check if the search text is inside it.
      const searchable = (pet.name + ' ' + pet.pet_type + ' ' + pet.breed + ' ' + request.service + ' ' +
        request.instructions + ' ' + tags).toLowerCase();
      if (!searchable.includes(search)) {
        continue;
      }
    }
    items.push({ request: request, pet: pet, tags: tags });
  }
  return { ok: true, items: items };
}

/*
  getRequestDetails(user, requestId)
  Everything the request details page needs.
  IN:  user = the logged-in user row, requestId from the URL
  RULES: 404 if it doesn't exist. Owners may only open THEIR OWN requests (403 otherwise).
         Providers may open any request.
  PRISMA: findUnique for the request and pet; findMany for the bids (owner) or findFirst for my bid (provider)
  OUT: { ok: true, request, pet, bids, myBid, canBid }
       - bids: all bids with their provider ({ bid, carer }), only filled in for the owner
       - myBid: this provider's own bid on it (or null)
       - canBid: true if this provider may submit a bid right now
*/
async function getRequestDetails(user, requestId) {
  const request = await findRequestById(requestId);
  if (request === null) {
    return fail(404, ['That request does not exist.']);
  }
  if (user.role === 'owner' && request.owner_id !== user.id) {
    return fail(403, ['This is not your request.']);
  }

  const bids = [];
  let myBid = null;
  let canBid = false;
  if (user.role === 'owner') {
    const requestBids = await getBidsForRequest(request.id);
    for (let i = 0; i < requestBids.length; i++) {
      bids.push({ bid: requestBids[i], carer: await findUserById(requestBids[i].provider_id) });
    }
  } else {
    myBid = await findBidByRequestAndCarer(request.id, user.id);
    // A provider can bid if the request is open, the deadline hasn't passed,
    // and they have no bid yet (or only a withdrawn one).
    canBid = request.status === 'open' && isBeforeDeadline(request) &&
      (myBid === null || myBid.status === 'withdrawn');
  }
  return { ok: true, request: request, pet: await findPetById(request.pet_id), bids: bids, myBid: myBid, canBid: canBid };
}


/* =====================================================================
   PROVIDER: BIDS
   ===================================================================== */

/*
  checkBidDetails(bidPrice, bidDescription)
  Shared validation for placing and editing a bid (same rules as script.js).
  No database. OUT: an array of error messages (empty = all good).
*/
function checkBidDetails(bidPrice, bidDescription) {
  const errors = [];
  const priceText = cleanText(bidPrice);
  const price = Number(priceText);
  // DECIMAL(10,2) in the DB: max 99,999,999.99
  if (priceText === '' || !Number.isFinite(price) || price <= 0 || price >= 100000000) {
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
  DOES: new bid with status "active". If they had WITHDRAWN a bid on this request before,
        we reuse that same row instead of making a second one: the database only allows
        ONE bid per provider per request (UNIQUE request_id + provider_id).
  PRISMA: bids.findFirst (existing bid?), then bids.update (re-bid) or bids.create (new bid)
  SQL:    UPDATE bids SET proposed_price = ?, description = ?, status = 'active' WHERE id = ?
     or   INSERT INTO bids (request_id, provider_id, proposed_price, description, status) VALUES (...)
  OUT: { ok: true, bid } or { ok: false, status, error }
*/
async function placeBid(requestId, carerId, bidPrice, bidDescription) {
  const request = await findRequestById(requestId);
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

  const existing = await findBidByRequestAndCarer(request.id, carerId);
  if (existing !== null && existing.status !== 'withdrawn') {
    return fail(400, ['You already bid on this request. Edit your bid on the My Bids page instead.']);
  }
  if (existing !== null) {
    // Re-bidding after a withdraw: bring the old bid back with the new details.
    const revived = await prisma.bids.update({
      where: { id: existing.id },
      data: { proposed_price: Number(cleanText(bidPrice)), description: cleanText(bidDescription), status: 'active' }
    });
    return { ok: true, bid: revived };
  }

  const newBid = await prisma.bids.create({
    data: {
      request_id: request.id,
      provider_id: carerId,
      proposed_price: Number(cleanText(bidPrice)),
      description: cleanText(bidDescription),
      status: 'active'
    }
  });
  return { ok: true, bid: newBid };
}

/*
  checkBidCanChange(carerId, bidId)
  Shared checks before editing OR withdrawing a bid.
  RULES: bid exists (404), it's YOUR bid (403), it's still "active",
         and its request is still open and before the deadline.
  OUT: { ok: true, bid, request } or { ok: false, status, error }
*/
async function checkBidCanChange(carerId, bidId) {
  const bid = await findBidById(bidId);
  if (bid === null) {
    return fail(404, ['That bid does not exist.']);
  }
  if (bid.provider_id !== carerId) {
    return fail(403, ['This is not your bid.']);
  }
  if (bid.status !== 'active') {
    return fail(400, ['Only active bids can be changed.']);
  }
  const request = await findRequestById(bid.request_id);
  if (request.status !== 'open' || !isBeforeDeadline(request)) {
    return fail(400, ['Bidding on this request is over, so the bid can no longer be changed.']);
  }
  return { ok: true, bid: bid, request: request };
}

/*
  editBid(carerId, bidId, bidPrice, bidDescription)
  A provider changes the price/description of their own active bid.
  RULES: checkBidCanChange + the same price/description rules as placeBid.
  PRISMA: bids.update({ where: { id }, data: { proposed_price, description } })
  SQL:    UPDATE bids SET proposed_price = ?, description = ? WHERE id = ?
  OUT: { ok: true, bid } or { ok: false, status, error }
*/
async function editBid(carerId, bidId, bidPrice, bidDescription) {
  const check = await checkBidCanChange(carerId, bidId);
  if (!check.ok) {
    return check;
  }
  const errors = checkBidDetails(bidPrice, bidDescription);
  if (errors.length > 0) {
    return fail(400, errors);
  }
  const updated = await prisma.bids.update({
    where: { id: check.bid.id },
    data: { proposed_price: Number(cleanText(bidPrice)), description: cleanText(bidDescription) }
  });
  return { ok: true, bid: updated };
}

/*
  withdrawBid(carerId, bidId)
  A provider takes back their own active bid.
  RULES: same as checkBidCanChange.
  DOES: bid status -> "withdrawn" (we keep the row rather than delete it, so there's a history,
        and so placeBid can reuse it if they bid again).
  PRISMA: bids.update({ where: { id }, data: { status: 'withdrawn' } })
  SQL:    UPDATE bids SET status = 'withdrawn' WHERE id = ?
*/
async function withdrawBid(carerId, bidId) {
  const check = await checkBidCanChange(carerId, bidId);
  if (!check.ok) {
    return check;
  }
  const updated = await prisma.bids.update({ where: { id: check.bid.id }, data: { status: 'withdrawn' } });
  return { ok: true, bid: updated };
}

/*
  getCarerBids(carerId)
  Everything the "My Bids" page needs.
  PRISMA: bids.findMany({ where: { provider_id } }), then the request + pet for each
  SQL:    SELECT * FROM bids WHERE provider_id = ?
  OUT: { ok: true, items } where each item is { bid, request, pet, canChange }
       canChange = true if the edit/withdraw buttons should be shown.
*/
async function getCarerBids(carerId) {
  const bids = await prisma.bids.findMany({ where: { provider_id: carerId } });
  const items = [];
  for (let i = 0; i < bids.length; i++) {
    const bid = bids[i];
    const request = await findRequestById(bid.request_id);
    const canChange = bid.status === 'active' && request.status === 'open' && isBeforeDeadline(request);
    items.push({ bid: bid, request: request, pet: await findPetById(request.pet_id), canChange: canChange });
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
async function getReviewPartner(request, userId) {
  const winningBid = await getWinningBid(request.id);
  if (winningBid === null) {
    return null;
  }
  if (userId === request.owner_id) {
    return winningBid.provider_id;
  }
  if (userId === winningBid.provider_id) {
    return request.owner_id;
  }
  return null;
}

/*
  hasReviewed(requestId, reviewerId)
  true if this person already left a review for this request (only one allowed each).
  PRISMA: reviews.findFirst({ where: { request_id, reviewer_id } })
  SQL:    SELECT * FROM reviews WHERE request_id = ? AND reviewer_id = ? LIMIT 1
*/
async function hasReviewed(requestId, reviewerId) {
  const review = await prisma.reviews.findFirst({ where: { request_id: requestId, reviewer_id: reviewerId } });
  return review !== null;
}

/*
  addReview(reviewerId, body)
  Leave a review after a completed service.
  IN:  reviewerId (session), body = review form: requestId, rating, comment
  RULES: request exists and is "completed", you are its owner or its winning provider (403 otherwise),
         rating is a whole number 1 to 5, comment at most 1000 characters (optional),
         and you haven't reviewed this request yet.
  DOES: saves the review about the OTHER person (owner reviews provider, provider reviews owner).
  PRISMA: reviews.create({ data })   SQL: INSERT INTO reviews (request_id, reviewer_id, reviewee_id, rating, comment) VALUES (...)
  OUT: { ok: true, review } or { ok: false, status, error }
*/
async function addReview(reviewerId, body) {
  const requestId = parseInt(body.requestId);
  const ratingText = cleanText(body.rating);
  const rating = Number(ratingText);
  const comment = cleanText(body.comment);

  const errors = [];
  const request = await findRequestById(requestId);
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

  const revieweeId = await getReviewPartner(request, reviewerId);
  if (revieweeId === null) {
    return fail(403, ['You can only review services you were part of.']);
  }
  if (await hasReviewed(request.id, reviewerId)) {
    return fail(400, ['You already reviewed this service.']);
  }

  const newReview = await prisma.reviews.create({
    data: {
      request_id: request.id,
      reviewer_id: reviewerId,
      reviewee_id: revieweeId,
      rating: rating,
      comment: comment
    }
  });
  return { ok: true, review: newReview };
}

/*
  getReviewsPage(userId)
  Everything the Reviews page needs.
  PRISMA: reviews.findMany({ where: { OR: [{ reviewer_id }, { reviewee_id }] } })
  SQL:    SELECT * FROM reviews WHERE reviewer_id = ? OR reviewee_id = ?
          + care_requests.findMany({ where: { status: 'completed' } }) for the review form
  OUT: { ok: true, about, written, reviewable }
       - about:      reviews other people wrote about me   [{ review, reviewer, request, pet }]
       - written:    reviews I wrote                        [{ review, reviewee, request, pet }]
       - reviewable: my completed requests I haven't reviewed yet  [{ request, pet, partner }]
*/
async function getReviewsPage(userId) {
  const myReviews = await prisma.reviews.findMany({
    where: { OR: [{ reviewer_id: userId }, { reviewee_id: userId }] }
  });
  const about = [];
  const written = [];
  for (let i = 0; i < myReviews.length; i++) {
    const review = myReviews[i];
    const request = await findRequestById(review.request_id);
    const pet = await findPetById(request.pet_id);
    if (review.reviewee_id === userId) {
      about.push({ review: review, reviewer: await findUserById(review.reviewer_id), request: request, pet: pet });
    }
    if (review.reviewer_id === userId) {
      written.push({ review: review, reviewee: await findUserById(review.reviewee_id), request: request, pet: pet });
    }
  }

  const completed = await prisma.care_requests.findMany({ where: { status: 'completed' } });
  const reviewable = [];
  for (let i = 0; i < completed.length; i++) {
    const request = completed[i];
    const partnerId = await getReviewPartner(request, userId);
    if (partnerId !== null && !(await hasReviewed(request.id, userId))) {
      reviewable.push({ request: request, pet: await findPetById(request.pet_id), partner: await findUserById(partnerId) });
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
  PRISMA: pets.findMany + care_requests.findMany({ where: { owner_id } })
  OUT: { ok: true, pets, openRequests, closedRequests, completedRequests }
       each request list holds { request, pet }.
       (closedRequests = a provider was chosen but the service isn't done yet = "active".)
*/
async function getOwnerDashboard(ownerId) {
  const requests = await getRequestsForOwner(ownerId);
  const openRequests = [];
  const closedRequests = [];
  const completedRequests = [];
  for (let i = 0; i < requests.length; i++) {
    const item = { request: requests[i], pet: await findPetById(requests[i].pet_id) };
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
    pets: await getPetsForOwner(ownerId),
    openRequests: openRequests,
    closedRequests: closedRequests,
    completedRequests: completedRequests
  };
}

/*
  getProviderDashboard(carerId)
  The numbers and lists on the provider dashboard, all built from this provider's bids.
  PRISMA: same as getCarerBids (bids.findMany({ where: { provider_id } }))
  OUT: { ok: true, currentTasks, activeBids, completedTasks }, each a list of { bid, request, pet }
       - currentTasks:   my bid won ("accepted") and the request is "closed" (job not done yet)
       - activeBids:     my bid is "active" and the request is still "open"
       - completedTasks: my bid won and the request is "completed"
*/
async function getProviderDashboard(carerId) {
  const all = (await getCarerBids(carerId)).items;
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
    } else if (bid.status === 'active' && request.status === 'open') {
      activeBids.push(all[i]);
    }
  }
  return { ok: true, currentTasks: currentTasks, activeBids: activeBids, completedTasks: completedTasks };
}

/*
  disconnect()
  Closes the database connection. Only test.js uses it, so the test script can finish.
  ($disconnect isn't in the lecture list, but without it Node keeps waiting on the open connection.)
*/
async function disconnect() {
  await prisma.$disconnect();
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
  getWinningBid: getWinningBid,
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
  getProviderDashboard: getProviderDashboard,
  disconnect: disconnect
};
