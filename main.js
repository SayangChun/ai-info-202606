// main.js - 纯原生 JS，实现搜索、过滤、排序、Modal、深色模式

const data = window.aiData || [];

const vendorLogoMap = {
  'Anthropic': 'logos/anthropic.svg',
  'OpenAI': 'logos/openai.svg',
  'Google': 'logos/google.svg',
  'xAI': 'logos/xai.svg',
  'DeepSeek': 'logos/deepseek.svg',
  'Alibaba': 'logos/alibaba.svg',
  'Zhipu AI': 'logos/zhipuai.svg',
  'Kimi': 'logos/kimi.svg',
  'MiniMax': 'logos/minimax.svg',
  'Mistral': 'logos/mistral.svg'
};

// DOM 引用
const tbody = document.getElementById('table-body');
const searchInput = document.getElementById('search');
const vendorChips = document.getElementById('vendor-chips');
const filterReasoning = document.getElementById('filter-reasoning');
const filterMultimodal = document.getElementById('filter-multimodal');
const filterOpen = document.getElementById('filter-open');
const priceFilter = document.getElementById('price-filter');
const contextFilter = document.getElementById('context-filter');
const clearBtn = document.getElementById('clear-filters');
const resultCount = document.getElementById('result-count');
const themeBtn = document.getElementById('theme-toggle');

const modal = document.getElementById('modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalLink = document.getElementById('modal-link');

// 状态
let state = {
  search: '',
  vendors: new Set(),
  reasoning: false,
  multimodal: false,
  openWeights: false,
  priceRange: '',
  context: '',
  sortKey: 'intelligence',
  sortDir: 'desc'   // asc | desc
};

// 初始化主题
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    themeBtn.textContent = '☀️ 浅色模式';
  } else {
    themeBtn.textContent = '🌙 深色模式';
  }

  themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeBtn.textContent = isDark ? '☀️ 浅色模式' : '🌙 深色模式';
  });
}

// 初始化厂商 chips
function initVendorChips() {
  const vendors = [...new Set(data.map(d => d.vendor))].sort();
  vendors.forEach(v => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = v;
    chip.dataset.vendor = v;
    chip.addEventListener('click', () => {
      if (state.vendors.has(v)) {
        state.vendors.delete(v);
        chip.classList.remove('active');
      } else {
        state.vendors.add(v);
        chip.classList.add('active');
      }
      render();
    });
    vendorChips.appendChild(chip);
  });
}

// 过滤数据
function filterData() {
  let result = data.filter(item => {
    // 搜索
    const q = state.search.toLowerCase();
    if (q && !item.model.toLowerCase().includes(q) && !item.vendor.toLowerCase().includes(q)) {
      return false;
    }

    // 厂商
    if (state.vendors.size > 0 && !state.vendors.has(item.vendor)) {
      return false;
    }

    // 能力
    if (state.reasoning && !item.reasoning) return false;
    if (state.multimodal && !item.multimodal) return false;
    if (state.openWeights && !item.openWeights) return false;

    // 价格区间
    if (state.priceRange) {
      const p = item.inputPrice;
      if (state.priceRange === '0-0.5' && p >= 0.5) return false;
      if (state.priceRange === '0.5-2' && (p < 0.5 || p >= 2)) return false;
      if (state.priceRange === '2-5' && (p < 2 || p >= 5)) return false;
      if (state.priceRange === '5+' && p < 5) return false;
    }

    // 上下文
    if (state.context === '200k' && item.contextWindow < 200000) return false;
    if (state.context === '1m' && item.contextWindow < 1000000) return false;

    return true;
  });

  // 排序
  result.sort((a, b) => {
    let va = a[state.sortKey];
    let vb = b[state.sortKey];

    // 字符串排序
    if (typeof va === 'string') {
      va = va.toLowerCase();
      vb = vb.toLowerCase();
      if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
      if (va > vb) return state.sortDir === 'asc' ? 1 : -1;
      return 0;
    }

    // 数值排序
    if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
    if (va > vb) return state.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return result;
}

// 渲染表格
function renderTable(filtered) {
  tbody.innerHTML = '';

  filtered.forEach(item => {
    const tr = document.createElement('tr');

    const priceClass = item.inputPrice < 0.5 ? 'price-low' :
                       item.inputPrice < 2 ? 'price-mid' : 'price-high';

    const badges = [];
    if (item.reasoning) badges.push('<span class="badge reason">推理</span>');
    if (item.multimodal) badges.push('<span class="badge multi">多模态</span>');
    if (item.tools && item.tools.length) badges.push('<span class="badge tool">工具</span>');

    const logoSrc = vendorLogoMap[item.vendor];
    const logoHtml = logoSrc ? `<img class="vendor-logo" src="${logoSrc}" alt="${item.vendor}">` : '';
    tr.innerHTML = `
      <td class="vendor">${item.vendor}</td>
      <td class="model">${logoHtml}${item.model}</td>
      <td>${item.updateDate}</td>
      <td>${(item.contextWindow / 1000).toLocaleString()}K</td>
      <td class="price-cell" style="color: var(--price-${item.inputPrice < 0.5 ? 'low' : item.inputPrice < 2 ? 'mid' : 'high'})">$${item.inputPrice}</td>
      <td class="price-cell">$${item.outputPrice}</td>
      <td>${item.intelligence}</td>
      <td>${item.speed}</td>
      <td>${badges.join('')}</td>
      <td><button class="action-btn" data-id="${item.id}">详情</button></td>
    `;

    // 点击整行也打开详情
    tr.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        showModal(item.id);
      }
    });

    tbody.appendChild(tr);
  });

  // 绑定详情按钮
  tbody.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showModal(btn.dataset.id);
    });
  });

  resultCount.textContent = `共 ${filtered.length} 条结果（总计 ${data.length} 条）`;
}

