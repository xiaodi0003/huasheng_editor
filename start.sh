#!/bin/bash

# 公众号 Markdown 编辑器 - 启动脚本

echo "📝 公众号 Markdown 编辑器"
echo "================================"
echo ""
echo "🌐 服务器地址: http://localhost:8080/"
echo "📌 按 Ctrl+C 停止服务器"
echo "================================"
echo ""
echo "⚙️  可选: 同时启动转换 API (端口 49672)"
echo "   cd api && npm start"
echo "   curl -X POST http://localhost:49672/api/convert ..."
echo "================================"
echo ""

# 启动简单的 HTTP 服务器
python3 -m http.server 8080
