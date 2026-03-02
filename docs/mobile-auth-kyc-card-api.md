# Mobile Auth + KYC + Cards Integration Guide

## 1) Required environment variables

Core:
- `JWT_SECRET`
- `SENSITIVE_HASH_SECRET` (recommended)
- `REGISTRATION_SESSION_TTL_MINUTES` (default `30`)

OTP:
- `OTP_HASH_SECRET` (recommended)
- `OTP_TTL_SECONDS` (default `180`)
- `OTP_RESEND_COOLDOWN_SECONDS` (default `30`)
- `OTP_MAX_RESEND_PER_CHANNEL` (default `5`)
- `OTP_MAX_VERIFY_ATTEMPTS` (default `5`)
- `ALLOW_LOCAL_PHONE_OTP_FALLBACK` (default disabled; set `true` only for local dev)

Phone OTP third-party provider:
- `SMS_PROVIDER_URL`
- `SMS_PROVIDER_API_KEY`
- `SMS_PROVIDER_API_SECRET`
- `MOCK_PHONE_OTP_ENABLED` (default `true` right now for non-integrated environments)
- `MOCK_PHONE_OTP_CODE` (default `123456`)

Email OTP:
- Existing Strapi email provider config in `config/plugins.ts` (`nodemailer` currently configured)

KYC providers:
- `KYC_DOC_API_URL`
- `KYC_DOC_API_TOKEN`
- `KYC_FACE_API_URL`
- `KYC_FACE_API_TOKEN`
- `KYC_SSN_STORAGE` (`HASH` default, or `PLAIN` only if legally allowed)
- `KYC_START_RATE_MAX` (default `6`)
- `KYC_START_RATE_WINDOW_MS` (default `60000`)
- Face endpoint fallback (temporary): `http://192.168.5.2:3000/kyc/liveness`

Login rate limiting:
- `LOGIN_RATE_WINDOW_MS` (default `60000`)
- `LOGIN_RATE_MAX_PER_WINDOW` (default `10`)

## 2) Phone OTP provider contract

Backend call sent to provider (`POST SMS_PROVIDER_URL`):

```json
{
  "phone": "+374XXXXXXXX",
  "apiKey": "<SMS_PROVIDER_API_KEY>",
  "apiSecret": "<SMS_PROVIDER_API_SECRET>"
}
```

Expected provider success response:

```json
{
  "requestId": "provider-request-id",
  "otp": "123456"
}
```

Accepted OTP keys in response:
- `otp` (preferred)
- `code` (fallback)

Notes:
- Provider is responsible for delivering OTP to user phone.
- Backend hashes returned OTP and stores only hash in `otp_code`.
- Plain OTP is never persisted and should never be logged.
- Current temporary mode: when `MOCK_PHONE_OTP_ENABLED=true`, backend simulates provider response with OTP `123456` (or `MOCK_PHONE_OTP_CODE`) and keeps the same flow.

## 3) Registration flow endpoints

### Step 1 — Request phone OTP
`POST /api/auth/register/phone/request-otp`

Body:
```json
{
  "phone": "+374XXXXXXXX",
  "firstName": "Name",
  "lastName": "Surname",
  "passportNumber": "AB123456",
  "passportType": "PASSPORT",
  "passportIssueDate": "2020-01-01",
  "passportValidTill": "2030-01-01"
}
```

Response:
```json
{
  "sessionId": "uuid",
  "next": "VERIFY_PHONE_OTP"
}
```

### Step 2 — Verify phone OTP
`POST /api/auth/register/phone/verify-otp`

Body:
```json
{
  "sessionId": "uuid",
  "phone": "+374XXXXXXXX",
  "otp": "123456"
}
```

### Step 3 — Request email OTP
`POST /api/auth/register/email/request-otp`

Body:
```json
{
  "sessionId": "uuid",
  "email": "user@example.com"
}
```

### Step 4 — Verify email OTP
`POST /api/auth/register/email/verify-otp`

Body:
```json
{
  "sessionId": "uuid",
  "email": "user@example.com",
  "otp": "123456"
}
```

### Step 5 — Complete registration (creates Strapi user + profile)
`POST /api/auth/register/complete`

Body:
```json
{
  "sessionId": "uuid",
  "password": "Str0ng!Pass",
  "pin": "1234"
}
```

Response:
```json
{
  "userId": 1,
  "next": "KYC_START_SCREEN"
}
```

## 4) Login

`POST /api/auth/login/verify-credentials`

Body:
```json
{
  "identifier": "user@example.com or +374XXXXXXXX",
  "password": "Str0ng!Pass"
}
```

Response contains pre-pin token.

Then call:

`POST /api/auth/login/verify-pin`

Headers:
- `Authorization: Bearer <pre-pin-token>`

Body:
```json
{
  "pin": "1234"
}
```

Response contains final JWT with 10 minute expiry.

## 5) KYC endpoints

- `POST /api/kyc/start-doc-check` (auth required)
- `POST /api/kyc/verify-face` (auth required, multipart with: `video`, `sessionId`, `deviceId`, `platform`, `appVersion`)

Current mock behavior for doc-provider call (`MOCK_KYC_DOC_PROVIDER_ENABLED=true`):

```json
{
  "ssn": 3412910627,
  "docs": [
    {
      "number": "AS0497150",
      "name": "Gor.",
      "surname": "Gevorgyan",
      "image": "/uploads/testPassport.png"
    }
  ]
}
```

Return:
- On success: `{ docMatched: true, next: "FACE_VERIFICATION" }`
- On fail: `{ docMatched:false, kycStatus, attemptsLeft, pendingForManualVerification, message }`

Storage policy:
- The endpoint does not return passport image to frontend.
- Passport image from provider is encrypted and stored temporarily on server for face verification step.
- Do not persist raw image/video in DB/filesystem.

Face provider request payload sent by backend (`multipart/form-data`):
- `video` (required)
- `passportImage` (required; read from encrypted server-side data produced by doc-check)
- `sessionId` (required)
- `deviceId` (required)
- `platform` (required)
- `appVersion` (required)

Expected provider response shape:

```ts
type InferenceResponse = {
  status: 'PASS' | 'FAIL' | 'RETRY';
  matchScore: number;
  livenessScore: number;
  reasons: string[];
};
```

## 6) Card endpoints

- `POST /api/cards/attach/init` (auth required)
- `POST /api/cards/attach/complete` (auth required)
- `GET /api/cards` (auth required)
- `POST /api/cards/default` (auth required)

Storage policy:
- Store tokenized fields only (`cardToken`, `maskedPan`, `last4`, etc.).
- Never store full PAN or CVV.

## 7) Security notes

- JWT expiry is configured to 10 minutes in `config/plugins.ts`.
- OTP and login endpoints are rate-limited.
- OTP cleanup task runs every 5 minutes.
- Do not log OTP values, passport images, or liveness videos.
