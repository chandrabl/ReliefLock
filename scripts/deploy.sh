#!/bin/bash
set -e

echo "==> Building contracts..."
stellar contract build

# Ensure deployer keys exist
if ! stellar keys ls | grep -q "deployer"; then
    echo "Generating deployer keys..."
    stellar keys generate deployer --network testnet --fund
fi

DEPLOYER="deployer"

echo "==> Deploying relieflock_contract..."
CONTRACT_ID=$(stellar contract deploy --wasm target/wasm32-unknown-unknown/release/relieflock_contract.wasm --source $DEPLOYER --network testnet)
echo "Contract deployed at: $CONTRACT_ID"

echo ""
echo "=================================================="
echo " Deployment complete"
echo "=================================================="
echo " CONTRACT_ID: $CONTRACT_ID"
echo "=================================================="
