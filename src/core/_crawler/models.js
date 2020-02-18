// Crawling Node: each of the tree node represents a unique user page
export class CrawlingTreeNode {
  constructor(client) {
    this.client = client;

    this.path = ''; // Unique path which leads to current page
    this.parent = null; // Parent ui element
    this.type = 'normal'; //  'tab'/ 'normal'
    this.depth = 0;
    this.actions = []; // Units in {value : CrawlingTreeNodeAction}
    this.digest = null;
  }

  isFinishedBrowsing() {
    let isFinished = true;
    for (const key in this.actions) {
      if (this.actions[key].isTriggered === false) {
        isFinished = false;
        break;
      }
    }
    return isFinished;
  }

  checkDigest(platform, source) {
    if (this.digest !== null) return Promise.resolve(this.digest);

    switch (platform) {
      case 'iOS':
        this.digest = [
          source.value.querySelectorAll('*').length,
          source.value.querySelectorAll('[class*="StaticText"]').length,
          source.value.querySelectorAll('[class*="TextField"]').length,
          source.value.querySelectorAll('[class*="Other"]').length,
          source.value.querySelectorAll('[class*="Button"]').length
        ].join('/');
        source.digest = this.digest;
        return Promise.resolve();

      case 'Android':
        this.digest = [
          source.value.querySelectorAll('*').length,
          source.value.querySelectorAll('[class*="TextView"]').length,
          source.value.querySelectorAll('[class*="EditText"]').length,
          source.value.querySelectorAll('[class*="Layout"]').length,
          source.value.querySelectorAll('[class*="Button"]').length
        ].join('/');
        source.digest = this.digest;

        return Promise.all([
          this.client.send(`/session/${this.client.sessionId}/appium/device/current_activity`, 'get').then(payload => ({ appActivity: payload.value })),
          this.client.send(`/session/${this.client.sessionId}/appium/device/current_package`, 'get').then(payload => ({ appPackage: payload.value }))
        ]).then((values) => {
          const payload = { ...values[0], ...values[1] };
          this.digest += `/${payload.appPackage}${payload.appActivity}`;
          return payload;
        });

      case 'PC-Web':
      default:
        return this.client.send(`/session/${this.client.sessionId}/url`, 'get').then((url) => {
          this.digest = url.value;
          this.url = this.digest;
          source.digest = this.digest;
        });
    }
  }
}

export function CrawlingTreeNodeAction(client) {
  this.client = client;

  this.isTriggered = false;
  this.location = null;
  this.input = null;
  this.source = {};

  /*
  this.interval = 0;
  this.title = () => {
    if (this.location) {
      const components = this.location.split(/[/]+/);
      if (components.length <= 4) return components.join('-');
      return components.slice(components.length - 4, components.length).join('-');
    }
    return null;
  };
  this.checkInterval = () => {
    this.previousTime = this.currentTime;
    this.currentTime = new Date();

    if (!this.previousTime) {
      this.previousTime = this.currentTime;
    }

    this.interval = this.currentTime.getTime() - this.previousTime.getTime();
  };
  */
}
