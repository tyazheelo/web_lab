import { SetButtonBehaviour, SetRefreshCatalogCallback } from './items-editing.js'

const ToCatalogNavId = 'to-catalog';
const ToAboutUsNavId = 'to-about-us';
const ToChatNavId = 'to-chat';

const ContentBLockId = 'inner-content-block';

const CatalogRegulatorBlockId = 'catalog-regulator';
const PageNavigationBlockId = 'page-navigation-block'; 

const SortingSelectId = "sorting";
const FiltrateInputId = 'filtrate-by-name';

let currentSort = 'by-category';
let currentItems = [];
let currentFilter = '';

// Пагинация
let currentPage = 1;
const itemsPerPage = 2; 
let totalPages = 1;

const AboutUsHTML = '/pages/about-us.html';

SetRefreshCatalogCallback(() => LoadAndDisplayCatalog());

(async function() {
    const toCatalog = document.getElementById(ToCatalogNavId);
    const toAboutUs = document.getElementById(ToAboutUsNavId);
    const toChat = document.getElementById(ToChatNavId);
    const sortSelect = document.getElementById(SortingSelectId);
    const searchInput = document.getElementById(FiltrateInputId);
    const backBtn = document.getElementById('back-btn');
    const nextBtn = document.getElementById('next-btn');

    await LoadAndDisplayCatalog();

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                ApplySortAndFilter();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                ApplySortAndFilter();
            }
        });
    }

    if(sortSelect)
    {
        sortSelect.addEventListener('change', (event) => {
            currentSort = event.target.value;
            currentPage = 1; 
            ApplySortAndFilter();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            currentFilter = event.target.value.toLowerCase();
            currentPage = 1; 
            ApplySortAndFilter();
        });
    }

    toCatalog.addEventListener('click', async function(event) {
        event.preventDefault();
        event.stopPropagation();

        showCatalogLayout();
        
        await LoadAndDisplayCatalog();
    });

    toAboutUs.addEventListener('click', async function(event) {
        event.preventDefault();
        event.stopPropagation();

        showAboutUsLayout();
        
        await SetAboutUs(AboutUsHTML);
    });

    toChat.addEventListener('click', async function(event) {
        event.preventDefault();

        window.location.href = '/chat';
    });
}());

function showCatalogLayout() {
    const regulatorBlock = document.getElementById(CatalogRegulatorBlockId);
    const pageNavBlock = document.getElementById(PageNavigationBlockId);
    
    if (regulatorBlock) regulatorBlock.style.display = 'flex';
    if (pageNavBlock) pageNavBlock.style.display = 'flex';
}

function showAboutUsLayout() {
    const regulatorBlock = document.getElementById(CatalogRegulatorBlockId);
    const pageNavBlock = document.getElementById(PageNavigationBlockId);
    
    if (regulatorBlock) regulatorBlock.style.display = 'none';
    if (pageNavBlock) pageNavBlock.style.display = 'none';
}

async function LoadAndDisplayCatalog() {
    try {
        const response = await fetch('/api/items');
        if (!response.ok) throw new Error('Failed to fetch items');
        currentItems = await response.json();
        currentPage = 1; 

        ApplySortAndFilter();        
    } catch (error) {
        console.error('Error loading catalog:', error);

        const contentBlock = document.getElementById(ContentBLockId);

        if (contentBlock) {
            contentBlock.innerHTML = '<div id="error-block"><h3>Ошибка загрузки данных</h3></div>';
        }
    }
}

