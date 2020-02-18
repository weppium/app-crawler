import CrawlerBase from './base';

export default class AndroidCrawler extends CrawlerBase {
  checkElementValidity(source) {
    if (this.config.platform !== 'Android') return false;
    if (!source.tagName
      || source.tagName.indexOf('Layout') >= 0
      || source.tagName.indexOf('.View') >= 0) {
      return false;
    }
    return true;
  }

  insertXPath(parent, child) {
    if (this.config.platform !== 'Android') return null;

    // scan and check index path for once and only once
    let currentTypeCount = `${child.tagName}_count`;
    if (!parent[currentTypeCount]) {
      if (parent.children) {
        for (let i = 0; i < parent.children.length; i++) {
          currentTypeCount = `${parent.children[i].tagName}_count`;
          if (!parent[currentTypeCount]) {
            parent[currentTypeCount] = 1;
          } else {
            parent[currentTypeCount]++;
          }
          if (parent.children[i]) {
            parent.children[i].pathInParent = parent[currentTypeCount];
          }
        }
      } else {
        parent.pathInParent = 1;
      }
    }

    const currentIndex = child.pathInParent;
    const prefixXPath = parent.xpath ? `${parent.xpath}/` : '//';
    child.xpath = `${prefixXPath}${child.tagName}[${currentIndex}]`;
  }

  beforeExplore(source) {
    if (!source.value) return null;
    source.dump = source.value;
    const type = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
    const raw = source.value.replace(/\n|\r|\\n/gi, '');
    try {
      const doc = (new DOMParser()).parseFromString(raw, 'text/xml');
      const root = doc.evaluate('//hierarchy/*', doc, null, type, null);
      const target = root.snapshotItem(root.snapshotLength > 1 ? 1 : 0);
      source.value = target;
      this.explore(source);
    } catch (err) {
      console.warn('parsing error: ', err);
    }
    return source;
  }

  checkAppClosed(actions, digest) {
    const activity = digest.split('/')[5];
    if (activity && this.config.activities.indexOf(activity) === -1) {
      console.warn('Wrong Activity Detected', activity);
      return true;
    }
    return false;
  }
}
