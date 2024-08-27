import { expect } from 'chai'
import { extractProjectIdFromAccessKey } from '@0xsequence/utils'

describe('access-key', function () {
  it('extractProjectIdFromAccessKey', () => {
    const accessKey = 'AQAAAAAAADVH8R2AGuQhwQ1y8NaEf1T7PJM'

    const projectId = extractProjectIdFromAccessKey(accessKey)
    expect(projectId).to.equal(13639)
  })
})
