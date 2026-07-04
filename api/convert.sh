#!/bin/bash
# 将 Markdown 文本转换为公众号格式并复制到剪贴板
# 用法:
#   printf '# Hello\n\n正文' | ./convert.sh
#   ./convert.sh -f input.md
#   ./convert.sh -s gaudi-organic < input.md

API_URL="${API_URL:-http://localhost:49672/api/convert}"
STYLE="${STYLE:-wechat-tech}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--style) STYLE="$2"; shift 2 ;;
    -f|--file) FILE="$2"; shift 2 ;;
    -h|--help)
      echo "用法: convert.sh [-s style] [-f file]"
      echo "       echo 'markdown text' | convert.sh [-s style]"
      echo "环境变量: API_URL (默认 http://localhost:49672/api/convert)"
      exit 0 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

# 检查并启动 API 服务器
API_HOST="${API_URL%/*}"
if curl -s -o /dev/null --connect-timeout 2 "$API_HOST" 2>/dev/null; then
  STARTED_SERVER=false
else
  echo "启动转换 API 服务..." >&2
  cd "$SCRIPT_DIR" && node server.js &
  SERVER_PID=$!
  STARTED_SERVER=true
  for i in $(seq 1 30); do
    if curl -s -o /dev/null --connect-timeout 1 "$API_HOST" 2>/dev/null; then
      echo "API 服务已就绪" >&2
      break
    fi
    sleep 1
  done
  if ! curl -s -o /dev/null --connect-timeout 2 "$API_HOST" 2>/dev/null; then
    echo "错误: API 服务启动超时" >&2
    exit 1
  fi
fi

TMPDIR=$(mktemp -d)
cleanup() {
  rm -rf "$TMPDIR"
  if [[ "$STARTED_SERVER" == true ]]; then
    kill "$SERVER_PID" 2>/dev/null
  fi
}
trap cleanup EXIT

if [[ -n "$FILE" ]]; then
  cp "$FILE" "$TMPDIR/input.md"
else
  cat > "$TMPDIR/input.md"
fi

if [[ ! -s "$TMPDIR/input.md" ]]; then
  echo "错误: 请输入 Markdown 内容" >&2
  exit 1
fi

python3 -c "
import json, subprocess, sys, os

os.chdir('$TMPDIR')
with open('input.md') as f:
    md = f.read()

payload = json.dumps({'markdown': md, 'style': '$STYLE'})
proc = subprocess.run(
    ['curl', '-s', '-X', 'POST', '$API_URL',
     '-H', 'Content-Type: application/json',
     '-d', payload],
    capture_output=True, text=True
)

resp = json.loads(proc.stdout)
html = resp['html']

# 通过 clipboard_html.py 写入剪贴板（HTML 格式）
clip = subprocess.Popen(
    ['python3', '$SCRIPT_DIR/clipboard_html.py'],
    stdin=subprocess.PIPE, stderr=subprocess.PIPE
)
_, stderr = clip.communicate(html.encode('utf-8'))
if clip.returncode != 0:
    print(f'剪贴板错误: {stderr.decode()}', file=sys.stderr)
    sys.exit(1)
" 2>&1

if [[ $? -ne 0 ]]; then
  echo "错误: 转换失败" >&2
  exit 1
fi

echo "已复制到剪贴板（样式: $STYLE）" >&2
