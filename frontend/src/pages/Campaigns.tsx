import { VoucherStub } from '@/components/VoucherStub'
import { useCampaigns } from '@/lib/campaigns'

export default function Campaigns() {
  const { data, isLoading, isError } = useCampaigns({ status: 'Active' })

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
        {data?.items.map((c) => (
          <VoucherStub
            key={c._id}
            campaignId={c.onChainId}
            name={c.name}
            status={c.status}
            allocation={c.allocationPerBeneficiary}
            token="USDC"
            deadline={new Date(c.expiryTime).toLocaleDateString()}
          />
        ))}
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