// 渲染主函数
function render() {
  const filtered = filterData();
  renderTable(filtered);
}

// 绑定事件
function bindEvents() {
  // 搜索
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = searchInput.value.trim();
      render();
    }, 120);
  });

  // 能力过滤
  [filterReasoning, filterMultimodal, filterOpen].forEach(el => {
    el.addEventListener('change', () => {
      state.reasoning = filterReasoning.checked;
      state.multimodal = filterMultimodal.checked;
      state.openWeights = filterOpen.checked;
      render();
    });
  });

  // 价格 / 上下文
  priceFilter.addEventListener('change', () => {
    state.priceRange = priceFilter.value;
    render();
  });
  contextFilter.addEventListener('change', () => {
    state.context = contextFilter.value;
    render();
  });

  // 清除筛选
  clearBtn.addEventListener('click', () => {
    state.search = '';
    state.vendors = new Set();
    state.reasoning = state.multimodal = state.openWeights = false;
    state.priceRange = '';
    state.context = '';
    state.sortKey = 'intelligence';
    state.sortDir = 'desc';

    searchInput.value = '';
    filterReasoning.checked = false;
    filterMultimodal.checked = false;
    filterOpen.checked = false;
    priceFilter.value = '';
    contextFilter.value = '';

    vendorChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    render();
  });

  // 表头排序
  document.querySelectorAll('#ai-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDir = (key === 'updateDate' || key === 'vendor' || key === 'model') ? 'asc' : 'desc';
      }
      // 更新视觉
      document.querySelectorAll('#ai-table th').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
      th.classList.add(state.sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
      render();
    });
  });

  // Modal 关闭
  const closeModal = () => {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  };
  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) closeModal();
  });
}

// 显示详情 Modal
function showModal(id) {
  const item = data.find(d => d.id === id);
  if (!item) return;

  modalTitle.textContent = `${item.vendor} · ${item.model}`;
  modalBody.innerHTML = `
    <p><span class="label">更新时间</span> ${item.updateDate}</p>
    <p><span class="label">知识截止</span> ${item.knowledgeCutoff || '—'}</p>
    <p><span class="label">输入价格</span> $${item.inputPrice} / M tokens</p>
    <p><span class="label">输出价格</span> $${item.outputPrice} / M tokens</p>
    <p><span class="label">上下文窗口</span> ${(item.contextWindow / 1000).toLocaleString()}K tokens</p>
    <p><span class="label">智能指数</span> ${item.intelligence}</p>
    <p><span class="label">输出速度</span> ${item.speed} tokens/s</p>
    <p><span class="label">多模态</span> ${item.multimodal ? '支持' : '不支持'}</p>
    <p><span class="label">推理能力</span> ${item.reasoning ? '支持' : '不支持'}</p>
    <p><span class="label">开放权重</span> ${item.openWeights ? '是' : '否'}</p>
    <p><span class="label">工具支持</span> ${item.tools ? item.tools.join(', ') : '—'}</p>
    <p style="margin-top:12px"><span class="label">备注</span> ${item.notes}</p>
  `;
  modalLink.href = item.officialUrl;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

// 初始化排序视觉
function initSortHeaders() {
  const th = document.querySelector(`#ai-table th[data-sort="${state.sortKey}"]`);
  if (th) th.classList.add(state.sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
}

// 主入口
function init() {
  initTheme();
  initVendorChips();
  bindEvents();
  initSortHeaders();
  render();
}

init();
