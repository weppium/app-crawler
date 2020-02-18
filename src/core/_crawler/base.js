import uuid from 'uuid/v5';
import { CrawlingTreeNodeAction, CrawlingTreeNode } from './models';

const maxRepeatCrawlingCount = 8;

export default class CrawlerBase {
  constructor(config, sessionId) {
    this.config = config; // Config in format of AppCrawlerConfig
    this.sessionId = sessionId; // Session Id
    this.crawlingBuffer = []; // The set of notes
    this.currentNode = null; // Current node which is in crawling
    // this.currentAction = null; // Current node action which is performing or just performed
    this.repeatingCrawlingCount = 0; // When exceed 3, whole program exists
    this.crawlingExpires = false; // Flag to indicate whether a crawling expires
    this.eventCount = 0; // Event count for generate unique id

    this.pass = true;
    this.fail = false;
  }

  initialize(client) {
    this.client = client;
    setTimeout(() => {
      this.crawlingExpires = true;
    }, this.config.testingPeriod * 1000);
    return this;
  }

  crawl() {
    // Terminate under the following cases:
    // 1. the previous node has been finished for continuously count of 8, assume crawling finish
    // 2. the crawling process takes too long and hence expire
    if (this.repeatingCrawlingCount >= maxRepeatCrawlingCount || this.crawlingExpires) {
      console.info('Crawling Finished!', this.repeatingCrawlingCount >= maxRepeatCrawlingCount, this.crawlingExpires);
      return this.client.emit('terminateCrawling');
    }

    const parent = this.source;
    this.client.send(`/session/${this.sessionId}/source`, 'get').then((data) => {
      const source = this.beforeExplore(data);
      if (!source) return;
      this.source = source;
      this.source.parent = parent;
      this.client.emit('saveScreenSource', data);
    });
  }

  explore(source) {
    const { platform, exclusivePattern, testingDepth, targetElements, maxActionPerPage } = this.config;
    const timeout = this.config.newCommandTimeout * 1000;
    const node = new CrawlingTreeNode(this.client);
    node.checkDigest(platform, source).then((activity) => {
      if (activity) this.client.emit('currentScreenActivity', activity);

      // 1. check if there is an existing node
      for (const buffer of this.crawlingBuffer) {
        if (buffer && buffer.digest === node.digest) {
          this.currentNode = buffer;
          // 1.1 check if finished browseing
          if (this.currentNode.isFinishedBrowsing()) {
            // 1.1.1 if finished browseing, divide into two condition below
            if (this.currentNode.parent && this.currentNode.parent.type === 'tab') {
              // 1.1.1.1 if the tab control also finishes, press
              if (this.currentNode.parent.isFinishedBrowsing()) {
                return this.back();
              }
              // 1.1.1.2 if finished browseing, and the current one is under a control widget, trigger the control widget
              this.currentNode = this.currentNode.parent;
              this.performAction(this.currentNode)
                .then(() => setTimeout(() => this.crawl(), timeout));
            } else {
              // 1.1.2 if finished browseing, and the current one is originates from a normal view, trigger back and then crawl again
              this.repeatingCrawlingCount++;
              if (this.currentNode.depth === 0) {
                // 1.1.2.1 if depth is 0 , then terminate crawling, avoid further navigate back
                this.repeatingCrawlingCount = maxRepeatCrawlingCount;
                this.crawl();
              } else {
                // 1.1.2.2 if depth is not 0, then back and further explore
                this.back();
              }
            }
          } else {
            // 1.2 if not finish crawling, crawling on current node
            this.performAction(this.currentNode)
              .then(() => setTimeout(() => this.crawl(), timeout));
          }
          // for existing node, avoid creating new node and quit
          return;
        }
      }

      this.repeatingCrawlingCount = 0;

      // 2. check if already reached the max depth, if so, fallback
      node.depth = this.currentNode ? this.currentNode.depth + 1 : 0;
      if (node.depth >= testingDepth) {
        return this.back();
      }

      // 3. initialize an new node
      node.parent = this.currentNode;
      this.currentNode = node;

      // const value = platform === 'PC-Web' ? source.value : JSON.parse(source.value);
      const { value } = source;
      const matches = this.recursiveFilter(value, targetElements, exclusivePattern);
      if (matches.length) {
        this.currentNode.actions = this.produceNodeActions(matches);
      } else {
        const elements = this.recursiveFilter(value, null, exclusivePattern);
        this.currentNode.actions = this.produceNodeActions(elements);
      }

      if (this.currentNode.actions.length > maxActionPerPage) {
        this.currentNode.actions = this.currentNode.actions.slice(0, maxActionPerPage + 1);
      }

      this.crawlingBuffer.push(node);
      this.performAction(this.currentNode)
        .then(() => setTimeout(() => this.crawl(), timeout));
    });
  }

