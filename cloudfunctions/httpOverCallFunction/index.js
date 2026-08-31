/**
 * HTTP 转发云函数（CloudBase 微信云开发认证通道必需）
 *
 * 当客户端以 useWxCloud: true 调用 signInWithOpenId 时，SDK（@cloudbase/js-sdk）
 * 通过 wx.cloud.callFunction 调用本函数，把原本走 HTTP 网关的认证请求转发出去：
 *
 *   wx.cloud.callFunction({
 *     name: 'httpOverCallFunction',
 *     data: { url, method, headers, body }
 *   })
 *
 * SDK 期望的返回值结构（result 即本函数 main 的返回值）：
 *   { statusCode, statusMessage, headers, body }
 * - 认证通道：读取 result.body 并直接按 JSON 对象使用（访问 body.error_code 等）
 * - 数据库/ORM 通道：读取 result.statusCode / statusMessage / headers / body
 *
 * 因此 body 优先返回解析后的 JSON 对象；无法解析时保留原始字符串。
 */
const http = require('http')
const https = require('https')

exports.main = async (event) => {
  const { url, method = 'GET', headers = {}, body } = event || {}

  // 调试日志：部署后可在云函数日志查看真实转发目标
  console.log('[httpOverCallFunction] forward:', method.toUpperCase(), url)

  let target = url
  if (!/^https?:\/\//i.test(target || '')) {
    // 兜底：相对路径时拼环境网关（正常由 SDK 传入完整 URL，一般不会走到这里）
    const envId = process.env.TCB_ENV || ''
    target = `https://${envId}.api.tcloudbasegateway.com${target.startsWith('/') ? target : `/${target}`}`
  }

  const u = new URL(target)
  const client = u.protocol === 'https:' ? https : http

  // 去除压缩请求头：Node 原生 http 不自动解压 gzip，强制 identity 保证 body 可解析
  const forwardHeaders = { ...(headers || {}) }
  delete forwardHeaders['accept-encoding']
  delete forwardHeaders['Accept-Encoding']

  const options = {
    hostname: u.hostname,
    port: u.port || (u.protocol === 'https:' ? 443 : 80),
    path: u.pathname + u.search,
    method: String(method).toUpperCase(),
    headers: forwardHeaders,
  }

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        let parsed = raw
        try {
          parsed = JSON.parse(raw)
        } catch (e) {
          // 非 JSON 响应，保留原始文本
        }
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: parsed,
        })
      })
    })
    req.on('error', (err) => {
      console.error('[httpOverCallFunction] forward error:', err.message)
      reject({ code: 'FORWARD_ERROR', message: err.message })
    })
    if (body !== undefined && body !== null && body !== '') {
      req.write(typeof body === 'string' ? body : JSON.stringify(body))
    }
    req.end()
  })
}
