#!/usr/bin/env bash

# 產生一個高熵的隨機字串作 code_verifier（長度可調，建議 43–128 字元）
code_verifier=$(openssl rand -base64 64 | tr -d '=+/ ' | cut -c1-64)

# 用 SHA-256 算出 hash，然後轉為 Base64 URL safe（去掉 "=", 把 + 換成 -, / 換成 _）
code_challenge=$(openssl dgst -sha256 -binary <<< "$code_verifier" | openssl base64 | tr '+/' '-_' | tr -d '=')

echo "code_verifier=$code_verifier"
echo "code_challenge=$code_challenge"
echo ""
echo "按任意鍵繼續..."
read -n 1 -s -r

pause

# code_verifier=28Orb8k6CWvxEd7Mn3x4mPHXzjkc6GAkEa8wSzreUJ9x7T1HCLX80ZZMbXQS7Tt
# kPfBoNxYYV18yFOLqdGPGQ
# code_challenge=GLZ2kGgvb1ylDWMi3bWF0UWFj2QUkNIOPXVdD1bSiig
