const COLUMN_RANGES = [
  { min: 1, max: 9 },    // Column 0
  { min: 10, max: 19 },  // Column 1
  { min: 20, max: 29 },  // Column 2
  { min: 30, max: 39 },  // Column 3
  { min: 40, max: 49 },  // Column 4
  { min: 50, max: 59 },  // Column 5
  { min: 60, max: 69 },  // Column 6
  { min: 70, max: 79 },  // Column 7
  { min: 80, max: 90 },  // Column 8
];

function validateTicket(ticketInput) {
  const errors = [];

  const numbers = Array.isArray(ticketInput)
    ? ticketInput
    : ticketInput && Array.isArray(ticketInput.numbers)
      ? ticketInput.numbers
      : null;

  if (!numbers) {
    return { valid: false, errors: ['Ticket numbers must be an array.'] };
  }

  if (numbers.length !== 15) {
    errors.push(`Ticket must contain exactly 15 numbers, found ${numbers.length}.`);
  }

  const rowCounts = [0, 0, 0];
  const colOccupants = Array.from({ length: 9 }, () => []);
  const seenNumbers = new Set();
  const seenPositions = new Set();

  for (let i = 0; i < numbers.length; i += 1) {
    const item = numbers[i];

    if (!item || typeof item !== 'object') {
      errors.push(`Invalid ticket cell item at index ${i}.`);
      continue;
    }

    const { row, column, number, marked } = item;

    if (!Number.isInteger(row) || row < 0 || row > 2) {
      errors.push(`Invalid row index '${row}' at index ${i}. Must be 0, 1, or 2.`);
    } else {
      rowCounts[row] += 1;
    }

    if (!Number.isInteger(column) || column < 0 || column > 8) {
      errors.push(`Invalid column index '${column}' at index ${i}. Must be 0 to 8.`);
    } else {
      colOccupants[column].push(item);
    }

    if (!Number.isInteger(number) || number < 1 || number > 90) {
      errors.push(`Invalid number value '${number}' at index ${i}. Must be integer 1 to 90.`);
    } else if (Number.isInteger(column) && column >= 0 && column <= 8) {
      const range = COLUMN_RANGES[column];
      if (number < range.min || number > range.max) {
        errors.push(`Number ${number} in column ${column} is outside allowed range (${range.min}-${range.max}).`);
      }
    }

    if (seenNumbers.has(number)) {
      errors.push(`Duplicate number '${number}' found on ticket.`);
    } else {
      seenNumbers.add(number);
    }

    const posKey = `${row},${column}`;
    if (seenPositions.has(posKey)) {
      errors.push(`Duplicate position (${row}, ${column}) found on ticket.`);
    } else {
      seenPositions.add(posKey);
    }

    if (marked !== false) {
      errors.push(`Generated number ${number} at position (${row}, ${column}) must be unmarked (marked: false).`);
    }
  }

  for (let r = 0; r < 3; r += 1) {
    if (rowCounts[r] !== 5) {
      errors.push(`Row ${r} must contain exactly 5 numbers, found ${rowCounts[r]}.`);
    }
  }

  for (let c = 0; c < 9; c += 1) {
    const colCells = colOccupants[c];
    if (colCells.length === 0) {
      errors.push(`Column ${c} must contain at least 1 number.`);
    }
    if (colCells.length > 3) {
      errors.push(`Column ${c} cannot contain more than 3 numbers, found ${colCells.length}.`);
    }

    colCells.sort((a, b) => a.row - b.row);
    for (let j = 0; j < colCells.length - 1; j += 1) {
      if (colCells[j].number >= colCells[j + 1].number) {
        errors.push(
          `Column ${c} numbers are not strictly increasing from top to bottom: row ${colCells[j].row} has ${colCells[j].number}, row ${colCells[j + 1].row} has ${colCells[j + 1].number}.`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = { validateTicket, COLUMN_RANGES };
