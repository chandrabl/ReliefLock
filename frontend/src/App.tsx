import { Routes, Route } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Campaigns from '@/pages/Campaigns'
import NgoDashboard from '@/pages/ngo/Dashboard'
import BeneficiaryDashboard from '@/pages/beneficiary/Dashboard'
import MerchantDashboard from '@/pages/merchant/Dashboard'

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/ngo" element={<NgoDashboard />} />
        <Route path="/beneficiary" element={<BeneficiaryDashboard />} />
        <Route path="/merchant" element={<MerchantDashboard />} />
      </Routes>
    </div>
  )
}
