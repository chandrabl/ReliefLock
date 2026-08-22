#![no_std]

mod errors;
mod events;
mod types;

#[cfg(test)]
mod test;

use errors::Error;
use types::{
    Beneficiary, BeneficiaryStatus, Campaign, CampaignAddrKey, CampaignStatus, DataKey, Voucher,
    VoucherStatus,
};

use soroban_sdk::{contract, contractimpl, token, Address, Env, String};

const DAY_IN_LEDGERS: u32 = 17280; // ~5s per ledger
const INSTANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;
const PERSISTENT_BUMP_AMOUNT: u32 = 90 * DAY_IN_LEDGERS;
const PERSISTENT_LIFETIME_THRESHOLD: u32 = PERSISTENT_BUMP_AMOUNT - DAY_IN_LEDGERS;

#[contract]
pub struct ReliefLockContract;

// ---------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

fn require_admin(env: &Env) -> Result<Address, Error> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)?;
    admin.require_auth();
    Ok(admin)
}

fn get_campaign(env: &Env, campaign_id: u64) -> Result<Campaign, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Campaign(campaign_id))
        .ok_or(Error::CampaignNotFound)
}

fn save_campaign(env: &Env, campaign: &Campaign) {
    let key = DataKey::Campaign(campaign.id);
    env.storage().persistent().set(&key, campaign);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_LIFETIME_THRESHOLD, PERSISTENT_BUMP_AMOUNT);
}

fn get_beneficiary(env: &Env, campaign_id: u64, addr: &Address) -> Result<Beneficiary, Error> {
    let key = DataKey::Beneficiary(CampaignAddrKey {
        campaign_id,
        addr: addr.clone(),
    });
    env.storage()
        .persistent()
        .get(&key)
        .ok_or(Error::BeneficiaryNotFound)
}

fn save_beneficiary(env: &Env, b: &Beneficiary) {
    let key = DataKey::Beneficiary(CampaignAddrKey {
        campaign_id: b.campaign_id,
        addr: b.address.clone(),
    });
    env.storage().persistent().set(&key, b);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_LIFETIME_THRESHOLD, PERSISTENT_BUMP_AMOUNT);
}

fn is_merchant_authorized(env: &Env, campaign_id: u64, merchant: &Address) -> bool {
    let key = DataKey::Merchant(CampaignAddrKey {
        campaign_id,
        addr: merchant.clone(),
    });
    env.storage().persistent().get(&key).unwrap_or(false)
}

fn get_voucher(env: &Env, voucher_id: u64) -> Result<Voucher, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Voucher(voucher_id))
        .ok_or(Error::VoucherNotFound)
}

fn save_voucher(env: &Env, v: &Voucher) {
    let key = DataKey::Voucher(v.id);
    env.storage().persistent().set(&key, v);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_LIFETIME_THRESHOLD, PERSISTENT_BUMP_AMOUNT);
}

fn checked_add(a: i128, b: i128) -> Result<i128, Error> {
    a.checked_add(b).ok_or(Error::Overflow)
}

fn require_not_globally_paused(env: &Env) -> Result<(), Error> {
    let paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::GlobalPause)
        .unwrap_or(false);
    if paused {
        return Err(Error::GlobalPaused);
    }
    Ok(())
}

// ---------------------------------------------------------------------
// Contract implementation
// ---------------------------------------------------------------------

