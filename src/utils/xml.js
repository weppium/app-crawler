export function rotateXY (rect, screen) {
  const { top, left, right, bottom, width, height } = rect
  return {
    0: { top, left, width, height }, // normal
    270: { top: left, left: screen.width - bottom, width: height, height: width }, // left
    180: { top: screen.height - bottom, left: screen.width - right, width, height }, // upside bottom
    90: { top: screen.height - right, left: top, width: height, height: width } // right
  }[screen.degree]
}

export function getBounds (node, scale = 1) {
  if (!node || !node.attributes) return null

  if (node.attributes.bounds) {
    return parseBounds(node.attributes.bounds.nodeValue, scale)
  }

  if (node.attributes.width && node.attributes.height) {
    const width = Math.round(node.attributes.width.nodeValue * scale)
    const height = Math.round(node.attributes.height.nodeValue * scale)
    const top = Math.round(node.attributes.y.nodeValue * scale)
    const left = Math.round(node.attributes.x.nodeValue * scale)
    const bottom = Math.round(top + height * scale)
    const right = Math.round(left + width * scale)
    return { width, height, top, left, bottom, right }
  }

  return null
}

function parseBounds (bounds, scale) {
  bounds = bounds.split('][')
  bounds[0] = bounds[0].replace('[', '').split(',')
  bounds[1] = bounds[1].replace(']', '').split(',')

  const x1 = Math.round(bounds[0][0] * scale)
  const y1 = Math.round(bounds[0][1] * scale)
  const x2 = Math.round(bounds[1][0] * scale)
  const y2 = Math.round(bounds[1][1] * scale)

  return {
    top: y1,
    left: x1,
    right: x2,
    bottom: y2,
    width: x2 - x1,
    height: y2 - y1
  }
}