function DisplayItems(items) {
    const contentBlock = document.getElementById(ContentBLockId);
    const regulatorBlock = document.getElementById(CatalogRegulatorBlockId);
    const pageNavBlock = document.getElementById(PageNavigationBlockId);
    
    if (regulatorBlock) regulatorBlock.style.display = "flex";
    if (pageNavBlock) pageNavBlock.style.display = "flex";

    if (!items || items.length === 0) {
        if (contentBlock) {
            contentBlock.innerHTML = '<div id="error-block"><h3>Товары не найдены</h3></div>';
        }
        if (pageNavBlock) pageNavBlock.style.display = "none";
        return;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = items.slice(startIndex, endIndex);
    
    let content = '';
    paginatedItems.forEach(item => {
        content += `<div id="${item.id}" class="catalog-item-block">`;
        content += `<h3 class="catalog-item-titles">${escapeHtml(item.name)}</h3>`;
        content += '<div class="main-info-block">';
        content += `<span><b>Категория:</b> ${escapeHtml(item.type)}</span>`;
        content += `<span><b>Стоимость:</b> ${item.cost} ƃ</span>`;
        content += "</div>";
        content += '<div class="catalog-item-description">';
        content += `<p>${escapeHtml(item.description || '')}</p>`;
        content += '</div>';
        content += "<div class='edit-block'>";
        content += `<button type='button' class='item-change-btn' id='${item.id}'>Редактировать</button>`;
        content += `<button type='button' class='item-delete-btn' id='${item.id}'>Удалить</button>`;
        content += "</div>";
        content += '</div>';
    });

    if (contentBlock) contentBlock.innerHTML = content;

    updatePaginationButtons(items.length);
    
    SetButtonBehaviour();
}

function updatePaginationButtons(totalItems) {
    const backBtn = document.getElementById('back-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');
    const pageNavBlock = document.getElementById(PageNavigationBlockId);
    
    totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (pageNavBlock) {
        if (totalItems <= itemsPerPage) {
            pageNavBlock.style.display = 'none';
        } else {
            pageNavBlock.style.display = 'flex';
        }
    }
    
    if (backBtn) {
        backBtn.disabled = (currentPage <= 1);
        backBtn.style.opacity = backBtn.disabled ? '0.5' : '1';
        backBtn.style.cursor = backBtn.disabled ? 'not-allowed' : 'pointer';
    }
    
    if (nextBtn) {
        nextBtn.disabled = (currentPage >= totalPages);
        nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
        nextBtn.style.cursor = nextBtn.disabled ? 'not-allowed' : 'pointer';
    }
    
    if (pageInfo) {
        pageInfo.textContent = `Страница ${currentPage} из ${totalPages || 1}`;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function SetAboutUs(htmlFileName) {
    const contentBlock = document.getElementById(ContentBLockId);
    const regulatorBlock = document.getElementById(CatalogRegulatorBlockId);
    const pageNavBlock = document.getElementById(PageNavigationBlockId);
    
    if (regulatorBlock) regulatorBlock.style.display = 'none';
    if (pageNavBlock) pageNavBlock.style.display = 'none';

    try {
        const response = await fetch(htmlFileName);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const htmlContent = await response.text();
        if (contentBlock) contentBlock.innerHTML = htmlContent;
    } catch (error) {
        console.error(`Файл "${htmlFileName}" не найден:`, error);
        if (contentBlock) {
            contentBlock.innerHTML = '<div id="error-block"><h3>Ошибка загрузки страницы</h3></div>';
        }
    }
}

function ApplySortAndFilter(){
    const sorted = Sort(currentItems, currentSort);
    const filteredItems = Filter(sorted, currentFilter);
    DisplayItems(filteredItems);
}

function Sort(items, sortType){
    const sorted = [...items];

    switch(sortType){
        case "by-category":
            return sorted.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type.localeCompare(b.type);
                }
                const [, numA] = a.id.split('-');
                const [, numB] = b.id.split('-');
                return parseInt(numA, 10) - parseInt(numB, 10);
            });
        case "by-alpha": 
            return sorted.sort((a, b) => {
                const nameA = a.name.toLowerCase();
                const nameB = b.name.toLowerCase();
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return 0;
            });
        case "by-rev-alpha":
            return sorted.sort((a, b) => 
            {
                const nameA = a.name.toLowerCase();
                const nameB = b.name.toLowerCase();
                if (nameA < nameB) return 1;
                if (nameA > nameB) return -1;
                return 0;
            });
        case "by-cost":
            return sorted.sort((a, b) => a.cost - b.cost);
        default:
            return sorted;
    }
}

function Filter(items, searchTerm) {
    if (!searchTerm) return items;
    
    return items.filter(item => 
        item.name.toLowerCase().includes(searchTerm));
}

export { LoadAndDisplayCatalog };