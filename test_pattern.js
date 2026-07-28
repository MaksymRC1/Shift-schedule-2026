const REF_DATE_UTC = Date.UTC(2026, 0, 1);
const CYCLE_PATTERN = [1, 1, 1, null, null, 3, 3, 3, null, null, 2, 2, 2, null, null];
const SHIFT_BASE_INDICES = { "А": 2, "Б": 11, "В": 8, "Г": 5, "Д": 14 };

function getShift(shiftGroup, year, monthIdx, day) {
  const targetUtc = Date.UTC(year, monthIdx, day);
  const diffDays = Math.round((targetUtc - REF_DATE_UTC) / (86400 * 1000));
  const baseIdx = SHIFT_BASE_INDICES[shiftGroup];
  const cycleIdx = ((baseIdx + diffDays) % 15 + 15) % 15;
  return CYCLE_PATTERN[cycleIdx];
}

function printMonth(monthIdx, daysInMonth) {
  console.log("Month:", monthIdx + 1);
  for (let s of ["А", "Б", "В", "Г", "Д"]) {
    let str = `${s} `;
    for (let d = 1; d <= daysInMonth; d++) {
      let shift = getShift(s, 2026, monthIdx, d);
      str += shift ? shift : "-";
    }
    console.log(str);
  }
}

printMonth(0, 31); // Jan
console.log("----------------")
printMonth(1, 28); // Feb
