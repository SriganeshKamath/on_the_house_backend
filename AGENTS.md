# On the House Backend — Codex Development Instructions

## 1. Project

This repository contains the backend for **On the House**, a real-time multiplayer 90-ball Housie/Tambola game.

The backend must be production-oriented, secure, maintainable, testable, and designed for real-time multiplayer gameplay.

The backend stack is:

* Node.js
* Express.js
* Socket.IO
* Prisma
* PostgreSQL
* Zod
* JWT
* bcrypt
* Vitest

---

# 2. Source of Truth

The `docs/` directory contains the functional specification for the game.

Before implementing or modifying game functionality, read and understand the relevant documents in `docs/`.

Current specification documents:

* `docs/game-rules.md`
* `docs/game-lifecycle.md`
* `docs/ticket-rules.md`
* `docs/prize-rules.md`
* `docs/domain-model.md`

These documents are the authoritative source for game behavior.

Do not invent game rules that contradict these documents.

If the specification contains an ambiguity, contradiction, or missing rule that materially affects implementation, STOP and report the issue instead of silently making a product decision.

Do not guess.

---

# 3. Architecture

Use a clean layered backend architecture.

The project should separate:

```text
Routes
    ↓
Controllers / Socket Handlers
    ↓
Services
    ↓
Domain / Evaluation Logic
    ↓
Repositories
    ↓
Prisma
    ↓
PostgreSQL
```

Responsibilities:

### Routes

Define HTTP endpoints and attach middleware.

Routes must not contain business logic.

### Controllers

Handle HTTP concerns:

* Request parsing.
* Authentication context.
* Calling services.
* Returning responses.

Controllers must remain thin.

### Socket Handlers

Handle real-time events.

Socket handlers must remain thin and delegate business operations to services.

Do not put game rules directly inside Socket.IO event handlers.

### Services

Contain application/business workflows.

Examples:

* Authentication.
* Lobby creation/joining.
* Game initialization.
* Number marking.
* Prize claiming.
* Game completion.

Services may coordinate repositories and domain/evaluation components.

### Repositories

Repositories are the persistence abstraction over Prisma.

Repositories should contain database access logic.

Repositories must not contain high-level game rules.

### Evaluation / Domain Logic

Game-specific deterministic rules belong here.

Examples:

* Ticket validation.
* Row completion.
* Star evaluation.
* Full House evaluation.
* Prize eligibility.
* House to Follow calculations.

Evaluation functions should be deterministic and independently testable whenever possible.

### Utilities

Utilities should contain generic reusable helpers only.

Do not put domain-specific game rules in generic utilities.

---

# 4. Server Authority

The server is the authoritative source of truth.

Never trust the client for:

* Ticket contents.
* Ticket marking state.
* Called numbers.
* Prize completion.
* Prize eligibility.
* Prize points.
* Scores.
* Game status.
* Player status.
* Winner determination.
* Game completion.

Clients request actions.

The server validates and decides whether the action is valid.

---

# 5. Security

Treat all client input as untrusted.

Validate:

* HTTP request bodies.
* Query parameters.
* Route parameters.
* Socket event payloads.
* Authentication state.
* Authorization.
* Game/player ownership.

Use Zod or equivalent validation at appropriate boundaries.

Never trust IDs, roles, player status, prize type, score, points, ticket state, or game state supplied by the client.

Do not expose sensitive information.

Passwords must never be stored in plaintext.

Use bcrypt for password hashing.

JWT authentication must be implemented securely.

Use Helmet and appropriate CORS configuration.

Do not hardcode secrets.

Use environment variables.

---

# 6. Multiplayer Safety

This is a real-time multiplayer game.

Assume multiple clients can send requests simultaneously.

Particularly important:

* Prize claims.
* Row claims.
* Full House claims.
* House to Follow claims.
* Game state transitions.

Operations that modify multiple pieces of authoritative state must be atomic.

Use PostgreSQL transactions and appropriate database constraints where necessary.

Do not rely solely on JavaScript checks for invariants that PostgreSQL can enforce.

Race conditions must be considered explicitly.

---

# 7. Game State

The server must control game lifecycle transitions.

Do not allow arbitrary state changes from client requests.

Validate the current state before every state-dependent operation.

Examples:

```text
WAITING → STARTING → IN_PROGRESS → FINISHED
```

Invalid transitions must be rejected.

---

# 8. Real-Time Architecture

Use Socket.IO for real-time game communication.

Use REST for resource-oriented operations.

REST examples:

* Authentication.
* Lobby creation.
* Lobby retrieval.
* Game retrieval.
* Results/history.

Socket.IO examples:

* Player joined.
* Player left.
* Game started.
* Number called.
* Number marked.
* Prize claimed.
* Player became spectator.
* Game finished.

Socket.IO events must not bypass service/domain logic.

---

# 9. Database

Use PostgreSQL through Prisma.

The Prisma schema must be derived from the domain specification.

Do not introduce unnecessary tables or fields.

Use:

* Foreign keys.
* Appropriate unique constraints.
* Appropriate indexes.
* Transactions.
* Enums where appropriate.

Database constraints should reinforce important domain invariants.

Never manually modify an already-applied migration.

If a schema change is required, create a new migration.

---

# 10. Error Handling

Implement centralized error handling.

Errors should be:

* Consistent.
* Safe.
* Meaningful to clients.
* Useful for developers.
* Free of sensitive information.

Do not expose:

