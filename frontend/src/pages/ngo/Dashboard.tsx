import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-[var(--color-ink)]">Your campaigns</h1>
          <p className="mt-2 text-[var(--color-ink-soft)]">
            Create, fund, and manage aid programs. Funding and payouts are enforced on-chain.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New campaign
        </button>
      </div>

      {showForm && <CreateCampaignForm onClose={() => setShowForm(false)} />}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {data?.items.map((c) => {
          const dateObj = new Date(c.expiryTime);
          const deadline = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString() : 'Invalid Date';
          let allocString = String(c.allocationPerBeneficiary || 0);
          try {
             // Only scale if it parses cleanly as BigInt (no decimals)
             allocString = (BigInt(allocString) / 10000000n).toString();
          } catch (e) {
             // Fallback to original string if it's old mock data (e.g. decimals or already scaled)
          }

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
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const wallet = await connectWallet()
      if (!wallet.address) throw new Error('Connect your wallet first')

      const now = new Date()
      const startTime = Math.floor(now.getTime() / 1000)
      const expiryTime = startTime + Number(form.durationDays) * 86400

      // Native XLM token address on Testnet
      const tokenAddress = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

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
      <Field label="Total funding (XLM)">
        <input
          type="number"
          min={1}
          className="input"
          value={form.totalFunding}
          onChange={(e) => setForm({ ...form, totalFunding: e.target.value })}
        />
      </Field>
      <Field label="Allocation per beneficiary (XLM)">
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
