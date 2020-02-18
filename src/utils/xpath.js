import XPath from 'xpath'
import { parseFromString } from './xml' // getBounds

const XCUI_ELEMENT_TYPES = [
  'ActivityIndicator', 'Alert', 'Any', 'Application', 'Browser', 'Button', 'Cell', 'CheckBox',
  'CollectionView', 'ColorWell', 'ComboBox', 'DatePicker', 'DecrementArrow', 'Dialog',
  'DisclosureTriangle', 'DockItem', 'Drawer', 'Grid', 'Group', 'Handle', 'HelpTag', 'Icon', 'Image',
  'IncrementArrow', 'Key', 'Keyboard', 'LayoutArea', 'LayoutItem', 'LevelIndicator', 'Link', 'Map',
  'Matte', 'Menu', 'MenuBar', 'MenuBarItem', 'MenuButton', 'MenuItem', 'NavigationBar', 'Other',
  'Outline', 'OutlineRow', 'PageIndicator', 'Picker', 'PickerWheel', 'PopUpButton', 'Popover',
  'ProgressIndicator', 'RadioButton', 'RadioGroup', 'RatingIndicator', 'RelevanceIndicator',
  'Ruler', 'RulerMarker', 'ScrollBar', 'ScrollView', 'SearchField', 'SecureTextField',
  'SegmentedControl', 'Sheet', 'Slider', 'SplitGroup', 'Splitter', 'StaticText', 'StatusBar',
  'StatusItem', 'Stepper', 'Switch', 'Tab', 'TabBar', 'TabGroup', 'Table', 'TableColumn',
  'TableRow', 'TextField', 'TextView', 'Timeline', 'Toggle', 'Toolbar', 'ToolbarButton',
  'ValueIndicator', 'WebView', 'Window', 'TouchBar'
]

const XPathResult = {
  ANY_TYPE: 0,
  ANY_UNORDERED_NODE_TYPE: 8,
  BOOLEAN_TYPE: 3,
  FIRST_ORDERED_NODE_TYPE: 9,
  NUMBER_TYPE: 1,
  ORDERED_NODE_ITERATOR_TYPE: 5,
  ORDERED_NODE_SNAPSHOT_TYPE: 7,
  STRING_TYPE: 2,
  UNORDERED_NODE_ITERATOR_TYPE: 4,
  UNORDERED_NODE_SNAPSHOT_TYPE: 6
}

// FIXME #document객체의 firstChild.tagName로 platform 구분할 수 있음 추후 XML_PLATFORM 삭제
let XML_PLATFORM = null

export function setXMLPlatform (platform) {
  console.debug('SET XML PLATFORM', platform)
  XML_PLATFORM = platform
}

export function findNode (opt) {
  // NOTE: v0.10.x 부터는 Androiod에서 standalone 모드의 xml을 수신하지 않음(하위 호환성 때문에 존재함)
  /*
  if (opt.pos) {
    return findNodeByPosition(opt.pos.x, opt.pos.y, opt.screen, opt.doc)
  }
  */

  if (opt.doc && opt.doc.children) {
    return findNodeByXPathFromDoc(opt.xpath, opt.doc, opt.standalone)
  }

  if (opt.xml && opt.xml.startsWith('<?xml')) {
    return findNodeByXPathFromXML(opt.xpath, opt.xml, opt.standalone)
  }

  if (opt.xpath) {
    return findNodeByXPath(opt.xpath)
  }

  return null
}

/**
 * Get an optimal XPath for a DOMNode
 * @param {Document} doc
 * @param {DOMNode} node
 * @param {array[string]} uniqueAttributes Attributes we know are unique (defaults to just 'id')
 */
