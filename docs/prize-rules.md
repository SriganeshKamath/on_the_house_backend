# On the House — Prize Rules

## 1. Purpose

This document defines the authoritative rules for the prize system in **On the House**.

It specifies:

* Available prizes.
* Prize points.
* Prize completion conditions.
* Player eligibility.
* Prize ordering.
* Row restrictions.
* Full House behavior.
* House to Follow behavior.
* Prize availability.
* Prize claiming.
* Winner determination.
* Simultaneous claim handling.
* Player status changes caused by prizes.

The backend Prize Service and Game Evaluation layer must follow these rules.

---

# 2. Prize Categories

On the House has the following prize categories:

```text
STAR
FIRST_ROW
SECOND_ROW
THIRD_ROW
FULL_HOUSE
HOUSE_TO_FOLLOW
```

The points are:

| Prize               | Points |
| ------------------- | -----: |
| Star                |     15 |
| First Row           |     10 |
| Second Row          |     10 |
| Third Row           |     10 |
| Full House          |     30 |
| House to Follow #1  |     20 |
| House to Follow #2  |     15 |
| House to Follow #3+ |     10 |

---

# 3. Prize Configuration

The following prizes always exist in a game:

```text
Star
First Row
Second Row
Third Row
Full House
```

The number of House to Follow prizes is configured by the host before the game starts.

Minimum:

```text
1
```

Maximum:

```text
number of players - 1
```

Example:

```text
Players = 5

Allowed H2F count:
1
2
3
4
```

If there are `N` players:

```text
maximum H2F count = N - 1
```

The server must validate this constraint.

---

# 4. House to Follow Point Schedule

House to Follow points depend on the sequence of the prize.

```text
H2F #1 → 20 points
H2F #2 → 15 points
H2F #3 → 10 points
H2F #4 → 10 points
H2F #5 → 10 points
...
```

Equivalent rule:

```text
if sequence == 1:
    20 points

if sequence == 2:
    15 points

if sequence >= 3:
    10 points
```

The client must never provide the number of points for a prize claim.

The server calculates the points from the prize sequence.

---

# 5. Prize Availability

A prize is available when:

1. The game is `IN_PROGRESS`.
2. The prize has been configured for the game.
3. The prize has not already been awarded.
4. The player claiming it is eligible.
5. The player satisfies the prize's completion condition.

Once a prize has been successfully awarded:

```text
AVAILABLE
    ↓
CLAIMED
```

A prize cannot be awarded again unless the specific prize rule explicitly allows multiple winners.

---

# 6. Star Prize

## 6.1 Points

```text
15 points
```

## 6.2 Required Positions

The Star prize consists of five specific ticket positions:

```text
Top-left
Top-right
Middle-middle
Bottom-left
Bottom-right
```

Conceptually:

```text
┌─────────────────────────┐
│ ★                     ★ │
│          ★              │
│ ★                     ★ │
└─────────────────────────┘
```

The positions are based on the ticket's physical row/column coordinates, not on the numeric values.

The exact coordinates are:

```text
Top-left      → row 0, column 0
Top-right     → row 0, column 8
Middle-middle → row 1, column 4
Bottom-left   → row 2, column 0
Bottom-right  → row 2, column 8
```

However, because standard Housie tickets contain blank cells, the implementation must first establish whether these coordinates are required to be occupied positions or whether "left/right edges" and "middle number" refer to the first/last/middle occupied number in each row.

The final implementation must follow the finalized interpretation agreed upon before ticket/prize implementation.

## 6.3 Star Completion

A player completes Star when every required Star position satisfies the finalized marking condition.

The Star evaluator must derive completion from the authoritative ticket.

The client must not submit:

```text
{
    "starCompleted": true
}
```

as authoritative information.

---

# 7. Row Prizes

There are three row prizes:

```text
FIRST_ROW
SECOND_ROW
THIRD_ROW
```

Each awards:

```text
10 points
```

---

# 8. Row Completion

A row is complete when all five numbers belonging to that row satisfy the game's number-marking requirement.

For example:

```text
First Row:
[number] [number] [number] [number] [number]

All five completed
        ↓
First Row eligible
```

