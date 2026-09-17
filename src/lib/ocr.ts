export interface OCRProgress {
  status: string
  progress: number
}

/**
 * Compresses and formats photos into a 1:1 square aspect ratio canvas.
 * Zooms out and letterboxes non-square images with transparent background without cropping any text/content.
 */
export function compressImageBase64(
  base64Data: string,
  maxWidth = 1400,
  maxHeight = 1400,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve) => {
    if (!base64Data || !base64Data.startsWith("data:image")) {
      return resolve(base64Data)
    }

    const img = new Image()
    if (base64Data.startsWith("http")) {
      img.crossOrigin = "anonymous"
    }
    img.onload = () => {
      let origWidth = img.width
      let origHeight = img.height

      let scaledWidth = origWidth
      let scaledHeight = origHeight

      if (scaledWidth > maxWidth || scaledHeight > maxHeight) {
        if (scaledWidth > scaledHeight) {
          scaledHeight = Math.round((scaledHeight * maxWidth) / scaledWidth)
          scaledWidth = maxWidth
        } else {
          scaledWidth = Math.round((scaledWidth * maxHeight) / scaledHeight)
          scaledHeight = maxHeight
        }
      }

      const canvas = document.createElement("canvas")
      canvas.width = scaledWidth
      canvas.height = scaledHeight
      const ctx = canvas.getContext("2d")

      if (!ctx) return resolve(base64Data)

      // Solid white background for clean receipt contrast & small JPEG payload
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, scaledWidth, scaledHeight)

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight)

      const compressedBase64 = canvas.toDataURL("image/jpeg", quality)
      resolve(compressedBase64)
    }
    img.onerror = () => {
      console.warn("Image load error during compression, resolving raw base64")
      resolve(base64Data)
    }
    img.src = base64Data
  })
}

/**
 * Helper to rotate a base64 image cleanly with JPEG output
 */
export function rotateImageBase64(base64Data: string, degrees: number): Promise<string> {
  return new Promise((resolve) => {
    if (degrees === 0) return resolve(base64Data)

    const img = new Image()
    if (base64Data.startsWith("http")) {
      img.crossOrigin = "anonymous"
    }
    img.onload = () => {
      let rotatedW = img.width
      let rotatedH = img.height

      if (degrees === 90 || degrees === 270) {
        rotatedW = img.height
        rotatedH = img.width
      }

      const canvas = document.createElement("canvas")
      canvas.width = rotatedW
      canvas.height = rotatedH
      const ctx = canvas.getContext("2d")
      if (!ctx) return resolve(base64Data)

      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, rotatedW, rotatedH)

      ctx.translate(rotatedW / 2, rotatedH / 2)
      ctx.rotate((degrees * Math.PI) / 180)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)

      resolve(canvas.toDataURL("image/jpeg", 0.85))
    }
    img.onerror = () => resolve(base64Data)
    img.src = base64Data
  })
}
