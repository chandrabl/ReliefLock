import { useState } from 'react'
import { toast } from 'sonner'
import { VoucherStub } from '@/components/VoucherStub'
import { useCampaigns } from '@/lib/campaigns'
import { useAuth } from '@/lib/auth'
import { connectWallet } from '@/lib/wallet'
import { contractCalls, CONTRACT_ID } from '@/lib/contract'
import { api } from '@/lib/api'

export default function BeneficiaryDashboard() {
  const { user } = useAuth()
  const { data, isLoading } = useCampaigns({ status: 'Active' })
  const [claimingId, setClaimingId] = useState<number | null>(null)
  const [claimedIds, setClaimedIds] = useState<Set<number>>(new Set())

  async function handleClaim(campaignId: number) {
    setClaimingId(campaignId)
    try {
      const wallet = await connectWallet()
      if (!wallet.address) throw new Error('Connect your wallet first')

      if (!CONTRACT_ID) {
        // Demo mode: no deployed contract configured yet. Skips the real
        // on-chain call so the UI flow is still fully clickable, but this
        // branch should be removed once VITE_CONTRACT_ID is set.
        await new Promise((r) => setTimeout(r, 900))
        setClaimedIds((prev) => new Set(prev).add(campaignId))
        toast.warning('Demo mode: no contract deployed yet, this claim was not sent on-chain')
        return
      }

      const { hash } = await contractCalls.claimAid(wallet.address, campaignId)
      await api.post('/transactions', {
        hash,
        type: 'claim_aid',
        campaignOnChainId: campaignId,
        initiatorWallet: wallet.address,
      })
      setClaimedIds((prev) => new Set(prev).add(campaignId))
      toast.success('Claim confirmed on-chain')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Claim failed. Please try again.')
    } finally {
      setClaimingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-3xl text-[var(--color-ink)]">
        Welcome back{user ? `, ${user.fullName.split(' ')[0]}` : ''}
      </h1>
      <p className="mt-2 text-[var(--color-ink-soft)]">
        Aid programs you're eligible for. Claiming pays out directly to your connected wallet.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Eligible programs" value={data?.items.length ?? '—'} />
        <StatCard label="Claimed" value={claimedIds.size} accent="settled" />
        <StatCard label="Pending" value={claimingId ? 1 : 0} accent="voucher" />
        <StatCard label="Total received" value="—" accent="aid" />
      </div>

      <h2 className="mt-12 font-display text-xl text-[var(--color-ink)]">Eligible programs</h2>
      {isLoading ? (
        <div className="mt-6 h-32 animate-pulse rounded-2xl bg-[var(--color-paper-dim)]" />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {data?.items.map((c) => (
            <VoucherStub
              key={c._id}
              campaignId={c.onChainId}
              name={c.name}
              status={c.status}
              allocation={c.allocationPerBeneficiary}
              token="USDC"
              deadline={new Date(c.expiryTime).toLocaleDateString()}
              claimed={claimedIds.has(c.onChainId)}
              claiming={claimingId === c.onChainId}
              onClaim={() => handleClaim(c.onChainId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  accent = 'signal',
}: {
  label: string
  value: string | number
  accent?: 'signal' | 'aid' | 'settled' | 'voucher'
}) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-4">
      <p className="text-xs text-[var(--color-ink-soft)]">{label}</p>
      <p
        className="mt-1 font-mono text-2xl font-semibold"
        style={{ color: `var(--color-${accent})` }}
      >
        {value}
      </p>
    </div>
  )
}
