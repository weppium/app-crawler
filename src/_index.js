import { path } from 'chromedriver'
// import { Builder, Capabilities } from 'selenium-webdriver' // , By, Key, until
// import { ServiceBuilder, setDefaultService } from 'selenium-webdriver/chrome'
import { Builder, Capabilities, By, Key } from './webdriver' // , By, Key, until
import { ServiceBuilder, setDefaultService } from './webdriver/chrome'

import AppCrawler from './core'

// @see https://github.com/SeleniumHQ/selenium/blob/master/javascript/node/selenium-webdriver/index.js
export default async () => {
  // 크롬 드라이버를 기본 서비스 등록
  const service = new ServiceBuilder(path).build()
  setDefaultService(service)

  // 웹드라이버 생성
  const capabilities = Capabilities.chrome()
  const driver = await new Builder().withCapabilities(capabilities).build()

  // 창 크기 및 위치 변경
  await driver.manage().window().setRect({ x: 200, y: 200, width: 1280, height: 1024 })

  const BASE_URL = 'https://sandbox-business.kakao.com'
  const crawler = new AppCrawler(driver, {
    capabilities,
    mode: 'ssr',
    baseUrl: BASE_URL,
    entryUrl: BASE_URL,
    testingDepth: 8,
    loginUrl: 'https://sandbox-accounts.kakao.com/login?continue=https://sandbox-business.kakao.com',
    loginSteps: [
      { locator: By.name('email'), keys: 'ella00@test.co' },
      { locator: By.name('password'), keys: 'ella' },
      { locator: By.xpath("//button[@type='submit']"), keys: Key.ENTER }
    ],
    blacklist: [
      `${BASE_URL}/sync`,
      `${BASE_URL}/dashboard`,
      `${BASE_URL}/notices`,
      `${BASE_URL}/logout`
    ]
  })

  crawler.start()
}
