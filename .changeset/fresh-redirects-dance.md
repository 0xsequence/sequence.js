---
'@0xsequence/dapp-client': patch
'@0xsequence/wallet-wdk': patch
---

Fix redirect transport payload encoding so Unicode characters are handled correctly in redirect requests and responses.
Fix WDK cron scheduler resetting lastRun timestamp in storage to 0, which caused background jobs to execute too frequently after app reloads.
