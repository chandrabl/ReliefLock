import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export interface CampaignMeta {
  _id: string
  onChainId: number
  name: string
  description?: string
  category?: string
  token: string
  totalFunding: string
  allocationPerBeneficiary: string
  startTime: string
  expiryTime: string
  maxClaimsPerBeneficiary: number
  merchantRestricted: boolean
  status: 'Draft' | 'Active' | 'Paused' | 'Expired' | 'Completed' | 'Cancelled'
  fundedAmount: string
  distributedAmount: string
}

export function useCampaigns(params?: { status?: string; category?: string }) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: async () => {
      const res = await api.get<{ items: CampaignMeta[]; total: number }>('/campaigns', {
        params,
      })
      return res.data
    },
  })
}

export function useCampaign(onChainId: number | undefined) {
  return useQuery({
    queryKey: ['campaign', onChainId],
    queryFn: async () => {
      const res = await api.get<CampaignMeta>(`/campaigns/${onChainId}`)
      return res.data
    },
    enabled: onChainId != null,
  })
}

export function useFeedbackSummary(campaignOnChainId: number | undefined) {
  return useQuery({
    queryKey: ['feedback-summary', campaignOnChainId],
    queryFn: async () => {
      const res = await api.get(`/feedback/summary/${campaignOnChainId}`)
      return res.data
    },
    enabled: campaignOnChainId != null,
  })
}
