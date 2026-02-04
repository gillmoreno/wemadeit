# README

This README would normally document whatever steps are necessary to get the
application up and running.

Things you may want to cover:

* Ruby version

* System dependencies

* Configuration

* Database creation

* Database initialization

* How to run the test suite

* Services (job queues, cache servers, search engines, etc.)

* Deployment instructions

* ...
## Cloudflare Tunnel (wemadeit)

The production-style Cloudflare tunnel for `wemadeit.aigil.dev` is managed by a macOS LaunchDaemon and uses `/etc/cloudflared/config-wemadeit.yml`. Keep metrics off the app port (`3019`) to avoid conflicts.

Setup or fix:

```bash
sudo /bin/sh -c "sed -i '' 's/^metrics:.*/metrics: localhost:9399/' /etc/cloudflared/config-wemadeit.yml"
sudo launchctl kickstart -k system/com.cloudflare.cloudflared.wemadeit
sudo launchctl print system/com.cloudflare.cloudflared.wemadeit | head -n 20
```
