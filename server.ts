import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

import { register as registerPitchAnalysis } from './tools/pitch-analysis.js'
import { register as registerScoreCalculator } from './tools/score-calculator.js'
import { register as registerMarketAnalysis } from './tools/market-analysis.js'
import { register as registerRenderFeedback } from './tools/render-feedback.js'

const PORT = parseInt(process.env.PORT ?? '3000')

const __dirname = dirname(fileURLToPath(import.meta.url))
const widgetHtml = readFileSync(resolve(__dirname, 'widget.html'), 'utf-8')

export interface ToolContext {
  widgetHtml: string
}

function createPitchMcpServer(): McpServer {
  const server = new McpServer({
    name: 'pitchlink',
    version: '1.0.0',
  })

  const ctx: ToolContext = { widgetHtml }

  registerPitchAnalysis(server, ctx)
  registerMarketAnalysis(server, ctx)
  registerScoreCalculator(server, ctx)
  registerRenderFeedback(server)

  return server
}

const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>()

function setCORS(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, mcp-session-id')
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id')
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  setCORS(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'pitchlink-mcp', version: '1.0.0' }))
    return
  }

  if (url.pathname === '/mcp') {
    // Le Chat hem application/json hem text/event-stream accept eder
    // Accept header yoksa veya eksikse ekleyelim
    const accept = req.headers['accept'] ?? ''
    if (!accept.includes('text/event-stream')) {
      req.headers['accept'] = 'application/json, text/event-stream'
    }

    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined

      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!
        await session.transport.handleRequest(req, res)
      } else {
        const server = createPitchMcpServer()
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        })

        await server.connect(transport)

        transport.onclose = () => {
          const sid = transport.sessionId
          if (sid) sessions.delete(sid)
        }

        await transport.handleRequest(req, res)

        const sid = transport.sessionId
        if (sid) sessions.set(sid, { server, transport })
      }
    } catch (err) {
      console.error('MCP error:', err)
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal server error' }))
      }
    }
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

httpServer.listen(PORT, () => {
  console.log(`🚀 PitchLink MCP server running on port ${PORT}`)
  console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`)
})