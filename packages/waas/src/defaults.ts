
export const DEFAULT_GUARD = 'https://guard2.sequence.app'

export const TEMPLATE_LOCAL = {
  rpcServer: 'http://localhost:9123',
  kmsRegion: 'us-east-2',
  idpRegion: 'us-east-2',
  keyId: 'arn:aws:kms:us-east-1:000000000000:key/aeb99e0f-9e89-44de-a084-e1817af47778',
  endpoint: 'http://localstack:4566',
}

export const TEMPLATE_NEXT = {
  rpcServer: 'https://d14tu8valot5m0.cloudfront.net',
  kmsRegion: 'us-east-2',
  idpRegion: 'us-east-2',
  keyId: 'arn:aws:kms:us-east-2:170768627592:key/0fd8f803-9cb5-4de5-86e4-41963fb6043d',
  endpoint: undefined,
}
