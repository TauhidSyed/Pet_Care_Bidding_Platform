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
