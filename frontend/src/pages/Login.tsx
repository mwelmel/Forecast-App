import { useState } from 'react'
import './Login.css'
import BrandMark from '../components/BrandMark'
import FormField from '../components/FormField'
import { ArrowRight, Eye, LockKeyhole, Mail } from 'lucide-react'

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log({ username, password, rememberMe })
    // TODO: panggil endpoint login di backend FastAPI di sini
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

              <button type="submit" className="submit-button">
                Masuk
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