const { Router } = require('express');
const {
  createLobby,
  getLobby,
  joinLobby,
  leaveLobby,
  updateSettings,
} = require('../../controllers/lobby-controller');
const { startGame, getGame } = require('../../controllers/game-controller');
const { getTicket, markTicketNumber } = require('../../controllers/ticket-controller');
const { authenticate } = require('../../middleware/authenticate');
const { validateBody, validateParams } = require('../../validators/request-validator');
const {
  createLobbySchema,
  codeParamSchema,
  updateSettingsSchema,
  markTicketSchema,
} = require('../../validators/lobby-validator');

const lobbyRouter = Router();

// All lobby routes require authentication
lobbyRouter.use(authenticate);

lobbyRouter.post('/', validateBody(createLobbySchema), createLobby);
lobbyRouter.get('/:code', validateParams(codeParamSchema), getLobby);
lobbyRouter.post('/:code/join', validateParams(codeParamSchema), joinLobby);
lobbyRouter.post('/:code/leave', validateParams(codeParamSchema), leaveLobby);
lobbyRouter.patch(
  '/:code/settings',
  validateParams(codeParamSchema),
  validateBody(updateSettingsSchema),
  updateSettings,
);
lobbyRouter.post('/:code/start', validateParams(codeParamSchema), startGame);
lobbyRouter.get('/:code/game', validateParams(codeParamSchema), getGame);
lobbyRouter.get('/:code/ticket', validateParams(codeParamSchema), getTicket);
lobbyRouter.post(
  '/:code/ticket/mark',
  validateParams(codeParamSchema),
  validateBody(markTicketSchema),
  markTicketNumber
);

module.exports = { lobbyRouter };

