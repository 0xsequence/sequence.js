import { expect } from 'chai'
import { ethers } from 'ethers'
import { decodeSignature, encodeSignature, SignaturePartType, SignatureType } from '../../src/v2/signature'

const sampleSignature1 =
  '0x0001636911b800019fa7b7e8ed25088c413074818ac10ab3bbcddb120bbec85083f3ba254e5547d953fe615a6474fd365326244dedd7afa3911ad39c956ca096d721064d6b29055d1b02'
const sampleSignature2 =
  '0x000263691389034a062f86183c9d46e129f0331f2a42f6ba22a3525a46ecd197fa23d177d75f2d040000a0033fce59919d0a4ee44a8066a3b1d0083760d89a06ae89edadf8a58e0e5c5ac5040400007b01016ffeccf6f31e0a469d55dede5651d34a6ecd9fc500017052a0438a13da22242bcd20c219630d839c364cd2b6042add1bee32774c37d72ba2ace8b7a79c95a536d4c0fed3fe05883c6e1188a4191a91623a903e4ec21c1b0203ad5831467806b6edd059ff5ac9809f2bb6e80512ceb5d466a67251ffb842fae1040000c50314b729622595218cdbef06c630daeea028e25e8ca048d97bc170d75feb9066ad0400007f030c8c0bb7e8c5ec8eed444ae25f3a1796597bcfacf5f6b758ae4fadd6fc416f560400005a0001e7618f1b7b012d7fc48f518f498bb6823dc2a8308984287501873cb535b6d5bf526fb91a220297f461ac5a2434d0e8e768c3bf166c329366ddc885bf2e1676271c0201014ef7ec718f66ae3920ea119b9d7ddf39337601f703fdea4c5fb23fb3cc2b2360057abef1ff7e7195acbdc4db555c27cc588a4585a6'
const sampleSignature3 =
  '0x0003636916740101a653f5900ef5c538142cd8aef1ce750390b29a3e0101a54e174d851bcffe8c1332c00e23156b4982204d0400002c0101ddfba5791de0b8da80d46b43915ae34c4876c4f80101f50834aa68dec4d9d151b1ff1c509c81431ddc450400008a0101e8e7c96af0d472a8d0e60e86009a97290fbc0f6d010188a175d23b41252823e7fd88297754f5c580c4ff0400005a0101653ca45307922091337376cb305485c0d889a7a10001d9b2a3142267255c50581c8023648916a3e8c3ae7ca50f6752b6874a20e76e496b30c4e1b653691b3ae9fea40a66966f3d1f2a35cedb52fbf07ae09269fb3c8e1b02040001180101a18522682c76e7e4083fcef379839347a533f782010159d7eb9085272adb317893df26e7f39dcfdda1ba0400002c0101c31ee68141cb47d2b260fe5a6e48b37d021d8f190101947ee7254d4de72f7a1b2e70ed3f8e8ae6510d77040000b8000147f646e6d13434b2df65fc1ab9086264bed1030e485e3513ed01686d03d127df510efc468bbeedde677c3af1fda7b0dbffc7186e07203eb09718cc256cf6b5d11b020101ce1977029e9398ec9f45327c81cf7a557f5d30b80400005a01010b6a69349728615d6e1c8d4fd133e49aafd5b91b0001aaac151a6ad4bf7f966db203164551a7c3c3969d15666dd2c75202231623f5ee2059711c84d2f216126bf3dc6cc63223eba079262e73c58da4f97583747c790b1c02'
const sampleSignature4 =
  '0x00010000000203f6dc189f16bb65c588ccd5c63aa805bcbeb6e90dd8a049cfba0936050f299087060400020000c3037c989a96925302993812c1ec3924bce3ba2ca0e8f7e3655e30f5b24d965aa18b040000880001a73ce16a9cc7075c18bd2b4fd2649812fecb51460353a55bf62f821bf884443a169e0d0e04113d7ef2c2d15f1ecf46531f291259542065c556f0e721a82b3c581b02000193f1f388009f68763df43632153155960ea6604723bb517e90788822ff21e38722be4387e8f67c0db677b74d9a0c2a804183e6a3eebd2ba53dbfc54432f1a10f1b020101907c144d2490f49838c6499507ee5914f4a22b5b'
const sampleSignature5 =
  '0x020001636a2c7d032b4c067647ee1f154214b4ad83bbbe7e57a528ca0df587e34ded382ca7348c100400006703c702696d354063d18d750cc686a1f356e503f85516c54375ef5878250a22758704000042054cd7065b01927d3429db64e0a7ec956fa5506dab23fa37c767eb4375fab7898b032acf6636e813600f741841733e57a7e0cb4131f3c68db7ba7014fb94525f5de20302c10a9634e89b4293346a7408364eeece764491bd465d043f7c826518c2bc9501011a9bd9f98e2c0c81bcf51da26c3a7cfcc18c43b4030c389524f715de03757bcbc7a084f52c5d54def431bb8080a18d0075e26b859c0101379b2a7a384376b420d3d19c5c5717abaad3a969'
