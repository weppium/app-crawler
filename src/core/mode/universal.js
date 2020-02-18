import path from 'path'
import { DOMParser } from 'xmldom'
import CrawlerBase from '../crawler'

// TODO SPA+SSR 모드 작성
export default class UniversalCrawler extends CrawlerBase {
  insertXPath (parent, child) {
    if (!child.tagName) {
      return null
    }
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
    // console.log('insertXPath', child.xpath)
  }

  async performAction ({ actions, parent, url }) {
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

    if (!action) {
      return
    }

    const { clickTypes, blacklist, horizontalScrollTypes, editTypes } = this.config

    // conduct action based on configurable types
    if (clickTypes.includes(action.source.type)) {
      // 1. handle click actions
      /*
      for SPA
      try {
        const element = await this.client.findElement(By.xpath(action.source.xpath))
        const isDisplayed = await element.isDisplayed()
        if (isDisplayed) {
          const title = await this.client.getTitle()
          console.log(title, action.source.attribs)
          await element.click()
        }
      } catch (err) {
        console.log(err.message)
      }
      */

      const attributes = {}
      for (let i = 0; i < action.source.attributes.length; i++) {
        const attrs = action.source.attributes[i]
        attributes[attrs.name] = attrs.value
      }

      if (attributes.href) {
        /*
        const element = await this.client.findElement(By.xpath(action.source.xpath))
        const isDisplayed = await element.isDisplayed()
        const rect = await element.getRect()
        console.log(rect)
        if (!isDisplayed) {
          console.log(attributes)
          continue
        }
        */

        const protocol = url ? url.split('://')[0] : 'https'
        let { href } = attributes
        if (href.startsWith('//')) {
          href = `${protocol}:${href}`
        } else if (url && (href.startsWith('.') || href.startsWith('/')) && href) {
          const matches = url.match(/:\/\/(.[^/]+)/)
          href = `${protocol}://${path.join(matches[1], href)}`
        } else if (!href.startsWith('http')) {
          console.log('SKIPPED'.magenta, href.gray)
          href = ''
        }

        // 발견된 URL이 부모나 자신의 것이면 SKIP
        if (href === (parent && parent.url) || href === url) {
          console.log('SKIPPED'.magenta, href.gray)
          href = ''
        }

        const isBlack = blacklist.find(black => href.includes(black))
        if (isBlack) {
          console.log('BLACKLIST'.magenta, href.gray)
          href = ''
        }

        // Trigger click only if the link is valid
        if (href) {
          console.log('NAVIGATE'.green, href)
          await this.client.get(href)
        }
      }
    } else if (horizontalScrollTypes.includes(action.source.type)) {
      /** 2. handle horizontal scroll actions */
    } else if (editTypes.includes(action.source.type)) {
      /** 3. handle edit actions */
    }
  }

  async createSoruce () {
    // const value = await this.client.getPageSource()
    const value = await this.client.executeScript('return document.body.innerHTML')
    const source = { value }
    const raw = source.value.replace(/\n|\r|\\n/gi, '')
    const body = (new DOMParser()).parseFromString(raw, 'text/html')
    source.dump = source.value
    source.value = body // dom.documentElement.getElementsByTagName('body')[0] // body
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
      await this.client.get(url)
    } else {
      console.log('BACKWARD'.cyan, null)
      await this.client.goBack()
    }

    setTimeout(async () => {
      await this.refreshScreen()
      this.crawl()
    }, this.config.newCommandTimeout * 1000)
  }
}
