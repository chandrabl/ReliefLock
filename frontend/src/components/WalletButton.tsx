import { useState } from 'react'
import { Wallet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { connectWallet } from '@/lib/wallet'

export function WalletButton() {
  const [address, setAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    setLoading(true)
    try {
      const state = await connectWallet()
      setAddress(state.address)
      toast.success('Wallet connected')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not connect wallet')
    } finally {
      setLoading(false)
    }
  }

  if (address) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm font-mono text-[var(--color-ink)]">
        <span className="h-2 w-2 rounded-full bg-[var(--color-settled)]" />
        {address.slice(0, 4)}…{address.slice(-4)}
      </span>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
      Connect Wallet
    </button>
  )
}
