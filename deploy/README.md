# Deploy 目录

本目录保存生产部署示例配置，不包含任何真实密钥。

- `nginx.conf.example`: wan.lat 的 Nginx 反向代理与 SSL 示例。

真实配置部署位置建议：

```bash
/etc/nginx/sites-available/xiaowangzi
/etc/nginx/sites-enabled/xiaowangzi
```

部署前必须执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```
