const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const {
  loadEnterpriseUser,
  requireEnterpriseRole,
  loginAs,
} = require("../middleware/enterprise.middleware");
const ctrl = require("../controllers/enterprise.controller");

const router = express.Router();

router.use(authMiddleware, loadEnterpriseUser);

// Session
router.get("/me", ctrl.getMe);

// Dashboard
router.get("/dashboard", ctrl.getDashboard);

// Keys
router.get("/keys", ctrl.listKeys);
router.post("/keys/generate", requireEnterpriseRole("super_admin"), ctrl.generateKeyBatch);
router.post("/keys/transfer", ctrl.transferKeyBatch);
router.post("/keys/reclaim", ctrl.reclaimKeyBatch);
router.post("/keys/activate", ctrl.activateKeyForCustomer);

// Hierarchy
router.get("/stockists", ctrl.getStockists);
router.post("/stockists", requireEnterpriseRole("super_admin"), ctrl.createStockist);
router.get("/distributors", ctrl.getDistributors);
router.post("/distributors", requireEnterpriseRole("super_admin", "stockist"), ctrl.createDistributor);
router.get("/dealers", ctrl.getDealers);
router.post("/dealers", requireEnterpriseRole("super_admin", "stockist", "distributor"), ctrl.createDealer);
router.patch(
  "/users/:userId/password",
  requireEnterpriseRole("super_admin", "stockist", "distributor"),
  ctrl.resetEnterpriseUserPassword,
);

// Inventory & audit
router.get("/inventory", ctrl.getInventory);
router.get("/audit", ctrl.getAuditLogs);
router.get("/notifications", ctrl.getNotifications);

// Users, territories, commissions, analytics, reports, settings, search
router.get("/users", ctrl.getEndUsers);
router.get("/territories", ctrl.getTerritories);
router.get("/commissions", ctrl.getCommissions);
router.patch("/commissions/rates", requireEnterpriseRole("super_admin"), ctrl.updateCommissionRates);
router.get("/analytics", ctrl.getAnalytics);
router.get("/settings", ctrl.getSettings);
router.patch("/settings", ctrl.updateSettings);
router.get("/reports", ctrl.getReports);
router.get("/reports/transfers", ctrl.getTransferReports);
router.get("/reports/low-keys", ctrl.getLowKeyReports);
router.get("/search", ctrl.globalSearch);

// Impersonation (Login As)
router.post("/login-as", loginAs);

module.exports = router;
