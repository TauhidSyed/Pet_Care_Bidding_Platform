/*
  test.js  -  TESTS FOR THE APP RULES
  ----------------------------------------------------------------------
  Run with:  node test.js
  It calls the logic.js functions directly (no server, no browser) with good and bad
  inputs, and prints PASS or FAIL for each check, then a total.
  Because the data lives in memory, every run starts from the sample data in data.js.
*/

const logic = require('./logic');
const data = require('./data'); // only used to set up special cases (e.g. a request whose deadline already passed)

let passed = 0;
let failed = 0;

/*
  expect(name, result, wantOk, wantStatus)
  Checks one result from logic.js.
  - wantOk: true if we expect success, false if we expect a failure
  - wantStatus: for failures, the HTTP code we expect (400 / 401 / 403 / 404)
*/
function expect(name, result, wantOk, wantStatus) {
  let good = result.ok === wantOk;
  if (!wantOk && result.status !== wantStatus) {
    good = false;
  }
  if (good) {
    passed++;
    let extra = '';
    if (!result.ok) {
      extra = '  -> ' + result.status + ' "' + result.error + '"';
    }
    console.log('PASS  ' + name + extra);
  } else {
    failed++;
    console.log('FAIL  ' + name + '  (got: ' + JSON.stringify(result) + ')');
  }
}

// Plain true/false check for things that aren't { ok } results.
function expectTrue(name, value) {
  if (value) {
    passed++;
    console.log('PASS  ' + name);
  } else {
    failed++;
    console.log('FAIL  ' + name);
  }
}

// Sample ids from data.js
const UMAR = 1;   // owner (pets 1, 2 / requests 1, 2, 3)
const AISHA = 2;  // carer (bid 1 on request 1, accepted bid 4 on request 3)
const SAM = 3;    // carer (bid 2 on request 1, accepted bid 3 on request 2)
const LINA = 4;   // owner (pet 3 / request 4)

