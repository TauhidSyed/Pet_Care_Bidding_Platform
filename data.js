// TEMPORARY in-memory "database".
// Everything here is lost when the server restarts.
// DB: this whole file gets replaced by Prisma models + a MySQL database later.
//
// Field names match the `name="..."` attributes in the front-end forms where possible,
// so req.body.petName goes straight into pet.petName, etc.
//
// Today's date while writing this: 2026-11-22. Deadlines below are set around that date.

// ---------------- USERS (register.html) ----------------
const users = [
  {
    id: 1,                       // unique number, used to link pets/requests/bids to a user
    userType: 'owner',           // "owner" or "carer" (same values as the radio buttons in register.html)
    username: 'umar_owner',      // must be unique, used to log in
    email: 'umar@example.com',   // must be unique
    password: 'password123',     // PLAIN TEXT FOR NOW. In the login step we switch this to a bcrypt hash.
    providerService: '',         // only for carers: "walking" / "bathing" / "grooming"
    providerExperience: ''       // only for carers: free text, optional
  },
  {
    id: 2,
    userType: 'carer',
    username: 'aisha_k',
    email: 'aisha@example.com',
    password: 'password123',
    providerService: 'walking',
    providerExperience: '3 years walking dogs and cats in Sharjah.'
  },
  {
    id: 3,
    userType: 'carer',
    username: 'sam_r',
    email: 'sam@example.com',
    password: 'password123',
    providerService: 'grooming',
    providerExperience: 'Certified groomer, gentle with nervous pets.'
  }
];

// ---------------- PETS (pets.html) ----------------
const pets = [
  {
    id: 1,                       // unique number (create-request.html sends this as petId)
    ownerId: 1,                  // id of the owner (users[].id) this pet belongs to
    petName: 'Cloud',            // name
    petType: 'cat',              // "cat" / "dog" / "other" (pets.html options)
    petBreed: 'Persian',         // breed, free text
    petAge: 3,                   // age in years (a number, so use parseInt on req.body.petAge)
    petPhoto: 'https://placekitten.com/300/300' // photo URL
  },
  {
    id: 2,
    ownerId: 1,
    petName: 'Rocky',
    petType: 'dog',
    petBreed: 'Golden Retriever',
    petAge: 5,
    petPhoto: 'https://placedog.net/300/300'
  }
];

// ---------------- CARE REQUESTS (create-request.html) ----------------
const requests = [
  {
    id: 1,                            // unique number
    ownerId: 1,                       // who posted it (users[].id)
    petId: 1,                         // which pet (pets[].id)
    service: 'walking',               // "walking" / "bathing" / "grooming"
    startTime: '2026-12-05T09:00',    // when the service starts (datetime-local format)
    endTime: '2026-12-05T10:00',      // when the service ends
    budget: 120,                      // max budget in AED (number)
    deadline: '2026-12-01T18:00',     // bidding deadline: no bids accepted after this
    instructions: 'Cloud gets nervous around big dogs.', // optional care instructions
    tags: 'calm indoor sharjah',      // keywords for the tag search (goes into the card's data-search)
    status: 'open',                   // "open" (taking bids) / "closed" (winner picked or owner closed it) / "completed" (service done)
    winningBidId: null                // bids[].id of the chosen bid, null until the owner picks one
  },
  {
    id: 2,
    ownerId: 1,
    petId: 2,
    service: 'grooming',
    startTime: '2026-11-28T14:00',
    endTime: '2026-11-28T16:00',
    budget: 250,
    deadline: '2026-11-20T18:00',
    instructions: 'Short trim only please.',
    tags: 'trim weekend',
    status: 'closed',
    winningBidId: 3
  },
  {
    id: 3,
    ownerId: 1,
    petId: 2,
    service: 'bathing',
    startTime: '2026-11-15T10:00',
    endTime: '2026-11-15T11:00',
    budget: 100,
    deadline: '2026-11-12T18:00',
    instructions: '',
    tags: 'bath quick',
    status: 'completed',
    winningBidId: 4
  }
];

// ---------------- BIDS (request-details.html, bids.html) ----------------
const bids = [
  {
    id: 1,                         // unique number
    requestId: 1,                  // which request this bid is for (requests[].id)
    carerId: 2,                    // which provider made it (users[].id)
    bidPrice: 100,                 // price in AED (number)
    bidDescription: 'I can provide a calm one-hour walk.', // what the provider offers
    status: 'pending'              // "pending" / "accepted" / "rejected" / "withdrawn"
  },
  {
    id: 2,
    requestId: 1,
    carerId: 3,
    bidPrice: 110,
    bidDescription: 'I have experience walking cats safely.',
    status: 'pending'
  },
  {
    id: 3,
    requestId: 2,
    carerId: 3,
    bidPrice: 220,
    bidDescription: 'I use gentle shampoo and work carefully.',
    status: 'accepted'
  },
  {
    id: 4,
    requestId: 3,
    carerId: 2,
    bidPrice: 90,
    bidDescription: 'Quick and gentle bath.',
    status: 'accepted'
  }
];

// ---------------- REVIEWS (reviews.html) ----------------
const reviews = [
  {
    id: 1,                         // unique number
    requestId: 3,                  // the completed request being reviewed (requests[].id)
    reviewerId: 1,                 // who wrote it (users[].id)
    revieweeId: 2,                 // who it is about (users[].id)
    rating: 5,                     // 1 to 5 (number)
    comment: 'Rocky came back clean and happy.' // free text
  },
  {
    id: 2,
    requestId: 3,
    reviewerId: 2,
    revieweeId: 1,
    rating: 4,
    comment: 'Friendly owner, clear instructions.'
  }
];

// Makes the arrays available in server.js via: const data = require('./data');
module.exports = { users, pets, requests, bids, reviews };
