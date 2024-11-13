"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Card } from "@/components/ui/card"
import { Download, Play, Pause, RefreshCw, Film } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HexColorPicker } from "react-colorful"

// WebGL shader for enhanced gradient generation
const fragmentShader = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_noise_amount;
  uniform float u_blur_amount;
  uniform float u_distortion_x;
  uniform float u_distortion_y;
  uniform float u_distortion_scale;
  uniform vec3 u_colors[10];
  uniform int u_color_count;
  uniform int u_pattern;

  // Pseudo-random function
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  // Noise function
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  vec3 pattern0(vec2 st, float t) {
    float dist = length(st) + noise(st * 3.0 + t) * u_noise_amount;
    return vec3(dist);
  }

  vec3 pattern1(vec2 st, float t) {
    float angle = atan(st.y, st.x);
    float radius = length(st);
    float dist = sin(angle * 5.0 + t) * 0.5 + 0.5;
    return vec3(dist * radius);
  }

  vec3 pattern2(vec2 st, float t) {
    vec2 grid = fract(st * 5.0);
    float dist = length(grid - 0.5);
    return vec3(smoothstep(0.4, 0.5, dist));
  }

  vec3 pattern3(vec2 st, float t) {
    return vec3(sin(st.x * 10.0 + t) * cos(st.y * 10.0 + t) * 0.5 + 0.5);
  }

  vec3 pattern4(vec2 st, float t) {
    float d = length(st);
    vec3 color = vec3(sin(d * 10.0 - t), sin(d * 20.0 - t), sin(d * 30.0 - t));
    return color * 0.5 + 0.5;
  }

  vec3 pattern5(vec2 st, float t) {
    vec2 q = vec2(0.0);
    q.x = noise(st + t);
    q.y = noise(st + 1.0);
    vec2 r = vec2(0.0);
    r.x = noise(st + 1.0 * q + vec2(1.7, 9.2) + 0.15 * t);
    r.y = noise(st + 1.0 * q + vec2(8.3, 2.8) + 0.126 * t);
    return vec3(noise(st + 1.0 * r));
  }

  void main() {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    vec2 pos = st * 2.0 - 1.0;
    
    // Apply distortion
    pos.x += noise(pos * u_distortion_scale) * u_distortion_x;
    pos.y += noise(pos * u_distortion_scale) * u_distortion_y;
    
    // Animated gradient
    float t = u_time * 0.2;
    vec3 pattern;
    if (u_pattern == 0) pattern = pattern0(pos, t);
    else if (u_pattern == 1) pattern = pattern1(pos, t);
    else if (u_pattern == 2) pattern = pattern2(pos, t);
    else if (u_pattern == 3) pattern = pattern3(pos, t);
    else if (u_pattern == 4) pattern = pattern4(pos, t);
    else pattern = pattern5(pos, t);
    
    // Color mixing
    vec3 color = u_colors[0];
    for (int i = 1; i < 10; i++) {
      if (i >= u_color_count) break;
      float mixFactor = float(i) / float(u_color_count - 1);
      color = mix(color, u_colors[i], smoothstep(mixFactor - 0.1, mixFactor + 0.1, pattern.x));
    }
    
    // Add noise grain
    float grain = random(pos + t) * u_noise_amount * 0.15;
    color += grain;
    
    // Blur effect
    float blur = u_blur_amount;
    color = mix(color, vec3(0.5), blur * 0.5);
    
    gl_FragColor = vec4(color, 1.0);
  }
