# Stellar payments

This document explains how StellarPOS takes payment on Stellar without ever
holding a key, and why each check exists.

## Goals

1. **Non-custodial.** Customer funds go straight to the merchant's account.
   The backend can observe payments but can never move funds.
2. **No trust in the client.** A terminal, a customer, or anyone else with an
   API token cannot mark a sale paid without a matching on-chain payment.
3. **Hands-free.** The cashier shows a QR code, and the sale completes by
   itself when the customer pays.

## Two ways to pay

| Flow | When | Endpoint |
|---|---|---|
| QR checkout | The normal path. The customer scans a SEP-7 QR. | `POST /payments/requests`, then automatic |
| Pay by hash | The customer paid some other way and shows a transaction hash | `POST /payments` with `method: "stellar"` |

## QR checkout in detail

### 1. Create the request

`POST /payments/requests { transactionId }`:

- The sale must be `pending` with a positive balance.
- **Amount:** `balance_cents` converted with `STELLAR_ASSET_RATE`
  (store-currency units per asset unit) and **rounded up** to the next stroop,
  so rounding can never short the merchant.
- **Memo:** `SP` plus 10 random characters from an alphabet without
  look-alike characters (no `0/O`, `1/I/L`). That is about 49 bits of
  entropy, it fits the 28-byte text memo limit, and the column is `UNIQUE`.
- **Expiry:** now plus `STELLAR_PAYMENT_TTL_MINUTES`.
- **Idempotent:** if an unexpired request is already open for the sale, it is
  returned instead of a new one, so double-clicking "Pay with Stellar" does
  not produce two QR codes.

The returned `uri` looks like:

```
web+stellar:pay?destination=GA...&amount=12.5000000
  &asset_code=USDC&asset_issuer=GBBD...&memo=SPK7Q2M9XAB4&memo_type=MEMO_TEXT
  &msg=Kofi%20Coffee%20S-000123&network_passphrase=Test%20SDF%20Network%20%3B%20September%202015
```

`network_passphrase` is included off mainnet so wallets sign for the right
network.

### 2. Watch for the payment

[`paymentWatcher.ts`](../src/services/paymentWatcher.ts) polls
`/accounts/{merchant}/payments` every `STELLAR_WATCHER_INTERVAL_MS`:

- **Cursor-based.** The last paging token is stored in the `kv` table, so a
  restart resumes exactly where it stopped. On the very first run it starts
  from the latest payment rather than replaying the account's history.
- Only `payment` and both kinds of path payment count, and only when they
  credit the merchant account. For path payments the *destination* asset
  and amount are used, so a customer can pay in XLM through the DEX while
  the merchant receives USDC.
- Failed transactions are skipped.
- One poll runs at a time. A slow Horizon response never stacks up
  overlapping polls.

### 3. Match and settle

For each incoming payment,
[`handleIncomingPayment`](../src/services/checkout.service.ts):

1. Loads the transaction and requires `successful` and a **text** memo.
2. Finds a `pending` request with that memo. Unknown memos are ignored, since
   the account may receive unrelated payments.
3. Checks **destination**, **asset code and issuer**, and
   **amount >= requested**. Overpayment is accepted; underpayment is logged
   and the request stays pending.
4. In one database transaction, marks the request `paid` (conditional on it
   still being `pending`) and records a completed `stellar` payment with the
   transaction hash. `payments.stellar_tx_hash` is `UNIQUE`, so one on-chain
   payment can never pay twice.
5. Completes the sale and emits `payment:confirmed` and
   `transaction:completed`.

Replaying the same Horizon record is harmless: step 4's conditional update
makes settlement idempotent.

### 4. Expiry

Each poll also expires pending requests past `expires_at`. If the sale has no
other payment towards it, it is voided and its reserved stock released. The
terminal receives `payment:expired`.

## Pay by hash

`POST /payments { transactionId, method: "stellar", stellarTxHash }` runs
the same verification as above, without the memo requirement, against the
sale's current balance. A failed verification is **recorded** as a `failed`
payment (an audit trail of attempts) and answered with `402 Payment Required`
and a specific reason, such as
`Paid 12.4999999 USDC, expected 12.5000000 USDC`.

## Threat model

| Attack | Defense |
|---|---|
| Client claims a payment that never happened | Only Horizon's view counts; the client sends a hash at most |
| Reusing one real payment for two sales | `UNIQUE(stellar_tx_hash)` and a conditional settle |
| Paying with a look-alike asset (`USDC` from another issuer) | Code **and** issuer must match |
| Underpaying by rounding | Amounts compared as integer stroops; requests round up |
| Paying a different checkout's memo | Settlement is per memo, and the amount is checked against that request |
| Failed transaction that still has payment operations | `successful` is required |
| Stolen API token | Can create sales, but cannot mark them Stellar-paid without real funds arriving |
| Backend compromise | No secret key exists to steal; funds sit in the merchant's own account |

## On-chain settlement through the contracts

The flow above uses classic Stellar payments, which every wallet supports
today. The [contracts](https://github.com/StellarPOS-App/contracts)
repository adds a Soroban `payment-processor` that settles the same sale with
a protocol fee, order-reference idempotency, and loyalty points.
`STELLAR_PAYMENT_PROCESSOR_ID` and `STELLAR_MERCHANT_REGISTRY_ID` are exposed
through `GET /store` so the surface app can offer that path. Verifying it
server-side means reading the processor's `payment_settled` event for the
sale's order reference, using the same watcher pattern.
