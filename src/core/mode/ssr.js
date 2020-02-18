import { DOMParser } from 'xmldom'
import CrawlerBase from '../crawler'

export default class SSRCrawler extends CrawlerBase {
  insertXPath (parent, child) {
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
    const prefixXPath = parent.xpath ? `${parent.xpath}/` : '//html[1]/body[1]/'
    child.xpath = `${prefixXPath}${child.tagName}[${currentIndex}]`
  }

  async performAction ({ actions, parent }) {
    let action = null
    for (const candidate of actions) {
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

    if (action) {
      await this.executeAction(action)
    }
  }

  async executeAction (action) {
    // conduct action based on configurable types
    switch (action.source.input) {
      case 'hover':
        // 0. handle hover actions
        await this.client.hover(action.source.xpath)
        this.result.hovers++
        break
      case 'click':
        // 1. handle click actions
        let href = this.getLinkUrl(action.source)
        if (href.startsWith('#')) {
          await this.client.click(action.source.xpath)
        } else {
          console.log('NAVIGATE'.green, href)
          await this.driver.get(href)
        }
        this.result.clicks++
        break
      case 'text':
        // 2. handle edit actions
        // WRITEME
        break
    }
  }

  async createSoruce () {
    const value = await this.client.getSource()
    const source = { value }
    const raw = source.value.replace(/\n|\r|\\n/gi, '')
    const dom = (new DOMParser()).parseFromString(raw, 'text/html')
    source.dump = source.value
    source.value = dom.documentElement.getElementsByTagName('body')[0] // body
    return source
  }

  async back () {
    if (this.buffer.length === 0) {
      await this.terminate('terminate due to illegal initial url')
      return
    }

    const url = !this.currentNode.parent || !this.currentNode.parent.url
      ? this.buffer[0].url
      : this.currentNode.parent.url

    if (url) {
      console.log('BACKWARD'.cyan, url)
      await this.driver.get(url)
    } else {
      console.log('BACKWARD'.cyan, null)
      await this.driver.goBack()
    }

    setTimeout(async () => {
      await this.refreshScreen()
      this.crawl()
    }, this.config.newCommandTimeout * 1000)
  }
}
