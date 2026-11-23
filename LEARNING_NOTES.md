# Learning Notes (Umar, backend)

One short entry per step. **Understand** = be able to explain it and change it in the one-on-one. **Memorize** = know the exact syntax by heart.

---

## Step 0: Setup (done by Claude)

**What was done**
- New branch `umar-backend`, so `Main` stays untouched until we merge.
- `express.urlencoded({ extended: true })`: this middleware turns submitted form data into `req.body`. `extended: true` uses the `qs` parser, which also handles nested names like `pet[name]`. Express 5 switched the default to `false`, and the slides use `true`, so we write it out explicitly.
- `data.js`: temporary arrays (`users`, `pets`, `requests`, `bids`, `reviews`) exported with `module.exports`, loaded in server.js with `require('./data')`. Data resets every time the server restarts. That's expected until the DB teammate adds Prisma.
- `server.js` split into sections: setup → data → auth → public → owner → provider → shared → 404. **Order matters**: Express checks `app.use`/`app.get` from top to bottom, so the 404 handler must stay last.
- `ROUTES.md`: the plan of every URL, its method, and who can use it.

**Key ideas**
- Records link to each other by id (`pet.ownerId` → `user.id`, `bid.requestId` → `request.id`). Prisma/SQL will use the same idea (foreign keys).
- Request status flow: `open` → `closed` (winner picked / owner closed) → `completed`. Bids are only allowed while `open` **and** before `deadline`.

**Understand vs memorize**
- Understand: why middleware order matters, why `extended: true`, how ids link the arrays.
- Memorize: `app.use(express.urlencoded({ extended: true }))`, `module.exports = {...}` / `require('./file')`.

---

## How the backend is organised (read this first)

| File | Job |
|---|---|
| `server.js` | Routes only: read `req.body` / `req.params` / `req.query` → call a `logic.js` function → send a redirect, a page, or an error with a status code. |
| `logic.js` | All the rules, as plain functions. Every function returns `{ ok: true, ... }` or `{ ok: false, status, error }`. No Express in here. |
| `pages.js` | Builds the HTML pages as strings with for loops (Lecture 15/16 style). |
| `data.js` | The temporary arrays (the "database"). |
| `test.js` | Calls the `logic.js` functions with good and bad inputs. Run it with `node test.js`. |

**Why split it like this:** each file has one job. `test.js` can test every rule without a browser. The DB teammate only has to change `logic.js`, because it's the only file that touches the arrays.

**Status codes we use:** 400 = bad input or not allowed right now. 401 = wrong login. 403 = logged in, but not yours or the wrong role. 404 = doesn't exist. 302 = redirect (after every successful POST).

- **Understand:** the request → logic → response flow. You should be able to follow any route through all three files.
- **Memorize:** the 5 status codes and what each one means.

---

## Register (`POST /register` → `logic.registerUser`)

- `server.js` passes `req.body` to `registerUser`. It checks the **same rules as script.js**: role, provider service, username ≥ 3, valid email, password ≥ 8, and the two passwords match. We check again on the server because anyone can turn off JavaScript or send a request without our form.
- Username and email must be unique, so we loop over `users` to look for them.
- The password is saved as a **bcrypt hash** (`bcrypt.hashSync(password, 10)`), never as plain text.
- Success → redirect to the login page. Errors → 400 + one error page that lists all the problems.
- **Understand:** why the server validates again, and why we hash. **Memorize:** nothing. Be ready to walk through the checks.

## Login, sessions, logout (`POST /login`, `GET /logout`)

- `loginUser` finds the user and runs `bcrypt.compareSync(typed, savedHash)`. It gives the same "Wrong username or password" message for both cases, so attackers can't find out which usernames exist.
- **express-session (exception):** HTTP forgets you between requests. The session gives your browser a cookie holding an id, and the server keeps `req.session` for that id. After login we store `req.session.userId` and `req.session.userType`.
- Owners are redirected to `/owner-dashboard`, providers to `/provider-dashboard`.
- Logout: `req.session.destroy(...)` deletes the session on the server, then redirects to `/logged-out.html`.
- **Understand:** what a session and a cookie are, and what hashing is (one-way scramble). **Memorize:** `req.session.userId = ...` and `req.session.destroy(function () { res.redirect(...) })`.

## Auth middleware (`authentication`, `ownerOnly`, `carerOnly`)

