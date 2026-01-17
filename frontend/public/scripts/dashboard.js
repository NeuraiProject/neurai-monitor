const API_URL = '/api';
const grid = document.getElementById('domain-grid');
const lastUpdatedEl = document.getElementById('last-updated');
const filterSection = document.getElementById('filter-section');
const filterButtons = document.getElementById('filter-buttons');
const filterMobileToggle = document.getElementById('filter-mobile-toggle');
const filterMobileMenu = document.getElementById('filter-mobile-menu');
const filterMobileLabel = document.getElementById('filter-mobile-label');

const FILTER_DEFAULT = 'all';
const FILTER_LABEL_DEFAULT = 'ALL';
const UI_TEXT = {
    filterDefault: FILTER_LABEL_DEFAULT,
    lastUpdated: 'Last Updated:',
    loadingErrorPrefix: 'Error loading data:',
    availability: {
        on: 'On',
        off: 'Offline'
    },
    ssl: {
        invalid: 'Invalid',
        valid: (days, compact) => (compact ? `${days}d` : `Valid (${days} days)`),
        expired: (days, compact) => (compact ? `${days}d` : `Expired (${days} days)`)
    },
    time: {
        now: 'Now',
        lastWindow: '7 Days'
    },
    heatmap: {
        noData: 'Sin datos',
        zero: '0 incidencias',
        one: '1 incidencia',
        many: (count) => `${count} incidencias`
    }
};
const THEME = {
    grid: {
        small: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 mt-8',
        normal: 'grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8 mt-8'
    },
    filters: {
        desktop: {
            active: 'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 bg-gray-900 text-white shadow-md',
            inactive: 'px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all duration-200'
        },
        mobile: {
            active: 'w-full text-left px-3 py-2 rounded-lg text-xs font-semibold bg-gray-900 text-white',
            inactive: 'w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100'
        }
    },
    card: {
        normal: {
            padding: 'p-4 md:p-6',
            titleSize: 'text-[15px] md:text-[15px]',
            badgeSize: 'px-2 py-0.5 md:px-2.5 text-[10px] md:text-xs',
            iconSize: 'w-3 h-3 md:w-4 md:h-4',
            textSize: 'text-xs md:text-sm',
            labelSize: 'text-[10px]',
            barGap: 'gap-[2px]',
            barPadding: 'p-[4px]',
            cubeSize: 'w-[9px] h-[9px]'
        },
        compact: {
            padding: 'p-2',
            titleSize: 'text-[9px] md:text-[11px]',
            badgeSize: 'text-[9px] px-1.5',
            iconSize: 'w-3 h-3',
            textSize: 'text-[10px]',
            labelSize: 'text-[9px]',
            barGap: 'gap-[1px]',
            barPadding: 'p-[3px]',
            cubeSize: 'w-[6px] h-[6px]'
        },
        common: {
            barContainerH: 'h-auto',
            barWidth: 'w-fit',
            barLayout: 'grid grid-rows-4 grid-flow-col auto-cols-max',
            titleWrap: 'truncate',
            shadow: 'shadow-[0_0_15px_rgba(0,0,0,0.4)]'
        }
    },
    hover: {
        activeOpacity: '0.5',
        resetOpacity: '1',
        ring: 'hover:ring-1 hover:ring-gray-800/80 ring-inset'
    },
    heatmap: {
        colors: {
            noData: 'bg-gray-200',
            greenDark: 'bg-[#216e39]',
            greenLight: 'bg-[#40c463]',
            redLight: 'bg-[#f85149]',
            redDark: 'bg-[#b62324]'
        }
    }
};
const SSL_WARNING_DAYS = 10;
const DEFAULT_HOVER_INFO = `<span>${UI_TEXT.time.lastWindow}</span><span>${UI_TEXT.time.now}</span>`;

let allDomainsData = [];
let currentFilter = FILTER_DEFAULT;
let isSmallMode = false;
let filterLabelMap = new Map([[FILTER_DEFAULT, FILTER_LABEL_DEFAULT]]);

// View Toggle Listener
const viewToggle = document.getElementById('view-toggle');
if (viewToggle) {
    viewToggle.addEventListener('change', (e) => {
        isSmallMode = e.target.checked;
        setGridLayout();
        renderFilteredDomains();
    });
}

const normalizeCategory = (category) => {
    if (!category) return '';
    return category
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '');
};