console.log('\n=== Register ===');
expect('valid owner', logic.registerUser({ userType: 'owner', username: 'testowner', email: 'test@owner.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), true);
expect('valid carer', logic.registerUser({ userType: 'carer', providerService: 'walking', username: 'testcarer', email: 'test@carer.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), true);
expect('carer without service', logic.registerUser({ userType: 'carer', username: 'nocarer', email: 'no@carer.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), false, 400);
expect('no role', logic.registerUser({ username: 'norole', email: 'no@role.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), false, 400);
expect('short username', logic.registerUser({ userType: 'owner', username: 'ab', email: 'ab@x.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), false, 400);
expect('bad email', logic.registerUser({ userType: 'owner', username: 'bademail', email: 'bad@', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), false, 400);
expect('short password', logic.registerUser({ userType: 'owner', username: 'shortpw', email: 'short@pw.com', password: 'abc', confirmPassword: 'abc' }), false, 400);
expect('passwords differ', logic.registerUser({ userType: 'owner', username: 'diffpw', email: 'diff@pw.com', password: 'abcdefgh', confirmPassword: 'abcdefgX' }), false, 400);
expect('username taken (different case)', logic.registerUser({ userType: 'owner', username: 'UMAR_OWNER', email: 'other@x.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), false, 400);
expect('email taken', logic.registerUser({ userType: 'owner', username: 'someone', email: 'umar@example.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), false, 400);
const saved = logic.loginUser('testowner', 'abcdefgh');
expectTrue('password saved as a hash, not plain text', saved.ok && saved.user.password !== 'abcdefgh');

console.log('\n=== Login ===');
expect('correct password', logic.loginUser('umar_owner', 'password123'), true);
expect('wrong password', logic.loginUser('umar_owner', 'wrong'), false, 401);
expect('unknown user', logic.loginUser('nobody', 'password123'), false, 401);

console.log('\n=== Pets ===');
expect('valid pet', logic.addPet(UMAR, { petName: 'Milo', petType: 'dog', petBreed: 'Pug', petAge: '2', petPhoto: 'https://x.com/milo.jpg' }), true);
expect('bad pet (name, type, age, photo)', logic.addPet(UMAR, { petName: 'M', petType: 'lion', petBreed: 'x', petAge: '-1', petPhoto: 'javascript:alert(1)' }), false, 400);
expect('decimal age', logic.addPet(UMAR, { petName: 'Milo', petType: 'dog', petBreed: 'Pug', petAge: '2.5', petPhoto: 'https://x.com/a.jpg' }), false, 400);

console.log('\n=== Create request ===');
const goodRequest = { petId: '1', service: 'bathing', startTime: '2030-01-10T10:00', endTime: '2030-01-10T11:00', budget: '80', deadline: '2030-01-05T10:00', tags: 'calm' };
const created = logic.createRequest(UMAR, goodRequest);
expect('valid request', created, true);
expectTrue('new request starts "open"', created.ok && created.request.status === 'open');
expect("someone else's pet", logic.createRequest(UMAR, { petId: '3', service: 'bathing', startTime: '2030-01-10T10:00', endTime: '2030-01-10T11:00', budget: '80', deadline: '2030-01-05T10:00' }), false, 400);
expect('end before start', logic.createRequest(UMAR, { petId: '1', service: 'bathing', startTime: '2030-01-10T10:00', endTime: '2030-01-10T09:00', budget: '80', deadline: '2030-01-05T10:00' }), false, 400);
expect('budget 0', logic.createRequest(UMAR, { petId: '1', service: 'bathing', startTime: '2030-01-10T10:00', endTime: '2030-01-10T11:00', budget: '0', deadline: '2030-01-05T10:00' }), false, 400);
expect('deadline in the past', logic.createRequest(UMAR, { petId: '1', service: 'bathing', startTime: '2030-01-10T10:00', endTime: '2030-01-10T11:00', budget: '80', deadline: '2020-01-05T10:00' }), false, 400);
expect('deadline after start', logic.createRequest(UMAR, { petId: '1', service: 'bathing', startTime: '2030-01-10T10:00', endTime: '2030-01-10T11:00', budget: '80', deadline: '2030-01-11T10:00' }), false, 400);
expect('unknown service', logic.createRequest(UMAR, { petId: '1', service: 'flying', startTime: '2030-01-10T10:00', endTime: '2030-01-10T11:00', budget: '80', deadline: '2030-01-05T10:00' }), false, 400);
const newRequestId = created.request.id;

console.log('\n=== Browse ===');
let browse = logic.browseRequests({});
expectTrue('only open requests are listed (' + browse.items.length + ' found)', browse.items.length === 3);
browse = logic.browseRequests({ search: 'DUBAI' });
expectTrue('tag search finds "dubai" (any case)', browse.items.length === 1 && browse.items[0].request.id === 4);
browse = logic.browseRequests({ petType: 'cat' });
expectTrue('pet type filter', browse.items.length === 2);
browse = logic.browseRequests({ service: 'feeding', maxBudget: '50' });
expectTrue('service + max budget filter (60 > 50 so none)', browse.items.length === 0);

console.log('\n=== Place bid ===');
expect('valid bid', logic.placeBid(4, AISHA, '50', 'I feed birds every day'), true);
expect('second bid on same request', logic.placeBid(4, AISHA, '45', 'I feed birds every day'), false, 400);
expect('bad price + short description', logic.placeBid(4, SAM, '-5', 'short'), false, 400);
expect('request closed', logic.placeBid(2, AISHA, '50', 'I can do a great job'), false, 400);
expect('request does not exist', logic.placeBid(999, AISHA, '50', 'I can do a great job'), false, 404);
// Make a request whose deadline already passed (still "open"), to check the deadline rule.
data.requests.push({ id: 900, ownerId: LINA, petId: 3, service: 'feeding', startTime: '2030-01-10T10:00', endTime: '2030-01-10T11:00', budget: 50, deadline: '2020-01-01T10:00', instructions: '', tags: '', status: 'open', winningBidId: null });
expect('deadline passed', logic.placeBid(900, AISHA, '50', 'I can do a great job'), false, 400);
expectTrue('expired request hidden from browse', logic.browseRequests({ search: '' }).items.length === 3);

console.log('\n=== Edit / withdraw bid ===');
expect('edit own pending bid', logic.editBid(AISHA, 1, '95', 'Calm one-hour walk with photos'), true);
expect("edit someone else's bid", logic.editBid(AISHA, 2, '1', 'Trying to change Sam bid'), false, 403);
expect('edit accepted bid', logic.editBid(AISHA, 4, '10', 'Changing an accepted bid'), false, 400);
expect('edit with bad price', logic.editBid(AISHA, 1, 'abc', 'Calm one-hour walk with photos'), false, 400);
expect('edit missing bid', logic.editBid(AISHA, 999, '10', 'Calm one-hour walk with photos'), false, 404);
expect('withdraw own bid', logic.withdrawBid(AISHA, 1), true);
expect('withdraw again', logic.withdrawBid(AISHA, 1), false, 400);
const rebid = logic.placeBid(1, AISHA, '90', 'Back again with a calm walk');
expect('bid again after withdrawing', rebid, true);
expectTrue('re-bid reuses the same bid (one bid per provider per request)', rebid.ok && rebid.bid.id === 1);

console.log('\n=== Select winner / close / complete ===');
expect("select on someone else's request", logic.selectWinningBid(UMAR, 4, 5), false, 403);
expect('select a bid from another request', logic.selectWinningBid(UMAR, 1, 3), false, 400);
expect('select on missing request', logic.selectWinningBid(UMAR, 999, 1), false, 404);
expect('complete an open request', logic.completeRequest(UMAR, 1), false, 400);
expect('select winning bid', logic.selectWinningBid(UMAR, 1, 2), true);
expectTrue('winner accepted, other bid rejected, request closed',
  logic.findBidById(2).status === 'accepted' && logic.findBidById(1).status === 'rejected' &&
  logic.findRequestById(1).status === 'closed' && logic.findRequestById(1).winningBidId === 2);
expect('bid on the now-closed request', logic.placeBid(1, AISHA, '50', 'Trying after it closed'), false, 400);
expect('select again', logic.selectWinningBid(UMAR, 1, 1), false, 400);
expect('close a request without a winner', logic.closeRequest(UMAR, newRequestId), true);
expect('complete a request closed without winner', logic.completeRequest(UMAR, newRequestId), false, 400);
expect('complete request with winner', logic.completeRequest(UMAR, 1), true);
expect("close someone else's request", logic.closeRequest(UMAR, 4), false, 403);

console.log('\n=== Reviews ===');
expect('owner reviews winning provider', logic.addReview(UMAR, { requestId: '1', rating: '5', comment: 'Great walk' }), true);
expect('provider reviews owner', logic.addReview(SAM, { requestId: '1', rating: '4', comment: 'Nice owner' }), true);
expect('review twice', logic.addReview(UMAR, { requestId: '1', rating: '3' }), false, 400);
expect('losing provider reviews', logic.addReview(AISHA, { requestId: '1', rating: '1' }), false, 403);
expect('rating 6', logic.addReview(UMAR, { requestId: '2', rating: '6' }), false, 400);
expect('review a request that is not completed', logic.addReview(UMAR, { requestId: '2', rating: '5' }), false, 400);
const reviews = logic.getReviewsPage(SAM);
expectTrue('Sam sees the review about him', reviews.about.length === 1 && reviews.about[0].review.rating === 5);

console.log('\n=== Request details ===');
expect('provider opens any request', logic.getRequestDetails(logic.findUserById(AISHA), 4), true);
expect("owner opens someone else's request", logic.getRequestDetails(logic.findUserById(UMAR), 4), false, 403);
expect('missing request', logic.getRequestDetails(logic.findUserById(UMAR), 999), false, 404);
expectTrue('provider cannot bid twice (canBid false)', logic.getRequestDetails(logic.findUserById(AISHA), 4).canBid === false);
expectTrue('provider can bid on a new request (canBid true)', logic.getRequestDetails(logic.findUserById(SAM), 4).canBid === true);

console.log('\n=== Dashboards ===');
const ownerDash = logic.getOwnerDashboard(UMAR);
expectTrue('owner dashboard: 3 pets, 0 open, 2 completed',
  ownerDash.pets.length === 3 && ownerDash.openRequests.length === 0 && ownerDash.completedRequests.length === 2);
const samDash = logic.getProviderDashboard(SAM);
expectTrue('Sam: 1 current task (request 2), 1 completed (request 1)',
  samDash.currentTasks.length === 1 && samDash.completedTasks.length === 1);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
