import {useRef, useState, useEffect } from 'react'
import './App.css'

const CHARS = "@#S%?*+;:,.' "

export default function App(){
  const videoRef = useRef(null)
  const preRef = useRef(null)
  const displayCanvasRef = useRef(null)
  const imageRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const [recording, setRecording] = useState(false)
  const [contrast, setContrast] = useState(1.15)
  const [zoom, setZoom] = useState(1)
  const [invert, setInvert] = useState(false)
  const [color, setColor] = useState(false)
  const [usingImage, setUsingImage] = useState(false)
  const [message, setMessage] = useState('')


  const settings = useRef({ contrast, zoom, invert, color, usingImage})
  useEffect(() => {
    settings.current = {contrast, zoom, invert, color, usingImage}
  }, [contrast, zoom, invert, color, usingImage])

  useEffect(() =>{
    const handleKeyDown = (e) => {
      switch(e.code){
        case 'Space':
          e.preventDefault()
          color ? copyFrame() : copyAsText()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return()=>window.removeEventListener('keydown', handleKeyDown)
  }, [color])
  useEffect(() => {
    const video = videoRef.current
    const pre = preRef.current
    const displayCanvas = displayCanvasRef.current
    const displayCtx = displayCanvas.getContext('2d')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', {willReadFrequently: true})

    const m = document.createElement('canvas').getContext('2d')
    m.font = '8px monospace'
    const cellWidth = m.measureText('@').width
    const cellHeight = 8

    let handle
    const loop = () => {
        const {contrast, zoom, invert, color, usingImage} = settings.current
        const source = usingImage ? imageRef.current : video
        const srcWidth = usingImage ? source?.naturalWidth : video.videoWidth
        const srcHeight = usingImage ? source?.naturalHeight : video.videoHeight
        const ready = usingImage ? !!source : (video.videoWidth && !video.paused)

          if(ready){
          const stage = pre.parentElement
          const scale = Math.min(
            (stage.clientWidth * zoom) / srcWidth,
            (stage.clientHeight * zoom) / srcHeight
          )
          const columns = Math.max(1, Math.floor((srcWidth * scale) / cellWidth))
          const rows = Math.max(1, Math.floor((srcHeight * scale) / cellHeight))
          const contentWidth = columns * cellWidth
          const contentHeight = rows * cellHeight

          const fitScale = Math.min(stage.clientWidth / contentWidth, stage.clientHeight/ contentHeight)
          const transform = `scale(${fitScale})`

          pre.style.transform = transform
          displayCanvas.style.transform = transform

          canvas.width = columns
          canvas.height = rows
          // flip camera
          ctx.save()
          if(video.srcObject){
            ctx.translate(columns, 0)
            ctx.scale(-1, 1)
          }
          ctx.drawImage(source, 0, 0, columns, rows)
          ctx.restore()
          const {data} = ctx.getImageData(0,0,columns, rows)
          if(color){
            pre.style.display = 'none'
            displayCanvas.style.display = 'block'
            displayCanvas.width = columns * cellWidth
            displayCanvas.height = rows *cellHeight
            displayCtx.font = '8px monospace'
            displayCtx.textBaseline = 'top'
            displayCtx.fillStyle = '#0a0a0a'
            displayCtx.fillRect(0,0, displayCanvas.width, displayCanvas.height)

            for(let y = 0; y < rows; y++){
              for(let x = 0; x < columns ; x++){
                const i = (y * columns + x) * 4
                const r = data[i], g = data[i +1], b = data[i+2]
                let gray = 0.299 *r + 0.587 *g + 0.114 * b
                gray = Math.min(255, Math.max(0, (gray -128) * contrast + 128))
                const index = Math.floor(((255 - gray) * (CHARS.length -1)) / 255)
                const ir = invert ? 255 - r : r;
                const ig = invert ? 255 - g : g;
                const ib = invert ? 255 - b : b;
                displayCtx.fillStyle = `rgb(${ir}, ${ig}, ${ib})`
                displayCtx.fillText(CHARS[index], x * cellWidth, y * cellHeight)
              }
            }
          } else{
            pre.style.display = 'block'
            displayCanvas.style.display = 'none'
            displayCanvas.width = columns * cellWidth
            displayCanvas.height = rows *cellHeight
            displayCtx.font = '8px monospace'
            displayCtx.textBaseline = 'top'
            displayCtx.fillStyle = '#0a0a0a'
            displayCtx.fillRect(0,0, displayCanvas.width, displayCanvas.height)
            displayCtx.fillStyle = '#fff'
            let out = ''
            for(let y = 0;y < rows; y++){
              for(let x = 0; x < columns; x++){
                const i = (y * columns +x) * 4
                let gray = 0.299 * data[i] + 0.587 * data [i + 1] + 0.114 * data[i +2]
                gray = Math.min(255, Math.max(0, (gray - 128) * contrast + 128))
                if (invert) gray = 255 - gray
                const chr = CHARS[Math.floor(((255 - gray) * (CHARS.length-1)) / 255)] 
                out += chr
                displayCtx.fillText(chr, x * cellWidth, y * cellHeight)
              }
              out += '\n'
            }
            pre.textContent = out
          }
        }
      handle = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(handle)
  }, [])
  const stopCamera = () => {
    const video = videoRef.current
    video.srcObject?.getTracks().forEach((t) => t.stop())
    video.srcObject = null
  }
  const loadMedia = (e) =>{
    const file = e.target.files[0]
    if(!file) return
    if(file.type.startsWith('image/')){
      stopCamera()
      videoRef.current.pause()
      const img = new Image()
      img.onload = () =>{
        imageRef.current = img
        setUsingImage(true)
      }
      img.src = URL.createObjectURL(file)
    } else if(file.type.startsWith('video/')){
      setUsingImage(false)
      stopCamera()
      const video = videoRef.current
      video.src = URL.createObjectURL(file)
      video.play()
    }
  }
  const toggleCamera = async ()=> {
    const video = videoRef.current
    if(video.srcObject) return stopCamera()
    setUsingImage(false)
    video.removeAttribute('src')
    video.srcObject = await navigator.mediaDevices.getUserMedia({video: true})
    video.play()
  }
  const togglePlay  = () => {
    const video = videoRef.current
    video.paused ? video.play()  : video.pause()
  }
  const copyAsText = ()  => {
      if(color) return;
        navigator.clipboard.writeText(preRef.current.textContent)
        showMessage('Copied as Text!')
  }
  const copyFrame = ()  => {
    if(!color) return;
      displayCanvasRef.current.toBlob((blob) => {
        navigator.clipboard.write([new ClipboardItem({'image/png' : blob})])
      })
      showMessage('Frame Copied!')
  }
  const startRecording = () => {
    const stream = displayCanvasRef.current.captureStream(60)
    const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ? 'video/mp4;codecs=avc1' : 'video/mp4'
    const recorder = new MediaRecorder(stream, {mimeType, videoBitsPerSecond: 32_000_000})
    recordedChunksRef.current = []
    recorder.ondataavailable = (e) => {
      if(e.data.size > 0) recordedChunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob  = new Blob(recordedChunksRef.current, {type: 'video/mp4'})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `wascii-recording-${Date.now()}.mp4`
      a.click()
      URL.revokeObjectURL(url)
    }
    recorder.start()
    mediaRecorderRef.current = recorder
    setRecording(true)
  }
  const stopRecording = () =>{
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }
  const showMessage = (text) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 2000)
  }
  return (
    <div className='app'>
      <div className='controls'>
        <label className='file-button'>
          Load Image/Video
          <input type='file' accept='video/*, image/*' onChange={loadMedia} style={{display:'none'}}/>
        </label>
        <button onClick={toggleCamera}>Camera</button>
        <button onClick={togglePlay}>Play / Pause</button>
        {color ? <button onClick={copyFrame}>Copy Image</button>
        : <button onClick={copyAsText}>Copy as Text</button>
        }
        <button onClick={recording ? stopRecording : startRecording}>
          {recording ? 'Stop Recording' : 'Record'}
        </button>
        <label>
          <input type='checkbox' checked={color} onChange={(e)=>setColor(e.target.checked)} /> Color
        </label>
        <label>
          <input type='checkbox' checked={invert} onChange={(e)=>setInvert(e.target.checked)} /> Invert
        </label>
        <label>
          Contrast{' '}
          <input type='range' min='0.1' max='2' step='0.05' value={contrast}
          onChange={(e) => setContrast(+e.target.value)} />
        </label>
        <label>
          Zoom{' '}
          <input type='range' min='0.5' max='2' step='0.1' value={zoom}
          onChange={(e) => setZoom(+e.target.value)} />
        </label>
        {message && <div className='toast'>{message}</div>}
      </div>
      <div className='stage'>
        <pre ref={preRef} />
        <canvas ref={displayCanvasRef} />
      </div>
      <video ref={videoRef} muted loop playsInline style={{display: 'none'}} />
    </div>
  )
}