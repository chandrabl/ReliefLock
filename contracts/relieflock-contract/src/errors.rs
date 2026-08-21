use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    GlobalPaused = 4,

    CampaignNotFound = 10,
    CampaignNotDraft = 11,
    CampaignNotActive = 12,
    CampaignAlreadyActive = 13,
    CampaignExpired = 14,
    CampaignNotExpired = 15,
    CampaignFullyFunded = 16,
    CampaignUnderfunded = 17,
    CampaignNotClosable = 18,
    InvalidCampaignParams = 19,

    BeneficiaryNotFound = 20,
    BeneficiaryAlreadyRegistered = 21,
    BeneficiaryNotApproved = 22,
    BeneficiarySuspended = 23,
    ClaimLimitReached = 24,

    MerchantNotAuthorized = 30,
    MerchantAlreadyAuthorized = 31,
    CampaignNotMerchantRestricted = 32,
    CampaignIsMerchantRestricted = 33,

    VoucherNotFound = 40,
    VoucherNotActive = 41,
    VoucherExpired = 42,
    VoucherInsufficientBalance = 43,
    VoucherAlreadyCancelled = 44,

    InvalidAmount = 50,
    Overflow = 51,
    InsufficientContractBalance = 52,
}