* Stack traces in production.
* Database internals.
* SQL queries.
* Secrets.
* Password hashes.
* Internal filesystem paths.

Use appropriate HTTP status codes.

Socket errors should use a consistent error format.

---

# 11. Logging

Implement structured, useful server logging.

Do not log:

* Passwords.
* JWTs.
* Secrets.
* Sensitive authentication data.

Log important game events when useful for debugging and auditing.

Examples:

* Game created.
* Game started.
* Number called.
* Prize claimed.
* Game finished.

Avoid excessive logging inside tight game loops.

---

# 12. Testing

Testing is required.

At minimum, write tests for:

### Unit tests

* Ticket generation.
* Ticket validation.
* Row evaluation.
* Star evaluation.
* Full House evaluation.
* Prize eligibility.
* House to Follow point calculation.
* Game state transitions.

### Integration tests

* Authentication.
* Lobby creation.
* Lobby joining.
* Game creation.
* Game initialization.
* Prize claiming.
* Database transactions.

### Multiplayer/race-condition tests

Where practical, test simultaneous prize claims and ensure only valid winners are recorded.

Do not consider a feature complete merely because the implementation compiles.

---

# 13. Code Quality

Prefer:

* Small functions.
* Single responsibility.
* Explicit naming.
* Early validation.
* Deterministic domain functions.
* Clear service boundaries.
* Reusable repository methods.
* Strong error handling.
* Consistent response structures.

Avoid:

* God classes.
* God services.
* Huge controllers.
* Business logic inside routes.
* Business logic inside Socket.IO handlers.
* Duplicate validation logic.
* Hidden global state.
* Magic numbers.
* Hardcoded configuration.

---

# 14. Configuration

Keep configuration in the `config/` layer.

Environment-specific values must come from environment variables.

Provide:

```text
.env.example
```

Never commit real secrets.

Validate required environment variables when the application starts.

---

# 15. Game Engine

The game engine is responsible for coordinating gameplay.

It should not become a giant file containing every game rule.

Keep responsibilities separated:

```text
Game Engine
    ↓
Number Caller
    ↓
Ticket / Game Evaluation
    ↓
Prize Service
```

The game engine coordinates.

Evaluation modules decide whether conditions are satisfied.

Services coordinate business operations.

Repositories persist data.

---

# 16. Evaluation Functions

Evaluation functions should preferably be pure/deterministic.

For example:

```text
isRowComplete(ticket, calledNumbers)
isFullHouseComplete(ticket, calledNumbers)
isStarComplete(ticket, calledNumbers)
isEligibleForPrize(playerState, prizeState)
getHouseToFollowPoints(sequence)
```

They should not:

* Send HTTP responses.
* Emit Socket.IO events.
* Directly access Prisma.
* Mutate unrelated application state.

This makes them easy to test.

---

# 17. Do Not Over-Engineer

Use the simplest architecture that satisfies the requirements.

Do not introduce Redis, Kafka, RabbitMQ, BullMQ, microservices, GraphQL, Kubernetes, or other infrastructure unless the actual requirements justify them.

The initial architecture should be a well-structured modular monolith.

---

# 18. Development Process

Do not attempt to implement the entire backend in one uncontrolled change.

Work incrementally.

For every phase:

1. Read the relevant documentation.
2. Inspect the existing repository.
3. Identify dependencies.
4. Implement the smallest coherent change.
5. Run tests.
6. Run lint/type/static checks if configured.
7. Verify database migrations.
8. Review security implications.
9. Review race conditions.
10. Summarize what changed.

Do not modify unrelated code.

---

# 19. Specification Changes

If implementation reveals that the specification is incomplete or contradictory:

STOP.

Explain:

1. Which document contains the ambiguity.
2. What the conflicting interpretations are.
3. What implementation decisions are blocked.
4. What decision is required.

Do not silently change product behavior.

If a specification change is explicitly approved, update the relevant documentation before implementing the affected backend behavior.

---

# 20. Definition of Done

A backend feature is not complete until:

* Implementation is complete.
* Relevant validation exists.
* Authorization is enforced.
* Error handling exists.
* Database behavior is correct.
* Race conditions have been considered.
* Relevant tests exist.
* Existing tests still pass.
* No secrets are committed.
* The implementation follows the `docs/` specifications.
* The architecture remains consistent with the project's layering.

---

# 21. Current Development Strategy

Build the application as a modular monolith first.

Recommended implementation order:

```text
1. Project foundation
2. Configuration
3. Database connection
4. Prisma schema
5. Database migrations
6. Authentication
7. Lobby
8. Lobby real-time events
9. Game initialization
10. Ticket generation
11. Number calling
12. Ticket marking
13. Game evaluation
14. Prize engine
15. Real-time prize claims
16. Game completion
17. Reconnection
18. Security hardening
19. Integration testing
20. Production deployment
```

Do not skip domain validation and testing in order to move faster.

Correctness is more important than implementation speed.

---

# 22. Codex Working Rule

Before making significant changes, inspect the repository and understand the existing implementation.

Do not assume files, functions, database models, or architecture exist.

When implementing a feature, prefer modifying the existing architecture rather than introducing a second competing architecture.

Maintain consistency across:

```text
routes
controllers
services
repositories
evaluation
game engine
sockets
middleware
config
database
tests
```

The goal is a production-quality, secure, maintainable multiplayer backend—not merely a backend that appears to work for the happy path.
