import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Networks,
  rpc,
  nativeToScVal,
  scValToNative,
  type xdr,
} from '@stellar/stellar-sdk'
import { signXdr } from './wallet'

const RPC_URL = import.meta.env.VITE_STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org'
const NETWORK_PASSPHRASE =
  import.meta.env.VITE_STELLAR_NETWORK === 'PUBLIC' ? Networks.PUBLIC : Networks.TESTNET
export const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID as string | undefined

const server = new rpc.Server(RPC_URL, { allowHttp: false })

export type ScArg =
  | { type: 'address'; value: string }
  | { type: 'u64'; value: number }
  | { type: 'u32'; value: number }
  | { type: 'i128'; value: bigint | number }
  | { type: 'string'; value: string }
  | { type: 'bool'; value: boolean }

function toScVal(arg: ScArg): xdr.ScVal {
  switch (arg.type) {
    case 'address':
      return nativeToScVal(arg.value, { type: 'address' })
    case 'u64':
      return nativeToScVal(arg.value, { type: 'u64' })
    case 'u32':
      return nativeToScVal(arg.value, { type: 'u32' })
    case 'i128':
      return nativeToScVal(arg.value, { type: 'i128' })
    case 'string':
      return nativeToScVal(arg.value, { type: 'string' })
    case 'bool':
      return nativeToScVal(arg.value)
  }
}

/**
 * Invokes a state-changing contract method: builds the transaction,
 * simulates it to get the correct footprint/fees, asks the connected
 * Freighter wallet to sign it, then submits and polls for the result.
 *
 * This is the ONLY path by which the frontend touches contract state —
 * the backend never signs or submits transactions on the user's behalf.
 */
export async function invokeContract(
  method: string,
  args: ScArg[],
  sourcePublicKey: string,
): Promise<{ hash: string; result: unknown }> {
  if (!CONTRACT_ID) {
    throw new Error('VITE_CONTRACT_ID is not set — deploy the contract and add it to .env')
  }

  const account = await server.getAccount(sourcePublicKey)
  const contract = new Contract(CONTRACT_ID)
  const operation = contract.call(method, ...args.map(toScVal))

  let tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(60)
    .build()

  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`)
  }
  tx = rpc.assembleTransaction(tx, sim).build()

  const signedXdr = await signXdr(tx.toXdr(), NETWORK_PASSPHRASE)
  const signedTx = TransactionBuilder.fromXdr(signedXdr, NETWORK_PASSPHRASE)

  const sendResult = await server.sendTransaction(signedTx)
  if (sendResult.status === 'ERROR') {
    throw new Error('Transaction was rejected by the network')
  }

  // Poll until the transaction is no longer pending. Callers should also
  // record sendResult.hash via POST /api/transactions immediately so the
  // UI can show a "pending" state without blocking on this loop.
  const hash = sendResult.hash
  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise((r) => setTimeout(r, 2000))
    const status = await server.getTransaction(hash)
    if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { hash, result: status.returnValue ? scValToNative(status.returnValue) : null }
    }
    if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error('Transaction failed on-chain')
    }
  }
  throw new Error('Transaction is still pending after timeout — check the explorer')
}

export const contractCalls = {
  claimAid: (beneficiary: string, campaignId: number) =>
    invokeContract(
      'claim_aid',
      [
        { type: 'address', value: beneficiary },
        { type: 'u64', value: campaignId },
      ],
      beneficiary,
    ),

  fundCampaign: (ngo: string, campaignId: number, amount: bigint) =>
    invokeContract(
      'fund_campaign',
      [
        { type: 'address', value: ngo },
        { type: 'u64', value: campaignId },
        { type: 'i128', value: amount },
      ],
      ngo,
    ),

  redeemVoucher: (merchant: string, voucherId: number, amount: bigint) =>
    invokeContract(
      'redeem_voucher',
      [
        { type: 'address', value: merchant },
        { type: 'u64', value: voucherId },
        { type: 'i128', value: amount },
      ],
      merchant,
    ),

  createCampaign: (
    ngo: string,
    token: string,
    name: string,
    totalFunding: bigint,
    allocationPerBeneficiary: bigint,
    startTime: number,
    expiryTime: number,
    maxClaims: number,
    merchantRestricted: boolean,
  ) =>
    invokeContract(
      'create_campaign',
      [
        { type: 'address', value: ngo },
        { type: 'address', value: token },
        { type: 'string', value: name },
        { type: 'i128', value: totalFunding },
        { type: 'i128', value: allocationPerBeneficiary },
        { type: 'u64', value: startTime },
        { type: 'u64', value: expiryTime },
        { type: 'u32', value: maxClaims },
        { type: 'bool', value: merchantRestricted },
      ],
      ngo,
    ),

  authorizeMerchant: (ngo: string, campaignId: number, merchant: string) =>
    invokeContract(
      'authorize_merchant',
      [
        { type: 'address', value: ngo },
        { type: 'u64', value: campaignId },
        { type: 'address', value: merchant },
      ],
      ngo,
    ),

  issueVoucher: (ngo: string, campaignId: number, beneficiary: string) =>
    invokeContract(
      'issue_voucher',
      [
        { type: 'address', value: ngo },
        { type: 'u64', value: campaignId },
        { type: 'address', value: beneficiary },
      ],
      ngo,
    ),
}