function getOptimalXPath (doc, node, uniqueAttributes = ['id']) {
  try {
    // BASE CASE #1: If this isn't an element, we're above the root, return empty string
    if (!node.tagName || node.nodeType !== 1 || node.tagName === 'hierarchy') {
      return ''
    }

    // BASE CASE #2: If this node has a unique attribute, return an absolute XPath with that attribute
    for (const attrName of uniqueAttributes) {
      const attrValue = node.getAttribute(attrName)
      if (attrValue) {
        let xpath = `//${node.tagName || '*'}[@${attrName}="${attrValue}"]`
        let othersWithAttr

        // If the XPath does not parse, move to the next unique attribute
        try {
          othersWithAttr = XPath.select(xpath, doc)
        } catch (ign) {
          continue
        }

        // If the attribute isn't actually unique, get it's index too
        if (othersWithAttr.length > 1) {
          const index = othersWithAttr.indexOf(node)
          xpath = `(${xpath})[${index + 1}]`
        }
        return xpath
      }
    }

    const { parentNode } = node
    const isRoot = parentNode.tagName === 'hierarchy' || node.tagName === 'XCUIElementTypeApplication'

    // Get the relative xpath of this node using tagName
    let xpath = isRoot ? `//${node.tagName}` : `/${node.tagName}`

    // If this node has siblings of the same tagName, get the index of this node
    if (parentNode) {
      // Get the siblings
      const childNodes = [...parentNode.childNodes].filter(childNode => (
        childNode.nodeType === 1 && childNode.tagName === node.tagName
      ))

      // If there's more than one sibling, append the index
      if (childNodes.length > 1) {
        const index = childNodes.indexOf(node)
        xpath += `[${index + 1}]`
      }
    }

    // Make a recursive call to this nodes parents and prepend it to this xpath
    return getOptimalXPath(doc, parentNode, uniqueAttributes) + xpath
  } catch (ign) {
    // If there's an unexpected exception, abort and don't get an XPath
    return null
  }
}

function findNodeByXPath (xpath) {
  return `${xpath}`
}

export function getXPath (node, doc) {
  if (!node) return null

  const platform = doc.firstChild.tagName === 'hierarchy' ? 'android' : 'ios'
  const uniqueAttr = []
  switch (platform) {
    case 'android':
      // uniqueAttr.push('text');
      uniqueAttr.push('content-desc')
      uniqueAttr.push('resource-id')
      break

    case 'ios':
      uniqueAttr.push('id')
      uniqueAttr.push('name')
      // uniqueAttr.push('value');
      uniqueAttr.push('label')
      uniqueAttr.push('accessibility-id')
      break

    default: break
  }

  // Attributes on nodes that we know are unique to the node
  return getOptimalXPath(doc, node, uniqueAttr)
}

function findNodeByXPathFromXML (xpath, xml, isStandalone) {
  const doc = parseFromString(xml)
  return findNodeByXPathFromDoc(xpath, doc, isStandalone)
}

function findNodeByXPathFromDoc (xpath, doc, isStandalone) {
  const result = []
  const query = resolveXPath(xpath, isStandalone)

  try {
    const type = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
    const xpathResult = doc.evaluate(query, doc, null, type, null)
    const maxResults = 200
    let i = 0

    switch (xpathResult.resultType) {
      case XPathResult.UNORDERED_NODE_ITERATOR_TYPE: {
        let n = xpathResult.iterateNext()
        while (n && i < maxResults) {
          result.push({ node: n })
          n = xpathResult.iterateNext()
          i++
        }
        break
      }
      case xpathResult.ORDERED_NODE_SNAPSHOT_TYPE:
        for (i = 0; i < xpathResult.snapshotLength; ++i) {
          result.push({ node: xpathResult.snapshotItem(i) })
        }
        break
      default: break
    }
  } catch (err) {
    console.error(query, err)
  }

  if (result.length > 1) {
    console.warn('WTF? node is multiple', query)
  }

  return result.length ? result[0].node : null
}

