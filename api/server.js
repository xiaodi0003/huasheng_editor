const express = require('express');
const markdownit = require('markdown-it');
const hljs = require('highlight.js');
const { JSDOM } = require('jsdom');
const path = require('path');

const STYLES = require('../styles');

const app = express();
app.use(express.json({ limit: '10mb' }));

const md = markdownit({
  html: true,
  linkify: true,
  typographer: false,
  highlight: function (str, lang) {
    const dots = '<div style="display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: #2a2c33; border-bottom: 1px solid #1e1f24;"><span style="width: 12px; height: 12px; border-radius: 50%; background: #ff5f56;"></span><span style="width: 12px; height: 12px; border-radius: 50%; background: #ffbd2e;"></span><span style="width: 12px; height: 12px; border-radius: 50%; background: #27c93f;"></span></div>';
    let codeContent = '';
    if (lang && hljs.getLanguage(lang)) {
      try {
        codeContent = hljs.highlight(str, { language: lang }).value;
      } catch (__) {
        codeContent = md.utils.escapeHtml(str);
      }
    } else {
      codeContent = md.utils.escapeHtml(str);
    }
    return `<div style="margin: 20px 0; border-radius: 8px; overflow: hidden; background: #383a42; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">${dots}<div style="padding: 16px; overflow-x: auto; background: #383a42;"><code style="display: block; color: #abb2bf; font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace; font-size: 14px; line-height: 1.6; white-space: pre;">${codeContent}</code></div></div>`;
  }
});

