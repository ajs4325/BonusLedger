import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'

const base = 'https://example.github.io/BonusLedger/'
const location = new URL('sw.js', base)
const output = new URL('../dist/', import.meta.url)
class WorkerRequest extends Request {
  constructor(input, options) {
    super(typeof input === 'string' ? new URL(input, location) : input, options)
  }
}
const readPublishedFile = url => {
  const path = new URL(url, base).pathname
  assert.ok(path.startsWith('/BonusLedger/'), 'Asset must resolve under the Pages project path')
  const file = path.slice('/BonusLedger/'.length) || 'index.html'
  return readFileSync(fileURLToPath(new URL(file, output)))
}

// Run the built Workbox worker with browser-shaped storage and events.
// Only the network adapter and service worker host are substituted.
const listeners = new Map()
const cacheStores = new Map()
const keyFor = request => typeof request === 'string' ? new URL(request, base).href : request.url

const caches = {
  async open(name) {
    if (!cacheStores.has(name)) cacheStores.set(name, new Map())
    const entries = cacheStores.get(name)
    return {
      async put(request, response) { entries.set(keyFor(request), response.clone()) },
      async match(request) { return entries.get(keyFor(request))?.clone() },
      async keys() { return [...entries.keys()].map(url => new Request(url)) },
      async delete(request) { return entries.delete(keyFor(request)) },
    }
  },
  async match(request, { cacheName } = {}) {
    return cacheStores.get(cacheName)?.get(keyFor(request))?.clone()
  },
  async keys() { return [...cacheStores.keys()] },
  async delete(name) { return cacheStores.delete(name) },
}

class ExtendableEvent {
  pending = []
  waitUntil(promise) { this.pending.push(promise) }
  async settle() {
    for (const promise of this.pending) await promise
  }
}

class FetchEvent extends ExtendableEvent {
  constructor(request) {
    super()
    this.request = request
  }
  respondWith(response) { this.response = response }
}

let online = true
let networkReads = 0
const context = createContext({
  URL, URLSearchParams, Request: WorkerRequest, Response, Headers, FetchEvent, caches, location, console, setTimeout,
  registration: { scope: base },
  addEventListener(type, listener) {
    if (!listeners.has(type)) listeners.set(type, [])
    listeners.get(type).push(listener)
  },
  importScripts(url) { runInContext(readPublishedFile(url).toString(), context, { filename: url }) },
  async fetch(request) {
    assert.ok(online, `Unexpected network request while offline: ${keyFor(request)}`)
    networkReads++
    return new Response(readPublishedFile(keyFor(request)))
  },
})
context.self = context
runInContext(readPublishedFile(location).toString(), context, { filename: 'sw.js' })

// Workbox registers handlers after its AMD dependencies finish loading.
await new Promise(resolve => setImmediate(resolve))
async function dispatch(type, event) {
  event.type = type
  const handlers = listeners.get(type)
  assert.ok(handlers?.length, `Expected service worker to handle ${type}`)
  for (const listener of handlers) listener(event)
  const response = await event.response
  await event.settle()
  return response
}

await dispatch('install', new ExtendableEvent())
await dispatch('activate', new ExtendableEvent())
const precacheReads = networkReads
assert.ok(precacheReads > 0)
online = false

async function cached(path, navigation = false) {
  const request = new WorkerRequest(new URL(path, base))
  // Node's Request constructor only supports client request modes.
  if (navigation) Object.defineProperty(request, 'mode', { value: 'navigate' })
  const response = await dispatch('fetch', new FetchEvent(request))
  assert.ok(response?.ok, `Expected a cached response for ${request.url}`)
  const content = Buffer.from(await response.arrayBuffer())
  return content
}

for (const path of ['', 'promotions/offline-navigation', '#/calendar']) {
  assert.deepEqual(await cached(path, true), readPublishedFile('index.html'))
}
const html = (await cached('index.html')).toString()
const assets = [...html.matchAll(/(?:src|href)="(\/BonusLedger\/[^"]+)"/g)].map(match => match[1])
assert.ok(assets.some(url => url.endsWith('.js')))
assert.ok(assets.some(url => url.endsWith('.css')))
for (const asset of assets) assert.deepEqual(await cached(asset), readPublishedFile(asset))
const manifest = JSON.parse((await cached('manifest.webmanifest')).toString())
assert.equal(manifest.start_url, '/BonusLedger/')
assert.equal(manifest.scope, '/BonusLedger/')
assert.equal(manifest.display, 'standalone')
for (const icon of manifest.icons) {
  const file = await cached(icon.src)
  assert.equal(file.subarray(1, 4).toString(), 'PNG')
  const [width, height] = icon.sizes.split('x').map(Number)
  assert.equal(file.readUInt32BE(16), width)
  assert.equal(file.readUInt32BE(20), height)
}
assert.equal(networkReads, precacheReads)
console.log(`Offline build verified: ${precacheReads} files precached, Pages navigation and all install assets served from cache.`)
