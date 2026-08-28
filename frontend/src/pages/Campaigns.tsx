import { useState } from 'react'
import { toast } from 'sonner'
import { VoucherStub } from '@/components/VoucherStub'
import { useCampaigns } from '@/lib/campaigns'
import { useAuth } from '@/lib/auth'
import { connectWallet } from '@/lib/wallet'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export default function Campaigns() {
  const { user } = useAuth()
  const { data, isLoading, isError } = useCampaigns()
  const queryClient = useQueryClient()
  const [applyingId, setApplyingId] = useState<number | null>(null)

  // Fetch user's existing applications
  const { data: myApps } = useQuery({
    queryKey: ['applications', user?.id],
    queryFn: async () => {
      const res = await api.get('/applications')
      return res.data.items as Array<{ campaignOnChainId: number }>
    },
    enabled: user?.role === 'beneficiary',
  })

  const appliedIds = new Set(myApps?.map((a) => a.campaignOnChainId) ?? [])

  async function handleApply(campaignId: number) {
    if (!user) {
      toast.error('You must be logged in as a beneficiary to apply')
      return
    }
    if (user.role !== 'beneficiary') {
      toast.error('Only beneficiaries can apply for aid')
      return
    }

    setApplyingId(campaignId)
    try {
      const wallet = await connectWallet()
      if (!wallet.address) throw new Error('Connect your wallet first')

      await api.post('/applications', {
        campaignOnChainId: campaignId,
        beneficiaryWallet: wallet.address,
      })

      toast.success('Application submitted successfully!')
      queryClient.invalidateQueries({ queryKey: ['applications'] })
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to apply')
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-3xl text-[var(--color-ink)]">Active aid programs</h1>
      <p className="mt-2 text-[var(--color-ink-soft)]">
        Every campaign below is enforced on-chain — allocation, deadlines, and claim limits
        cannot be changed after activation without going through the contract.
      </p>

      {isLoading && <SkeletonGrid />}

      {isError && (
        <div className="mt-10 rounded-xl border border-[var(--color-line)] bg-white p-8 text-center text-[var(--color-ink-soft)]">
          Couldn't reach the API. Make sure the backend is running and{' '}
          <code className="font-mono text-xs">VITE_API_URL</code> is set correctly.
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-[var(--color-line)] p-10 text-center text-[var(--color-ink-soft)]">
          No active campaigns yet. NGOs can create one from their dashboard.
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {data?.items.map((c) => {
          const dateObj = new Date(c.expiryTime);
          const deadline = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString() : 'Invalid Date';
          
          let allocString = String(c.allocationPerBeneficiary || 0);
          try {
             allocString = (BigInt(allocString) / 10000000n).toString();
          } catch (e) {}

          return (
            <VoucherStub
              key={c._id}
              campaignId={c.onChainId}
              name={c.name}
              status={c.status}
              allocation={allocString}
              token="XLM"
              deadline={deadline}
              onApply={() => handleApply(c.onChainId)}
              applying={applyingId === c.onChainId}
              applied={appliedIds.has(c.onChainId)}
            />
          )
        })}
      </div>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--color-paper-dim)]" />
      ))}
    </div>
  )
}
