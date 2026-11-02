import { describe, expect, test } from 'bun:test'
import { probeCatalog } from './catalog-smoke'

describe('catalog Docker smoke probe', () => {
  test('accepts an empty catalog and both missing slugs', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (new URL(request.url).pathname === '/components') {
          return Response.json({ items: [], page: 1, pageSize: 12, total: 0 })
        }
        return Response.json({ code: 'NOT_FOUND' }, { status: 404 })
      },
    })
    try {
      expect((await probeCatalog(server.url.origin)).map((result) => result.passed)).toEqual([
        true,
        true,
        true,
      ])
    } finally {
      server.stop(true)
    }
  })

  test('rejects a wrong list payload, wrong status, and malformed JSON', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname
        if (path === '/components')
          return Response.json({ items: [], page: 1, pageSize: 12, total: 1 })
        if (path === '/components/__smoke__') return Response.json({ code: 'NOT_FOUND' })
        return new Response('not json', { status: 404 })
      },
    })
    try {
      expect((await probeCatalog(server.url.origin)).map((result) => result.passed)).toEqual([
        false,
        false,
        false,
      ])
    } finally {
      server.stop(true)
    }
  })

  test('rejects a 404 with the wrong error code', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (new URL(request.url).pathname === '/components') {
          return Response.json({ items: [], page: 1, pageSize: 12, total: 0 })
        }
        return Response.json({ code: 'OTHER_ERROR' }, { status: 404 })
      },
    })
    try {
      expect((await probeCatalog(server.url.origin)).map((result) => result.passed)).toEqual([
        true,
        false,
        false,
      ])
    } finally {
      server.stop(true)
    }
  })
})
