const crypto = require('node:crypto');
const { COLUMN_RANGES } = require('../../evaluation/ticket/ticket-validator');

function getRandomInt(min, max) {
  const range = max - min + 1;
  const bytes = crypto.randomBytes(4);
  const randomUint = bytes.readUInt32BE(0);
  return min + (randomUint % range);
}

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = getRandomInt(0, i);
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

function generateLayout() {
  const maxAttempts = 100;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const colCounts = [1, 1, 1, 1, 1, 1, 1, 1, 1];
    let extraCells = 6;

    while (extraCells > 0) {
      const col = getRandomInt(0, 8);
      if (colCounts[col] < 3) {
        colCounts[col] += 1;
        extraCells -= 1;
      }
    }

    const rowCounts = [0, 0, 0];
    const grid = Array.from({ length: 3 }, () => Array(9).fill(false));
    let validLayout = true;

    for (let c = 0; c < 9; c += 1) {
      const count = colCounts[c];
      const possibleRows = shuffleArray([0, 1, 2]).slice(0, count);

      for (const r of possibleRows) {
        grid[r][c] = true;
        rowCounts[r] += 1;
      }
    }

    if (rowCounts[0] === 5 && rowCounts[1] === 5 && rowCounts[2] === 5) {
      return grid;
    }
  }

  // Deterministic fallback layout guaranteed to satisfy 5-5-5 row count and 1..3 col count
  return [
    [true, true, true, true, true, false, false, false, false],
    [false, false, true, true, true, true, true, false, false],
    [true, false, false, false, false, true, true, true, true],
  ];
}

function generateTicket() {
  const grid = generateLayout();
  const ticketNumbers = [];

  for (let c = 0; c < 9; c += 1) {
    const occupiedRows = [];
    for (let r = 0; r < 3; r += 1) {
      if (grid[r][c]) {
        occupiedRows.push(r);
      }
    }

    const range = COLUMN_RANGES[c];
    const availableNumbers = [];
    for (let num = range.min; num <= range.max; num += 1) {
      availableNumbers.push(num);
    }

    const shuffled = shuffleArray(availableNumbers);
    const selected = shuffled.slice(0, occupiedRows.length).sort((a, b) => a - b);

    for (let i = 0; i < occupiedRows.length; i += 1) {
      ticketNumbers.push({
        row: occupiedRows[i],
        column: c,
        number: selected[i],
        marked: false,
      });
    }
  }

  return ticketNumbers.sort((a, b) => a.row - b.row || a.column - b.column);
}

module.exports = { generateTicket };
