import PuppeteerCrawler from './puppeteer'

const BASE_URL = 'https://sandbox-business.kakao.com'
const BLACKLIST_PATH = '/logout?continue=%2F'
const NOT_VISITED = [`${BASE_URL}/info/`]
const VISITED = [`${BASE_URL}/info/`]

const create = async (options = {}) => {
  const crawler = await PuppeteerCrawler.launch({
    // Function to be evaluated in browsers
    jQuery: false,
    // headless: false,
    viewport: {
      width: 1280,
      height: 1024
    },
    evaluatePage: (() => ({
      url: location.href,
      user: document.querySelector('.link_gnb').title
    })),
    onSuccess: result => {
      console.log(result.result)
      for (let link of result.links) {
        /*
        if (link.endsWith('/')) {
          link = link.substring(0, link.length - 1)
        }
        */
        if (
          link.startsWith(BASE_URL) &&
          !link.includes(BLACKLIST_PATH) &&
          !NOT_VISITED.includes(link) &&
          !VISITED.includes(link)) {
          NOT_VISITED.push(link)
        }
      }
    },
    ...options
  })
  return crawler
}

const login = async (crawler, options) => {
  const page = await crawler.condition(options)
  return page
  /*
  const cookies = await page.cookies()

  // Resolved when no queue is left
  await crawler.onIdle()

  return cookies
  */
}

const crawl = async (crawler, page) => {
  const url = NOT_VISITED.shift()
  console.log('NAVIGATE URL', url)
  VISITED.push(url)

  // Queue a request
  await crawler.queue({ url, page })

  // Resolved when no queue is left
  await crawler.onIdle()

  if (NOT_VISITED.length) {
    await crawl(crawler, page)
  } else {
    console.log('DONE')
    // Close the crawler
    await crawler.close()
  }
}

export default async () => {
  const crawler = await create()
  const page = await login(crawler, {
    url: 'https://sandbox-accounts.kakao.com/login/kakaoforbusiness?continue=https://sandbox-business.kakao.com/dashboard/',
    steps: [
      { click: '#loginEmail', type: 'ella00@test.co' },
      { click: '#loginPw', type: 'ella' },
      { click: 'button.btn_login.submit' }
    ]
  })
  await crawl(crawler, page)
  /*
  const cookies = await login(crawler, {
    url: 'https://sandbox-accounts.kakao.com/login/kakaoforbusiness?continue=https://sandbox-business.kakao.com/dashboard/',
    steps: [
      { click: '#loginEmail', type: 'ella00@test.co' },
      { click: '#loginPw', type: 'ella' },
      { click: 'button.btn_login.submit' }
    ]
  })
  await crawl(crawler, cookies)
  */
}