  next() {
    console.warn('next', this.crawlingBuffer.length, this.source.parent);
    return this.refreshScreen().then(() => {
      if (this.source.parent) {
        this.explore(this.source.parent);
        this.source = this.source.parent;
      } else {
        console.warn('Crawling Expires');
        this.crawlingExpires = true;
        this.crawl();
      }
    });
  }

  back() {
    if (this.config.platform === 'iOS') return this.next();
    console.log('Back Event', this.eventCount, this.currentNode.depth, this.currentNode.digest);
    this.client.emit('inputDevice', 'back', { cid: `${++this.eventCount}/${this.currentNode.digest}` });
    return this.client.send(`/session/${this.sessionId}/back`, 'post', {})
      .then(() => this.refreshScreen())
      .then(() => this.crawl());
  }

  // If match is null or empty, put all elements which belongs to button, label,
  recursiveFilter(source, matches, exclusive) {
    // 0. check crawling validity, erase difference between muli-platforms
    const { exclusiveTypes, tabBarTypes, clickTypes, editTypes, horizontalScrollTypes } = this.config;
    // filter out nav-bar element, avoid miss back operation
    let sourceArray = [];
    if (exclusiveTypes.indexOf(source.type) >= 0) return [];

    // if the source value/name/label matches the exclusive pattern, avoid recording
    if (exclusive && (source.value && exclusive.includes(source.value)) ||
        source.name && exclusive.includes(source.name) ||
        source.text && exclusive.includes(source.text) ||
        source['content-desc'] && exclusive.includes(source['content-desc']) ||
        source.label && exclusive.includes(source.label)) {
      return [];
    }

    this.eraseModelDifference(source);

    // 1. filter Current Node Information
    if (source.children) {
      for (const children of source.children) {
        this.eraseModelDifference(children);
        this.insertXPath(source, children);
        const result = this.recursiveFilter(children, matches, exclusive);
        sourceArray = sourceArray.concat(result);
      }
    }

    // 2. check if current source is a tab-controller widget
    if (tabBarTypes.indexOf(source.type) >= 0 && sourceArray.length > 0) {
      // Check if sourceType is tab, put it in a high priority list
      this.insertTabNode(sourceArray);
      return [];
    }

    // 3. filter current node information
    if (matches) {
      // Explicit mode
      for (const match in matches) {
        if (source.value && source.value === matches[match].searchValue ||
          source.name && source.name === matches[match].searchValue ||
          source.text && source.text === matches[match].searchValue ||
          source.label && source.label === matches[match].searchValue) {
          source.input = matches[match].actionValue;
          return [source];
        }
      }
    } else if (source.type) {
      if (this.checkElementValidity(source)) {
        if (clickTypes.indexOf(source.type) >= 0) {
          sourceArray.push(source);
        } else if (editTypes.indexOf(source.type) >= 0) {
          source.input = makeText(10);
          sourceArray.push(source);
        } else if (horizontalScrollTypes.indexOf(source.type) >= 0) {
          sourceArray.push(source);
        } else if (source.clickable) {
          source.smartDetected = true;
          // console.info('Smart Detected Clickable Node', source);
          sourceArray.push(source);
        }
      }
    }

    return sourceArray;
  }

  performAction({ actions, digest, depth }) {
    if (this.checkAppClosed(actions, digest)) {
      for (const action of actions) {
        if (action.isTriggered) continue;
        action.isTriggered = true;
        return Promise.resolve();
      }
      // this.crawlingExpires = true;
      // return Promise.resolve();
    }

    return this.refreshScreen().then(() => {
      for (const action of actions) {
        if (action.isTriggered) continue;

        action.isTriggered = true;

        /** log and only log in the current progress */
        /*
        this.currentAction = action;
        this.currentAction.checkInterval();
        */

        // console.debug(findElement(this.source.doc, action.location));
        console.log('Input Event', this.eventCount, depth, digest);
        const event = { cid: `${++this.eventCount}/${digest}`, xpath: action.location };

        // log and only log in the current progress
        // conduct action based on configurable types
        return this.client.send(`/session/${this.sessionId}/element`, 'post', { using: 'xpath', value: action.location }).then((data) => {
          if (data.status !== 0) return Promise.resolve();
          if (this.config.clickTypes.indexOf(action.source.type) >= 0 || action.source.smartDetected) {
            // 1. handle click actions
            this.client.emit('inputDevice', 'click', event);
            return this.client.send(`/session/${this.sessionId}/element/${data.value.ELEMENT}/click`, 'post', {});
          }

          if (this.config.horizontalScrollTypes.indexOf(action.source.type) >= 0) {
            // 2. handle horizontal scroll actions
            event.value = { fromX: 10, fromY: 200, toX: 300, toY: 200, duration: 2.00 };
            this.client.emit('inputDevice', 'swipe', event);
            return this.client.send(`/session/${this.sessionId}/dragfromtoforduration`, 'post', event.value);
          }

          if (this.config.editTypes.indexOf(action.source.type) >= 0) {
            // 3. handle edit actions
            event.value = action.input;
            this.client.emit('inputDevice', 'text', event);
            return this.client.send(`/session/${this.sessionId}/element/${data.value.ELEMENT}/value`, 'post', { value: [action.input] });
          }
        });
      }
    });
  }

