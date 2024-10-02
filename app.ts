import uWS, { HttpRequest, HttpResponse } from 'uWebSockets.js'
import { match as pr_matcher } from 'path-to-regexp'
import cookie, { CookieSerializeOptions } from 'cookie'
import querystring, { ParsedUrlQuery } from 'node:querystring'

type EachRouteObject = {
	method: string
	matchRoute: ReturnType<typeof pr_matcher>
	handler: (req: requestObject, res: responseObject, next: () => void) => any
}
type requestObject = {
	raw: HttpRequest
	method: String
	headers: Record<string, string>
	getHeader: (name: string) => string | undefined
	cookies: ReturnType<(typeof cookie)['parse']>
	getCookie: (name: string) => string | undefined
	path: string
	query: ParsedUrlQuery
	params: Record<string, string>
}
type responseObject = {
	raw: HttpResponse
	send: (data?: Parameters<HttpResponse['end']>[0] | object, type?: string) => void
	sendEmpty: () => void
	sendStatus: (code: number) => void
	setStatus: (code: number) => responseObject
	setHeader: (name: string, value: string) => responseObject
	setCookie: (name: string, value: string, options?: CookieSerializeOptions) => responseObject
	deleteCookie: (name: string, options?: CookieSerializeOptions) => responseObject
}

class ReqRes {
	req: requestObject
	res: responseObject

	constructor(req: HttpRequest, res: HttpResponse, routeData: any) {
		this.req = {
			raw: req,
			method: routeData.method,
			headers: (() => {
				const obj: Record<string, string> = {}
				req.forEach((k, v) => {
					obj[k] = v
				})
				return obj
			})(),
			getHeader: name => this.req.headers[name],
			cookies: cookie.parse(req.getHeader('cookie')),
			getCookie: name => this.req.cookies[name],
			path: routeData.path,
			params: routeData.params,
			query: querystring.parse(req.getQuery())
		}
		this.res = {
			raw: res,
			send: (data, type) => {
				if (typeof data === 'object') {
					res.writeHeader('content-type', type || 'application/json').end(JSON.stringify(data))
					return
				}
				if (type) res.writeHeader('content-type', type)
				res.end(data)
				return
			},
			sendEmpty: () => {
				res.end()
				return
			},
			sendStatus: code => {
				res.writeStatus(code.toString())
				res.end()
				return
			},
			setStatus: code => {
				res.writeStatus(code.toString())
				return this.res
			},
			setHeader: (name, value) => {
				res.writeHeader(name, value)
				return this.res
			},
			setCookie: (name, value, options) => {
				res.writeHeader('Set-Cookie', cookie.serialize(name, value, options))
				return this.res
			},
			deleteCookie: (name, options) => {
				res.writeHeader('Set-Cookie', cookie.serialize(name, '', { ...options, expires: new Date(0) }))
				return this.res
			}
		}
	}
}

function routeHandler(req: HttpRequest, res: HttpResponse, routes: EachRouteObject[]) {
	let routeData: any = undefined
	const method = req.getMethod()
	const path = req.getUrl()

	const routeInd = routes.findIndex(el => {
		if (el.method !== method && el.method !== '*') return false
		const data = el.matchRoute(path)
		if (data) {
			routeData = { ...data, method, path }
			return true
		}
		return false
	})

	if (routeInd === -1) {
		res.writeStatus('404')
		res.end(`Not Found: ${path}`)
	} else {
		const reqRes = new ReqRes(req, res, routeData)
		routes[routeInd].handler(reqRes.req, reqRes.res, () => {
			routeHandler(req, res, routes.slice(routeInd + 1))
		})
	}
}

export default (options: uWS.AppOptions = {}) => {
	const app: uWS.TemplatedApp = uWS.App(options)
	const routes: EachRouteObject[] = []
	/* @ts-ignore */
	let listenSocket: any = null

	app.any('/*', (res, req) => {
		try {
			try {
				routeHandler(req, res, routes)
			} catch (e) {
				console.log(e)
				res.writeStatus('500')
				res.end('Some errors have occured')
			}
		} catch (e) {
			console.log(e)
		}
	})

	return class {
		static listen(host: string, port: number, cb?: Function) {
			app.listen(host, port, n => {
				listenSocket = n
				if (cb) cb()
			})
		}

		static use(handler: EachRouteObject['handler']) {
			routes.push({ method: '*', matchRoute: pr_matcher('*'), handler })
			return this
		}
		static all(route: string, handler: EachRouteObject['handler']) {
			routes.push({ method: '*', matchRoute: pr_matcher(route), handler })
			return this
		}
		static get(route: string, handler: EachRouteObject['handler']) {
			routes.push({ method: 'get', matchRoute: pr_matcher(route), handler })
			return this
		}
		static post(route: string, handler: EachRouteObject['handler']) {
			routes.push({ method: 'post', matchRoute: pr_matcher(route), handler })
			return this
		}
		static put(route: string, handler: EachRouteObject['handler']) {
			routes.push({ method: 'put', matchRoute: pr_matcher(route), handler })
			return this
		}
		static delete(route: string, handler: EachRouteObject['handler']) {
			routes.push({ method: 'delete', matchRoute: pr_matcher(route), handler })
			return this
		}
	}
}
