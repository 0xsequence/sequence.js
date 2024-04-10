const fs = require('fs').promises
const path = require('path')

// Takes the first command-line argument as the search folder path
const searchFolder = process.argv[2]
const includeExternalDeps = process.argv.includes('-e')

if (!searchFolder) {
  console.error('Please provide a folder path as an argument.')
  process.exit(1)
}

async function findDependenciesWithSequence() {
  try {
    const subfolders = await fs.readdir(searchFolder, { withFileTypes: true })

    const nodes = new Map()

    class Node {
      constructor(_name, _isInternal) {
        this.name = _name
        this.isInternal = _isInternal
        this.dependsOn = []
        this.dependedOnBy = []
      }
    }

    function getNode(name, isInternal) {
      if (!nodes.has(name)) {
        nodes.set(name, new Node(name, isInternal))
      }
      return nodes.get(name)
    }

    for (const folder of subfolders) {
      if (folder.isDirectory()) {
        const packageJsonPath = path.join(searchFolder, folder.name, 'package.json')
        try {
          const packageJson = await fs.readFile(packageJsonPath, 'utf8')
          const dependencies = JSON.parse(packageJson).dependencies

          if (dependencies) {
            for (const [depName, version] of Object.entries(dependencies)) {
              const isInternal = depName.includes('0xsequence') && version.includes('workspace')
              const leftNode = getNode('@0xsequence/' + folder.name, true)
              const rightNode = getNode(`${depName}@${version}`.replace('@workspace:*', ''), isInternal)
              leftNode.dependsOn.push(rightNode.name)
              rightNode.dependedOnBy.push(leftNode.name)
            }
          }
        } catch (error) {
          console.log(`// Couldn't read or parse package.json in ${folder.name}: ${error.message}`)
        }
      }
    }

    return nodes
  } catch (error) {
    console.error(`Failed to read directory ${searchFolder}: ${error.message}`)
    return new Dictionary()
  }
}

function safeNodeName(nodeName) {
  let safeName = nodeName.replace('@0xsequence/', '')
  safeName =
    safeName.includes('@') || safeName.includes('-') || safeName.includes('/') || safeName.startsWith('0x')
      ? `"${safeName}"`
      : safeName
  return safeName
}

const graphHeader = `digraph G {
  rankdir="TD";
`

const defaultNodeStyle = '[shape=circle, penwidth=1, fontsize=8.0]'
const internalNodeStyle = '[fillcolor="#e5ccff", style="filled" shape=circle, penwidth=1]'
const internalExposedNodeStyle = '[fillcolor="#e597ff", style="filled" shape=circle, penwidth=2]'

findDependenciesWithSequence().then(nodesMap => {
  const allNodes = Array.from(nodesMap.values())
  console.log(graphHeader)
  for (const node of allNodes) {
    if (node.name === '@0xsequence/0xsequence') {
      continue
    }
    let style = defaultNodeStyle
    if (node.isInternal) {
      style = node.dependedOnBy.includes('@0xsequence/0xsequence') ? internalExposedNodeStyle : internalNodeStyle
    }
    if (node.dependedOnBy.filter(n => n !== '@0xsequence/0xsequence').length > 0) {
      style = style.replace('shape=circle', 'shape=hexagon')
    }
    if(includeExternalDeps || node.isInternal) {
      console.log(`  ${safeNodeName(node.name)} ${style}`)
    }
  }
  console.log('')
  for (const node of allNodes) {
    if (node.name === '@0xsequence/0xsequence') {
      continue
    }
    for (const dependent of node.dependsOn) {
      if((nodesMap.get(dependent).isInternal && node.isInternal) || includeExternalDeps) {
        console.log(`  ${safeNodeName(dependent)} -> ${safeNodeName(node.name)}`)
      }
    }
  }
  // console.log(`  subgraph cluster_l {
  //   label="LEGEND"
  //   rankdir="TD"
  //   `)
  // console.log(`    "internal package" ${internalNodeStyle}`)
  // console.log(`    "external dependency" ${defaultNodeStyle.replace('shape=circle', 'shape=hexagon')}`)
  // console.log(`    "internal dependency and 0xsequence package" ${internalExposedNodeStyle.replace('shape=circle', 'shape=hexagon')}`)
  // console.log(`    "internal dependency" ${internalNodeStyle.replace('shape=circle', 'shape=hexagon')}`)
  // console.log(`    "0xsequence package" ${internalExposedNodeStyle}`)
  // console.log(`  }`)
  console.log('}')
})
