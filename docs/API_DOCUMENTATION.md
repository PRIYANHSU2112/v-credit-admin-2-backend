# VLocker & V-Credit Complete API Documentation

> **Backend Source Code:** `Vlocker-Backend-main`  
> **Target Frontend Applications:** `v-credit-new-admin`, `v-credit-Admin`, `VLocker Mobile / MDM Device App`  
> **Document Purpose:** Single source of truth containing exhaustive backend route specifications, controller logic, schemas, and integration guidance for the Admin Panel, as well as a complete catalogue of User App endpoints.

---

# Table of Contents
1. [Architectural Overview & Global Standards](#1-architectural-overview--global-standards)
   - [Base URLs & Environment](#11-base-urls--environment)
   - [Authentication & Role Hierarchy](#12-authentication--role-hierarchy)
   - [Global Request & Response Standards](#13-global-request--response-standards)
2. [SECTION I: Admin Panel APIs (Complete Integration Specification)](#section-i-admin-panel-apis-complete-integration-specification)
   - [Module 1: Authentication, Session & Impersonation](#module-1-authentication-session--impersonation)
   - [Module 2: Enterprise Dashboard & Platform Analytics](#module-2-enterprise-dashboard--platform-analytics)
   - [Module 3: Partner Hierarchy Management (Stockists, Distributors, Dealers)](#module-3-partner-hierarchy-management-stockists-distributors-dealers)
   - [Module 4: License Key Operations & Inventory](#module-4-license-key-operations--inventory)
   - [Module 5: Customer Directory & Document KYC](#module-5-customer-directory--document-kyc)
   - [Module 6: Customer Loan Origination & Lifecycle](#module-6-customer-loan-origination--lifecycle)
   - [Module 7: Device Inventory, MDM Telemetry & Remote Control](#module-7-device-inventory-mdm-telemetry--remote-control)
   - [Module 8: Payment Gateway & Razorpay Collections](#module-8-payment-gateway--razorpay-collections)
   - [Module 9: Customer Address & Banking Master](#module-9-customer-address--banking-master)
   - [Module 10: Territory & Commission Management](#module-10-territory--commission-management)
   - [Module 11: Reports & Audit Trails](#module-11-reports--audit-trails)
   - [Module 12: Master Settings & Reference Data](#module-12-master-settings--reference-data)
   - [Module 13: Zero-Touch / QR Device Provisioning](#module-13-zero-touch--qr-device-provisioning)
3. [SECTION II: User & Mobile App APIs](#section-ii-user--mobile-app-apis)
4. [SECTION III: Frontend-to-Backend Gap Analysis & Missing APIs](#section-iii-frontend-to-backend-gap-analysis--missing-apis)

---

# 1. Architectural Overview & Global Standards

### 1.1 Base URLs & Environment
- **Local Development Base URL:** `http://localhost:5000` (or `http://localhost:3005` / `http://localhost:8000`)
- **Production Base URL:** `https://api.vlocker.in`
- **Reverse Proxy:** Behind reverse proxy (`trust proxy: 1`), with standard rate limiting (dev: 5000 req/min, prod: 300 req/min).
- **CORS:** Configured with `credentials: true`. Allowed headers: `Content-Type`, `Authorization`.

### 1.2 Authentication & Role Hierarchy
The backend uses **JSON Web Tokens (JWT)** passed via HTTP Authorization header:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

#### Enterprise Role Hierarchy:
```
super_admin (Super Admin)
     │
     ▼
stockist (Stockist / State Head)
     │
     ▼
distributor (Distributor / City Hub)
     │
     ▼
dealer (Dealer / Retail Merchant)
     │
     ▼
user (Customer / Financed Device App)
```

#### JWT Claims Structure:
```json
{
  "userId": "6708ab9e1234567890abcdef",
  "role": "admin",
  "enterpriseRole": "super_admin",
  "loginMode": "dealer",
  "iat": 1728892800,
  "exp": 1729497600
}
```

- **Data Scoping Rule:**
  - `super_admin`: Full global visibility across all partners, customers, loans, keys, and devices. May inspect any downstream user scope by appending query param `?userId=<TARGET_USER_ID>`.
  - `stockist`: Restricted to self + downstream distributors, dealers, and customers.
  - `distributor`: Restricted to self + downstream dealers and customers.
  - `dealer`: Restricted strictly to customers and devices created directly by the dealer.

### 1.3 Global Request & Response Standards
All API response payloads adhere to consistent JSON structures:

**Success Response (200 / 201):**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 48
  }
}
```

**Standard Error Response (400 / 401 / 403 / 404 / 500):**
```json
{
  "success": false,
  "message": "Descriptive error message",
  "error": "Detailed internal error in non-production mode"
}
```

---

# SECTION I: Admin Panel APIs (Complete Integration Specification)

---

## Module 1: Authentication, Session & Impersonation

### 1.1 Admin & Partner Login
- **API Name:** Admin Login
- **Purpose:** Authenticate platform Super Admins, Stockists, Distributors, Dealers, and Employees using email & password.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/auth/login`
- **Authentication:** Public (No token required)
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "email": "superadmin@vcredit.com",
    "password": "SecurePassword@123",
    "enterpriseRole": "super_admin"
  }
  ```
  *Validation Rules:*
  - `email` (string, required, valid email format)
  - `password` (string, required)
  - `enterpriseRole` (string, optional: `"super_admin"` | `"stockist"` | `"distributor"` | `"dealer"`)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "id": "6708ab9e1234567890abcdef",
      "name": "Super Admin",
      "email": "superadmin@vcredit.com",
      "phone": "9876543210",
      "role": "admin",
      "enterpriseRole": "super_admin",
      "entityCode": "SA-001",
      "city": "Mumbai",
      "keys": 5000,
      "isProfileCompleted": true,
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{"success": false, "message": "Please provide email and password"}`
  - `401 Unauthorized`: `{"success": false, "message": "Invalid credentials"}`
  - `403 Forbidden`: `{"success": false, "message": "Account has been deactivated"}`
- **Admin Panel Integration:**
  - **Page:** `/login` (`LoginPage.tsx`)
  - **Action:** Submitting the main credential login form. Stores `token` into Redux auth slice (`state.auth.token`) and `localStorage.setItem('vcredit_token', token)`.

---

### 1.2 Enterprise Session Profile (Me)
- **API Name:** Get Enterprise Session
- **Purpose:** Fetches currently authenticated user details, permissions, entity code, and real-time key balance for navbar and layout bootstrap.
- **HTTP Method:** `GET`
- **Endpoint:** `/api/enterprise/me`
- **Authentication:** Bearer JWT required (`loadEnterpriseUser`)
- **Headers:** `Authorization: Bearer <token>`
- **Query / Path Parameters:** None
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "6708ab9e1234567890abcdef",
      "name": "Rohit Verma",
      "email": "rohit@vcredit.com",
      "phone": "9812345678",
      "role": "admin",
      "enterpriseRole": "stockist",
      "keys": 1450,
      "territory": "North India",
      "city": "Ludhiana",
      "entityCode": "STK-1004",
      "enterpriseStatus": "Active"
    }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** Global Layout (`AppLayout.tsx`, `Navbar.tsx`, `Sidebar.tsx`)
  - **Action:** Called on initial app load after login to verify token validity and display role badge, entity code, and available key balance.

---

### 1.3 Partner Impersonation (Login As)
- **API Name:** Login As Downstream Partner
- **Purpose:** Allows Super Admins, Stockists, and Distributors to impersonate a downstream partner without knowing their password for debugging and support.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/enterprise/login-as`
- **Authentication:** Bearer JWT required (`requireEnterpriseRole("super_admin", "stockist", "distributor")`)
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "targetUserId": "6709bc8f1234567890fedcba",
    "reason": "Debugging key allocation discrepancy reported by dealer"
  }
  ```
  *Validation Rules:*
  - `targetUserId` (24-char hex Mongo ObjectId, required)
  - `reason` (string, optional, logged in AuditLog)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.impersonation...",
    "user": {
      "id": "6709bc8f1234567890fedcba",
      "name": "Metro Mobiles",
      "email": "dealer@metromobiles.com",
      "enterpriseRole": "dealer"
    },
    "impersonatedBy": {
      "id": "6708ab9e1234567890abcdef",
      "name": "Super Admin"
    }
  }
  ```
- **Error Responses:**
  - `403 Forbidden`: `{"success": false, "message": "Target not in your hierarchy"}`
  - `404 Not Found`: `{"success": false, "message": "Target user not found"}`
- **Admin Panel Integration:**
  - **Page:** `/app/partners`, `/app/distributors`, `/app/dealers` (`DealersPage.tsx`)
  - **Action:** "Login As" action button in the partner table action dropdown. Swaps local auth token with the returned impersonation token and refreshes dashboard.

---

### 1.4 Ban / Suspension Status Check
- **API Name:** Check Ban Status
- **Purpose:** Look up whether a customer or user account is currently banned or suspended.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/auth/check-ban`
- **Authentication:** Public / Internal
- **Request Body:**
  ```json
  {
    "phone": "9876543210"
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "found": true,
    "phone": "9876543210",
    "name": "Amit Sharma",
    "isBanned": false,
    "isDisabled": false,
    "message": "Account is currently ACTIVE"
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/user-search` (`UserSearchPage.tsx`)
  - **Action:** Phone search bar ban status badge.

---

### 1.5 Toggle Account Ban by Phone
- **API Name:** Toggle Ban by Phone
- **Purpose:** Immediately ban or activate a customer and user account by 10-digit mobile number.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/auth/toggle-ban`
- **Authentication:** Bearer JWT required
- **Request Body:**
  ```json
  {
    "phone": "9876543210",
    "isBanned": true
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "phone": "9876543210",
    "isBanned": true,
    "isDisabled": true,
    "message": "Account +91 9876543210 has been BANNED / SUSPENDED successfully."
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/user-search`, `/app/users`
  - **Action:** "Ban Account" / "Unban Account" toggle button in customer details sheet.

---

## Module 2: Enterprise Dashboard & Platform Analytics

### 2.1 Enterprise Scoped Dashboard
- **API Name:** Get Enterprise Dashboard
- **Purpose:** Returns complete platform KPI counts, monthly activation trend, key status pie-chart breakdown, recent key ledger, audit feed, low-inventory notifications, and hierarchy preview cards.
- **HTTP Method:** `GET`
- **Endpoint:** `/api/enterprise/dashboard`
- **Authentication:** Bearer JWT required (`loadEnterpriseUser`)
- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:**
  - `userId` (string, optional, Super Admin only: view dashboard as another partner)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "kpis": {
        "totalKeys": 15000,
        "availableKeys": 4200,
        "allocatedKeys": 10800,
        "activatedKeys": 8900,
        "activeDevices": 8650,
        "lockedDevices": 250,
        "networkStockists": 12,
        "networkDistributors": 45,
        "networkDealers": 380,
        "users": 8900
      },
      "activationTrend": [
        { "month": "Jan", "activations": 450, "transfers": 1200, "revenue": 112500 },
        { "month": "Feb", "activations": 620, "transfers": 1800, "revenue": 155000 },
        { "month": "Mar", "activations": 940, "transfers": 2400, "revenue": 235000 }
      ],
      "keyStatusBreakdown": [
        { "name": "Activated", "value": 8900, "color": "var(--color-chart-2)" },
        { "name": "Generated", "value": 1200, "color": "var(--color-chart-1)" },
        { "name": "Transferred", "value": 3000, "color": "var(--color-chart-5)" },
        { "name": "Expired", "value": 150, "color": "var(--color-chart-3)" },
        { "name": "Locked", "value": 250, "color": "var(--color-chart-4)" }
      ],
      "recentKeys": [
        { "key": "VC-8921-9041", "owner": "Metro Mobiles", "status": "Activated", "updated": "12m ago" }
      ],
      "auditLogs": [
        { "time": "5m ago", "actor": "Super Admin", "role": "super_admin", "action": "Generated 500 keys", "target": "Batch #B-9021", "severity": "info" }
      ],
      "notifications": [
        { "title": "Low inventory", "desc": "City Cell Care has only 12 keys left.", "time": "1h ago", "type": "warning" }
      ],
      "stockists": [],
      "distributors": [],
      "dealers": []
    }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/overview` (`DashboardPage.tsx`)
  - **Section:** Top metric cards, Area Chart (Monthly Activations vs Transfers), Donut Chart (Key Status Breakdown), Recent Key Activity Table, and Quick Hierarchy Grid.

---

### 2.2 Global Network Analytics
- **API Name:** Get Network Analytics
- **Purpose:** Geographical distribution of activated devices and customers grouped by city/state.
- **HTTP Method:** `GET`
- **Endpoint:** `/api/enterprise/analytics`
- **Authentication:** Bearer JWT required
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "cities": [
        { "city": "Mumbai", "value": 1420 },
        { "city": "Delhi NCR", "value": 1180 },
        { "city": "Ludhiana", "value": 890 },
        { "city": "Jaipur", "value": 640 }
      ]
    }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/analytics` (`AnalyticsPage.tsx`)
  - **Section:** Geographic density bar chart and city leaderboard.

---

### 2.3 System Global Search
- **API Name:** Global Enterprise Search
- **Purpose:** Multi-entity instant search bar across keys, hierarchy partners, and end customers.
- **HTTP Method:** `GET`
- **Endpoint:** `/api/enterprise/search`
- **Authentication:** Bearer JWT required
- **Query Parameters:**
  - `q` (string, required, minimum 1 character: key number, partner name, phone, entity code, customer name/mobile)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "keys": [{ "type": "key", "label": "VC-8921-9041", "id": "6708ab9e..." }],
      "users": [{ "type": "distributor", "label": "Delhi Hub Telecom", "id": "6708cd12..." }],
      "customers": [{ "type": "customer", "label": "Rohan Sharma", "id": "6708ef34..." }]
    }
  }
  ```
- **Admin Panel Integration:**
  - **Component:** Header Global Search Modal (`CommandSearch.tsx`) triggered via `Ctrl+K` / `Cmd+K`.

---

## Module 3: Partner Hierarchy Management (Stockists, Distributors, Dealers)

### 3.1 List Stockists
- **API Name:** Get Stockists
- **HTTP Method:** `GET`
- **Endpoint:** `/api/enterprise/stockists`
- **Authentication:** Bearer JWT required
- **Query Parameters:**
  - `page` (integer, default: 1)
  - `limit` (integer, default: 50)
  - `search` (string, optional: name, email, city, entity code)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "STK-1001",
        "_id": "6708ab9e1234567890abcdef",
        "name": "North Region Key Logistics",
        "email": "aman@northlogistics.in",
        "city": "Ludhiana",
        "territory": "Punjab",
        "gst": "03AAAAA0000A1Z5",
        "status": "Active",
        "keys": 8200,
        "available": 1800,
        "distributors": 8,
        "revenue": 1600000,
        "lastActive": "2h ago"
      }
    ],
    "pagination": { "currentPage": 1, "totalPages": 1, "totalItems": 1, "limit": 50 }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/partners` (`PartnersPage.tsx`), filter tab "Stockists".

---

### 3.2 Create Stockist
- **API Name:** Create Stockist
- **HTTP Method:** `POST`
- **Endpoint:** `/api/enterprise/stockists`
- **Authentication:** `requireEnterpriseRole("super_admin")`
- **Request Body:**
  ```json
  {
    "name": "West Coast Logistics",
    "email": "contact@westlogistics.in",
    "phone": "9820019284",
    "password": "StrongPassword@123",
    "territory": "Maharashtra",
    "city": "Mumbai",
    "gst": "27AAAAA0000A1Z5",
    "status": "Active"
  }
  ```
  *Validation Rules:*
  - `name` (string, required)
  - `email` (string, required, unique across active users)
  - `phone` (string, optional, 10 digits)
  - `password` (string, optional: if omitted, auto-generated)
  - `territory` (string, required)
  - `city` (string, optional)
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": "STK-1002",
      "_id": "6709bc8f...",
      "name": "West Coast Logistics",
      "email": "contact@westlogistics.in",
      "territory": "Maharashtra",
      "city": "Mumbai",
      "status": "Active",
      "keys": 0,
      "available": 0
    }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/add-partner` (`AddDistributorPage.tsx` / Add Partner Modal).

---

### 3.3 List Distributors
- **API Name:** Get Distributors
- **HTTP Method:** `GET`
- **Endpoint:** `/api/enterprise/distributors`
- **Authentication:** Bearer JWT required
- **Query Parameters:** `page`, `limit`, `search`
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "DST-1001",
        "_id": "6708ab9e1234567890abcdef",
        "name": "Delhi NCR Hub Telecom",
        "email": "vikram@delhidist.in",
        "city": "New Delhi",
        "stockist": "North Region Key Logistics",
        "dealers": 24,
        "status": "Active",
        "keys": 4200,
        "available": 900,
        "onboarded": "2025-12-05"
      }
    ],
    "pagination": { "currentPage": 1, "totalPages": 1, "totalItems": 1, "limit": 50 }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/distributors` (`DistributorsPage.tsx`).

---

### 3.4 Create Distributor
- **API Name:** Create Distributor
- **HTTP Method:** `POST`
- **Endpoint:** `/api/enterprise/distributors`
- **Authentication:** `requireEnterpriseRole("super_admin", "stockist")`
- **Request Body:**
  ```json
  {
    "name": "Central Delhi Distributors",
    "email": "delhi.dist@vcredit.com",
    "phone": "9899120934",
    "password": "Password@123",
    "city": "New Delhi",
    "territory": "Delhi NCR",
    "status": "Active"
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": "DST-1002",
      "_id": "6709bc8f...",
      "name": "Central Delhi Distributors",
      "email": "delhi.dist@vcredit.com",
      "city": "New Delhi",
      "stockist": "North Region Key Logistics",
      "dealers": 0
    }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/add-distributor` (`AddDistributorPage.tsx`).

---

### 3.5 List Dealers
- **API Name:** Get Dealers
- **HTTP Method:** `GET`
- **Endpoint:** `/api/enterprise/dealers`
- **Authentication:** Bearer JWT required
- **Query Parameters:** `page`, `limit`, `search`
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "DLR-1001",
        "_id": "6708ab9e1234567890abcdef",
        "name": "Metro Mobiles & Electronics",
        "email": "karan@metromobiles.com",
        "city": "Rohini",
        "distributor": "Delhi NCR Hub Telecom",
        "users": 305,
        "activations": 305,
        "status": "Active",
        "keys": 350,
        "available": 45,
        "lastActive": "15m ago"
      }
    ],
    "pagination": { "currentPage": 1, "totalPages": 1, "totalItems": 1, "limit": 50 }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/dealers` (`DealersPage.tsx`).

---

### 3.6 Create Dealer
- **API Name:** Create Dealer
- **HTTP Method:** `POST`
- **Endpoint:** `/api/enterprise/dealers`
- **Authentication:** `requireEnterpriseRole("super_admin", "stockist", "distributor")`
- **Request Body:**
  ```json
  {
    "name": "City Cell Care",
    "email": "citycell@gmail.com",
    "phone": "9811234567",
    "password": "DealerPassword@123",
    "city": "Janakpuri",
    "status": "Active"
  }
  ```
- **Success Response (201 Created):** Status 201 with newly created dealer details.
- **Admin Panel Integration:**
  - **Page:** `/app/add-dealer` or Add Dealer dialog in `DealersPage.tsx`.

---

### 3.7 Reset Downstream Partner Password
- **API Name:** Reset Partner Password
- **HTTP Method:** `PATCH`
- **Endpoint:** `/api/enterprise/users/:userId/password`
- **Authentication:** `requireEnterpriseRole("super_admin", "stockist", "distributor")`
- **Path Parameters:**
  - `userId` (24-char ObjectId of the downstream partner)
- **Request Body:**
  ```json
  {
    "password": "NewSecretPassword@123"
  }
  ```
  *Validation:* `password` must be at least 6 characters.
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "DLR-1001",
      "email": "karan@metromobiles.com",
      "name": "Metro Mobiles",
      "enterpriseRole": "dealer"
    }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/dealers/edit/:id` (`EditDealerPage.tsx`) or "Reset Password" modal in partner tables.

---

### 3.8 List All Users (Admin User Table)
- **API Name:** Get All Users
- **HTTP Method:** `GET`
- **Endpoint:** `/api/user`
- **Authentication:** Bearer JWT required (`adminMiddleware`)
- **Query Parameters:**
  - `page` (integer, default: 1)
  - `limit` (integer, default: 10)
  - `search` (string, optional: search name, phone, email)
  - `role` (string, optional: `"admin"` | `"user"`)
  - `isDisabled` (string, optional: `"true"` | `"false"`)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Users retrieved successfully",
    "data": [
      {
        "_id": "6708ab9e1234567890abcdef",
        "name": "Karan Patel",
        "email": "karan@metromobiles.com",
        "phone": "9822019283",
        "role": "admin",
        "enterpriseRole": "dealer",
        "entityCode": "DLR-1001",
        "city": "Rohini",
        "keys": 45,
        "isDisabled": false,
        "isBanned": false,
        "createdAt": "2026-01-12T09:30:00.000Z"
      }
    ],
    "pagination": {
      "totalUsers": 120,
      "totalPages": 12,
      "currentPage": 1,
      "pageSize": 10
    }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/users` (`UsersPage.tsx`).

---

### 3.9 Toggle User / Customer Active Status (Ban / Disable)
- **API Name:** Toggle User Disable Status
- **HTTP Method:** `PATCH`
- **Endpoint:** `/api/user/disable/:userId`
- **Authentication:** Bearer JWT required (`adminMiddleware`)
- **Path Parameters:**
  - `userId` (ObjectId of User or Customer)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "User banned/deactivated successfully",
    "user": {
      "_id": "6708ab9e1234567890abcdef",
      "isDisabled": true,
      "isBanned": true
    }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/users`, `/app/customers`, `/app/user-search`
  - **Action:** Disable/Enable toggle switch in table row.

---

### 3.10 Create Shop Employee / Sub-Admin
- **API Name:** Create Shop Employee
- **HTTP Method:** `POST`
- **Endpoint:** `/api/user/admin`
- **Authentication:** Bearer JWT required (`adminMiddleware`)
- **Request Body:**
  ```json
  {
    "name": "Cashier Amit",
    "email": "amit.cashier@dealer.com",
    "password": "Password@123"
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Shop Employee created successfully",
    "data": {
      "id": "6709bc8f...",
      "name": "Cashier Amit",
      "email": "amit.cashier@dealer.com",
      "role": "admin"
    }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/settings`, Employee Management tab.

---

## Module 4: License Key Operations & Inventory

### 4.1 List License Keys
- **API Name:** List Enterprise Keys
- **Purpose:** Search and inspect all generated, transferred, assigned, and activated keys within caller's hierarchy.
- **HTTP Method:** `GET`
- **Endpoint:** `/api/enterprise/keys`
- **Authentication:** Bearer JWT required
- **Query Parameters:**
  - `page` (integer, default: 1)
  - `limit` (integer, default: 40)
  - `status` (string, optional: `"Generated"` | `"Allocated"` | `"Transferred"` | `"Assigned"` | `"Activated"` | `"Expired"` | `"Locked"`)
  - `search` (string, optional: key number or batch ID)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "key": "VC-8921-9842-1082",
        "batch": "BATCH-2026-001",
        "owner": "Metro Mobiles",
        "status": "Activated",
        "createdAt": "2026-03-01",
        "updated": "5m ago",
        "_id": "6708ab9e1234567890abcdef"
      }
    ],
    "pagination": { "currentPage": 1, "totalPages": 25, "totalItems": 980 }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/keys` (`KeysPage.tsx`).
  - **Filters:** Status dropdown, search input, batch pagination.

---

### 4.2 Generate Key Batch (Super Admin Only)
- **API Name:** Generate Key Batch
- **Purpose:** Creates a cryptographically unique batch of license keys. Top-level Super Admin only.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/enterprise/keys/generate`
- **Authentication:** `requireEnterpriseRole("super_admin")`
- **Request Body:**
  ```json
  {
    "quantity": 500,
    "keyType": "standard"
  }
  ```
  *Validation Rules:*
  - `quantity` (integer, required, range: 1 to 10,000)
  - `keyType` (string, optional: `"standard"` | `"iphone"`, default: `"standard"`)
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "batchId": "BATCH-2026-042",
      "count": 500,
      "keys": [
        {
          "_id": "6708ab9e...",
          "keyNumber": "VC-1029-4821-9942",
          "batchId": "BATCH-2026-042",
          "status": "Generated"
        }
      ]
    }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/keys` (`KeysPage.tsx`)
  - **Action:** "Generate Keys" primary modal button.

---

### 4.3 Transfer Keys Downstream
- **API Name:** Transfer Key Batch
- **Purpose:** Allocates key inventory downstream from caller to a child partner (Super Admin → Stockist → Distributor → Dealer).
- **HTTP Method:** `POST`
- **Endpoint:** `/api/enterprise/keys/transfer`
- **Authentication:** Bearer JWT required
- **Request Body:**
  ```json
  {
    "toUserId": "6709bc8f1234567890fedcba",
    "quantity": 100,
    "note": "Quarterly Q2 allocation for West Delhi"
  }
  ```
  *Validation Rules:*
  - `toUserId` (Mongo ObjectId of destination partner, required)
  - `quantity` (integer, required, must be <= caller's available balance)
  - `note` (string, optional)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "batchId": "TX-2026-891",
      "quantity": 100,
      "keyIds": ["6708ab9e...", "6708ab9f..."]
    }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/keys` (`KeysPage.tsx`), "Transfer Keys" modal. Also available in Partner Row actions ("Allocate Keys").

---

### 4.4 Reclaim Keys Upstream (Take Back)
- **API Name:** Reclaim Key Batch
- **Purpose:** Reclaims un-used / un-assigned license keys back from a downstream partner into caller's account.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/enterprise/keys/reclaim`
- **Authentication:** Bearer JWT required
- **Request Body:**
  ```json
  {
    "fromUserId": "6709bc8f1234567890fedcba",
    "quantity": 50,
    "note": "Reclaiming excess unused inventory"
  }
  ```
  *Validation Rules:*
  - `fromUserId` (Mongo ObjectId of partner to reclaim from, required)
  - `quantity` (integer, required, must be <= target user's available un-assigned keys)
  - `note` (string, optional)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "batchId": "REC-2026-102",
      "quantity": 50,
      "keyIds": ["6708ab9e..."]
    }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/keys-return` (`KeysReturnPage.tsx`) or Partner Action dropdown ("Reclaim Keys").

---

### 4.5 Key Requests & Approvals
- **API Name:** Request Keys from Upstream
- **HTTP Method:** `POST`
- **Endpoint:** `/api/keys`
- **Request Body:** `{"requestKeys": 50}`
- **Success Response (200 OK):** Status 200 with new `Keys` request doc.
- **Approval Endpoint:**
  - **HTTP Method:** `PATCH`
  - **Endpoint:** `/api/keys/:keyId`
  - **Body:** `{"status": "Approved"}` (or `"Rejected"`)
  - **Logic:** Approving automatically triggers `generateKeys` for the requesting partner and increments their key balance.

---

## Module 5: Customer Directory & Document KYC

### 5.1 Send Customer Verification OTP
- **API Name:** Send Customer OTP
- **Purpose:** Dispatches SMS OTP to customer's mobile number before profile creation.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/customers/send-otp`
- **Authentication:** Bearer JWT required (Dealer/Admin)
- **Request Body:**
  ```json
  {
    "customerName": "Rohan Sharma",
    "customerMobileNumber": "9876543210",
    "address": "Flat 402, Green Avenue, Rohini Sector 15",
    "email": "rohan@gmail.com",
    "alternatePhone": "9811223344"
  }
  ```
  *Validation Rules:*
  - `customerName` (string, min 2, max 50 chars, required)
  - `customerMobileNumber` (string, exactly 10 digits, required)
  - `address` (string, min 5 chars, required)
  - `email` (string, optional, valid email format)
  - `alternatePhone` (string, optional, 10 digits)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "otp": "4921",
    "message": "OTP sent to customer successfully."
  }
  ```

---

### 5.2 Verify Customer OTP & Create Profile
- **API Name:** Verify Customer OTP & Create
- **HTTP Method:** `POST`
- **Endpoint:** `/api/customers/verify-and-create`
- **Authentication:** Bearer JWT required
- **Request Body:**
  ```json
  {
    "customerMobileNumber": "9876543210",
    "otp": "4921"
  }
  ```
  *Validation Rules:*
  - `customerMobileNumber` (10 digits, required)
  - `otp` (4 digits, required)
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Customer verified and created successfully",
    "data": {
      "_id": "6708ab9e1234567890abcdef",
      "customerName": "Rohan Sharma",
      "customerMobileNumber": "9876543210",
      "address": "Flat 402, Green Avenue, Rohini Sector 15",
      "isVerified": true,
      "createdBy": "6709bc8f..."
    }
  }
  ```

---

### 5.3 Direct Customer Registration (Without OTP)
- **API Name:** Register Customer Directly
- **Purpose:** Allows quick customer creation in offline/kiosk scenarios.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/customers/register`
- **Authentication:** Bearer JWT required
- **Request Body:**
  ```json
  {
    "customerName": "Suresh Gupta",
    "customerMobileNumber": "9845019284",
    "address": "Shop 12, Main Market, Janakpuri"
  }
  ```

---

### 5.4 List Customers
- **API Name:** Get All Customers
- **HTTP Method:** `GET`
- **Endpoint:** `/api/customers`
- **Authentication:** Bearer JWT required
- **Query Parameters:**
  - `page` (integer, default: 1)
  - `limit` (integer, default: 10)
  - `search` (string, optional: searches customerName)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Customers retrieved successfully",
    "data": [
      {
        "_id": "6708ab9e1234567890abcdef",
        "customerName": "Rohan Sharma",
        "customerMobileNumber": "9876543210",
        "address": "Flat 402, Green Avenue, Rohini",
        "isVerified": true,
        "activeLoans": 1,
        "Loan": [],
        "createdAt": "2026-03-01T10:00:00.000Z"
      }
    ],
    "pagination": { "totalCustomers": 45, "totalPages": 5, "currentPage": 1, "limit": 10 }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/customers` (`CustomersPage.tsx`).

---

### 5.5 Get Customer Detail by ID
- **API Name:** Get Customer by ID
- **HTTP Method:** `GET`
- **Endpoint:** `/api/customers/:id`
- **Authentication:** Bearer JWT required
- **Path Parameters:**
  - `id` (Customer ObjectId)
- **Success Response (200 OK):** Includes populated `Loan`, `Bank`, and `Address` documents.

---

### 5.6 Upload Aadhaar KYC
- **API Name:** Complete Aadhaar KYC
- **HTTP Method:** `PUT`
- **Endpoint:** `/api/customers/:id/kyc/aadhaar`
- **Authentication:** Bearer JWT required
- **Headers:** `Content-Type: multipart/form-data`
- **Form Data Fields:**
  - `aadhaarNumber` (string, required, exactly 12 numeric digits)
  - `aadhaarFront` (file, max 1 image, required)
  - `aadhaarBack` (file, max 1 image, required)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "_id": "6708ab9e...",
      "kyc": {
        "aadhaar": {
          "number": "123456789012",
          "frontPhoto": "uploads/aadhaarFront-1710000.jpg",
          "backPhoto": "uploads/aadhaarBack-1710000.jpg"
        }
      }
    }
  }
  ```

---

### 5.7 Upload PAN KYC
- **API Name:** Complete PAN KYC
- **HTTP Method:** `PUT`
- **Endpoint:** `/api/customers/:id/kyc/pan`
- **Authentication:** Bearer JWT required
- **Headers:** `Content-Type: multipart/form-data`
- **Form Data Fields:**
  - `panNumber` (string, required, regex `^[A-Z]{5}[0-9]{4}[A-Z]{1}$`)
  - `panPhoto` (file, max 1 image, required)
- **Success Response (200 OK):** Updated customer record with `kyc.pan.number` and `kyc.pan.photo`.

---

### 5.8 Upload Bank Passbook Photo
- **API Name:** Add Bank Passbook KYC
- **HTTP Method:** `PUT`
- **Endpoint:** `/api/customers/:id/kyc/bankpassbook`
- **Headers:** `Content-Type: multipart/form-data`
- **Form Data Fields:**
  - `bankPassbookPhoto` (file, max 1 image, required)
- **Success Response (200 OK):** Updated customer object.

---

### 5.9 Delete Customer
- **API Name:** Delete Customer
- **HTTP Method:** `DELETE`
- **Endpoint:** `/api/customers/:id`
- **Authentication:** Bearer JWT required
- **Logic:** Performs deep cascading delete across related loans, addresses, bank records, and user login records.

---

## Module 6: Customer Loan Origination & Lifecycle

### 6.1 Create Loan (Origination & Key Binding)
- **API Name:** Create Customer Loan
- **Purpose:** Creates a new financed loan agreement, automatically generates installment schedules, reserves an available license key from the dealer's inventory, decrements the dealer's key balance, and stamps device IMEI.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/customerLoan/:customerId`
- **Authentication:** Bearer JWT required (Dealer)
- **Path Parameters:**
  - `customerId` (Customer ObjectId, required)
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "installationType": "New Phone",
    "mobileBrand": "Samsung",
    "mobileModel": "Galaxy A15 5G",
    "imeiNumber1": "864501041234567",
    "imeiNumber2": "864501041234568",
    "mobilePrice": 18500,
    "downPayment": 3500,
    "processingFees": 500,
    "loanAmount": 15000,
    "interestRate": 0,
    "numberOfEMIs": 6,
    "emiAmount": 2500,
    "frequency": "monthly",
    "firstEmiDate": "2026-04-10T00:00:00.000Z",
    "financer": "admin",
    "paymentOptions": "upi",
    "description": "Financed at Metro Mobiles"
  }
  ```
  *Validation Rules:*
  - `installationType` (string, required: `"New Phone"` | `"Old/Running Phone"`)
  - `mobileBrand` (string, required)
  - `mobileModel` (string, required)
  - `imeiNumber1` (string, required, exactly 15 numeric digits, globally unique)
  - `imeiNumber2` (string, optional, 15 digits)
  - `mobilePrice` (number, required, >= 0)
  - `loanAmount` (number, required, >= 0)
  - `numberOfEMIs` (integer, required, >= 1)
  - `frequency` (string, optional: `"monthly"` | `"weekly"` | `"daily"`, default: `"monthly"`)
  - `firstEmiDate` (ISO Date string, optional)
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Customer Loan created successfully",
    "data": {
      "_id": "6708ab9e1234567890abcdef",
      "customerId": "6708cd12...",
      "imeiNumber1": "864501041234567",
      "mobileBrand": "Samsung",
      "mobileModel": "Galaxy A15 5G",
      "mobilePrice": 18500,
      "downPayment": 3500,
      "loanAmount": 15000,
      "emiAmount": 2500,
      "amountLeft": 15000,
      "numberOfEMIs": 6,
      "loanStatus": "PENDING",
      "deviceUnlockStatus": "UNLOCKED",
      "installments": [
        {
          "installmentNumber": 1,
          "dueDate": "2026-04-10T00:00:00.000Z",
          "amount": 2500,
          "status": "PENDING",
          "paidAmount": 0
        }
      ]
    },
    "assignedKey": {
      "keyNumber": "VC-8921-9842-1082",
      "status": "Assigned"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{"success": false, "message": "imei number already exist"}`
  - `400 Bad Request`: `{"success": false, "message": "request keys to create loan"}` (Dealer has 0 keys left)
- **Admin Panel Integration:**
  - **Page:** `/app/loans` (`LoansPage.tsx`), "Originate Loan" action modal.

---

### 6.2 List All Loans (Multi-Filter & Overdue Tracking)
- **API Name:** Get All Loans
- **HTTP Method:** `GET`
- **Endpoint:** `/api/customerLoan`
- **Authentication:** Bearer JWT required
- **Query Parameters:**
  - `page` (integer, default: 1)
  - `limit` (integer, default: 10)
  - `search` (string, optional: customer name, mobile, brand, model, IMEI)
  - `runningDevice` (boolean flag: active loans with first EMI date in past)
  - `newDevice` (boolean flag: active loans with first EMI date in future)
  - `lockedDevices` (boolean flag: loans with `deviceUnlockStatus == "LOCKED"`)
  - `unlockDevices` (boolean flag: loans with `deviceUnlockStatus == "UNLOCKED"`)
  - `notActiveDevices` (boolean flag: loans with `loanStatus == "PENDING"`)
  - `deactivateDevices` (boolean flag: loans with `loanStatus == "CLOSED"`)
  - `upcomingEmis` (boolean flag: sorts by nearest upcoming EMI due date)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Customers Loan retrieved successfully",
    "data": [
      {
        "_id": "6708ab9e1234567890abcdef",
        "loanStatus": "APPROVED",
        "deviceUnlockStatus": "UNLOCKED",
        "imeiNumber1": "864501041234567",
        "mobileBrand": "Samsung",
        "mobileModel": "Galaxy A15 5G",
        "loanAmount": 15000,
        "emiAmount": 2500,
        "numberOfEMIs": 6,
        "installmentsPaid": 2,
        "totalDueAmount": 0,
        "customerId": {
          "_id": "6708cd12...",
          "customerName": "Rohan Sharma",
          "customerMobileNumber": "9876543210"
        },
        "nextEmiDetails": {
          "installmentNumber": 3,
          "dueDate": "2026-05-10T00:00:00.000Z",
          "amount": 2500
        }
      }
    ],
    "pagination": { "totalLoans": 64, "totalPages": 7, "currentPage": 1 }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/loans` (`LoansPage.tsx`). Tab filters map directly to query flags.

---

### 6.3 Get Loan by ID
- **API Name:** Get Loan by ID
- **HTTP Method:** `GET`
- **Endpoint:** `/api/customerLoan/single/:loanId`
- **Authentication:** Bearer JWT required
- **Success Response (200 OK):** Full loan document with all installments, payments, customer profile, and current GPS/SIM metadata.

---

### 6.4 Update Loan & Auto-Close
- **API Name:** Update Customer Loan
- **HTTP Method:** `PUT`
- **Endpoint:** `/api/customerLoan/:loanId`
- **Request Body:** Partial loan fields or updated installments.
- **Logic:** If all installments are marked `PAID` or status is set to `CLOSED`, the loan automatically sets `deviceUnlockStatus = "UNLOCKED"`, `amountLeft = 0`, and broadcasts an unlock push notification.

---

### 6.5 Delete Loan
- **API Name:** Delete Loan
- **HTTP Method:** `DELETE`
- **Endpoint:** `/api/customerLoan/:loanId`
- **Authentication:** Bearer JWT required

---

### 6.6 Mark Auto-Debit / NACH Failure (Bounce Penalty)
- **API Name:** Mark Auto-Debit Failure
- **Purpose:** Flags an EMI installment as bounced and appends a ₹400 penalty charge to the installment.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/customerLoan/bounce/:loanId`
- **Authentication:** Bearer JWT required
- **Request Body:**
  ```json
  {
    "installmentNumber": 2
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Auto-debit failure marked and bounce fee applied",
    "data": { "_id": "6708ab9e...", "installments": [] }
  }
  ```

---

## Module 7: Device Inventory, MDM Telemetry & Remote Control

### 7.1 Remote Lock Device
- **API Name:** Lock Device
- **Purpose:** Immediately locks a financed smartphone screen with a full-screen overdue payment overlay.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/customerLoan/lock/:loanId`
- **Authentication:** Bearer JWT required
- **Path Parameters:**
  - `loanId` (Loan ID or IMEI)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Lock command issued successfully",
    "lockStatus": "LOCKED"
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/devices`, `/app/device-control` (`DeviceControlPage.tsx`).
  - **Action:** "Lock Phone" red emergency action button.

---

### 7.2 Remote Unlock Device
- **API Name:** Unlock Device
- **Purpose:** Immediately clears the lock screen overlay and restores normal phone functionality.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/customerLoan/unlock/:loanId`
- **Authentication:** Bearer JWT required
- **Path Parameters:** `loanId`
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Unlock command issued successfully",
    "lockStatus": "UNLOCKED"
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/devices`, `/app/device-control`.
  - **Action:** "Unlock Phone" green action button.

---

### 7.3 Update Device MDM Policy & Restrictions
- **API Name:** Update Device Policy
- **Purpose:** Toggles hardware and application restriction policies on a customer's smartphone.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/customerLoan/policy/:loanId`
- **Authentication:** Bearer JWT required
- **Request Body:**
  ```json
  {
    "isResetAllowed": false,
    "isUninstallAllowed": false,
    "isDeveloperOptionsBlocked": true,
    "isWallpaperEnabled": true,
    "wallpaperUrl": "https://api.vlocker.in/uploads/wallpaper.jpg",
    "isWhatsAppBlocked": false,
    "isInstagramBlocked": true,
    "isSnapchatBlocked": true,
    "isYouTubeBlocked": true,
    "isFacebookBlocked": true,
    "isDialerBlocked": false,
    "isMessagesBlocked": false,
    "isPlayStoreBlocked": true,
    "isChromeBlocked": true,
    "isVoiceReminderEnabled": true,
    "isLocationEnabled": true
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Device policy updated",
    "data": { "_id": "6708ab9e...", "devicePolicy": {} }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/users/:id/device-control` (`DeviceControlPage.tsx`).
  - **Action:** Policy restriction switches (Camera, WhatsApp, Instagram, Reset, Developer Mode).

---

### 7.4 Bulk Device Control (Lock, Unlock, Policy)
- **Bulk Lock:** `POST /api/customerLoan/bulk/lock`  
  *Body:* `{"loanIds": ["6708ab9e...", "6708ab9f..."]}`
- **Bulk Unlock:** `POST /api/customerLoan/bulk/unlock`  
  *Body:* `{"loanIds": ["6708ab9e...", "6708ab9f..."]}`
- **Bulk Policy Update:** `POST /api/customerLoan/bulk/policy`  
  *Body:* `{"loanIds": ["..."], "policy": { "isDeveloperOptionsBlocked": true }}`

---

### 7.5 Request Device Telemetry (GPS Location & SIM Info)
- **Request Location:** `POST /api/customerLoan/location/request/:loanId`
- **Request SIM Info:** `POST /api/customerLoan/location/sim/request/:loanId`
- **Get Saved SIM Details:** `GET /api/customerLoan/sim/:loanId`
- **Bulk Location Request:** `POST /api/customerLoan/bulk/location`
- **Bulk SIM Request:** `POST /api/customerLoan/bulk/sim`

---

### 7.6 Enterprise MDM Device Registry
- **API Name:** List MDM Devices
- **HTTP Method:** `GET`
- **Endpoint:** `/api/mdm/devices`
- **Authentication:** `loadEnterpriseUser` required
- **Query Parameters:** `page`, `limit`, `status`
- **Success Response (200 OK):** Returns array of devices with populated customer and key details.

---

### 7.7 Issue Generic MDM Command
- **API Name:** Issue MDM Command
- **HTTP Method:** `POST`
- **Endpoint:** `/api/mdm/commands`
- **Authentication:** `requireEnterpriseRole("super_admin", "stockist", "distributor", "dealer")`
- **Request Body:**
  ```json
  {
    "deviceId": "864501041234567",
    "type": "LOCK_DEVICE",
    "payload": {
      "message": "Payment overdue by 7 days. Pay immediately."
    }
  }
  ```
  *Allowed Command Types:* `LOCK_DEVICE`, `UNLOCK_DEVICE`, `REBOOT`, `FACTORY_RESET`, `ENABLE_CAMERA`, `DISABLE_CAMERA`, `ENABLE_MIC`, `DISABLE_MIC`, `ENABLE_GPS`, `DISABLE_GPS`, `ENABLE_WIFI`, `DISABLE_WIFI`, `ENABLE_CALLS`, `DISABLE_CALLS`, `ENABLE_SMS`, `DISABLE_SMS`, `ENABLE_USB`, `DISABLE_USB`, `INSTALL_APP`, `UNINSTALL_APP`, `SYNC_POLICY`, `SHOW_MESSAGE`.
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Command queued",
    "data": {
      "commandRef": "c7a8b9d0-1234-5678-90ab-cdef12345678",
      "type": "LOCK_DEVICE",
      "status": "QUEUED"
    }
  }
  ```

---

### 7.8 Blacklist Device
- **API Name:** Set Device Blacklist
- **HTTP Method:** `PATCH`
- **Endpoint:** `/api/mdm/devices/:deviceId/blacklist`
- **Request Body:**
  ```json
  {
    "blacklisted": true,
    "reason": "Reported stolen by customer"
  }
  ```

---

## Module 8: Payment Gateway & Razorpay Collections

### 8.1 Create Razorpay Payment Order
- **API Name:** Create Razorpay Order
- **Purpose:** Generates a Razorpay order ID to collect an overdue installment or entire loan foreclosure.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/payment/create-order`
- **Authentication:** Public / User / Admin
- **Request Body:**
  ```json
  {
    "loanId": "6708ab9e1234567890abcdef",
    "installmentId": "6708cd1234567890fedcba12",
    "payFull": false
  }
  ```
  *Fields:*
  - `loanId` (required)
  - `installmentId` (optional: pay a specific installment)
  - `payFull` (boolean, optional: if `true`, calculates entire remaining principal to close loan)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "loanId": "6708ab9e1234567890abcdef",
    "order": {
      "id": "order_EKfLwp8q8g79kZ",
      "entity": "order",
      "amount": 250000,
      "currency": "INR",
      "receipt": "rp_1710892800000",
      "status": "created"
    }
  }
  ```

---

### 8.2 Verify Razorpay Payment & Auto-Unlock
- **API Name:** Verify Payment & Auto Unlock
- **Purpose:** Verifies HMAC-SHA256 signature, updates installment to `PAID`, settles loan balance, and immediately fires an automatic unlock command to the mobile device.
- **HTTP Method:** `POST`
- **Endpoint:** `/api/payment/verify-payment`
- **Request Body:**
  ```json
  {
    "razorpay_order_id": "order_EKfLwp8q8g79kZ",
    "razorpay_payment_id": "pay_29QQoUBi66xm2f",
    "razorpay_signature": "9ef4b60098f993d...",
    "loanId": "6708ab9e1234567890abcdef",
    "installmentId": "6708cd1234567890fedcba12",
    "payFull": false
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Payment verified and recorded successfully",
    "isFullyPaid": false,
    "data": {
      "loanId": "6708ab9e...",
      "amountPaid": 2500,
      "remainingAmount": 12500
    }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/loans` (`LoansPage.tsx`), "Record Offline / Cash Payment" modal or online payment collection.

---

## Module 9: Customer Address & Banking Master

### 9.1 Create Customer Address
- **API Name:** Create Address
- **HTTP Method:** `POST`
- **Endpoint:** `/api/address/:customerId`
- **Request Body:**
  ```json
  {
    "customerCity": "Rohini",
    "customerState": "Delhi",
    "customerAddress": "Pocket C, House 142",
    "pinCode": "110085",
    "permanentAddress": "Same as current"
  }
  ```

---

### 9.2 Add Partner / Customer Bank Details
- **API Name:** Add Bank Account
- **HTTP Method:** `POST`
- **Endpoint:** `/api/bank`
- **Request Body:**
  ```json
  {
    "bankName": "HDFC Bank",
    "accountNumber": "50100234819201",
    "accountHolderName": "Metro Mobiles",
    "ifscCode": "HDFC0001234",
    "upiId": "metromobiles@hdfcbank"
  }
  ```

---

## Module 10: Territory & Commission Management

### 10.1 List Geographic Territories
- **API Name:** Get Territory Performance
- **HTTP Method:** `GET`
- **Endpoint:** `/api/enterprise/territories`
- **Authentication:** Bearer JWT required
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "TER-001",
        "name": "Punjab",
        "state": "PB",
        "stockists": 3,
        "distributors": 14,
        "dealers": 120,
        "keys": 4500,
        "activations": 3800,
        "revenue": 950000,
        "status": "Active"
      }
    ]
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/finance` (`FinancePage.tsx`), Territory Breakdown tab.

---

### 10.2 Territory Commission Statements
- **API Name:** Get Commissions & Trends
- **HTTP Method:** `GET`
- **Endpoint:** `/api/enterprise/commissions`
- **Authentication:** Bearer JWT required
- **Success Response (200 OK):** Returns computed commissions for Stockists (₹12/key), Distributors (₹8/key), and Dealers (₹5/key), along with 6-month historical commission trends.

---

## Module 11: Reports & Audit Trails

### 11.1 System Activity & Security Audit Logs
- **API Name:** Get Audit Logs
- **HTTP Method:** `GET`
- **Endpoint:** `/api/enterprise/audit`
- **Authentication:** Bearer JWT required
- **Query Parameters:**
  - `page` (integer, default: 1)
  - `limit` (integer, default: 50)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "time": "12m ago",
        "actor": "Super Admin",
        "role": "super_admin",
        "action": "Generated 500 keys",
        "target": "Batch #BATCH-2026-042",
        "severity": "info"
      }
    ],
    "pagination": { "currentPage": 1, "totalPages": 10, "totalItems": 480 }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/audit` (`AuditPage.tsx`).

---

### 11.2 Low-Inventory & Transfer Notifications
- **API Name:** Get Enterprise Notifications
- **HTTP Method:** `GET`
- **Endpoint:** `/api/enterprise/notifications`
- **Authentication:** Bearer JWT required
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "title": "Low inventory",
        "desc": "Metro Mobiles has only 22 keys left.",
        "time": "45m ago",
        "type": "warning"
      }
    ]
  }
  ```
- **Admin Panel Integration:**
  - **Component:** Header Notifications Bell Popover (`NotificationBell.tsx`).

---

### 11.3 Catalog of Exportable Reports
- **API Name:** Get Reports Catalog
- **HTTP Method:** `GET`
- **Endpoint:** `/api/enterprise/reports`
- **Success Response (200 OK):** Returns available system reports (`keys-ledger`, `activations`, `inventory`, `audit`, `commissions`, `users`).
- **Admin Panel Integration:**
  - **Page:** `/app/reports` (`TransferReportPage.tsx`, `ReceivedKeyReportPage.tsx`).

---

## Module 12: Master Settings & Reference Data

### 12.1 States Master CRUD
- `POST /api/states`: Create state (`{"stateName": "Maharashtra"}`)
- `GET /api/states`: List states with cities (`?page=1&limit=20&search=Delhi`)
- `PUT /api/states/:id`: Update state name
- `DELETE /api/states/:id`: Delete state

### 12.2 Cities Master CRUD
- `POST /api/cities`: Create city (`{"cityName": "Pune", "stateId": "6708ab9e..."}`)
- `GET /api/cities`: List cities with state details (`?page=1&limit=50&search=Mumbai`)
- `GET /api/cities/state/:stateId`: List cities within a specific state
- `PUT /api/cities/:id`: Update city name
- `DELETE /api/cities/:id`: Delete city

### 12.3 Smartphone Brands Master CRUD
- `POST /api/mobile-brands`: Create brand (`{"brandName": "Samsung"}`)
- `GET /api/mobile-brands`: List brands with pagination & search
- `GET /api/mobile-brands/:id`: Get brand by ID
- `PUT /api/mobile-brands/:id`: Update brand
- `DELETE /api/mobile-brands/:id`: Delete brand

### 12.4 Smartphone Models Master CRUD
- `POST /api/mobile-models`: Create model (`{"modelName": "Galaxy S24", "brandId": "6708ab9e..."}`)
- `GET /api/mobile-models`: List models with brand populated
- `GET /api/mobile-models/:id`: Get model by ID
- `PUT /api/mobile-models/:id`: Update model
- `DELETE /api/mobile-models/:id`: Delete model

### 12.5 Media & File Upload
- `POST /api/upload`: Upload generic wallpaper image (`file: multipart image`). Returns `{ "filePath": "uploads/wallpaper-171000.jpg" }`.
- `POST /api/upload/upload-video`: Upload installation guide video with thumbnail.
- `GET /api/upload`: List installation tutorial videos.

### 12.6 Push Notifications (FCM)
- `POST /api/notification`: Broadcast FCM notification to topic or user (`{"topic": "allUsers", "title": "...", "body": "..."}`).
- `GET /api/notification/all`: List notification history.
- `POST /api/notification/markAllRead`: Mark notifications read.

### 12.7 Company Support & Branding Setup
- `GET /api/company`: Fetch company branding, logo, loader, and support phone/email.
- `PUT /api/company`: Update company branding (accepts multipart `logo`, `loader`, `favIcon`).

### 12.8 Referral Leads Management
- `GET /api/leads`: List incoming referral leads (`?page=1&limit=20&status=PENDING&search=Rohan`).
- `PATCH /api/leads/:id`: Update lead status (`{"status": "CONTACTED", "notes": "Called customer; scheduled dealer visit"}`).

---

## Module 13: Zero-Touch / QR Device Provisioning

### 13.1 Get Provisioning QR Payload
- **API Name:** Get Provisioning Payload
- **Purpose:** Generates the official Android Enterprise Device Owner provisioning JSON payload to embed into an enrollment QR code.
- **HTTP Method:** `GET`
- **Endpoint:** `/api/provisioning/payload`
- **Authentication:** Bearer JWT required
- **Query Parameters:**
  - `loanId` (string, optional: embeds loan binding directly into enrollment)
  - `imei1` (string, optional: expected IMEI)
  - `customerId` (string, optional)
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Provisioning payload generated",
    "data": {
      "downloadUrl": "https://api.vlocker.in/api/provisioning/apk/VLocker.apk",
      "signatureChecksum": "a1b2c3d4e5...",
      "componentName": "com.vlocker/com.vlocker.MyDeviceAdminReceiver",
      "payload": {
        "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.vlocker/com.vlocker.MyDeviceAdminReceiver",
        "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://api.vlocker.in/api/provisioning/apk/VLocker.apk",
        "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM": "a1b2c3d4e5...",
        "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
          "loanId": "6708ab9e...",
          "serverUrl": "https://api.vlocker.in"
        }
      },
      "payloadJson": "{\"android.app.extra...}"
    }
  }
  ```
- **Admin Panel Integration:**
  - **Page:** `/app/devices`, Device Enrollment Modal. Renders dynamic QR Code using `payloadJson`.

### 13.2 Provisioning APK Status & Checksum
- **HTTP Method:** `GET`
- **Endpoint:** `/api/provisioning/info`
- **Purpose:** Validates that `VLocker.apk` exists on server and returns computed SHA-256 signatures.

---

# SECTION II: User & Mobile App APIs

The following endpoints are consumed exclusively by the **VLocker Mobile App** and customer-facing interfaces:

| API Name | Method | Endpoint | Purpose |
|---|---|---|---|
| **Mobile Request OTP** | `POST` | `/api/mobile/auth/request-otp` | Sends SMS OTP to registered customer phone for mobile login. |
| **Mobile Login** | `POST` | `/api/mobile/auth/login` | Authenticates device with phone+OTP or customerId+password; returns short-lived JWT and rotating refresh token. |
| **Mobile Token Refresh** | `POST` | `/api/mobile/auth/refresh` | Rotates refresh token and issues new access token with theft protection. |
| **Mobile Logout** | `POST` | `/api/mobile/auth/logout` | Revokes the active refresh token family. |
| **Customer App Send OTP** | `POST` | `/api/auth/send-otp` | Sends OTP to customer phone (rate limited, 60s cooldown). |
| **Customer App Verify OTP** | `POST` | `/api/auth/verify-otp` | Verifies OTP and binds the physical device IMEI to the active loan. |
| **Bootstrap Profile** | `GET` | `/api/mobile/me` | Fetches customer profile, assigned key, active loan, dealer info, and organization info upon app launch. |
| **Complete Profile** | `POST` | `/api/user/complete-profile` | Completes user profile with name and email address. |
| **Register Device Telemetry** | `POST` | `/api/mobile/device/register` | Registers device hardware parameters (brand, model, Android version, SIM info, root status). |
| **Activate License Key** | `POST` | `/api/mobile/activate` | Validates device integrity and activates assigned key on the device, returning effective MDM policy. |
| **Fetch Device Policy** | `GET` | `/api/mobile/device/:deviceId/policy` | Downloads effective application and hardware block policy for device. |
| **Device Heartbeat** | `POST` | `/api/mobile/heartbeat` | Dispatches battery, network, location, and screen telemetry every ~30s; receives server lock/unlock directives. |
| **Poll Remote Commands** | `GET` | `/api/mobile/device/:deviceId/commands` | Device polls pending remote commands (lock, reboot, policy sync). |
| **Acknowledge Command** | `POST` | `/api/mobile/commands/ack` | Reports command execution result back to server (SUCCESS / FAILED). |
| **Device Self Status** | `GET` | `/api/mobile/device/:deviceId/status` | Device checks its current lock state and session. |
| **First-Launch Device Registration** | `POST` | `/api/device/register` | Fallback device registration endpoint on first app boot. |
| **Customer My Loans** | `GET` | `/api/customerLoan/my-loans` | Fetches active loans, EMI repayment schedule, and loan balances for logged-in customer. |
| **Mobile Loan Status Polling** | `GET` | `/api/customerLoan/mobile/status` | App polling endpoint calculating days overdue, late fees, and auto-lock state. |
| **Public Device Status Check** | `GET` | `/api/customerLoan/status/public` | Public check of lock status and overdue balance by IMEI or phone. |
| **Device Status Check** | `GET` | `/api/device/status/:deviceId` | Direct device status query by hardware deviceId. |
| **Device Location Sync** | `POST` | `/api/customerLoan/location` | Device updates GPS latitude/longitude coordinates on request. |
| **Device SIM Info Sync** | `POST` | `/api/customerLoan/device/sim` | Device syncs inserted SIM carrier, IMSI, and phone number. |
| **Create EMI Payment Order** | `POST` | `/api/payment/create-order` | Initiates Razorpay checkout order for customer EMI or early foreclosure. |
| **Verify EMI Payment** | `POST` | `/api/payment/verify-payment` | Submits Razorpay payment signature for verification and unlocks device. |
| **Submit Customer Feedback** | `POST` | `/api/feedback` | Customer submits app feedback or complaints. |
| **Submit Contact Request** | `POST` | `/api/contactUs/create` | Customer submits support or contact inquiry. |
| **Submit Referral Lead** | `POST` | `/api/leads` | Public submission of prospective customer lead from referral app. |
| **Get Company Support Info** | `GET` | `/api/company` | Returns company customer support phone, email, and website. |
| **Download Provisioning APK** | `GET` | `/api/provisioning/apk/:filename` | Direct download endpoint for `VLocker.apk` during Android setup. |
| **Static APK Downloads** | `GET` | `/VLocker.apk`, `/vlocker.apk`, `/uploads/VLocker.apk` | Static root aliases serving the production VLocker APK. |

---

# SECTION III: Frontend-to-Backend Gap Analysis & Missing APIs

This section highlights exact differences between what the Frontend Admin Panel (`v-credit-new-admin`) expects and what the Backend Express application (`Vlocker-Backend-main`) currently provides:

| Frontend Expectation (`v-credit-new-admin`) | Backend Actual Implementation | Status / Resolution Required |
|---|---|---|
| **`GET /partners`, `POST /partners`** (`partnersApi.ts`) | Handled via separate endpoints: `/api/enterprise/stockists`, `/api/enterprise/distributors`, `/api/enterprise/dealers` | **Mismatch:** Update frontend RTK query slice to call the specific role endpoint, or add a unified `/api/enterprise/partners` route in Express. |
| **`GET /loans`, `POST /loans/:id/payments`** (`loansApi.ts`) | Handled via `/api/customerLoan` (GET all) and `/api/payment/create-order` + `/api/payment/verify-payment` or `PUT /api/customerLoan/:id` | **Mismatch:** Update `loansApi.ts` baseUrl or endpoint to `/api/customerLoan`. |
| **`GET /devices`, `POST /devices/:id/command`** (`devicesApi.ts`) | Handled via `/api/mdm/devices` (GET) and `/api/mdm/commands` (POST) or `/api/customerLoan/lock/:loanId` | **Mismatch:** Align RTK query paths in `devicesApi.ts` to `/api/mdm/devices` and `/api/mdm/commands`. |
| **`GET /auth/me`** (`authApi.ts`) | Handled via `GET /api/enterprise/me` | **Mismatch:** Update endpoint path in `authApi.ts` from `/auth/me` to `/enterprise/me`. |
| **`POST /auth/logout`** (`authApi.ts`) | Admin panel JWT tokens are stateless; mobile uses `/api/mobile/auth/logout`. There is no `/api/auth/logout` route for admins. | **Resolution:** Client-side token removal (`localStorage.removeItem`) is sufficient, or add an optional `/api/auth/logout` endpoint that returns `{ success: true }`. |
| **`GET /dashboard/kpis`, `/dashboard/revenue-trend`, `/dashboard/key-distribution`** (`dashboardApi.ts`) | Provided by `/api/enterprise/dashboard`, `/api/enterprise/analytics`, and `/api/enterprise/inventory` | **Mismatch:** Update `dashboardApi.ts` to consume the rich `/api/enterprise/dashboard` payload directly. |
| **Low Key Reports** (`/app/reports/distributor-low-key`, `/app/reports/dealer-low-key`) | Low inventory is surfaced inside `/api/enterprise/notifications` (key balance <= 120), but no dedicated report filter endpoint exists. | **Backend Gap:** Implement `/api/enterprise/reports/low-keys?role=dealer` to return a dedicated paginated list. |
| **iPhone Specific Key & Price Settings** (`/app/settings/iphone-key-price`, `/app/reports/iphone-transfer`) | Backend `EnterpriseKey` has `keyType: "standard"` but does not currently distinguish pricing tiers for iPhone vs Android. | **Backend Gap:** Add `keyType: "iphone"` support and pricing fields in `BusinessProfile` or `Settings`. |
| **Download Agreement PDF** (`/app/download-agreement`) | Backend does not currently feature a PDF rendering engine for loan contracts or agreements. | **Backend Gap:** Implement dynamic PDF generation (e.g. `pdfkit` / `puppeteer`) for loan contract download. |
| **Partner Payout & Commission Invoicing** | Backend calculates accrued commissions (`/api/enterprise/commissions`), but has no payment execution or invoice generator. | **Backend Gap:** Add a payout tracking model (`CommissionPayout`) to mark earned commissions as paid. |

---

*Documentation compiled directly from Express routes, controllers, middleware, models, and validation schemas in `Vlocker-Backend-main`.*
