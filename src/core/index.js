import { DOMParser } from 'xmldom'
import uuid from 'uuid/v5'
import uuidv4 from 'uuid/v4'
import 'colors'

import WDClient from './client'
import CrawlerConfig from './config'
import SSRCrawler from './mode/ssr'
import SPACrawler from './mode/spa'
import UniversalCrawler from './mode/universal'

import { getBounds } from '../utils/xml'
import { findNode, getXPath } from '../utils/xpath'

export default class AppCrawler {
  constructor (driver, settings) {
    // console.info('AppCrawler', driver, settings)

    this.events = {}
    this.started = false
    this.imageHeader = 'data:image/png;base64,'
    this.client = new WDClient(driver)
    this.mode = settings.mode || 'ssr'
    this.entryUrl = settings.entryUrl
    this.config = this.getConfig(settings)

    /*
    this.client.on('sessionDeleted', () => this.emit('stopped'))
    this.client.on('inputDevice', (type, data) => this.record(type, data))
    this.client.on('currentScreenActivity', (activityPayload) => {
      this.activity = activityPayload
    })
    */
  }

  on (event, callback) {
    this.events[event] = callback
    return this
  }

  emit (event, ...args) {
    if (event === 'stopped') this.started = false
    if (!this.events[event]) return this
    this.events[event](...args)
    return this
  }

  async start () {
    if (!this.started) {
      await this.precondition()
      await this.client.driver.get(this.entryUrl)
      const Crawler = getCrawler(this.mode)
      this.crawler = new Crawler(this.config).initialize(this.client)
      this.crawler.on('explore', payload => {
        this.screendump = payload.dump
        this.screenshot = `${this.imageHeader}${payload.value}`
      })
      this.crawler.on('terminate', () => this.end())
      this.crawler.crawl()

      this.started = true
      this.time = new Date()
      this.emit('crawling')
    }
  }

  async end () {
    if (this.started) {
      this.emit('loading')
      await this.client.driver.quit()
      this.started = false

      const now = new Date()
      const time = (now - this.time) / 1000
      console.log(time, 'sec')

      // DELETEME
      process.exit()
    }
  }

  async precondition () {
    if (!this.config.loginUrl) {
      return
    }
    await this.client.driver.get(this.config.loginUrl)
    for (const step of this.config.loginSteps) {
      const input = await this.client.driver.findElement(step.locator)
      await input.sendKeys(step.keys)
    }
  }

  getConfig (settings) {
    const crawlerConfig = new CrawlerConfig(settings)
    crawlerConfig.loadDefault()
    this.screenMatchedPercentage = crawlerConfig.screenMatchedPercentage
    return crawlerConfig
  }

  update (context) {
    // console.debug('crawler.update', context);
    if (context.constructor === Object) {
      const { origin } = context
      origin.image = (context.steps.length && context.steps[0].image) || this.imageHeader
      origin.steps = context.steps.slice()
      this._target = origin
      return this
    }

    this._target = null

    for (const record of context) {
      for (const caseItem of record.cases) {
        const { origin, steps, explains } = caseItem
        origin.image = (steps.length && steps[0].image) || this.imageHeader
        origin.steps = steps.slice()
        if (!this._target && explains.find(desc => desc.uid.length !== 36)) {
          this._target = origin
        }
      }
    }

    return this
  }

  record (type, data) {
    const now = new Date()

    const degree = 0
    const uid = uuid(`${data.cid}/${type}`, uuid.URL)
    const time = (now - this.time) / 1000
    const image = this.screenshot
    const dump = this.screendump
    const activity = this.activity || {}

    const doc = (new DOMParser()).parseFromString(dump, 'text/xml')
    const node = data.xpath && findNode({ xpath: data.xpath, doc })
    const xpath = node ? getXPath(node, doc) : null

    const step = { uid, time, xpath, image, dump, degree, activity }
    const target = { id: uuidv4(), action: type, steps: [step], activity }

    switch (type) {
      case 'back':
        target.action = 'button'
        step.name = 'Back'
        step._type = 'button'
        step.keycodes = ['BACK']
        break

      case 'swipe':
        target.action = 'swipe'
        step.name = 'Drag'
        step._type = 'swipe'
        step.duration = 2
        step.offsetX = 300
        step.offsetY = 200
        break

      case 'click': {
        if (!node) return console.warn('Something went wrong!')
        const offset = getBounds(node)
        target.action = 'touch'
        step.name = 'Tap'
        step._type = 'touch'
        step.x = Math.round(offset.left + offset.width / 2)
        step.y = Math.round(offset.top + offset.height / 2)
        break
      }

      case 'text':
        target.action = 'keyboard'
        step.name = 'Key'
        step._type = 'keyboard'
        step.keycodes = data.value.split('').map(key => key.charCodeAt(0))
        break

      default: break
    }

    this.time = now
  }
}

/**
 * @param {string} mode
 * @param {class}
 */
function getCrawler (mode) {
  switch (mode) {
    case 'ssr':
      return SSRCrawler
    case 'spa':
      return SPACrawler
    case 'universal':
      return UniversalCrawler
  }
}
