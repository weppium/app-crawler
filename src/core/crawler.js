import path from 'path'
import { EventEmitter } from 'events'
import { CrawlingTreeNode } from './models'

const maxRepeatCrawlingCount = 16

export default class Crawler extends EventEmitter {
  constructor (config) {
    super()

    this.config = config // Config in format of AppCrawlerConfig
    this.buffer = [] // The set of notes
    this.currentNode = null // Current node which is in crawling
    this.currentAction = null // Current node action which is performing or just performed
    this.repeatingCount = 0 // When exceed 3, whole program exists
    this.expires = false // Flag to indicate whether a crawling expires
    this.done = false // Flag to indicate whether a crawling finished

    this.result = {
      crawls: 0,
      hovers: 0,
      clicks: 0,
      skips: 0
    }
  }

  initialize (client) {
    this.client = client
    this.driver = client.proxy()
    setTimeout(() => (this.expires = true), this.config.testingPeriod * 1000)

    process.on('uncaughtException', err => {
      this.terminate(err)
      console.error(err.stack)
    })

    process.on('unhandledRejection', (err, p) => {
      this.terminate(err)
      console.error(err.stack)
    })

    return this
  }

  async crawl () {
    // Terminate under the following cases:
    // 1. the previous node has been finished for continuously count of 8, assume crawling finish
    if (this.repeatingCount >= maxRepeatCrawlingCount) {
      this.terminate('crawling max count exceed')
      return
    }

    // 2. the crawling process takes too long and hence expire
    if (this.expires) {
      this.terminate('terminate due to timeout')
      return
    }

    // 3. the crawling process done
    if (this.done) {
      this.terminate()
      return
    }

    try {
      const source = await this.createSoruce()
      this.explore(source)
      this.emit('explore', source)
      this.result.crawls++
    } catch (e) {
      this.terminate(e.message)
    }
  }

  terminate (description = '') {
    console.log(`Crawling Finished! \n  ${description}\n`)
    console.log(this.buffer.map(buff => `\n  (${buff.actions.length}) ${buff.digest} ${buff.url}`[buff.isFinishedBrowsing() ? 'gray' : 'red']).join(''))
    console.log(this.result)
    this.emit('terminate')
  }

  async explore (source) {
    const { newCommandTimeout } = this.config
    const url = await this.driver.getCurrentUrl()
    const title = await this.driver.getTitle()
    const logs = await this.driver.getLog('browser')

    const node = new CrawlingTreeNode(url, this.config.mode)
    node.checkDigest(source)
    node.title = title

    console.log('EXPLORE'.yellow, node.digest.gray, title)
    if (logs.length) {
      console.log(`LOGS(${logs.length}):`.magenta, logs.map(log => `\n  ${log.timestamp} ${log.source} ${log.level} ${log.message}`).join(''))
    }

    // 1. check if there is an existing node
    for (const buffer of this.buffer) {
      if (buffer.digest === node.digest) {
        this.currentNode = buffer
        // 1.1 check if finished browseing
        if (this.currentNode.isFinishedBrowsing()) {
          console.log('isFinishedBrowsing')
          // 1.1.1 if finished browseing, divide into two condition below
          if (this.currentNode.parent && this.currentNode.parent.type === 'tab') {
            // 1.1.1.1 if the tab control also finishes, press
            if (this.currentNode.parent.isFinishedBrowsing()) {
              this.back()
              return
            }
            // 1.1.1.2 if finished browseing, and the current one is under a control widget, trigger the control widget
            this.currentNode = this.currentNode.parent
            await this.performAction(this.currentNode)
            setTimeout(() => this.crawl(), newCommandTimeout * 1000)
          } else {
            // 1.1.2 if finished browseing, and the current one is originates from a normal view, trigger back and then crawl again
            this.repeatingCount++
            if (this.currentNode.depth === 0) {
              // 1.1.2.1 if depth is 0, then terminate crawling, avoid further navigate back
              this.done = true
              this.crawl()
            } else {
              // 1.1.2.2 if depth is not 0, then back and further explore
              this.back()
            }
          }
        } else {
          // 1.2 if not finish crawling, crawling on current node
          await this.performAction(this.currentNode)
          setTimeout(() => this.crawl(), newCommandTimeout * 1000)
        }
        // for existing node, avoid creating new node and quit
        return
      }
    }

    const { testingDepth, maxActionPerPage, targetElements, exclusivePattern } = this.config // sourceSimilarity
    this.repeatingCount = 0

    // 2. check if already reached the max depth, if so, fallback
    node.depth = this.currentNode ? this.currentNode.depth + 1 : 0
    if (node.depth >= testingDepth) {
      this.back()
      return
    }

    // 3. initialize an new node
    node.parent = this.currentNode

    let elements = await this.recursiveFilter(node.innerTree, targetElements, exclusivePattern, node.innerTree)
    if (elements.length) {
      node.repeatable = true
    } else {
      elements = await this.recursiveFilter(node.innerTree, null, exclusivePattern, node.innerTree)
    }

    if (elements.length) {
      if (elements.length > maxActionPerPage) {
        console.log('WARNING max actions per page'.red, elements.length)
        elements = elements.slice(0, maxActionPerPage + 1)
      }
      // console.log(`ACTIONS(${elements.length}):`.gray, elements.map(src => `\n  ${src.type} ${src.getAttribute('href')}`.gray).join(''))
      node.actions = node.produceNodeActions(elements)

      /*
      // 이전 소스와 99퍼 이상 유사한 경우 사전 조건이 필요한 것으로 판단
      const similarity = node.compareSource(node.parent.dump)
      if (similarity > sourceSimilarity && this.currentAction) {
      */

      if (node.parent && node.parent.url === url && this.currentAction) {
        const precondition = this.serializeAction(this.currentAction)
        // 노드에 사전 진입 조건 할당
        node.precondition = precondition
        // 부모 노드에 등록된 액션을 자식 노드의 액션으로 매핑
        const addActions = []
        node.actions = node.actions.map(childAct => {
          const sameAct = node.parent.actions.find(parentAct =>
            parentAct.input === childAct.input && parentAct.source.xpath === childAct.source.xpath)
          if (!sameAct) addActions.push(childAct)
          return sameAct || childAct
        })
        console.log('PRECONDITION'.green, { depth: node.depth, precondition: precondition.length, additional: addActions.length })
      }
    }

    this.buffer.push(node)
    console.log(`BUFFER(${this.buffer.length}):`.blue, `(${node.actions.length}) ${node.digest} ${node.url}`.gray)

    this.currentNode = node
    this.currentAction = null
    await this.performAction(this.currentNode)

    setTimeout(() => this.crawl(), newCommandTimeout * 1000)
  }

