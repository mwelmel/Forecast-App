import { useState, useEffect } from 'react'
import { Sidebar } from './Dashboard'
import './UserManagement.css'
import {ChevronLeft,ChevronRight,Edit3,Filter,Plus,Search,X,} from 'lucide-react'
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function getAccessToken() {
  return localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
}

async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const token = getAccessToken()
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.detail ?? 'Permintaan tidak dapat diproses')
  }

  return data as T
}

//  table user
type User = {
  user_id: number
  full_name: string
  username: string
  role: 'super_user' | 'user'
  is_active: boolean
}

type EditUserForm = {
  full_name: string
  username: string
  role: 'super_user' | 'user'
  is_active: boolean
}

type CreateUserForm = {
  full_name: string
  username: string
  password: string
  role: 'super_user' | 'user'
}

// status toggle button
function StatusToggle({
  active,
  onChange,
}: {
  active: boolean
  onChange: () => void
}) {
  return (
    <button
      className={`status-toggle${active ? ' active' : ''}`}
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={
        active
          ? 'Nonaktifkan pengguna'
          : 'Aktifkan pengguna'
      }
      onClick={onChange}
    >
      <span />
    </button>
  )
}

// edit user
function EditUserModal({
  user,
  onClose,
  onSuccess,
}: {
  user: User
  onClose: () => void
  onSuccess: (updatedUser: User) => void
}) {

  const [form, setForm] = useState<EditUserForm>({
    full_name: user.full_name,
    username: user.username,
    role: user.role,
    is_active: user.is_active,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

// misal ada edit baru
  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >
  ) => {

    const { name, value } = event.target

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

// submit baru
  const handleSubmit = async (
    event: React.FormEvent
  ) => {

    event.preventDefault()

    setLoading(true)
    setError('')

    try {
      const data = await apiRequest<User>(`/api/users/${user.user_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: form.full_name,
          username: form.username,
          role: form.role,
          is_active: form.is_active,
        }),
      })


      onSuccess(data)

    } catch (error) {

      setError(
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan'
      )

    } finally {

      setLoading(false)

    }
  }


  return (
    <div className="modal-overlay">

      <div className="user-modal">

        <div className="modal-header">

          <h2>Edit Pengguna</h2>

          <button
            type="button"
            onClick={onClose}
            className="modal-close"
            aria-label="Tutup modal"
          >
            <X />
          </button>

        </div>


        <form
          className="user-form"
          onSubmit={handleSubmit}
        >

          {/* FULL NAME */}

          <div className="form-group">

            <label htmlFor="full_name">
              Nama Lengkap
            </label>

            <input
              id="full_name"
              name="full_name"
              type="text"
              value={form.full_name}
              onChange={handleChange}
              required
              maxLength={100}
            />

          </div>


          {/* USERNAME */}

          <div className="form-group">

            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              required
              maxLength={100}
            />

          </div>


          {/* role */}

          <div className="form-group">

            <label htmlFor="role">
              Role
            </label>

            <select
              id="role"
              name="role"
              value={form.role}
              onChange={handleChange}
            >

              <option value="user">
                User
              </option>

              <option value="super_user">
                Super User
              </option>

            </select>

          </div>


          {/* STATUS */}

          <div className="form-group">

            <label htmlFor="is_active">
              Status
            </label>

            <select
              id="is_active"
              name="is_active"
              value={String(form.is_active)}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  is_active: event.target.value === 'true',
                }))
              }
            >

              <option value="true">
                Aktif
              </option>

              <option value="false">
                Nonaktif
              </option>

            </select>

          </div>


          {/* ERROR */}

          {error && (
            <p className="form-error">
              {error}
            </p>
          )}


          {/* ACTION */}

          <div className="modal-actions">

            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </button>

            <button
              type="submit"
              className="save-button"
              disabled={loading}
            >
              {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>

          </div>

        </form>

      </div>

    </div>
  )
}


function CreateUserModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (createdUser: User) => void
}) {
  const [form, setForm] = useState<CreateUserForm>({
    full_name: '',
    username: '',
    password: '',
    role: 'user',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const createdUser = await apiRequest<User>('/api/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, is_active: true }),
      })
      onSuccess(createdUser)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Gagal menambahkan user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
        <div className="modal-header">
          <h2 id="create-user-title">Tambah Pengguna</h2>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Tutup modal">
            <X />
          </button>
        </div>
        <form className="user-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="create-full-name">Nama Lengkap</label>
            <input id="create-full-name" type="text" value={form.full_name} maxLength={100} required
              onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))} />
          </div>
          <div className="form-group">
            <label htmlFor="create-username">Username</label>
            <input id="create-username" type="text" value={form.username} minLength={3} maxLength={60} required
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} />
          </div>
          <div className="form-group">
            <label htmlFor="create-password">Password</label>
            <input id="create-password" type="password" value={form.password} minLength={6} maxLength={10} required
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} />
          </div>
          <div className="form-group">
            <label htmlFor="create-role">Role</label>
            <select id="create-role" value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as CreateUserForm['role'] }))}>
              <option value="user">User</option>
              <option value="super_user">Super User</option>
            </select>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose} disabled={loading}>Batal</button>
            <button type="submit" className="save-button" disabled={loading}>{loading ? 'Menyimpan...' : 'Tambah Pengguna'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}


//table user

function UserTable({ refreshSignal }: { refreshSignal: number }) {

  const [users, setUsers] = useState<User[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'super_user' | 'user'>('all')
  const [page, setPage] = useState(1)
  const [editingUser, setEditingUser] =
    useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')


  // cari user
  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError('')
      setUsers(await apiRequest<User[]>('/api/users'))
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers()
  }, [refreshSignal])


  // toggle status
  const toggleUser = async (userId: number) => {
    try {
      const data = await apiRequest<User>(`/api/users/${userId}/status`, { method: 'PATCH' })

      setUsers((items) =>
        items.map((user) =>
          user.user_id === data.user_id
            ? data
            : user
        )
      )

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gagal mengubah status user')
    }
  }


  //cari user
  const filteredUsers = users.filter((user) => {
    const matchesQuery = `${user.full_name} ${user.username}`.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'all' ||
      (filter === 'active' && user.is_active) ||
      (filter === 'inactive' && !user.is_active) ||
      user.role === filter
    return matchesQuery && matchesFilter
  })
  const pageSize = 8
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <section className="user-panel">
      {/* TOOLBAR */}

      <div className="user-toolbar">

        <label className="user-search">

          <Search
            className="search-icon"
            aria-hidden="true"
          />

          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Cari pengguna..."
            aria-label="Cari pengguna"
          />

        </label>

        <label className="filter-button">

          <Filter
            className="filter-icon"
            aria-hidden="true"
          />

          <span>Filter</span>
          <select value={filter} aria-label="Filter pengguna" onChange={(event) => {
            setFilter(event.target.value as typeof filter)
            setPage(1)
          }}>
            <option value="all">Semua</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
            <option value="super_user">Super User</option>
            <option value="user">User</option>
          </select>
        </label>

      </div>


      {/* ERROR */}

      {error && (
        <p className="form-error">
          {error}
        </p>
      )}


      {/* TABLE */}

      <div className="user-table-scroll">

        <table className="user-table">

          <thead>

            <tr>

              <th className="column-name">NAMA LENGKAP</th>

              <th className="column-username">USERNAME</th>

              <th className="column-role">PERAN</th>

              <th className="column-status">STATUS</th>

              <th className="column-actions">AKSI</th>

            </tr>

          </thead>
          <tbody>

            {loading ? (

              <tr>

                <td className="table-message" colSpan={5}>
                  Memuat data pengguna...
                </td>

              </tr>

            ) : visibleUsers.length === 0 ? (

              <tr>

                <td className="table-message" colSpan={5}>
                  Tidak ada pengguna ditemukan
                </td>

              </tr>

            ) : (

              visibleUsers.map((user) => (

                <tr key={user.user_id}>

                  {/* NAMA */}

                  <td className="column-name">
                    {user.full_name}
                  </td>


                  {/* USERNAME */}

                  <td className="column-username">
                    {user.username}
                  </td>


                  {/* ROLE */}

                  <td className="column-role">

                    <span
                      className={`role-badge ${
                        user.role === 'super_user'
                          ? 'super'
                          : ''
                      }`}
                    >

                      {user.role === 'super_user'
                        ? 'Super User'
                        : 'User'}

                    </span>

                  </td>


                  {/* STATUS */}

                  <td className="column-status">

                    <div className="user-status">

                      <StatusToggle
                        active={user.is_active}
                        onChange={() =>
                          toggleUser(user.user_id)
                        }
                      />

                      <span>
                        {user.is_active
                          ? 'Aktif'
                          : 'Nonaktif'}
                      </span>

                    </div>

                  </td>


                  {/* EDIT */}

                  <td className="column-actions">

                    <button
                      className="user-edit"
                      type="button"
                      onClick={() =>
                        setEditingUser(user)
                      }
                      aria-label={`Edit ${user.full_name}`}
                    >

                      <Edit3 className="edit-icon" />

                    </button>

                  </td>

                </tr>

              ))

            )}

          </tbody>

        </table>

      </div>


      {/* PAGINATION */}

      <footer className="user-pagination">

        <span>
          Menampilkan {filteredUsers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredUsers.length)} dari {filteredUsers.length} pengguna
        </span>

        <div>

          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() =>
              setPage((prev) => Math.max(1, prev - 1))
            }
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft />
          </button>


          <button
            className="current"
            type="button"
            onClick={() => setPage(1)}
          >
            {currentPage} / {pageCount}
          </button>


          <button
            type="button"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight />
          </button>

        </div>

      </footer>


      {/* EDIT MODAL */}

      {editingUser && (

        <EditUserModal
          user={editingUser}

          onClose={() =>
            setEditingUser(null)
          }

          onSuccess={(updatedUser) => {

            setUsers((items) =>
              items.map((item) =>
                item.user_id === updatedUser.user_id
                  ? updatedUser
                  : item
              )
            )

            setEditingUser(null)

          }}
        />

      )}

    </section>
  )
}

// main function
function UserManagement() {
  const [creatingUser, setCreatingUser] = useState(false)
  const [usersVersion, setUsersVersion] = useState(0)

  return (

    <div className="user-management-shell">

      <Sidebar activeLabel="User" />

      <div className="user-management-main">

        <header className="user-management-topbar" />

        <main className="user-management-content">

          <header className="user-heading">

            <div>

              <h1>
                Manajemen Pengguna
              </h1>

              <p>
                Kelola akses, peran, dan status pengguna
                dalam sistem.
              </p>

            </div>


            <button
              className="add-user-button"
              type="button"
              onClick={() => setCreatingUser(true)}
            >

              <Plus aria-hidden="true" />

              Tambah User

            </button>

          </header>


          <UserTable refreshSignal={usersVersion} />

        </main>

        {creatingUser && (
          <CreateUserModal
            onClose={() => setCreatingUser(false)}
            onSuccess={() => {
              setCreatingUser(false)
              setUsersVersion((version) => version + 1)
            }}
          />
        )}

      </div>

    </div>

  )
}


export default UserManagement