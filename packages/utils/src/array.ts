import { ethers } from "ethers"

export function startsWith(a: ethers.utils.BytesLike | undefined, b: ethers.utils.BytesLike | undefined): boolean {
    if (!a || !b) return false
    
    const aa = ethers.utils.arrayify(a)
    const ab = ethers.utils.arrayify(b)

    if (aa.length < ab.length) return false

    for (let i = 0; i < b.length; i++) {
        if (a[i] !== b[i]) {
            return false
        }
    }

    return true
}
