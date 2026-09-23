/**
 * Tailwind v4 colors come as oklab()/oklch().
 * html2canvas cannot parse those, so we turn them into rgb()/hex.
 */

let canvasCtx

function getCanvasCtx() {
  if (!canvasCtx) {
    canvasCtx = document.createElement('canvas').getContext('2d')
  }
  return canvasCtx
}

/** Replace oklab/oklch inside a CSS value. Leave normal rgb/hex alone. */
export function sanitizeCssValue(value) {
  if (!value || typeof value !== 'string') return value
  if (!/(?:oklab|oklch|lab|lch|color)\(/i.test(value)) return value
  return value.replace(/(?:oklab|oklch|lab|lch|color)\([^()]*\)/gi, (fn) =>
    colorFnToRgb(fn),
  )
}

function colorFnToRgb(fn) {
  try {
    const ctx = getCanvasCtx()
    ctx.fillStyle = '#000000'
    ctx.fillStyle = fn
    const parsed = ctx.fillStyle
    if (parsed && !/(?:oklab|oklch|lab|lch|color)\(/i.test(parsed)) {
      return parsed
    }
  } catch {
    // canvas does not understand this color — fall through
  }

  const converted = convertOklabFamily(fn)
  return converted || '#111827'
}

function convertOklabFamily(fn) {
  const match = fn.trim().match(/^(oklab|oklch)\((.+)\)$/i)
  if (!match) return null

  const kind = match[1].toLowerCase()
  const inner = match[2]
  const [main, alphaRaw] = inner.split('/').map((part) => part.trim())
  const parts = main.split(/\s+/)
  const alpha = alphaRaw ? cssNumber(alphaRaw, 1) : 1

  let L
  let a
  let b

  if (kind === 'oklab') {
    L = cssNumber(parts[0], 1)
    a = cssNumber(parts[1], 0.4)
    b = cssNumber(parts[2], 0.4)
  } else {
    L = cssNumber(parts[0], 1)
    const C = cssNumber(parts[1], 0.4)
    const H = parseFloat(parts[2]) || 0
    const rad = (H * Math.PI) / 180
    a = C * Math.cos(rad)
    b = C * Math.sin(rad)
  }

  const [r, g, bl] = oklabToSrgb(L, a, b)
  if (alpha < 1) return `rgba(${r}, ${g}, ${bl}, ${alpha})`
  return `rgb(${r}, ${g}, ${bl})`
}

function cssNumber(token, percentBase) {
  if (!token || token === 'none') return 0
  const trimmed = token.trim()
  if (trimmed.endsWith('%')) {
    return ((parseFloat(trimmed) || 0) / 100) * percentBase
  }
  return parseFloat(trimmed) || 0
}

function oklabToSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  return [toByte(r), toByte(g), toByte(bl)]
}

function toByte(channel) {
  const x =
    channel <= 0.0031308
      ? 12.92 * channel
      : 1.055 * Math.pow(Math.max(channel, 0), 1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, x)) * 255)
}

/**
 * Copy live computed styles onto the html2canvas clone,
 * with oklab already converted, then drop page stylesheets
 * so html2canvas never reads Tailwind colors.
 */
export function prepareCloneForHtml2Canvas(sourceRoot, clonedDoc, clonedRoot) {
  const sourceNodes = [sourceRoot, ...sourceRoot.querySelectorAll('*')]
  const cloneNodes = [clonedRoot, ...clonedRoot.querySelectorAll('*')]
  const count = Math.min(sourceNodes.length, cloneNodes.length)

  for (let i = 0; i < count; i += 1) {
    copySafeStyle(sourceNodes[i], cloneNodes[i])
  }

  clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    node.remove()
  })

  if (clonedDoc.body) {
    clonedDoc.body.style.background = '#ffffff'
    clonedDoc.body.style.color = '#111827'
  }
}

function copySafeStyle(source, clone) {
  const computed = window.getComputedStyle(source)

  for (let i = 0; i < computed.length; i += 1) {
    const prop = computed[i]
    const value = sanitizeCssValue(computed.getPropertyValue(prop))
    clone.style.setProperty(prop, value)
  }

  clone.style.boxShadow = 'none'
  clone.removeAttribute('class')
}