- A middleware is `function (req, res, next)`. It either stops the request (redirect, or 403) or calls `next()` to continue to the route.
- Used like `app.get('/pets', ownerOnly, function (req, res) {...})`.
- Not logged in → `/login.html`. Wrong role → 403.
- **"Only your own stuff"** is checked in `logic.js`: e.g. `request.ownerId !== ownerId` gives 403. The user's id always comes from **the session, never from the form**, so nobody can pretend to be someone else.
- **Understand:** the difference between the role check (middleware) and the ownership check (logic). **Memorize:** the shape `function (req, res, next) { if (...) { return res.redirect(...) } next(); }`.

## Owner features

- **Add pet** (`addPet`): name ≥ 2, type cat/dog/other, breed required, age a whole number ≥ 0, photo starts with `http://` or `https://` (this blocks `javascript:` tricks in `<img src>`).
- **Create request** (`createRequest`): the pet must be *yours*. Start must be before end, budget > 0, and the deadline must be in the future **and** before the start. A new request starts with `status: 'open'` and `winningBidId: null`. Optional `tags` power the tag search.
- **Select winner** (`selectWinningBid`): the request must be yours and `open`, and the bid must be `pending` and on this request. Then: chosen bid → `accepted`, other pending bids → `rejected`, request → `closed`, `winningBidId` set.
- **Close** (`closeRequest`): open → closed with no winner, and pending bids → rejected.
- **Complete** (`completeRequest`): only allowed when the request is `closed` **with** a winner. This unlocks reviews.
- **Understand:** the status flow `open → closed → completed`, and why each check exists. **Memorize:** the order of the date rules (now < deadline < start < end).

## Provider features

- **Browse** (`browseRequests`): shows only requests that are `open` and before their deadline. The filters come from `req.query` (`search`, `petType`, `service`, `maxBudget`). The search checks pet info, instructions **and tags** (extra feature 2), in lowercase. The page also keeps the `data-*` attributes, so script.js can still filter live as you type.
- **Place bid** (`placeBid`): the request must exist and be `open`, before the deadline, price > 0, description ≥ 10 characters, and you can't already have a bid there. If your old bid was withdrawn, we **reuse** it, because the DB allows only one bid per provider per request.
- **Edit / withdraw** (`editBid`, `withdrawBid`): both use `checkBidCanChange`. The bid must be yours (403), `pending`, and its request still open and before the deadline. Withdraw sets the status to `withdrawn` instead of deleting the bid.
- **Understand:** how "blocking bids after close" works (the two checks at the top of `placeBid`). **Memorize:** nothing.

## Reviews

- `addReview`: the request must be `completed`. You must be its owner or its **winning** provider (403 otherwise). Rating is a whole number 1–5, and each person can review a request only once. The reviewee is worked out automatically as "the other person".
- `/reviews` shows reviews about you, reviews you wrote, and a form listing only the completed services you haven't reviewed yet.
- **Understand:** how `getReviewPartner` finds the other person.

## Dashboards

- **Owner:** your pets, plus your requests split by status (open / active (closed with a winner) / completed).
- **Provider:** current tasks = your accepted bids on closed requests. Active bids = your pending bids on open requests. Completed = your accepted bids on completed requests.
- **Understand:** that dashboards are just loops sorting the same data into groups.

## Building pages (`pages.js`)

- Each page is one string built with `+=` inside for loops, then `res.send(html)`, like Lectures 15/16.
- **`escapeHtml`** is used on everything a user typed. Without it, someone could save `<script>` as a pet name and it would run in other people's browsers (XSS).
- We reuse the teammates' ids (`#pet-form`, `#bid-form`, ...) so script.js validation still works, and their Bootstrap classes so the pages look the same.
- **Understand:** why we escape. **Memorize:** nothing.

## What is NOT from the lectures (and why)

| Thing | Why we needed it |
|---|---|
| `express-session` | The lectures have no way to remember who is logged in between requests. |
| `bcrypt` | Passwords must never be stored as plain text. |
| Our own middleware `(req, res, next)` | The same login/role check on ~20 routes; writing it once means we can't forget it. |
| `module.exports` | So `server.js` and `test.js` can use the functions in `logic.js` and `pages.js`. |
| `.trim()`, `.toLowerCase()`, `.includes()` | Small string helpers. All of them are already used in script.js. |
