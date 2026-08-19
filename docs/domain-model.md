# On the House — Domain Model

## 1. Purpose

This document defines the core domain entities and their relationships for **On the House**.

It is intended to serve as the conceptual foundation for:

* The Prisma database schema.
* Repository interfaces.
* Service-layer responsibilities.
* Game state management.
* Prize evaluation.
* Real-time events.
* API contracts.

This document defines **what entities exist and what they mean**.

It does not define the final Prisma schema syntax. Database-specific details such as exact field types, indexes, foreign keys, cascade behavior, and migration strategy should be finalized when creating `schema.prisma`.

---

# 2. Domain Overview

The core domain consists of:

```text
User
 │
 ├──────────────┐
 ↓              ↓
LobbyPlayer   GamePlayer
 │              │
 ↓              ↓
Lobby ───────→ Game
                │
        ┌───────┼────────┐
        ↓       ↓        ↓
      Ticket  Called   Prize
                Number  Claim
```

More explicitly:

```text
User
  │
  ├── creates/hosts ──→ Lobby
  │
  └── joins ──────────→ LobbyPlayer
                           │
                           ↓
                         Game
                           │
                           └── GamePlayer
                                  │
                                  └── Ticket
                                        │
                                        └── TicketNumber

Game
 │
 ├── GameSettings
 ├── CalledNumber
 └── PrizeClaim
```

---

# 3. User

## Purpose

Represents an authenticated application user.

A User exists independently of any particular game.

A user may:

* Create a lobby.
* Host a game.
* Join another user's lobby.
* Participate in multiple games over time.
* Have historical game participation.

A User does not directly represent a player's state inside a particular game.

That state belongs to `GamePlayer`.

---

## Responsibilities

The User entity represents identity and authentication-related information.

It should contain information such as:

```text
id
username
email
passwordHash
createdAt
updatedAt
```

Authentication-specific fields may evolve later.

---

# 4. Lobby

## Purpose

A Lobby represents the pre-game waiting area where players gather before a game starts.

A Lobby is not the game itself.

It contains:

* Host.
* Game code.
* Players waiting to join.
* Lobby status.
* Pre-game configuration.
* Creation/update timestamps.

---

## Lifecycle

A Lobby generally follows:

```text
WAITING
   ↓
STARTING
   ↓
IN_PROGRESS
   ↓
FINISHED
```

or:

```text
WAITING
   ↓
CANCELLED
```

The exact lifecycle is defined in `game-lifecycle.md`.

---

## Important Properties

Conceptually:

```text
Lobby
-----
id
code
hostId
status
createdAt
updatedAt
```

The game code must be unique among active lobbies.

---

# 5. LobbyPlayer

## Purpose

Represents a User's participation in a Lobby.

A `User` and a `Lobby` have a many-to-many relationship over time:

```text
User ←→ Lobby
```

`LobbyPlayer` represents that relationship.

---

## Example

```text
Lobby A7K92P

Host      → User 1
Player 2  → User 2
Player 3  → User 3
Player 4  → User 4
```

These relationships are represented through LobbyPlayer records.

---

## Responsibilities

LobbyPlayer is responsible for pre-game participation information such as:

* User.
* Lobby.
* Join time.
* Leave time if required.
* Whether the user is the host if that relationship is modeled here.
* Lobby membership state if required.

Gameplay state should not be stored here.

Gameplay state belongs to `GamePlayer`.

---

# 6. Game

## Purpose

Represents one actual Housie game session.

A Game is created when the host starts a Lobby.

Conceptually:

```text
Lobby
  ↓
Host starts
  ↓
Game created
```

The Game owns the authoritative gameplay state.

---

## Responsibilities

Game is associated with:

* Game settings.
* Players.
* Tickets.
* Called numbers.
* Prize claims.
* Game status.
* Start/end timestamps.

Conceptually:

```text
Game
 ├── GameSettings
 ├── GamePlayers
 ├── Tickets
 ├── CalledNumbers
 └── PrizeClaims
```

---

# 7. GamePlayer

## Purpose

Represents a User's participation in a specific Game.

This entity is different from `User` because a user's state changes from game to game.

For example:

```text
User
  ↓
Game 1 → ACTIVE
Game 2 → SPECTATOR
Game 3 → ACTIVE
```

Therefore, gameplay state must belong to `GamePlayer`.

---

## Important Properties

Conceptually:

```text
GamePlayer
----------
id
gameId
userId
status
score
joinedAt
leftAt
```

Possible status values:

```text
ACTIVE
SPECTATOR
LEFT
```

---

