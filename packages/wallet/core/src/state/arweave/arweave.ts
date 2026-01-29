export interface Options {
  readonly namespace?: string
  readonly owners?: string[]
  readonly arweaveUrl?: string
  readonly graphqlUrl?: string
  readonly rateLimitRetryDelayMs?: number
}

export const defaults = {
  namespace: 'Sequence-Sessions',
  owners: ['AZ6R2mG8zxW9q7--iZXGrBknjegHoPzmG5IG-nxvMaM'],
  arweaveUrl: 'https://arweave.net',
  graphqlUrl: 'https://arweave.net/graphql',
  rateLimitRetryDelayMs: 5 * 60 * 1000
}

async function findItems(
  filter: { [name: string]: undefined | string | string[] },
  options?: Options & { pageSize?: number; maxResults?: number }
): Promise<{ [id: string]: { [tag: string]: string } }> {
  const namespace = options?.namespace ?? defaults.namespace
  const owners = options?.owners
  const graphqlUrl = options?.graphqlUrl ?? defaults.graphqlUrl
  const rateLimitRetryDelayMs = options?.rateLimitRetryDelayMs ?? defaults.rateLimitRetryDelayMs
  const pageSize = options?.pageSize ?? 100
  const maxResults = options?.maxResults

  const tags = Object.entries(filter).flatMap(([name, values]) =>
    values === undefined
      ? []
      : [
          `{ name: "${namespace ? `${namespace}-${name}` : name}", values: [${typeof values === 'string' ? `"${values}"` : values.map(value => `"${value}"`).join(', ')}] }`
        ]
  )

  const edges: Array<{ cursor: string; node: { id: string; tags: Array<{ name: string; value: string }> } }> = []

  for (let hasNextPage = true; hasNextPage && (maxResults === undefined || edges.length < maxResults); ) {
    const query = `
      query {
        transactions(sort: HEIGHT_DESC, ${edges.length ? `first: ${pageSize}, after: "${edges[edges.length - 1]!.cursor}"` : `first: ${pageSize}`}, tags: [${tags.join(', ')}]${owners === undefined ? '' : `, owners: [${owners.map(owner => `"${owner}"`).join(', ')}]`}) {
          pageInfo {
            hasNextPage
          }
          edges {
            cursor
            node {
              id
              tags {
                name
                value
              }
            }
          }
        }
      }
    `

    let response: Response
    while (true) {
      response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        redirect: 'follow'
      })
      if (response.status !== 429) {
        break
      }
      console.warn(
        `rate limited by ${graphqlUrl}, trying again in ${rateLimitRetryDelayMs / 1000} seconds at ${new Date(Date.now() + rateLimitRetryDelayMs).toLocaleTimeString()}`
      )
      await new Promise(resolve => setTimeout(resolve, rateLimitRetryDelayMs))
    }

    const {
      data: { transactions }
    } = await response.json()

    edges.push(...transactions.edges)

    hasNextPage = transactions.pageInfo.hasNextPage
  }

  return Object.fromEntries(
    edges.map(({ node: { id, tags } }) => [
      id,
      Object.fromEntries(
        tags.map(({ name, value }) => [
          namespace && name.startsWith(`${namespace}-`) ? name.slice(namespace.length + 1) : name,
          value
        ])
      )
    ])
  )
}

async function fetchItem(
  id: string,
  rateLimitRetryDelayMs = defaults.rateLimitRetryDelayMs,
  arweaveUrl = defaults.arweaveUrl
): Promise<Response> {
  while (true) {
    const response = await fetch(`${arweaveUrl}/${id}`, { redirect: 'follow' })
    if (response.status !== 429) {
      return response
    }
    console.warn(
      `rate limited by ${arweaveUrl}, trying again in ${rateLimitRetryDelayMs / 1000} seconds at ${new Date(Date.now() + rateLimitRetryDelayMs).toLocaleTimeString()}`
    )
    await new Promise(resolve => setTimeout(resolve, rateLimitRetryDelayMs))
  }
}
