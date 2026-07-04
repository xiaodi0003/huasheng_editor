#!/usr/bin/env python3
"""读取 stdin 的 HTML 内容并写入系统剪贴板（富文本格式 + 纯文本兜底）"""

import sys
import subprocess
import tempfile
import os
import re


def strip_html(html):
    return re.sub('<[^>]+>', '', html).strip()


def copy_html(html):
    plain = strip_html(html)

    with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False, encoding='utf-8') as f:
        f.write(html)
        html_path = f.name

    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
        f.write(plain)
        plain_path = f.name

    applescript = f'''
use framework "AppKit"
use framework "Foundation"
set htmlPath to "{html_path}"
set plainPath to "{plain_path}"
set htmlContent to (current application's NSString's stringWithContentsOfFile:htmlPath encoding:(current application's NSUTF8StringEncoding) |error|:missing value)
set plainContent to (current application's NSString's stringWithContentsOfFile:plainPath encoding:(current application's NSUTF8StringEncoding) |error|:missing value)
set pb to current application's NSPasteboard's generalPasteboard()
pb's clearContents()
pb's setString:htmlContent forType:"public.html"
pb's setString:plainContent forType:"public.utf8-plain-text"
'''

    with tempfile.NamedTemporaryFile(mode='w', suffix='.applescript', delete=False, encoding='utf-8') as f:
        f.write(applescript)
        script_path = f.name

    try:
        proc = subprocess.run(['osascript', script_path],
                              capture_output=True, text=True)
        if proc.returncode != 0:
            print(f'AppleScript 错误: {proc.stderr}', file=sys.stderr)
            return False
        return True
    finally:
        os.unlink(html_path)
        os.unlink(plain_path)
        os.unlink(script_path)


if __name__ == '__main__':
    html = sys.stdin.read()
    if not html.strip():
        print('错误: 请输入 HTML 内容', file=sys.stderr)
        sys.exit(1)
    if copy_html(html):
        print('已复制到剪贴板（HTML 富文本格式）', file=sys.stderr)
    else:
        print('复制失败', file=sys.stderr)
        sys.exit(1)
