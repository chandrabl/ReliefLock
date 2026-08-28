import { useState } from 'react'
import { toast } from 'sonner'
import { VoucherStub } from '@/components/VoucherStub'
import { useCampaigns } from '@/lib/campaigns'
import { useAuth } from '@/lib/auth'
import { connectWallet } from '@/lib/wallet'
import { contractCalls } from '@/lib/contract'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

export default function BeneficiaryDashboard() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  
  // Fetch user's applications
  const { data: myApps } = useQuery({
    queryKey: ['applications', user?.id],
    queryFn: async () => {
      const res = await api.get('/applications')
      return res.data.items as Array<{
        campaignOnChainId: number
        status: string
      }>
    },
    enabled: !!user,
  })

  // Fetch all active campaigns
  const { data: campaignsData, isLoading } = useCampaigns({ status: 'Active' })

  const [claimingId, setClaimingId] = useState<number | null>(null)
  const [claimedIds, setClaimedIds] = useState<Set<number>>(new Set())

  async function handleClaim(campaignId: number) {
    setClaimingId(campaignId)
    try {
      const wallet = await connectWallet()
      if (!wallet.address) throw new Error('Connect your wallet first')

      const { hash } = await contractCalls.claimAid(wallet.address, campaignId)
      await api.post('/transactions', {
        hash,
        type: 'claim_aid',
        campaignOnChainId: campaignId,
        initiatorWallet: wallet.address,
      })
      setClaimedIds((prev) => new Set(prev).add(campaignId))
      
      toast.success(
        <div>
          Claim confirmed!{' '}
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
      
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || 'Claim failed. Please try again.')
    } finally {
      setClaimingId(null)
    }
  }

  // Filter active campaigns down to ONLY those the user has applied for
  const appliedCampaigns = campaignsData?.items.filter(c => 
    myApps?.some(app => app.campaignOnChainId === c.onChainId)
  ) || []

  const getAppStatus = (onChainId: number) => {
    return myApps?.find(a => a.campaignOnChainId === onChainId)?.status || 'Pending'
  }

  const approvedCount = myApps?.filter(a => a.status === 'Approved').length || 0

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-3xl text-[var(--color-ink)]">
        Welcome back{user ? `, ${user.fullName.split(' ')[0]}` : ''}
      </h1>
      <p className="mt-2 text-[var(--color-ink-soft)]">
        Aid programs you're eligible for. Claiming pays out directly to your connected wallet.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Eligible programs" value={approvedCount} />
        <StatCard label="Claimed" value={claimedIds.size} accent="settled" />
        <StatCard label="Pending Applications" value={myApps?.length ? myApps.length - approvedCount : 0} accent="voucher" />
        <StatCard label="Total received" value="—" accent="aid" />
      </div>

      <h2 className="mt-12 font-display text-xl text-[var(--color-ink)]">My Aid Applications</h2>
      {isLoading ? (
        <div className="mt-6 h-32 animate-pulse rounded-2xl bg-[var(--color-paper-dim)]" />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {appliedCampaigns.length === 0 && (
             <div className="col-span-2 rounded-xl border border-dashed border-[var(--color-line)] p-10 text-center text-[var(--color-ink-soft)]">
               You haven't applied for any aid programs yet. Go to the Campaigns tab to apply!
             </div>
          )}
          {appliedCampaigns.map((c) => {
            const dateObj = new Date(c.expiryTime);
            const deadline = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString() : 'Invalid Date';
            
            let allocString = String(c.allocationPerBeneficiary || 0);
            try {
               allocString = (BigInt(allocString) / 10000000n).toString();
            } catch (e) {}

            const appStatus = getAppStatus(c.onChainId)

            return (
              <div key={c._id} className="relative">
                {appStatus === 'Pending' && (
                  <div className="absolute top-2 right-2 z-10 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                    Application Pending NGO Approval
                  </div>
                )}
                <div className={appStatus === 'Pending' ? 'opacity-60 pointer-events-none' : ''}>
                  <VoucherStub
                    campaignId={c.onChainId}
                    name={c.name}
                    status={c.status}
                    allocation={allocString}
                    token="XLM"
                    deadline={deadline}
                    claimed={claimedIds.has(c.onChainId)}
                    claiming={claimingId === c.onChainId}
                    onClaim={() => handleClaim(c.onChainId)}
                  />
                </div>
              </div>
            )
          })}
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