const sampleSignature6 =
  '0x010002636a33a501012093ec341be249baa0c8afa35fef368a90a483900201cd907cf455a1a00a4ebe37ef5f4bb7abc3770a6900004228230cc5c4ee221c093054fef22c12d534f4d63782bc94a160c2f781cef142e019b84d82070b67cb750ec9ba46ae49e6687591810099f6e58811fbe35ea3db451c0202014bffabff5819087514d8db622543c3d0d89cd64d000042844e002b27098ba6144bc9eb7950cd20a4062d265bdd042bffbb7ec8405caf7f60f1c5bdcd8ea4f4acee17d5ac9eac6bcdb40a20a41796d40a153278ab062b211c020101e8c4a6eb40ece266c7a58670493ee0727be4d20a'

describe('v2 signature utils', () => {
  describe('Decode signatures', () => {
    it('Decode simple signature', () => {
      const decoded = decodeSignature(sampleSignature1)

      expect(decoded).to.deep.equal({
        version: 2,
        type: SignatureType.Legacy,
        decoded: {
          threshold: 1,
          checkpoint: 1667830200,
          tree: {
            isDynamic: false,
            signature:
              '0x9fa7b7e8ed25088c413074818ac10ab3bbcddb120bbec85083f3ba254e5547d953fe615a6474fd365326244dedd7afa3911ad39c956ca096d721064d6b29055d1b02',
            unrecovered: true,
            weight: 1
          }
        }
      })
    })

    it('Decode trimmed 2/N with 31 signers', () => {
      /**
        0x9ce037be2c62dfec86f2cf5339f773b8fc22da992b9e33ee8ee050676a1fef48',
          ├─ 0xcc049b7ee4891eb306511fb4019c104766fb97c73097a6ddd73858c1ba200292',
          │  ├─ 0x4a062f86183c9d46e129f0331f2a42f6ba22a3525a46ecd197fa23d177d75f2d',
          │  │  ├─ 0xe66f95b2257d7765d2af2a44f85bf9c9ecd220c686943595f4c7b87f42214b78',
          │  │  │  ├─ 0xfccac93b8e71891c0647977a42447b037574deaa9d4cf7a6a6e6fd9275b75a5d',
          │  │  │  │  ├─ weight: 1 - address: 0x39bc8F324dB1d2356E084b8c504F972f4A774fB2',
          │  │  │  │  └─ weight: 1 - address: 0xb2C7368fA82d1Fd633f79FA9BcBE923cB1b84e4f',
          │  │  │  └─ 0x85dab8bdc832396fb5f6f3dc3d86e589a6358edde9d5dfb567199ba81328f429',
          │  │  │     ├─ weight: 1 - address: 0xAc9a3035638E36300DCd6e89cf7D3861bbb8dd1F',
          │  │  │     └─ weight: 1 - address: 0x7Fb579CE8378EbcB953c6b1159cFF1d2DEEb6f74',
          │  │  └─ 0xc0a464e50c14c3c9be84fcf19726f39298b1101b62da1ea093d058f574dc4075',
          │  │     ├─ 0xa2ba648e377ddd25ccc5d55db2eaf2031d713ea63456cf60dbd88acb4fb9b826',
          │  │     │  ├─ weight: 1 - address: 0x5dfc6cA7841DF26872BeF07C68fc18031908480c',
          │  │     │  └─ weight: 1 - address: 0xA3B58D5778F59cF331693618f5E11b901029C3DE',
          │  │     └─ 0x6ec7200199b3dad7a17e09b5a04df6518bc3eefecd59b6509f47bc478325384b',
          │  │        ├─ weight: 1 - address: 0xAD4d6101f2fFda7C39D039d4c496B9005AaDBFaA',
          │  │        └─ weight: 1 - address: 0x204De2Fa1FF302345CFd53bE37a5234c606783d8',
          │  └─ 0x326e14238f8038db10e675efdf0c7648f8066c6a064738b73ec1db63a904c26c',
          │     ├─ 0x3fce59919d0a4ee44a8066a3b1d0083760d89a06ae89edadf8a58e0e5c5ac504',
          │     │  ├─ 0xa13a367336b680c598ffcc7738b9b18135000db5be559f35262b28e1701bb9a3',
          │     │  │  ├─ weight: 1 - address: 0xD6BE598eD22A999f51BDCFD484454319CCe32b92',
          │     │  │  └─ weight: 1 - address: 0x3347821222470CD136bAac735bf59A1734A80B83',
          │     │  └─ 0x14b13f254e58655bf2d4dce5c7e3ec0566a4e025a70d1fc0d41a08e675c86358',
          │     │     ├─ weight: 1 - address: 0x0aE2D84a35Eb1fD2B78dF00940A84c6a4954B4A6',
          │     │     └─ weight: 1 - address: 0x598fD5791971eb873FA8147B1BdF3207068F7E56',
          │     └─ 0xa507ba934d99995d74786ac057b7c2cd9e22ac9d4c3aee6739e0cc0d308065db',
          │        ├─ 0x1df893b2ba851550922f4c3c6f60608f6c70fbe1f47670eaf9f5c3a6edbcd400',
          │        │  ├─ weight: 1 - address: 0x6FFEcCF6F31e0a469D55DEdE5651D34A6ECd9FC5',
          │        │  └─ weight: 1 - address: 0xE8D34A3999375ef56CD8eB41AC678f5332F7F223',
          │        └─ 0xad5831467806b6edd059ff5ac9809f2bb6e80512ceb5d466a67251ffb842fae1',
          │           ├─ weight: 1 - address: 0x103dD4E217C422839F3D4b1897C3b1100184d962',
          │           └─ weight: 1 - address: 0x5adDAfA4498f9F54af54B8CD8a86728818Df911f',
          └─ 0xb7a09a95298cc9bbeeb3c8fbe1f46d158976de898ca42470d0da75cea7be9b43',
             ├─ 0x2ac4cc831b29dd447dc2d95a203a7b146ffbb8b9cf3fd0022d15bd0a490bc557',
             │  ├─ 0x14b729622595218cdbef06c630daeea028e25e8ca048d97bc170d75feb9066ad',
             │  │  ├─ 0xd08870ce28971831b6320b00d017b4351c75ca68432721c6e50145fc320bd900',
             │  │  │  ├─ weight: 1 - address: 0x8881DFDBb650d55A440e7F40c3Fc890D327cE35C',
             │  │  │  └─ weight: 1 - address: 0x133BC159421310c81E1045ba1e1f8fac34e2c5bB',
             │  │  └─ 0x99a7e698bb471ec55f01f14f21a20d23b2f3c142fabe99b3294c526b50207a13',
             │  │     ├─ weight: 1 - address: 0xCA9Ed033CB7E9D905942866cD2E593aEB2e05731',
             │  │     └─ weight: 1 - address: 0x96613Fda8926dB718719c3c1CE9DaeeddbC520F1',
             │  └─ 0xd508a67420b9138396432c9d6a89735a4f1bddf3800ce175fe54f5f80eea6fc7',
             │     ├─ 0x0c8c0bb7e8c5ec8eed444ae25f3a1796597bcfacf5f6b758ae4fadd6fc416f56',
             │     │  ├─ weight: 1 - address: 0x6d0fDa7520Bb48B6948f77214EE7411636853f30',
             │     │  └─ weight: 1 - address: 0x1252c641DC898449490C7F145598b5A70c6738de',
             │     └─ 0xc6eb96ebf4f10c3073d6b680efcb57d636b83fe5bc92912ae7c300d9e9cb232a',
             │        ├─ weight: 1 - address: 0x3B69bC115e6D79E8adBD011020676750B169bEDd',
             │        └─ weight: 1 - address: 0x4ef7Ec718f66ae3920ea119b9d7DDF39337601f7',
             └─ 0xfdea4c5fb23fb3cc2b2360057abef1ff7e7195acbdc4db555c27cc588a4585a6',
                ├─ 0x33b6f5aa2e0cc8d120a1ec31e74095d978b88fce7c34030579c1ea1ef372c4ad',
                │  ├─ 0x5885c583c79ef1fe29477fcb82c7053518a99bedf73ebbf1948a160bdb8e2c0f',
                │  │  ├─ weight: 1 - address: 0x89eD176B654F09024a8EFb0F9576D05f614E6f77',
                │  │  └─ weight: 1 - address: 0xe8a3eb4CbEFF970eBd44e862f788C4CDB64009c1',
                │  └─ 0x367a80d6704d73c6777aae2c7ed880a0536520df2d3a3f3a3a17d22925842833',
                │     ├─ weight: 1 - address: 0x2C170AfE2D6c8489e4A272370DA494856E39BBDb',
                │     └─ weight: 1 - address: 0x6c32dd456D1DD14d91739f777D37378D243AfF93',
                └─ 0x6b8ac6478e09f9c92bed9532e1bdb2a2eefcfad542a6d5573bb16df0e50f7bdb',
                   ├─ 0x7206ea506e442d2a7ca309d52e4ebe6f0b8982261dbd45e87490bd86cfe77a2a',
                   │  ├─ weight: 1 - address: 0x72D0f36D4a0f18E22E7Ffd955C69C55D632d13Ae',
                   │  └─ weight: 1 - address: 0xfa79D7198d04b384735b8a24dE92014ECD59f777',
                   └─ weight: 1 - address: 0xFE3de6DF80c5890bAdBC24c1b4256A6c6E311933'
       */

      const decoded = decodeSignature(sampleSignature2)

      expect(decoded).to.deep.equal({
        version: 2,
        type: SignatureType.Legacy,
        decoded: {
          threshold: 2,
          checkpoint: 1667830665,
          tree: {
            left: {
              left: {
                nodeHash: '0x4a062f86183c9d46e129f0331f2a42f6ba22a3525a46ecd197fa23d177d75f2d'
              },
              right: {
                left: {
                  nodeHash: '0x3fce59919d0a4ee44a8066a3b1d0083760d89a06ae89edadf8a58e0e5c5ac504'
                },
                right: {
                  left: {
                    left: {
                      address: '0x6FFEcCF6F31e0a469D55DEdE5651D34A6ECd9FC5',
                      weight: 1
                    },
                    right: {
                      // signature for: 0xE8D34A3999375ef56CD8eB41AC678f5332F7F223
                      signature:
                        '0x7052a0438a13da22242bcd20c219630d839c364cd2b6042add1bee32774c37d72ba2ace8b7a79c95a536d4c0fed3fe05883c6e1188a4191a91623a903e4ec21c1b02',
                      weight: 1,
                      unrecovered: true,
                      isDynamic: false
                    }
                  },
                  right: {
                    nodeHash: '0xad5831467806b6edd059ff5ac9809f2bb6e80512ceb5d466a67251ffb842fae1'
                  }
                }
              }
            },
            right: {
              left: {
                left: {
                  nodeHash: '0x14b729622595218cdbef06c630daeea028e25e8ca048d97bc170d75feb9066ad'
                },
                right: {
                  left: {
                    nodeHash: '0x0c8c0bb7e8c5ec8eed444ae25f3a1796597bcfacf5f6b758ae4fadd6fc416f56'
                  },
                  right: {
                    left: {
                      // signature for: 0x3B69bC115e6D79E8adBD011020676750B169bEDd
                      signature:
                        '0xe7618f1b7b012d7fc48f518f498bb6823dc2a8308984287501873cb535b6d5bf526fb91a220297f461ac5a2434d0e8e768c3bf166c329366ddc885bf2e1676271c02',
                      weight: 1,
                      unrecovered: true,
                      isDynamic: false
                    },
                    right: {
                      address: '0x4ef7Ec718f66ae3920ea119b9d7DDF39337601f7',
                      weight: 1
                    }
                  }
                }
              },
              right: {
                nodeHash: '0xfdea4c5fb23fb3cc2b2360057abef1ff7e7195acbdc4db555c27cc588a4585a6'
              }
            }
          }
        }
      })
    })

    it('Decode non-trimmed 3/N with 16 signers', () => {
      /**
        0x0bd27b4a9a6a160ae92f5dc27a5d20156e81b049e451cc226db03be9454a9dbe',
          ├─ 0xa9b9bb8f341ef4cba67d42b2c588d99f700a451f208d1d7ecb23d017ab23c3c5',
          │  ├─ 0x24ac1effef0566192cd4ad878bc135c7d649b4989507f284fe5c66dae01117d3',
          │  │  ├─ 0x67dff26d956ede906bbd0692a0cd573a78c7e345d54ccc93e2383337b4a46660',
          │  │  │  ├─ weight: 1 - address: 0xA653F5900Ef5c538142Cd8Aef1CE750390B29a3E',
          │  │  │  └─ weight: 1 - address: 0xA54e174d851bCFFE8C1332C00e23156B4982204D',
          │  │  └─ 0x211bbe1253185da2e1f353cfb210c48378521ebfb3e103e18459e6aa9143848f',
          │  │     ├─ weight: 1 - address: 0xDdfbA5791dE0b8Da80d46B43915Ae34C4876C4F8',
          │  │     └─ weight: 1 - address: 0xF50834aa68DEc4D9D151b1ff1c509C81431DDC45',
          │  └─ 0x0888e3e8bb7be34c21de30730e8f9cd91d03222bfea229eeabab03f3aa2183e0',
          │     ├─ 0x360fe86d2a78344c383256a5509dac30c5046dd38cf6bfc54a880ac4f7e604ed',
          │     │  ├─ weight: 1 - address: 0xe8e7C96aF0D472a8D0E60E86009a97290Fbc0F6d',
          │     │  └─ weight: 1 - address: 0x88a175d23b41252823e7fD88297754f5C580c4Ff',
          │     └─ 0x1235b94db1f48cebb5ebec7d345033d92801312f13086c1a79d032e703525bea',
          │        ├─ weight: 1 - address: 0x653cA45307922091337376Cb305485c0D889A7A1',
          │        └─ weight: 1 - address: 0xCf8BF768E2b69953577e1FF16b147c773faEc959',
          └─ 0x86c8fbddf975589fecf3e2a5a543a916dedcf80aeb12f32abc26586110449059',
             ├─ 0xcb4f6042dd1421bc59313c5a8e806514c2fbad361e706e6ec36a4dd6b815e03a',
             │  ├─ 0x63fa3b020293428bfee299769b520e08641c66299922077cc91abd2ff31920f6',
             │  │  ├─ weight: 1 - address: 0xa18522682c76e7e4083fCEF379839347a533f782',
             │  │  └─ weight: 1 - address: 0x59d7eb9085272AdB317893Df26E7F39dCfdDa1bA',
             │  └─ 0x4dc9c2311b9bfddc117ef646088b22d4a9548d9651a93c8246f7ad33acdf9431',
             │     ├─ weight: 1 - address: 0xC31Ee68141cB47d2B260fE5A6e48b37d021D8F19',
             │     └─ weight: 1 - address: 0x947EE7254D4dE72F7A1B2e70ed3f8E8aE6510D77',
             └─ 0x7fe1e93c3a299dd8f6ebc06d4c94e5df6423b4ce919367f83f8c672e5e17cba8',
                ├─ 0x8d0659c89c7f8de17801cf0178f4d32550b095187afac0d6b733797af881b41b',
                │  ├─ weight: 1 - address: 0xb92E451800D78AA8f8492fFEA1a5afc77774f880',
                │  └─ weight: 1 - address: 0xCE1977029e9398Ec9F45327c81cf7a557F5D30b8',
                └─ 0xe4eaf15623516afc250692b6f8888be93638077ae5c78d95b01b7bf99b56cb67',
                   ├─ weight: 1 - address: 0x0b6a69349728615d6e1C8d4FD133e49AafD5b91b',
                   └─ weight: 1 - address: 0x8245B0c0C4319523c2D2616F86EBd02DaDA2FBD3'
      */

      const decoded = decodeSignature(sampleSignature3)

      expect(decoded).to.deep.equal({
        version: 2,
        type: SignatureType.Legacy,
        decoded: {
          checkpoint: 1667831412,
          threshold: 3,
          tree: {
            left: {
              left: {
                left: {
                  left: {
                    address: '0xA653F5900Ef5c538142Cd8Aef1CE750390B29a3E',
                    weight: 1
                  },
                  right: {
                    address: '0xA54e174d851bCFFE8C1332C00e23156B4982204D',
                    weight: 1
                  }
                },
                right: {
                  left: {
                    address: '0xDdfbA5791dE0b8Da80d46B43915Ae34C4876C4F8',
                    weight: 1
                  },
                  right: {
                    address: '0xF50834aa68DEc4D9D151b1ff1c509C81431DDC45',
                    weight: 1
                  }
                }
              },
              right: {
                left: {
                  left: {
                    address: '0xe8e7C96aF0D472a8D0E60E86009a97290Fbc0F6d',
                    weight: 1
                  },
                  right: {
                    address: '0x88a175d23b41252823e7fD88297754f5C580c4Ff',
                    weight: 1
                  }
                },
                right: {
                  left: {
                    address: '0x653cA45307922091337376Cb305485c0D889A7A1',
                    weight: 1
                  },
                  right: {
                    // address: '0xCf8BF768E2b69953577e1FF16b147c773faEc959',
                    signature:
                      '0xd9b2a3142267255c50581c8023648916a3e8c3ae7ca50f6752b6874a20e76e496b30c4e1b653691b3ae9fea40a66966f3d1f2a35cedb52fbf07ae09269fb3c8e1b02',
                    isDynamic: false,
                    unrecovered: true,
                    weight: 1
                  }
                }
              }
            },
            right: {
              left: {
                left: {
                  left: {
                    address: '0xa18522682c76e7e4083fCEF379839347a533f782',
                    weight: 1
                  },
                  right: {
                    address: '0x59d7eb9085272AdB317893Df26E7F39dCfdDa1bA',
                    weight: 1
                  }
                },
                right: {
                  left: {
                    address: '0xC31Ee68141cB47d2B260fE5A6e48b37d021D8F19',
                    weight: 1
                  },
                  right: {
                    address: '0x947EE7254D4dE72F7A1B2e70ed3f8E8aE6510D77',
                    weight: 1
                  }
                }
              },
              right: {
                left: {
                  left: {
                    // address: '0xb92E451800D78AA8f8492fFEA1a5afc77774f880',
                    signature:
                      '0x47f646e6d13434b2df65fc1ab9086264bed1030e485e3513ed01686d03d127df510efc468bbeedde677c3af1fda7b0dbffc7186e07203eb09718cc256cf6b5d11b02',
                    unrecovered: true,
                    isDynamic: false,
                    weight: 1
                  },
                  right: {
                    address: '0xCE1977029e9398Ec9F45327c81cf7a557F5D30b8',
                    weight: 1
                  }
                },
                right: {
                  left: {
                    address: '0x0b6a69349728615d6e1C8d4FD133e49AafD5b91b',
                    weight: 1
                  },
                  right: {
                    // address: '0x8245B0c0C4319523c2D2616F86EBd02DaDA2FBD3',
                    signature:
                      '0xaaac151a6ad4bf7f966db203164551a7c3c3969d15666dd2c75202231623f5ee2059711c84d2f216126bf3dc6cc63223eba079262e73c58da4f97583747c790b1c02',
                    unrecovered: true,
                    isDynamic: false,
                    weight: 1
                  }
                }
              }
            }
          }
        }
      })
    })

    it('Decode signature with nested trees', () => {
      /**
        0xc62c3d8ab0422ccbab7339f13b987179c2583743b8af4728cd49b146c710c5c6',
          ├─ 0xf6dc189f16bb65c588ccd5c63aa805bcbeb6e90dd8a049cfba0936050f299087',
          │  ├─ 0x59276a9b2f7b735fd033d13fdfcf01391f6c112dc48418107c47faa292cda138',
          │  │  ├─ 0x52b68b273da79cbad184ab5dc8e89825b373ab9af6ee97e0c556d3829126ba7c',
          │  │  │  ├─ weight: 1 - address: 0xb159d82f98490c5Db1dB71b76bbb2C3a86DEce0C',
          │  │  │  └─ weight: 1 - address: 0x29Fc57a0eb82688ad558A572C9E23e94243dB4d3',
          │  │  └─ weight: 1 - address: 0x0B2b3abA8538639E6D9c1B1200942FA00148ABCB',
          │  └─ weight: 1 - address: 0x3314715F5EE607A8988EC4c43351910CD6c76AE5',
          └─ 0xd9b2fcc7c63fceaea59b7423cfda5e01307139ac078c2a1695fef1f9a4d9f50a',
          └─ threshold: 2 - weight: 4',
              ├─ 0x3c8cb8e47389edeee921bdb2efa8a8e664ef38790cfb4230ee51d5314e3a37d3',
              │  ├─ 0x7c989a96925302993812c1ec3924bce3ba2ca0e8f7e3655e30f5b24d965aa18b',
              │  │  ├─ weight: 1 - address: 0x711dD9c6D02010ABEfd5a4587298CB6a230d3877',
              │  │  └─ weight: 1 - address: 0x05ead11721299d471d4e83b51ebfeB87F24A96c5',
              │  └─ 0xfeac20f352af0c03f48d1eaeeacbde8e86b391bf97dd83665c218271da447be2',
              │     ├─ weight: 1 - address: 0x4Faade320BBE1B9E31803A8A104305c3B5D5cC7E',
              │     └─ weight: 1 - address: 0xE403b05AA84848604B40aFDbfE4977e9Be4ECCa9',
              └─ weight: 1 - address: 0x907c144D2490f49838c6499507EE5914f4A22b5B'
      */

      const decoded = decodeSignature(sampleSignature4)

      expect(decoded).to.deep.equal({
        version: 2,
        type: SignatureType.Legacy,
        decoded: {
          threshold: 1,
          checkpoint: 2,
          tree: {
            left: {
              nodeHash: '0xf6dc189f16bb65c588ccd5c63aa805bcbeb6e90dd8a049cfba0936050f299087'
            },
            right: {
              weight: 4,
              threshold: 2,
              tree: {
                left: {
                  left: {
                    nodeHash: '0x7c989a96925302993812c1ec3924bce3ba2ca0e8f7e3655e30f5b24d965aa18b'
                  },
                  right: {
                    left: {
                      signature:
                        '0xa73ce16a9cc7075c18bd2b4fd2649812fecb51460353a55bf62f821bf884443a169e0d0e04113d7ef2c2d15f1ecf46531f291259542065c556f0e721a82b3c581b02',
                      weight: 1,
                      unrecovered: true,
                      isDynamic: false
                    },
                    right: {
                      signature:
                        '0x93f1f388009f68763df43632153155960ea6604723bb517e90788822ff21e38722be4387e8f67c0db677b74d9a0c2a804183e6a3eebd2ba53dbfc54432f1a10f1b02',
                      weight: 1,
                      unrecovered: true,
                      isDynamic: false
                    }
                  }
                },
                right: {
                  address: '0x907c144D2490f49838c6499507EE5914f4A22b5B',
                  weight: 1
                }
              }
            }
          }
        }
      })
    })

    it('Decode static subdigests signature', () => {
      /*
      0xd039f8f363eec6e6580c04fba1dfa1a7586827d884cb4d98ed667e131a01c268',
        ├─ 0x73c9ee2e965c95b829c86ef4849dbf2f0410f4ac4380d2fc58f9246f9d84d0d0',
        │  ├─ 0x73b96511a817fcf95200cd76af547a767c2faea2d52aa9e759f2a8ced75c7c67',
        │  │  ├─ 0x9be568b9b969ab8d1012696c56ff89db394dcac9881bef5e361a4ffed446d6f6',
        │  │  │  ├─ 0x1915fb45c54b103485bf50f1afb0fa6a70c1546211c48d15480ecc991765ba7f',
        │  │  │  │  ├─ X 0x2b4c067647ee1f154214b4ad83bbbe7e57a528ca0df587e34ded382ca7348c10',
        │  │  │  │  │  ├─ 0xd82efd7c2419e1ce6ec9de6f51051f6376773cd727c032cd15823755f19e4356',
        │  │  │  │  │  │  ├─ subDigest: 0xd151a051d91288c5c5f4688ec5c6f0977f41535747293bcdc6859885e2e3c8f9',
        │  │  │  │  │  │  └─ subDigest: 0x746fba99dcf684e2b9eb7dceace9d00b1988c5ad13fb46bb7c6272b8dac15821',
        │  │  │  │  │  └─ 0xbff3206ad6a9cb35896c77f154b2aa4f72b709c9f4ec756d0da521163b3bcb61',
        │  │  │  │  │     ├─ subDigest: 0xd5f94f3099a2c78c8687c81e7e29a2193a7003383989be621ab864efead521dc',
        │  │  │  │  │     └─ subDigest: 0x6f5f1a3fb35d99dbf84a5f23713fd168231dddf6589a990378b83cf03f02d9f0',
        │  │  │  │  └─ 0x798573e5ebb023632eafafce765fe8227f302a6db5e4c123a5a997c593471749',
        │  │  │  │     ├─ X 0xc702696d354063d18d750cc686a1f356e503f85516c54375ef5878250a227587',
        │  │  │  │     │  ├─ subDigest: 0xced8ceaa611754f0824a3066c4e53a1e78113dad5d8c63985b076eba2912bf09',
        │  │  │  │     │  └─ subDigest: 0x00b43843c7c77215b123e3471be7532c64180d872e2dd68cd739bb7f1bcca725',
        │  │  │  │     └─ 0x47344ce248ff726cf13c68d1e4bb7f2ab3a0b52d0668e240ed0925877ac62a88',
        │  │  │  │        ├─ -> subDigest: 0x4cd7065b01927d3429db64e0a7ec956fa5506dab23fa37c767eb4375fab7898b',
        │  │  │  │        └─ X (hashed) subDigest: 0xc0b21c4464a6acf6d8451d3a077bb3ebaa3953bd2e01609dec557af47239c012',
        │  │  │  └─ X 0x02c10a9634e89b4293346a7408364eeece764491bd465d043f7c826518c2bc95',
        │  │  │     ├─ subDigest: 0xae6b3762bab90dcc5eccbb3a8d1f5f8d9d974b2458403779ff998636c99ec15e',
        │  │  │     └─ subDigest: 0x5c9de17d821a60f691929cd6d475d155a27e4d3ce0c79b4412a8e5e50c0e4f1e',
        │  │  └─ X weight: 1 - address: 0x1A9bD9f98E2C0C81BcF51DA26c3a7CFcC18c43B4',
        │  └─ X 0x0c389524f715de03757bcbc7a084f52c5d54def431bb8080a18d0075e26b859c',
        │     ├─ weight: 1 - address: 0xEdAE5e1bF8D80e20C9008479A07400e84BC1af9D',
        │     └─ weight: 1 - address: 0xBf31A9f466Fc2844CDE7F12c87dc3e6676c8D0b2',
        └─ X weight: 1 - address: 0x379b2A7A384376B420D3D19c5c5717ABAaD3a969'
      */
      const decoded = decodeSignature(sampleSignature5)

      expect(decoded).to.deep.equal({
        version: 2,
        type: SignatureType.NoChainIdDynamic,
        decoded: {
          threshold: 1,
          checkpoint: 1667902589,
          tree: {
            left: {
              left: {
                left: {
                  left: {
                    left: {
                      nodeHash: '0x2b4c067647ee1f154214b4ad83bbbe7e57a528ca0df587e34ded382ca7348c10'
                    },
                    right: {
                      left: {
                        nodeHash: '0xc702696d354063d18d750cc686a1f356e503f85516c54375ef5878250a227587'
                      },
                      right: {
                        left: {
                          subdigest: '0x4cd7065b01927d3429db64e0a7ec956fa5506dab23fa37c767eb4375fab7898b'
                        },
                        right: {
                          nodeHash: '0x2acf6636e813600f741841733e57a7e0cb4131f3c68db7ba7014fb94525f5de2'
                        }
                      }
                    }
                  },
                  right: {
                    nodeHash: '0x02c10a9634e89b4293346a7408364eeece764491bd465d043f7c826518c2bc95'
                  }
                },
                right: {
                  address: '0x1A9bD9f98E2C0C81BcF51DA26c3a7CFcC18c43B4',
                  weight: 1
                }
              },
              right: {
                nodeHash: '0x0c389524f715de03757bcbc7a084f52c5d54def431bb8080a18d0075e26b859c'
              }
            },
            right: {
              address: '0x379b2A7A384376B420D3D19c5c5717ABAaD3a969',
              weight: 1
            }
          }
        }
      })
    })

    it('Decode dynamic signatures', () => {
      /*
        0xe916ef5f1e4c38acd77f793ab9fe6696272541dce1fc84ffb712e2faccd4be07',
          ├─ 0x8554edff027c3cb80d02e3e233a778c85165fbc2c813e8b4148339f8cda1cfd1',
          │  ├─ 0xd871650a4a126ee8112934486f91f28f4da3e64474d66c778d1f2bd84b6f9ec7',
          │  │  ├─ weight: 1 - address: 0x2093ec341be249BAA0c8aFA35fEF368a90a48390',
          │  │  └─ weight: 1 - address: 0xCd907CF455A1A00a4ebE37Ef5F4BB7aBc3770A69',
          │  └─ weight: 1 - address: 0x4bfFABff5819087514d8dB622543c3d0d89cD64D',
          └─ weight: 1 - address: 0xe8C4a6EB40EcE266C7a58670493eE0727be4D20A'
      */

      const decoded = decodeSignature(sampleSignature6)

      expect(decoded).to.deep.equal({
        version: 2,
        type: SignatureType.Dynamic,
        decoded: {
          threshold: 2,
          checkpoint: 1667904421,
          tree: {
            left: {
              left: {
                left: {
                  address: '0x2093ec341be249BAA0c8aFA35fEF368a90a48390',
                  weight: 1
                },
                right: {
                  address: '0xCd907CF455A1A00a4ebE37Ef5F4BB7aBc3770A69',
                  signature:
                    '0x28230cc5c4ee221c093054fef22c12d534f4d63782bc94a160c2f781cef142e019b84d82070b67cb750ec9ba46ae49e6687591810099f6e58811fbe35ea3db451c02',
                  weight: 1,
                  isDynamic: true,
                  unrecovered: true
                }
              },
              right: {
                address: '0x4bfFABff5819087514d8dB622543c3d0d89cD64D',
                signature:
                  '0x844e002b27098ba6144bc9eb7950cd20a4062d265bdd042bffbb7ec8405caf7f60f1c5bdcd8ea4f4acee17d5ac9eac6bcdb40a20a41796d40a153278ab062b211c02',
                weight: 1,
                isDynamic: true,
                unrecovered: true
              }
            },
            right: {
              address: '0xe8C4a6EB40EcE266C7a58670493eE0727be4D20A',
              weight: 1
            }
          }
        }
      })
    })

    it('Fail to decode invalid signature part type', () => {
      const invalidSignature = ethers.solidityPacked(
        ['bytes', 'uint8'],
        ['0x0001ffffffff', Object.keys(SignaturePartType).length / 2]
      )

      expect(() => decodeSignature(invalidSignature)).to.throw(
        `Unknown signature part type: ${Object.keys(SignaturePartType).length / 2}: 0x`
      )
    })

    it('Fail to decode empty tree signature', () => {
      const invalidSignature = '0x0001ffffffff'

      expect(() => decodeSignature(invalidSignature)).to.throw('Empty signature tree')
    })
  })

  describe('Encode signatures', () => {
    describe('Encode decoded signatures', () => {
      it('Re-encode simple signature', () => {
        const decoded = decodeSignature(sampleSignature1)
        const reEncoded = encodeSignature(decoded)
        expect(reEncoded).to.equal(sampleSignature1)
        expect(decoded).to.deep.equal(decodeSignature(reEncoded))
      })

      it('Re-encode trimmed 2/N with 31 signers', () => {
        const decoded = decodeSignature(sampleSignature2)
        const reEncoded = encodeSignature(decoded)

        expect(decoded).to.deep.equal(decodeSignature(reEncoded))
        expect(reEncoded).to.equal(sampleSignature2)
      })

      it('Re-encode non-trimmed 3/N with 16 signers', () => {
        const decoded = decodeSignature(sampleSignature3)
        const reEncoded = encodeSignature(decoded)

        expect(decoded).to.deep.equal(decodeSignature(reEncoded))
        expect(reEncoded).to.equal(sampleSignature3)
      })

      it('Re-encode signature with nested trees', () => {
        const decoded = decodeSignature(sampleSignature4)
        const reEncoded = encodeSignature(decoded)

        expect(decoded).to.deep.equal(decodeSignature(reEncoded))
        expect(reEncoded).to.equal(sampleSignature4)
      })

      it('Re-encode static subdigests signature', () => {
        const decoded = decodeSignature(sampleSignature5)
        const reEncoded = encodeSignature(decoded)

        expect(decoded).to.deep.equal(decodeSignature(reEncoded))
        expect(reEncoded).to.equal(sampleSignature5)
      })

      it('Re-encode dynamic signatures', () => {
        const decoded = decodeSignature(sampleSignature6)
        const reEncoded = encodeSignature(decoded)

        expect(decoded).to.deep.equal(decodeSignature(reEncoded))
        expect(reEncoded).to.equal(sampleSignature6)
      })
    })
  })
})
