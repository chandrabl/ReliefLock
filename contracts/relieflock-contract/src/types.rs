use soroban_sdk::{contracttype, Address, String};

/// Lifecycle state of an aid campaign.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CampaignStatus {
    Draft,
    Active,
    Paused,
    Expired,
    Completed,
    Cancelled,
}

/// Lifecycle state of a beneficiary's participation in a campaign.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BeneficiaryStatus {
    Pending,
    Approved,
    Suspended,
}

/// Lifecycle state of a merchant-redeemable voucher.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum VoucherStatus {
    Issued,
    Active,
    PartiallyRedeemed,
    Redeemed,
    Expired,
    Cancelled,
}

/// Lifecycle state of a direct (non-voucher) aid claim.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ClaimStatus {
    Eligible,
    Pending,
    Completed,
    Rejected,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Campaign {
    pub id: u64,
    pub ngo: Address,
    pub token: Address,
    pub name: String,
    /// Total amount the NGO commits to distribute (in token base units).
    pub total_funding: i128,
    /// Amount actually deposited into the contract so far.
    pub funded_amount: i128,
    /// Amount already paid out to beneficiaries / merchants.
    pub distributed_amount: i128,
    /// Fixed allocation per beneficiary for direct claims.
    pub allocation_per_beneficiary: i128,
    pub start_time: u64,
    pub expiry_time: u64,
    pub max_claims_per_beneficiary: u32,
    /// If true, aid must be claimed as a merchant-redeemable voucher
    /// rather than paid directly to the beneficiary's wallet.
    pub merchant_restricted: bool,
    pub status: CampaignStatus,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Beneficiary {
    pub campaign_id: u64,
    pub address: Address,
    pub status: BeneficiaryStatus,
    pub claim_count: u32,
    pub claimed_amount: i128,
    pub registered_at: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Voucher {
    pub id: u64,
    pub campaign_id: u64,
    pub beneficiary: Address,
    pub amount: i128,
    pub redeemed_amount: i128,
    pub status: VoucherStatus,
    pub issued_at: u64,
    pub expiry_time: u64,
}

/// Composite key type used for per-(campaign, address) storage entries.
#[contracttype]
#[derive(Clone, Debug)]
pub struct CampaignAddrKey {
    pub campaign_id: u64,
    pub addr: Address,
}

/// Storage key namespace for the contract's persistent/instance state.
#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    /// Platform administrator address (can emergency-pause the whole contract).
    Admin,
    /// Global emergency pause flag.
    GlobalPause,
    /// Monotonic campaign id counter.
    CampaignCount,
    /// Monotonic voucher id counter.
    VoucherCount,
    Campaign(u64),
    Beneficiary(CampaignAddrKey),
    Merchant(CampaignAddrKey),
    Voucher(u64),
}
