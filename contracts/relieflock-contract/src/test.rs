#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Env, String,
};

fn create_token<'a>(env: &Env, admin: &Address) -> (TokenClient<'a>, StellarAssetClient<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let addr = sac.address();
    (
        TokenClient::new(env, &addr),
        StellarAssetClient::new(env, &addr),
    )
}

fn setup<'a>() -> (
    Env,
    ReliefLockContractClient<'a>,
    Address, // platform admin
    Address, // ngo
    TokenClient<'a>,
    StellarAssetClient<'a>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let ngo = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token, token_admin_client) = create_token(&env, &token_admin);

    let contract_id = env.register(ReliefLockContract, ());
    let client = ReliefLockContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    // Fund the NGO with plenty of test tokens.
    token_admin_client.mint(&ngo, &1_000_000_000);

    (env, client, admin, ngo, token, token_admin_client)
}

fn make_campaign(
    env: &Env,
    client: &ReliefLockContractClient,
    ngo: &Address,
    token: &Address,
    merchant_restricted: bool,
) -> u64 {
    let name = String::from_str(env, "Flood Relief");
    let now = env.ledger().timestamp();
    client.create_campaign(
        ngo,
        token,
        &name,
        &10_000i128,
        &100i128,
        &now,
        &(now + 30 * 86400),
        &1u32,
        &merchant_restricted,
    )
}

#[test]
fn test_campaign_creation_and_funding_activates_it() {
    let (env, client, _admin, ngo, token, _) = setup();
    let campaign_id = make_campaign(&env, &client, &ngo, &token.address, false);

    let campaign = client.get_campaign(&campaign_id);
    assert_eq!(campaign.status, CampaignStatus::Draft);

    client.fund_campaign(&ngo, &campaign_id, &5_000);
    let campaign = client.get_campaign(&campaign_id);
    assert_eq!(campaign.status, CampaignStatus::Draft);
    assert_eq!(campaign.funded_amount, 5_000);

    client.fund_campaign(&ngo, &campaign_id, &5_000);
    let campaign = client.get_campaign(&campaign_id);
    assert_eq!(campaign.status, CampaignStatus::Active);
    assert_eq!(campaign.funded_amount, 10_000);
}

#[test]
fn test_direct_claim_happy_path() {
    let (env, client, _admin, ngo, token, _) = setup();
    let campaign_id = make_campaign(&env, &client, &ngo, &token.address, false);
    client.fund_campaign(&ngo, &campaign_id, &10_000);

    let beneficiary = Address::generate(&env);
    client.register_beneficiary(&ngo, &campaign_id, &beneficiary);
    client.approve_beneficiary(&ngo, &campaign_id, &beneficiary);

    let paid = client.claim_aid(&beneficiary, &campaign_id);
    assert_eq!(paid, 100);
    assert_eq!(token.balance(&beneficiary), 100);

    let b = client.get_beneficiary(&campaign_id, &beneficiary);
    assert_eq!(b.claim_count, 1);
    assert_eq!(b.claimed_amount, 100);

    let campaign = client.get_campaign(&campaign_id);
    assert_eq!(campaign.distributed_amount, 100);
}

#[test]
fn test_duplicate_claim_is_rejected() {
    let (env, client, _admin, ngo, token, _) = setup();
    let campaign_id = make_campaign(&env, &client, &ngo, &token.address, false);
    client.fund_campaign(&ngo, &campaign_id, &10_000);

    let beneficiary = Address::generate(&env);
    client.register_beneficiary(&ngo, &campaign_id, &beneficiary);
    client.approve_beneficiary(&ngo, &campaign_id, &beneficiary);

    client.claim_aid(&beneficiary, &campaign_id);
    let result = client.try_claim_aid(&beneficiary, &campaign_id);
    assert_eq!(result, Err(Ok(Error::ClaimLimitReached)));
}

#[test]
fn test_unapproved_beneficiary_cannot_claim() {
    let (env, client, _admin, ngo, token, _) = setup();
    let campaign_id = make_campaign(&env, &client, &ngo, &token.address, false);
    client.fund_campaign(&ngo, &campaign_id, &10_000);

    let beneficiary = Address::generate(&env);
    client.register_beneficiary(&ngo, &campaign_id, &beneficiary);
    // not approved

    let result = client.try_claim_aid(&beneficiary, &campaign_id);
    assert_eq!(result, Err(Ok(Error::BeneficiaryNotApproved)));
}

#[test]
fn test_suspended_beneficiary_cannot_claim() {
    let (env, client, _admin, ngo, token, _) = setup();
    let campaign_id = make_campaign(&env, &client, &ngo, &token.address, false);
    client.fund_campaign(&ngo, &campaign_id, &10_000);

    let beneficiary = Address::generate(&env);
    client.register_beneficiary(&ngo, &campaign_id, &beneficiary);
    client.approve_beneficiary(&ngo, &campaign_id, &beneficiary);
    client.suspend_beneficiary(&ngo, &campaign_id, &beneficiary);

    let result = client.try_claim_aid(&beneficiary, &campaign_id);
    assert_eq!(result, Err(Ok(Error::BeneficiarySuspended)));
}

#[test]
fn test_expired_campaign_blocks_claim() {
    let (env, client, _admin, ngo, token, _) = setup();
    let campaign_id = make_campaign(&env, &client, &ngo, &token.address, false);
    client.fund_campaign(&ngo, &campaign_id, &10_000);

    let beneficiary = Address::generate(&env);
    client.register_beneficiary(&ngo, &campaign_id, &beneficiary);
    client.approve_beneficiary(&ngo, &campaign_id, &beneficiary);

    env.ledger().with_mut(|l| l.timestamp += 31 * 86400);

    let result = client.try_claim_aid(&beneficiary, &campaign_id);
    assert_eq!(result, Err(Ok(Error::CampaignExpired)));

    let campaign = client.get_campaign(&campaign_id);
    assert_eq!(campaign.status, CampaignStatus::Expired);
}

