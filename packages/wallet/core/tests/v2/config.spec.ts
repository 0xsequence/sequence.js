import { expect } from 'chai'
import { config } from '../../src/v2'

const sampleTree1: config.Topology = {
  left: {
    address: '0x07ab71Fe97F9122a2dBE3797aa441623f5a59DB1',
    weight: 2
  },
  right: {
    left: {
      left: {
        subdigest: '0xb374baf809e388014912ca7020c8ef51ad68591db3f010f9e35a77c15d4d6bed'
      },
      right: {
        subdigest: '0x787c83a19321fc70f8653f8faa39cce60bf26cac51c25df1b0634eb7ddbe0c60'
      }
    },
    right: {
      address: '0xdafea492d9c6733ae3d56b7ed1adb60692c98bc5',
      weight: 1
    }
  }
}

const sampleTree2: config.Topology = {
  left: {
    left: {
      left: {
        subdigest: '0x0000000000000000000000000000000000000000000000000000000000000000'
      },
      right: {
        subdigest: '0x0000000000000000000000000000000000000000000000000000000000000001'
      }
    },
    right: {
      left: {
        subdigest: '0x0000000000000000000000000000000000000000000000000000000000000002'
      },
      right: {
        subdigest: '0x0000000000000000000000000000000000000000000000000000000000000003'
      }
    }
  },
  right: {
    left: {
      left: {
        subdigest: '0x0000000000000000000000000000000000000000000000000000000000000004'
      },
      right: {
        subdigest: '0x0000000000000000000000000000000000000000000000000000000000000005'
      }
    },
    right: {
      left: {
        subdigest: '0x0000000000000000000000000000000000000000000000000000000000000006'
      },
      right: {
        subdigest: '0x0000000000000000000000000000000000000000000000000000000000000007'
      }
    }
  }
}

const sampleTree3: config.Topology = {
  left: {
    tree: {
      left: {
        address: '0x07ab71Fe97F9122a2dBE3797aa441623f5a59DB1',
        weight: 2
      },
      right: {
        left: {
          subdigest: '0x0000000000000000000000000000000000000000000000000000000000000006'
        },
        right: {
          subdigest: '0x787c83a19321fc70f8653f8faa39cce60bf26cac51c25df10000000000000000'
        }
      }
    },
    weight: 90,
    threshold: 2
  },
  right: {
    left: {
      left: {
        subdigest: '0xb374baf809e388014912ca7020c8ef51ad68591db3f010f9e35a77c15d4d6bed'
      },
      right: {
        subdigest: '0x787c83a19321fc70f8653f8faa39cce60bf26cac51c25df1b0634eb7ddbe0c60'
      }
    },
    right: {
      address: '0xdafea492d9c6733ae3d56b7ed1adb60692c98bc5',
      weight: 1
    }
  }
}

