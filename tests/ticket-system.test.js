const { generateTicket } = require('../src/game/ticket/ticket-generator');
const { validateTicket } = require('../src/evaluation/ticket/ticket-validator');
const { TicketService } = require('../src/services/ticket-service');
const { prisma } = require('../src/config/prisma');
const { randomUUID } = require('node:crypto');

describe('90-Ball Housie Ticket Generation & Validation System', () => {
  describe('Property-Based Ticket Generator & Validator', () => {
    it('generates 1,000 consecutive tickets and asserts 100% pass validation', () => {
      const totalTickets = 1000;
      for (let i = 0; i < totalTickets; i += 1) {
        const ticket = generateTicket();
        const validation = validateTicket(ticket);
        if (!validation.valid) {
          console.error(`Validation failed at iteration ${i}:`, validation.errors);
        }
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });

    it('preserves essential structural invariants on every generated ticket', () => {
      const ticket = generateTicket();

      expect(ticket).toHaveLength(15);

      const rowCounts = [0, 0, 0];
      ticket.forEach((n) => {
        expect(n.row).toBeGreaterThanOrEqual(0);
        expect(n.row).toBeLessThanOrEqual(2);
        expect(n.column).toBeGreaterThanOrEqual(0);
        expect(n.column).toBeLessThanOrEqual(8);
        expect(n.marked).toBe(false);
        rowCounts[n.row] += 1;
      });

      expect(rowCounts).toEqual([5, 5, 5]);
    });

    it('enforces correct column number ranges on all columns', () => {
      const ranges = [
        { min: 1, max: 9 },
        { min: 10, max: 19 },
        { min: 20, max: 29 },
        { min: 30, max: 39 },
        { min: 40, max: 49 },
        { min: 50, max: 59 },
        { min: 60, max: 69 },
        { min: 70, max: 79 },
        { min: 80, max: 90 },
      ];

      for (let run = 0; run < 50; run += 1) {
        const ticket = generateTicket();
        ticket.forEach((n) => {
          const expectedRange = ranges[n.column];
          expect(n.number).toBeGreaterThanOrEqual(expectedRange.min);
          expect(n.number).toBeLessThanOrEqual(expectedRange.max);
        });
      }
    });

    it('enforces top-to-bottom strictly ascending order within columns', () => {
      for (let run = 0; run < 50; run += 1) {
        const ticket = generateTicket();
        const cols = Array.from({ length: 9 }, () => []);

        ticket.forEach((n) => cols[n.column].push(n));

        cols.forEach((colCells) => {
          colCells.sort((a, b) => a.row - b.row);
          for (let i = 0; i < colCells.length - 1; i += 1) {
            expect(colCells[i].number).toBeLessThan(colCells[i + 1].number);
          }
        });
      }
    });

    it('guarantees 15 unique numbers within a single ticket', () => {
      for (let run = 0; run < 50; run += 1) {
        const ticket = generateTicket();
        const numberSet = new Set(ticket.map((n) => n.number));
        expect(numberSet.size).toBe(15);
      }
    });
  });

  describe('TicketValidator (Negative & Invalid Ticket Tests)', () => {
    const validBaseTicket = [
      // Row 0
      { row: 0, column: 0, number: 5, marked: false },
      { row: 0, column: 2, number: 21, marked: false },
      { row: 0, column: 4, number: 43, marked: false },
      { row: 0, column: 6, number: 62, marked: false },
      { row: 0, column: 8, number: 85, marked: false },
      // Row 1
      { row: 1, column: 1, number: 14, marked: false },
      { row: 1, column: 3, number: 36, marked: false },
      { row: 1, column: 5, number: 51, marked: false },
      { row: 1, column: 7, number: 73, marked: false },
      { row: 1, column: 8, number: 89, marked: false },
      // Row 2
      { row: 2, column: 0, number: 8, marked: false },
      { row: 2, column: 2, number: 27, marked: false },
      { row: 2, column: 4, number: 49, marked: false },
      { row: 2, column: 6, number: 68, marked: false },
      { row: 2, column: 7, number: 79, marked: false },
    ];

    it('accepts a perfectly formatted valid ticket', () => {
      const result = validateTicket(validBaseTicket);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects a ticket with fewer than 15 numbers', () => {
      const invalid = validBaseTicket.slice(0, 14);
      const result = validateTicket(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('15 numbers'))).toBe(true);
    });

    it('rejects a ticket with rows not containing exactly 5 numbers', () => {
      const invalid = JSON.parse(JSON.stringify(validBaseTicket));
      // Move one number from row 0 to row 1
      invalid[0].row = 1;

      const result = validateTicket(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Row 0 must contain exactly 5 numbers'))).toBe(true);
    });

    it('rejects a ticket with a number outside its column range', () => {
      const invalid = JSON.parse(JSON.stringify(validBaseTicket));
      // Put number 37 in Column 0 (which allows 1-9)
      invalid[0].number = 37;

      const result = validateTicket(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('outside allowed range'))).toBe(true);
    });

    it('rejects duplicate numbers on the same ticket', () => {
      const invalid = JSON.parse(JSON.stringify(validBaseTicket));
      invalid[1].number = 5; // Duplicate of invalid[0]

      const result = validateTicket(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate number'))).toBe(true);
    });

    it('rejects out-of-order numbers within a column', () => {
      const invalid = JSON.parse(JSON.stringify(validBaseTicket));
      // Column 0 has 5 on row 0 and 8 on row 2. Swap them.
      invalid[0].number = 8;
      invalid[10].number = 5;

      const result = validateTicket(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('not strictly increasing'))).toBe(true);
    });

    it('rejects pre-marked generated ticket numbers', () => {
      const invalid = JSON.parse(JSON.stringify(validBaseTicket));
      invalid[0].marked = true;

      const result = validateTicket(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('must be unmarked'))).toBe(true);
    });
  });

  describe('TicketService Integration', () => {
    let testUserId;
    let testLobbyId;
    let testGameId;
    let testGamePlayerId;

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          username: `ts_${randomUUID().replaceAll('-', '').slice(0, 10)}`,
          email: `ts_${randomUUID().replaceAll('-', '').slice(0, 10)}@test.local`,
          passwordHash: 'hash',
        },
      });
      testUserId = user.id;

      const lobby = await prisma.lobby.create({
        data: {
          code: `TK${randomUUID().replaceAll('-', '').slice(0, 4)}`.toUpperCase(),
          hostId: user.id,
        },
      });
      testLobbyId = lobby.id;

      const game = await prisma.game.create({
        data: {
          lobbyId: lobby.id,
          settings: { create: { numberCallingInterval: 10, houseToFollowCount: 1 } },
          players: { create: { userId: user.id } },
        },
        include: { players: true },
      });
      testGameId = game.id;
      testGamePlayerId = game.players[0].id;
    });

    afterAll(async () => {
      if (testGameId) {
        await prisma.ticketNumber.deleteMany({ where: { ticket: { gamePlayerId: testGamePlayerId } } });
        await prisma.ticket.deleteMany({ where: { gamePlayerId: testGamePlayerId } });
        await prisma.gameSettings.deleteMany({ where: { gameId: testGameId } });
        await prisma.gamePlayer.deleteMany({ where: { gameId: testGameId } });
        await prisma.game.deleteMany({ where: { id: testGameId } });
      }
      if (testLobbyId) {
        await prisma.lobby.deleteMany({ where: { id: testLobbyId } });
      }
      if (testUserId) {
        await prisma.user.deleteMany({ where: { id: testUserId } });
      }
    });

    it('TicketService generates and persists a valid ticket to Prisma', async () => {
      const ticketService = new TicketService();

      const createdTicket = await prisma.$transaction(async (tx) => {
        return ticketService.createTicketForPlayer(tx, testGamePlayerId);
      });

      expect(createdTicket.id).toBeDefined();
      expect(createdTicket.gamePlayerId).toBe(testGamePlayerId);
      expect(createdTicket.numbers).toHaveLength(15);

      const validation = validateTicket(createdTicket.numbers);
      expect(validation.valid).toBe(true);
    });
  });
});
