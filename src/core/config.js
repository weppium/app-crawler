// Crawling Action Target
export default class CrawlerConfig {
  constructor (config) {
    this.mode = config.mode || 'ssr'
    this.capabilities = config.capabilities || {}
    this.activities = config.activities || []
    this.appId = config.appPackage || config.bundleId
    this.entryUrl = config.entryUrl
    this.baseUrl = config.baseUrl
    this.loginUrl = config.loginUrl
    this.loginSteps = config.loginSteps
    this.screenMatchedPercentage = 95

    this.testingPeriod = 0.5 * 60 * 60
    this.testingDepth = 8
    // this.takeScreenShot = true;
    // this.autoCancelAlert = true;
    this.newCommandTimeout = 0.4
    // this.launchTimeout  = 6;
    this.maxActionPerPage = 1024
    this.sourceSimilarity = 0.9
    // this.navigationBackKeyword = [];
    this.targetElements = {}
    this.exclusivePattern = ''
    this.hoverTypes = []
    this.clickTypes = []
    this.editTypes = []
    // this.horizontalScrollTypes = []
    // this.verticalScrollTypes = [];
    this.tabBarTypes = []
    this.exclusiveTypes = []
    this.blacklist = config.blacklist || []

    // - phase 2 - OCR
    /*
    this.strategy = 'source'
    this.depth = 100
    this.duration = 1800
    this.triggers = []
    this.exclude = []
    this.deviceType = ''
    */
  }

  // TODO config에서 불러올수 있도록 하기
  getDefault () {
    switch (this.mode) {
      case 'spa':
        return {
          hoverTypes: ['a', 'button', 'div'],
          clickTypes: ['a', 'button'],
          exclusiveTypes: ['iframe', 'script', 'style', 'br', 'hr'],
          editTypes: ['textarea', 'input']
        }
      case 'ssr':
        return {
          clickTypes: ['a'],
          exclusiveTypes: ['iframe'],
          editTypes: ['textarea', 'input']
        }
      case 'universal':
        return {
          clickTypes: ['a'],
          // tabBarTypes: ['div.head_wrap'],
          exclusiveTypes: ['iframe'],
          editTypes: ['textarea', 'input']
        }
    }
  }

  loadDefault () {
    const crawlingConfig = this.getDefault()

    const keys = Object.keys(crawlingConfig)
    for (const key of keys) {
      if (!this[key].length) {
        this[key] = crawlingConfig[key]
      }
    }
  }
}
