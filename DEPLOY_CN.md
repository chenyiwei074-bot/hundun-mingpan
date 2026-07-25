# 混沌阁命盘 - 国内服务器部署指南

适用：阿里云 / 腾讯云轻量应用服务器
系统：Ubuntu 22.04 | 最低配置：2核4G

---

## 1. 购买服务器

| 推荐 | 阿里云轻量 2核4G ~68元/月 | 腾讯云轻量 2核4G ~58元/月 |

拿到服务器 IP 和 root 密码。

---

## 2. 环境安装

SSH 登录服务器：

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs postgresql-16 nginx git
sudo npm install -g pm2
```

---

## 3. 上传代码

```bash
tar --exclude="node_modules" --exclude=".next" --exclude="dist" -czf hundun.tar.gz .
scp hundun.tar.gz root@你的IP:/opt/
ssh root@你的IP "cd /opt && tar -xzf hundun.tar.gz"
```

---

## 4. 安装依赖

```bash
cd /opt/hundun-mindpan/server && npm ci
cd /opt/hundun-mindpan/frontend && npm ci
```

---

## 5. 环境变量

```bash
cp server/.env.example server/.env
nano server/.env
```
DATABASE_URL=postgresql://hundun:你的密码@localhost:5432/hundun_mindpan
PORT=3000

---

## 6. 数据库初始化

```bash
sudo -u postgres psql -c "CREATE USER hundun WITH PASSWORD 你的密码;"
sudo -u postgres psql -c "CREATE DATABASE hundun_mindpan OWNER hundun;"
cd server && npx prisma db push
```

---

## 7. 构建与启动

```bash
cd server && npm run build
cd ../frontend && npm run build
cd .. && mkdir -p logs
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

---

## 8. Nginx 配置

```bash
sudo cp nginx/nginx.conf /etc/nginx/sites-available/hundun
# 编辑: 把 example.com 改为你的域名
sudo ln -s /etc/nginx/sites-available/hundun /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

---

## 9. 域名 + HTTPS

DNS 添加 A 记录指向服务器 IP，然后：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

---

## 10. 日常运维

```bash
pm2 status          # 查看状态
pm2 logs            # 查看日志
pm2 restart all     # 重启
# 更新代码
git pull && cd server && npm run build && cd ../frontend && npm run build && pm2 restart all
# 数据库备份
pg_dump -U hundun hundun_mindpan > backup_$(date +%Y%m%d).sql
```

---

## 月成本

| 项目 | 月费 |
|------|------|
| 服务器 | ~68元 |
| 域名 | ~5元 |
| PostgreSQL | 自建免费 |
| AI | 规则引擎免费 |
| **合计** | **~73元/月** |

---

## 架构

```
用户 -> Nginx(:80) -> /api/* -> Express(:3000) -> PostgreSQL
                   -> /*    -> Next.js(:3001)
```
