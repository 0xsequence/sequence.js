import type { CommandModule } from 'yargs'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import * as config from './config.js'
import * as devTools from './devTools.js'
import * as payload from './payload.js'
import * as session from './session.js'
import * as sessionExplicit from './sessionExplicit.js'
import * as sessionImplicit from './sessionImplicit.js'
import * as signatureUtils from './signature.js'
import * as address from './address.js'
import * as recovery from './recovery.js'
import * as passkeys from './passkeys.js'

// Basic JSON-RPC types
interface JsonRpcRequest {
  jsonrpc: string
  method: string
  params?: any // eslint-disable-line @typescript-eslint/no-explicit-any
  id?: number | string
}

interface JsonRpcSuccessResponse {
  jsonrpc: '2.0'
  result: any // eslint-disable-line @typescript-eslint/no-explicit-any
  id?: number | string
}

interface JsonRpcErrorResponse {
  jsonrpc: '2.0'
  error: {
    code: number
    message: string
    data?: any // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  id?: number | string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  data?: any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpcMethods: Record<string, (params: any) => Promise<any>> = {
  // CONFIG
  async config_new(params) {
    const { threshold, checkpoint, from = 'flat', content, checkpointer } = params
    const result = await config.createConfig({ threshold, checkpoint, from, content: content.split(' '), checkpointer })
    return result
  },
  async config_imageHash(params) {
    const { input } = params
    const result = await config.calculateImageHash(JSON.stringify(input))
    return result
  },
  async config_encode(params) {
    const { input } = params
    const result = await config.doEncode(JSON.stringify(input))
    return result
  },

  // DEV TOOLS
  async devTools_randomConfig(params) {
    const { maxDepth = 3, seed, minThresholdOnNested = 0, checkpointer = 'no', skewed } = params
    const options: devTools.RandomOptions = {
      seededRandom: seed ? devTools.createSeededRandom(seed) : undefined,
      minThresholdOnNested,
      checkpointerMode: checkpointer as 'no' | 'random' | 'yes',
      skewed: skewed as 'left' | 'right' | 'none',
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
    const { payload: inputPayload, wallet } = params
    const result = await payload.doConvertToPacked(inputPayload, wallet)
    return result
  },
  async payload_toJson(params) {
    const { payload: inputPayload } = params
    const result = await payload.doConvertToJson(inputPayload)
    return result
  },
  async payload_hashFor(params) {
    const result = await payload.doHash(params.wallet, params.chainId, params.payload)
    return result
  },

  // SESSION
  async session_empty(params) {
    const { identitySigner } = params
    const result = await session.doEmptyTopology(identitySigner)
    return result
  },
  async session_encodeTopology(params) {
    const { sessionTopology } = params
    const result = await session.doEncodeTopology(JSON.stringify(sessionTopology))
    return result
  },
  async session_encodeCallSignatures(params) {
    const { sessionTopology, callSignatures, explicitSigners, implicitSigners, identitySigner } = params
    const result = await session.doEncodeSessionCallSignatures(
      JSON.stringify(sessionTopology),
      callSignatures.map(JSON.stringify),
      explicitSigners,
      implicitSigners,
      identitySigner,
    )
    return result
  },
  async session_imageHash(params) {
    const { sessionTopology } = params
    const result = await session.doImageHash(JSON.stringify(sessionTopology))
    return result
  },

  // SESSION EXPLICIT
  async session_explicit_add(params) {
    const { explicitSession, sessionTopology } = params
    const result = await sessionExplicit.doAddSession(JSON.stringify(explicitSession), JSON.stringify(sessionTopology))
    return result
  },
  async session_explicit_remove(params) {
    const { explicitSessionAddress, sessionTopology } = params
    const result = await sessionExplicit.doRemoveSession(explicitSessionAddress, JSON.stringify(sessionTopology))
    return result
  },

  // SESSION IMPLICIT
  async session_implicit_addBlacklistAddress(params) {
    const { blacklistAddress, sessionTopology } = params
    const result = await sessionImplicit.doAddBlacklistAddress(blacklistAddress, JSON.stringify(sessionTopology))
    return result
  },
  async session_implicit_removeBlacklistAddress(params) {
    const { blacklistAddress, sessionTopology } = params
    const result = await sessionImplicit.doRemoveBlacklistAddress(blacklistAddress, JSON.stringify(sessionTopology))
    return result
  },

  // SIGNATURE
  async signature_encode(params) {
    const { input, signatures, chainId = true, checkpointerData } = params
    const result = await signatureUtils.doEncode(
      JSON.stringify(input),
      signatures.split(' '),
      !chainId,
      checkpointerData,
    )
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

  // ADDRESS
  async address_calculate(params) {
    const { imageHash, factory, module, creationCode } = params
    return await address.doCalculateAddress({ imageHash, factory, module, creationCode })
  },

  // RECOVERY
  async recovery_hashFromLeaves(params) {
    const { leaves } = params
    const result = await recovery.doHashFromLeaves(leaves)
    return result
  },
  async recovery_encode(params) {
    const { leaves } = params
    const result = await recovery.doEncode(leaves)
    return result
  },
  async recovery_trim(params) {
    const { leaves, signer } = params
    const result = await recovery.doTrim(leaves, signer)
    return result
  },
  async recovery_hashEncoded(params) {
    const { encoded } = params
    const result = await recovery.doHashEncoded(encoded)
    return result
  },

  // PASSKEYS
  async passkeys_encodeSignature(params) {
    const result = await passkeys.doEncodeSignature(params)
    return result
  },
  async passkeys_decodeSignature(params) {
    const { encodedSignature } = params
    const resultString = await passkeys.doDecodeSignature(encodedSignature)
    return JSON.parse(resultString)
  },
  async passkeys_computeRoot(params) {
    const result = await passkeys.doComputeRoot(params)
    return result
  },
  async passkeys_validateSignature(params) {
    const result = await passkeys.doValidateSignature(params)
    return result
  },
}

async function handleSingleRequest(
  rpcRequest: JsonRpcRequest,
  debug: boolean,
  silent: boolean,
): Promise<JsonRpcSuccessResponse | JsonRpcErrorResponse> {
  const { id, jsonrpc, method, params } = rpcRequest

  if (!silent) console.log(`[${new Date().toISOString()}] Processing request: method=${method} id=${id}`)
  if (debug && !silent) {
    console.log('Request details:', JSON.stringify(rpcRequest, null, 2))
  }

  if (jsonrpc !== '2.0') {
    const error = errorResponse(id, -32600, 'Invalid JSON-RPC version')
    if (!silent)
      console.log(
        `[${new Date().toISOString()}] Error response:`,
        debug ? JSON.stringify(error, null, 2) : error.error.message,
      )
    return error
  }

  const fn = rpcMethods[method]
  if (!fn) {
    const error = errorResponse(id, -32601, `Method not found: ${method}`)
    if (!silent)
      console.log(
        `[${new Date().toISOString()}] Error response:`,
        debug ? JSON.stringify(error, null, 2) : error.error.message,
      )
    return error
  }

  try {
    const result = await fn(params ?? {})
    const response = successResponse(id, result)
    if (!silent) console.log(`[${new Date().toISOString()}] Success response for method=${method} id=${id}`)
    if (debug && !silent) {
      console.log('Response details:', JSON.stringify(response, null, 2))
    }
    return response
  } catch (err: unknown) {
    const error = errorResponse(id, -32000, err instanceof Error ? err.message : 'Unknown error')
    if (!silent)
      console.log(
        `[${new Date().toISOString()}] Error response:`,
        debug ? JSON.stringify(error, null, 2) : error.error.message,
      )
    return error
  }
}

async function handleHttpRequest(req: IncomingMessage, res: ServerResponse, debug: boolean, silent: boolean) {
  if (!silent) console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.socket.remoteAddress}`)

  // Only handle POST /rpc
  if (req.method !== 'POST' || req.url !== '/rpc') {
    if (!silent) console.log(`[${new Date().toISOString()}] 404 Not Found`)
    res.statusCode = 404
    res.end('Not Found')
    return
  }

  // Read the request body
  let body = ''
  for await (const chunk of req) {
    body += chunk
  }

  if (debug && !silent) {
    console.log('Raw request body:', body)
  }

  // Try to parse JSON. If invalid, return an error
  let rpcRequests: JsonRpcRequest[] | JsonRpcRequest
  try {
    rpcRequests = JSON.parse(body)
  } catch (error) {
    if (!silent) console.log(`[${new Date().toISOString()}] JSON parse error:`, error)
    res.statusCode = 400
    res.end(JSON.stringify(errorResponse(undefined, -32700, 'Parse error', String(error))))
    return
  }

  // Might be a batch request (array of requests) or a single request
  if (Array.isArray(rpcRequests)) {
    if (!silent) console.log(`[${new Date().toISOString()}] Processing batch request with ${rpcRequests.length} items`)
    const results = await Promise.all(rpcRequests.map((req) => handleSingleRequest(req, debug, silent)))
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(results))
  } else {
    const result = await handleSingleRequest(rpcRequests, debug, silent)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  }
}

async function startServer(host: string, port: number, debug: boolean, silent: boolean) {
  const server = createServer((req, res) => {
    handleHttpRequest(req, res, debug, silent).catch((err) => {
      // If something truly unexpected happens, respond with 500
      if (!silent) console.error(`[${new Date().toISOString()}] Internal server error:`, err)
      res.statusCode = 500
      res.end(JSON.stringify(errorResponse(undefined, -32000, 'Internal server error', String(err))))
    })
  })

  server.listen(port, host, () => {
    if (!silent) {
      console.log(`[${new Date().toISOString()}] RPC server running at http://${host}:${port}/rpc`)
      if (debug) {
        console.log('Debug mode enabled - detailed logging active')
      }
    }
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
        default: 9999,
      })
      .option('debug', {
        type: 'boolean',
        description: 'Enable debug logging',
        default: false,
      })
      .option('silent', {
        type: 'boolean',
        description: 'Disable all logging output',
        default: false,
      })
  },
  handler: async (argv) => {
    const host = argv.host as string
    const port = argv.port as number
    const debug = argv.debug as boolean
    const silent = argv.silent as boolean
    await startServer(host, port, debug, silent)
  },
}

export default serverCommand
