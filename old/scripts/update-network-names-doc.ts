const fs = require('fs')
const path = require('path')
const { networks } = require("@0xsequence/network/constants");

const networkPath = path.resolve(__dirname, '../packages/network')
const templatePath = path.join(networkPath, 'networkNames.template.md')
const outputPath = path.join(networkPath, 'networkNames.md')
const template = fs.readFileSync(templatePath, 'utf8')

const networkObjs = Object.values(networks) as Array<{
  deprecated?: boolean, 
  chainId: number, 
  name: string, 
  title?: string
}>;

const activeNetworkObjs = networkObjs.filter(v => !v.deprecated).sort((a, b) => a.chainId - b.chainId)

const lines: string[] = [];
lines.push(`| Network Name | Chain ID | Name Slug |`);
lines.push(`| --- | --- | --- |`);
for (const n of activeNetworkObjs) {
  lines.push(`| ${n.title} | ${n.chainId} | ${n.name} |`);
}

const doc = template.replace("<!-- tables start here -->", lines.join("\n"));

fs.writeFileSync(outputPath, doc, 'utf8')

console.log(`Updated network/networkNames.md`)
