// src/subcommands/server.ts

import type { CommandModule } from 'yargs'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import * as config from './config'
import * as devTools from './devTools'
import * as payload from './payload'
import * as permission from './permission'
import * as sessionExplicit from './sessionExplicit'
import * as signatureUtils from './signature'

// Basic JSON-RPC types
interface JsonRpcRequest {
  jsonrpc: string
  method: string
  params?: any
  id?: number | string
}

interface JsonRpcSuccessResponse {
  jsonrpc: '2.0'
  result: any
  id?: number | string
}

interface JsonRpcErrorResponse {
  jsonrpc: '2.0'
  error: {
    code: number
    message: string
    data?: any
  }
  id?: number | string
}

function successResponse(id: number | string | undefined, result: any): JsonRpcSuccessResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  }
}

function errorResponse(
  id: number | string | undefined,
  code: number,
  message: string,
  data?: any,
): JsonRpcErrorResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  }
}

// We collect all of the CLI methods into a single map that can be invoked by name.
const rpcMethods: Record<string, (params: any) => Promise<any>> = {
  // CONFIG
  async config_new(params) {
    const { threshold, checkpoint, from = 'flat', content } = params
    const result = await config.createConfig({ threshold, checkpoint, from, content })
    return result
  },
  async config_imageHash(params) {
    const { input } = params
    const result = await config.calculateImageHash(input)
    return result
  },
  async config_encode(params) {
    const { input } = params
    const result = await config.doEncode(input)
    return result
  },

  // DEV TOOLS
  async devTools_randomConfig(params) {
    const { maxDepth = 3, seed, minThresholdOnNested = 0, checkpointer = 'no' } = params
    const options: devTools.RandomOptions = {
      seededRandom: seed ? devTools.createSeededRandom(seed) : undefined,
      minThresholdOnNested,
      checkpointerMode: checkpointer as 'no' | 'random' | 'yes',
    }
    const result = await devTools.doRandomConfig(maxDepth, options)
    return result
  },
  async devTools_randomSessionTopology(params) {
    const { maxDepth = 1, maxPermissions = 1, maxRules = 1, seed } = params
    const options: devTools.RandomOptions = {
      seededRandom: seed ? devTools.createSeededRandom(seed) : undefined,
      maxPermissions,
      maxRules,
    }
    const result = await devTools.doRandomSessionTopology(maxDepth, options)
    return result
  },

  // PAYLOAD
  async payload_toAbi(params) {
    const { payload: inputPayload } = params
    const result = await payload.doConvertToAbi(inputPayload)
    return result
  },
  async payload_toPacked(params) {
    const { payload: inputPayload } = params
    const result = await payload.doConvertToPacked(inputPayload)
    return result
  },
  async payload_toJson(params) {
    const { payload: inputPayload } = params
    const result = await payload.doConvertToJson(inputPayload)
    return result
  },

  // PERMISSION
  async permission_toPackedSession(params) {
    const { sessionPermission } = params
    const result = await permission.doEncodeSessionPermissions(sessionPermission)
    return result
  },
  async permission_toPacked(params) {
    const { permission: perm } = params
    const result = await permission.doEncodePermission(perm)
    return result
  },

  // SESSION EXPLICIT
  async session_empty(_params) {
    return await sessionExplicit.doEmptySession()
  },
  async session_add(params) {
    const { explicitSession, sessionTopology } = params
    const result = await sessionExplicit.doAddSession(explicitSession, sessionTopology)
    return result
  },
  async session_remove(params) {
    const { explicitSessionAddress, sessionTopology } = params
    const result = await sessionExplicit.doRemoveSession(explicitSessionAddress, sessionTopology)
    return result
  },
  async session_use(params) {
    const { signature, permissionIndexes, sessionTopology } = params
    const result = await sessionExplicit.doUseSession(signature, permissionIndexes, sessionTopology)
    return result
  },
  async session_toPackedTopology(params) {
    const { sessionTopology } = params
    const result = await sessionExplicit.doEncodeSessionsTopology(sessionTopology)
    return result
  },

  // SIGNATURE
  async signature_encode(params) {
    const { input, signature: sigArr = [], chainId = true } = params
    const result = await signatureUtils.doEncode(input, sigArr, !chainId)
    return result
  },
  async signature_concat(params) {
    const { signatures } = params
    const result = await signatureUtils.doConcat(signatures)
    return result
  },
  async signature_decode(params) {
    const { signature: sig } = params
    const result = await signatureUtils.doDecode(sig)
    return result
  },
}

async function handleSingleRequest(rpcRequest: JsonRpcRequest): Promise<JsonRpcSuccessResponse | JsonRpcErrorResponse> {
  const { id, jsonrpc, method, params } = rpcRequest
  if (jsonrpc !== '2.0') {
    return errorResponse(id, -32600, 'Invalid JSON-RPC version')
  }
  const fn = rpcMethods[method]
  if (!fn) {
    return errorResponse(id, -32601, `Method not found: ${method}`)
  }
  try {
    const result = await fn(params ?? {})
    return successResponse(id, result)
  } catch (err: any) {
    return errorResponse(id, -32000, err?.message ?? 'Unknown error')
  }
}

async function handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
  // Only handle POST /rpc
  if (req.method !== 'POST' || req.url !== '/rpc') {
    res.statusCode = 404
    res.end('Not Found')
    return
  }

  // Read the request body
  let body = ''
  for await (const chunk of req) {
    body += chunk
  }

  // Try to parse JSON. If invalid, return an error
  let rpcRequests: JsonRpcRequest[] | JsonRpcRequest
  try {
    rpcRequests = JSON.parse(body)
  } catch (error) {
    res.statusCode = 400
    res.end(JSON.stringify(errorResponse(undefined, -32700, 'Parse error', String(error))))
    return
  }

  // Might be a batch request (array of requests) or a single request
  if (Array.isArray(rpcRequests)) {
    const results = await Promise.all(rpcRequests.map(handleSingleRequest))
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(results))
  } else {
    const result = await handleSingleRequest(rpcRequests)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  }
}

async function startServer(host: string, port: number) {
  const server = createServer((req, res) => {
    handleHttpRequest(req, res).catch((err) => {
      // If something truly unexpected happens, respond with 500
      res.statusCode = 500
      res.end(JSON.stringify(errorResponse(undefined, -32000, 'Internal server error', String(err))))
    })
  })

  server.listen(port, host, () => {
    console.log(`RPC server running at http://${host}:${port}/rpc`)
  })
}

const serverCommand: CommandModule = {
  command: 'server',
  describe: 'Run a JSON-RPC server exposing all CLI functionality, without using Express',
  builder: (yargs) => {
    return yargs
      .option('host', {
        type: 'string',
        description: 'Hostname to listen on',
        default: '127.0.0.1',
      })
      .option('port', {
        type: 'number',
        description: 'Port to listen on',
        default: 3000,
      })
  },
  handler: async (argv) => {
    const host = argv.host as string
    const port = argv.port as number
    await startServer(host, port)
  },
}

export default serverCommand