  serializeAction (action) {
    let actionArray = []
    do if (action) actionArray.push(action)
    while ((action = action.parent))
    return actionArray.reverse()
  }

  recursiveAction (action) {
    let actionArray = []
    if (action.parent) {
      const result = this.recursiveAction(action.parent)
      actionArray = actionArray.concat(result)
    }
    return actionArray
  }

  // If match is null or empty, put all elements which belongs to button, label,
  async recursiveFilter (source, matches, exclusive, doc) {
    // 0. check crawling validity, erase difference between muli-platforms
    const { exclusiveTypes } = this.config
    // filter out nav-bar element, avoid miss back operation
    let sourceArray = []
    if (exclusiveTypes.includes(source.type) || exclusiveTypes.includes(source.selector)) {
      return []
    }
    // if the source value/name/label matches the exclusive pattern, avoid recording
    if (exclusive && this.checkContentMatch(source, exclusive, true)) {
      return []
    }

    this.eraseModelDifference(source)

    // 1. filter Current Node Information
    if (source.childNodes) {
      for (let i = 0; i < source.childNodes.length; i++) {
        const children = source.childNodes[i]
        if (!children.tagName) continue
        this.eraseModelDifference(children)
        this.insertXPath(source, children, doc)

        const result = await this.recursiveFilter(children, matches, exclusive, doc)
        sourceArray = sourceArray.concat(result)
        /*
        const element = await this.client.getElement(children.xpath)
        if (element) {
          // console.log('DETECTED', children.type, children.xpath.gray)
          const result = await this.recursiveFilter(children, matches, exclusive)
          sourceArray = sourceArray.concat(result)
        }
        */
      }
    }

    const { tabBarTypes, hoverTypes, clickTypes, editTypes } = this.config
    // 2. check if current source is a tab-controller widget
    if (tabBarTypes.includes(source.selector) && sourceArray.length > 0) {
      // Check if sourceType is tab, put it in a high priority list
      this.insertTabNode(sourceArray)
      return []
    }

    // 3. filter current node information
    if (matches) {
      // Explicit mode
      for (const match in matches) {
        if (this.checkContentMatch(source, match.searchValue, false)) {
          return [{ ...source, input: 'text', text: matches[match].actionValue }]
        }
      }
    } else if (source.type) {
      // SSR 모드가 아니면 지정된 요소에 마우스오버 해본다
      if (hoverTypes.includes(source.type)) {
        sourceArray.push({ ...source, input: 'hover' })
      }

      if (clickTypes.includes(source.type)) {
        // Add click action only if the link is valid
        if (this.checkUrlValid(source)) {
          sourceArray.push({ ...source, input: 'click' })
        } else {
          this.result.skips++
        }
      } else if (editTypes.includes(source.type)) {
        sourceArray.push({ ...source, input: 'text', text: makeRandomText(10) })
      }
    }

    return sourceArray
  }

