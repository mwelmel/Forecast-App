import { useState } from 'react'
import { Sidebar } from './Dashboard'
import './UserManagement.css'

type User = { name: string; email: string; role: 'Super User' | 'User'; active: boolean }

const initialUsers: User[] = [
  { name: 'Amanda Rizky', email: 'amanda.r@mail.com', role: 'Super User', active: true },
  { name: 'Budi Wibowo', email: 'budi.w@mail.com', role: 'User', active: true },
  { name: 'Citra Dewi', email: 'citra.d@mail.com', role: 'User', active: false },
  { name: 'Dimas Saputra', email: 'dimas.s@mail.com', role: 'User', active: true },
]

function StatusToggle({ active, onChange }: { active: boolean; onChange: () => void }) {
  return <button className={`status-toggle${active ? ' active' : ''}`} type="button" role="switch" aria-checked={active} aria-label={active ? 'Nonaktifkan pengguna' : 'Aktifkan pengguna'} onClick={onChange}><span /></button>
}

function UserTable() {
  const [users, setUsers] = useState(initialUsers)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const visibleUsers = users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase()))
  const toggleUser = (name: string) => setUsers((items) => items.map((user) => user.name === name ? { ...user, active: !user.active } : user))

  return (
    <section className="user-panel">
      <div className="user-toolbar"><label className="user-search"><span className="search-icon" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari pengguna..." aria-label="Cari pengguna" /></label><button className="filter-button" type="button"><span className="filter-icon" />Filter</button></div>
      <div className="user-table-scroll"><table className="user-table"><thead><tr><th>NAMA LENGKAP</th><th>EMAIL</th><th>PERAN</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{visibleUsers.map((user) => <tr key={user.email}><td>{user.name}</td><td>{user.email}</td><td><span className={`role-badge ${user.role === 'Super User' ? 'super' : ''}`}>{user.role}</span></td><td><div className="user-status"><StatusToggle active={user.active} onChange={() => toggleUser(user.name)} /><span>{user.active ? 'Aktif' : 'Nonaktif'}</span></div></td><td><button className="user-edit" type="button" aria-label={`Edit ${user.name}`}><span className="edit-icon" /></button></td></tr>)}</tbody></table></div>
      <footer className="user-pagination"><span>Menampilkan 1 hingga 4 dari 24 pengguna</span><div><button type="button" disabled={page === 1} aria-label="Halaman sebelumnya">‹</button><button className={page === 1 ? 'current' : ''} type="button" onClick={() => setPage(1)}>1</button><button className={page === 2 ? 'current' : ''} type="button" onClick={() => setPage(2)}>2</button><button className={page === 3 ? 'current' : ''} type="button" onClick={() => setPage(3)}>3</button><i>...</i><button className={page === 6 ? 'current' : ''} type="button" onClick={() => setPage(6)}>6</button><button type="button" onClick={() => setPage(Math.min(6, page + 1))} aria-label="Halaman berikutnya">›</button></div></footer>
    </section>
  )
}

function UserManagement() {
  return <div className="user-management-shell"><Sidebar activeLabel="User" /><div className="user-management-main"><header className="user-management-topbar" /><main className="user-management-content"><header className="user-heading"><div><h1>Manajemen Pengguna</h1><p>Kelola akses, peran, dan status pengguna dalam sistem.</p></div><button className="add-user-button" type="button"><span>+</span>Tambah User</button></header><UserTable /></main></div></div>
}

export default UserManagement