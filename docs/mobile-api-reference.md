# Mobile API Reference (Auth, KYC, Cards)

This document describes the recently added mobile-facing endpoints.

## Base URL

- Local: `http://localhost:1337`
- API prefix: `/api`

Example full URL:
- `POST http://localhost:1337/api/auth/login`

## Authentication

Protected endpoints require:
- `Authorization: Bearer <jwt>`

JWT TTL is `10m`.

## Common error response

Strapi returns error payloads in standard error format. Typical shape:

```json
{
  "data": null,
  "error": {
    "status": 400,
    "name": "ApplicationError",
    "message": "Invalid credentials",
    "details": {}
  }
}
```

---

## 1) Auth / Registration

### 1.1 Request phone OTP

- **Method**: `POST`
- **Path**: `/api/auth/register/phone/request-otp`
- **Auth**: No

Request body:

```json
{
  "phone": "+37444111222",
  "firstName": "Gevorg",
  "lastName": "Vorgyan",
  "passportNumber": "AB123456",
  "passportType": "PASSPORT",
  "passportIssueDate": "2020-01-01",
  "passportValidTill": "2030-01-01"
}
```

Response `200`:

```json
{
  "sessionId": "f60ec8a0-b9a8-43ad-b2bc-a7c122b970f7",
  "next": "VERIFY_PHONE_OTP"
}
```

Notes:
- Backend calls third-party SMS OTP provider (phone + provider apiKey + apiSecret).
- Provider sends OTP to user and also returns OTP to backend.
- Backend stores only OTP hash.

---

### 1.2 Verify phone OTP

- **Method**: `POST`
- **Path**: `/api/auth/register/phone/verify-otp`
- **Auth**: No

Request body:

```json
{
  "sessionId": "f60ec8a0-b9a8-43ad-b2bc-a7c122b970f7",
  "phone": "+37444111222",
  "otp": "123456"
}
```

Response `200`:

```json
{
  "sessionId": "f60ec8a0-b9a8-43ad-b2bc-a7c122b970f7",
  "next": "REQUEST_EMAIL_OTP"
}
```

---

### 1.3 Request email OTP

- **Method**: `POST`
- **Path**: `/api/auth/register/email/request-otp`
- **Auth**: No

Request body:

```json
{
  "sessionId": "f60ec8a0-b9a8-43ad-b2bc-a7c122b970f7",
  "email": "user@example.com"
}
```

Response `200`:

```json
{
  "sessionId": "f60ec8a0-b9a8-43ad-b2bc-a7c122b970f7",
  "next": "VERIFY_EMAIL_OTP"
}
```

---

### 1.4 Verify email OTP

- **Method**: `POST`
- **Path**: `/api/auth/register/email/verify-otp`
- **Auth**: No

Request body:

```json
{
  "sessionId": "f60ec8a0-b9a8-43ad-b2bc-a7c122b970f7",
  "email": "user@example.com",
  "otp": "123456"
}
```

Response `200`:

```json
{
  "sessionId": "f60ec8a0-b9a8-43ad-b2bc-a7c122b970f7",
  "next": "SET_PASSWORD_AND_PIN"
}
```

---

### 1.5 Complete registration

- **Method**: `POST`
- **Path**: `/api/auth/register/complete`
- **Auth**: No

Request body:

```json
{
  "sessionId": "f60ec8a0-b9a8-43ad-b2bc-a7c122b970f7",
  "password": "Str0ng!Pass",
  "pin": "1234"
}
```

Response `200`:

```json
{
  "userId": 123,
  "next": "KYC_START_SCREEN"
}
```

Validation notes:
- `password`: min 8, must include upper, lower, number, symbol.
- `pin`: exactly 4 digits.

---

### 1.6 Login

- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Auth**: No

Request body:

```json
{
  "identifier": "user@example.com",
  "password": "Str0ng!Pass",
  "pin": "1234"
}
```

`identifier` may be:
- email, or
- phone (`+374XXXXXXXX`)

Response `200`:

```json
{
  "jwt": "<token>",
  "user": {
    "id": 123,
    "firstName": "Gevorg",
    "lastName": "Vorgyan",
    "kycStatus": "NOT_ATTEMPTED",
    "pendingForManualVerification": false
  },
  "expiresIn": "10m"
}
```