  beforeExplore(source) {
    this.explore(source);
    return source;
  }

  checkAppClosed() {
    return this.fail;
  }

  checkElementValidity() {
    return this.pass;
  }

  eraseModelDifference(source) {
    // erase out difference between platforms
    switch (this.config.platform) {
      case 'iOS':
        if (source.attributes) {
          const attrs = source.attributes;
          if (attrs.value) source.text = attrs.value.nodeValue;
          if (attrs.label) source.label = attrs.label.nodeValue;
          if (attrs.name) source.name = attrs.name.nodeValue;
        }
        source.type = source.tagName;
        break;

      case 'Android':
        if (source.attributes) {
          const attrs = source.attributes;
          // v0.9.7.x source.clickable 실험적 추가
          if (attrs.clickable) source.clickable = attrs.clickable.nodeValue === 'true';
          if (attrs.text) source.text = attrs.text.nodeValue;
          if (attrs.label) source.label = attrs.label.nodeValue; // CHECKME
          if (attrs['content-desc']) source['content-desc'] = attrs['content-desc'].nodeValue;
        }
        source.type = source.tagName;
        break;

      case 'PC-Web':
      default:
        if (source.name) {
          source.type = source.name;
        }
        break;
    }
  }

  refreshScreen() {
    // Based on environment, choose the way of refresh screen
    return this.client.send(`/session/${this.sessionId}/screenshot`, 'get')
      .then(data => this.client.emit('saveScreenshot', data));
  }

  insertTabNode(rawElement) {
    // when find a control widget in source structure, call this method to update the node hierachy
    const node = new CrawlingTreeNode(this.client);
    node.actions = this.produceNodeActions(rawElement);
    node.type = 'tab';
    node.depth = this.currentNode.depth;
    node.digest = this.currentNode.digest;
    for (const action of node.actions) node.digest += `/${action.cid}`;

    // check: if there is a similar node in the parent chain, avoid
    let parentNode = this.currentNode.parent;
    while (parentNode) {
      if (parentNode.digest === node.digest) {
        return console.warn('Similar tab elements in parent, abort', parentNode);
      }
      parentNode = parentNode.parent;
    }

    console.log('Insert TabNode', node.digest);
    node.parent = this.currentNode.parent;
    this.currentNode.parent = node;
    this.crawlingBuffer.push(node);
  }

  produceNodeActions(rawElements) {
    const actions = [];
    for (const rawElement of rawElements) {
      if (rawElement) {
        const action = new CrawlingTreeNodeAction(this.client);
        action.source = rawElement;
        action.location = rawElement.xpath;
        action.input = rawElement.input;
        action.cid = uuid(action.location, uuid.URL).split('-')[1];
        actions.push(action);
      }
    }

    return actions;
  }
}

function makeText(length = 5) {
  const possible = '0123456789';
  let text = '';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

/*
function findElement(doc, query) {
  const result = [];
  const type = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
  const xpathResult = doc.evaluate(query, doc, null, type, null);
  const maxResults = 200;
  let i = 0;

  switch (xpathResult.resultType) {
    case XPathResult.UNORDERED_NODE_ITERATOR_TYPE: {
      let n = xpathResult.iterateNext();
      while (n && i < maxResults) {
        result.push({ node: n });
        n = xpathResult.iterateNext();
        i++;
      }
      break;
    }
    case xpathResult.ORDERED_NODE_SNAPSHOT_TYPE:
      for (i = 0; i < xpathResult.snapshotLength; ++i) {
        result.push({ node: xpathResult.snapshotItem(i) });
      }
      break;
    default: break;
  }
  return result;
}
*/