  checkUrlValid (source) {
    let href = this.getLinkUrl(source)
    if (href) {
      const { entryUrl, baseUrl, blacklist } = this.config
      const protocol = entryUrl.split('://')[0]
      if (href.startsWith('//')) {
        href = `${protocol}:${href}`
      } else if (href && (href.startsWith('.') || href.startsWith('/'))) {
        const matches = entryUrl.match(/:\/\/(.[^/]+)/)
        href = `${protocol}://${path.join(matches[1], href)}`
      } else if (!href.startsWith('http') && !href.startsWith('#')) {
        // console.log('SKIPPED'.magenta, href.gray)
        href = ''
      }

      // TODO 아웃링크인 경우 url 찔러보고 결과(http status)만 보고
      if (href && baseUrl && !href.startsWith(baseUrl) && !href.startsWith('#')) {
        // console.log('SKIPPED'.magenta, href.gray)
        href = ''
      }

      const hasBlack = href ? blacklist.find(black => href.includes(black)) : null
      if (hasBlack) {
        console.log('BLACKLIST'.magenta, href.gray)
        href = ''
      }

      // Trigger click only if the link is valid
      if (href) {
        return true
      }
    }
    return false
  }

  checkContentMatch (source, condition, isRegex) {
    if (isRegex) {
      let regex = new RegExp(condition, 'i')
      if (typeof source === 'string') {
        return regex.test(source)
      } else {
        return regex.test(source.value) ||
          regex.test(source.name) ||
          regex.test(source.text) ||
          regex.test(source.title)
      }
    } else {
      if (typeof source === 'string') {
        return source === condition
      } else {
        return (source.value && source.value === condition) ||
          (source.name && source.name === condition) ||
          (source.text && source.text === condition) ||
          (source.title && source.title === condition)
      }
    }
  }

  eraseModelDifference (source) {
    if (source.tagName) {
      const id = source.getAttribute('id')
      const cn = source.getAttribute('class')

      source.type = source.tagName
      source.name = source.getAttribute('name')
      source.title = source.getAttribute('title')
      source.text = (source.childNodes.length === 1 && source.childNodes[0].nodeValue) || ''
      source.selector = `${source.tagName}${id ? '#' + id : ''}${cn ? '.' + cn.split(' ').join('.') : ''}`
    }
  }

  // 속도 느려진다
  async refreshScreen () {
    // Based on environment, choose the way of refresh screen
    // const screendump = await this.driver.takeScreenshot()
    // this.currentNode.image = screendump
  }

  insertTabNode (rawElement) {
    // when find a control widget in source structure, call this method to update the node hierachy
    const { url, depth, digest } = this.currentNode
    const node = new CrawlingTreeNode(url, this.config.mode)
    node.actions = this.currentNode.produceNodeActions(rawElement)
    node.type = 'tab'
    node.depth = depth
    node.digest = `${digest}@tab`

    // check: if there is a similar node in the parent chain, avoid
    let parentNode = this.currentNode.parent
    while (parentNode) {
      if (parentNode.digest === node.digest) {
        return console.warn('Similar tab elements in parent, abort', parentNode)
      }
      parentNode = parentNode.parent
    }

    // console.log('Insert TabNode', node.digest)
    node.parent = this.currentNode.parent
    this.currentNode.parent = node
    this.buffer.push(node)
  }

  getAttributes (source, name) {
    const attributes = {}
    for (let i = 0; i < source.attributes.length; i++) {
      const attr = source.attributes[i]
      if (attr.name === name) {
        return attr.value
      }
      attributes[attr.name] = attr.value
    }
    return name === undefined ? attributes : null
  }

  getLinkUrl (source) {
    const href = this.getAttributes(source, 'href')
    if (href && href.startsWith('/')) {
      return `${this.config.baseUrl}${href}`
    }
    return href
  }
}

function makeRandomText (length = 5) {
  const possible = '0123456789'
  let text = ''

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }

  return text
}
