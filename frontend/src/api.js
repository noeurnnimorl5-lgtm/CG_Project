import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const studentsApi = {
  list:    (cls) => api.get('/students', { params: cls ? { class_name: cls } : {} }),
  create:  (data) => api.post('/students', data),
  update:  (id, data) => api.put(`/students/${id}`, data),
  delete:  (id) => api.delete(`/students/${id}`),
  enroll:  (id, file) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post(`/students/${id}/enroll`, fd)
  },
  classes: () => api.get('/students/classes/list'),
}

export const attendanceApi = {
  scan:    (file, className) => {
    const fd = new FormData(); fd.append('file', file); fd.append('class_name', className)
    return api.post('/attendance/scan', fd)
  },
  detect:  (file) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post('/attendance/detect-only', fd)
  },
  list:    (params) => api.get('/attendance', { params }),
  manual:  (data) => api.post('/attendance/manual', data),
  delete:  (id) => api.delete(`/attendance/${id}`),
}

export const reportsApi = {
  stats:   () => api.get('/reports/stats'),
  summary: (date) => api.get('/reports/summary', { params: { target_date: date } }),
  export:  (params) => api.get('/reports/export', { params, responseType: 'blob' }),
}

export default api