## GamePlayer Responsibilities

GamePlayer represents:

* Participation in the game.
* Current game status.
* Score.
* Gameplay eligibility.
* Relationship to the player's ticket.
* Historical participation.

---

# 8. Game Settings

## Purpose

Represents the configuration chosen before a game begins.

Current settings include:

```text
numberCallingInterval
houseToFollowCount
```

Example:

```text
numberCallingInterval = 10 seconds
houseToFollowCount = 3
```

---

## Ownership

Game settings belong to the Game rather than the Lobby after the game starts.

The flow is:

```text
Host configures settings
        ↓
Lobby
        ↓
Game starts
        ↓
Settings become Game configuration
        ↓
Settings are locked
```

The authoritative gameplay settings must be stored with the Game.

---

# 9. Ticket

## Purpose

Represents one player's Housie ticket for one Game.

A Ticket belongs to exactly one `GamePlayer`.

Conceptually:

```text
Game
 │
 └── GamePlayer
       │
       └── Ticket
```

Each active GamePlayer must have exactly one ticket.

---

## Ticket Responsibilities

A Ticket represents:

* Ticket identity.
* Game ownership.
* Player ownership.
* Ticket structure.
* Ticket numbers.
* Marking state through its TicketNumbers.

The ticket must remain unchanged after generation.

---

# 10. TicketNumber

## Purpose

Represents one cell/number position on a Ticket.

A Ticket consists of 27 grid positions:

```text
3 rows × 9 columns
```

15 positions contain numbers.

12 positions are blank.

A TicketNumber record should conceptually represent an occupied ticket position and its state.

Example:

```text
TicketNumber
------------
row = 0
column = 4
number = 41
marked = false
```

---

## Important Properties

Conceptually:

```text
id
ticketId
row
column
number
marked
```

The exact representation of blank cells must be finalized during schema design.

---

# 11. Ticket Position

The ticket grid uses zero-based or one-based indexing internally, but the backend must choose one convention and use it consistently.

For conceptual documentation:

```text
Rows:
0, 1, 2

Columns:
0, 1, 2, 3, 4, 5, 6, 7, 8
```

The exact indexing convention should be documented in the implementation.

This is particularly important for Star evaluation.

---

# 12. CalledNumber

## Purpose

Represents a number that has been called by the game server.

A CalledNumber belongs to exactly one Game.

Example:

```text
Game 123

CalledNumber
------------
number = 37
sequence = 1

CalledNumber
------------
number = 82
sequence = 2
```

---

## Responsibilities

CalledNumber provides the authoritative history of number calling.

It should preserve:

* Game.
* Number.
* Call sequence.
* Timestamp.

Conceptually:

```text
CalledNumber
------------
id
gameId
number
sequence
calledAt
```

---

# 13. Number Calling History

The sequence number is important.

Example:

```text
sequence 1 → 37
sequence 2 → 82
sequence 3 → 14
sequence 4 → 61
```

This allows the backend to reconstruct the exact order in which numbers were called.

It also supports:

* Game replay.
* Debugging.
* Auditing.
* Reconnection.
* Result/history views.

---

# 14. Prize Claim

## Purpose

Represents a successfully awarded prize.

A PrizeClaim connects:

```text
Game
Player
Prize
```

and records the result.

Conceptually:

```text
PrizeClaim
----------
id
gameId
playerId
prizeType
sequence
points
claimedAt
```

---

# 15. Prize Type

The application currently supports:

```text
STAR
FIRST_ROW
SECOND_ROW
THIRD_ROW
FULL_HOUSE
HOUSE_TO_FOLLOW
```

House to Follow requires an additional sequence number because multiple H2F prizes may exist in the same game.

Example:

```text
HOUSE_TO_FOLLOW
sequence = 1
points = 20
```

and:

```text
HOUSE_TO_FOLLOW
sequence = 2
points = 15
```

---

# 16. Prize Sequence

The `sequence` concept applies particularly to House to Follow.

For example:

```text
H2F #1
H2F #2
H2F #3
```

The sequence determines:

* Which H2F prize is currently available.
* Its point value.
* Whether the previous H2F prize has already been claimed.

The client should not be trusted to choose an arbitrary H2F sequence.

The server determines the next available sequence.

---

# 17. Player Score

A GamePlayer has a score for the specific game.

The score is derived from successfully awarded prizes.

Example:

```text
Star          15
First Row     10
Full House    30
----------------
Score         55
```

The authoritative score must be calculated by the server.

The client cannot submit or modify the score.

---

# 18. Score Representation

There are two possible approaches:

### Derived score

