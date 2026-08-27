import {
  isConnected,
  isAllowed,
  setAllowed,
  requestAccess,
  getAddress,
  getNetwork,
  signTransaction,
} from '@stellar/freighter-api'

export interface WalletState {
  connected: boolean
  address: string | null
  network: string | null
}

/**
 * Thin wrapper around @stellar/freighter-api. Every call here can fail if
 * the extension isn't installed or the user rejects the prompt — callers
 * must handle the rejection path in the UI (never assume success just
 * because the popup appeared).
 */
export async function connectWallet(): Promise<WalletState> {
  const connectedResult = await isConnected()
  if (connectedResult.error || !connectedResult.isConnected) {
    throw new Error('Freighter is not installed. Install it from freighter.app to continue.')
  }

  const allowedResult = await isAllowed()
  if (!allowedResult.isAllowed) {
    const access = await setAllowed()
    if (access.error) {
      throw new Error('Wallet access was denied.')
    }
  }

  const access = await requestAccess()
  if (access.error) {
    throw new Error(String(access.error))
  }

  const addressResult = await getAddress()
  if (addressResult.error) {
    throw new Error(String(addressResult.error))
  }

  const networkResult = await getNetwork()

  if (addressResult.address) {
    localStorage.setItem('rl_wallet_address', addressResult.address)
  }

  return {
    connected: true,
    address: addressResult.address,
    network: networkResult.error ? null : networkResult.network,
  }
}

export async function autoConnectWallet(): Promise<WalletState | null> {
  try {
    const savedAddress = localStorage.getItem('rl_wallet_address')
    if (!savedAddress) return null

    const connectedResult = await isConnected()
    if (connectedResult.error || !connectedResult.isConnected) return null

    const allowedResult = await isAllowed()
    if (!allowedResult.isAllowed) return null

    const addressResult = await getAddress()
    if (addressResult.error) return null

    const networkResult = await getNetwork()

    return {
      connected: true,
      address: addressResult.address,
      network: networkResult.error ? null : networkResult.network,
    }
  } catch {
    return null
  }
}

export async function signXdr(xdr: string, networkPassphrase: string): Promise<string> {
  const result = await signTransaction(xdr, { networkPassphrase })
  if (result.error) {
    throw new Error('Transaction was rejected in the wallet.')
  }
  return result.signedTxXdr
}
