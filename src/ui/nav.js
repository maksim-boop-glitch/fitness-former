export function renderNav(tabs, activeId) {
  return tabs.map(t => `
    <button data-tab="${t.id}" class="${t.id === activeId ? 'active' : ''}">
      <span class="icon">${t.icon}</span>
      ${t.label}
    </button>
  `).join('');
}