Calculate:

```text
SUM(PrizeClaim.points)
```

whenever needed.

### Persisted score

Store:

```text
GamePlayer.score
```

and update it whenever a prize is successfully awarded.

The initial implementation may use a persisted score for efficient leaderboard/result retrieval while treating PrizeClaims as the source of the historical breakdown.

The implementation must ensure the score cannot diverge from valid prize claims.

---

# 19. Relationship Between LobbyPlayer and GamePlayer

These entities represent different stages of participation.

```text
User
 │
 ↓
LobbyPlayer
 │
 │ host starts game
 ↓
GamePlayer
 │
 ↓
Ticket
```

`LobbyPlayer` answers:

> "Who is currently participating in this lobby?"

`GamePlayer` answers:

> "Who is participating in this specific game, and what is their current gameplay state?"

Do not use LobbyPlayer to represent gameplay status.

---

# 20. Host Representation

The host is fundamentally a User associated with a Lobby.

Conceptually:

```text
Lobby.hostId → User.id
```

When the game is created, the host also becomes a GamePlayer.

The host remains a normal GamePlayer and follows the same gameplay rules as other players.

Being the host does not grant gameplay advantages.

The host's special permissions are limited to host-specific actions such as lobby configuration and starting the game.

---

# 21. Game and Lobby Relationship

The expected relationship is:

```text
Lobby
   │
   └── Game
```

A lobby is the pre-game container.

A game is the actual game session created from that lobby.

The initial design should assume one actual Game per Lobby.

Historical games remain persisted after completion.

---

# 22. Persistent Game History

After a game finishes, the following information should remain available:

```text
Game
 ├── Players
 ├── Player scores
 ├── Tickets
 ├── Called numbers
 ├── Prize claims
 ├── Settings
 ├── Started timestamp
 └── Finished timestamp
```

This allows future functionality such as:

* Game history.
* Player statistics.
* Leaderboards.
* Replays.
* Performance analytics.

These features do not need to be implemented immediately, but the domain model should not prevent them.

---

# 23. Game State

Game status should be explicit.

Recommended values:

```text
WAITING
STARTING
IN_PROGRESS
FINISHED
CANCELLED
```

The exact state transition rules are defined in `game-lifecycle.md`.

A Game should never rely solely on timestamps to determine whether gameplay is active.

---

# 24. GamePlayer State

Recommended values:

```text
ACTIVE
SPECTATOR
LEFT
```

### ACTIVE

The player can participate in gameplay and claim eligible prizes.

### SPECTATOR

The player remains in the game but cannot participate in gameplay or claim prizes.

A player becomes a spectator after winning Full House.

### LEFT

The player has left the game or is otherwise no longer participating.

Reconnection behavior may restore participation depending on the finalized lifecycle rules.

---

# 25. Domain Relationship Diagram

The conceptual domain model is:

```text
                         ┌─────────────┐
                         │    User     │
                         └──────┬──────┘
                                │
                   ┌────────────┴────────────┐
                   │                         │
                   ▼                         ▼
            ┌──────────────┐          ┌──────────────┐
            │ LobbyPlayer  │          │ GamePlayer   │
            └──────┬───────┘          └──────┬───────┘
                   │                         │
                   ▼                         ▼
            ┌──────────────┐          ┌──────────────┐
            │    Lobby     │─────────▶│     Game     │
            └──────────────┘          └──────┬───────┘
                                             │
                   ┌─────────────────────────┼────────────────────┐
                   │                         │                    │
                   ▼                         ▼                    ▼
            ┌──────────────┐          ┌──────────────┐    ┌──────────────┐
            │    Ticket    │          │ CalledNumber │    │ PrizeClaim   │
            └──────┬───────┘          └──────────────┘    └──────────────┘
                   │                                             │
                   ▼                                             │
            ┌──────────────┐                                     │
            │ TicketNumber │                                     │
            └──────────────┘                                     │
                                                                 │
                                              ┌──────────────────┘
                                              ▼
                                           User
```

---

# 26. Repository Ownership

Each repository should generally own persistence operations for its corresponding aggregate/entity.

Examples:

```text
UserRepository
LobbyRepository
GameRepository
GamePlayerRepository
TicketRepository
CalledNumberRepository
PrizeRepository
```

Repositories should interact with Prisma.

They should not contain high-level game rules.

---

# 27. Service Ownership

Services coordinate business operations.

Examples:

```text
AuthService
LobbyService
GameService
TicketService
PrizeService
```

Example:

```text
LobbyService.createLobby()
LobbyService.joinLobby()
GameService.startGame()
GameService.markNumber()
PrizeService.claimPrize()
```