// DELETEME standalone xml을 변환하여 사용하지 않게됨
function getDomNode (name, args, isStandalone) {
  if (args.indexOf('@') !== -1) {
    const arr = args.replace(/["']/g, '').split('=')
    const key = arr[0]
    const val = arr[1]
    args = `${key}='${val}'`
  }

  const nodeName = isStandalone ? 'node' : '*'
  if (name === '*') return `${nodeName}[${args}]`
  return `${nodeName}[@class='${name}'][${args}]`
}

export function resolveIosXPath (xpath, isStandalone) {
  // if (xpath.startsWith('/') || xpath.startsWith('(/')) return xpath;
  if (xpath.indexOf('XCUIElementType') !== -1) return xpath

  if (!isStandalone) {
    // xpath = xpath.split('/').map(el => (el ? `XCUIElementType${el}` : '')).join('/');
    const findElement = name => XCUI_ELEMENT_TYPES.find(el => name.split('[')[0] === el)
    xpath = xpath.split('/').map(el => (findElement(el) ? `XCUIElementType${el}` : el)).join('/')
  }

  // return `//${xpath}`;
  return xpath.startsWith('/') || xpath.startsWith('(/') ? xpath : `//${xpath}`
}

// TODO: 출력 방식 옵션화 => 풀네임, android. 및 widget. 생략
function resolveAndroidXPath (xpath, isStandalone) {
  // if (xpath.startsWith('/') || xpath.startsWith('(/')) return xpath;
  if (xpath.indexOf('android.') !== -1) return xpath

  xpath = xpath.split('/').map((node) => {
    if (!node) return ''
    const tag = node.split('[')[0].replace(/\//g, '')
    const name = tag === '*' ? tag : (tag.split('.').length > 1 && `android.${tag}`) || `android.widget.${tag}`
    const args = node.replace(/\[/, '|').replace(/\]/, '').split('|')[1] || ''
    return isStandalone ? getDomNode(name, args, isStandalone) : `${name}[${args.replace(/"/g, '\\"')}]`
  })

  return `//${xpath.join('/')}`
}

/**
 * @param {boolean} isStandalone - XMLViewer에서 사용할 것인지를 구분
 */
export function resolveXPath (xpath, isStandalone) {
  if (!xpath) return null
  switch (XML_PLATFORM) {
    case 'ios': return resolveIosXPath(xpath, isStandalone)
    case 'android': return resolveAndroidXPath(xpath, isStandalone)
    default: break
  }
}

export function shortenXPath (xpath = '') {
  if (!xpath.startsWith('/') && !xpath.startsWith('(/')) return `//${xpath}`
  switch (XML_PLATFORM) {
    case 'ios':
      return xpath.split('/').map(node => (node ? node.replace(/XCUIElementType/g, '') : '')).join('/')
    case 'android':
      return xpath.split('/').map(node => (node ? node.replace(/android\.(widget\.|view\.)/g, '') : '')).join('/')
    default: break
  }
}

/**
 * Platform별 Interection 가능한 요소 검사
 * @param {*} domNode {DOMNode}
 * @param {boolean} retry - 검색 확장 flag
 */
/*
function isResponsible (node, retry) {
  const { attributes } = node
  if (!getBounds(node)
  // || attributes.enabled && attributes.enabled.nodeValue === 'false'
  // || attributes.visible && attributes.visible.nodeValue === 'false'
  ) {
    return false
  }

  if (retry) {
    // android 확장 검색
    return attributes.enabled && attributes.enabled.nodeValue === 'true'
  }

  // andriod
  return (attributes.clickable && attributes.clickable.nodeValue === 'true') ||
    // ios
    (attributes.type && !attributes.type.nodeValue.match(/Application|Window|Other/))
}

function findNodeByPosition (x, y, screen, doc) {
  const find = (retry) => {
    const elements = []
    $(doc).find('*').each((i, node) => {
      const responsible = isResponsible(node, retry)
      if (!responsible) {
        // console.log(node);
        return true
      }

      const offset = getBounds(node)
      const height = (screen.degree === 90 || screen.degree === 270) ? screen.width : screen.height

      // filter out of canvas
      if (offset.width === 0 ||
        offset.height === 0 ||
        offset.top + offset.height < 0 ||
        offset.top > height) {
        // console.log(node.tagName, offset);
        return true
      }

      if (offset.top < y &&
        offset.left < x &&
        offset.top + offset.height > y &&
        offset.left + offset.width > x) {
        // console.log(node.tagName, offset);
        elements.push(node)
      }
    })
    return elements
  }

  let results = find()
  // FIXED ISSUE #96190
  if (!results.length) {
    results = find(true)
  }

  // console.info(x, y, results);
  return results[results.length - 1] || null
}
*/

export function getPathByPosition (x, y, screen, doc) {
  const node = findNode({ pos: { x, y }, screen, doc })
  if (node) {
    const xpath = getXPath(node, doc)
    return { data: xpath, node }
  }
  return null
}