`

export default function Component() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [noiseAmount, setNoiseAmount] = useState(0.5)
  const [blurAmount, setBlurAmount] = useState(0.2)
  const [distortionX, setDistortionX] = useState(0.3)
  const [distortionY, setDistortionY] = useState(0.3)
  const [distortionScale, setDistortionScale] = useState(5)
  const [colorCount, setColorCount] = useState(3)
  const [colors, setColors] = useState<string[]>(Array(10).fill(0).map(() => `#${Math.floor(Math.random()*16777215).toString(16)}`))
  const [pattern, setPattern] = useState("0")
  const [activeColorIndex, setActiveColorIndex] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl')
    if (!gl) return

    // Create shader program
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vertexShader, `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `)
    gl.compileShader(vertexShader)

    const fragShader = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fragShader, fragmentShader)
    gl.compileShader(fragShader)

    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragShader)
    gl.linkProgram(program)
    gl.useProgram(program)

    // Set up buffers
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      1, -1, 1, 1, -1, 1
    ]), gl.STATIC_DRAW)

    const positionLocation = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    // Get uniform locations
    const uniforms = {
      time: gl.getUniformLocation(program, 'u_time'),
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      noiseAmount: gl.getUniformLocation(program, 'u_noise_amount'),
      blurAmount: gl.getUniformLocation(program, 'u_blur_amount'),
      distortionX: gl.getUniformLocation(program, 'u_distortion_x'),
      distortionY: gl.getUniformLocation(program, 'u_distortion_y'),
      distortionScale: gl.getUniformLocation(program, 'u_distortion_scale'),
      colors: gl.getUniformLocation(program, 'u_colors'),
      colorCount: gl.getUniformLocation(program, 'u_color_count'),
      pattern: gl.getUniformLocation(program, 'u_pattern')
    }

    let startTime = Date.now()
    let animationFrame: number

    const render = () => {
      if (!isPlaying) return
      const time = (Date.now() - startTime) / 1000
      gl.uniform1f(uniforms.time, time)
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
      gl.uniform1f(uniforms.noiseAmount, noiseAmount)
      gl.uniform1f(uniforms.blurAmount, blurAmount)
      gl.uniform1f(uniforms.distortionX, distortionX)
      gl.uniform1f(uniforms.distortionY, distortionY)
      gl.uniform1f(uniforms.distortionScale, distortionScale)
      gl.uniform3fv(uniforms.colors, colors.map(c => {
        const r = parseInt(c.slice(1, 3), 16) / 255
        const g = parseInt(c.slice(3, 5), 16) / 255
        const b = parseInt(c.slice(5, 7), 16) / 255
        return [r, g, b]
      }).flat())
      gl.uniform1i(uniforms.colorCount, colorCount)
      gl.uniform1i(uniforms.pattern, parseInt(pattern))
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      animationFrame = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [isPlaying, noiseAmount, blurAmount, distortionX, distortionY, distortionScale, colors, colorCount, pattern])

  const saveAsPNG = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'gradient-art.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const saveAsMP4 = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const stream = canvas.captureStream(30)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    const chunks: Blob[] = []

    recorder.ondataavailable = (e) => chunks.push(e.data)
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const videoBuffer = await blob.arrayBuffer()
      const mp4Buffer = await window.ffmpeg.transcode(new Uint8Array(videoBuffer), 'webm', 'mp4')
      const mp4Blob = new Blob([mp4Buffer], { type: 'video/mp4' })
      const url = URL.createObjectURL(mp4Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'gradient-art.mp4'
      link.click()
    }

    recorder.start()
    setTimeout(() => recorder.stop(), 5000) // Record for 5 seconds
  }

  const regenerateColors = () => {
    setColors(Array(10).fill(0).map(() => `#${Math.floor(Math.random()*16777215).toString(16)}`))
  }

  return (
    <Card className="p-6 space-y-6">
      <canvas
        ref={canvasRef}
        width={512}
        height={512}
        className="w-full aspect-square rounded-lg shadow-lg"
      />
      
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <Button onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button onClick={regenerateColors}>
            <RefreshCw className="w-4 h-4 mr-2" />
            New Colors
          </Button>
          <Button onClick={saveAsPNG}>
            <Download className="w-4 h-4 mr-2" />
            Save PNG
          </Button>
          <Button onClick={saveAsMP4}>
            <Film className="w-4 h-4 mr-2" />
            Save MP4
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Pattern</label>
          <Select value={pattern} onValueChange={setPattern}>
            <SelectTrigger>
              <SelectValue placeholder="Select a pattern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Radial Noise</SelectItem>
              <SelectItem value="1">Spiral</SelectItem>
              <SelectItem value="2">Grid</SelectItem>
              <SelectItem value="3">Waves</SelectItem>
              <SelectItem value="4">Concentric Rings</SelectItem>
              <SelectItem value="5">Turbulence</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Noise Amount</label>
          <Slider
            value={[noiseAmount]}
            onValueChange={([value]) => setNoiseAmount(value)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Blur Amount</label>
          <Slider
            value={[blurAmount]}
            onValueChange={([value]) => setBlurAmount(value)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Distortion X</label>
          <Slider
            value={[distortionX]}
            onValueChange={([value]) => setDistortionX(value)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Distortion Y</label>
          <Slider
            value={[distortionY]}
            onValueChange={([value]) => setDistortionY(value)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Distortion Scale</label>
          <Slider
            value={[distortionScale]}
            onValueChange={([value]) => setDistortionScale(value)}
            min={1}
            max={20}
            step={0.1}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Color Count</label>
          <Slider
            value={[colorCount]}
            onValueChange={([value]) => setColorCount(Math.round(value))}
            min={2}
            max={10}
            step={1}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Colors</label>
          <div className="flex flex-wrap gap-2">
            {colors.slice(0, colorCount).map((color, index) => (
              <button
                key={index}
                className={`w-8 h-8 rounded-full ${index === activeColorIndex ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setActiveColorIndex(index)}
              />
            ))}
          </div>
          <HexColorPicker
            color={colors[activeColorIndex]}
            onChange={(color) => {
              const newColors = [...colors]
              newColors[activeColorIndex] = color
              setColors(newColors)
            }}
          />
        </div>
      </div>
    </Card>
  )
}