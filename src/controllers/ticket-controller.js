const { TicketService } = require('../services/ticket-service');

const ticketService = new TicketService();

async function getTicket(request, response, next) {
  try {
    const { code } = request.validatedParams;
    const ticket = await ticketService.getTicket(code, request.user.id);
    response.status(200).json({ data: { ticket } });
  } catch (error) {
    next(error);
  }
}

async function markTicketNumber(request, response, next) {
  try {
    const { code } = request.validatedParams;
    const { number } = request.validatedBody;
    
    const result = await ticketService.markNumber(code, request.user.id, number);
    
    response.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTicket,
  markTicketNumber,
};
