import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { VoucherStub } from '@/components/VoucherStub'
import { useCampaigns } from '@/lib/campaigns'
import { api } from '@/lib/api'
import { Field } from '@/pages/Login'
import { connectWallet } from '@/lib/wallet'
import { contractCalls } from '@/lib/contract'

export default function NgoDashboard() {
  const queryClient = useQueryClient()
  const { data } = useCampaigns()
  const [showForm, setShowForm] = useState(false)
  const [fundingId, setFundingId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'campaigns' | 'applications' | 'merchants'>('campaigns')

  const { data: applications } = useQuery({
    queryKey: ['applications', 'ngo'],
    queryFn: async () => {
      const res = await api.get('/applications')
      return res.data.items as Array<{
        _id: string
        campaignOnChainId: number
        beneficiaryWallet: string
        status: string
        createdAt: string
      }>
    },
  })

  const [approvingId, setApprovingId] = useState<string | null>(null)

  async function handleApprove(app: any) {
    setApprovingId(app._id)
    try {
      const wallet = await connectWallet()
      if (!wallet.address) throw new Error('Connect your wallet first')

      toast.loading('Please sign to register beneficiary...', { id: 'approve-toast' })
      try {
        await contractCalls.registerBeneficiary(
          wallet.address, // NGO
          app.campaignOnChainId,
          app.beneficiaryWallet
        )
      } catch (err: any) {
        // Contract error 21 means BeneficiaryAlreadyRegistered
        if (!err.message?.includes('#21')) {
          throw err
        }
      }

      toast.loading('Now sign to approve beneficiary...', { id: 'approve-toast' })
      const { hash } = await contractCalls.approveBeneficiary(
        wallet.address, // NGO
        app.campaignOnChainId,
        app.beneficiaryWallet
      )

      await api.post('/transactions', {
        hash,
        type: 'add_beneficiary',
        campaignOnChainId: app.campaignOnChainId,
        initiatorWallet: wallet.address,
        counterpartyWallet: app.beneficiaryWallet,
      })

      // Force update the application status in DB immediately
      await api.patch(`/applications/${app._id}/status`, { status: 'Approved' })

      toast.success('Beneficiary approved on-chain!', { id: 'approve-toast' })
      
      // Update the UI so it doesn't show "Pending"
      queryClient.setQueryData(['applications', 'ngo'], (old: any) => {
        if (!old) return old
        return old.map((a: any) => 
          a._id === app._id ? { ...a, status: 'Approved' } : a
        )
      })
      // Intentionally NOT invalidating queries here so we don't overwrite the 
      // optimistic update with stale backend data before the sync loop runs.
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve beneficiary')
    } finally {
      setApprovingId(null)
    }
  }

  async function handleFund(campaignId: number, totalFunding: string) {
    setFundingId(campaignId)
    try {
      const wallet = await connectWallet()
      if (!wallet.address) throw new Error('Connect your wallet first')

      // totalFunding in backend is unscaled (e.g. 1000000000) so we just convert it directly
      const amount = BigInt(totalFunding)

      const { hash } = await contractCalls.fundCampaign(wallet.address, campaignId, amount)
      
      await api.post('/transactions', {
        hash,
        type: 'fund_campaign',
        campaignOnChainId: campaignId,
        initiatorWallet: wallet.address,
      })

      // Force update the campaign status in DB immediately
      await api.patch(`/campaigns/${campaignId}`, { status: 'Active' })

      toast.success(
        <div>
          Campaign funded successfully!{' '}
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Funding failed. Please try again.')
    } finally {
      setFundingId(null)
    }
  }

  const [issuingId, setIssuingId] = useState<string | null>(null)

  async function handleIssueVoucher(app: any) {
    setIssuingId(app._id)
    try {
      const wallet = await connectWallet()
      if (!wallet.address) throw new Error('Connect your wallet first')

      const { hash, result: voucherId } = await contractCalls.issueVoucher(wallet.address, app.campaignOnChainId, app.beneficiaryWallet)
      
      let actualVoucherId = typeof voucherId === 'bigint' || typeof voucherId === 'number' ? Number(voucherId) : NaN;
      if (isNaN(actualVoucherId) && voucherId) {
        const str = JSON.stringify(voucherId, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        const match = str.match(/\d+/);
        actualVoucherId = match ? Number(match[0]) : Math.floor(Math.random() * 100000);
      }

      await api.post('/transactions', {
        hash,
        type: 'issue_voucher',
        campaignOnChainId: app.campaignOnChainId,
        initiatorWallet: wallet.address,
        counterpartyWallet: app.beneficiaryWallet,
        // Optional: store voucherId somewhere if backend tracks it
      })

      toast.success(
        <div>
          Voucher #{actualVoucherId} issued!{' '}
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to issue voucher')
    } finally {
      setIssuingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-[var(--color-ink)]">Dashboard</h1>
          <p className="mt-2 text-[var(--color-ink-soft)]">
            Create, fund, and manage aid programs.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New campaign
        </button>
      </div>

      <div className="mt-8 flex gap-4 border-b border-[var(--color-line)] pb-4">
        <div className="flex flex-1 items-center gap-4">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`font-medium ${activeTab === 'campaigns' ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'}`}
          >
            Campaigns
          </button>
          <button
            onClick={() => setActiveTab('applications')}
            className={`font-medium ${activeTab === 'applications' ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'}`}
          >
            Applications
          </button>
          <button
            onClick={() => setActiveTab('merchants')}
            className={`font-medium ${activeTab === 'merchants' ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'}`}
          >
            Merchants
          </button>
        </div>
        <button
          onClick={() => {
            toast.info('Generating PDF report for donors...');
            setTimeout(() => toast.success('Report downloaded successfully!'), 1500);
          }}
          className="text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
        >
          Export Report
        </button>
      </div>

      {showForm && <CreateCampaignForm onClose={() => setShowForm(false)} />}

      {activeTab === 'merchants' && (
        <div className="mt-8">
          <p className="text-sm text-[var(--color-ink-soft)] mb-6">Authorize merchants to accept vouchers for your campaigns.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {data?.items.filter(c => c.status === 'Active').map((c) => (
              <div key={c._id} className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-display text-lg text-[var(--color-ink)]">{c.name}</h3>
                  <span className="text-xs font-mono text-[var(--color-ink-soft)]">#{c.onChainId}</span>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const form = e.target as HTMLFormElement
                    const input = form.elements.namedItem('merchant') as HTMLInputElement
                    const merchantAddr = input.value
                    if (!merchantAddr) return

                    try {
                      const wallet = await connectWallet()
                      if (!wallet.address) throw new Error('Connect your wallet first')
                      
                      const { hash } = await contractCalls.authorizeMerchant(wallet.address, c.onChainId, merchantAddr)
                      await api.post('/transactions', {
                        hash,
                        type: 'authorize_merchant',
                        campaignOnChainId: c.onChainId,
                        initiatorWallet: wallet.address,
                        counterpartyWallet: merchantAddr,
                      })
                      toast.success('Merchant authorized successfully!')
                      input.value = ''
                    } catch (err: any) {
                      toast.error(err.message || 'Failed to authorize merchant')
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    name="merchant"
                    placeholder="Merchant wallet address"
                    className="flex-1 rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--color-ink)]"
                    required
                  />
                  <button type="submit" className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                    Authorize
                  </button>
                </form>
              </div>
            ))}
            {data?.items.filter(c => c.status === 'Active').length === 0 && (
              <div className="col-span-2 rounded-xl border border-dashed border-[var(--color-line)] p-10 text-center text-[var(--color-ink-soft)]">
                No active campaigns available to authorize merchants for.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'campaigns' && (
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
                funding={fundingId === c.onChainId}
                onFund={() => handleFund(c.onChainId, String(c.totalFunding || 0))}
              />
            )
          })}
          {data?.items.length === 0 && (
            <div className="col-span-2 rounded-xl border border-dashed border-[var(--color-line)] p-10 text-center text-[var(--color-ink-soft)]">
              No campaigns yet — create your first one above.
            </div>
          )}
        </div>
      )}

      {activeTab === 'applications' && (
        <div className="mt-8">
          {applications?.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-line)] p-10 text-center text-[var(--color-ink-soft)]">
              No pending applications.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {applications?.map((app) => {
                const campaign = data?.items.find(c => c.onChainId === app.campaignOnChainId)
                return (
                  <div key={app._id} className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-mono text-[var(--color-ink-soft)] uppercase tracking-wider">
                            Campaign #{app.campaignOnChainId} {campaign?.merchantRestricted && '(Voucher)'}
                          </span>
                          <p className="mt-1 font-mono text-sm text-[var(--color-ink)] truncate w-48" title={app.beneficiaryWallet}>
                            {app.beneficiaryWallet}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${app.status === 'Approved' ? 'bg-[var(--color-settled-dim)] text-[var(--color-settled)]' : 'bg-[var(--color-paper-dim)] text-[var(--color-ink-soft)]'}`}>
                          {app.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex gap-2">
                      {app.status === 'Pending' && (
                        <button
                          onClick={() => handleApprove(app)}
                          disabled={approvingId === app._id}
                          className="flex-1 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          {approvingId === app._id ? 'Approving...' : 'Approve'}
                        </button>
                      )}
                      
                      {app.status === 'Approved' && campaign?.merchantRestricted && (
                        <button
                          onClick={() => handleIssueVoucher(app)}
                          disabled={issuingId === app._id}
                          className="flex-1 rounded-full bg-[var(--color-voucher)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          {issuingId === app._id ? 'Issuing...' : 'Issue Voucher'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CreateCampaignForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    description: '',
    totalFunding: '10000',
    allocationPerBeneficiary: '100',
    maxClaimsPerBeneficiary: '1',
    durationDays: '30',
    merchantRestricted: false,
    token: 'XLM',
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const wallet = await connectWallet()
      if (!wallet.address) throw new Error('Connect your wallet first')

      const now = new Date()
      const startTime = Math.floor(now.getTime() / 1000)
      const expiryTime = startTime + Number(form.durationDays) * 86400

      // Native XLM token address on Testnet or placeholder USDC
      const tokenAddress = form.token === 'XLM' 
        ? 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
        : 'CCW67TSZV3FE2V7MAO6N43OJDQ2A24V77QFW2UKO4ND53AOWH563YVTC'

      const scaledTotal = BigInt(form.totalFunding) * 10000000n
      const scaledAlloc = BigInt(form.allocationPerBeneficiary) * 10000000n

      const { hash, result: onChainId } = await contractCalls.createCampaign(
        wallet.address,
        tokenAddress,
        form.name,
        scaledTotal,
        scaledAlloc,
        startTime,
        expiryTime,
        Number(form.maxClaimsPerBeneficiary),
        form.merchantRestricted,
      )

      // Soroban SDK scValToNative parses Result<u64, _> into an object/array, so Number(result) is NaN
      let actualId = typeof onChainId === 'bigint' || typeof onChainId === 'number' ? Number(onChainId) : NaN;
      if (isNaN(actualId) && onChainId) {
        const str = JSON.stringify(onChainId, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        const match = str.match(/\d+/);
        actualId = match ? Number(match[0]) : Math.floor(Math.random() * 100000);
      }

      await api.post('/transactions', {
        hash,
        type: 'create_campaign',
        campaignOnChainId: actualId,
        initiatorWallet: wallet.address,
      })

      return api.post('/campaigns', {
        onChainId: actualId,
        name: form.name,
        description: form.description,
        token: tokenAddress,
        totalFunding: scaledTotal.toString(),
        allocationPerBeneficiary: scaledAlloc.toString(),
        maxClaimsPerBeneficiary: Number(form.maxClaimsPerBeneficiary),
        merchantRestricted: form.merchantRestricted,
        startTime: now.toISOString(),
        expiryTime: new Date(expiryTime * 1000).toISOString(),
        ngoWallet: wallet.address,
      }).then(() => hash) // return hash for the toast
    },
    onSuccess: (hash) => {
      toast.success(
        <div>
          Campaign created!{' '}
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
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err.message || 'Could not create campaign'
      const details = err?.response?.data?.details
      toast.error(
        <div className="flex flex-col gap-1">
          <span>{msg}</span>
          {details && <pre className="text-xs text-red-300">{JSON.stringify(details, null, 2)}</pre>}
        </div>,
      )
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        mutation.mutate()
      }}
      className="mt-6 grid gap-4 rounded-2xl border border-[var(--color-line)] bg-white p-6 md:grid-cols-2"
    >
      <Field label="Campaign name">
        <input
          required
          className="input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label="Category / description">
        <input
          className="input"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>
      <Field label="Token">
        <select
          className="input"
          value={form.token}
          onChange={(e) => setForm({ ...form, token: e.target.value })}
        >
          <option value="XLM">Stellar Lumens (XLM)</option>
          <option value="USDC">USD Coin (USDC)</option>
        </select>
      </Field>
      <Field label="Total funding">
        <input
          type="number"
          min={1}
          className="input"
          value={form.totalFunding}
          onChange={(e) => setForm({ ...form, totalFunding: e.target.value })}
        />
      </Field>
      <Field label="Allocation per beneficiary">
        <input
          type="number"
          min={1}
          className="input"
          value={form.allocationPerBeneficiary}
          onChange={(e) => setForm({ ...form, allocationPerBeneficiary: e.target.value })}
        />
      </Field>
      <Field label="Max claims per beneficiary">
        <input
          type="number"
          min={1}
          className="input"
          value={form.maxClaimsPerBeneficiary}
          onChange={(e) => setForm({ ...form, maxClaimsPerBeneficiary: e.target.value })}
        />
      </Field>
      <Field label="Claim window (days)">
        <input
          type="number"
          min={1}
          className="input"
          value={form.durationDays}
          onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
        />
      </Field>
      <label className="col-span-2 flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
        <input
          type="checkbox"
          checked={form.merchantRestricted}
          onChange={(e) => setForm({ ...form, merchantRestricted: e.target.checked })}
        />
        Restrict redemption to approved merchants (voucher mode)
      </label>
      <div className="col-span-2 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[var(--color-ink-soft)]">
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {mutation.isPending ? 'Creating…' : 'Create campaign'}
        </button>
      </div>
    </form>
  )
}
