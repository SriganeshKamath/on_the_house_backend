const { describe, it, expect, vi, beforeEach, afterEach } = require('vitest');
const { NumberCaller } = require('../src/game/engine/number-caller');
const { NumberCallingService } = require('../src/services/number-calling-service');

describe('NumberCaller Engine', () => {
  let mockGameRepo;
  let mockCalledNumRepo;
  let mockEmitter;
  let stopCallback;
  
  beforeEach(() => {
    vi.useFakeTimers();

    mockGameRepo = {
      findById: vi.fn().mockResolvedValue({ id: 'game-1', status: 'IN_PROGRESS' }),
    };

    mockCalledNumRepo = {
      findByGameId: vi.fn().mockResolvedValue([]),
      createCalledNumber: vi.fn().mockImplementation((tx, gameId, number, sequence) => {
        return Promise.resolve({ gameId, number, sequence, calledAt: new Date() });
      }),
    };

    mockEmitter = {
      emitNumberCalled: vi.fn(),
    };

    stopCallback = vi.fn();
    
    // Mock prisma transaction
    vi.mock('../src/config/prisma', () => ({
      prisma: {
        $transaction: vi.fn().mockImplementation(async (callback) => {
          // Provide a fake tx object with a mock game fetcher to pass the double-check
          const tx = {
            game: {
              findUnique: vi.fn().mockResolvedValue({ status: 'IN_PROGRESS' }),
            }
          };
          return callback(tx);
        })
      }
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.resetModules(); // Important to clear the prisma mock
  });

  it('should schedule and execute number calls', async () => {
    const caller = new NumberCaller('game-1', 5000, mockCalledNumRepo, mockGameRepo, mockEmitter, stopCallback);
    
    caller.start();
    expect(caller.isRunning).toBe(true);

    // Fast forward 5 seconds
    await vi.advanceTimersByTimeAsync(5000);

    // It should have fetched game and called numbers, then created one
    expect(mockGameRepo.findById).toHaveBeenCalledWith('game-1');
    expect(mockCalledNumRepo.findByGameId).toHaveBeenCalledWith('game-1');
    expect(mockCalledNumRepo.createCalledNumber).toHaveBeenCalled();
    expect(mockEmitter.emitNumberCalled).toHaveBeenCalled();

    // Check the payload passed to emit
    const emitArgs = mockEmitter.emitNumberCalled.mock.calls[0];
    expect(emitArgs[0]).toBe('game-1');
    expect(emitArgs[1].number).toBeGreaterThanOrEqual(1);
    expect(emitArgs[1].number).toBeLessThanOrEqual(90);
    expect(emitArgs[1].sequence).toBe(1);

    caller.stop();
  });

  it('should not call the same number twice', async () => {
    // Mock that all numbers except 90 are already called
    const existingCalls = Array.from({ length: 89 }, (_, i) => ({ number: i + 1, sequence: i + 1 }));
    mockCalledNumRepo.findByGameId.mockResolvedValue(existingCalls);

    const caller = new NumberCaller('game-1', 5000, mockCalledNumRepo, mockGameRepo, mockEmitter, stopCallback);
    caller.start();

    await vi.advanceTimersByTimeAsync(5000);

    expect(mockCalledNumRepo.createCalledNumber).toHaveBeenCalled();
    const createArgs = mockCalledNumRepo.createCalledNumber.mock.calls[0];
    
    // Only number 90 should be available
    expect(createArgs[2]).toBe(90); // number
    expect(createArgs[3]).toBe(90); // sequence

    caller.stop();
  });

  it('should stop automatically if all 90 numbers are called', async () => {
    // Mock that all 90 numbers are already called
    const existingCalls = Array.from({ length: 90 }, (_, i) => ({ number: i + 1, sequence: i + 1 }));
    mockCalledNumRepo.findByGameId.mockResolvedValue(existingCalls);

    const caller = new NumberCaller('game-1', 5000, mockCalledNumRepo, mockGameRepo, mockEmitter, stopCallback);
    caller.start();

    await vi.advanceTimersByTimeAsync(5000);

    expect(mockCalledNumRepo.createCalledNumber).not.toHaveBeenCalled();
    expect(caller.isRunning).toBe(false);
    expect(stopCallback).toHaveBeenCalledWith('game-1');
  });

  it('should stop automatically if game is no longer IN_PROGRESS', async () => {
    mockGameRepo.findById.mockResolvedValue({ id: 'game-1', status: 'FINISHED' });

    const caller = new NumberCaller('game-1', 5000, mockCalledNumRepo, mockGameRepo, mockEmitter, stopCallback);
    caller.start();

    await vi.advanceTimersByTimeAsync(5000);

    expect(mockCalledNumRepo.findByGameId).not.toHaveBeenCalled();
    expect(mockCalledNumRepo.createCalledNumber).not.toHaveBeenCalled();
    expect(caller.isRunning).toBe(false);
    expect(stopCallback).toHaveBeenCalledWith('game-1');
  });

  it('should ignore P2002 duplicate sequence errors and retry on next tick', async () => {
    // Mock a P2002 error on the first call
    mockCalledNumRepo.createCalledNumber.mockRejectedValueOnce({ code: 'P2002' });
    
    const caller = new NumberCaller('game-1', 5000, mockCalledNumRepo, mockGameRepo, mockEmitter, stopCallback);
    caller.start();

    // First tick causes P2002
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockEmitter.emitNumberCalled).not.toHaveBeenCalled(); // Should not emit if failed
    expect(caller.isRunning).toBe(true); // Should keep running to retry

    // Second tick should succeed
    mockCalledNumRepo.createCalledNumber.mockResolvedValueOnce({ gameId: 'game-1', number: 42, sequence: 1, calledAt: new Date() });
    await vi.advanceTimersByTimeAsync(5000);
    expect(mockEmitter.emitNumberCalled).toHaveBeenCalled();

    caller.stop();
  });
});