---

## 2) KYC

### 2.1 Start document check

- **Method**: `POST`
- **Path**: `/api/kyc/start-doc-check`
- **Auth**: Yes (Bearer JWT)

Request body:
- Empty body

Success response `200`:

```json
{
  "docMatched": true,
  "passportImage": "<provider-temporary-image-or-base64>",
  "next": "FACE_VERIFICATION"
}
```

Fail response `200` (business failure, not transport failure):

```json
{
  "docMatched": false,
  "kycStatus": "FAILED",
  "attemptsLeft": 2,
  "pendingForManualVerification": false,
  "message": "Passport data mismatch"
}
```

Possible error status codes:
- `401` unauthorized
- `403` manual review required
- `404` customer profile not found
- `409` KYC already passed

---

### 2.2 Verify face

- **Method**: `POST`
- **Path**: `/api/kyc/verify-face`
- **Auth**: Yes (Bearer JWT)
- **Content-Type**: `multipart/form-data`

Form fields:
- `video` (file, required)
- `passportImage` (string, optional)
- `passportImageRef` (string, optional)

Success response `200`:

```json
{
  "kycStatus": "PASSED"
}
```

Failure response `200`:

```json
{
  "kycStatus": "FAILED",
  "attemptsLeft": 1,
  "pendingForManualVerification": false,
  "retryAllowed": true
}
```

Possible error status codes:
- `400` document step not completed / video missing
- `401` unauthorized
- `404` customer profile not found

---

## 3) Cards

### 3.1 Attach init

- **Method**: `POST`
- **Path**: `/api/cards/attach/init`
- **Auth**: Yes (Bearer JWT)

Request body:
- Empty body

Response `200`:

```json
{
  "bankSessionId": "bank_1740867900000_123",
  "expiresInSeconds": 600
}
```

---

### 3.2 Attach complete

- **Method**: `POST`
- **Path**: `/api/cards/attach/complete`
- **Auth**: Yes (Bearer JWT)

Request body:

```json
{
  "bankCardId": "bc_100200",
  "cardToken": "tok_abc123",
  "maskedPan": "**** **** **** 1234",
  "last4": "1234",
  "brand": "VISA",
  "expMonth": 12,
  "expYear": 2030,
  "cardholderName": "Gevorg Vorgyan",
  "issuerBank": "Example Bank",
  "country": "AM",
  "fingerprint": "fp_987654",
  "status": "ACTIVE",
  "bankCustomerId": "cust_445566"
}
```

Rules:
- At least one of `bankCardId` or `fingerprint` is required.
- Duplicate card for same user returns `409`.

Response `200`:

```json
{
  "cardId": 77,
  "status": "ACTIVE"
}
```

---

### 3.3 List cards

- **Method**: `GET`
- **Path**: `/api/cards`
- **Auth**: Yes (Bearer JWT)

Response `200`:

```json
{
  "data": [
    {
      "id": 77,
      "bankCardId": "bc_100200",
      "maskedPan": "**** **** **** 1234",
      "last4": "1234",
      "brand": "VISA",
      "expMonth": 12,
      "expYear": 2030,
      "status": "ACTIVE",
      "isDefault": true
    }
  ]
}
```

---

### 3.4 Set default card

- **Method**: `POST`
- **Path**: `/api/cards/default`
- **Auth**: Yes (Bearer JWT)

Request body:

```json
{
  "cardId": 77
}
```

Response `200`:

```json
{
  "cardId": 77,
  "isDefault": true
}
```

Possible error status codes:
- `401` unauthorized
- `404` card not found

---

## 4) Endpoint summary

| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/register/phone/request-otp` | No |
| POST | `/api/auth/register/phone/verify-otp` | No |
| POST | `/api/auth/register/email/request-otp` | No |
| POST | `/api/auth/register/email/verify-otp` | No |
| POST | `/api/auth/register/complete` | No |
| POST | `/api/auth/login` | No |
| POST | `/api/kyc/start-doc-check` | Yes |
| POST | `/api/kyc/verify-face` | Yes |
| POST | `/api/cards/attach/init` | Yes |
| POST | `/api/cards/attach/complete` | Yes |
| GET | `/api/cards` | Yes |
| POST | `/api/cards/default` | Yes |
