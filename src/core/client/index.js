import { XPathResult } from 'xpath'
import { Actions, By } from '../../webdriver'

// TODO
// - 여러 서드파티 웹드라이버 라이브러리를 지원 가능하도록 하는 wrapper 작성
// - RestFull 클라이언트 작성
export default class WDClient {
  constructor (driver) {
    this.driver = driver
  }

  async getSource (isInner) {
    const source = isInner
      ? await this.driver.executeScript('return document.body.innerHTML')
      : await this.driver.getPageSource()
    return source
  }

  async getElement (xpath) {
    try {
      const element = await this.driver.findElement(By.xpath(xpath))
      await this.driver.executeScript('arguments[0].scrollIntoView(true)', element)
      if (await element.isDisplayed()) {
        return element
      }
    } catch (err) {
      console.error(err.message)
    }
    return null
  }

  async findElement (expression) {
    const type = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
    const result = await this.driver.executeScript(`return document.evaluate('${expression}', document.body, null, ${type}, null).snapshotLength`)
    return result
  }

  async click (xpath, pre) {
    try {
      const element = await this.getElement(xpath)
      if (element) {
        await element.click()
        console.log(`${pre ? 'PRE' : ''}ACTION`.green, 'click', xpath.gray)
        // TODO 새 탭으로 열리는 현상 해결
        /*
        if (await element.getAttribute('target') !== '_blank') {
          await this.driver.switchTo().activeElement(element)
        }
        */
      } else {
        // const action = new Actions(this.driver)
        // action.scrollFromElement
        // await action.moveToElement({ origin: element })
        // const data = await element.getLocationOnceScrolledIntoView()
        // console.log(action.scroll)
      }
    } catch (err) {
      console.error(err.message)
    }
  }

  async hover (xpath, pre) {
    try {
      const action = new Actions(this.driver)
      const element = await this.getElement(xpath)
      if (element) {
        await action.move({ origin: element })
        console.log(`${pre ? 'PRE' : ''}ACTION`.green, 'hover', xpath.gray)
      }
    } catch (err) {
      console.error(err.message)
    }
  }

  // 프록시된 WD 인스턴스 리턴
  proxy () {
    const cache = new WeakMap()
    return new Proxy(this.driver, {
      get (driver, key) {
        const value = Reflect.get(driver, key)
        if (typeof value !== 'function') {
          return value
        }
        if (!cache.has(value)) {
          cache.set(value, value.bind(driver))
        }
        return cache.get(value)
      }
    })
  }
}
