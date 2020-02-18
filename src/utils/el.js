const entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
}

export function escapeHtml (string) {
  return String(string).replace(/[&<>"'`=/]/g, s => entityMap[s])
}

export function generateStatus ({
  degree, editing, warned, ignored,
  collapsed, unmapped, disabled, selected, focused, locked
}) {
  const classNames = []

  if (collapsed) classNames.push('collapsed')
  if (disabled) classNames.push('disabled')
  if (selected) classNames.push('selected')
  if (focused) classNames.push('focused')
  if (locked) classNames.push('locked')
  if (unmapped) classNames.push('unmapped')
  if (ignored) classNames.push('ignored')

  if (editing) classNames.push('editing')
  if (warned) classNames.push('warned')

  if (degree !== undefined) {
    classNames.push(degree === 270 || degree === 90 ? 'landscape' : 'portrait')
  }

  return classNames.join(' ')
}

export function offsetParents (node) {
  let offsetTop = 0
  let offsetLeft = 0

  if (node.offsetParent) {
    do {
      offsetTop += node.offsetTop - node.scrollTop
      offsetLeft += node.offsetLeft - node.scrollLeft
      node = node.offsetParent
    } while (node)
  }

  return [offsetTop, offsetLeft]
}
