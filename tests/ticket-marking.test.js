const { TicketService } = require('../src/services/ticket-service');
const { AppError } = require('../src/utils/app-error');

// Mock IO emitter
vi.mock('../src/sockets', () => ({
  getIO: vi.fn().mockReturnValue({}),
}));
vi.mock('../src/sockets/socket-emitter', () => ({
  emitTicketMarked: vi.fn(),
}));

describe('Ticket Marking System', () => {
  let mockGameRepo;
  let mockCalledNumRepo;
  let mockTicketRepo;
  let mockLobbyRepo;
  let ticketService;

  beforeEach(() => {
    mockGameRepo = {
      findByLobbyId: vi.fn(),
    };
    mockCalledNumRepo = {
      findByGameId: vi.fn(),
    };
    mockTicketRepo = {
      getTicketByGameAndUser: vi.fn(),
      markTicketNumber: vi.fn(),
    };
    mockLobbyRepo = {
      findByCode: vi.fn(),
    };

    ticketService = new TicketService(
      mockGameRepo,
      mockCalledNumRepo,
      mockTicketRepo,
      mockLobbyRepo
    );
  });

  it('should successfully mark a valid number and be idempotent', async () => {
    mockLobbyRepo.findByCode.mockResolvedValue({ id: 'lobby-1' });
    mockGameRepo.findByLobbyId.mockResolvedValue({
      id: 'game-1',
      status: 'IN_PROGRESS',
      players: [{ userId: 'user-1', status: 'ACTIVE' }],
    });
    mockCalledNumRepo.findByGameId.mockResolvedValue([
      { number: 42 },
      { number: 10 },
    ]);
    mockTicketRepo.getTicketByGameAndUser.mockResolvedValue({
      id: 'ticket-1',
      numbers: [
        { number: 10, marked: false },
        { number: 42, marked: false },
      ],
    });

    const result = await ticketService.markNumber('LOBBYCODE', 'user-1', 42);

    expect(result).toEqual({ number: 42, marked: true });
    expect(mockTicketRepo.markTicketNumber).toHaveBeenCalledWith('ticket-1', 42);

    // Test idempotency
    mockTicketRepo.getTicketByGameAndUser.mockResolvedValue({
      id: 'ticket-1',
      numbers: [
        { number: 10, marked: false },
        { number: 42, marked: true }, // Already marked
      ],
    });

    const result2 = await ticketService.markNumber('LOBBYCODE', 'user-1', 42);
    expect(result2).toEqual({ number: 42, marked: true });
    // Should not call repo again
    expect(mockTicketRepo.markTicketNumber).toHaveBeenCalledTimes(1); 
  });

  it('should reject uncalled numbers', async () => {
    mockLobbyRepo.findByCode.mockResolvedValue({ id: 'lobby-1' });
    mockGameRepo.findByLobbyId.mockResolvedValue({
      id: 'game-1',
      status: 'IN_PROGRESS',
      players: [{ userId: 'user-1', status: 'ACTIVE' }],
    });
    mockCalledNumRepo.findByGameId.mockResolvedValue([
      { number: 10 }, // 42 is NOT called
    ]);

    await expect(ticketService.markNumber('LOBBYCODE', 'user-1', 42)).rejects.toThrow(
      'Number 42 has not been called yet.'
    );
  });

  it('should reject numbers not on the ticket', async () => {
    mockLobbyRepo.findByCode.mockResolvedValue({ id: 'lobby-1' });
    mockGameRepo.findByLobbyId.mockResolvedValue({
      id: 'game-1',
      status: 'IN_PROGRESS',
      players: [{ userId: 'user-1', status: 'ACTIVE' }],
    });
    mockCalledNumRepo.findByGameId.mockResolvedValue([
      { number: 42 }, // It is called
    ]);
    mockTicketRepo.getTicketByGameAndUser.mockResolvedValue({
      id: 'ticket-1',
      numbers: [
        { number: 10, marked: false }, // but not on ticket
      ],
    });

    await expect(ticketService.markNumber('LOBBYCODE', 'user-1', 42)).rejects.toThrow(
      'Number 42 is not on your ticket.'
    );
  });

  it('should reject if player is a spectator', async () => {
    mockLobbyRepo.findByCode.mockResolvedValue({ id: 'lobby-1' });
    mockGameRepo.findByLobbyId.mockResolvedValue({
      id: 'game-1',
      status: 'IN_PROGRESS',
      players: [{ userId: 'user-1', status: 'SPECTATOR' }],
    });

    await expect(ticketService.markNumber('LOBBYCODE', 'user-1', 42)).rejects.toThrow(
      'Only active players can mark numbers.'
    );
  });

  it('should reject if game is not IN_PROGRESS', async () => {
    mockLobbyRepo.findByCode.mockResolvedValue({ id: 'lobby-1' });
    mockGameRepo.findByLobbyId.mockResolvedValue({
      id: 'game-1',
      status: 'FINISHED',
      players: [{ userId: 'user-1', status: 'ACTIVE' }],
    });

    await expect(ticketService.markNumber('LOBBYCODE', 'user-1', 42)).rejects.toThrow(
      'Game is not in progress.'
    );
  });
});
