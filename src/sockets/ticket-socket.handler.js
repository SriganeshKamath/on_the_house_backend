const { TicketService } = require('../services/ticket-service');
const { z } = require('zod');

const ticketService = new TicketService();

const markTicketSchema = z.object({
  code: z.string().min(1),
  number: z.number().int().min(1).max(90),
});

function registerTicketHandlers(io, socket) {
  socket.on('ticket:mark', async (payload, callback) => {
    try {
      const parsed = markTicketSchema.safeParse(payload);
      if (!parsed.success) {
        const errPayload = { error: { message: 'Invalid marking payload.' } };
        if (typeof callback === 'function') callback(errPayload);
        return;
      }

      const { code, number } = parsed.data;
      
      const result = await ticketService.markNumber(code, socket.user.id, number);
      
      if (typeof callback === 'function') callback({ data: result });
      // The service will also emit 'ticket:marked' via emitTicketMarked
    } catch (error) {
      const errPayload = { error: { message: error.message || 'Failed to mark ticket.' } };
      if (typeof callback === 'function') callback(errPayload);
      // We don't emit error events broadly to avoid leaking state, just respond to the callback.
    }
  });
}

module.exports = { registerTicketHandlers };
