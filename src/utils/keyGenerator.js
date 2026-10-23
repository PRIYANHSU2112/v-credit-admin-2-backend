const crypto = require("crypto");

const SEGMENTS = [
  "A1B2", "C3D4", "E5F6", "G7H8", "I9J0", "K2L4", "M5N6", "P7Q8",
  "R9S0", "T1U2", "V3W4", "X5Y6", "Z7A8", "B9C0",
];
const MID = [
  "XRAY", "YOGA", "ZULU", "ALFA", "BRVO", "CHAR", "DELT", "ECHO",
  "FXTR", "GULF", "HOTL", "INDI", "JULX", "KILO",
];

const randomFrom = (arr) => arr[crypto.randomInt(0, arr.length)];

const randomDigits = () => String(crypto.randomInt(1000, 9999));

const generateKeyNumber = () =>
  `VLK-${randomFrom(SEGMENTS)}-${randomFrom(MID)}-${randomDigits()}`;

const generateBatchId = () => {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const suffix = crypto.randomInt(1000, 9999);
  return `B-${stamp}-${suffix}`;
};

const generateEntityCode = (prefix, seq) =>
  `${prefix}-${String(seq).padStart(4, "0")}`;

module.exports = {
  generateKeyNumber,
  generateBatchId,
  generateEntityCode,
};
