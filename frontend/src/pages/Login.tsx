import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Login.css'
import BrandMark from '../components/BrandMark'
import FormField from '../components/FormField'
import { ArrowRight, Eye, LockKeyhole, Mail } from 'lucide-react'

function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail ?? 'Login gagal. Silakan periksa kembali data Anda.')
      }

      const storage = rememberMe ? localStorage : sessionStorage
      storage.setItem('access_token', result.access_token)
      storage.setItem('user', JSON.stringify(result.user)) 
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Login gagal. Silakan coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-left">
          <div className="login-left-overlay" />
          <div className="login-left-content">
            <BrandMark />
            <div className="login-illustration-placeholder" aria-hidden="true" />
          </div>
        </div>

        <div className="login-right">
          <div className="login-form-container">
            <div className="login-form-header">
              <h2 className="login-heading">Selamat Datang</h2>
              <p className="login-subtext">Silakan masuk ke akun Anda untuk melanjutkan.</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <FormField id="username" label="Username">
                <div className="input-wrapper">
                  <span className="input-icon"><Mail aria-hidden="true" /></span>
                  <input
                    id="username"
                    type="text"
                    className="form-input"
                    placeholder="Masukkan username anda"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </FormField>

              <FormField id="password" label="Password">
                <div className="input-wrapper">
                  <span className="input-icon"><LockKeyhole aria-hidden="true" /></span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Masukkan kata sandi Anda"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    <Eye aria-hidden="true" />
                  </button>
                </div>
              </FormField>

              <div className="form-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Ingat Saya</span>
                </label>
              </div>

              {errorMessage && <p className="login-error" role="alert">{errorMessage}</p>}

              <button type="submit" className="submit-button" disabled={isSubmitting}>
                {isSubmitting ? 'Memproses...' : 'Masuk'}
                <ArrowRight aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login