The server calculates row completion from:

```text
Player ticket
+
Called numbers
+
Authoritative marking state
```

The client cannot declare a row complete.

---

# 9. One Row Per Player Rule

A player can claim **only one row prize in a game**.

For example:

```text
Player A
    ↓
First Row
    ↓
WINNER
```

Player A is then permanently ineligible for:

```text
Second Row
Third Row
```

during that game.

The restriction applies across all three row prizes.

A player who has won one row prize may still become eligible for other prize categories according to their respective rules.

For example:

```text
First Row
   ↓
Full House
   ↓
House to Follow
```

may be possible unless another rule makes the player ineligible.

---

# 10. Full House

## 10.1 Points

```text
30 points
```

## 10.2 Completion

Full House requires all 15 numbers on the player's ticket to satisfy the finalized Full House condition.

Conceptually:

```text
15 ticket numbers
       ↓
All completed
       ↓
FULL HOUSE
```

The server must calculate Full House completion from authoritative game data.

---

# 11. Full House Winner Status

A player who successfully claims Full House becomes a spectator.

```text
GamePlayer.status

ACTIVE
  ↓
SPECTATOR
```

This state change happens as part of the successful Full House prize transaction.

The client must not independently change the player's status.

---

# 12. Full House Restrictions

After winning Full House, the player:

* Cannot mark additional numbers.
* Cannot claim additional prizes.
* Cannot claim House to Follow.
* Cannot claim another row.
* Remains connected as a spectator.
* Continues receiving real-time game events.
* Can view the remaining game.

The player's previous prize claims and score remain part of the game history.

---

# 13. House to Follow

House to Follow is a configurable sequence of prizes.

If the host selects:

```text
3 House to Follow prizes
```

the game contains:

```text
H2F #1
H2F #2
H2F #3
```

If the host selects:

```text
5 House to Follow prizes
```

the game contains:

```text
H2F #1
H2F #2
H2F #3
H2F #4
H2F #5
```

---

# 14. House to Follow Eligibility

A player can win at most one House to Follow prize in a game.

Once a player wins an H2F prize:

```text
Player A
   ↓
H2F #1
   ↓
Player A is ineligible for:
H2F #2
H2F #3
H2F #4
...
```

This restriction applies to all succeeding House to Follow prizes.

---

# 15. Full House and House to Follow

A Full House winner is not eligible for any House to Follow prize.

Example:

```text
Player A
   ↓
Full House
   ↓
SPECTATOR
   ↓
H2F #1 ✗
H2F #2 ✗
H2F #3 ✗
```

This restriction exists independently of the general spectator rule.

---

# 16. Star Eligibility

Any active player may claim Star if:

1. The game is in progress.
2. Star has not already been claimed.
3. The player is `ACTIVE`.
4. The player satisfies the Star completion condition.

Winning Star does not make the player a spectator.

Winning Star does not prevent the player from subsequently claiming:

* A row prize, if they have not already claimed a row.
* Full House.
* House to Follow, subject to the applicable rules.

---

# 17. Row Eligibility

A player may claim a row prize when:

1. The game is in progress.
2. The requested row prize has not already been claimed.
3. The player is `ACTIVE`.
4. The player has not previously claimed another row prize.
5. The requested row is complete.

Example:

```text
Player A
First Row complete
No previous row claim
        ↓
ELIGIBLE
```

After winning:

```text
Player A
rowClaimed = true
```

Any later row claim must be rejected.

---

# 18. Full House Eligibility

A player may claim Full House when:

1. The game is in progress.
2. Full House has not already been claimed according to the game's winner policy.
3. The player is `ACTIVE`.
4. The player satisfies the Full House completion condition.

After a successful Full House claim:

```text
Player status = SPECTATOR
```

---

# 19. House to Follow Eligibility

A player may claim the next available House to Follow prize when:

1. The game is in progress.
2. At least one configured H2F prize remains.
3. The player is `ACTIVE`.
4. The player has not previously won an H2F prize.
5. The player has not won Full House.
6. The player satisfies the H2F completion condition.
7. The requested H2F sequence is the next available H2F prize.

