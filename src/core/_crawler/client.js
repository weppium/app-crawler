import { EventEmitter } from 'events';

export default class WDClient extends EventEmitter {
  constructor({ server, desiredCapabilities }) {
    super();
    this.server = desiredCapabilities.platformName === 'iOS' ? server : `${server}/wd/hub`;
    this.desiredCapabilities = desiredCapabilities;
    this.restore();
  }

  restore() {
    return this.send('/sessions', 'get').then((data) => {
      if (data.value.length) this.sessionId = data.value[0].id;
    });
  }

  start() {
    const { sessionId, desiredCapabilities } = this;
    if (sessionId) return this.emit('sessionCreated', { sessionId });

    console.debug('WDClient.startSession', desiredCapabilities);
    const { platformName } = desiredCapabilities;
    this.send('/session', 'post', { desiredCapabilities }).then((data) => {
      this.sessionId = data.sessionId;

      // for desktop, shall open the url
      if (desiredCapabilities.platformName === 'Desktop') {
        const { url } = desiredCapabilities;
        this.send(`/session/${this.sessionId}/url`, 'post', { url }).then(() => this.emit('sessionCreated', data));
      } else {
        // iOS는 앱이 초기화되기까지 기다려주지 않고 바로 세션이 생성됨
        if (platformName === 'iOS') {
          return this.send('/status', 'get').then(() => this.emit('sessionCreated', data));
          // return setTimeout(() => this.emit('sessionCreated', data), 8000);
        }
        this.emit('sessionCreated', data);
      }
    });
  }

  end() {
    if (!this.sessionId) {
      return this.emit('sessionDeleted');
    }

    this.quit = () => {
      console.debug('WDClient.endSession');
      this.send(`/session/${this.sessionId}`, 'delete');
      this.emit('sessionDeleted');
      this.sessionId = null;
    };

    if (!this.busy) this.next();
  }

  next(data) {
    if (this.quit) {
      this.quit();
      delete this.quit;
    }
    this.busy = false;
    return data;
  }

  send(url, method, data = null) {
    if (url.startsWith('/session/') && !this.sessionId) {
      return Promise.resolve({ value: '' });
    }

    this.busy = true;
    const body = method === 'post' ? { body: JSON.stringify(data) } : {};
    return fetch(`${this.server}${url}`, {
      method: method.toUpperCase(),
      headers: { 'Content-Type': 'application/json' },
      ...body
    })
      .then(res => res.json())
      .then((res) => {
        if (!url.startsWith('/sessions') && res.status !== 0) {
          console.warn(method, url, data, `\nWDAError:${res.status} - ${res.value.description || res.value}`);
        }
        return this.next(res);
      });
  }
}
