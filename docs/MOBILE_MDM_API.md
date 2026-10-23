# VLocker Enterprise Mobile / MDM Backend API

Backend logic, APIs and workflows behind the existing Enterprise VLocker mobile app.
No mobile UI/navigation/screens were changed — this document describes only the
server-side contract the app talks to.

- **Base URL (dev):** `http://localhost:3005`
- **Base URL (prod):** `https://api.vlocker.in`
- All bodies are JSON. All authenticated calls send `Authorization: Bearer <accessToken>`.

## Hierarchy & key lifecycle

```
Super Admin → Stockist → Distributor → Dealer → Customer (mobile)
Keys move top→bottom. Only Super Admin generates. Dealer assigns to customer.

Generated → Allocated → Transferred → Received → Assigned → Activated
          → Running → Expired → Renewed → Revoked
```

**1 loan = 1 license key.** When a dealer creates a loan for a customer
(`POST /api/customerLoan/:customerId`), the backend reserves one available
`EnterpriseKey` (status → **Assigned**), stamps the dealer/distributor/stockist
hierarchy + the device IMEI, and decrements the dealer's key balance. The customer's
device later activates that assigned key (status → **Activated**), binding IMEI +
Android ID.

---

## 1. Authentication (`/api/mobile/auth`) — public

### POST `/api/mobile/auth/request-otp`
Send an OTP to a registered customer phone (reuses SMS + rate-limit pipeline).
```json
{ "phone": "9812345678" }
```

### POST `/api/mobile/auth/login`
Login with **phone + OTP** or **customerId/email + password**. Returns an access
token (short-lived) + a rotating refresh token.
```json
{ "phone": "9812345678", "otpCode": "1234", "deviceId": "<imei-or-androidId>" }
```
```json
// or
{ "customerId": "STK-1003", "password": "secret", "deviceId": "..." }
```
**200**
```json
{
  "success": true,
  "data": {
    "userId": "…", "phone": "…", "name": "…", "role": "user",
    "accessToken": "…", "refreshToken": "…",
    "accessExpiresIn": "1h", "refreshExpiresAt": "2026-08-03T…Z"
  }
}
```

### POST `/api/mobile/auth/refresh`
Rotate a refresh token. Old token is revoked; reuse of a revoked token revokes the
whole family (theft protection).
```json
{ "refreshToken": "…" }
```

### POST `/api/mobile/auth/logout`
Revoke the presented refresh token. Local encrypted activation info may be kept on device.
```json
{ "refreshToken": "…" }
```

---

## 2. Bootstrap / profile — auth required

### GET `/api/mobile/me`
Returns everything to bootstrap the app after login: customer profile, assigned/active
key, latest loan, dealer info, organization info.

---

## 3. Device registration & activation — auth required

### POST `/api/mobile/device/register`
Register / refresh device metadata + session (before or after activation). Does **not**
activate a key.
```json
{
  "imei": "990000111122223", "androidId": "andr-0001", "fcmToken": "…",
  "deviceModel": "Pixel 7", "brand": "Google", "manufacturer": "Google",
  "androidVersion": "14", "securityPatch": "2026-06-01", "simInfo": { "carrier": "Jio" },
  "permissions": { "batteryOptimization": true, "accessibility": true, "overlay": true,
                   "usageStats": true, "notification": true, "location": true },
  "isRooted": false, "isEmulator": false, "appVersion": "1.0.0"
}
```

### POST `/api/mobile/activate`
Verify + activate the assigned key on this device. Backend checks: device integrity
(root/emulator), blacklist, customer resolved, key assigned, not expired, IMEI match &
uniqueness. On success: key **Assigned → Activated**, IMEI/Android ID/deviceId/FCM bound,
expiry set, hierarchy stamped, device registered, inventory + audit + activation history
updated, notifications sent. Returns the effective device policy.

Body = same device-info payload as `/device/register`.

**200**
```json
{
  "success": true, "message": "Device activated successfully",
  "data": {
    "keyNumber": "…", "status": "Activated",
    "activationDate": "…", "expiryDate": "…", "deviceId": "…",
    "policy": { "camera": true, "gps": true, "appBlacklist": [], "version": 1, "…": "…" }
  }
}
```
**Error codes:** `MISSING_DEVICE_ID`, `DEVICE_INTEGRITY_FAILED`, `DEVICE_BLACKLISTED`,
`CUSTOMER_NOT_FOUND`, `NO_KEY_ASSIGNED`, `KEY_BOUND_TO_OTHER_DEVICE`, `KEY_EXPIRED`,
`IMEI_MISMATCH`, `IMEI_ALREADY_REGISTERED`. (Re-activating the same device is idempotent.)

### GET `/api/mobile/device/:deviceId/policy`
Effective policy for a device (device override → dealer → global default).

### GET `/api/mobile/device/:deviceId/status`
Full device record (customer, key, lock state, session).