#[contractimpl]
impl ReliefLockContract {
    /// One-time platform initialization. `admin` is the platform administrator
    /// address that can trigger the global emergency pause.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::GlobalPause, &false);
        env.storage().instance().set(&DataKey::CampaignCount, &0u64);
        env.storage().instance().set(&DataKey::VoucherCount, &0u64);
        bump_instance(&env);
        Ok(())
    }

    /// Platform admin only: halts all state-changing operations contract-wide.
    pub fn emergency_pause(env: Env, admin: Address) -> Result<(), Error> {
        let stored_admin = require_admin(&env)?;
        if stored_admin != admin {
            return Err(Error::Unauthorized);
        }
        env.storage().instance().set(&DataKey::GlobalPause, &true);
        bump_instance(&env);
        Ok(())
    }

    pub fn emergency_resume(env: Env, admin: Address) -> Result<(), Error> {
        let stored_admin = require_admin(&env)?;
        if stored_admin != admin {
            return Err(Error::Unauthorized);
        }
        env.storage().instance().set(&DataKey::GlobalPause, &false);
        bump_instance(&env);
        Ok(())
    }

    // -------------------------------------------------------------
    // Campaign lifecycle
    // -------------------------------------------------------------

    #[allow(clippy::too_many_arguments)]
    pub fn create_campaign(
        env: Env,
        ngo: Address,
        token: Address,
        name: String,
        total_funding: i128,
        allocation_per_beneficiary: i128,
        start_time: u64,
        expiry_time: u64,
        max_claims_per_beneficiary: u32,
        merchant_restricted: bool,
    ) -> Result<u64, Error> {
        require_not_globally_paused(&env)?;
        ngo.require_auth();

        if total_funding <= 0
            || allocation_per_beneficiary <= 0
            || allocation_per_beneficiary > total_funding
            || expiry_time <= start_time
            || max_claims_per_beneficiary == 0
        {
            return Err(Error::InvalidCampaignParams);
        }

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::CampaignCount, &count);

        let campaign = Campaign {
            id: count,
            ngo: ngo.clone(),
            token,
            name,
            total_funding,
            funded_amount: 0,
            distributed_amount: 0,
            allocation_per_beneficiary,
            start_time,
            expiry_time,
            max_claims_per_beneficiary,
            merchant_restricted,
            status: CampaignStatus::Draft,
            created_at: env.ledger().timestamp(),
        };
        save_campaign(&env, &campaign);
        bump_instance(&env);
        events::campaign_created(&env, campaign.id, &ngo);
        Ok(campaign.id)
    }

    /// Transfers `amount` of the campaign's token from the NGO into the
    /// contract. Automatically activates the campaign once fully funded.
    pub fn fund_campaign(env: Env, ngo: Address, campaign_id: u64, amount: i128) -> Result<(), Error> {
        require_not_globally_paused(&env)?;
        ngo.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut campaign = get_campaign(&env, campaign_id)?;
        if campaign.ngo != ngo {
            return Err(Error::Unauthorized);
        }
        if !matches!(campaign.status, CampaignStatus::Draft | CampaignStatus::Active) {
            return Err(Error::CampaignNotDraft);
        }
        if campaign.funded_amount >= campaign.total_funding {
            return Err(Error::CampaignFullyFunded);
        }

        let token_client = token::Client::new(&env, &campaign.token);
        token_client.transfer(&ngo, &env.current_contract_address(), &amount);

        campaign.funded_amount = checked_add(campaign.funded_amount, amount)?;
        if campaign.funded_amount >= campaign.total_funding
            && matches!(campaign.status, CampaignStatus::Draft)
        {
            campaign.status = CampaignStatus::Active;
            events::campaign_status_changed(&env, campaign.id, CampaignStatus::Active as u32);
        }
        save_campaign(&env, &campaign);
        events::campaign_funded(&env, campaign_id, amount);
        Ok(())
    }

    pub fn pause_campaign(env: Env, ngo: Address, campaign_id: u64) -> Result<(), Error> {
        ngo.require_auth();
        let mut campaign = get_campaign(&env, campaign_id)?;
        if campaign.ngo != ngo {
            return Err(Error::Unauthorized);
        }
        if !matches!(campaign.status, CampaignStatus::Active) {
            return Err(Error::CampaignNotActive);
        }
        campaign.status = CampaignStatus::Paused;
        save_campaign(&env, &campaign);
        events::campaign_status_changed(&env, campaign_id, CampaignStatus::Paused as u32);
        Ok(())
    }

    pub fn resume_campaign(env: Env, ngo: Address, campaign_id: u64) -> Result<(), Error> {
        ngo.require_auth();
        let mut campaign = get_campaign(&env, campaign_id)?;
        if campaign.ngo != ngo {
            return Err(Error::Unauthorized);
        }
        if !matches!(campaign.status, CampaignStatus::Paused) {
            return Err(Error::CampaignNotActive);
        }
        if env.ledger().timestamp() >= campaign.expiry_time {
            campaign.status = CampaignStatus::Expired;
            save_campaign(&env, &campaign);
            return Err(Error::CampaignExpired);
        }
        campaign.status = CampaignStatus::Active;
        save_campaign(&env, &campaign);
        events::campaign_status_changed(&env, campaign_id, CampaignStatus::Active as u32);
        Ok(())
    }

    /// Closes the campaign and refunds any undistributed funds to the NGO.
    /// Allowed from Active, Paused, or Expired states.
    pub fn close_campaign(env: Env, ngo: Address, campaign_id: u64) -> Result<(), Error> {
        ngo.require_auth();
        let mut campaign = get_campaign(&env, campaign_id)?;
        if campaign.ngo != ngo {
            return Err(Error::Unauthorized);
        }
        if !matches!(
            campaign.status,
            CampaignStatus::Active | CampaignStatus::Paused | CampaignStatus::Expired
        ) {
            return Err(Error::CampaignNotClosable);
        }

        let remaining = campaign.funded_amount - campaign.distributed_amount;
        if remaining > 0 {
            let token_client = token::Client::new(&env, &campaign.token);
            token_client.transfer(&env.current_contract_address(), &ngo, &remaining);
            events::campaign_refunded(&env, campaign_id, remaining);
        }

        campaign.status = CampaignStatus::Completed;
        save_campaign(&env, &campaign);
        events::campaign_status_changed(&env, campaign_id, CampaignStatus::Completed as u32);
        Ok(())
    }

    // -------------------------------------------------------------
    // Beneficiary management
    // -------------------------------------------------------------

    pub fn register_beneficiary(
        env: Env,
        ngo: Address,
        campaign_id: u64,
        beneficiary: Address,
    ) -> Result<(), Error> {
        ngo.require_auth();
        let campaign = get_campaign(&env, campaign_id)?;
        if campaign.ngo != ngo {
            return Err(Error::Unauthorized);
        }
        let key = DataKey::Beneficiary(CampaignAddrKey {
            campaign_id,
            addr: beneficiary.clone(),
        });
        if env.storage().persistent().has(&key) {
            return Err(Error::BeneficiaryAlreadyRegistered);
        }
        let b = Beneficiary {
            campaign_id,
            address: beneficiary.clone(),
            status: BeneficiaryStatus::Pending,
            claim_count: 0,
            claimed_amount: 0,
            registered_at: env.ledger().timestamp(),
        };
        save_beneficiary(&env, &b);
        events::beneficiary_registered(&env, campaign_id, &beneficiary);
        Ok(())
    }

    pub fn approve_beneficiary(
        env: Env,
        ngo: Address,
        campaign_id: u64,
        beneficiary: Address,
    ) -> Result<(), Error> {
        ngo.require_auth();
        let campaign = get_campaign(&env, campaign_id)?;
        if campaign.ngo != ngo {
            return Err(Error::Unauthorized);
        }
        let mut b = get_beneficiary(&env, campaign_id, &beneficiary)?;
        b.status = BeneficiaryStatus::Approved;
        save_beneficiary(&env, &b);
        events::beneficiary_status_changed(
            &env,
            campaign_id,
            &beneficiary,
            BeneficiaryStatus::Approved as u32,
        );
        Ok(())
    }

    pub fn suspend_beneficiary(
        env: Env,
        ngo: Address,
        campaign_id: u64,
        beneficiary: Address,
    ) -> Result<(), Error> {
        ngo.require_auth();
        let campaign = get_campaign(&env, campaign_id)?;
        if campaign.ngo != ngo {
            return Err(Error::Unauthorized);
        }
        let mut b = get_beneficiary(&env, campaign_id, &beneficiary)?;
        b.status = BeneficiaryStatus::Suspended;
        save_beneficiary(&env, &b);
        events::beneficiary_status_changed(
            &env,
            campaign_id,
            &beneficiary,
            BeneficiaryStatus::Suspended as u32,
        );
        Ok(())
    }

    // -------------------------------------------------------------
    // Direct aid claims (non-voucher campaigns)
    // -------------------------------------------------------------

    /// Beneficiary claims their fixed allocation directly to their wallet.
    /// Only valid for campaigns where `merchant_restricted == false`.
    pub fn claim_aid(env: Env, beneficiary: Address, campaign_id: u64) -> Result<i128, Error> {
        require_not_globally_paused(&env)?;
        beneficiary.require_auth();

        let mut campaign = get_campaign(&env, campaign_id)?;
        if campaign.merchant_restricted {
            return Err(Error::CampaignIsMerchantRestricted);
        }
        Self::validate_campaign_claimable(&env, &mut campaign)?;

        let mut b = get_beneficiary(&env, campaign_id, &beneficiary)?;
        if matches!(b.status, BeneficiaryStatus::Suspended) {
            return Err(Error::BeneficiarySuspended);
        }
        if !matches!(b.status, BeneficiaryStatus::Approved) {
            return Err(Error::BeneficiaryNotApproved);
        }
        if b.claim_count >= campaign.max_claims_per_beneficiary {
            return Err(Error::ClaimLimitReached);
        }

        let amount = campaign.allocation_per_beneficiary;
        let remaining_pool = campaign.funded_amount - campaign.distributed_amount;
        if amount > remaining_pool {
            return Err(Error::InsufficientContractBalance);
        }

        let token_client = token::Client::new(&env, &campaign.token);
        token_client.transfer(&env.current_contract_address(), &beneficiary, &amount);

        campaign.distributed_amount = checked_add(campaign.distributed_amount, amount)?;
        save_campaign(&env, &campaign);

        b.claim_count += 1;
        b.claimed_amount = checked_add(b.claimed_amount, amount)?;
        save_beneficiary(&env, &b);

        events::aid_claimed(&env, campaign_id, &beneficiary, amount);
        Ok(amount)
    }

    // -------------------------------------------------------------
    // Vouchers (merchant-restricted campaigns)
    // -------------------------------------------------------------

    pub fn issue_voucher(
        env: Env,
        ngo: Address,
        campaign_id: u64,
        beneficiary: Address,
    ) -> Result<u64, Error> {
        require_not_globally_paused(&env)?;
        ngo.require_auth();

        let mut campaign = get_campaign(&env, campaign_id)?;
        if campaign.ngo != ngo {
            return Err(Error::Unauthorized);
        }
        if !campaign.merchant_restricted {
            return Err(Error::CampaignNotMerchantRestricted);
        }
        Self::validate_campaign_claimable(&env, &mut campaign)?;

        let mut b = get_beneficiary(&env, campaign_id, &beneficiary)?;
        if matches!(b.status, BeneficiaryStatus::Suspended) {
            return Err(Error::BeneficiarySuspended);
        }
        if !matches!(b.status, BeneficiaryStatus::Approved) {
            return Err(Error::BeneficiaryNotApproved);
        }
        if b.claim_count >= campaign.max_claims_per_beneficiary {
            return Err(Error::ClaimLimitReached);
        }

        let amount = campaign.allocation_per_beneficiary;
        let remaining_pool = campaign.funded_amount - campaign.distributed_amount;
        if amount > remaining_pool {
            return Err(Error::InsufficientContractBalance);
        }

        // Reserve the funds against the campaign pool immediately so the same
        // allocation cannot be double-issued as another voucher.
        campaign.distributed_amount = checked_add(campaign.distributed_amount, amount)?;
        save_campaign(&env, &campaign);

        b.claim_count += 1;
        save_beneficiary(&env, &b);

        let mut voucher_count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::VoucherCount)
            .unwrap_or(0);
        voucher_count += 1;
        env.storage()
            .instance()
            .set(&DataKey::VoucherCount, &voucher_count);

        let voucher = Voucher {
            id: voucher_count,
            campaign_id,
            beneficiary: beneficiary.clone(),
            amount,
            redeemed_amount: 0,
            status: VoucherStatus::Active,
            issued_at: env.ledger().timestamp(),
            expiry_time: campaign.expiry_time,
        };
        save_voucher(&env, &voucher);
        events::voucher_issued(&env, voucher.id, campaign_id, &beneficiary, amount);
        Ok(voucher.id)
    }

    pub fn authorize_merchant(
        env: Env,
        ngo: Address,
        campaign_id: u64,
        merchant: Address,
    ) -> Result<(), Error> {
        ngo.require_auth();
        let campaign = get_campaign(&env, campaign_id)?;
        if campaign.ngo != ngo {
            return Err(Error::Unauthorized);
        }
        let key = DataKey::Merchant(CampaignAddrKey {
            campaign_id,
            addr: merchant.clone(),
        });
        if env.storage().persistent().get(&key).unwrap_or(false) {
            return Err(Error::MerchantAlreadyAuthorized);
        }
        env.storage().persistent().set(&key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_LIFETIME_THRESHOLD, PERSISTENT_BUMP_AMOUNT);
        events::merchant_authorized(&env, campaign_id, &merchant);
        Ok(())
    }

    pub fn remove_merchant(
        env: Env,
        ngo: Address,
        campaign_id: u64,
        merchant: Address,
    ) -> Result<(), Error> {
        ngo.require_auth();
        let campaign = get_campaign(&env, campaign_id)?;
        if campaign.ngo != ngo {
            return Err(Error::Unauthorized);
        }
        let key = DataKey::Merchant(CampaignAddrKey {
            campaign_id,
            addr: merchant.clone(),
        });
        if !env.storage().persistent().get(&key).unwrap_or(false) {
            return Err(Error::MerchantNotAuthorized);
        }
        env.storage().persistent().set(&key, &false);
        events::merchant_removed(&env, campaign_id, &merchant);
        Ok(())
    }

    /// Merchant redeems some or all of a voucher's remaining balance.
    /// `amount` supports partial redemption; pass the full remaining
    /// balance to redeem in one shot.
    pub fn redeem_voucher(
        env: Env,
        merchant: Address,
        voucher_id: u64,
        amount: i128,
    ) -> Result<(), Error> {
        require_not_globally_paused(&env)?;
        merchant.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut voucher = get_voucher(&env, voucher_id)?;
        if matches!(voucher.status, VoucherStatus::Cancelled) {
            return Err(Error::VoucherAlreadyCancelled);
        }
        if !matches!(
            voucher.status,
            VoucherStatus::Active | VoucherStatus::Issued | VoucherStatus::PartiallyRedeemed
        ) {
            return Err(Error::VoucherNotActive);
        }
        if env.ledger().timestamp() >= voucher.expiry_time {
            voucher.status = VoucherStatus::Expired;
            save_voucher(&env, &voucher);
            return Err(Error::VoucherExpired);
        }

        let campaign = get_campaign(&env, voucher.campaign_id)?;
        if !matches!(campaign.status, CampaignStatus::Active) {
            return Err(Error::CampaignNotActive);
        }
        if !is_merchant_authorized(&env, voucher.campaign_id, &merchant) {
            return Err(Error::MerchantNotAuthorized);
        }

        let remaining = voucher.amount - voucher.redeemed_amount;
        if amount > remaining {
            return Err(Error::VoucherInsufficientBalance);
        }

        let token_client = token::Client::new(&env, &campaign.token);
        token_client.transfer(&env.current_contract_address(), &merchant, &amount);

        voucher.redeemed_amount = checked_add(voucher.redeemed_amount, amount)?;
        voucher.status = if voucher.redeemed_amount >= voucher.amount {
            VoucherStatus::Redeemed
        } else {
            VoucherStatus::PartiallyRedeemed
        };
        save_voucher(&env, &voucher);

        events::voucher_redeemed(&env, voucher_id, &merchant, amount);
        Ok(())
    }

    pub fn cancel_voucher(env: Env, ngo: Address, voucher_id: u64) -> Result<(), Error> {
        ngo.require_auth();
        let mut voucher = get_voucher(&env, voucher_id)?;
        let campaign = get_campaign(&env, voucher.campaign_id)?;
        if campaign.ngo != ngo {
            return Err(Error::Unauthorized);
        }
        if matches!(
            voucher.status,
            VoucherStatus::Redeemed | VoucherStatus::Cancelled
        ) {
            return Err(Error::VoucherAlreadyCancelled);
        }
        voucher.status = VoucherStatus::Cancelled;
        save_voucher(&env, &voucher);
        Ok(())
    }

    // -------------------------------------------------------------
    // Read-only getters
    // -------------------------------------------------------------

    pub fn get_campaign(env: Env, campaign_id: u64) -> Result<Campaign, Error> {
        get_campaign(&env, campaign_id)
    }

    pub fn get_beneficiary(
        env: Env,
        campaign_id: u64,
        beneficiary: Address,
    ) -> Result<Beneficiary, Error> {
        get_beneficiary(&env, campaign_id, &beneficiary)
    }

    pub fn get_voucher(env: Env, voucher_id: u64) -> Result<Voucher, Error> {
        get_voucher(&env, voucher_id)
    }

    pub fn get_campaign_balance(env: Env, campaign_id: u64) -> Result<i128, Error> {
        let c = get_campaign(&env, campaign_id)?;
        Ok(c.funded_amount - c.distributed_amount)
    }

    pub fn is_merchant_authorized(env: Env, campaign_id: u64, merchant: Address) -> bool {
        is_merchant_authorized(&env, campaign_id, &merchant)
    }

    // -------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------

    fn validate_campaign_claimable(env: &Env, campaign: &mut Campaign) -> Result<(), Error> {
        if env.ledger().timestamp() >= campaign.expiry_time {
            if !matches!(campaign.status, CampaignStatus::Expired) {
                campaign.status = CampaignStatus::Expired;
                save_campaign(env, campaign);
            }
            return Err(Error::CampaignExpired);
        }
        if !matches!(campaign.status, CampaignStatus::Active) {
            return Err(Error::CampaignNotActive);
        }
        Ok(())
    }
}
