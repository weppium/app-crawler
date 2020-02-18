import { hasOwnProperty } from '../../../helpers/utils';

// Crawling Action Target
export default class AppCrawlerConfig {
  constructor(desiredCapabilities) {
    this.platform = desiredCapabilities.platformName;
    this.activities = desiredCapabilities.activities || [];
    this.appId = desiredCapabilities.appPackage || desiredCapabilities.bundleId;
    this.screenMatchedPercentage = 95;

    this.testingPeriod = 0.5 * 60 * 60;
    this.testingDepth = 8;
    // this.takeScreenShot = true;
    // this.autoCancelAlert = true;
    this.newCommandTimeout = 3;
    // this.launchTimeout  = 6;
    this.maxActionPerPage = 15;
    // this.navigationBackKeyword = [];
    this.targetElements = {};
    this.exclusivePattern = '';
    this.clickTypes = [];
    this.editTypes = [];
    this.horizontalScrollTypes = [];
    // this.verticalScrollTypes = [];
    this.tabBarTypes = [];
    this.exclusiveTypes = [];
    this.blacklist = [];
  }

  loadDefault() {
    // android
    const crawlingConfig = this.platform === 'Android' ? {
      exclusivePattern: 'pushView/popView/cookie/userAgent:/Mozilla/cookie:/setTitle/',
      clickTypes: ['android.widget.ImageView', 'android.widget.TextView', 'android.widget.Button'],
      exclusiveTypes: ['android.webkit.WebView'],
      tabBarTypes: ['android.widget.TabWidget'],
      editTypes: ['android.widget.EditText']
    } : {
      clickTypes: ['XCUIElementTypeStaticText', 'XCUIElementTypeButton'],
      editTypes: ['XCUIElementTypeTextField', 'XCUIElementTypeSecureTextField'],
      horizontalScrollTypes: ['XCUIElementTypePageIndicator'],
      verticalScrollTypes: ['XCUIElementTypeScrollView'],
      tabBarTypes: ['XCUIElementTypeTabBar'],
      exclusiveTypes: ['XCUIElementTypeNavigationBar'],
      navigationBackKeyword: ['Back', 'Cancel']
    };

    for (const i in crawlingConfig) {
      if (hasOwnProperty(crawlingConfig, i) && hasOwnProperty(this, i)) {
        this[i] = crawlingConfig[i];
      }
    }
  }
}
