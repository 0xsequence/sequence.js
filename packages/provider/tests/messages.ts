import { ethers } from 'ethers'
import { prefixEIP191Message } from '../src/utils'

// Ethereum personal sign: Hello, World!
export const message1 = new Uint8Array([
  25, 69, 116, 104, 101, 114, 101, 117, 109, 32, 83, 105, 103, 110, 101, 100, 32, 77, 101, 115, 115, 97, 103, 101, 58, 10, 49, 51,
  72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33
])

const dlcText = `Decentraland Login
Ephemeral address: 0xe1bCF3CAc83534a055f7254C1FD88B21159fCc67
Expiration: 2022-10-27T16:03:29.191Z`

export const dclLogin = ethers.utils.toUtf8Bytes(dlcText)

// Ethereum personal sign 0x v3 order
export const zeroExV3Order = new Uint8Array([
  62, 254, 80, 200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 3, 153, 144,
  71, 27, 241, 205, 119, 186, 5, 60, 99, 148, 99, 19, 201, 174, 101, 93, 86, 211, 104, 110, 31, 232, 176, 9, 52, 53, 122, 24, 41,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 191, 3, 19, 123, 56, 230, 5, 28, 73, 127, 92, 7, 29, 45, 29, 189, 8, 190, 24, 26, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 32, 55, 18, 71, 48, 244, 210, 213, 18, 72, 210, 192, 93, 42, 229, 203, 210, 136, 237, 103, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 188, 192, 42, 21, 92, 55, 66, 99, 50, 17, 85, 85, 92, 207, 65, 7, 0, 23, 100, 158, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 150, 122, 103, 240, 255, 23, 36, 169, 85, 88, 7, 31, 44, 217, 97, 21, 252, 202, 109, 69, 32, 114,
  145, 27, 10, 160, 236, 62, 181, 81, 143, 220, 202, 36, 172, 69, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 192, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3,
  32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 160, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 36, 148, 207, 205, 215, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 13, 224, 182, 179, 167, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 36, 244, 114, 97, 176, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 190, 65, 193, 52, 252, 53, 23, 203, 14, 201, 75, 110, 234, 251, 102, 207, 153, 152, 120, 47, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
  36, 148, 207, 205, 215, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 13, 224, 182, 179, 167, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 36, 244, 114, 97, 176, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  170, 165, 185, 230, 197, 137, 100, 47, 152, 161, 205, 169, 155, 157, 2, 75, 132, 7, 40, 90, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
])

// Messages for testing remove-iep191prefix

export const removeIep191Prefix_test1_raw = `1915 Robert Frost
The Road Not Taken
  
Two roads diverged in a yellow wood,
And sorry I could not travel both
And be one traveler, long I stood
And looked down one as far as I could
To where it bent in the undergrowth
  
Then took the other, as just as fair,
And having perhaps the better claim,
Because it was grassy and wanted wear
Though as for that the passing there
Had worn them really about the same,
  
And both that morning equally lay
In leaves no step had trodden black.
Oh, I kept the first for another day!
Yet knowing how way leads on to way,
I doubted if I should ever come back.
  
I shall be telling this with a sigh
Somewhere ages and ages hence:
Two roads diverged in a wood, and I—
I took the one less traveled by,
And that has made all the difference.
  
\u2601 \u2600 \u2602`
export const removeIep191Prefix_test2_raw = dlcText
export const removeIep191Prefix_test3_raw = '1915 Robe' // 9 chars
export const removeIep191Prefix_test4_raw =
  '123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789' // 99 chars
export const removeIep191Prefix_test5_raw = 'Robe 1915'

export const removeIep191Prefix_test1_prefixed = prefixEIP191Message(removeIep191Prefix_test1_raw)
export const removeIep191Prefix_test2_prefixed = prefixEIP191Message(dlcText)
export const removeIep191Prefix_test3_prefixed = prefixEIP191Message(removeIep191Prefix_test3_raw)
export const removeIep191Prefix_test4_prefixed = prefixEIP191Message(removeIep191Prefix_test4_raw)
export const removeIep191Prefix_test5_prefixed = prefixEIP191Message(removeIep191Prefix_test5_raw)
