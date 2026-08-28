import { motion } from 'framer-motion'

export interface VoucherStubProps {
  campaignId: number
  name: string
  status: 'Draft' | 'Active' | 'Paused' | 'Expired' | 'Completed' | 'Cancelled'
  allocation: string
  token: string
  deadline: string
  claimed?: boolean
  onClaim?: () => void
  claiming?: boolean
  onFund?: () => void
  funding?: boolean
}

const statusColor: Record<VoucherStubProps['status'], string> = {
  Draft: 'text-[var(--color-ink-soft)] bg-[var(--color-paper-dim)]',
  Active: 'text-[var(--color-settled)] bg-[var(--color-settled-dim)]',
  Paused: 'text-[var(--color-voucher)] bg-[var(--color-voucher-dim)]',
  Expired: 'text-[var(--color-aid)] bg-[var(--color-aid-dim)]',
  Completed: 'text-[var(--color-signal)] bg-[var(--color-signal-dim)]',
  Cancelled: 'text-[var(--color-ink-soft)] bg-[var(--color-paper-dim)]',
}

/**
 * The product's signature visual element: an aid campaign rendered as a
 * torn voucher stub, split by a dashed perforation. The left "stub" carries
 * the ledger id and status; the right "ticket" carries the claim action.
 * This is deliberate: ReliefLock's core idea is a programmable voucher, so
 * the card that represents a campaign should look like one.
 */
export function VoucherStub({
  campaignId,
  name,
  status,
  allocation,
  token,
  deadline,
  claimed,
  onClaim,
  claiming,
  onFund,
  funding,
}: VoucherStubProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-sm"
    >
      <div className="flex w-28 flex-shrink-0 flex-col items-center justify-center gap-1 bg-[var(--color-paper-dim)] py-4">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-soft)]">
          Ledger
        </span>
        <span className="font-mono text-lg font-semibold text-[var(--color-ink)]">
          #{String(campaignId).padStart(4, '0')}
        </span>
      </div>

      <div className="voucher-perforation relative flex flex-1 flex-col justify-between p-5">
        <span className="voucher-notch -top-2 hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg leading-snug text-[var(--color-ink)]">{name}</h3>
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${statusColor[status]}`}
          >
            {status}
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="font-mono text-2xl font-semibold text-[var(--color-ink)]">
              {allocation} <span className="text-sm text-[var(--color-ink-soft)]">{token}</span>
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Claim window ends {deadline}</p>
          </div>

          <div className="flex gap-2">
            {onFund && status === 'Draft' && (
              <button
                onClick={onFund}
                disabled={funding}
                className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {funding ? 'Funding…' : 'Fund Campaign'}
              </button>
            )}
            {onClaim && (
              <button
                onClick={onClaim}
                disabled={claimed || claiming || status !== 'Active'}
                className="rounded-full bg-[var(--color-aid)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {claimed ? 'Claimed' : claiming ? 'Claiming…' : 'Claim aid'}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
