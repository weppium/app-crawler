import uuid from 'uuid/v5'
import uuidv4 from 'uuid/v4'
import resemble from 'resemblejs'

import AndroidCrawler from './android'
import iOSCrawler from './ios'
import WebCrawler from './web'
import WDClient from './client'
import AppCrawlerConfig from './config'

import { getBounds } from '../../../helpers/xml'
import { findNode, getXPath } from '../../../helpers/xpath'

export default class AppCrawler {
  constructor (server, desiredCapabilities) {
    console.info('AppCrawler', server, desiredCapabilities)

    this.events = {}
    this.started = false
    this.imageHeader = 'data:image/png;base64,'
    this.client = new WDClient({ server, desiredCapabilities })

    const crawlerConfig = new AppCrawlerConfig(desiredCapabilities)
    crawlerConfig.loadDefault()

    let Crawler
    if (desiredCapabilities.platformName === 'Android') {
      Crawler = AndroidCrawler
    } else if (crawlerConfig.platform === 'iOS') {
      Crawler = iOSCrawler
    } else {
      Crawler = WebCrawler
    }

    this.client.on('sessionCreated', (data) => {
      console.info('initialize crawler', data, crawlerConfig)
      this.crawler = new Crawler(crawlerConfig, data.sessionId).initialize(this.client)
      this.crawler.crawl()
      this.emit('crawling')
      this.time = new Date()
    })

    this.client.on('sessionDeleted', () => this.emit('stopped'))
    this.client.on('terminateCrawling', () => this.client.end())
    this.client.on('inputDevice', (type, data) => this.record(type, data))
    this.client.on('saveScreenshot', (payload) => {
      if (!payload.value) return console.log('응 데이터가 없어?', payload)
      this.screenshot = `${this.imageHeader}${payload.value}`
    })
    this.client.on('saveScreenSource', (payload) => {
      this.screendump = payload.dump
    })
    this.client.on('currentScreenActivity', (activityPayload) => {
      this.activity = activityPayload
    })
    this.screenMatchedPercentage = crawlerConfig.screenMatchedPercentage
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

  toggle () {
    this.started = !this.started
    this.emit('loading')
    if (this.started) {
      this.client.start()
    } else {
      this.client.end()
    }
  }

  update (context) {
    // console.debug('crawler.update', context);
    if (context.constructor === Object) {
      const { origin } = context
      origin.image = context.steps.length && context.steps[0].image || this.imageHeader
      origin.steps = context.steps.slice()
      this._target = origin
      return this
    }

    this._target = null

    for (const record of context) {
      for (const caseItem of record.cases) {
        const { origin, steps, explains } = caseItem
        origin.image = steps.length && steps[0].image || this.imageHeader
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

    if (this.target || this._target) {
      resizeImage(image, 0.25, resized => this.compareScreen(target, resized))
    } else {
      if (this.activity) {
        const { appActivity } = target.activity
        const splited = appActivity.split('.')
        const name = splited[splited.length - 1]
        target.name = name
      }
      this.emit('execute', target, 'nocompare')
      this.target = target
      resizeImage(this.screenshot, 0.25, (resized) => {
        this.target.image = resized
      })
    }
    this.time = now
  }

  compareScreen (source, resized) {
    const target = this._target || this.target

    if (this.activity) {
      setImmediate(() => {
        const { appActivity, appPackage } = this.activity
        const splited = appActivity.split('.')
        const name = splited[splited.length - 1]
        const matched = target.activity.appActivity === appActivity && target.activity.appPackage === appPackage

        if (matched || this._target) {
          source.id = target.id
          source.name = name
          source.action = target.action
          source.steps = target.steps.concat(source.steps)
          console.log(source)

          this.emit('execute', source, this._target ? 'targeted' : 'matched')
        } else {
          source.name = name
          this.emit('execute', source, 'notmatched')
        }
      })
    } else {
      resemble(target.image).compareTo(resized).onComplete((result) => {
        const matchPercentage = 100 - Number(result.misMatchPercentage)
        if (matchPercentage > this.screenMatchedPercentage || this._target) {
          const action = target.action.match(/keys?/) ? 'keys' : 'touchs'
          source.id = target.id
          source.action = action
          source.steps = target.steps.concat(source.steps)
          for (let i = 0; i < source.steps.length; i++) {
            if (source.steps[i]._type.match(/keyboard|button/) && action === 'touchs' ||
              source.steps[i]._type === 'touch' && action.match(/keys|button/)) {
              source.action = 'mixed'
              break
            }
          }
          this.emit('execute', source, this._target ? 'targeted' : 'matched')
        } else {
          this.emit('execute', source, 'notmatched')
        }
      })
    }

    source.image = resized
    this.target = source
  }
}

const canvas = document && document.createElement('canvas')
const image = document && document.createElement('img')
const context = canvas && canvas.getContext('2d')
/**
 * @param {string} src
 * @param {number} width
 * @param {number} height
 * @param {function} done
 */
function resizeImage (src, scale, done) {
  image.onload = function onLoad () {
    const width = image.width * scale
    const height = image.height * scale
    canvas.width = width
    canvas.height = height
    context.drawImage(image, 0, 0, width, height)
    // done(context.getImageData(0, 0, width, height));
    done(canvas.toDataURL())
  }

  image.src = src
}
