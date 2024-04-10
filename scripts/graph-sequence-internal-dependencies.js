const fs = require('fs').promises;
const path = require('path');

// Takes the first command-line argument as the search folder path
const searchFolder = process.argv[2];

if (!searchFolder) {
  console.error('Please provide a folder path as an argument.');
  process.exit(1);
}

async function findDependenciesWithSequence() {
  try {
    const subfolders = await fs.readdir(searchFolder, { withFileTypes: true });
    const bookmarks = [];

    for (const folder of subfolders) {
      if (folder.isDirectory()) {
        const packageJsonPath = path.join(searchFolder, folder.name, 'package.json');
        try {
          const packageJson = await fs.readFile(packageJsonPath, 'utf8');
          const dependencies = JSON.parse(packageJson).dependencies;

          if (dependencies) {
            for (const [depName, version] of Object.entries(dependencies)) {
              if (depName.includes('0xsequence') && version.includes('workspace')) {
                bookmarks.push({ folder: folder.name, dependency: depName });
              }
            }
          }
        } catch (error) {
          console.log(`Couldn't read or parse package.json in ${folder.name}: ${error.message}`);
        }
      }
    }

    return bookmarks;
  } catch (error) {
    console.error(`Failed to read directory ${searchFolder}: ${error.message}`);
    return [];
  }
}

function safeNodeName(nodeName) {
  return nodeName.includes('-') ? `"${nodeName}"` : nodeName
}

const graphHeader = `digraph G {
  rankdir="TD";
`

const exposedNodeStyle = ' [fillcolor="#e597ff", style="rounded,filled" shape=diamond]'

findDependenciesWithSequence().then((bookmarks) => {
  const nodes = bookmarks.filter(b => b.folder.includes('0xsequence'))
  const connections = bookmarks.filter(b => !b.folder.includes('0xsequence'))

  console.log(graphHeader)
  nodes.map(bookmark => `  ${bookmark.dependency.replace('@0xsequence/', '')} ${exposedNodeStyle}`).forEach(b => console.log(b));
  console.log('')
  connections.map(bookmark => `  ${safeNodeName(bookmark.folder)} -> ${bookmark.dependency.replace('@0xsequence/', '')}`).forEach(b => console.log(b));
  console.log('}')
});
