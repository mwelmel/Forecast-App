import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Forecasting from './pages/Forecasting'
import Login from './pages/Login'
import ModelSettings from './pages/ModelSettings'
import SalesData from './pages/SalesData'
import ProductData from './pages/ProductData'
import UserManagement from './pages/UserManagement'
import PredictionHistory from './pages/PredictionHistory'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/forecast" element={<Forecasting />} />
        <Route path="/settings" element={<ModelSettings />} />
        <Route path="/inventory/sales" element={<SalesData />} />
        <Route path="/inventory/products" element={<ProductData />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/history" element={<PredictionHistory />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App