---

## 4. Heartbeat — auth required

### POST `/api/mobile/heartbeat`  (every ~30s)
```json
{
  "deviceId": "990000111122223", "battery": 88, "networkType": "wifi",
  "currentScreen": "Home", "appVersion": "1.0.0",
  "location": { "latitude": 19.07, "longitude": 72.87, "accuracy": 12 }
}
```
**200** → server directives:
```json
{ "success": true, "data": {
  "deviceId": "…", "isLocked": false, "lockStatus": "UNLOCKED",
  "status": "ACTIVATED", "keyStatus": "Activated", "expiryDate": "…", "serverTime": "…" } }
```

---

## 5. Remote commands

### GET `/api/mobile/device/:deviceId/commands` — auth required (device)
Poll pending commands (returned commands are marked `SENT`; expired ones flipped to
`EXPIRED`).
```json
{ "success": true, "data": [ { "commandRef": "uuid", "type": "LOCK_DEVICE", "payload": {}, "createdAt": "…" } ] }
```

### POST `/api/mobile/commands/ack` — auth required (device)
Report execution result. Idempotent by `commandRef` (replay-safe).
```json
{ "commandRef": "uuid", "status": "SUCCESS", "resultMessage": "locked", "executionTimeMs": 120 }
```
`status` ∈ `SUCCESS | FAILED | ERROR`. A successful `LOCK_DEVICE`/`UNLOCK_DEVICE`
updates the persistent device lock state and notifies the issuer.

**Command types:** `LOCK_DEVICE, UNLOCK_DEVICE, REBOOT, FACTORY_RESET,
ENABLE_CAMERA, DISABLE_CAMERA, ENABLE_MIC, DISABLE_MIC, ENABLE_GPS, DISABLE_GPS,
ENABLE_WIFI, DISABLE_WIFI, ENABLE_CALLS, DISABLE_CALLS, ENABLE_SMS, DISABLE_SMS,
ENABLE_USB, DISABLE_USB, INSTALL_APP, UNINSTALL_APP, SYNC_POLICY, SHOW_MESSAGE`.

---

## 6. Admin / dealer MDM console (`/api/mdm`) — enterprise auth required

Uses the existing enterprise JWT (`/api/auth/login`). Results are scoped to the caller's
hierarchy (super_admin sees all).

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/mdm/devices?status=&page=&limit=` | List devices (scoped) |
| GET  | `/api/mdm/devices/:deviceId` | Device detail |
| PATCH| `/api/mdm/devices/:deviceId/blacklist` | `{ "blacklisted": true, "reason": "…" }` |
| POST | `/api/mdm/commands` | Issue a remote command `{ "deviceId", "type", "payload" }` |
| GET  | `/api/mdm/policies?scope=` | List policies |
| POST | `/api/mdm/policies` | Upsert policy `{ "scope": "global|dealer|device", … }` |
| GET  | `/api/mdm/activation-history?deviceId=&limit=` | Activation history feed (scoped) |
| POST | `/api/mdm/expiry-sweep` | Manually run key-expiry sweep (super_admin) |

---

## 7. Database collections updated on activation

`EnterpriseKey` (status + binding), `Device` (registry + session), `KeyInventory`
(dealer/distributor/stockist recalculated), `AuditLog`, `Notification`,
`ActivationHistory`. Loan creation also decrements `User.keys`.

## 8. Security

- JWT access token (`MOBILE_ACCESS_TTL`, default `1h`) + hashed rotating refresh token
  (`MOBILE_REFRESH_TTL_DAYS`, default `30`), stored as SHA-256 hashes with TTL cleanup.
- Refresh-token reuse detection revokes the family.
- Device binding via IMEI + Android ID; IMEI uniqueness enforced across active keys.
- Root/emulator rejection; device blacklist gate.
- Command replay protection via unique `commandRef` + idempotent ack.
- Disabled/deleted accounts rejected by `mobileAuth` middleware.
- FCM pushes are fire-and-forget so push latency never blocks the API.
- Certificate pinning: server is TLS-terminated behind proxy; the app pins the cert
  (client-side) — backend contract is unchanged.

## 9. Offline mode (client contract)

All write endpoints are idempotent or safe to retry:
- `activate` is idempotent for the same device.
- `commands/ack` is idempotent by `commandRef`.
- `heartbeat` is last-writer-wins.
The app may queue these locally when offline and replay them on reconnect.

## Environment variables

| Var | Default | Meaning |
|-----|---------|---------|
| `JWT_SECRET` | — | signing secret (shared) |
| `MOBILE_ACCESS_TTL` | `1h` | access token lifetime |
| `MOBILE_REFRESH_TTL_DAYS` | `30` | refresh token lifetime (days) |
| `KEY_VALIDITY_DAYS` | `365` | default key validity on assignment |
| `COMMAND_TTL_MINUTES` | `60` | pending command expiry |
