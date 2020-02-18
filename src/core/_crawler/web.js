import path from 'path';
import CrawlerBase from './base';

export default class WebCrawler extends CrawlerBase {
  sortActionPriority(actions, crawler) {
    console.log(this.config.platform, crawler);
    return actions;
  }

  insertXPath(parent, child) {
    console.log(this.config.platform, parent, child);
  }

  performAction(actions) {
    this.refreshScreen();

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (!action.isTriggered) {
        action.isTriggered = true;

        // conduct action based on configurable types
        if (this.config.clickTypes.indexOf(action.source.type) >= 0) {
          // 1. handle click actions
          if (action.source.attribs && action.source.attribs.href) {
            let { href } = action.source.attribs;
            if (href.startsWith('//')) {
              href = `https:${href}`;
            } else if ((href.startsWith('.') || href.startsWith('/')) && href.length > 1) {
              const matches = this.currentNode.url.match(/:\/\/(.[^/]+)/);
              const protocol = this.currentNode.url.split('://')[0];
              href = path.join(`${protocol}://`, matches[1], href);
            } else {
              href = '';
            }

            let stop = false;
            for (let idx = 0; idx < this.config.blacklist.length && !stop; idx++) {
              if (href.indexOf(this.config.blacklist[idx]) >= 0) {
                href = '';
                stop = true;
              }
            }

            /** Trigger click only if the link is valid */
            if (href.length > 0) {
              console.log(href);
              global.client.send(`/session/${this.sessionId}/url`, 'POST', { url: href });
            }
          }
        } else if (this.config.horizontalScrollTypes.indexOf(action.source.type) >= 0) {
          /** 2. handle horizontal scroll actions */
        } else if (this.config.editTypes.indexOf(action.source.type) >= 0) {
          /** 3. handle edit actions */
        }
        return;
      }
    }
  }

  beforeExplore(source) {
    const raw = source.value.replace(/\n|\r|\\n/gi, '');
    try {
      const dom = (new DOMParser()).parseFromString(raw, 'text/html');
      const target = dom[dom.length - 1].children[dom[dom.length - 1].children.length - 1];
      source.value = target;
      this.explore(source);
    } catch (err) {
      console.log('parsing error: ', err);
    }
  }
}
