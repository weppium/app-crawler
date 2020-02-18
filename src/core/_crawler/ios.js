import CrawlerBase from './base';

export default class IOSCrawler extends CrawlerBase {
  insertXPath(parent, child) {
    if (this.config.platform !== 'iOS') return null;

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
    const prefixXPath = parent.xpath ? `${parent.xpath}/` : '//XCUIElementTypeApplication[1]/';
    child.xpath = `${prefixXPath}${child.tagName}[${currentIndex}]`;
  }

  beforeExplore(source) {
    if (!source.value) return null;
    source.dump = source.value.replace(/\s(name|value|label)="AX error -25205"/g, '');
    const type = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
    const raw = source.dump.replace(/\n|\r|\\n/gi, '');
    try {
      const doc = (new DOMParser()).parseFromString(raw, 'text/xml');
      const root = doc.evaluate('//XCUIElementTypeApplication', doc, null, type, null);
      const target = root.snapshotItem(root.snapshotLength > 1 ? 1 : 0);
      // source.doc = doc;
      source.value = target;
      this.explore(source);
    } catch (err) {
      console.warn('parsing error: ', err);
    }
    return source;
  }
}