describe('v2 config utils', () => {
  describe('Detect different leaves', () => {
    it('Should detect signer leaf', () => {
      const leaf: config.Leaf = {
        address: '0x07ab71Fe97F9122a2dBE3797aa441623f5a59DB1',
        weight: 2
      }

      expect(config.isLeaf(leaf)).to.be.true
      expect(config.isSignerLeaf(leaf)).to.be.true
      expect(config.isTopology(leaf)).to.be.true
      expect(config.isNode(leaf)).to.be.false
      expect(config.isSubdigestLeaf(leaf)).to.be.false
      expect(config.isNestedLeaf(leaf)).to.be.false
    })

    it('Should detect subdigest leaf', () => {
      const leaf: config.Leaf = {
        subdigest: '0x787c83a19321fc70f8653f8faa39cce60bf26cac51c25df1b0634eb7ddbe0c60'
      }

      expect(config.isLeaf(leaf)).to.be.true
      expect(config.isSubdigestLeaf(leaf)).to.be.true
      expect(config.isTopology(leaf)).to.be.true
      expect(config.isNode(leaf)).to.be.false
      expect(config.isSignerLeaf(leaf)).to.be.false
      expect(config.isNestedLeaf(leaf)).to.be.false
    })

    it('Should detect nested leaf', () => {
      const leaf: config.Leaf = {
        tree: sampleTree1,
        weight: 90,
        threshold: 2
      }

      expect(config.isLeaf(leaf)).to.be.true
      expect(config.isNestedLeaf(leaf)).to.be.true
      expect(config.isTopology(leaf)).to.be.true
      expect(config.isNode(leaf)).to.be.false
      expect(config.isSignerLeaf(leaf)).to.be.false
      expect(config.isSubdigestLeaf(leaf)).to.be.false
    })

    it('Should detect node', () => {
      expect(config.isTopology(sampleTree1)).to.be.true
      expect(config.isNode(sampleTree1)).to.be.true
      expect(config.isLeaf(sampleTree1)).to.be.false
      expect(config.isNestedLeaf(sampleTree1)).to.be.false
      expect(config.isSignerLeaf(sampleTree1)).to.be.false
      expect(config.isSubdigestLeaf(sampleTree1)).to.be.false
    })
  })

  describe('Hash leaves', () => {
    it('Hash signer leaf', () => {
      const hash = config.hashNode({
        address: '0x07ab71Fe97F9122a2dBE3797aa441623f5a59DB1',
        weight: 129
      })

      expect(hash).to.equal(`0x00000000000000000000008107ab71fe97f9122a2dbe3797aa441623f5a59db1`)
    })

    it('Hash subdigest', () => {
      const hash = config.hashNode({
        subdigest: '0xb38b3da0ef56c3094675167fed4a263c3346b325dddb6e56a3eb9a10ed7539ed'
      })

      expect(hash).to.equal(`0x7cf15e50f6d44f71912ca6575b7fd911a5c6f19d0195692c7d35a102ad5ae98b`)
    })

    it('Hash nested leaf', () => {
      const hash = config.hashNode({
        tree: sampleTree1,
        weight: 90,
        threshold: 211
      })

      expect(hash).to.equal(`0x6cca65d12b31379a7b429e43443969524821e57d2c6a7fafae8e30bd31a5295b`)
    })

    it('Hash node', () => {
      const tree = {
        left: {
          address: '0x07ab71Fe97F9122a2dBE3797aa441623f5a59DB1',
          weight: 129
        },
        right: {
          subdigest: '0x787c83a19321fc70f8653f8faa39cce60bf26cac51c25df1b0634eb7ddbe0c60'
        }
      }

      const hash = config.hashNode(tree)
      expect(hash).to.equal(`0x47dcfac6c5622054a0ac762baa1a5eb10705484ea1e000869bbc11a093bec97e`)
    })
  })

  it('Read left face of tree', () => {
    const leftFace1 = config.leftFace(sampleTree1)
    expect(leftFace1.length).to.equal(2)
    expect(leftFace1[0]).to.deep.equal(sampleTree1['left'])
    expect(leftFace1[1]).to.deep.equal(sampleTree1['right'])

    const leftFace2 = config.leftFace(sampleTree2)
    expect(leftFace2.length).to.equal(4)
    expect(leftFace2[0]).to.deep.equal(sampleTree2['left']['left']['left'])
    expect(leftFace2[1]).to.deep.equal(sampleTree2['left']['left']['right'])
    expect(leftFace2[2]).to.deep.equal(sampleTree2['left']['right'])
    expect(leftFace2[3]).to.deep.equal(sampleTree2['right'])

    const leftFace3 = config.leftFace(sampleTree3)
    expect(leftFace3.length).to.equal(2)
    expect(leftFace3[0]).to.deep.equal(sampleTree3['left'])
    expect(leftFace3[1]).to.deep.equal(sampleTree3['right'])
  })

  describe('Simplify configurations', () => {
    it('Should simplify configuration', () => {
      const simplifiedConfig1 = config.toSimpleWalletConfig({
        version: 2,
        tree: sampleTree1,
        threshold: 11,
        checkpoint: 999999
      })

      expect(simplifiedConfig1).to.deep.equal({
        checkpoint: 999999,
        threshold: 11,
        members: [
          sampleTree1['left'],
          sampleTree1['right']['left']['left'],
          sampleTree1['right']['left']['right'],
          sampleTree1['right']['right']
        ]
      })

      const simplifiedConfig2 = config.toSimpleWalletConfig({
        version: 2,
        tree: sampleTree2,
        threshold: 1,
        checkpoint: 2
      })

      expect(simplifiedConfig2).to.deep.equal({
        checkpoint: 2,
        threshold: 1,
        members: [
          sampleTree2['left']['left']['left'],
          sampleTree2['left']['left']['right'],
          sampleTree2['left']['right']['left'],
          sampleTree2['left']['right']['right'],
          sampleTree2['right']['left']['left'],
          sampleTree2['right']['left']['right'],
          sampleTree2['right']['right']['left'],
          sampleTree2['right']['right']['right']
        ]
      })

      const simplifiedConfig3 = config.toSimpleWalletConfig({
        version: 2,
        tree: sampleTree3,
        threshold: 2,
        checkpoint: 3
      })

      expect(simplifiedConfig3).to.deep.equal({
        checkpoint: 3,
        threshold: 2,
        members: [
          {
            threshold: sampleTree3['left']['threshold'],
            weight: sampleTree3['left']['weight'],
            members: [
              sampleTree3['left']['tree']['left'],
              sampleTree3['left']['tree']['right']['left'],
              sampleTree3['left']['tree']['right']['right']
            ]
          },
          sampleTree3['right']['left']['left'],
          sampleTree3['right']['left']['right'],
          sampleTree3['right']['right']
        ]
      })
    })
  })

  describe('Build configurations', async () => {
    it('Build legacy configuration', () => {
      const legacyConfig1 = config.toWalletConfig(
        {
          members: [
            sampleTree1['left'],
            sampleTree1['right']['left']['left'],
            sampleTree1['right']['left']['right'],
            sampleTree1['right']['right']
          ],
          threshold: 11,
          checkpoint: 999999
        },
        config.legacyTopologyBuilder
      )

      expect(legacyConfig1).to.deep.equal({
        version: 2,
        checkpoint: 999999,
        threshold: 11,
        tree: {
          left: {
            left: {
              left: sampleTree1['left'],
              right: sampleTree1['right']['left']['left']
            },
            right: sampleTree1['right']['left']['right']
          },
          right: sampleTree1['right']['right']
        }
      })

      const legacyConfig2 = config.toWalletConfig({
        members: [
          sampleTree2['left']['left']['left'],
          sampleTree2['left']['left']['right'],
          sampleTree2['left']['right']['left'],
          sampleTree2['left']['right']['right'],
          sampleTree2['right']['left']['left'],
          sampleTree2['right']['left']['right'],
          sampleTree2['right']['right']['left'],
          sampleTree2['right']['right']['right']
        ],
        threshold: 1,
        checkpoint: 2
      })

      expect(legacyConfig2).to.deep.equal({
        version: 2,
        checkpoint: 2,
        threshold: 1,
        tree: {
          left: {
            left: {
              left: {
                left: {
                  left: {
                    left: {
                      left: sampleTree2['left']['left']['left'],
                      right: sampleTree2['left']['left']['right']
                    },
                    right: sampleTree2['left']['right']['left']
                  },
                  right: sampleTree2['left']['right']['right']
                },
                right: sampleTree2['right']['left']['left']
              },
              right: sampleTree2['right']['left']['right']
            },
            right: sampleTree2['right']['right']['left']
          },
          right: sampleTree2['right']['right']['right']
        }
      })

      const legacyConfig3 = config.toWalletConfig({
        members: [
          {
            threshold: sampleTree3['left']['threshold'],
            weight: sampleTree3['left']['weight'],
            members: [
              sampleTree3['left']['tree']['left'],
              sampleTree3['left']['tree']['right']['left'],
              sampleTree3['left']['tree']['right']['right']
            ]
          },
          sampleTree3['right']['left']['left'],
          sampleTree3['right']['left']['right'],
          sampleTree3['right']['right']
        ],
        threshold: 2,
        checkpoint: 3
      })

      expect(legacyConfig3).to.deep.equal({
        version: 2,
        checkpoint: 3,
        threshold: 2,
        tree: {
          left: {
            left: {
              left: {
                weight: sampleTree3['left']['weight'],
                threshold: sampleTree3['left']['threshold'],
                tree: {
                  left: {
                    left: sampleTree3['left']['tree']['left'],
                    right: sampleTree3['left']['tree']['right']['left']
                  },
                  right: sampleTree3['left']['tree']['right']['right']
                }
              },
              right: sampleTree3['right']['left']['left']
            },
            right: sampleTree3['right']['left']['right']
          },
          right: sampleTree3['right']['right']
        }
      })
    })

    it('Build merkle configuration', () => {
      const merkleConfig1 = config.toWalletConfig(
        {
          members: [
            sampleTree1['left'],
            sampleTree1['right']['left']['left'],
            sampleTree1['right']['left']['right'],
            sampleTree1['right']['right']
          ],
          threshold: 11,
          checkpoint: 999999
        },
        config.merkleTopologyBuilder
      )

      expect(merkleConfig1).to.deep.equal({
        version: 2,
        checkpoint: 999999,
        threshold: 11,
        tree: {
          left: {
            left: sampleTree1['left'],
            right: sampleTree1['right']['left']['left']
          },
          right: {
            left: sampleTree1['right']['left']['right'],
            right: sampleTree1['right']['right']
          }
        }
      })

      const merkleConfig2 = config.toWalletConfig(
        {
          members: [
            sampleTree2['left']['left']['left'],
            sampleTree2['left']['left']['right'],
            sampleTree2['left']['right']['left'],
            sampleTree2['left']['right']['right'],
            sampleTree2['right']['left']['left'],
            sampleTree2['right']['left']['right'],
            sampleTree2['right']['right']['left'],
            sampleTree2['right']['right']['right']
          ],
          threshold: 1,
          checkpoint: 2
        },
        config.merkleTopologyBuilder
      )

      expect(merkleConfig2).to.deep.equal({
        version: 2,
        checkpoint: 2,
        threshold: 1,
        tree: sampleTree2
      })

      const merkleConfig3 = config.toWalletConfig(
        {
          members: [
            {
              threshold: sampleTree3['left']['threshold'],
              weight: sampleTree3['left']['weight'],
              members: [
                sampleTree3['left']['tree']['left'],
                sampleTree3['left']['tree']['right']['left'],
                sampleTree3['left']['tree']['right']['right']
              ]
            },
            sampleTree3['right']['left']['left'],
            sampleTree3['right']['left']['right'],
            sampleTree3['right']['right']
          ],
          threshold: 2,
          checkpoint: 3
        },
        config.merkleTopologyBuilder
      )

      expect(merkleConfig3).to.deep.equal({
        version: 2,
        checkpoint: 3,
        threshold: 2,
        tree: {
          left: {
            left: {
              weight: sampleTree3['left']['weight'],
              threshold: sampleTree3['left']['threshold'],
              tree: {
                left: {
                  left: sampleTree3['left']['tree']['left'],
                  right: sampleTree3['left']['tree']['right']['left']
                },
                right: sampleTree3['left']['tree']['right']['right']
              }
            },
            right: sampleTree3['right']['left']['left']
          },
          right: {
            left: sampleTree3['right']['left']['right'],
            right: sampleTree3['right']['right']
          }
        }
      })
    })
  })
})
