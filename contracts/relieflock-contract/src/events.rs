use soroban_sdk::{symbol_short, Address, Env};

pub fn campaign_created(env: &Env, campaign_id: u64, ngo: &Address) {
    env.events()
        .publish((symbol_short!("camp_new"), ngo.clone()), campaign_id);
}

pub fn campaign_funded(env: &Env, campaign_id: u64, amount: i128) {
    env.events()
        .publish((symbol_short!("camp_fund"), campaign_id), amount);
}

pub fn campaign_status_changed(env: &Env, campaign_id: u64, status: u32) {
    env.events()
        .publish((symbol_short!("camp_stat"), campaign_id), status);
}

pub fn beneficiary_registered(env: &Env, campaign_id: u64, beneficiary: &Address) {
    env.events()
        .publish((symbol_short!("ben_reg"), campaign_id), beneficiary.clone());
}

pub fn beneficiary_status_changed(env: &Env, campaign_id: u64, beneficiary: &Address, status: u32) {
    env.events().publish(
        (symbol_short!("ben_stat"), campaign_id, beneficiary.clone()),
        status,
    );
}

pub fn aid_claimed(env: &Env, campaign_id: u64, beneficiary: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("claim"), campaign_id, beneficiary.clone()),
        amount,
    );
}

pub fn voucher_issued(
    env: &Env,
    voucher_id: u64,
    campaign_id: u64,
    beneficiary: &Address,
    amount: i128,
) {
    env.events().publish(
        (
            symbol_short!("vou_new"),
            voucher_id,
            campaign_id,
            beneficiary.clone(),
        ),
        amount,
    );
}

pub fn voucher_redeemed(env: &Env, voucher_id: u64, merchant: &Address, amount: i128) {
    env.events().publish(
        (symbol_short!("vou_redm"), voucher_id, merchant.clone()),
        amount,
    );
}

pub fn merchant_authorized(env: &Env, campaign_id: u64, merchant: &Address) {
    env.events()
        .publish((symbol_short!("merch_ok"), campaign_id), merchant.clone());
}

pub fn merchant_removed(env: &Env, campaign_id: u64, merchant: &Address) {
    env.events()
        .publish((symbol_short!("merch_rm"), campaign_id), merchant.clone());
}

pub fn campaign_refunded(env: &Env, campaign_id: u64, amount: i128) {
    env.events()
        .publish((symbol_short!("refund"), campaign_id), amount);
}
