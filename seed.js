/*
  seed.js  -  PUTS SAMPLE DATA INTO THE DATABASE
  ----------------------------------------------------------------------
  Run with:  node seed.js   (or: npm run seed)
  WARNING: it first DELETES everything in the database, then adds the sample data again.
  So it's for development/testing only, never for real users.

  It adds the same sample data our old data.js had:
    users:    1 umar_owner (owner), 2 aisha_k (carer), 3 sam_r (carer), 4 lina_owner (owner)
              -> all with the password: password123 (saved as a bcrypt hash)
    pets:     1 Cloud (umar), 2 Rocky (umar), 3 Kiwi (lina)
    requests: 1 open (umar), 2 closed with winner Sam (umar), 3 completed with Aisha (umar), 4 open (lina)
    bids, reviews and tags to match.
  We give each row a fixed id (1, 2, 3...) so test.js knows which id is which.

  Dates are calculated from TODAY (e.g. "deadline in 8 days"), so the sample
  deadlines never expire and the tests keep working whenever you run them.
*/

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000; // one day in milliseconds

// at(days, hour): a Date `days` from today (negative = in the past) at `hour`:00.
// e.g. at(8, 18) = 8 days from now at 6 PM.
function at(days, hour) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return new Date(date.getTime() + days * DAY);
}

async function main() {
  // 1. Empty the database.
  // Every table has "ON DELETE CASCADE" on its link to users, so deleting a user also
  // deletes their pets, requests, bids, reviews and tags. So we only need to delete users.
  // findMany({}) = SELECT * FROM users;  delete({ where: { id } }) = DELETE FROM users WHERE id = ?
  const oldUsers = await prisma.users.findMany({});
  for (let i = 0; i < oldUsers.length; i++) {
    await prisma.users.delete({ where: { id: oldUsers[i].id } });
  }

  // 2. Users. create({ data }) = INSERT INTO users (...) VALUES (...)
  const hash = bcrypt.hashSync('password123', 10);
  const users = [
    { id: 1, username: 'umar_owner', email: 'umar@example.com', password_hash: hash, role: 'owner', provider_service: null, provider_experience: null },
    { id: 2, username: 'aisha_k', email: 'aisha@example.com', password_hash: hash, role: 'carer', provider_service: 'walking', provider_experience: '3 years walking dogs and cats in Sharjah.' },
    { id: 3, username: 'sam_r', email: 'sam@example.com', password_hash: hash, role: 'carer', provider_service: 'grooming', provider_experience: 'Certified groomer, gentle with nervous pets.' },
    { id: 4, username: 'lina_owner', email: 'lina@example.com', password_hash: hash, role: 'owner', provider_service: null, provider_experience: null }
  ];
  for (let i = 0; i < users.length; i++) {
    await prisma.users.create({ data: users[i] });
  }

  // 3. Pets
  const pets = [
    { id: 1, owner_id: 1, name: 'Cloud', pet_type: 'cat', breed: 'Persian', age_years: 3, photo_url: 'https://placekitten.com/300/300' },
    { id: 2, owner_id: 1, name: 'Rocky', pet_type: 'dog', breed: 'Golden Retriever', age_years: 5, photo_url: 'https://placedog.net/300/300' },
    { id: 3, owner_id: 4, name: 'Kiwi', pet_type: 'other', breed: 'Budgie', age_years: 1, photo_url: 'https://example.com/kiwi.jpg' }
  ];
  for (let i = 0; i < pets.length; i++) {
    await prisma.pets.create({ data: pets[i] });
  }

  // 4. Care requests (the DB requires: deadline < start < end, budget > 0)
  const requests = [
    { id: 1, owner_id: 1, pet_id: 1, service: 'walking', service_start: at(12, 9), service_end: at(12, 10), budget: 120, bidding_deadline: at(8, 18), instructions: 'Cloud gets nervous around big dogs.', status: 'open' },
    { id: 2, owner_id: 1, pet_id: 2, service: 'grooming', service_start: at(5, 14), service_end: at(5, 16), budget: 250, bidding_deadline: at(-3, 18), instructions: 'Short trim only please.', status: 'closed' },
    { id: 3, owner_id: 1, pet_id: 2, service: 'bathing', service_start: at(-8, 10), service_end: at(-8, 11), budget: 100, bidding_deadline: at(-11, 18), instructions: '', status: 'completed' },
    { id: 4, owner_id: 4, pet_id: 3, service: 'feeding', service_start: at(17, 8), service_end: at(17, 9), budget: 60, bidding_deadline: at(15, 18), instructions: 'Seeds in the blue jar, fresh water daily.', status: 'open' }
  ];
  for (let i = 0; i < requests.length; i++) {
    await prisma.care_requests.create({ data: requests[i] });
  }

  // 5. Tags (one row per tag, in the request_tags table)
  const tags = [
    { request_id: 1, tag: 'calm' }, { request_id: 1, tag: 'indoor' }, { request_id: 1, tag: 'sharjah' },
    { request_id: 2, tag: 'trim' }, { request_id: 2, tag: 'weekend' },
    { request_id: 3, tag: 'bath' }, { request_id: 3, tag: 'quick' },
    { request_id: 4, tag: 'bird' }, { request_id: 4, tag: 'budgie' }, { request_id: 4, tag: 'dubai' }
  ];
  for (let i = 0; i < tags.length; i++) {
    await prisma.request_tags.create({ data: tags[i] });
  }

  // 6. Bids (status "active" = waiting for the owner's decision)
  const bids = [
    { id: 1, request_id: 1, provider_id: 2, proposed_price: 100, description: 'I can provide a calm one-hour walk.', status: 'active' },
    { id: 2, request_id: 1, provider_id: 3, proposed_price: 110, description: 'I have experience walking cats safely.', status: 'active' },
    { id: 3, request_id: 2, provider_id: 3, proposed_price: 220, description: 'I use gentle shampoo and work carefully.', status: 'accepted' },
    { id: 4, request_id: 3, provider_id: 2, proposed_price: 90, description: 'Quick and gentle bath.', status: 'accepted' }
  ];
  for (let i = 0; i < bids.length; i++) {
    await prisma.bids.create({ data: bids[i] });
  }

  // 7. Reviews (both sides of the completed request 3)
  const reviews = [
    { id: 1, request_id: 3, reviewer_id: 1, reviewee_id: 2, rating: 5, comment: 'Rocky came back clean and happy.' },
    { id: 2, request_id: 3, reviewer_id: 2, reviewee_id: 1, rating: 4, comment: 'Friendly owner, clear instructions.' }
  ];
  for (let i = 0; i < reviews.length; i++) {
    await prisma.reviews.create({ data: reviews[i] });
  }

  console.log('Seeded: ' + users.length + ' users, ' + pets.length + ' pets, ' + requests.length + ' requests, ' +
    tags.length + ' tags, ' + bids.length + ' bids, ' + reviews.length + ' reviews.');
}

// Run main(), then close the database connection so the script can exit.
// $disconnect() isn't in the lecture list, but without it Node keeps the connection open.
main().then(function () {
  return prisma.$disconnect();
});
