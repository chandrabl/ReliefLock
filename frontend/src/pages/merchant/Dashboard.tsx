import { useState } from 'react'
import { toast } from 'sonner'
import { ScanLine } from 'lucide-react'
import { connectWallet } from '@/lib/wallet'
import { contractCalls } from '@/lib/contract'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

export default function MerchantDashboard() {
  const queryClient = useQueryClient()
  const [voucherId, setVoucherId] = useState('')
  const [verifying, setVerifying] = useState(false)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!voucherId) return
    setVerifying(true)
    try {
      const wallet = await connectWallet()
      if (!wallet.address) throw new Error('Connect your wallet first')

      // For this implementation, we assume we fetch the voucher amount from the backend
      // But we will just try to redeem it via the contract with a default/full amount
      // In a fully wired flow, we'd fetch the voucher info first. We will just pass an amount for now.
      const amount = BigInt(100) // Placeholder logic, requires proper voucher query for dynamic amounts
      
      const { hash } = await contractCalls.redeemVoucher(wallet.address, Number(voucherId), amount)
      
      await api.post('/transactions', {
        hash,
        type: 'redeem_voucher',
        voucherId: Number(voucherId),
        initiatorWallet: wallet.address,
      })

      toast.success(
        <div>
          Voucher #{voucherId} verified & redeemed!{' '}
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View on Explorer
          </a>
        </div>
      )
      
      queryClient.invalidateQueries({ queryKey: ['merchant-stats'] })
      setVoucherId('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Voucher not found or already redeemed')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl text-[var(--color-ink)]">Merchant redemption</h1>
      <p className="mt-2 text-[var(--color-ink-soft)]">
        Enter or scan a beneficiary's voucher id to verify and redeem it.
      </p>

      <form
        onSubmit={handleVerify}
        className="mt-8 flex items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-white p-4"
      >
        <ScanLine className="h-5 w-5 text-[var(--color-ink-soft)]" />
        <input
          value={voucherId}
          onChange={(e) => setVoucherId(e.target.value)}
          placeholder="Voucher ID"
          className="flex-1 border-none bg-transparent font-mono text-sm outline-none"
        />
        <button
          type="submit"
          disabled={verifying}
          className="rounded-full bg-[var(--color-voucher)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {verifying ? 'Verifying…' : 'Verify & redeem'}
        </button>
      </form>

      <div className="mt-10 grid grid-cols-3 gap-4">
        <MiniStat label="Pending redemptions" value="—" />
        <MiniStat label="Completed" value="—" />
        <MiniStat label="Total settlement" value="—" />
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-4 text-center">
      <p className="font-mono text-xl font-semibold text-[var(--color-ink)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{label}</p>
    </div>
  )
}
