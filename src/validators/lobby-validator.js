const { z } = require('zod');

const createLobbySchema = z
  .object({
    numberCallingInterval: z.number().int().min(5).max(30).optional(),
    houseToFollowCount: z.number().int().min(1).optional(),
  })
  .optional()
  .default({});

const codeParamSchema = z.object({
  code: z
    .string({ required_error: 'Game code is required.' })
    .trim()
    .min(1, 'Game code cannot be empty.')
    .toUpperCase(),
});

const updateSettingsSchema = z
  .object({
    numberCallingInterval: z.number().int().min(5).max(30).optional(),
    houseToFollowCount: z.number().int().min(1).optional(),
  })
  .refine(
    (data) => data.numberCallingInterval !== undefined || data.houseToFollowCount !== undefined,
    { message: 'At least one setting (numberCallingInterval or houseToFollowCount) must be provided.' },
  );

module.exports = {
  createLobbySchema,
  codeParamSchema,
  updateSettingsSchema,
};