function preprocessMarkdown(content) {
  content = content.replace(/^[ ]{0,3}(\*[ ]*\*[ ]*\*[\* ]*)[ \t]*$/gm, '***');
  content = content.replace(/^[ ]{0,3}(-[ ]*-[ ]*-[- ]*)[ \t]*$/gm, '---');
  content = content.replace(/^[ ]{0,3}(_[ ]*_[ ]*_[_ ]*)[ \t]*$/gm, '___');
  content = content.replace(/\*\*\s+\*\*/g, ' ');
  content = content.replace(/\*{4,}/g, '');
  content = content.replace(/\*\*([）」』》〉】〕〗］｝"'。，、；：？！])/g, '**\u200B$1');
  content = content.replace(/([（「『《〈【〔〖［｛"'])\*\*/g, '$1\u200B**');
  content = content.replace(/__\s+__/g, ' ');
  content = content.replace(/_{4,}/g, '');
  content = content.replace(/^(\s*(?:\d+\.|-|\*)\s+[^:\n]+)\n\s*:\s*(.+?)$/gm, '$1: $2');
  content = content.replace(/^(\s*(?:\d+\.|-|\*)\s+.+?:)\s*\n\s+(.+?)$/gm, '$1 $2');
  content = content.replace(/^(\s*(?:\d+\.|-|\*)\s+[^:\n]+)\n:\s*(.+?)$/gm, '$1: $2');
  content = content.replace(/^(\s*(?:\d+\.|-|\*)\s+.+?)\n\n\s+(.+?)$/gm, '$1 $2');
  return content;
}

function groupConsecutiveImages(doc) {
  const body = doc.body;
  const children = Array.from(body.children);
  let imagesToProcess = [];

  children.forEach((child, index) => {
    if (child.tagName === 'P') {
      const images = child.querySelectorAll('img');
      if (images.length > 0) {
        if (images.length > 1) {
          const group = Array.from(images).map(img => ({
            element: child, img: img, index: index,
            inSameParagraph: true, paragraphImageCount: images.length
          }));
          imagesToProcess.push(...group);
        } else if (images.length === 1) {
          imagesToProcess.push({
            element: child, img: images[0], index: index,
            inSameParagraph: false, paragraphImageCount: 1
          });
        }
      }
    } else if (child.tagName === 'IMG') {
      imagesToProcess.push({
        element: child, img: child, index: index,
        inSameParagraph: false, paragraphImageCount: 1
      });
    }
  });

  let groups = [];
  let currentGroup = [];
  imagesToProcess.forEach((item, i) => {
    if (i === 0) { currentGroup.push(item); return; }
    const prevItem = imagesToProcess[i - 1];
    let isContinuous = false;
    if (item.index === prevItem.index) {
      isContinuous = true;
    } else if (item.index - prevItem.index === 1) {
      isContinuous = true;
    }
    if (isContinuous) {
      currentGroup.push(item);
    } else {
      if (currentGroup.length > 0) groups.push([...currentGroup]);
      currentGroup = [item];
    }
  });
  if (currentGroup.length > 0) groups.push(currentGroup);

  groups.forEach(group => {
    if (group.length < 2) return;
    const imageCount = group.length;
    const firstElement = group[0].element;

    const gridContainer = doc.createElement('div');
    gridContainer.setAttribute('class', 'image-grid');
    gridContainer.setAttribute('data-image-count', imageCount);

    let gridStyle, columns = 2;
    if (imageCount === 2) {
      gridStyle = `display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 20px auto; max-width: 100%; align-items: start;`;
      columns = 2;
    } else if (imageCount === 3) {
      gridStyle = `display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 20px auto; max-width: 100%; align-items: start;`;
      columns = 3;
    } else if (imageCount === 4) {
      gridStyle = `display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 20px auto; max-width: 100%; align-items: start;`;
      columns = 2;
    } else {
      gridStyle = `display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 20px auto; max-width: 100%; align-items: start;`;
      columns = 3;
    }
    gridContainer.setAttribute('style', gridStyle);
    gridContainer.setAttribute('data-columns', columns);

    group.forEach((item) => {
      const imgWrapper = doc.createElement('div');
      imgWrapper.setAttribute('style', `width: 100%; height: auto; overflow: hidden;`);
      const img = item.img.cloneNode(true);
      img.setAttribute('style', `width: 100%; height: auto; display: block; border-radius: 8px;`);
      imgWrapper.appendChild(img);
      gridContainer.appendChild(imgWrapper);
    });

    firstElement.parentNode.insertBefore(gridContainer, firstElement);
    const elementsToRemove = new Set(group.map(item => item.element));
    elementsToRemove.forEach(element => { if (element.parentNode) element.parentNode.removeChild(element); });
  });
}

function convertGridToTable(doc) {
  const imageGrids = doc.querySelectorAll('.image-grid');
  imageGrids.forEach(grid => {
    const columns = parseInt(grid.getAttribute('data-columns')) || 2;
    const imgWrappers = Array.from(grid.children);
    const table = doc.createElement('table');
    table.setAttribute('style', `width: 100% !important; border-collapse: collapse !important; margin: 20px auto !important; table-layout: fixed !important; border: none !important; background: transparent !important;`);
    const rows = Math.ceil(imgWrappers.length / columns);

    for (let i = 0; i < rows; i++) {
      const tr = doc.createElement('tr');
      for (let j = 0; j < columns; j++) {
        const index = i * columns + j;
        const td = doc.createElement('td');
        td.setAttribute('style', `padding: 4px !important; vertical-align: top !important; width: ${100 / columns}% !important; border: none !important; background: transparent !important;`);
        if (index < imgWrappers.length) {
          const imgWrapper = imgWrappers[index];
          const img = imgWrapper.querySelector('img');
          if (img) {
            const wrapper = doc.createElement('div');
            wrapper.setAttribute('style', `width: 100% !important; text-align: center !important; background-color: #f5f5f5 !important; border-radius: 4px !important; padding: 10px !important; box-sizing: border-box !important; overflow: hidden !important;`);
            const clonedImg = img.cloneNode(true);
            clonedImg.setAttribute('style', `max-width: 100% !important; max-height: 340px !important; height: auto !important; display: block !important; margin: 0 auto !important; object-fit: contain !important; border-radius: 4px !important;`);
            wrapper.appendChild(clonedImg);
            td.appendChild(wrapper);
          }
        }
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    grid.parentNode.replaceChild(table, grid);
  });
}

function applyInlineStyles(html, styleName) {
  const style = STYLES[styleName].styles;
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  groupConsecutiveImages(doc);

  Object.keys(style).forEach(selector => {
    if (selector === 'pre' || selector === 'code' || selector === 'pre code') return;
    const elements = doc.querySelectorAll(selector);
    elements.forEach(el => {
      if (el.tagName === 'IMG' && el.closest('.image-grid')) return;
      const currentStyle = el.getAttribute('style') || '';
      el.setAttribute('style', currentStyle + '; ' + style[selector]);
    });
  });

  const firstBlock = doc.body.firstElementChild;
  if (firstBlock) {
    const fs = firstBlock.getAttribute('style') || '';
    firstBlock.setAttribute('style', fs + '; margin-top: 0 !important;');
  }

  const container = doc.createElement('div');
  container.setAttribute('style', style.container);
  container.innerHTML = doc.body.innerHTML;
  return container.outerHTML;
}

app.post('/api/convert', (req, res) => {
  try {
    const { markdown, style: styleName = 'wechat-tech' } = req.body;

    if (!markdown) {
      return res.status(400).json({ error: 'markdown field is required' });
    }

    if (!STYLES[styleName]) {
      return res.status(400).json({
        error: `Style "${styleName}" not found`,
        available: Object.keys(STYLES)
      });
    }

    let processed = preprocessMarkdown(markdown);
    let html = md.render(processed);
    html = applyInlineStyles(html, styleName);

    const dom = new JSDOM(html);
    convertGridToTable(dom.window.document);
    html = dom.window.document.body.innerHTML;

    res.json({
      html,
      style: styleName,
      styleName: STYLES[styleName].name
    });
  } catch (err) {
    console.error('Conversion error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/styles', (req, res) => {
  const styles = Object.entries(STYLES).map(([key, val]) => ({ key, name: val.name }));
  res.json({ styles });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', styles: Object.keys(STYLES).length });
});

const PORT = process.env.PORT || 49672;
app.listen(PORT, () => {
  console.log(`公众号 Markdown 转换 API 已启动`);
  console.log(`  http://localhost:${PORT}/api/convert  [POST] 转换 Markdown`);
  console.log(`  http://localhost:${PORT}/api/styles   [GET]  查看可用样式`);
  console.log(`  http://localhost:${PORT}/api/health   [GET]  健康检查`);
});
