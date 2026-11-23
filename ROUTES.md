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
| Close request | `/requests/:id/close` | POST | owner (own request) | done |
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

- Request: `open` → `closed` (winner picked, or owner closed it) → `completed` (only if there is a winner).
- Bid: `pending` → `accepted` / `rejected` (when the owner picks) or `withdrawn` (by the provider).
- Bids can be placed, edited or withdrawn only while the request is `open` **and** before its `deadline`.

## Front-end changes

See **FRONTEND_CHANGES.md**.

## Notes for the DB teammate (data.js vs pet_care_schema.sql)

Every array read and write in `logic.js` is marked `// DB: replace with prisma call (...)`. Some names differ between `data.js` and the SQL schema:

| data.js | schema | Note |
|---|---|---|
| `userType` | `role` | same values (owner/carer) |
| `password` (holds the bcrypt hash) | `password_hash` | |
| `petName`, `petBreed`, `petAge`, `petPhoto` | `name`, `breed`, `age_years`, `photo_url` | |
| `startTime`, `endTime`, `deadline` | `service_start`, `service_end`, `bidding_deadline` | |
| `winningBidId` on requests | **missing** | add a nullable `winning_bid_id`, or find the bid with status `accepted` |
| `tags` (one space-separated string) | `request_tags` table | split on spaces when saving |
| `carerId`, `bidPrice`, `bidDescription` | `provider_id`, `proposed_price`, `description` | |
| bid status `pending` | `active` | rename one side. Schema also has request statuses `assigned` / `cancelled` that the app doesn't use |

Re-bidding after a withdraw reuses the same bid row, so the schema's `UNIQUE (request_id, provider_id)` is respected.
