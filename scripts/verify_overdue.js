const {
  calculateOverdueDays,
  calculateLateFee,
  calculateTotalInstallmentDue,
} = require("./src/utils/overdueUtils");

console.log("--- Overdue Logic Verification Tests ---");

const testCases = [
  { days: 0, expectedFee: 0 },
  { days: 1, expectedFee: 400 },
  { days: 3, expectedFee: 400 },
  { days: 4, expectedFee: 600 },
  { days: 7, expectedFee: 600 },
  { days: 8, expectedFee: 800 },
  { days: 15, expectedFee: 800 },
  { days: 16, expectedFee: 1000 },
];

console.log("\nTesting calculateLateFee:");
testCases.forEach(({ days, expectedFee }) => {
  const result = calculateLateFee(days);
  const status = result === expectedFee ? "✅ PASS" : "❌ FAIL";
  console.log(
    `Days: ${days.toString().padStart(2)}, Expected: ${expectedFee.toString().padStart(4)}, Result: ${result.toString().padStart(4)} ${status}`,
  );
});

console.log("\nTesting calculateTotalInstallmentDue:");
const inst = {
  amount: 2000,
  lateFee: 600,
  bounceFee: 400,
  paidAmount: 500,
};
const expectedTotal = 2500; // (2000 + 600 + 400) - 500
const totalResult = calculateTotalInstallmentDue(inst);
console.log(
  `Status: ${totalResult === expectedTotal ? "✅ PASS" : "❌ FAIL"} (Expected ${expectedTotal}, Got ${totalResult})`,
);

console.log("\nTesting calculateOverdueDays:");
const now = new Date();
const fourDaysAgo = new Date(now);
fourDaysAgo.setDate(now.getDate() - 4);

const overdueResult = calculateOverdueDays(fourDaysAgo, now);
console.log(
  `Status: ${overdueResult === 4 ? "✅ PASS" : "❌ FAIL"} (Expected 4, Got ${overdueResult})`,
);

console.log("\n--- Verification Finished ---");
