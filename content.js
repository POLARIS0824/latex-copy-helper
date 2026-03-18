/**
 * LaTeX Copy Helper - Content Script
 *
 * 策略：监听所有 click 和 keyboard 复制事件，
 * 在复制发生后，通过 background service worker 读取并修改剪贴板。
 * 
 * 由于 Gemini 的 CSP 阻止了 MAIN world 注入，
 * 我们改用"事后修改"策略：检测到复制动作后，
 * 用一个短暂的延迟读取剪贴板并转换内容。
 */

(function () {
  'use strict';

  // 冷却期机制：防止短时间内重复转换
  let lastConversionTime = 0;
  const CONVERSION_COOLDOWN = 1000; // 1秒内不重复转换

  function convertLatexDelimiters(text) {
    if (!text || !text.includes('$')) return text;

    // 保护已有的 $$...$$ 块
    const blocks = [];
    let processed = text.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
      const ph = `__BLOCK_${blocks.length}__`;
      blocks.push(match);
      return ph;
    });

    // 单 $...$ → $$...$$
    processed = processed.replace(
      /(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$(?!\$)/g,
      '$$$$$1$$$$'
    );

    // 恢复块级公式
    blocks.forEach((orig, i) => {
      processed = processed.replace(new RegExp(`__BLOCK_${i}__`, 'g'), orig);
    });

    return processed;
  }

  function showToast(message) {
    const existing = document.getElementById('latex-copy-helper-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'latex-copy-helper-toast';
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#fff',
      padding: '12px 20px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: '999999',
      boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
      opacity: '0',
      transform: 'translateY(10px)',
      transition: 'all 0.3s ease',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /**
   * 尝试读取剪贴板并转换 LaTeX 格式
   */
  async function tryConvertClipboard() {
    // 检查冷却期，防止重复转换
    const now = Date.now();
    if (now - lastConversionTime < CONVERSION_COOLDOWN) {
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.includes('$')) return;

      const converted = convertLatexDelimiters(text);
      if (converted !== text) {
        await navigator.clipboard.writeText(converted);
        lastConversionTime = Date.now(); // 记录转换时间
        showToast('✅ LaTeX 公式已转换为 Notion 格式');
        console.log('[LaTeX Copy Helper] 已转换剪贴板内容');
      }
    } catch (err) {
      // 权限不足时静默失败
      console.log('[LaTeX Copy Helper] 无法访问剪贴板:', err.message);
    }
  }

  // ========== 方式 1：监听 copy 事件（Ctrl+C） ==========
  document.addEventListener('copy', function (e) {
    // 给一个短暂延迟，让浏览器先完成复制到剪贴板
    setTimeout(tryConvertClipboard, 100);
  });

  // ========== 方式 2：监听 Gemini 的复制按钮点击 ==========
  // Gemini 的复制按钮通常在响应消息的底部工具栏中
  document.addEventListener('click', function (e) {
    const target = e.target.closest('button');
    if (!target) return;

    // 检测复制按钮：通过 aria-label、tooltip 或图标
    const ariaLabel = (target.getAttribute('aria-label') || '').toLowerCase();
    const title = (target.getAttribute('title') || '').toLowerCase();
    const matTooltip = (target.getAttribute('mattooltip') || '').toLowerCase();
    const dataTooltip = (target.getAttribute('data-tooltip') || '').toLowerCase();

    const isCopyButton =
      ariaLabel.includes('copy') ||
      ariaLabel.includes('复制') ||
      title.includes('copy') ||
      title.includes('复制') ||
      matTooltip.includes('copy') ||
      matTooltip.includes('复制') ||
      dataTooltip.includes('copy') ||
      dataTooltip.includes('复制');

    // 也检查按钮内部是否有复制图标（content_copy material icon）
    const hasContentCopyIcon = target.querySelector('mat-icon')?.textContent?.trim() === 'content_copy'
      || target.querySelector('[data-mat-icon-name="content_copy"]') !== null
      || target.innerHTML.includes('content_copy');

    if (isCopyButton || hasContentCopyIcon) {
      console.log('[LaTeX Copy Helper] 检测到复制按钮点击');
      // 给 Gemini 一点时间完成复制操作
      setTimeout(tryConvertClipboard, 300);
    }
  }, true); // 使用 capture 阶段确保我们能捕获到

  // ========== 方式 3：使用 MutationObserver 监听 "已复制" 提示 ==========
  // Gemini 在复制成功后会短暂显示一个 "Copied" 提示
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const text = node.textContent?.toLowerCase() || '';
          if (text.includes('copied') || text.includes('已复制')) {
            console.log('[LaTeX Copy Helper] 检测到 "已复制" 提示');
            setTimeout(tryConvertClipboard, 100);
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  console.log('[LaTeX Copy Helper] ✅ Content script 已加载 (v2.0 - 事后修改策略)');
})();
