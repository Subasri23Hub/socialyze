/**
 * ContentPlannerPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * AI Social Media Campaign Generator | Sourcesys Technologies
 *
 * Content Planner — Kanban board with Planned / In Progress / Completed columns.
 * Tasks are stored in Supabase `content_calendar` table.
 *
 * Features
 * ────────
 *  • Three-column Kanban: Planned → In Progress → Completed
 *  • Add Task modal: title, date (calendar), time (clock), task type, platform, description
 *  • Edit Task modal: pre-filled with existing task data
 *  • Three-dot menu: Move to column | Edit | Delete
 *  • Drag-ready column structure (draggable attribute set; full DnD can be wired in)
 *  • Status chip on cards; date + time displayed
 *  • Supabase CRUD — insert, fetch, update status, update fields, delete
 *  • Consistent with existing app design tokens (colors, fonts, border-radius, shadows)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabaseClient'
import styles from './ContentPlannerPage.module.css'

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const COLUMNS = [
  { id: 'Planned',     label: 'Planned',     color: '#3B6BF5', bg: '#EBF0FF' },
  { id: 'In Progress', label: 'In Progress', color: '#D97706', bg: '#FEF3C7' },
  { id: 'Completed',   label: 'Completed',   color: '#16A34A', bg: '#DCFCE7' },
]

const PLATFORMS = [
  'Instagram', 'Twitter / X', 'LinkedIn', 'Facebook',
  'TikTok', 'YouTube', 'Pinterest', 'Threads', 'Other',
]

const EMPTY_FORM = {
  title: '', task_type: '', platform: '', description: '',
  date: '', time: '',
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDisplayDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDisplayTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = ((hour % 12) || 12) + ':' + m + ' ' + ampm
  return display
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function ContentPlannerPage() {
  const [tasks,       setTasks]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [showModal,   setShowModal]   = useState(false)
  const [editTask,    setEditTask]    = useState(null)   // task being edited (null = add mode)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [formError,   setFormError]   = useState('')
  const [deletingId,  setDeletingId]  = useState(null)
  const [dragOver,    setDragOver]    = useState(null)
  const [calMonth,    setCalMonth]    = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  // ── Fetch tasks ──────────────────────────────────────────────
  const loadTasks = useCallback(async (opts = {}) => {
    if (!opts.silent) setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }

    const { data, error: err } = await supabase
      .from('content_calendar')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    if (err) setError(err.message)
    else     setTasks(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  // ── Open Add modal ───────────────────────────────────────────
  function openAddModal() {
    setEditTask(null)
    setForm(EMPTY_FORM)
    setFormError('')
    const now = new Date()
    setCalMonth({ year: now.getFullYear(), month: now.getMonth() })
    setShowModal(true)
  }

  // ── Open Edit modal ──────────────────────────────────────────
  function openEditModal(task) {
    setEditTask(task)
    setForm({
      title:       task.title       || '',
      task_type:   task.task_type   || '',
      platform:    task.platform    || '',
      description: task.description || '',
      date:        task.date        || '',
      time:        task.time        || '',
    })
    setFormError('')
    // Set calendar month to the task's date
    if (task.date) {
      const parts = task.date.split('-')
      setCalMonth({ year: parseInt(parts[0]), month: parseInt(parts[1]) - 1 })
    } else {
      const now = new Date()
      setCalMonth({ year: now.getFullYear(), month: now.getMonth() })
    }
    setShowModal(true)
  }

  // ── Form field handler ───────────────────────────────────────
  function handleField(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setFormError('')
  }

  // ── Submit: Add or Edit ──────────────────────────────────────
  async function handleSubmit() {
    if (!form.title.trim())    { setFormError('Task title is required.'); return }
    if (!form.date)            { setFormError('Please select a date.'); return }
    if (!form.time)            { setFormError('Please select a time.'); return }
    if (!form.task_type.trim()){ setFormError('Task type is required.'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (editTask) {
      // ── UPDATE existing task ──
      const { error: err } = await supabase
        .from('content_calendar')
        .update({
          title:       form.title.trim(),
          task_type:   form.task_type.trim(),
          platform:    form.platform,
          description: form.description.trim(),
          date:        form.date,
          time:        form.time,
        })
        .eq('id', editTask.id)

      setSaving(false)
      if (err) { setFormError(err.message); return }

      // Optimistically update local state
      setTasks(prev => prev.map(t =>
        t.id === editTask.id
          ? { ...t, title: form.title.trim(), task_type: form.task_type.trim(),
              platform: form.platform, description: form.description.trim(),
              date: form.date, time: form.time }
          : t
      ))
    } else {
      // ── INSERT new task ──
      const { error: err } = await supabase.from('content_calendar').insert({
        user_id:     user.id,
        title:       form.title.trim(),
        task_type:   form.task_type.trim(),
        platform:    form.platform,
        description: form.description.trim(),
        date:        form.date,
        time:        form.time,
        status:      'Planned',
      })

      setSaving(false)
      if (err) { setFormError(err.message); return }
      loadTasks({ silent: true })
    }

    setShowModal(false)
    setEditTask(null)
    setForm(EMPTY_FORM)
  }

  // ── Move task — OPTIMISTIC ───────────────────────────────────
  async function moveTask(task, newStatus) {
    if (task.status === newStatus) return
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    const { error: err } = await supabase
      .from('content_calendar')
      .update({ status: newStatus })
      .eq('id', task.id)
    if (err) {
      setError('Failed to move task — please refresh.')
      loadTasks({ silent: true })
    }
  }

  // ── Delete task — OPTIMISTIC ─────────────────────────────────
  async function deleteTask(id) {
    setDeletingId(id)
    setTasks(prev => prev.filter(t => t.id !== id))
    const { error: err } = await supabase.from('content_calendar').delete().eq('id', id)
    setDeletingId(null)
    if (err) {
      setError('Failed to delete task — please refresh.')
      loadTasks({ silent: true })
    }
  }

  // ── Drag-drop ────────────────────────────────────────────────
  const dragId = useRef(null)

  function onDragStart(e, taskId) {
    dragId.current = taskId
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragEnd()          { setDragOver(null) }
  function onDrop(e, colId) {
    e.preventDefault(); setDragOver(null)
    const id = dragId.current; if (!id) return
    const task = tasks.find(t => t.id === id)
    if (!task || task.status === colId) return
    moveTask(task, colId)
  }
  function onDragOver(e, colId) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(colId)
  }
  function onDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null)
  }

  function colTasks(colId) { return tasks.filter(t => t.status === colId) }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHdr}>
        <div>
          <h2 className={styles.pageTitle}>Content Planner</h2>
          <p className={styles.pageSub}>Plan, track, and manage your content tasks across all platforms.</p>
        </div>
        <button className={styles.addBtn} onClick={openAddModal}>
          <PlusIcon /> Add Task
        </button>
      </div>

      {/* Error bar */}
      {error && <div className={styles.errorBar}><WarnIcon /> {error}</div>}

      {/* Loading */}
      {loading ? (
        <div className={styles.loadState}>
          <div className={styles.spinner} />
          <span>Loading tasks…</span>
        </div>
      ) : (
        <div className={styles.board}>
          {COLUMNS.map(col => {
            const colItems = colTasks(col.id)
            return (
              <div
                key={col.id}
                className={`${styles.column} ${dragOver === col.id ? styles.columnDragOver : ''}`}
                onDragOver={e => onDragOver(e, col.id)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, col.id)}
              >
                <div className={styles.colHdr}>
                  <div className={styles.colHdrLeft}>
                    <span className={styles.colDot} style={{ background: col.color }} />
                    <span className={styles.colLabel}>{col.label}</span>
                  </div>
                  <span className={styles.colCount} style={{ background: col.bg, color: col.color }}>
                    {colItems.length}
                  </span>
                </div>

                <div className={styles.cardList}>
                  {colItems.length === 0 ? (
                    <div className={styles.emptyCol}>
                      <DropIcon />
                      <span>Drop tasks here</span>
                    </div>
                  ) : (
                    colItems.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        columns={COLUMNS}
                        onMove={moveTask}
                        onEdit={openEditModal}
                        onDelete={deleteTask}
                        deleting={deletingId === task.id}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Task Modal */}
      {showModal && (
        <TaskModal
          mode={editTask ? 'edit' : 'add'}
          form={form}
          formError={formError}
          saving={saving}
          calMonth={calMonth}
          setCalMonth={setCalMonth}
          onChange={handleField}
          onSubmit={handleSubmit}
          onClose={() => { setShowModal(false); setEditTask(null) }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TaskCard
// ─────────────────────────────────────────────────────────────
function TaskCard({ task, columns, onMove, onEdit, onDelete, deleting, onDragStart, onDragEnd }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [moving,   setMoving]   = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    function handle(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  const nextCols = columns.filter(c => c.id !== task.status)

  async function handleMove(targetCol) {
    setMenuOpen(false)
    setMoving(targetCol.id)
    await onMove(task, targetCol.id)
    setMoving(null)
  }

  return (
    <div
      className={`${styles.card} ${deleting ? styles.cardDeleting : ''} ${menuOpen ? styles.cardMenuActive : ''}`}
      draggable
      onDragStart={e => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
    >
      <div className={styles.cardTop}>
        <div className={styles.cardTitle}>{task.title}</div>
        <div className={styles.cardMenuWrap} ref={menuRef}>
          <button
            className={styles.cardMenuBtn}
            onClick={() => setMenuOpen(o => !o)}
            title="Options"
          >
            <DotsIcon />
          </button>
          {menuOpen && (
            <div className={styles.cardMenu}>
              {/* Move options */}
              {nextCols.map(c => (
                <button
                  key={c.id}
                  className={styles.cardMenuItem}
                  disabled={!!moving}
                  onClick={() => handleMove(c)}
                >
                  <ArrowRightIcon />
                  Move to {c.label}
                  {moving === c.id && <SpinIcon />}
                </button>
              ))}

              <div className={styles.cardMenuDivider} />

              {/* Edit */}
              <button
                className={styles.cardMenuItem}
                onClick={() => { setMenuOpen(false); onEdit(task) }}
              >
                <EditIcon /> Edit Task
              </button>

              <div className={styles.cardMenuDivider} />

              {/* Delete */}
              <button
                className={`${styles.cardMenuItem} ${styles.cardMenuDelete}`}
                disabled={deleting}
                onClick={() => { setMenuOpen(false); onDelete(task.id) }}
              >
                <TrashIcon /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.cardMeta}>
        {task.task_type && <span className={styles.typePill}>{task.task_type}</span>}
        {task.platform  && <span className={styles.platPill}>{task.platform}</span>}
      </div>

      {task.description && (
        <p className={styles.cardDesc}>{task.description}</p>
      )}

      <div className={styles.cardFooter}>
        <span className={styles.cardDate}><CalIcon /> {formatDisplayDate(task.date)}</span>
        <span className={styles.cardTime}><ClockIcon /> {formatDisplayTime(task.time)}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TaskModal  (unified Add + Edit modal)
// ─────────────────────────────────────────────────────────────
function TaskModal({ mode, form, formError, saving, calMonth, setCalMonth, onChange, onSubmit, onClose }) {
  const isEdit = mode === 'edit'

  const { year, month } = calMonth
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December']
  const today = todayStr()

  const calDays = []
  for (let i = 0; i < firstDay; i++) calDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) calDays.push(d)

  function selectDate(day) {
    if (!day) return
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onChange('date', `${year}-${mm}-${dd}`)
  }

  function prevMonth() {
    setCalMonth(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 })
  }
  function nextMonth() {
    setCalMonth(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 })
  }

  const selectedDay = form.date ? (() => {
    const parts = form.date.split('-')
    const y = parseInt(parts[0]), m = parseInt(parts[1]) - 1, d = parseInt(parts[2])
    return (y === year && m === month) ? d : null
  })() : null

  const todayDay = (() => {
    const parts = today.split('-')
    const y = parseInt(parts[0]), m = parseInt(parts[1]) - 1, d = parseInt(parts[2])
    return (y === year && m === month) ? d : null
  })()

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.modalHdr}>
          <div>
            <div className={styles.modalTitle}>{isEdit ? 'Edit Content Task' : 'Add Content Task'}</div>
            <div className={styles.modalSub}>
              {isEdit ? 'Update the details of this task' : 'Plan a new task on your content calendar'}
            </div>
          </div>
          <button className={styles.modalClose} onClick={onClose}><XIcon /></button>
        </div>

        <div className={styles.modalBody}>

          {/* Left: form fields */}
          <div className={styles.formCol}>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Task Title <span className={styles.req}>*</span></label>
              <input
                className={styles.fieldInput}
                placeholder="e.g. Instagram Reel — Product Launch"
                value={form.title}
                onChange={e => onChange('title', e.target.value)}
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Task Type <span className={styles.req}>*</span></label>
              <input
                className={styles.fieldInput}
                placeholder="e.g. Reel, Story, Blog Post, Ad Copy…"
                value={form.task_type}
                onChange={e => onChange('task_type', e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Platform</label>
              <select
                className={styles.fieldSelect}
                value={form.platform}
                onChange={e => onChange('platform', e.target.value)}
              >
                <option value="">— Select platform —</option>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Description</label>
              <textarea
                className={styles.fieldTextarea}
                placeholder="Brief notes about this task…"
                rows={3}
                value={form.description}
                onChange={e => onChange('description', e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Time <span className={styles.req}>*</span></label>
              <TimePicker value={form.time} onChange={v => onChange('time', v)} />
            </div>

          </div>

          {/* Right: calendar */}
          <div className={styles.calCol}>
            <label className={styles.fieldLabel}>Date <span className={styles.req}>*</span></label>
            <div className={styles.calWrap}>
              <div className={styles.calNav}>
                <button className={styles.calNavBtn} onClick={prevMonth}><ChevronLeftIcon /></button>
                <span className={styles.calMonthLabel}>{MONTH_NAMES[month]} {year}</span>
                <button className={styles.calNavBtn} onClick={nextMonth}><ChevronRightIcon /></button>
              </div>
              <div className={styles.calGrid}>
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                  <div key={d} className={styles.calDow}>{d}</div>
                ))}
                {calDays.map((day, i) => (
                  <div
                    key={i}
                    className={`${styles.calDay}
                      ${!day ? styles.calDayEmpty : ''}
                      ${day && day === todayDay ? styles.calDayToday : ''}
                      ${day && day === selectedDay ? styles.calDaySelected : ''}
                    `}
                    onClick={() => selectDate(day)}
                  >
                    {day || ''}
                  </div>
                ))}
              </div>
              {form.date && (
                <div className={styles.calSelected}>
                  <CalIcon /> {formatDisplayDate(form.date)}
                </div>
              )}
            </div>
          </div>
        </div>

        {formError && <div className={styles.formError}><WarnIcon /> {formError}</div>}

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button className={styles.saveBtn} onClick={onSubmit} disabled={saving}>
            {saving
              ? <><SpinIcon /> Saving…</>
              : isEdit
                ? <><CheckIcon /> Save Changes</>
                : <><CheckIcon /> Add Task</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TimePicker
// ─────────────────────────────────────────────────────────────
function TimePicker({ value, onChange }) {
  const [hour, setHour] = useState(() => value ? parseInt(value.split(':')[0]) % 12 || 12 : 9)
  const [min,  setMin]  = useState(() => value ? parseInt(value.split(':')[1]) : 0)
  const [ampm, setAmpm] = useState(() => {
    if (!value) return 'AM'
    return parseInt(value.split(':')[0]) >= 12 ? 'PM' : 'AM'
  })

  function emit(h, m, ap) {
    let h24 = h % 12
    if (ap === 'PM') h24 += 12
    onChange(`${String(h24).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
  }

  function setH(h) { setHour(h); emit(h, min, ampm) }
  function setM(m) { setMin(m);  emit(hour, m, ampm) }

  const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
  const MINS  = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

  return (
    <div className={styles.timePicker}>
      <div className={styles.timeScroll}>
        <div className={styles.timeScrollLabel}>Hour</div>
        <div className={styles.timeScrollList}>
          {HOURS.map(h => (
            <button key={h} className={`${styles.timeItem} ${hour === h ? styles.timeItemActive : ''}`} onClick={() => setH(h)}>
              {String(h).padStart(2,'0')}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.timeSep}>:</div>
      <div className={styles.timeScroll}>
        <div className={styles.timeScrollLabel}>Min</div>
        <div className={styles.timeScrollList}>
          {MINS.map(m => (
            <button key={m} className={`${styles.timeItem} ${min === m ? styles.timeItemActive : ''}`} onClick={() => setM(m)}>
              {String(m).padStart(2,'0')}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.timeAmpm}>
        <button className={`${styles.ampmBtn} ${ampm === 'AM' ? styles.ampmActive : ''}`} onClick={() => { setAmpm('AM'); emit(hour, min, 'AM') }}>AM</button>
        <button className={`${styles.ampmBtn} ${ampm === 'PM' ? styles.ampmActive : ''}`} onClick={() => { setAmpm('PM'); emit(hour, min, 'PM') }}>PM</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function XIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function CalIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:3}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function ClockIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:3}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
}
function DotsIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
}
function EditIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function ArrowRightIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
}
function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
function WarnIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:5}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}
function ChevronLeftIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
}
function ChevronRightIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
}
function DropIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C4C9D9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
}
function SpinIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{animation:'spin 0.7s linear infinite',display:'inline'}}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
}
