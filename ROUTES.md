# Route Plan (confirmed, all built)

"Who" is checked by middleware in `server.js`:
- **everyone**: no check
- **logged in**: `authentication` (not logged in → redirect to `/login.html`)
- **owner**: `ownerOnly` (not logged in → login page; provider → 403)
- **provider**: `carerOnly` (not logged in → login page; owner → 403)

## Pages (GET)

| Page/Action | URL | GET/POST | Who can use it | Status |
|---|---|---|---|---|
| Landing page | `/` (index.html) | GET | everyone | done (static) |
| Register page | `/register.html` (`?role=owner` / `?role=carer` pre-selects the radio) | GET | everyone | done (static) |
| Login page | `/login.html` | GET | everyone | done (static) |
| Logged-out page | `/logged-out.html` | GET | everyone | done (static) |
| Owner dashboard | `/owner-dashboard` | GET | owner | done |
| Provider dashboard | `/provider-dashboard` | GET | provider | done |
| Pets list + add form | `/pets` | GET | owner | done |
| Create request form (pet dropdown from my pets) | `/create-request` | GET | owner | done |
| My requests + bids on them | `/owner-requests` | GET | owner | done |
| Browse open requests (filters + tag search via `?search=&petType=&service=&maxBudget=`) | `/browse-requests` | GET | provider | done |
| Request details (+ bid form for providers) | `/requests/:id` | GET | logged in (owners: only their own) | done |
| My bids | `/bids` | GET | provider | done |
| Reviews | `/reviews` | GET | logged in | done |

## Forms and actions

| Page/Action | URL | GET/POST | Who can use it | Status |
|---|---|---|---|---|
| Register | `/register` | POST | everyone | done |
| Login | `/login` | POST | everyone | done |
| Logout | `/logout` | GET | everyone | done |
| Add pet | `/pets` | POST | owner | done |
| Create request | `/requests` | POST | owner | done |
| Select winning bid | `/requests/:id/select-bid` | POST | owner (own request) | done |
| Mark request completed | `/requests/:id/complete` | POST | owner (own request) | done |
| Submit bid | `/requests/:id/bids` | POST | provider | done |
| Edit bid | `/bids/:id/edit` | POST | provider (own bid) | done |
| Withdraw bid | `/bids/:id/withdraw` | POST | provider (own bid) | done |
| Leave review | `/reviews` | POST | owner or winning provider of a completed request | done |
| Anything else | any | any | everyone | 404 page |

Why POST for edit/withdraw instead of PUT/DELETE: a plain HTML `<form>` can only send GET or POST.

## Form field names (what arrives in `req.body` / `req.query`)

| Form | Fields |
|---|---|
| register | `userType` (owner/carer), `username`, `email`, `password`, `confirmPassword`, `providerService`, `providerExperience` |
| login | `username`, `password` (**login.html still needs the `name`s, see FRONTEND_CHANGES.md**) |
| pets | `petName`, `petType`, `petBreed`, `petAge`, `petPhoto` |
| create-request | `petId`, `service`, `startTime`, `endTime`, `budget`, `deadline`, `instructions`, `tags` |
| bid / edit bid | `bidPrice`, `bidDescription` |
| select winner | `winningBidId` |
| review | `requestId`, `rating`, `comment` |
| browse filters (query string) | `search`, `petType`, `service`, `maxBudget` |

## Status rules

- Request: `open` → `closed` (the owner picked a winner; this is the only way to close a request) → `completed`.
- An open request whose deadline has passed takes no more bids and disappears from Browse, but the owner can still pick a winner from the bids it got.
- Bid: `active` → `accepted` / `rejected` (when the owner picks) or `withdrawn` (by the provider).
- The winner of a request is its `accepted` bid (there is no separate winner column).
- Bids can be placed, edited or withdrawn only while the request is `open` **and** before its `bidding_deadline`.

## Front-end changes

See **FRONTEND_CHANGES.md**.

## Database (Prisma 6 + MySQL)

All database code is in `logic.js`, using the tables from `pet_care_schema.sql` with no changes to the schema. The code uses the schema's column names directly. Form field names (left) are copied into these columns (right):

| Form field (`req.body`) | Database column |
|---|---|
| `userType` | `users.role` |
| `password` (hashed with bcrypt) | `users.password_hash` |
| `providerService`, `providerExperience` | `users.provider_service`, `users.provider_experience` |
| `petName`, `petType`, `petBreed`, `petAge`, `petPhoto` | `pets.name`, `pets.pet_type`, `pets.breed`, `pets.age_years`, `pets.photo_url` |
| `startTime`, `endTime`, `deadline` | `care_requests.service_start`, `service_end`, `bidding_deadline` |
| `tags` (space-separated) | one row per tag in `request_tags` |
| `bidPrice`, `bidDescription` | `bids.proposed_price`, `bids.description` |
| `requestId`, `rating`, `comment` | `reviews.request_id`, `rating`, `comment` (`reviewee_id` is worked out automatically) |

- Re-bidding after a withdraw reuses the same bid row, so `UNIQUE (request_id, provider_id)` is respected.
- Request statuses `assigned` and `cancelled` exist in the schema but the app doesn't use them.

## Running the backend on a fresh computer

1. Install Node.js and MySQL 8, and make sure the MySQL service is running.
2. `npm install`
3. Copy `.env.example` to `.env` and put your MySQL username and password in `DATABASE_URL`. `.env` is gitignored, so never commit it.
4. Create the database: `mysql -u root -p < pet_care_schema.sql`
5. `npx prisma generate` (builds the Prisma client from `prisma/schema.prisma`)
6. `npm run seed` loads the sample data. **This deletes everything in the database first.**
7. `npm start`, then open http://127.0.0.1:3000/. Sample logins: `umar_owner`, `lina_owner`, `aisha_k`, `sam_r`, all with password `password123`.

`npm test` reseeds the database and runs the logic tests.

If `pet_care_schema.sql` changes: rerun it, then `npx prisma db pull` and `npx prisma generate`.
