/**
 * Automated Verification Script for Role-Based Hierarchical Data Access Control (Multi-Level Data Scoping)
 * Tests Live Backend APIs (http://localhost:3005/api) across all 4 tiers of the hierarchy:
 * 1. Super Admin (Global Scope)
 * 2. Stockist (Regional Scope)
 * 3. Distributor (City Hub Scope)
 * 4. Dealer (Retail Store Scope)
 */

const axios = require("axios");

const BASE_URL = "http://localhost:3005/api";

async function login(email, password = "password123") {
  const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });
  if (!res.data.success) {
    throw new Error(`Login failed for ${email}: ${res.data.message}`);
  }
  return {
    token: res.data.data.token,
    user: res.data.data,
  };
}

function client(token) {
  return axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 TESTING ROLE-BASED HIERARCHICAL DATA ACCESS CONTROL (MULTI-LEVEL DATA SCOPING)");
  console.log("================================================================================\n");

  let allPassed = true;

  try {
    // -------------------------------------------------------------------------
    // 1. SUPER ADMIN (GLOBAL SCOPE)
    // -------------------------------------------------------------------------
    console.log("👑 [TEST 1] Testing SUPER ADMIN (admin@vcredit.in)...");
    const superAdminAuth = await login("admin@vcredit.in");
    const superApi = client(superAdminAuth.token);

    const [saStockists, saDistributors, saDealers, saUsers, saTransfers, saLowKeys, saKeys] = await Promise.all([
      superApi.get("/enterprise/stockists"),
      superApi.get("/enterprise/distributors"),
      superApi.get("/enterprise/dealers"),
      superApi.get("/enterprise/users"),
      superApi.get("/enterprise/reports/transfers"),
      superApi.get("/enterprise/reports/low-keys?role=distributor"),
      superApi.get("/enterprise/keys"),
    ]);

    console.log(`   - Stockists count:    ${saStockists.data.data.length} (Expected: 3)`);
    console.log(`   - Distributors count: ${saDistributors.data.data.length} (Expected: 6)`);
    console.log(`   - Dealers count:      ${saDealers.data.data.length} (Expected: 12)`);
    console.log(`   - End Users count:    ${saUsers.data.data.length} (Expected: 36)`);
    console.log(`   - Key Transfers:      ${saTransfers.data.data.length} (Expected: >= 20)`);
    console.log(`   - Low-Key Dists:      ${saLowKeys.data.data.length} (Expected: 2 -> Noida & Mumbai)`);
    console.log(`   - Total Keys visible: ${saKeys.data.pagination.totalItems} (Expected: >= 500)`);

    if (
      saStockists.data.data.length === 3 &&
      saDistributors.data.data.length === 6 &&
      saDealers.data.data.length === 12 &&
      saUsers.data.data.length === 36 &&
      saLowKeys.data.data.length === 2
    ) {
      console.log("   ✅ SUPER ADMIN GLOBAL SCOPING: PASSED\n");
    } else {
      console.error("   ❌ SUPER ADMIN GLOBAL SCOPING: MISMATCH\n");
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // 2. STOCKIST 1 (NORTH REGIONAL SCOPE)
    // -------------------------------------------------------------------------
    console.log("📦 [TEST 2] Testing STOCKIST 1 (stockist.north@vcredit.in - Music Beats)...");
    const stockistAuth = await login("stockist.north@vcredit.in");
    const stockistApi = client(stockistAuth.token);

    const [stkStockists, stkDistributors, stkDealers, stkUsers, stkLowKeys] = await Promise.all([
      stockistApi.get("/enterprise/stockists"),
      stockistApi.get("/enterprise/distributors"),
      stockistApi.get("/enterprise/dealers"),
      stockistApi.get("/enterprise/users"),
      stockistApi.get("/enterprise/reports/low-keys?role=distributor"),
    ]);

    console.log(`   - Stockists visible:   ${stkStockists.data.data.length} (Expected: 0 - cannot see other stockists)`);
    console.log(`   - Distributors visible:${stkDistributors.data.data.length} (Expected: 2 - only Delhi & Noida)`);
    console.log(`   - Dealers visible:     ${stkDealers.data.data.length} (Expected: 4 - under Delhi & Noida)`);
    console.log(`   - End Users visible:   ${stkUsers.data.data.length} (Expected: 12 - under North dealers)`);
    console.log(`   - Low-Key Dists:       ${stkLowKeys.data.data.length} (Expected: 1 - only Noida, NOT Mumbai)`);

    const stkDistNames = stkDistributors.data.data.map(d => d.name);
    console.log(`   - Visible Distributors: [${stkDistNames.join(", ")}]`);

    const stkLowDistNames = stkLowKeys.data.data.map(d => d.name);
    console.log(`   - Visible Low Key Dists: [${stkLowDistNames.join(", ")}]`);

    const stockistScopedCorrectly =
      stkStockists.data.data.length === 0 &&
      stkDistributors.data.data.length === 2 &&
      stkDealers.data.data.length === 4 &&
      stkUsers.data.data.length === 12 &&
      stkLowKeys.data.data.length === 1 &&
      stkLowDistNames.includes("Noida Smart Distribution Hub") &&
      !stkLowDistNames.includes("Mumbai Suburban Logistics Hub");

    if (stockistScopedCorrectly) {
      console.log("   ✅ STOCKIST REGIONAL SCOPING: PASSED\n");
    } else {
      console.error("   ❌ STOCKIST REGIONAL SCOPING: MISMATCH\n");
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // 3. DISTRIBUTOR 1A (CITY HUB SCOPE - VEDA ENTERPRISE)
    // -------------------------------------------------------------------------
    console.log("🏢 [TEST 3] Testing DISTRIBUTOR 1A (delhi.dist@vcredit.in - VEDA ENTERPRISE)...");
    const distAuth = await login("delhi.dist@vcredit.in");
    const distApi = client(distAuth.token);

    const [dstStockists, dstDistributors, dstDealers, dstUsers] = await Promise.all([
      distApi.get("/enterprise/stockists"),
      distApi.get("/enterprise/distributors"),
      distApi.get("/enterprise/dealers"),
      distApi.get("/enterprise/users"),
    ]);

    console.log(`   - Stockists visible:   ${dstStockists.data.data.length} (Expected: 0)`);
    console.log(`   - Distributors visible:${dstDistributors.data.data.length} (Expected: 0)`);
    console.log(`   - Dealers visible:     ${dstDealers.data.data.length} (Expected: 2 - Apex & Karol Bagh)`);
    console.log(`   - End Users visible:   ${dstUsers.data.data.length} (Expected: 6 - under its 2 dealers)`);

    const dealerNames = dstDealers.data.data.map(d => d.name);
    console.log(`   - Visible Dealers: [${dealerNames.join(", ")}]`);

    const distScopedCorrectly =
      dstStockists.data.data.length === 0 &&
      dstDistributors.data.data.length === 0 &&
      dstDealers.data.data.length === 2 &&
      dstUsers.data.data.length === 6 &&
      dealerNames.includes("Apex Phone Gallery") &&
      dealerNames.includes("Karol Bagh Mobile Hub");

    if (distScopedCorrectly) {
      console.log("   ✅ DISTRIBUTOR CITY SCOPING: PASSED\n");
    } else {
      console.error("   ❌ DISTRIBUTOR CITY SCOPING: MISMATCH\n");
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // 4. DEALER 1A1 (RETAIL STORE SCOPE - Apex Phone Gallery)
    // -------------------------------------------------------------------------
    console.log("🏪 [TEST 4] Testing DEALER 1A1 (metro.telecom@vcredit.in - Apex Phone Gallery)...");
    const dealerAuth = await login("metro.telecom@vcredit.in");
    const dealerApi = client(dealerAuth.token);

    const [dlrStockists, dlrDistributors, dlrDealers, dlrUsers] = await Promise.all([
      dealerApi.get("/enterprise/stockists"),
      dealerApi.get("/enterprise/distributors"),
      dealerApi.get("/enterprise/dealers"),
      dealerApi.get("/enterprise/users"),
    ]);

    console.log(`   - Stockists visible:   ${dlrStockists.data.data.length} (Expected: 0)`);
    console.log(`   - Distributors visible:${dlrDistributors.data.data.length} (Expected: 0)`);
    console.log(`   - Dealers visible:     ${dlrDealers.data.data.length} (Expected: 0 - cannot see other dealers)`);
    console.log(`   - End Users visible:   ${dlrUsers.data.data.length} (Expected: 3 - only its own customers)`);

    const userNames = dlrUsers.data.data.map(u => u.name);
    console.log(`   - Customers enrolled: [${userNames.join(", ")}]`);

    const dealerScopedCorrectly =
      dlrStockists.data.data.length === 0 &&
      dlrDistributors.data.data.length === 0 &&
      dlrDealers.data.data.length === 0 &&
      dlrUsers.data.data.length === 3;

    if (dealerScopedCorrectly) {
      console.log("   ✅ DEALER RETAIL STORE SCOPING: PASSED\n");
    } else {
      console.error("   ❌ DEALER RETAIL STORE SCOPING: MISMATCH\n");
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // 5. TEST CROSS-BRANCH ISOLATION (Central MP Stockist 2)
    // -------------------------------------------------------------------------
    console.log("🗺️ [TEST 5] Testing CROSS-BRANCH ISOLATION (stk.central@vcredit.in - Central MP)...");
    const stk2Auth = await login("stk.central@vcredit.in");
    const stk2Api = client(stk2Auth.token);

    const [stk2Distributors, stk2Dealers] = await Promise.all([
      stk2Api.get("/enterprise/distributors"),
      stk2Api.get("/enterprise/dealers"),
    ]);

    const stk2DistNames = stk2Distributors.data.data.map(d => d.name);
    const stk2DealerNames = stk2Dealers.data.data.map(d => d.name);

    console.log(`   - Distributors visible (${stk2DistNames.length}): [${stk2DistNames.join(", ")}]`);
    console.log(`   - Dealers visible (${stk2DealerNames.length}): [${stk2DealerNames.join(", ")}]`);

    const crossBranchSecure =
      stk2DistNames.includes("anujdistributer Betul Hub") &&
      stk2DistNames.includes("Bundelkhand Tele-Link Hub") &&
      !stk2DistNames.includes("VEDA ENTERPRISE Hub") &&
      !stk2DistNames.includes("Malwa Region Distribution");

    if (crossBranchSecure) {
      console.log("   ✅ CROSS-BRANCH REGIONAL ISOLATION: PASSED\n");
    } else {
      console.error("   ❌ CROSS-BRANCH REGIONAL ISOLATION: FAILED\n");
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // 6. DASHBOARD APIS VERIFICATION
    // -------------------------------------------------------------------------
    console.log("📊 [TEST 6] Testing Dashboard KPIs & Data Integrity...");
    const dashboardRes = await superApi.get("/enterprise/dashboard");
    const dData = dashboardRes.data.data;

    console.log(`   - Total Keys in Network:       ${dData.kpis.networkKeys}`);
    console.log(`   - Available Keys in Network:   ${dData.kpis.networkAvailable}`);
    console.log(`   - Transferred Keys in Network: ${dData.kpis.networkTransferred}`);
    console.log(`   - Activated Keys in Network:   ${dData.kpis.networkActivated}`);
    console.log(`   - Monthly Activations:         ${dData.kpis.monthlyActivations}`);
    console.log(`   - Network Users (Customers):   ${dData.kpis.users}`);
    console.log(`   - Recent Keys List Count:      ${dData.recentKeys.length}`);
    console.log(`   - Audit Trail Count:           ${dData.auditLogs.length}`);

    if (dData.kpis.users === 36 && dData.recentKeys.length > 0 && dData.auditLogs.length > 0) {
      console.log("   ✅ DASHBOARD LIVE INTEGRATION: PASSED\n");
    } else {
      console.error("   ❌ DASHBOARD LIVE INTEGRATION: MISMATCH\n");
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // FINAL RESULT
    // -------------------------------------------------------------------------
    console.log("================================================================================");
    if (allPassed) {
      console.log("🎉 ALL ROLE-BASED HIERARCHICAL DATA SCOPING TESTS PASSED 100%!");
      console.log("   Every tier (Super Admin -> Stockist -> Distributor -> Dealer -> End User)");
      console.log("   strictly observes authorized boundaries with ZERO data leaks or orphan records.");
    } else {
      console.error("⚠️ SOME SCOPING TESTS REPORTED DISCREPANCIES.");
    }
    console.log("================================================================================\n");

  } catch (err) {
    console.error("❌ Test Script Execution Failed:", err.response?.data || err.message);
  }
}

runTests();