const updateFilterUI = () => {
    if (filterButtons) {
        const buttons = filterButtons.querySelectorAll('button[data-filter]');
        buttons.forEach(btn => {
            const isActive = btn.dataset.filter === currentFilter;
            btn.className = isActive
                ? THEME.filters.desktop.active
                : THEME.filters.desktop.inactive;
        });
    }

    if (filterMobileMenu) {
        const mobileButtons = filterMobileMenu.querySelectorAll('button[data-filter]');
        mobileButtons.forEach(btn => {
            const isActive = btn.dataset.filter === currentFilter;
            btn.className = isActive
                ? THEME.filters.mobile.active
                : THEME.filters.mobile.inactive;
        });
    }

    if (filterMobileLabel) {
        filterMobileLabel.textContent = filterLabelMap.get(currentFilter) || UI_TEXT.filterDefault;
    }
};

const closeMobileMenu = () => {
    if (filterMobileMenu) {
        filterMobileMenu.classList.add('hidden');
    }
};

window.setFilter = (filterType) => {
    currentFilter = filterType;
    updateFilterUI();
    renderFilteredDomains();
    closeMobileMenu();
};

const createFilterButton = (label, value) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.dataset.filter = value;
    btn.addEventListener('click', () => window.setFilter(value));
    return btn;
};

const renderFilters = (categories) => {
    if (!filterSection || !filterButtons) return;

    if (!categories || categories.length === 0) {
        filterSection.classList.add('hidden');
        filterButtons.innerHTML = '';
        if (filterMobileMenu) filterMobileMenu.innerHTML = '';
        currentFilter = FILTER_DEFAULT;
        updateFilterUI();
        return;
    }

    filterSection.classList.remove('hidden');

    const normalizedCategories = categories.map(category => ({
        label: category,
        value: normalizeCategory(category)
    }));

        filterLabelMap = new Map([[FILTER_DEFAULT, UI_TEXT.filterDefault]]);
    normalizedCategories.forEach(({ label, value }) => filterLabelMap.set(value, label));

    filterButtons.innerHTML = '';
    filterButtons.appendChild(createFilterButton(UI_TEXT.filterDefault, FILTER_DEFAULT));
    normalizedCategories.forEach(({ label, value }) => {
        filterButtons.appendChild(createFilterButton(label, value));
    });

    if (filterMobileMenu) {
        filterMobileMenu.innerHTML = '';
        filterMobileMenu.appendChild(createFilterButton(UI_TEXT.filterDefault, FILTER_DEFAULT));
        normalizedCategories.forEach(({ label, value }) => {
            filterMobileMenu.appendChild(createFilterButton(label, value));
        });
    }

    currentFilter = FILTER_DEFAULT;
    updateFilterUI();
};

if (filterMobileToggle) {
    filterMobileToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!filterMobileMenu) return;
        filterMobileMenu.classList.toggle('hidden');
    });
}

document.addEventListener('click', (e) => {
    if (!filterMobileMenu || filterMobileMenu.classList.contains('hidden')) return;
    const parent = filterMobileMenu.parentElement;
    if (parent && !parent.contains(e.target)) {
        filterMobileMenu.classList.add('hidden');
    }
});

function renderFilteredDomains() {
    if (!allDomainsData.length) return;

    const filtered = allDomainsData.filter(d => {
        if (currentFilter === FILTER_DEFAULT) return true;
        return normalizeCategory(d.category) === currentFilter;
    });

    renderDomains(filtered);
}

const setGridLayout = () => {
    if (!grid) return;
    grid.className = isSmallMode ? THEME.grid.small : THEME.grid.normal;
};

const getHoverInfoEl = (domain) => {
    if (!domain) return null;
    return document.getElementById('hover-info-' + domain);
};

// Helper functions for hover effects (Global scope)
window.updateHoverInfo = (el, date, time, status) => {
    el.style.opacity = THEME.hover.activeOpacity;
    const domain = el.getAttribute('data-domain');
    const infoEl = getHoverInfoEl(domain);
    if (infoEl) {
        infoEl.innerHTML = `<span class="font-bold">${date} ${time}</span><span>${status}</span>`;
    }
};

window.resetHoverInfo = (el) => {
    el.style.opacity = THEME.hover.resetOpacity;
    const domain = el.getAttribute('data-domain');
    const infoEl = getHoverInfoEl(domain);
    if (infoEl) {
        infoEl.innerHTML = DEFAULT_HOVER_INFO;
    }
};

