/*
  test.js  -  TESTS FOR THE APP RULES (against the real MySQL database)
  ----------------------------------------------------------------------
  Run with:  npm test
  (that runs "node seed.js" first to reset the database to the sample data, then "node test.js")
  WARNING: seeding DELETES everything in the database first. Development only.

  It calls the logic.js functions directly (no server, no browser) with good and bad
  inputs, and prints PASS or FAIL for each check, then a total.
  The logic.js functions are async (they wait for the database), so every call here uses
  `await`, inside the async function runTests().
*/

const logic = require('./logic');
// Only used to set up one special case that the app itself never allows:
// an "open" request whose deadline has already passed.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

// Sample ids from seed.js
const UMAR = 1;   // owner (pets 1, 2 / requests 1, 2, 3)
const AISHA = 2;  // carer (bid 1 on request 1, accepted bid 4 on request 3)
const SAM = 3;    // carer (bid 2 on request 1, accepted bid 3 on request 2)
const LINA = 4;   // owner (pet 3 / request 4)

async function runTests() {
  console.log('\n=== Register ===');
  expect('valid owner', await logic.registerUser({ userType: 'owner', username: 'testowner', email: 'test@owner.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), true);
  expect('valid carer', await logic.registerUser({ userType: 'carer', providerService: 'walking', username: 'testcarer', email: 'test@carer.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), true);
  expect('carer without service', await logic.registerUser({ userType: 'carer', username: 'nocarer', email: 'no@carer.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), false, 400);
  expect('no role', await logic.registerUser({ username: 'norole', email: 'no@role.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), false, 400);
  expect('short username', await logic.registerUser({ userType: 'owner', username: 'ab', email: 'ab@x.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), false, 400);
  expect('bad email', await logic.registerUser({ userType: 'owner', username: 'bademail', email: 'bad@', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), false, 400);
  expect('short password', await logic.registerUser({ userType: 'owner', username: 'shortpw', email: 'short@pw.com', password: 'abc', confirmPassword: 'abc' }), false, 400);
  expect('passwords differ', await logic.registerUser({ userType: 'owner', username: 'diffpw', email: 'diff@pw.com', password: 'abcdefgh', confirmPassword: 'abcdefgX' }), false, 400);
  expect('username taken (different case)', await logic.registerUser({ userType: 'owner', username: 'UMAR_OWNER', email: 'other@x.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), false, 400);
  expect('email taken', await logic.registerUser({ userType: 'owner', username: 'someone', email: 'umar@example.com', password: 'abcdefgh', confirmPassword: 'abcdefgh' }), false, 400);
  const saved = await logic.loginUser('testowner', 'abcdefgh');
  expectTrue('password saved as a hash, not plain text', saved.ok && saved.user.password_hash !== 'abcdefgh');

  console.log('\n=== Login ===');
  expect('correct password', await logic.loginUser('umar_owner', 'password123'), true);
  expect('wrong password', await logic.loginUser('umar_owner', 'wrong'), false, 401);
  expect('unknown user', await logic.loginUser('nobody', 'password123'), false, 401);

  console.log('\n=== Pets ===');
  expect('valid pet', await logic.addPet(UMAR, { petName: 'Milo', petType: 'dog', petBreed: 'Pug', petAge: '2', petPhoto: 'https://x.com/milo.jpg' }), true);
  expect('bad pet (name, type, age, photo)', await logic.addPet(UMAR, { petName: 'M', petType: 'lion', petBreed: 'x', petAge: '-1', petPhoto: 'javascript:alert(1)' }), false, 400);
  expect('decimal age', await logic.addPet(UMAR, { petName: 'Milo', petType: 'dog', petBreed: 'Pug', petAge: '2.5', petPhoto: 'https://x.com/a.jpg' }), false, 400);

  console.log('\n=== Create request ===');
  const created = await logic.createRequest(UMAR, { petId: '1', service: 'bathing', startTime: '2030-01-10T10:00', endTime: '2030-01-10T11:00', budget: '80', deadline: '2030-01-05T10:00', tags: 'calm calm  happy' });
  expect('valid request', created, true);
  expectTrue('new request starts "open"', created.ok && created.request.status === 'open');
  const savedTags = await prisma.request_tags.findMany({ where: { request_id: created.request.id } });
  expectTrue('tags saved one per row, repeats removed (calm, happy)', savedTags.length === 2);
  expect("someone else's pet", await logic.createRequest(UMAR, { petId: '3', service: 'bathing', startTime: '2030-01-10T10:00', endTime: '2030-01-10T11:00', budget: '80', deadline: '2030-01-05T10:00' }), false, 400);
  expect('end before start', await logic.createRequest(UMAR, { petId: '1', service: 'bathing', startTime: '2030-01-10T10:00', endTime: '2030-01-10T09:00', budget: '80', deadline: '2030-01-05T10:00' }), false, 400);
  expect('budget 0', await logic.createRequest(UMAR, { petId: '1', service: 'bathing', startTime: '2030-01-10T10:00', endTime: '2030-01-10T11:00', budget: '0', deadline: '2030-01-05T10:00' }), false, 400);
  expect('deadline in the past', await logic.createRequest(UMAR, { petId: '1', service: 'bathing', startTime: '2030-01-10T10:00', endTime: '2030-01-10T11:00', budget: '80', deadline: '2020-01-05T10:00' }), false, 400);
  expect('deadline after start', await logic.createRequest(UMAR, { petId: '1', service: 'bathing', startTime: '2030-01-10T10:00', endTime: '2030-01-10T11:00', budget: '80', deadline: '2030-01-11T10:00' }), false, 400);
  expect('unknown service', await logic.createRequest(UMAR, { petId: '1', service: 'flying', startTime: '2030-01-10T10:00', endTime: '2030-01-10T11:00', budget: '80', deadline: '2030-01-05T10:00' }), false, 400);

  console.log('\n=== Browse ===');
  let browse = await logic.browseRequests({});
  expectTrue('only open requests are listed (' + browse.items.length + ' found)', browse.items.length === 3);
  browse = await logic.browseRequests({ search: 'DUBAI' });
  expectTrue('tag search finds "dubai" (any case)', browse.items.length === 1 && browse.items[0].request.id === 4);
  browse = await logic.browseRequests({ petType: 'cat' });
  expectTrue('pet type filter', browse.items.length === 2);
  browse = await logic.browseRequests({ service: 'feeding', maxBudget: '50' });
  expectTrue('service + max budget filter (60 > 50 so none)', browse.items.length === 0);
  browse = await logic.browseRequests({ maxBudget: '100' });
  expectTrue('max budget 100 (DECIMAL compare: 60 and 80 yes, 120 no)', browse.items.length === 2);

  console.log('\n=== Place bid ===');
  expect('valid bid', await logic.placeBid(4, AISHA, '50', 'I feed birds every day'), true);
  expect('second bid on same request', await logic.placeBid(4, AISHA, '45', 'I feed birds every day'), false, 400);
  expect('bad price + short description', await logic.placeBid(4, SAM, '-5', 'short'), false, 400);
  expect('request closed', await logic.placeBid(2, AISHA, '50', 'I can do a great job'), false, 400);
  expect('request does not exist', await logic.placeBid(999, AISHA, '50', 'I can do a great job'), false, 404);
  // An "open" request whose deadline already passed (the app never creates these, so we insert it directly).
  const expired = await prisma.care_requests.create({
    data: { owner_id: LINA, pet_id: 3, service: 'feeding', service_start: new Date('2030-01-10T10:00'), service_end: new Date('2030-01-10T11:00'), budget: 50, bidding_deadline: new Date('2020-01-01T10:00'), instructions: '', status: 'open' }
  });
  expect('deadline passed', await logic.placeBid(expired.id, AISHA, '50', 'I can do a great job'), false, 400);
  expectTrue('expired request hidden from browse', (await logic.browseRequests({})).items.length === 3);

  console.log('\n=== Edit / withdraw bid ===');
  expect('edit own active bid', await logic.editBid(AISHA, 1, '95', 'Calm one-hour walk with photos'), true);
  expectTrue('edited price saved as a number (DECIMAL 95)', Number((await logic.findBidById(1)).proposed_price) === 95);
  expect("edit someone else's bid", await logic.editBid(AISHA, 2, '1', 'Trying to change Sam bid'), false, 403);
  expect('edit accepted bid', await logic.editBid(AISHA, 4, '10', 'Changing an accepted bid'), false, 400);
  expect('edit with bad price', await logic.editBid(AISHA, 1, 'abc', 'Calm one-hour walk with photos'), false, 400);
  expect('edit missing bid', await logic.editBid(AISHA, 999, '10', 'Calm one-hour walk with photos'), false, 404);
  expect('withdraw own bid', await logic.withdrawBid(AISHA, 1), true);
  expect('withdraw again', await logic.withdrawBid(AISHA, 1), false, 400);
  const rebid = await logic.placeBid(1, AISHA, '90', 'Back again with a calm walk');
  expect('bid again after withdrawing', rebid, true);
  expectTrue('re-bid reuses the same bid (one bid per provider per request)', rebid.ok && rebid.bid.id === 1);

  console.log('\n=== Select winner / complete ===');
  expect("select on someone else's request", await logic.selectWinningBid(UMAR, 4, 5), false, 403);
  expect('select a bid from another request', await logic.selectWinningBid(UMAR, 1, 3), false, 400);
  expect('select on missing request', await logic.selectWinningBid(UMAR, 999, 1), false, 404);
  expect('complete an open request', await logic.completeRequest(UMAR, 1), false, 400);
  expect('select winning bid', await logic.selectWinningBid(UMAR, 1, 2), true);
  const winner = await logic.getWinningBid(1);
  expectTrue('winner accepted, other bid rejected, request closed',
    winner !== null && winner.id === 2 && (await logic.findBidById(1)).status === 'rejected' &&
    (await logic.findRequestById(1)).status === 'closed');
  expect('bid on the now-closed request', await logic.placeBid(1, AISHA, '50', 'Trying after it closed'), false, 400);
  expect('select again', await logic.selectWinningBid(UMAR, 1, 1), false, 400);
  expect('complete request with winner', await logic.completeRequest(UMAR, 1), true);

  console.log('\n=== Reviews ===');
  expect('owner reviews winning provider', await logic.addReview(UMAR, { requestId: '1', rating: '5', comment: 'Great walk' }), true);
  expect('provider reviews owner', await logic.addReview(SAM, { requestId: '1', rating: '4', comment: 'Nice owner' }), true);
  expect('review twice', await logic.addReview(UMAR, { requestId: '1', rating: '3' }), false, 400);
  expect('losing provider reviews', await logic.addReview(AISHA, { requestId: '1', rating: '1' }), false, 403);
  expect('rating 6', await logic.addReview(UMAR, { requestId: '2', rating: '6' }), false, 400);
  expect('review a request that is not completed', await logic.addReview(UMAR, { requestId: '2', rating: '5' }), false, 400);
  const reviews = await logic.getReviewsPage(SAM);
  expectTrue('Sam sees the review about him', reviews.about.length === 1 && reviews.about[0].review.rating === 5);

  console.log('\n=== Request details ===');
  expect('provider opens any request', await logic.getRequestDetails(await logic.findUserById(AISHA), 4), true);
  expect("owner opens someone else's request", await logic.getRequestDetails(await logic.findUserById(UMAR), 4), false, 403);
  expect('missing request', await logic.getRequestDetails(await logic.findUserById(UMAR), 999), false, 404);
  expect('bad id (like /requests/abc)', await logic.getRequestDetails(await logic.findUserById(UMAR), parseInt('abc')), false, 404);
  expectTrue('provider cannot bid twice (canBid false)', (await logic.getRequestDetails(await logic.findUserById(AISHA), 4)).canBid === false);
  expectTrue('provider can bid on a new request (canBid true)', (await logic.getRequestDetails(await logic.findUserById(SAM), 4)).canBid === true);

  console.log('\n=== Dashboards ===');
  const ownerDash = await logic.getOwnerDashboard(UMAR);
  // 1 open = the request created in the "Create request" tests above (nobody picked a winner for it).
  expectTrue('owner dashboard: 3 pets, 1 open, 2 completed',
    ownerDash.pets.length === 3 && ownerDash.openRequests.length === 1 && ownerDash.completedRequests.length === 2);
  const samDash = await logic.getProviderDashboard(SAM);
  expectTrue('Sam: 1 current task (request 2), 1 completed (request 1)',
    samDash.currentTasks.length === 1 && samDash.completedTasks.length === 1);

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
}

// Run the tests, then close both database connections so the script can finish.
runTests().then(async function () {
  await logic.disconnect();
  await prisma.$disconnect();
});
