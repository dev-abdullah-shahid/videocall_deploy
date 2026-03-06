# Deployment Guide — EasyRTC Video Call + NiceGUI on Ubuntu VPS

## Requirements
- Ubuntu 24.04 VPS with root SSH access
- A domain name
- Local terminal (Mac/Linux) or PowerShell (Windows)

---

## 1. Connect to Server

```bash
ssh root@YOUR_SERVER_IP
```

---

## 2. Server Setup

```bash
# Update server
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install Python, Nginx, PM2, Certbot
apt install -y python3 python3-pip python3.12-venv nginx certbot python3-certbot-nginx
npm install -g pm2

# Verify
node -v && python3 --version && nginx -v && pm2 -v
```

---

## 3. Upload Files

Run these on your **local machine** (not SSH):

```bash
# Create directories on server first (run in SSH)
mkdir -p /var/www/easyrtc
mkdir -p /var/www/nicegui

# Upload EasyRTC project (run locally)
scp -r /path/to/videocall-deploy root@YOUR_SERVER_IP:/var/www/easyrtc

# Upload NiceGUI app (run locally)
scp /path/to/main.py root@YOUR_SERVER_IP:/var/www/nicegui/main.py
```

---

## 4. Deploy EasyRTC

```bash
cd /var/www/easyrtc/videocall-deploy/server_example
npm install
pm2 start server.js --name "easyrtc"
```

---

## 5. Deploy NiceGUI

```bash
cd /var/www/nicegui

# Create virtual environment and install NiceGUI
python3 -m venv venv
source venv/bin/activate
pip install nicegui
deactivate

# Make sure the last line in main.py is:
# ui.run(host='0.0.0.0', port=8000, reload=False)

# Start with PM2
pm2 start "/var/www/nicegui/venv/bin/python3 main.py" --name "nicegui"
```

---

## 6. Auto-Restart on Reboot

```bash
pm2 startup
# Copy and run the command it gives you, then:
pm2 save
```

---

## 7. DNS Configuration

Go to your domain registrar's DNS settings and add these two A records:

| Type | Name | Points To       | TTL |
|------|------|-----------------|-----|
| A    | @    | YOUR_SERVER_IP  | 300 |
| A    | www  | YOUR_SERVER_IP  | 300 |

Wait 5–15 minutes for DNS to propagate, then verify:
```bash
ping yourdomain.com
```
Should return your server IP.

---

## 8. Nginx Configuration

```bash
nano /etc/nginx/sites-available/myapp
```

Paste this config (replace `yourdomain.com` with your domain):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    client_max_body_size 100M;

    location /_nicegui/ {
        proxy_pass http://localhost:8000/_nicegui/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_buffering off;
    }

    location ~* ^/(Nicegui-app|page_layout|_nicegui) {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_buffering off;
    }

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

Enable and reload:

```bash
ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
```

---

## 9. SSL Certificate

```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts — enter your email, agree to terms, and select option 2 to redirect HTTP to HTTPS.

---

## 10. URLs

| URL | App |
|-----|-----|
| `https://yourdomain.com/videocall.html` | Standalone video call |
| `https://yourdomain.com/Nicegui-app` | NiceGUI with embedded video call |

---

## 11. Useful Commands

```bash
pm2 list                          # Check status of all apps
pm2 restart all                   # Restart both apps
pm2 logs easyrtc --lines 20       # View EasyRTC logs
pm2 logs nicegui --lines 20       # View NiceGUI logs
nginx -t && systemctl reload nginx # Reload Nginx after config changes
certbot renew                     # Manually renew SSL certificate
```

---

## 12. Updating Files

```bash
# Update videocall.html (no restart needed)
scp /path/to/videocall.html root@YOUR_SERVER_IP:/var/www/easyrtc/videocall-deploy/server_example/static/videocall.html

# Update main.py (restart required)
scp /path/to/main.py root@YOUR_SERVER_IP:/var/www/nicegui/main.py
pm2 restart nicegui
```

---

## Troubleshooting

- **App not loading** — run `pm2 list` and check both show `online`
- **Camera not working** — make sure you are on HTTPS and browser permissions are allowed
- **NiceGUI not loading** — run `pm2 logs nicegui --lines 20` to see errors
- **Port conflict** — run `ss -tlnp | grep 8080` or `ss -tlnp | grep 8000` to find what is using the port