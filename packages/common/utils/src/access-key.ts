export const extractProjectIdFromAccessKey = (accessKey: string): number => {
  // Convert URL-safe base64 string to standard base64 string
  const base64String = accessKey.replace(/-/g, '+').replace(/_/g, '/')
  // Decode the base64 string to a binary string
  const binaryString = atob(base64String)

  // Convert the binary string to a byte array (Uint8Array)
  const byteArray = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    byteArray[i] = binaryString.charCodeAt(i)
  }

  if (byteArray[0] !== 1) {
    throw new Error('UnsupportedVersion')
  }

  // Extract the project ID from bytes 2 to 9 (8 bytes)
  const projectIdBytes = byteArray.slice(1, 9)
  const projectId =
    projectIdBytes[7] |
    (projectIdBytes[6] << 8) |
    (projectIdBytes[5] << 16) |
    (projectIdBytes[4] << 24) |
    (projectIdBytes[3] << 32) |
    (projectIdBytes[2] << 40) |
    (projectIdBytes[1] << 48) |
    (projectIdBytes[0] << 56)

  return projectId
}
