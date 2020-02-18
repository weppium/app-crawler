const useCDATA = false
const callFunctions = false
const hasOwnProperty = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

// Convert object to XML
function toXML (object, xmlDoc, doc) {
  // visible값이 false로 오는 경우 필터링
  if (object.isVisible === '0') return xmlDoc

  const node = doc.createElement(`${object.type}`)
  xmlDoc.appendChild(node)

  for (const property in object) {
    if (!hasOwnProperty(object, property) || property === 'frame') continue

    // Arrays
    if (Object.prototype.toString.call(object[property]) === '[object Array]') {
      for (let i = 0; i < object[property].length; i++) {
        toXML(object[property][i], node, doc)
      }

    // JSON-type objects with properties
    } else if (Object.prototype.toString.call(object[property]) === '[object Object]') {
      const data = object[property]
      node.setAttribute('bounds', toString(data))
      node.setAttribute('x', data.x)
      node.setAttribute('y', data.y)
      node.setAttribute('width', data.width)
      node.setAttribute('height', data.height)

    // Everything else
    } else {
      const value = toString(object[property])
      const attribute = {
        isVisible: 'visible',
        isEnabled: 'enabled',
        rawIdentifier: 'id',
        type: 'class'
      }[property] || property

      if (value !== 'AX error -25205') {
        node.setAttribute(attribute, toString(object[property]))
      }
    }
  }

  return xmlDoc
}

// Convert anything into a valid XML string representation
function toString (data) {
  // Recursive function used to handle nested functions
  const functionHelper = (func) => {
    if (Object.prototype.toString.call(func) === '[object Function]') {
      return functionHelper(func())
    }
    return data
  }

  // Convert map
  if (Object.prototype.toString.call(data) === '[object Function]') {
    if (callFunctions) {
      data = functionHelper(data())
    } else {
      data = data.toString()
    }
  // Empty objects
  } else if (Object.prototype.toString.call(data) === '[object Object]') {
    if (Object.keys(data).length === 0) {
      data = ''
    } else {
      data = `[${data.x},${data.y}][${data.width + data.x},${data.height + data.y}]`
    }
  }

  // Cast data to string
  if (typeof data !== 'string') {
    data = (data === null || typeof data === 'undefined') ? '' : data.toString()
  }

  if (useCDATA) {
    data = `<![CDATA[${data.replace(/]]>/gm, ']]]]><![CDATA[>')}]]>`
  } else {
    if (data === '1') data = 'true'
    if (data === '0') data = 'false'

    // Escape illegal XML characters
    data = data.replace(/&/gm, '&amp;')
      .replace(/</gm, '&lt;')
      .replace(/>/gm, '&gt;')
      .replace(/"/gm, '&quot;')
      .replace(/'/gm, '&apos;')
  }

  return data
}

function formatXML (xml) {
  const tab = '    '
  let out = ''
  let indent = -1
  let inClosingTag = false

  const dent = (no) => {
    out += '\n'
    for (let i = 0; i < no; i++) out += tab
  }

  for (let i = 0; i < xml.length; i++) {
    const c = xml.charAt(i)
    if (c === '<') {
      // handle </
      if (xml.charAt(i + 1) === '/') {
        inClosingTag = true
        dent(--indent)
      }
      out += c
    } else if (c === '>') {
      out += c
      // handle />
      if (xml.charAt(i - 1) === '/') {
        out += '\n'
      } else if (!inClosingTag) {
        dent(++indent)
      } else {
        out += '\n'
        inClosingTag = false
      }
    } else {
      out += c
    }
  }
  return out
}

export default function js2xml (root, data) {
  if (typeof data !== 'object') return ''

  const doc = document.implementation.createDocument(null, root)
  const prefix = '<?xml version="1.0" encoding="utf-8"?>'
  const xmlDoc = toXML(data, doc.documentElement, doc)
  if (!xmlDoc.innerHTML) return ''

  return formatXML(prefix + xmlDoc.innerHTML)
}
