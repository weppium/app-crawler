import uuidv3 from 'uuid/v3'
// import { diffChars } from 'diff'
import { compareTwoStrings } from 'string-similarity'
const NAMESPACE = '1f0b58f7-9f58-3c81-85b4-26058507dd57'

// Crawling Node: each of the tree node represents a unique user page
export class CrawlingTreeNode {
  constructor (url, mode) {
    this.url = url
    this.mode = mode
    this.path = '' // Unique path which leads to current page
    this.parent = null // Parent ui element
    this.type = 'normal' //  'tab' / 'normal'
    this.depth = 0
    this.children = []
    this.actions = [] // Units in {value : CrawlingTreeNodeAction}
    this.digest = null
    this.dump = null
    this.repeatable = false
  }

  isFinishedBrowsing () {
    let isFinished = true
    for (const action of this.actions) {
      if (action.isTriggered === false) {
        isFinished = false
        break
      }
    }

    // replay everything for repeatable nodes
    if (isFinished && this.repeatable) {
      for (const action of this.actions) {
        action.isTriggered = false
      }
      isFinished = false
    }

    return isFinished
  }

  compareSource (dump) {
    const similarity = compareTwoStrings(this.dump, dump)
    return similarity
  }

  checkDigest (source) {
    if (this.digest !== null) {
      return this.digest
    }

    // 0. check source validity
    this.innerTree = source.value

    // 1. check digest
    if (this.mode === 'ssr') {
      this.digest = uuidv3(this.url, uuidv3.URL) // SSR용 digest
    } else {
      // TODO
      // - url은 같은데 html의 내용이 다른 상황울 구분
      // - 이 경우 진입 과정(step) 저장
      this.digest = uuidv3(source.dump, NAMESPACE) // SPA용 digest
      this.dump = source.dump
    }

    source.digest = this.digest
  }

  produceNodeActions (rawElements) {
    const actions = []
    for (const rawElement of rawElements) {
      const action = new CrawlingTreeNodeAction()
      const shallowCopy = Object.assign({}, rawElement)
      delete shallowCopy.children
      action.source = shallowCopy
      action.location = shallowCopy.xpath
      action.input = shallowCopy.input
      action.text = shallowCopy.text
      actions.push(action)
    }

    return actions
  }
}

class CrawlingTreeNodeAction {
  constructor () {
    this.isTriggered = false
    this.location = null
    this.input = null
    this.interval = 0
    this.source = {}
  }

  title () {
    if (this.location) {
      let components = this.location.split(/[/]+/)
      if (components.length <= 4) {
        return components.join('-')
      } else {
        return components.slice(components.length - 4, components.length).join('-')
      }
    } else {
      return 'N/A'
    }
  }

  checkInterval () {
    this.previousTime = this.currentTime
    this.currentTime = new Date()
    if (!this.previousTime) {
      this.previousTime = this.currentTime
    }
    this.interval = this.currentTime.getTime() - this.previousTime.getTime()
  }
}