async function fetchResults() {
    try {
        // Fetch domains first to get the list
        const res = await fetch(`${API_URL}/domains`);
        if (!res.ok) throw new Error('Failed to fetch domains');
        const domains = await res.json();

        // Parallel fetch history for all domains
        const domainsWithHistory = await Promise.all(domains.map(async (d) => {
            try {
                const histRes = await fetch(`${API_URL}/history?domain=${encodeURIComponent(d.domain)}`);
                const history = await histRes.json();
                return { ...d, history };
            } catch (e) {
                return { ...d, history: [] };
            }
        }));

        allDomainsData = domainsWithHistory;
        const categories = Array.from(new Set(
            domainsWithHistory.map(d => d.category).filter(Boolean)
        ));
        renderFilters(categories);
        renderFilteredDomains();
        updateLastChecked(domainsWithHistory);
    } catch (err) {
        if (grid) grid.innerHTML = `<div class="col-span-full text-center text-red-500">${UI_TEXT.loadingErrorPrefix} ${err.message}</div>`;
    }
}

function updateLastChecked(domains) {
    if (domains.length > 0 && lastUpdatedEl) {
        const latest = domains.reduce((max, d) => {
            const checkTime = new Date(d.checked_at).getTime();
            return checkTime > max ? checkTime : max;
        }, 0);

        if (latest > 0) {
            const dateObj = new Date(latest);
            const desktopText = dateObj.toLocaleString(undefined, {
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            const mobileText = dateObj.toLocaleString(undefined, {
                year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            });

            lastUpdatedEl.innerHTML = `
                    <span class="hidden md:inline">${UI_TEXT.lastUpdated} ${desktopText}</span>
                    <span class="md:hidden flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5 text-gray-400">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        ${mobileText}
                    </span>
                `;
        }
    }
}

function renderDomains(domains) {
    if (!grid) return;
    grid.innerHTML = domains.map(d => {
        const density = isSmallMode ? THEME.card.compact : THEME.card.normal;
        const uptimeBar = generateUptimeBar(d.history, d.domain, density.cubeSize);
        const cardBg = d.available ? 'bg-emerald-50/50' : 'bg-rose-50/50';
        const titleWrap = THEME.card.common.titleWrap;

        const titleHtml = renderTitle(d.domain, density.titleSize, titleWrap);
        const sslHtml = renderSslStatus(d, density.iconSize, isSmallMode);
        const statusBadge = renderStatusBadge(d.available, density.badgeSize);

        return `
          <div class="${cardBg} ${density.padding} rounded-lg ${THEME.card.common.shadow} border border-transparent relative overflow-hidden group">
              <div>
                  <div class="flex items-start mb-1 md:mb-3">
                      ${titleHtml}
                  </div>

                  <div class="flex items-center gap-2 ${density.textSize} text-gray-500 mb-2 md:mb-6">
                      ${sslHtml}
                      ${statusBadge}
                  </div>
                   
                   <div class="mt-1 pt-1 md:mt-4 md:pt-4 border-t border-gray-200/50">
                      <div class="flex justify-between ${density.labelSize} uppercase tracking-wider text-gray-600 mb-1 font-medium" id="hover-info-${d.domain}">
                          ${DEFAULT_HOVER_INFO}
                      </div>
                      <div class="w-full overflow-x-auto pb-1 no-scrollbar">
                          <div class="${THEME.card.common.barLayout} ${THEME.card.common.barContainerH} ${density.barGap} ${density.barPadding} ${THEME.card.common.barWidth} box-content bg-gray-200/50 border border-gray-400 flex-none mx-auto">
                              ${uptimeBar}
                          </div>
                      </div>
                   </div>
              </div>
          </div>
      `}).join('');
}

const renderTitle = (domain, titleSize, titleWrap) => {
    const titleClass = `${titleSize} ${titleWrap} domain-title w-full min-w-0 font-medium text-gray-800 tracking-tight pr-2`;
    if (domain.startsWith('http')) {
        return `<a href="${domain}" target="_blank" rel="noopener noreferrer" class="${titleClass} hover:text-gray-800 visited:text-gray-800 no-underline cursor-pointer" title="${domain}">${domain}</a>`;
    }
    return `<h3 class="${titleClass}" title="${domain}">${domain}</h3>`;
};

const renderSslStatus = (domainData, iconSize, compactMode) => {
    const isWarning = domainData.ssl_days_remaining < 0 || !domainData.ssl_valid || domainData.ssl_days_remaining <= SSL_WARNING_DAYS;
    const statusClass = isWarning ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold';
    let statusText = UI_TEXT.ssl.invalid;

    if (domainData.ssl_days_remaining < 0) {
        statusText = UI_TEXT.ssl.expired(domainData.ssl_days_remaining, compactMode);
    } else if (domainData.ssl_valid) {
        statusText = UI_TEXT.ssl.valid(domainData.ssl_days_remaining, compactMode);
    }

    return `
        <div class="flex items-center gap-1">
            <svg class="${iconSize}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
            <span class="${statusClass}">${statusText}</span>
        </div>
    `;
};

const renderStatusBadge = (isAvailable, badgeSize) => {
    const statusClass = isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
    const statusText = isAvailable ? UI_TEXT.availability.on : UI_TEXT.availability.off;
    return `<span class="inline-flex items-center ${badgeSize} rounded-full font-medium ${statusClass} flex-shrink-0 ml-auto">${statusText}</span>`;
};

function generateUptimeBar(history, domain, cubeSize) {
    // 144 hours = 144 slots of 1 hour
    const slotDuration = 60 * 60 * 1000;
    const slots = 144;

    const nowRaw = new Date();
    const nowAligned = new Date(nowRaw);
    nowAligned.setMinutes(0, 0, 0);
    const nowTs = nowAligned.getTime();

    const barData = new Array(slots).fill(null);

    history.forEach(entry => {
        if (entry.available !== true && entry.available !== false) return;
        const entryTime = new Date(entry.checked_at).getTime();
        const entryHour = new Date(entryTime);
        entryHour.setMinutes(0, 0, 0);
        const diff = nowTs - entryHour.getTime();

        if (diff < 0) return;

        const slotsAgo = Math.floor(diff / slotDuration);
        const slotIndex = slots - 1 - slotsAgo;

        if (slotIndex >= 0 && slotIndex < slots) {
            if (barData[slotIndex] === null) {
                barData[slotIndex] = { incidents: 0, checks: 0 };
            }
            barData[slotIndex].checks += 1;
            if (entry.available === false) {
                barData[slotIndex].incidents += 1;
            }
        }
    });

    return barData.map((slot, index) => {
        let colorClass = THEME.heatmap.colors.noData;
        let statusText = UI_TEXT.heatmap.noData;
        let hoverClass = THEME.hover.ring;

        if (slot) {
            const incidents = slot.incidents;
            if (incidents === 0) {
                colorClass = THEME.heatmap.colors.greenDark;
                statusText = UI_TEXT.heatmap.zero;
            } else if (incidents === 1 && slot.checks === 1) {
                colorClass = THEME.heatmap.colors.redLight;
                statusText = UI_TEXT.heatmap.one;
            } else if (incidents === 1) {
                colorClass = THEME.heatmap.colors.greenLight;
                statusText = UI_TEXT.heatmap.one;
            } else if (incidents <= 3) {
                colorClass = THEME.heatmap.colors.redLight;
                statusText = UI_TEXT.heatmap.many(incidents);
            } else {
                colorClass = THEME.heatmap.colors.redDark;
                statusText = UI_TEXT.heatmap.many(incidents);
            }
            hoverClass = '';
        }

        const slotsAgo = slots - 1 - index;
        const slotTime = new Date(nowTs - (slotsAgo * slotDuration));
        const timeString = slotTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = slotTime.toLocaleDateString();

        // Use simple arguments for the helper function
        return `<div 
            class="${cubeSize} ${colorClass} ${hoverClass} rounded-[2px] transition-opacity transition-transform duration-150 hover:-translate-y-[1px] cursor-crosshair" 
            data-domain="${domain}"
            onmouseover="window.updateHoverInfo(this, '${dateString}', '${timeString}', '${statusText}')" 
            onmouseout="window.resetHoverInfo(this)"
            ></div>`;
    }).join('');
}

// Scheduler to sync with quarter-hour marks
function scheduleFetch() {
    fetchResults(); // Fetch immediately

    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Calculate delay to next quarter hour + 10 seconds buffer
    // e.g. at 10:05 -> target 10:15:10
    const nextQuarterMin = Math.ceil((minutes + 1) / 15) * 15;
    const minutesUntil = nextQuarterMin - minutes;

    let delay = (minutesUntil * 60 * 1000) - (seconds * 1000) + 10000; // +10s buffer

    console.log(`Scheduling next update in ${Math.round(delay / 1000)}s`);

    setTimeout(() => {
        scheduleFetch();
    }, delay);
}

// Initial Kickoff
scheduleFetch();

// Redundant safety poll every 60s in case of browser sleep/timer drift
setInterval(fetchResults, 60000);
