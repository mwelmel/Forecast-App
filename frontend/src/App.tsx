import { BrowserRouter, Routes, Route } from 'react-router-dom'

import Dashboard from './pages/Dashboard'
import Forecasting from './pages/Forecasting'
import Login from './pages/Login'
import ModelSettings from './pages/ModelSettings'
import SalesData from './pages/SalesData'
import ProductData from './pages/ProductData'
import UserManagement from './pages/UserManagement'
import PredictionHistory from './pages/PredictionHistory'

import ProtectedRoute from './components/ProtectedRoute'


function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Halaman yang bisa diakses User dan Super User */}
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={['super_user', 'user']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['super_user', 'user']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/forecast"
          element={
            <ProtectedRoute allowedRoles={['super_user', 'user']}>
              <Forecasting />
            </ProtectedRoute>
          }
        />

        <Route
          path="/history"
          element={
            <ProtectedRoute allowedRoles={['super_user', 'user']}>
              <PredictionHistory />
            </ProtectedRoute>
          }
        />


        {/* Halaman khusus Super User */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['super_user']}>
              <ModelSettings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory/sales"
          element={
            <ProtectedRoute allowedRoles={['super_user']}>
              <SalesData />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory/products"
          element={
            <ProtectedRoute allowedRoles={['super_user']}>
              <ProductData />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['super_user']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />


        {/* Login tidak perlu authentication */}
        <Route path="/login" element={<Login />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App