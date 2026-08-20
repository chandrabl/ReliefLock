# ReliefLock Soroban Contract — Phase 1 (Foundation)

## What's implemented

- **State model**: `Campaign`, `Beneficiary`, `Voucher` with the full status
  enums from the spec (Draft/Active/Paused/Expired/Completed/Cancelled,
  Pending/Approved/Suspended, Issued/Active/PartiallyRedeemed/Redeemed/
  Expired/Cancelled).
- **Campaign lifecycle**: create → fund (auto-activates at full funding) →
  pause/resume → close (refunds undistributed balance to the NGO).
- **Beneficiary management**: register, approve, suspend — NGO-only, scoped
  to the calling NGO's own campaigns.
- **Direct claims**: `claim_aid` for non-voucher campaigns, enforcing
  approval status, per-beneficiary claim limits, campaign expiry, and
  pool balance.
- **Vouchers**: `issue_voucher`, `authorize_merchant` / `remove_merchant`,
  `redeem_voucher` (supports partial redemption), `cancel_voucher`.
- **Security**: every state-changing entrypoint calls `require_auth()` on
  the acting party; ownership is re-checked in contract logic (not just
  auth); checked arithmetic (`checked_add`) prevents overflow; a global
  `emergency_pause` lets the platform admin halt state changes.
- **Events**: every transition emits a typed event for off-chain indexing.
- **Tests**: 11 unit tests covering the happy path plus the security
  invariants judges will look for (duplicate claims, unapproved/suspended
  beneficiaries, expired campaigns, unauthorized merchants, over-redemption,
  cross-NGO authorization bypass attempts, emergency pause).

## Not yet built (later phases)

- `update_campaign`, `refund_campaign` as a standalone entrypoint (currently
  folded into `close_campaign`), campaign categories/merchant restriction
  editing after Draft.
- WASM size/gas optimization pass.
- Contract-level pagination/listing helpers (campaign/voucher lists) — the
  indexing layer (Phase 3 backend) is the intended place for "list all
  campaigns" style queries; the contract exposes point lookups by id, which
  is the correct on-chain pattern (avoids unbounded storage reads).

## Building & testing

This sandbox has no network access to install `rustup`/the wasm32 target,
so I haven't been able to run `cargo test` myself. Run this locally or in
Claude Code (which has full network access):

```bash
# one-time setup
rustup target add wasm32-unknown-unknown
cargo install --locked soroban-cli --version 21.0.0  # or `stellar` CLI (newer name)

cd contracts/relieflock-contract

# run the unit test suite
cargo test

# build the optimized WASM for deployment
cargo build --target wasm32-unknown-unknown --release
```

If `cargo test` throws compile errors, the most likely culprits given the
soroban-sdk version pinned in `Cargo.toml` (21.7.6) are:
- `env.register(...)` vs the older `env.register_contract(...)` — the API
  was renamed across 21.x point releases.
- `register_stellar_asset_contract_v2` vs `register_stellar_asset_contract`
  — also renamed across versions.

Tell me the exact error and I'll patch it — I'd rather fix a real compiler
error than guess blind at API surface across point releases.

## Deploying to testnet (once it compiles clean)

```bash
stellar keys generate ngo-admin --network testnet
stellar keys fund ngo-admin --network testnet

stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/relieflock_contract.wasm \
  --source ngo-admin \
  --network testnet

stellar contract invoke \
  --id <CONTRACT_ID> --source ngo-admin --network testnet \
  -- initialize --admin <NGO_ADMIN_ADDRESS>
```
