import XPath from 'xpath'
import { DOMParser } from 'xmldom'
import CrawlerBase from '../crawler'

const { XPathResult } = XPath

/**
 * SPA 모드
 * - URL 기반 아님
 * - body.innerHTML 변화 감지
 * - driver에 의한 action input
 * - 화면에 보이지 않는 상태이면 자동으로 스크롤
 * - 인풋 이벤트에 의해 만들어진 상황을 pre condition으로 저장
 */
export default class SPACrawler extends CrawlerBase {
  insertXPath (parent, child, doc) {
    if (!child.tagName) return null

    // child.xpath = this.getOptimalXPath(child, doc)
    // scan and check index path for once and only once
    let currentTypeCount = `${child.tagName}_count`
    if (!parent[currentTypeCount]) {
      if (parent.childNodes) {
        for (let i = 0; i < parent.childNodes.length; i++) {
          const children = parent.childNodes[i]
          currentTypeCount = `${children.tagName}_count`
          if (!parent[currentTypeCount]) {
            parent[currentTypeCount] = 1
          } else {
            parent[currentTypeCount]++
          }
          if (children) {
            children.pathInParent = parent[currentTypeCount]
          }
        }
      } else {
        parent.pathInParent = 1
      }
    }

    const currentIndex = child.pathInParent
    const prefixXPath = parent.xpath ? `${parent.xpath}/` : '//body/'
    child.xpath = `${prefixXPath}${child.tagName}[${currentIndex}]`
    // console.log(child.xpath)
    this.getOptimalXPath(child, doc)
    // console.log()
  }

  /**
   * Insert an optimal XPath for a DOMNode
   * @param {DOMNode} node
   * @param {Document} doc
   * @param {array[string]} uniqueAttributes Attributes we know are unique (defaults to just 'id')
   */
  getOptimalXPath (node, doc, uniqueAttributes = ['id', 'href', 'src', 'title', 'type', 'class']) {
    try {
      // BASE CASE #1: If this isn't an element, we're above the root, return empty string
      if (!node.tagName || node.nodeType !== 1 || node.implementation) {
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
      const isRoot = parentNode.implementation

      // Get the relative xpath of this node using tagName
      let xpath = isRoot ? '//body' : `/${node.tagName}`

      // If this node has siblings of the same tagName, get the index of this node
      if (parentNode) {
        // Get the siblings
        const childNodes = Array.from(parentNode.childNodes).filter(childNode => (
          childNode.nodeType === 1 && childNode.tagName === node.tagName
        ))

        // If there's more than one sibling, append the index
        if (childNodes.length > 1) {
          const index = childNodes.indexOf(node)
          xpath += `[${index + 1}]`
        }
      }

      // Make a recursive call to this nodes parents and prepend it to this xpath
      xpath = this.getOptimalXPath(parentNode, doc, uniqueAttributes) + xpath
      console.log(xpath)
      return xpath
    } catch (ign) {
      console.error(ign)
      // If there's an unexpected exception, abort and don't get an XPath
      return null
    }
  }

  async setPrecondition (precondition) {
    const { newCommandTimeout } = this.config
    for (const action of precondition) {
      await this.executeAction(action, true)
      await this.driver.sleep(newCommandTimeout * 100)
    }
  }

  async performAction (node) {
    const { actions } = node
    const { currentAction } = this
    let action = null

    for (const candidate of actions) {
      // console.log('candidate', candidate)
      if (!candidate.isTriggered) {
        candidate.isTriggered = true

        /** log and only log in the current progress */
        this.currentAction = candidate
        this.currentAction.checkInterval()
        this.refreshScreen()

        action = candidate
        break
      }
    }

    // 현 페이지에서 모든 액션을 수행한 상태
    if (!action) return

    // 사전 조건을 위한 액션 체인 구성
    if (currentAction) {
      action.parent = currentAction
    }

    await this.executeAction(action)
  }

  async executeAction (action, pre) {
    // conduct action based on configurable types
    switch (action.source.input) {
      case 'hover':
        // 0. handle hover actions
        await this.client.hover(action.source.xpath, pre)
        this.result.hovers++
        break
      case 'click':
        // 1. handle click actions
        await this.client.click(action.source.xpath, pre)
        this.result.clicks++
        break
      case 'text':
        // 2. handle edit actions
        // WRITEME
        break
    }
  }

  async createSoruce () {
    const value = await this.client.getSource(true)
    const source = { value }
    const raw = source.value.replace(/\n|\r|\\n/gi, '')
    const body = (new DOMParser()).parseFromString(raw, 'text/html')
    source.dump = source.value
    source.value = body
    return source
  }

  findNode (exp, doc) {
    const type = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
    const xpathResult = XPath.evaluate(exp, doc, null, type, null)

    const result = []
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

    return result
  }

  async back () {
    // 이전 화면을 연출해야 함
    // - ex) layer가 없어져야 하는 상태
    // - ex) 이전의 스크롤 위치
    if (this.buffer.length === 0 || !this.currentNode) {
      await this.terminate('terminate due to illegal initial url')
      return
    }

    const { testingDepth } = this.config
    if (this.currentNode.depth >= testingDepth) {
      await this.terminate('terminate due to max testing depth')
      return
    }

    const { url, precondition } = this.currentNode.parent

    if (url) {
      console.log('BACKWARD'.cyan, url)
      await this.driver.get(url)
      if (precondition) {
        await this.setPrecondition(precondition)
      }
    } else {
      // await this.client.navigate().goBack()
      console.log('BACKWARD'.cyan, null)
    }

    setTimeout(async () => {
      await this.refreshScreen()
      this.crawl()
    }, this.config.newCommandTimeout * 1000)
  }
}
