import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, Landmark, Store, Users } from 'lucide-react'
import { VoucherStub } from '@/components/VoucherStub'

const sampleCampaigns = [
  { id: 1042, name: 'Flood Relief — Sindh', allocation: '100', token: 'USDC', deadline: 'Sep 24' },
  { id: 1043, name: 'Winter Fuel Vouchers', allocation: '45', token: 'USDC', deadline: 'Oct 02' },
]

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]"
            >
              Programmable humanitarian aid on Stellar
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="font-display text-4xl leading-[1.1] text-[var(--color-ink)] md:text-5xl"
            >
              Humanitarian aid,
              <br />
              programmable by design.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-6 max-w-md text-lg text-[var(--color-ink-soft)]"
            >
              ReliefLock helps organizations distribute aid transparently, while a Soroban
              smart contract — not a spreadsheet, not an admin panel — enforces eligibility,
              allocation, and redemption rules.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-8 flex gap-3"
            >
              <Link
                to="/register"
                className="rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-white hover:opacity-90"
              >
                Start a campaign
              </Link>
              <Link
                to="/campaigns"
                className="rounded-full border border-[var(--color-line)] px-6 py-3 text-sm font-medium hover:border-[var(--color-ink)]"
              >
                Browse aid programs
              </Link>
            </motion.div>
          </div>

          <div className="flex flex-col gap-4">
            {sampleCampaigns.map((c) => (
              <VoucherStub
                key={c.id}
                campaignId={c.id}
                name={c.name}
                status="Active"
                allocation={c.allocation}
                token={c.token}
                deadline={c.deadline}
              />
            ))}
            <p className="text-center text-xs text-[var(--color-ink-soft)]">
              Example campaigns — every ledger id above maps to a real on-chain campaign.
            </p>
          </div>
        </div>
      </section>

      {/* Problem framing */}
      <section className="border-y border-[var(--color-line)] bg-[var(--color-paper-dim)] py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-2xl text-[var(--color-ink)] md:text-3xl">
            The problem isn't donation tracking.
          </h2>
          <p className="mt-4 text-[var(--color-ink-soft)]">
            It's distributing aid according to eligibility, allocation, timing, and spending
            rules — without a single administrator manually approving every payment. ReliefLock
            moves that enforcement on-chain, so no one, including the NGO, can quietly bypass
            the rules a campaign was funded under.
          </p>
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-2xl text-[var(--color-ink)] md:text-3xl">
          Built for every party in the aid chain.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <RoleCard
            icon={<Landmark className="h-5 w-5" />}
            title="NGOs"
            body="Define allocation, claim windows, and merchant restrictions once. The contract enforces them for the life of the campaign."
            accent="signal"
          />
          <RoleCard
            icon={<Users className="h-5 w-5" />}
            title="Beneficiaries"
            body="Connect a wallet, see exactly what you're eligible for, and claim aid directly — no intermediary approval per payment."
            accent="aid"
          />
          <RoleCard
            icon={<Store className="h-5 w-5" />}
            title="Merchants"
            body="Redeem beneficiary vouchers for goods and services, with the contract verifying authorization and balance before every settlement."
            accent="voucher"
          />
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-[var(--color-line)] py-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 text-center">
          <ShieldCheck className="h-6 w-6 text-[var(--color-settled)]" />
          <p className="max-w-xl text-[var(--color-ink-soft)]">
            Every claim and redemption is a Stellar transaction. Personal data — names,
            documents, phone numbers — stays off-chain. Only what's needed to enforce the
            rules lives on the ledger.
          </p>
        </div>
      </section>
    </div>
  )
}

function RoleCard({
  icon,
  title,
  body,
  accent,
}: {
  icon: React.ReactNode
  title: string
  body: string
  accent: 'signal' | 'aid' | 'voucher'
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-white p-6">
      <div
        className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full"
        style={{
          background: `var(--color-${accent}-dim)`,
          color: `var(--color-${accent})`,
        }}
      >
        {icon}
      </div>
      <h3 className="font-display text-lg text-[var(--color-ink)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{body}</p>
    </div>
  )
}