#[test]
fn test_voucher_issue_and_full_redeem() {
    let (env, client, _admin, ngo, token, _) = setup();
    let campaign_id = make_campaign(&env, &client, &ngo, &token.address, true);
    client.fund_campaign(&ngo, &campaign_id, &10_000);

    let beneficiary = Address::generate(&env);
    client.register_beneficiary(&ngo, &campaign_id, &beneficiary);
    client.approve_beneficiary(&ngo, &campaign_id, &beneficiary);

    let voucher_id = client.issue_voucher(&ngo, &campaign_id, &beneficiary);
    let voucher = client.get_voucher(&voucher_id);
    assert_eq!(voucher.status, VoucherStatus::Active);
    assert_eq!(voucher.amount, 100);

    let merchant = Address::generate(&env);
    client.authorize_merchant(&ngo, &campaign_id, &merchant);

    client.redeem_voucher(&merchant, &voucher_id, &100);
    let voucher = client.get_voucher(&voucher_id);
    assert_eq!(voucher.status, VoucherStatus::Redeemed);
    assert_eq!(token.balance(&merchant), 100);
}

#[test]
fn test_unauthorized_merchant_cannot_redeem() {
    let (env, client, _admin, ngo, token, _) = setup();
    let campaign_id = make_campaign(&env, &client, &ngo, &token.address, true);
    client.fund_campaign(&ngo, &campaign_id, &10_000);

    let beneficiary = Address::generate(&env);
    client.register_beneficiary(&ngo, &campaign_id, &beneficiary);
    client.approve_beneficiary(&ngo, &campaign_id, &beneficiary);
    let voucher_id = client.issue_voucher(&ngo, &campaign_id, &beneficiary);

    let random_merchant = Address::generate(&env);
    let result = client.try_redeem_voucher(&random_merchant, &voucher_id, &100);
    assert_eq!(result, Err(Ok(Error::MerchantNotAuthorized)));
}

#[test]
fn test_voucher_partial_redemption() {
    let (env, client, _admin, ngo, token, _) = setup();
    let campaign_id = make_campaign(&env, &client, &ngo, &token.address, true);
    client.fund_campaign(&ngo, &campaign_id, &10_000);

    let beneficiary = Address::generate(&env);
    client.register_beneficiary(&ngo, &campaign_id, &beneficiary);
    client.approve_beneficiary(&ngo, &campaign_id, &beneficiary);
    let voucher_id = client.issue_voucher(&ngo, &campaign_id, &beneficiary);

    let merchant = Address::generate(&env);
    client.authorize_merchant(&ngo, &campaign_id, &merchant);

    client.redeem_voucher(&merchant, &voucher_id, &60);
    let voucher = client.get_voucher(&voucher_id);
    assert_eq!(voucher.status, VoucherStatus::PartiallyRedeemed);
    assert_eq!(voucher.redeemed_amount, 60);

    let over_result = client.try_redeem_voucher(&merchant, &voucher_id, &50);
    assert_eq!(over_result, Err(Ok(Error::VoucherInsufficientBalance)));

    client.redeem_voucher(&merchant, &voucher_id, &40);
    let voucher = client.get_voucher(&voucher_id);
    assert_eq!(voucher.status, VoucherStatus::Redeemed);
}

#[test]
fn test_non_ngo_cannot_manage_campaign() {
    let (env, client, _admin, ngo, token, _) = setup();
    let campaign_id = make_campaign(&env, &client, &ngo, &token.address, false);

    let attacker = Address::generate(&env);
    let result = client.try_fund_campaign(&attacker, &campaign_id, &1_000);
    // Auth mock allows the call through require_auth, but the ownership
    // check inside the contract must still reject a mismatched NGO.
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_close_campaign_refunds_remaining_balance() {
    let (env, client, _admin, ngo, token, _) = setup();
    let campaign_id = make_campaign(&env, &client, &ngo, &token.address, false);
    client.fund_campaign(&ngo, &campaign_id, &10_000);

    let beneficiary = Address::generate(&env);
    client.register_beneficiary(&ngo, &campaign_id, &beneficiary);
    client.approve_beneficiary(&ngo, &campaign_id, &beneficiary);
    client.claim_aid(&beneficiary, &campaign_id);

    let ngo_balance_before = token.balance(&ngo);
    client.close_campaign(&ngo, &campaign_id);
    let ngo_balance_after = token.balance(&ngo);

    // 10_000 funded - 100 distributed = 9_900 refunded back to the NGO.
    assert_eq!(ngo_balance_after - ngo_balance_before, 9_900);

    let campaign = client.get_campaign(&campaign_id);
    assert_eq!(campaign.status, CampaignStatus::Completed);
}

#[test]
fn test_emergency_pause_blocks_claims() {
    let (env, client, admin, ngo, token, _) = setup();
    let campaign_id = make_campaign(&env, &client, &ngo, &token.address, false);
    client.fund_campaign(&ngo, &campaign_id, &10_000);

    let beneficiary = Address::generate(&env);
    client.register_beneficiary(&ngo, &campaign_id, &beneficiary);
    client.approve_beneficiary(&ngo, &campaign_id, &beneficiary);

    client.emergency_pause(&admin);
    let result = client.try_claim_aid(&beneficiary, &campaign_id);
    assert_eq!(result, Err(Ok(Error::GlobalPaused)));

    client.emergency_resume(&admin);
    let paid = client.claim_aid(&beneficiary, &campaign_id);
    assert_eq!(paid, 100);
}