---

# 20. Prize Claim Request

A player requests a prize through a real-time game event.

Conceptually:

```text
claim-prize
```

The request contains only the prize being requested.

Example:

```json
{
  "prizeType": "FIRST_ROW"
}
```

For House to Follow, the client should not be allowed to arbitrarily choose a future sequence such as:

```json
{
  "prizeType": "HOUSE_TO_FOLLOW",
  "sequence": 5
}
```

The server determines which H2F prize is currently available.

---

# 21. Prize Validation Pipeline

Every prize claim must pass through the following validation pipeline:

```text
Player requests claim
        ↓
Validate authentication
        ↓
Validate game existence
        ↓
Validate game status
        ↓
Validate GamePlayer
        ↓
Validate player status
        ↓
Validate prize type
        ↓
Validate prize availability
        ↓
Validate prize eligibility
        ↓
Evaluate ticket
        ↓
Resolve winner
        ↓
Persist claim atomically
        ↓
Award points
        ↓
Update player status if required
        ↓
Broadcast result
```

A failed validation must not partially modify game state.

---

# 22. Prize Evaluation vs Prize Eligibility

These are separate concepts.

### Eligibility

Determines:

> **"Is this player allowed to attempt this prize?"**

Examples:

```text
Has the player already won a row?
Has the player already won H2F?
Is the player a spectator?
```

### Evaluation

Determines:

> **"Does the player's ticket satisfy the prize condition?"**

Examples:

```text
Is the first row complete?
Is Full House complete?
Is Star complete?
```

These should remain separate in the backend architecture.

Recommended conceptual structure:

```text
Prize Service
     │
     ├── Eligibility Evaluator
     │
     └── Prize Evaluator
```

---

# 23. Prize Winner Persistence

Every successful prize claim must be persisted.

A prize claim should contain enough information to determine:

* Game.
* Player.
* Prize type.
* Prize sequence where applicable.
* Points awarded.
* Claim time.
* Winner status.

The database becomes the permanent record of prize results.

---

# 24. Prize Points

Points are calculated by the server.

The client must never provide:

```text
points: 30
```

as authoritative input.

For example:

```text
FULL_HOUSE
      ↓
Prize configuration
      ↓
30 points
```

For H2F:

```text
sequence = 1 → 20
sequence = 2 → 15
sequence >= 3 → 10
```

---

# 25. Simultaneous Claims

Multiple players may attempt to claim the same prize at approximately the same time.

The backend must process prize claims atomically.

For prizes where only one winner is allowed:

```text
Player A ─┐
          ├──→ Server
Player B ─┘
```

The server/database must guarantee that only one valid claim succeeds.

The initial implementation should use:

* Database transactions.
* Appropriate database constraints.
* Server-side eligibility evaluation inside the transaction.

The first valid claim committed by the server becomes the winner.

A later conflicting claim must be rejected.

---

# 26. Prize Claim Atomicity

A successful prize claim must be treated as one logical operation.

Conceptually:

```text
BEGIN TRANSACTION

Validate prize availability
Validate player eligibility
Evaluate ticket
Create PrizeClaim
Award points
Update player status if necessary
Update prize state if necessary

COMMIT
```

If any required operation fails:

```text
ROLLBACK
```

No partial prize result may remain.

---

# 27. Duplicate Claims

A player cannot successfully claim the same prize more than once.

For example:

```text
Player A
    ↓
Star
    ↓
WINNER
```

A second Star claim from Player A must be rejected because Star is already unavailable.

The same principle applies to all single-instance prizes.

---

# 28. Prize Ordering

The fixed prize categories do not necessarily need to be won in a specific sequence.

For example, Star may be won before or after a row prize.

The server evaluates each prize according to its own availability and eligibility rules.

House to Follow is different because it is explicitly sequential:

```text
H2F #1
   ↓
H2F #2
   ↓
H2F #3
   ↓
...
```

A later H2F prize cannot be claimed before the previous H2F prize has been awarded.

---

# 29. Game Completion and Prizes

The game ends when all configured prizes have been successfully awarded.