Services may call multiple repositories and evaluation components.

---

# 28. Evaluation Layer

Game-specific validation belongs in the evaluation/domain logic layer rather than repositories.

Examples:

```text
isStarComplete()
isRowComplete()
isFullHouseComplete()
isEligibleForPrize()
getNextHouseToFollow()
```

The evaluation layer should operate on domain data and return deterministic results.

It should not directly perform HTTP responses or Socket.IO broadcasts.

---

# 29. Repository vs Evaluation

These responsibilities must remain separate.

### Repository

Answers:

> "What data exists?"

Example:

```text
getTicketByGamePlayer()
getCalledNumbers()
getPrizeClaims()
```

### Evaluation

Answers:

> "Does the current game state satisfy this rule?"

Example:

```text
isFullHouseComplete(ticket, calledNumbers)
```

### Service

Answers:

> "What should happen when the player performs this operation?"

Example:

```text
claimPrize(gameId, playerId, FULL_HOUSE)
```

---

# 30. Transaction Boundaries

Operations that modify multiple related entities should use database transactions.

Examples:

### Start Game

```text
Create Game
Create GamePlayers
Create Tickets
Initialize settings/state
```

### Claim Prize

```text
Create PrizeClaim
Update GamePlayer score
Update GamePlayer status if required
Update game/prize state if required
```

These operations should be atomic.

---

# 31. Database Constraints

The final schema should enforce important invariants at the database level wherever practical.

Examples:

```text
Unique Lobby.code

Unique GamePlayer(gameId, userId)

Unique Ticket(gamePlayerId)

Unique CalledNumber(gameId, number)

Unique CalledNumber(gameId, sequence)
```

Prize-specific uniqueness constraints should also be considered during final schema design.

Application-level validation alone should not be relied upon when a database constraint can enforce an invariant.

---

# 32. Domain Invariants

The following relationships must remain valid:

1. Every Game belongs to a Lobby.
2. Every GamePlayer belongs to exactly one Game.
3. Every GamePlayer references exactly one User.
4. Every active GamePlayer has exactly one Ticket.
5. Every Ticket belongs to exactly one GamePlayer.
6. Every TicketNumber belongs to exactly one Ticket.
7. Every CalledNumber belongs to exactly one Game.
8. Every PrizeClaim belongs to exactly one Game.
9. Every PrizeClaim references the GamePlayer who won the prize.
10. A GamePlayer cannot have multiple authoritative tickets for the same Game.
11. A Game cannot contain duplicate called numbers.
12. A player's score can only increase through valid prize claims.
13. Historical game data must remain available after game completion.
14. Domain state must not depend on an active Socket.IO connection.

---

# 33. What Is Not Yet Part of the Core Domain

The following are intentionally not part of the initial domain model:

```text
Chat messages
Friend system
Private messaging
Player ranking system
Achievements
Coins/currency
Monetization
Advertisements
Tournaments
Teams
Multiple game modes
```

These may be introduced later as separate domains.

The initial architecture should avoid adding entities for features that do not currently exist.

---

# 34. Future Extensibility

The domain model should allow future features without coupling the current game rules to them.

Potential future additions include:

```text
GameEvent
GameResult
PlayerStatistics
Leaderboard
Tournament
Friend
ChatMessage
Achievement
```

These should only be introduced when their requirements are defined.

---

# 35. Relationship With Other Specification Documents

This document defines **what the major domain entities represent and how they relate**.

Related documents:

```text
game-rules.md
    ↓
Overall game rules

game-lifecycle.md
    ↓
Game and player state transitions

ticket-rules.md
    ↓
Ticket structure and behavior

prize-rules.md
    ↓
Prize behavior and evaluation

domain-model.md
    ↓
Entities and relationships
```

The Prisma schema should be derived from this domain model rather than designed independently of it.

---

# 36. Implementation Principle

The backend should follow this conceptual flow:

```text
HTTP / Socket.IO
       ↓
Controller / Socket Handler
       ↓
Service
       ↓
Evaluation / Domain Logic
       ↓
Repository
       ↓
Prisma
       ↓
PostgreSQL
```

For read operations:

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Prisma
    ↓
PostgreSQL
```

For game-rule operations:

```text
Socket Handler
      ↓
Game/Prize Service
      ↓
Eligibility Evaluation
      ↓
Prize/Ticket Evaluation
      ↓
Repository Transaction
      ↓
PostgreSQL
      ↓
Socket Broadcast
```

This separation should be maintained throughout the implementation.
