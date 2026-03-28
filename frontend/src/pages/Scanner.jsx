import { useRef, useState, useEffect, useCallback } from 'react'
import { attendanceApi, studentsApi } from '../api'
import { Camera, CameraOff, Scan, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

const INTERVAL_MS = 2500 // auto-detect every 2.5s

export default function Scanner() {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)
  const timerRef   = useRef(null)

  const [isLive,      setIsLive]      = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [selectedClass, setSelectedClass] = useState('')
  const [classes,     setClasses]     = useState([])
  const [result,      setResult]      = useState(null)   // last scan result
  const [faceCount,   setFaceCount]   = useState(0)
  const [log,         setLog]         = useState([])
  const [autoScan,    setAutoScan]    = useState(false)
  const [error,       setError]       = useState('')

  // Load classes
  useEffect(() => {
    studentsApi.classes().then(r => {
      setClasses(r.data)
      if (r.data.length) setSelectedClass(r.data[0].class_name)
    }).catch(() => {
      setClasses([{ class_name: 'Class A' }, { class_name: 'Class B' }, { class_name: 'Class C' }])
      setSelectedClass('Class A')
    })
    return () => stopCamera()
  }, [])

  // Auto-scan loop
  useEffect(() => {
    if (autoScan && isLive) {
      timerRef.current = setInterval(captureAndScan, INTERVAL_MS)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [autoScan, isLive, selectedClass])

  const startCamera = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsLive(true)
    } catch (e) {
      setError('Camera access denied. Please allow camera permission and try again.')
    }
  }

  const stopCamera = () => {
    clearInterval(timerRef.current)
    setAutoScan(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setIsLive(false)
    setFaceCount(0)
  }

  const getFrame = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  }

  const drawBoxes = (faces) => {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return
    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    faces.forEach(({ box }) => {
      const [x1, y1, x2, y2] = box
      const w = x2 - x1, h = y2 - y1
      // Main rect
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth   = 2
      ctx.strokeRect(x1, y1, w, h)
      // Fill
      ctx.fillStyle = 'rgba(59,130,246,0.06)'
      ctx.fillRect(x1, y1, w, h)
      // Corner accents
      const cs = 14
      ctx.strokeStyle = '#60a5fa'
      ctx.lineWidth   = 3
      ;[[x1,y1,1,1],[x2,y1,-1,1],[x1,y2,1,-1],[x2,y2,-1,-1]].forEach(([cx,cy,dx,dy]) => {
        ctx.beginPath()
        ctx.moveTo(cx + dx*cs, cy)
        ctx.lineTo(cx, cy)
        ctx.lineTo(cx, cy + dy*cs)
        ctx.stroke()
      })
    })
    setFaceCount(faces.length)
  }

  const captureAndScan = useCallback(async () => {
    if (isCapturing || !isLive || !selectedClass) return
    setIsCapturing(true)
    try {
      const blob = await getFrame()
      if (!blob) return

      // Live detection overlay
      const detectRes = await attendanceApi.detect(blob)
      drawBoxes(detectRes.data.faces || [])

      // Only mark if face found
      if (detectRes.data.count > 0) {
        const scanRes = await attendanceApi.scan(blob, selectedClass)
        const d = scanRes.data
        setResult(d)
        if (d.recognized && !d.already_marked) {
          setLog(prev => [{
            name:      d.student.name,
            class:     d.student.class_name,
            status:    d.status,
            time:      d.time_in,
            conf:      d.confidence,
            timestamp: new Date().toLocaleTimeString()
          }, ...prev.slice(0, 19)])
        }
      }
    } catch (e) {
      console.error('Scan error:', e)
    } finally {
      setIsCapturing(false)
    }
  }, [isCapturing, isLive, selectedClass])

  const resultColor = () => {
    if (!result?.recognized) return 'border-danger/30 bg-danger/5'
    if (result.already_marked)  return 'border-warning/30 bg-warning/5'
    if (result.status === 'on-time') return 'border-success/30 bg-success/5'
    return 'border-warning/30 bg-warning/5'
  }

  const resultIcon = () => {
    if (!result?.recognized) return <XCircle size={28} className="text-danger" />
    if (result.already_marked)  return <AlertTriangle size={28} className="text-warning" />
    if (result.status === 'on-time') return <CheckCircle size={28} className="text-success" />
    return <Clock size={28} className="text-warning" />
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-700 text-text">Face Scanner</h1>
          <p className="text-sm text-text-dim mt-0.5">YOLOv8 detection · InsightFace recognition</p>
        </div>
        <div className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium',
          isLive ? 'bg-success/10 border-success/20 text-success' : 'bg-muted/10 border-border text-text-dim'
        )}>
          <span className={clsx('w-2 h-2 rounded-full', isLive ? 'bg-success animate-pulse' : 'bg-muted')} />
          {isLive ? 'LIVE' : 'OFFLINE'}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Camera Panel */}
        <div className="col-span-3 space-y-3">
          <div className="card p-0 overflow-hidden">
            {/* Camera View */}
            <div className="relative bg-black aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted playsInline
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: 'cover' }}
              />
              {/* Scan line */}
              {isLive && <div className="scan-line" />}

              {/* Overlay when offline */}
              {!isLive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg">
                  <CameraOff size={40} className="text-muted" />
                  <p className="text-text-dim text-sm">Camera not started</p>
                </div>
              )}

              {/* Face count badge */}
              {isLive && (
                <div className="absolute top-3 left-3 bg-bg/80 backdrop-blur border border-border rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <Scan size={13} className="text-accent" />
                  <span className="text-xs font-mono text-text">
                    {faceCount > 0 ? `${faceCount} face${faceCount > 1 ? 's' : ''} detected` : 'Scanning...'}
                  </span>
                </div>
              )}

              {/* Processing indicator */}
              {isCapturing && (
                <div className="absolute top-3 right-3 bg-accent/20 border border-accent/30 rounded-lg px-3 py-1.5">
                  <RefreshCw size={12} className="text-accent animate-spin" />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-4 flex items-center gap-3 border-t border-border">
              {!isLive ? (
                <button onClick={startCamera} className="btn-primary flex-1 justify-center py-2.5">
                  <Camera size={16} /> Start Camera
                </button>
              ) : (
                <>
                  <button
                    onClick={captureAndScan}
                    disabled={isCapturing}
                    className="btn-primary flex-1 justify-center py-2.5 disabled:opacity-50"
                  >
                    {isCapturing
                      ? <><RefreshCw size={14} className="animate-spin" /> Scanning...</>
                      : <><Scan size={14} /> Capture & Mark</>
                    }
                  </button>
                  <button
                    onClick={() => setAutoScan(v => !v)}
                    className={clsx('btn px-4 py-2.5 border', autoScan
                      ? 'bg-success/15 border-success/30 text-success'
                      : 'bg-transparent border-border text-text-dim hover:text-text'
                    )}
                  >
                    {autoScan ? '⏸ Auto' : '▶ Auto'}
                  </button>
                  <button onClick={stopCamera} className="btn-ghost px-4 py-2.5">
                    <CameraOff size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 rounded-xl px-4 py-3 text-sm text-danger">
              <AlertTriangle size={15} /> {error}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="col-span-2 space-y-3">
          {/* Class Selector */}
          <div className="card">
            <p className="label">Scan Class</p>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="input"
            >
              {classes.map(c => (
                <option key={c.class_name} value={c.class_name}>{c.class_name}</option>
              ))}
            </select>
          </div>

          {/* Result Card */}
          {result && (
            <div className={clsx('card border animate-slide-up', resultColor())}>
              <div className="flex items-start gap-3">
                {resultIcon()}
                <div className="flex-1">
                  <p className="font-display font-600 text-text text-base">
                    {result.recognized ? result.student?.name : 'Unknown Face'}
                  </p>
                  <p className="text-xs text-text-dim mt-0.5">{result.message}</p>
                  {result.recognized && !result.already_marked && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className={clsx('badge', result.status === 'on-time' ? 'badge-success' : 'badge-warning')}>
                        {result.status === 'on-time' ? '✅ On Time' : '⏰ Late'}
                      </span>
                      <span className="badge-blue">{result.time_in}</span>
                      {result.confidence && (
                        <span className="badge-muted font-mono">{(result.confidence * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  )}
                  {result.already_marked && (
                    <span className="badge-warning mt-2 inline-flex">Already marked today</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Log */}
          <div className="card flex-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-display font-600 text-text">Today's Log</p>
              <span className="badge-blue">{log.length}</span>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {log.length === 0 && (
                <p className="text-xs text-text-dim text-center py-6">No scans yet</p>
              )}
              {log.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0 animate-fade-in">
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-600 flex-shrink-0">
                    {entry.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text truncate">{entry.name}</p>
                    <p className="text-xs text-text-dim">{entry.class}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={clsx('badge text-xs', entry.status === 'on-time' ? 'badge-success' : 'badge-warning')}>
                      {entry.status === 'on-time' ? 'On Time' : 'Late'}
                    </span>
                    <p className="text-xs text-text-dim font-mono mt-0.5">{entry.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