The required prize set is:

```text
Star
First Row
Second Row
Third Row
Full House
Configured H2F prizes
```

Example with three H2F prizes:

```text
Star             ✓
First Row        ✓
Second Row       ✓
Third Row        ✓
Full House       ✓
H2F #1           ✓
H2F #2           ✓
H2F #3           ✓
                  ↓
              GAME FINISHED
```

When the final required prize is awarded:

1. The game must transition to `FINISHED`.
2. Number calling must stop.
3. Further prize claims must be rejected.
4. Final scores must be persisted/available.
5. The final game state must be broadcast.

---

# 30. Prize Evaluation Architecture

Prize-specific evaluation should be isolated from controllers and Socket.IO handlers.

Recommended conceptual structure:

```text
src/
└── evaluation/
    │
    ├── prizes/
    │   ├── star.evaluator.js
    │   ├── row.evaluator.js
    │   ├── full-house.evaluator.js
    │   └── house-follow.evaluator.js
    │
    ├── eligibility/
    │   └── prize-eligibility.js
    │
    └── ticket/
        ├── ticket-validator.js
        └── position-evaluator.js
```

The exact file structure may evolve during implementation.

---

# 31. Prize Service Responsibility

The Prize Service coordinates the prize claim.

It should be responsible for the business operation:

```text
claimPrize(gameId, playerId, prizeType)
```

It should not contain large amounts of low-level ticket evaluation logic.

Conceptually:

```text
Prize Service
      │
      ├── Check eligibility
      │
      ├── Call evaluator
      │
      ├── Resolve prize
      │
      └── Persist result
```

---

# 32. Controllers and Socket Handlers

Controllers and Socket.IO handlers must remain thin.

They should not contain code such as:

```text
if player has 5 numbers in row
if player has full house
if player already won H2F
```

Instead:

```text
Socket Handler
      ↓
Prize Service
      ↓
Eligibility Evaluator
      ↓
Prize Evaluator
      ↓
Repository
```

This keeps the game rules testable and independent from the transport layer.

---

# 33. Prize Invariants

The backend must preserve these invariants:

1. Star awards 15 points.
2. Each row prize awards 10 points.
3. Full House awards 30 points.
4. H2F #1 awards 20 points.
5. H2F #2 awards 15 points.
6. H2F #3 and later award 10 points.
7. A player can win at most one row prize.
8. A player can win at most one H2F prize.
9. A Full House winner becomes a spectator.
10. A Full House winner cannot win H2F.
11. A spectator cannot claim prizes.
12. A prize cannot be awarded after it has become unavailable.
13. H2F prizes must be awarded sequentially.
14. The client cannot determine prize completion.
15. The client cannot determine prize points.
16. The client cannot determine prize eligibility.
17. Prize claims must be persisted atomically.
18. Concurrent claims must not violate prize uniqueness.
19. A failed claim must not modify authoritative game state.
20. The game must not finish until every configured required prize has been awarded.

---

# 34. Important Rule Requiring Final Confirmation

The Star rule currently describes:

```text
Top-left
Top-right
Middle-middle
Bottom-left
Bottom-right
```

Because a standard Housie ticket contains blank cells, the implementation must finalize whether these refer to:

**Option A — Fixed grid coordinates**

```text
(0,0)
(0,8)
(1,4)
(2,0)
(2,8)
```

or:

**Option B — Occupied positions**

```text
First occupied number in top row
Last occupied number in top row
Middle occupied number in middle row
First occupied number in bottom row
Last occupied number in bottom row
```

This decision must be finalized before implementing the Star evaluator.

---

# 35. Relationship With Other Documents

This document defines the authoritative prize rules.

Related documents:

```text
game-rules.md
    ↓
Overall game rules

game-lifecycle.md
    ↓
When prizes can be claimed and when the game ends

ticket-rules.md
    ↓
Ticket structure and marking

prize-rules.md
    ↓
Prize eligibility and evaluation

domain-model.md
    ↓
Database representation of prizes and claims
```

When implementing prize-related backend functionality, this document is the authoritative source for prize behavior.
