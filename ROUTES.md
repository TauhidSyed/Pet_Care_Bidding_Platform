# Route Plan (DRAFT: Umar to confirm)

Built from reading every HTML file. URLs for the POST routes are **proposals**: change them as you like, then tick "Confirmed".

## Pages (GET)

| Page/Action | URL | GET/POST | Who can use it | Status | Confirmed |
|---|---|---|---|---|---|
| Landing page | `/` (index.html) | GET | everyone | static, done | ☐ |
| Register page | `/register.html` (`?role=owner` / `?role=carer` pre-selects the radio) | GET | everyone | static, done | ☐ |
| Login page | `/login.html` | GET | everyone | static, done | ☐ |
| Logged-out page | `/logged-out.html` | GET | everyone | static, done | ☐ |
| Owner dashboard | `/owner-dashboard` | GET | owner | todo | ☐ |
| Provider dashboard | `/provider-dashboard` | GET | provider | todo | ☐ |
| Pets list + add form | `/pets` | GET | owner | todo | ☐ |
| Create request form (pet dropdown from my pets) | `/create-request` | GET | owner | todo | ☐ |
| My requests + bids on them | `/owner-requests` | GET | owner | todo | ☐ |
| Browse open requests (filters + tag search) | `/browse-requests` | GET | provider | todo | ☐ |
| Request details (+ bid form for providers) | `/requests/:id` | GET | owner (own) / provider | todo | ☐ |
| My bids | `/bids` | GET | provider | todo | ☐ |
| Reviews | `/reviews` | GET | owner / provider | todo | ☐ |

## Forms and actions

| Page/Action | URL | GET/POST | Who can use it | Status | Confirmed |
|---|---|---|---|---|---|
| Register (register.html `#register-form`) | `/register` | POST | everyone | todo | ☐ |
| Login (login.html `#login-form`) | `/login` | POST | everyone | todo | ☐ |
| Logout (dashboard `#logout-btn`, "Log Out" links) | `/logout` | GET | owner / provider | todo | ☐ |
| Add pet (pets.html `#pet-form`) | `/pets` | POST | owner | todo | ☐ |
| Create request (create-request.html `#create-request-form`) | `/requests` | POST | owner | todo | ☐ |
| Select winning bid (owner-requests.html `#choose-provider-form`) | `/requests/:id/select-bid` | POST | owner | todo | ☐ |
| Close request (owner-requests.html `#close-owner-request`) | `/requests/:id/close` | POST | owner | todo | ☐ |
| Mark request completed (**no button exists yet**) | `/requests/:id/complete` | POST | owner | todo | ☐ |
| Submit bid (request-details.html `#bid-form`) | `/requests/:id/bids` | POST | provider | todo | ☐ |
| Edit bid (bids.html `.bid-edit-form`) | `/bids/:id/edit` | POST | provider | todo | ☐ |
| Withdraw bid (bids.html `.withdraw-bid`) | `/bids/:id/withdraw` | POST | provider | todo | ☐ |
| Leave review (reviews.html `#review-form`) | `/reviews` | POST | owner / provider | todo | ☐ |

Why POST for edit/withdraw instead of PUT/DELETE: a plain HTML `<form>` can only send GET or POST.
PUT/DELETE would need `fetch()` in script.js.

## Form field names (what will arrive in `req.body`)

| Form | Fields |
|---|---|
| register | `userType` (owner/carer), `username`, `email`, `password`, `confirmPassword`, `providerService`, `providerExperience` |
| login | **none yet**: inputs have `id` but no `name` |
| pets | `petName`, `petType`, `petBreed`, `petAge`, `petPhoto` |
| create-request | `petId`, `service`, `startTime`, `endTime`, `budget`, `deadline`, `instructions` |
| bid | `bidPrice`, `bidDescription` |
| bid edit | **none yet** (no `name` attributes) |
| choose provider | **none yet** (`#winning-provider` has no `name`) |
| review | **none yet** (`#review-service`, `#review-rating`, `#review-comment` have no `name`) |

## Front-end changes needed (coordinate with teammates, do NOT edit yourself)

1. **No form actually submits.** Every form has no `action`/`method`, and script.js calls `preventDefault()` on all of them. Each form needs `action="..." method="POST"`, and script.js should only call `preventDefault()` when validation **fails**.
2. **Missing `name` attributes**: login inputs, bid edit form, `#winning-provider`, all review fields. Without `name`, the value never reaches `req.body`.
3. Register password input is `type="text"` (shows the password). It should be `type="password"`.
4. **Option values don't match between pages**: browse filter has `feeding`, `bird` and `rabbit`, but create-request/pets only offer walking/bathing/grooming and cat/dog/other. Pick one list.
5. No "mark as completed" button exists for owners, so there's no way to move a request to `completed`.
6. `browse-requests.html` is in `public/`, but only providers should browse. Decide: keep it public, or move it behind login.
7. Pages link to `*.html` (e.g. `href="pets.html"`). Once the server builds those pages, links should point at the routes (`/pets`, `/requests/1`, ...).
