ALTER TABLE "Lobby"
  ADD CONSTRAINT "Lobby_numberCallingInterval_range"
  CHECK ("numberCallingInterval" IS NULL OR "numberCallingInterval" BETWEEN 5 AND 30),
  ADD CONSTRAINT "Lobby_houseToFollowCount_minimum"
  CHECK ("houseToFollowCount" IS NULL OR "houseToFollowCount" >= 1);

ALTER TABLE "GameSettings"
  ADD CONSTRAINT "GameSettings_numberCallingInterval_range"
  CHECK ("numberCallingInterval" BETWEEN 5 AND 30),
  ADD CONSTRAINT "GameSettings_houseToFollowCount_minimum"
  CHECK ("houseToFollowCount" >= 1);

ALTER TABLE "TicketNumber"
  ADD CONSTRAINT "TicketNumber_row_range"
  CHECK ("row" BETWEEN 0 AND 2),
  ADD CONSTRAINT "TicketNumber_column_range"
  CHECK ("column" BETWEEN 0 AND 8),
  ADD CONSTRAINT "TicketNumber_number_range"
  CHECK ("number" BETWEEN 1 AND 90);

ALTER TABLE "CalledNumber"
  ADD CONSTRAINT "CalledNumber_number_range"
  CHECK ("number" BETWEEN 1 AND 90),
  ADD CONSTRAINT "CalledNumber_sequence_minimum"
  CHECK ("sequence" >= 1);

ALTER TABLE "PrizeClaim"
  ADD CONSTRAINT "PrizeClaim_points_nonnegative"
  CHECK ("points" >= 0),
  ADD CONSTRAINT "PrizeClaim_sequence_by_type"
  CHECK (
    ("prizeType" = 'HOUSE_TO_FOLLOW' AND "sequence" >= 1)
    OR ("prizeType" <> 'HOUSE_TO_FOLLOW' AND "sequence" = 0)
  );

CREATE UNIQUE INDEX "PrizeClaim_one_row_per_game_player"
  ON "PrizeClaim" ("gamePlayerId")
  WHERE "prizeType" IN ('FIRST_ROW', 'SECOND_ROW', 'THIRD_ROW');

CREATE UNIQUE INDEX "PrizeClaim_one_house_to_follow_per_game_player"
  ON "PrizeClaim" ("gamePlayerId")
  WHERE "prizeType" = 'HOUSE_TO_FOLLOW';
