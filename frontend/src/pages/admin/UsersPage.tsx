import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Search, ShieldOff, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import type { AdminUser, PagedResult, UserRole } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { useI18n } from '@/i18n/I18nProvider'
import { Button, Input, Select } from '@/ui/controls'
import { Avatar, Badge, Card, displayStyles as d, EmptyState, ErrorState, Loader, PageHeader, Pagination } from '@/ui/display'
import { useConfirm, useToast } from '@/ui/overlay'
import a from './Admin.module.css'

const roles: UserRole[] = ['Student', 'Teacher', 'Admin']

export default function UsersPage() {
  const { t, f } = useI18n()
  const { user: me } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(text.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(id)
  }, [text])

  const query = useQuery({
    queryKey: ['admin', 'users', search, role, page],
    queryFn: () => api.get<PagedResult<AdminUser>>('/admin/users', { search, role, page, pageSize: 15 }),
    placeholderData: keepPreviousData,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })

  const changeRole = useMutation({
    mutationFn: ({ id, value }: { id: number; value: UserRole }) => api.put(`/admin/users/${id}/role`, { role: value }),
    onSuccess: () => {
      toast.success(t.admin.roleChanged)
      refresh()
    },
    onError: (e) => {
      toast.error(e)
      refresh()
    },
  })

  const block = useMutation({
    mutationFn: ({ id, blocked }: { id: number; blocked: boolean }) => api.put(`/admin/users/${id}/block`, { blocked }),
    onSuccess: (_, v) => {
      toast.success(v.blocked ? t.admin.blockedToast : t.admin.unblockedToast)
      refresh()
    },
    onError: toast.error,
  })

  return (
    <>
      <PageHeader title={t.admin.users} subtitle={t.admin.usersSubtitle} />
      <div className={a.toolbar}>
        <Input icon={<Search aria-hidden />} type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={t.admin.usersSearch} aria-label={t.admin.usersSearch} />
        <Select
          value={role}
          aria-label={t.admin.userColumns.role}
          onChange={(e) => {
            setRole(e.target.value as UserRole | '')
            setPage(1)
          }}
        >
          <option value="">{t.admin.allRoles}</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {t.roles[r]}
            </option>
          ))}
        </Select>
      </div>

      {query.isPending ? (
        <Loader />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title={t.catalog.emptyTitle} />
        </Card>
      ) : (
        <>
          <Card padded={false}>
            <div className={d.tableWrap} style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
              <table className={d.table}>
                <thead>
                  <tr>
                    <th>{t.admin.userColumns.user}</th>
                    <th>{t.admin.userColumns.role}</th>
                    <th>{t.admin.userColumns.activity}</th>
                    <th>{t.admin.userColumns.registered}</th>
                    <th>{t.admin.userColumns.status}</th>
                    <th aria-label={t.common.actions} />
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((u) => {
                    const isMe = u.id === me?.id
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className={a.userCell}>
                            <Avatar name={u.name} size={32} />
                            <span>
                              <strong style={{ fontWeight: 600 }}>
                                {u.name} {isMe && <span className="subtle">({t.admin.you})</span>}
                              </strong>
                              <span className={a.email}>{u.email}</span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <Select
                            className={a.roleSelect}
                            value={u.role}
                            disabled={isMe}
                            aria-label={`${t.admin.userColumns.role}: ${u.name}`}
                            onChange={(e) => changeRole.mutate({ id: u.id, value: e.target.value as UserRole })}
                          >
                            {roles.map((r) => (
                              <option key={r} value={r}>
                                {t.roles[r]}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="muted" style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>
                          {u.role === 'Student' ? t.admin.enrollmentsCount(u.enrollments) : t.admin.coursesCount(u.courses)}
                          <br />
                          {u.lastLoginAt ? f.relative(u.lastLoginAt) : '—'}
                        </td>
                        <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                          {f.date(u.createdAt)}
                        </td>
                        <td>{u.isBlocked ? <Badge tone="danger" icon={<ShieldOff aria-hidden />}>{t.admin.blocked}</Badge> : <Badge tone="success">{t.admin.active}</Badge>}</td>
                        <td style={{ textAlign: 'right' }}>
                          {!isMe &&
                            (u.isBlocked ? (
                              <Button size="sm" variant="ghost" icon={<UserCheck aria-hidden />} onClick={() => block.mutate({ id: u.id, blocked: false })}>
                                {t.admin.unblock}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={<Ban aria-hidden />}
                                onClick={async () => {
                                  if (await confirm({ title: `${t.admin.block}: ${u.name}?`, danger: true, confirmLabel: t.admin.block }))
                                    block.mutate({ id: u.id, blocked: true })
                                }}
                              >
                                {t.admin.block}
                              </Button>
                            ))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Pagination page={query.data.page} totalPages={query.data.totalPages} onChange={setPage} />
        </>
      )}
    </>
  )
}
