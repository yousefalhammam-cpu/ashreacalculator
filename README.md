# ASHRAE 170P HVAC Calculator — PWA (Mobile Web)

## تشغيل محلي (للتجربة)
> لازم يكون عبر سيرفر (مو فتح ملف مباشرة) عشان الـ Service Worker يشتغل.

### Python
python -m http.server 8000
.

### AirCalc local server

```bash
node local-static-server.js
```

Open:

```text
http://127.0.0.1:5500/app/index.html
```

This local server also exposes the AI explanation foundation route at `/api/ai/explain`. It uses the safe `foundation_stub`; no provider or API key is connected.

## تثبيت على iPhone (كأنه تطبيق)
Safari > Share > Add to Home Screen

## تثبيت على Android
Chrome > menu > Add to Home screen
